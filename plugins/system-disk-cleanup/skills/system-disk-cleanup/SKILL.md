---
name: system-disk-cleanup
description: "Inspect and clean macOS disk usage. Use for low storage, disk-full problems, finding storage hogs, checking free space, or safely freeing space."
---

# Disk cleanup for macOS

Inspect first. A read-only disk question authorizes inspection; a cleanup request
covers the named targets and any clearly specified disposable-cache scope.
Prepare a ranked inventory before asking about unapproved targets. Do not ask
again for targets already selected.

## Measure and inspect

```sh
df -h /System/Volumes/Data
df -h
```

For a broad scan, use the bundled single-pass index instead of serial `du` runs:

```sh
scripts/scan.sh                 # build or reuse the index, print the report
scripts/scan.sh --refresh       # force a rescan
scripts/scan.sh --report        # report from the cached index only
scripts/scan.sh --top ~/Projects 15
```

It caches to `~/.cache/system-disk-cleanup/index.tsv`. Reuse it for follow-up
questions, but take a fresh measurement when age or deletion scope depends on it.
A cached index doesn't prove a directory is idle.

Use the Data volume for user files and inspect separate simulator/runtime
volumes. Start with likely large roots and avoid repeatedly traversing the same
tree. Use exact paths and quote paths containing spaces. Shared APFS clone or
hardlink blocks mean apparent `du` totals are not reclaim estimates; measure the
Data-volume `df` delta after cleanup and allow for asynchronous reclamation and
concurrent writes.

## Choose targets by ownership and regenerability

- Build outputs and caches: verify the exact directory is untracked, regenerable,
  and unused by an active build or application before deleting it.
- Worktrees: use `git worktree list --porcelain`, inspect tracked and untracked
  changes, upstream status, unpushed commits, and active task ownership. A failed
  Git query or missing upstream is unknown, not zero unpushed work. Remove only
  an approved inactive checkout with `git worktree remove <path>`; do not use
  `--force` as the default or push a branch merely to make deletion convenient.
- Xcode: preserve Archives and release dSYMs. Inspect DerivedData per project;
  active builds and current device symbols are useful state.
- Simulators: list installed devices and runtimes, check lane/lease ownership,
  and use Xcode's supported runtime removal or the available device tool for the
  selected target. Erasing a device deletes its apps and data. Do not remove
  mounted runtime directories with `sudo rm`.
- Docker: inspect `docker system df`, containers, images, and volumes. Clean only
  the selected unused objects. Deleting `Docker.raw` destroys the VM's containers,
  images, and volumes; it is not routine cache cleanup.
- Package stores, model caches, browser profiles, unknown directories, and
  archives need their own scope decision. Being old or large does not establish
  that they are unused. Preserve credentials, user data, and active runtimes.
- Shared package stores (pnpm, Yarn, CocoaPods caches, Gradle `modules-2`): report
  their size but keep them unless the user names that store. Don't add store
  pruning to a worktree removal.
- App updater and code-sign scratch (Chrome code-sign clones, Sparkle installer
  payloads): inspect the exact subdirectory, its age, and running app/updater
  processes. Never delete the parent tree wholesale. Keep the current iOS
  DeviceSupport version unless the user selects it.
- APFS snapshots: inspect if reclamation is unexpectedly delayed. Do not thin or
  delete backups just to make a reclaim number match an estimate.

## Finish

Delete only the authorized exact targets, then verify the remaining state and
actual free-space change. Report what was removed, space recovered, and skipped
candidates with a useful reason. Batch independent read-only inspection; use a
subagent only when an independent domain warrants it and delegation is available.
