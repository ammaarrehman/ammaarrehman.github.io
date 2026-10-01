/* mapdigest: one description of how the island's map behaves, the same whether it is read through
   map-baseline.mjs's hook into older code ("old") or through today's ?debug=1 API ("new"), so the
   two can be compared exactly (D11-B parity). mapDigest runs in the page; finish runs in Node. */
import { createHash } from "node:crypto";

export function mapDigest(which) {
  const I = window.__island, A = which === "old" ? window.__mapapi : {
    at: (x, y) => I.tile(x, y).type, walk: (x, y) => I.tile(x, y).walkable, lvl: (x, y) => I.tile(x, y).height,
    blocked: (px, py) => I.blocked(px, py), kind: (px, py) => I.kind(px, py), props: () => I.props(), png: () => I.ground().png
  };
  const MW = 100, MH = 80, T = 16, KINDS = { "": 0, grass: 1, dirt: 2, sand: 3, water: 4 };
  let ground = "", walk = "", height = "", pxBlocked = 0, pxHash = 2166136261, kindHash = 2166136261;
  const perTile = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { ground += A.at(x, y).toString(16); walk += A.walk(x, y) ? 1 : 0; height += A.lvl(x, y); }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    let n = 0;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const px = tx * T + i, py = ty * T + j, b = A.blocked(px + 0.5, py + 0.5) ? 1 : 0;
      n += b; pxHash = Math.imul(pxHash ^ b, 16777619) >>> 0;
      kindHash = Math.imul(kindHash ^ KINDS[A.kind(px, py)], 16777619) >>> 0;
    }
    pxBlocked += n; perTile.push(n);
  }
  return { w: MW, h: MH, ground, walk, height, pxBlocked, pxHash, kindHash, perTile: perTile.join(","), props: JSON.stringify(A.props()), png: A.png() };
}
const sha = (s) => createHash("sha256").update(s).digest("hex");
export function finish(d) { return { ...d, perTile: sha(d.perTile), props: sha(d.props), png: sha(d.png) }; }
