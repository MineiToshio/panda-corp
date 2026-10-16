/**
 * Pixel comparison. `compareRGBA` is a port of pixelmatch 7.2.0 (https://github.com/mapbox/pixelmatch, ISC License,
 * Copyright (c) 2025, Mapbox) restricted to counting: the same YIQ colour delta (Kotsarenko and Ramos), the same
 * anti-aliasing detector (Vysniauskas, 2009) and the same checkerboard blending of translucent pixels, plus a mask:
 * a reference pixel of the mask colour (magenta by default) is skipped and counted apart.
 * ISC: Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
 * granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS
 * PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE.
 * Images are decoded inside Chromium (createImageBitmap + canvas), so PNG and JPEG need no Node dependency.
 */

/**
 * Counts the pixels that differ beyond the YIQ threshold, anti-aliasing excluded. Self-contained (it is also
 * injected into a page), so every helper is nested.
 * @param {Uint8Array|Uint8ClampedArray} img1 reference RGBA
 * @param {Uint8Array|Uint8ClampedArray} img2 candidate RGBA
 * @param {number} width
 * @param {number} height
 * @param {{threshold?: number, includeAA?: boolean, checkerboard?: boolean, mask?: number[]|null}} [options]
 * @returns {{diff: number, masked: number}} differing pixels, and pixels skipped by the mask
 */
export function compareRGBA(img1, img2, width, height, options = {}) {
  const { threshold = 0.1, includeAA = false, checkerboard = true, mask = [255, 0, 255] } = options;
  if (img1.length !== img2.length) throw new Error(`Image sizes do not match. Image 1 size: ${img1.length}, image 2 size: ${img2.length}`);
  if (img1.length !== width * height * 4) throw new Error(`Image data size does not match width/height. Expecting ${width * height * 4}. Got ${img1.length}`);
  const len = width * height;
  const a32 = new Uint32Array(img1.buffer, img1.byteOffset, len);
  const b32 = new Uint32Array(img2.buffer, img2.byteOffset, len);

  function blend(k, r1, g1, b1, a1, r2, g2, b2, a2) {
    let rb = 255;
    let gb = 255;
    let bb = 255;
    if (checkerboard) {
      rb = 48 + 159 * (k % 2);
      gb = 48 + 159 * (((k / 1.618033988749895) | 0) % 2);
      bb = 48 + 159 * (((k / 2.618033988749895) | 0) % 2);
    }
    const da = a1 - a2;
    return [(r1 * a1 - r2 * a2 - rb * da) / 255, (g1 * a1 - g2 * a2 - gb * da) / 255, (b1 * a1 - b2 * a2 - bb * da) / 255];
  }
  function colorDelta(k, m) {
    const r1 = img1[k]; const g1 = img1[k + 1]; const b1 = img1[k + 2]; const a1 = img1[k + 3];
    const r2 = img2[m]; const g2 = img2[m + 1]; const b2 = img2[m + 2]; const a2 = img2[m + 3];
    let dr = r1 - r2;
    let dg = g1 - g2;
    let db = b1 - b2;
    if (a1 < 255 || a2 < 255) [dr, dg, db] = blend(k, r1, g1, b1, a1, r2, g2, b2, a2);
    const y = dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223;
    const i = dr * 0.59597799 - dg * 0.2741761 - db * 0.32180189;
    const q = dr * 0.21147017 - dg * 0.52261711 + db * 0.31114694;
    const delta = 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q;
    return y > 0 ? -delta : delta;
  }
  function brightnessDelta(img, k, m) {
    const r1 = img[k]; const g1 = img[k + 1]; const b1 = img[k + 2]; const a1 = img[k + 3];
    const r2 = img[m]; const g2 = img[m + 1]; const b2 = img[m + 2]; const a2 = img[m + 3];
    let dr = r1 - r2;
    let dg = g1 - g2;
    let db = b1 - b2;
    if (!dr && !dg && !db && a1 === a2) return 0;
    if (a1 < 255 || a2 < 255) [dr, dg, db] = blend(k, r1, g1, b1, a1, r2, g2, b2, a2);
    return dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223;
  }
  function hasManySiblings(img, x1, y1) {
    const x0 = Math.max(x1 - 1, 0); const y0 = Math.max(y1 - 1, 0);
    const x2 = Math.min(x1 + 1, width - 1); const y2 = Math.min(y1 + 1, height - 1);
    const val = img[y1 * width + x1];
    let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;
    for (let x = x0; x <= x2; x++) for (let y = y0; y <= y2; y++) {
      if (x === x1 && y === y1) continue;
      zeroes += +(val === img[y * width + x]);
      if (zeroes > 2) return true;
    }
    return false;
  }
  function antialiased(img, x1, y1, a, b) {
    const x0 = Math.max(x1 - 1, 0); const y0 = Math.max(y1 - 1, 0);
    const x2 = Math.min(x1 + 1, width - 1); const y2 = Math.min(y1 + 1, height - 1);
    const pos4 = (y1 * width + x1) * 4;
    let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;
    let min = 0; let max = 0; let minX = 0; let minY = 0; let maxX = 0; let maxY = 0;
    for (let x = x0; x <= x2; x++) for (let y = y0; y <= y2; y++) {
      if (x === x1 && y === y1) continue;
      const delta = brightnessDelta(img, pos4, (y * width + x) * 4);
      if (delta === 0) { zeroes++; if (zeroes > 2) return false; }
      else if (delta < min) { min = delta; minX = x; minY = y; }
      else if (delta > max) { max = delta; maxX = x; maxY = y; }
    }
    if (min === 0 || max === 0) return false;
    return (hasManySiblings(a, minX, minY) && hasManySiblings(b, minX, minY)) || (hasManySiblings(a, maxX, maxY) && hasManySiblings(b, maxX, maxY));
  }

  const maxDelta = 35215 * threshold * threshold;
  let diff = 0;
  let masked = 0;
  for (let i = 0, pos = 0; i < len; i++, pos += 4) {
    if (mask && img1[pos] === mask[0] && img1[pos + 1] === mask[1] && img1[pos + 2] === mask[2] && img1[pos + 3] === 255) { masked++; continue; }
    if (a32[i] === b32[i]) continue;
    const delta = colorDelta(pos, pos);
    if (Math.abs(delta) <= maxDelta) continue;
    const x = i % width;
    const y = (i / width) | 0;
    const aa = !includeAA && (antialiased(img1, x, y, a32, b32) || antialiased(img2, x, y, b32, a32));
    if (!aa) diff++;
  }
  return { diff, masked };
}

