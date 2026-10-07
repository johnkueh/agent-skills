import assert from "node:assert/strict";
import test from "node:test";
import { centerCropBox, parseAspect } from "./aspect.mjs";

test("parseAspect accepts W:H and rejects bad or extreme ratios", () => {
  assert.deepEqual(parseAspect("4:5"), { w: 4, h: 5 });
  assert.deepEqual(parseAspect(" 9:16 "), { w: 9, h: 16 });
  for (const bad of ["", "4x5", "0:1", "4:", "a:b", "1:4"]) assert.throws(() => parseAspect(bad));
});

test("centerCropBox returns the largest centred box with the exact ratio", () => {
  // Off-aspect native portrait output to 3:4: trims width only.
  assert.deepEqual(centerCropBox(1092, 1440, parseAspect("3:4")), { left: 6, top: 0, width: 1080, height: 1440 });
  // Square to 4:5: exact ratio wins over keeping full height (1024 is not a multiple of 5).
  assert.deepEqual(centerCropBox(1024, 1024, parseAspect("4:5")), { left: 104, top: 2, width: 816, height: 1020 });
  // Portrait preset to 9:16: trims width.
  assert.deepEqual(centerCropBox(1024, 1536, parseAspect("9:16")), { left: 80, top: 0, width: 864, height: 1536 });
  // Already exact: unchanged.
  assert.deepEqual(centerCropBox(1024, 1536, parseAspect("2:3")), { left: 0, top: 0, width: 1024, height: 1536 });
  // Non-reduced ratios behave like reduced ones.
  assert.deepEqual(centerCropBox(1536, 1024, parseAspect("32:18")), centerCropBox(1536, 1024, parseAspect("16:9")));
  for (const [w, h, a] of [[1092, 1440, "4:5"], [1536, 1024, "16:9"], [1254, 1254, "2:3"]]) {
    const box = centerCropBox(w, h, parseAspect(a));
    const { w: aw, h: ah } = parseAspect(a);
    assert.equal(box.width * ah, box.height * aw);
    assert.ok(box.left + box.width <= w && box.top + box.height <= h);
  }
  assert.throws(() => centerCropBox(1, 1, parseAspect("2:3")), /too small/);
});
