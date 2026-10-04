/* MAP-B geometry, shared by tools/map-compile.mjs and tools/map-lint.mjs (and, from B2, mirrored by the
   game's painter, so the drawn shore and the collision tiles come from the same curve).

   Every function here is deterministic: no randomness, no clock, and only +, -, *, / and comparisons on
   the values that decide a tile, so the same input gives the same tiles on any machine. The coast spline
   is the approved r2.1 study's (tools/out/blockout/r2/geom.py, ignored) ported operation for operation, so
   it fills exactly the same tiles.

   Coordinates are tile space: tile (tx, ty) is the square [tx, tx + 1) x [ty, ty + 1) and its centre is
   (tx + 0.5, ty + 0.5). A tile is inside a shape when its centre is. */

/* a closed Hermite spline through control points [x, y, s]: s is the tangent scale, 0 at a corner (so a
   cape or point stays sharp) and 1 on a smooth point. n samples per segment, starting at each control
   point. n must be a power of two, so t = j / n and its square and cube are exact */
export function hermiteLoop(pts, n) {
  const k = pts.length, out = [];
  for (let i = 0; i < k; i++) {
    const a = pts[i], b = pts[(i + 1) % k], pa = pts[(i - 1 + k) % k], nb = pts[(i + 2) % k];
    const sa = a[2], sb = b[2];
    const tax = sa * (b[0] - pa[0]) / 2, tay = sa * (b[1] - pa[1]) / 2;
    const tbx = sb * (nb[0] - a[0]) / 2, tby = sb * (nb[1] - a[1]) / 2;
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([h00 * a[0] + h10 * tax + h01 * b[0] + h11 * tbx, h00 * a[1] + h10 * tay + h01 * b[1] + h11 * tby]);
    }
  }
  return out;
}

/* even-odd: is (x, y) inside the closed polygon */
export function inside(poly, x, y) {
  let c = false;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if ((p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])) c = !c;
  }
  return c;
}

/* the tiles whose centre is inside the polygon, as a w x h Uint8Array (1 inside), index y * w + x */
export function raster(poly, w, h) {
  const g = new Uint8Array(w * h);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.max(0, Math.trunc(minY)); y < Math.min(h, Math.trunc(maxY) + 1); y++)
    for (let x = Math.max(0, Math.trunc(minX)); x < Math.min(w, Math.trunc(maxX) + 1); x++)
      if (inside(poly, x + 0.5, y + 0.5)) g[y * w + x] = 1;
  return g;
}

/* steps (8 neighbours, so diagonal counts as 1) from every tile where src is set; 65535 if none */
export function stepsFrom(src, w, h) {
  const D = new Uint16Array(w * h).fill(65535), q = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let i = 0; i < w * h; i++) if (src[i]) { D[i] = 0; q[tail++] = i; }
  while (head < tail) {
    const i = q[head++], x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && D[ny * w + nx] > D[i] + 1) { D[ny * w + nx] = D[i] + 1; q[tail++] = ny * w + nx; }
    }
  }
  return D;
}

/* where a closed polyline crosses or touches itself: pairs of segments [i, j] that aren't neighbours */
export function selfIntersections(poly) {
  const n = poly.length, hits = [];
  const orient = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return v > 0 ? 1 : v < 0 ? -1 : 0; };
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
  const box = poly.map((p, i) => { const q = poly[(i + 1) % n]; return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; });
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;                        // the closing segment meets the first one
    const A = box[i], B = box[j];
    if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) continue;
    const p1 = poly[i], p2 = poly[(i + 1) % n], q1 = poly[j], q2 = poly[(j + 1) % n];
    const o1 = orient(p1, p2, q1), o2 = orient(p1, p2, q2), o3 = orient(q1, q2, p1), o4 = orient(q1, q2, p2);
    if ((o1 !== o2 && o3 !== o4) || (!o1 && onSeg(p1, p2, q1)) || (!o2 && onSeg(p1, p2, q2)) || (!o3 && onSeg(q1, q2, p1)) || (!o4 && onSeg(q1, q2, p2))) hits.push([i, j]);
  }
  return hits;
}

/* 4-neighbour flood from the start tiles through tiles where ok(i) holds; returns a Uint8Array of reached */
export function flood(starts, ok, w, h) {
  const seen = new Uint8Array(w * h), q = [];
  for (const i of starts) if (ok(i) && !seen[i]) { seen[i] = 1; q.push(i); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % w, y = (i - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const j = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[j] && ok(j)) { seen[j] = 1; q.push(j); }
    }
  }
  return seen;
}
