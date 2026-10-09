/* MAP-B: the authored content of the home island ("Harbour Crescent"): buildings, landmarks, stations, walls, fences,
   gates and props, placed on the locked terrain in tools/maps/home.src.mjs. Edit it, then run
   `node tools/map-content.mjs` (it writes tools/maps/staged/home.content.js).

   STAGED. Only the local content preview reads the compiled file (tools/mapb-preview.mjs --content, loopback only).
   The schema, the rules and the reasons for a separate content layer are in tools/maps/content.mjs.

   B3b (the architecture) adds the format and no content: the records list is empty on purpose. B3c onward adds
   records, one approved batch at a time; the proposed coordinates are in the B3a plan
   (tools/out/mapb/b3a/B3a-plan.md, local). */

export default {
  schema: "mapb-content-1",
  id: "home",
  records: []
};
