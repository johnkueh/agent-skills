#!/bin/bash
# Single-pass parallel disk scanner for macOS.
#
# The naive approach — a dozen serial `du -sh` and `find | xargs du` stanzas — walks
# the same bytes several times over and pins one core. This walks each byte once,
# fans out across cores, and caches the result so follow-up questions are free.
#
#   scan.sh              build the index (or reuse a fresh one), print the report
#   scan.sh --refresh    force a rescan
#   scan.sh --report     print the report from the cached index, no scanning
#   scan.sh --top DIR    biggest things under DIR, straight from the cache
#
set -uo pipefail

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/system-disk-cleanup"
INDEX="$CACHE_DIR/index.tsv"
MAX_AGE_MIN="${SCAN_MAX_AGE_MIN:-30}"
JOBS="${SCAN_JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || echo 8)}"
DEPTH="${SCAN_DEPTH:-3}"

# Directories to expand one extra level, so no single `du` dominates the pool.
# Anything holding many large sibling trees belongs here.
CODE_ROOTS="${SCAN_CODE_ROOTS:-$HOME/Projects $HOME/src $HOME/code $HOME/dev}"

mkdir -p "$CACHE_DIR"

emit() { [ -e "$1" ] && printf '%s\n' "$1"; }

# Build the root list. The goal is many roughly-equal roots, not few huge ones:
# wall-clock equals the slowest single root, so one 80s monorepo caps everything.
build_roots() {
  local p c wt repo

  for p in "$HOME"/* "$HOME"/.[!.]*; do
    [ -e "$p" ] || continue
    case " $CODE_ROOTS $HOME/Library " in
      *" $p "*) ;;            # expanded below
      *) emit "$p" ;;
    esac
  done

  # ~/Library: split children; shard the pnpm store, which is one giant flat tree.
  for p in "$HOME"/Library/*; do
    [ -e "$p" ] || continue
    if [ "$p" = "$HOME/Library/pnpm" ]; then
      for c in "$HOME"/Library/pnpm/store/*/files/*; do emit "$c"; done
      for c in "$HOME"/Library/pnpm/store/*/index; do emit "$c"; done
    else
      emit "$p"
    fi
  done

  # Code roots: split each repo into its children, and each git worktree into its own
  # root. A monorepo with N worktrees is otherwise a single multi-minute du.
  for r in $CODE_ROOTS; do
    [ -d "$r" ] || continue
    for repo in "$r"/*; do
      [ -d "$repo" ] || { emit "$repo"; continue; }
      for c in "$repo"/* "$repo"/.[!.]*; do
        [ -e "$c" ] || continue
        if [ -d "$c/worktrees" ]; then
          for wt in "$c"/worktrees/*; do emit "$wt"; done
          for wt in "$c"/*; do [ "$wt" = "$c/worktrees" ] || emit "$wt"; done
        else
          emit "$c"
        fi
      done
    done
  done

  emit /Applications
  for p in /Library/*; do emit "$p"; done
  # Everything else on the Data volume that isn't home: /opt, /usr/local, /private/var, ...
  for p in /opt /usr/local /private/var/folders /private/var/db /private/var/log /private/tmp; do emit "$p"; done
}

# Roots are disjoint by construction, so each root's own index line is its full total.
# Roll those up to give real numbers for the dirs we deliberately split (Projects, Library).
rollup() {
  local roots="$CACHE_DIR/roots.txt"
  awk -F'\t' 'NR==FNR { want[$0]=1; next } ($2 in want) { print $1 "\t" $2 }' "$roots" "$INDEX" |
    awk -F'\t' -v home="$HOME" '
      {
        p = $2
        if (index(p, home "/") == 1) {
          rest = substr(p, length(home) + 2)
          n = index(rest, "/")
          key = home "/" (n ? substr(rest, 1, n - 1) : rest)
        } else {
          rest = substr(p, 2)
          n = index(rest, "/")
          key = "/" (n ? substr(rest, 1, n - 1) : rest)
        }
        sum[key] += $1
      }
      END { for (k in sum) printf "%d\t%s\n", sum[k], k }' |
    sort -rn | head -"${1:-14}" |
    awk -F'\t' -v home="$HOME" '{ p=$2; sub(home, "~", p); printf "  %7.2fG  %s\n", $1/1048576, p }'
}

scan() {
  local t0 t1 roots parts
  roots="$CACHE_DIR/roots.txt"
  parts="$CACHE_DIR/parts"
  build_roots 2>/dev/null | grep -v '^$' | sort -u > "$roots"
  rm -rf "$parts"; mkdir -p "$parts"
  t0=$(date +%s)
  # Each du writes to its OWN file. Pointing N parallel `du`s at one stdout interleaves
  # their partial writes and silently corrupts paths ("bq-analytics" + "12" -> "bq-analytics12").
  # NUL-delimited: root paths contain spaces ("Application Support") that xargs would split on.
  # -x: don't cross mount points (simulator runtimes are separate APFS volumes; df covers them)
  # -k: KiB, stable to parse.  Sizes are cumulative per directory.
  tr '\n' '\0' < "$roots" | xargs -0 -P "$JOBS" -I{} sh -c '
      out=$(printf "%s" "$1" | /usr/bin/shasum | /usr/bin/cut -c1-16)
      /usr/bin/du -x -k -d '"$DEPTH"' "$1" > "'"$parts"'/$out" 2>/dev/null
    ' _ {}
  cat "$parts"/* > "$INDEX.tmp" 2>/dev/null
  mv "$INDEX.tmp" "$INDEX"
  rm -rf "$parts"
  t1=$(date +%s)
  printf 'scanned %s roots in %ss across %s jobs -> %s entries\n\n' \
    "$(wc -l < "$roots" | tr -d ' ')" "$((t1 - t0))" "$JOBS" "$(wc -l < "$INDEX" | tr -d ' ')"
}

index_fresh() {
  [ -f "$INDEX" ] || return 1
  [ -n "$(find "$INDEX" -mmin "-$MAX_AGE_MIN" 2>/dev/null)" ]
}

# Biggest direct children of a prefix.
#
# A dir we split into sub-roots (~/Projects, a monorepo) has NO index line of its own and
# no direct-child lines either — its children were never a `du` argument. For those we sum
# the root totals underneath, grouped by the next path component. Roots are disjoint, so
# each root's own line is its full size and the sums are exact.
top_under() {
  local prefix="${1%/}" limit="${2:-12}"
  local roots="$CACHE_DIR/roots.txt"
  awk -F'\t' -v p="$prefix/" -v roots="$roots" '
    BEGIN { while ((getline r < roots) > 0) isroot[r] = 1 }
    index($2, p) != 1 { next }
    {
      rest = substr($2, length(p) + 1)
      n = index(rest, "/")
      child = n ? substr(rest, 1, n - 1) : rest
      if (child == "") next
      # A child either has its own du line, or it was split and its descendants are roots.
      # Decide per child, not once for the whole prefix: ~/Projects holds both loose files
      # (own line) and repos (no line, roots underneath).
      if (!n) direct[child] = $1
      else if ($2 in isroot) rolled[child] += $1
    }
    END {
      for (c in direct) { seen[c] = 1; printf "%d\t%s\n", direct[c], c }
      for (c in rolled) if (!(c in seen)) printf "%d\t%s\n", rolled[c], c
    }' "$INDEX" | sort -rn | head -"$limit" |
    awk -F'\t' '{ printf "  %7.2fG  %s\n", $1/1048576, $2 }'
}

# Biggest entries anywhere matching a name pattern (build artifacts, caches).
biggest_matching() {
  local pattern="$1" limit="${2:-15}"
  awk -F'\t' -v pat="$pattern" '$2 ~ pat { printf "%d\t%s\n", $1, $2 }' "$INDEX" |
    sort -rn | head -"$limit" |
    awk -F'\t' -v home="$HOME" '{ p=$2; sub(home, "~", p); printf "  %7.2fG  %s\n", $1/1048576, p }'
}

report() {
  echo "=== Real disk usage (Data volume — '/' is a sealed snapshot and lies) ==="
  df -h /System/Volumes/Data | awk 'NR==2{printf "  %s used of %s, %s free (%s)\n", $3, $2, $4, $5}'
  echo
  echo "  Other volumes (simulator runtimes are separate APFS partitions):"
  df -h | awk 'NR>1 && $1 ~ /^\/dev\// && $9 != "/System/Volumes/Data" {printf "    %-28s %6s used  %6s free\n", $9, $3, $4}' | head -6
  echo
  echo "=== Biggest trees, rolled up (home + system) ==="
  rollup 14
  echo
  echo "=== APFS local snapshots (hold deleted bytes hostage) ==="
  local snaps
  snaps=$(tmutil listlocalsnapshots / 2>/dev/null | grep -c 'com.apple')
  echo "  $snaps snapshot(s). Purge with: sudo tmutil thinlocalsnapshots / 999999999999 4"
  echo
  echo "=== Hidden dot-dirs in home (where the surprises hide) ==="
  awk -F'\t' -v h="$HOME/." 'index($2, h) == 1 { rest = substr($2, length(h) + 1); if (rest != "" && !index(rest, "/")) printf "%d\t.%s\n", $1, rest }' "$INDEX" |
    sort -rn | head -10 | awk -F'\t' '{ printf "  %7.2fG  ~/%s\n", $1/1048576, $2 }'
  echo
  echo "=== Build artifacts (regenerable — usually the best payoff) ==="
  biggest_matching '/(ios/build|ios/Pods|android/build|DerivedData|\.next|\.turbo|target|\.gradle/caches)$' 12
  echo
  echo "=== node_modules (WARNING: see clonefile note below) ==="
  biggest_matching '/node_modules$' 8
  echo
  echo "=== Caches ==="
  biggest_matching '/(Caches|\.cache)/[^/]+$' 10
  echo
  cat <<'NOTE'
--- Before you delete anything ---
* pnpm on APFS uses clonefile: node_modules files show full size under `du` but share
  blocks with ~/Library/pnpm/store. Deleting them frees far less than `du` claims.
  Verify with `stat -f '%l' <file>` (link count 1 + huge du = probably a clone).
  Real reclaim comes from `pnpm store prune` AFTER the referencing trees are gone.
* Always quote the `df` delta, never the `du` sum. `du` is what a tree *would* cost
  if nothing were shared; `df` is what you actually got back.
* Xcode Archives hold dSYMs for shipped builds — needed to symbolicate crash reports
  from released versions. Not regenerable. Never auto-delete.
NOTE
}

case "${1:-}" in
  --report) [ -f "$INDEX" ] || { echo "no index; run without --report first" >&2; exit 1; }; report ;;
  --refresh) scan; report ;;
  --top) shift; [ -f "$INDEX" ] || { echo "no index" >&2; exit 1; }; top_under "${1%/}" "${2:-15}" ;;
  *) if index_fresh; then echo "using cached index ($(find "$INDEX" -mmin -$MAX_AGE_MIN -exec stat -f '%Sm' -t '%H:%M' {} \;))"; echo; else scan; fi; report ;;
esac