const ORIGIN = 'http://fidelity.local';

/**
 * Opens a decoding page: images handed to it are served from memory (no network, no file access) and decoded by
 * Chromium with colour-space conversion off.
 * @param {object} browser Playwright Browser
 * @returns {Promise<{diff: Function, exact: Function, close: Function}>} decoder
 */
export async function openDecoder(browser) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  const page = await ctx.newPage();
  const blobs = new Map();
  await page.route(`${ORIGIN}/**`, (route) => {
    const id = new URL(route.request().url()).pathname.slice(1);
    if (!id) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>decoder</title>' });
    const buf = blobs.get(id);
    return buf ? route.fulfill({ contentType: 'application/octet-stream', body: buf }) : route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({ content: `window.__compareRGBA = ${compareRGBA.toString()};` });
  let n = 0;
  const put = (buf) => { const id = `img${n++}`; blobs.set(id, buf); return id; };
  const release = (...ids) => ids.forEach((id) => blobs.delete(id));

  /**
   * YIQ diff per horizontal slice.
   * @param {Buffer} ref reference image bytes (PNG or JPEG)
   * @param {Buffer} cand candidate image bytes
   * @param {{sliceHeight: number, threshold: number, maxRatio: number, mask?: number[]|null}} opts
   * @returns {Promise<object>} {width, height, sizeMismatch?, slices: [{y, h, diff, masked, ratio, ok}], ok}
   */
  const diff = async (ref, cand, opts) => {
    const a = put(ref);
    const b = put(cand);
    try {
      return await page.evaluate(async ({ a, b, opts }) => {
        const load = async (id) => createImageBitmap(await (await fetch(`/${id}`)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { ok: false, sizeMismatch: { ref: [ia.width, ia.height], cand: [ib.width, ib.height] }, slices: [] };
        const w = ia.width;
        const slices = [];
        for (let y = 0; y < ia.height; y += opts.sliceHeight) {
          const h = Math.min(opts.sliceHeight, ia.height - y);
          const read = (img) => { const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, y, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
          const r = window.__compareRGBA(read(ia), read(ib), w, h, { threshold: opts.threshold, mask: opts.mask === undefined ? [255, 0, 255] : opts.mask });
          const counted = w * h - r.masked;
          const ratio = counted ? r.diff / counted : 0;
          slices.push({ y, h, diff: r.diff, masked: r.masked, ratio, ok: ratio <= opts.maxRatio });
        }
        return { ok: slices.every((s) => s.ok), width: w, height: ia.height, slices };
      }, { a, b, opts });
    } finally { release(a, b); }
  };

  /**
   * Exact comparison (any channel difference counts).
   * @param {Buffer} x first image bytes
   * @param {Buffer} y second image bytes
   * @returns {Promise<{identical: boolean, pixels: number, bbox: number[]|null, sizeMismatch?: object}>}
   */
  const exact = async (x, y) => {
    if (x.equals(y)) return { identical: true, pixels: 0, bbox: null };
    const a = put(x);
    const b = put(y);
    try {
      return await page.evaluate(async ({ a, b }) => {
        const load = async (id) => createImageBitmap(await (await fetch(`/${id}`)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { identical: false, pixels: -1, bbox: null, sizeMismatch: { a: [ia.width, ia.height], b: [ib.width, ib.height] } };
        const w = ia.width;
        let n = 0;
        let bb = null;
        for (let y0 = 0; y0 < ia.height; y0 += 2000) {
          const h = Math.min(2000, ia.height - y0);
          const read = (img) => { const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, y0, w, h, 0, 0, w, h); return new Uint32Array(g.getImageData(0, 0, w, h).data.buffer); };
          const pa = read(ia);
          const pb = read(ib);
          for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) {
            n++;
            const px = i % w;
            const py = y0 + ((i / w) | 0);
            bb = bb ? [Math.min(bb[0], px), Math.min(bb[1], py), Math.max(bb[2], px), Math.max(bb[3], py)] : [px, py, px, py];
          }
        }
        return { identical: n === 0, pixels: n, bbox: bb };
      }, { a, b });
    } finally { release(a, b); }
  };

  return { diff, exact, close: () => ctx.close() };
}
