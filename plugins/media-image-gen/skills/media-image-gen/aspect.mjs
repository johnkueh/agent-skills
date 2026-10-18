// Exact-aspect normalisation for native output, which is often a few pixels off
// the requested ratio (e.g. 1092x1440 for 3:4). Behaviour: centre-crop to the
// largest box with exactly the requested ratio. Never pads or upscales.

export function parseAspect(value) {
  const match = /^(\d+):(\d+)$/.exec(String(value ?? "").trim());
  const w = match && Number(match[1]);
  const h = match && Number(match[2]);
  if (!w || !h) throw new Error(`Invalid aspect '${value}'. Use W:H, for example 4:5, 2:3, 9:16 or 1:1.`);
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > 3) throw new Error(`Aspect ${value} is outside 1:3..3:1.`);
  return { w, h };
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

/** Centre-crop box with exactly aspect.w:aspect.h, as sharp extract() options. */
export function centerCropBox(width, height, aspect) {
  const g = gcd(aspect.w, aspect.h);
  const unitW = aspect.w / g;
  const unitH = aspect.h / g;
  const k = Math.min(Math.floor(width / unitW), Math.floor(height / unitH));
  if (k < 1) throw new Error(`Image ${width}x${height} is too small for aspect ${aspect.w}:${aspect.h}.`);
  const cropW = k * unitW;
  const cropH = k * unitH;
  return {
    left: Math.floor((width - cropW) / 2),
    top: Math.floor((height - cropH) / 2),
    width: cropW,
    height: cropH,
  };
}

function orientation(w, h) {
  return w === h ? "square" : w < h ? "portrait" : "landscape";
}

/** Prompt size hint for an aspect when --size is auto, so Codex picks the right canvas orientation. */
export function sizeHintForAspect(aspect) {
  const o = orientation(aspect.w, aspect.h);
  const preset = o === "portrait" ? "1024x1536" : o === "landscape" ? "1536x1024" : "1024x1024";
  return `${preset} (${o}, ${aspect.w}:${aspect.h} aspect ratio)`;
}

/** Warning text when native output's orientation differs from the requested aspect, else null. */
export function orientationMismatch(width, height, aspect) {
  const got = orientation(width, height);
  const want = orientation(aspect.w, aspect.h);
  return got === want ? null : `Codex returned a ${got} ${width}x${height} image for ${want} ${aspect.w}:${aspect.h}; the crop drops part of the subject.`;
}
