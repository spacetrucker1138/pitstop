/* GRAVEYARD SHIFT v5/v7 — "The Living Cemetery" finite map definition (v7 adds The Tomb of Questionable Decisions, far north-east).
 *
 * Everything here is deterministic: the layout is identical every run so players can learn routes.
 * Units are TILES (32 world px). The map is 100 x 100 tiles (3200 x 3200 world px).
 * The game (game.js -> buildWorld) turns this description into:
 *   - a ground-type grid (rendered as cached 256px chunks with viewport culling),
 *   - a 16px collision grid (walls, fences, buildings, tombstones),
 *   - a sorted prop list (tall props are depth-sorted with characters),
 *   - region rectangles for the HUD/minimap, boss arenas and exploration rewards.
 *
 * Ground types: 0 grass, 1 dirt, 2 stone, 3 forgotten grass, 4 worn grass, 5 courtyard stone, 6 plaza stone.
 * Seeded "scatter" blocks are deterministic (fixed seeds) and reject any prop that would overlap a path,
 * another prop's footprint, or a reserved open area.
 */
window.GRAVEYARD_MAP = {
  version: 7,
  tile: 32,
  width: 100,
  height: 100,
  start: [66, 89],
  regions: [
    { id: "tomb", name: "THE KING'S TOMB", rect: [2, 2, 33, 28], color: "#6d4f8f" },
    { id: "maintenance", name: "NORTHERN MAINTENANCE GROUNDS", rect: [33, 2, 66, 24], color: "#8b6a43" },
    { id: "west", name: "WESTERN GRAVE PLOTS", rect: [2, 28, 34, 73], color: "#56704a" },
    { id: "east", name: "EASTERN MAUSOLEUM DISTRICT", rect: [66, 2, 98, 76], color: "#7d8796" },
    { id: "entrance", name: "MAIN ENTRANCE", rect: [52, 74, 98, 98], color: "#b49a62" },
    { id: "forgotten", name: "SOUTHERN FORGOTTEN GROUNDS", rect: [2, 73, 52, 98], color: "#5b4d66" },
    { id: "central", name: "CENTRAL CEMETERY GROUNDS", rect: [33, 24, 66, 74], color: "#4f7a74" },
  ],
  // v7: named landmarks (banner when Hog walks up, label on the full map). Not a region: the 7 regions are unchanged.
  places: [
    { id: "qdtomb", name: "THE TOMB OF QUESTIONABLE DECISIONS", short: "TOMB OF QUESTIONABLE DECISIONS", rect: [83, 2, 98, 15], label: [90, 13.8] },
  ],
  // Boss arenas, in tiles (centre). Bosses appear here and hunt the player if he is elsewhere.
  arenas: {
    digger: { at: [50, 17], region: "maintenance", label: "MAINTENANCE YARD" },
    widow: { at: [82, 50], region: "east", label: "MAUSOLEUM PLAZA" },
    king: { at: [18, 20], region: "tomb", label: "KING'S COURTYARD" },
  },
  // Exploration rewards (once per run). Contents are randomised at run start.
  rewards: [
    { id: "workshed-crate", at: [56, 15], kind: "supply", label: "SUPPLY CRATE" },
    { id: "mausoleum-cache", at: [92, 19], kind: "cache", label: "HIDDEN WAGE CACHE" },
    { id: "grave-plot-heal", candidates: [[11, 45], [27, 63], [6, 69]], kind: "heal", label: "OLD GRAVE OFFERING" },
    { id: "monument-blessing", at: [50, 56], kind: "blessing", label: "BLESSED FOUNTAIN" },
  ],
  // Ground painting, applied in order.
  areas: [
    { type: 3, rect: [2, 73, 52, 98] },
    { type: 4, rect: [39, 5, 61, 20] },
    { type: 5, rect: [7, 13, 30, 27] },
    { type: 6, circle: [50, 50, 10] },
    { type: 6, rect: [76, 44, 89, 57] },
    { type: 2, rect: [60, 84, 73, 97] },
    { type: 4, rect: [10, 42, 17, 49] },
  ],
  worn: [
    { rect: [2, 28, 34, 73], threshold: 0.62 },
    { rect: [33, 24, 66, 74], threshold: 0.7 },
    { rect: [2, 73, 52, 98], threshold: 0.55 },
    { rect: [66, 2, 98, 76], threshold: 0.78 },
  ],
  paths: [
    { type: 2, width: 4, points: [[66, 96], [66, 78], [60, 66], [53, 59]] },
    { type: 1, width: 3, points: [[50, 40], [50, 28], [50, 20]] },
    { type: 1, width: 3, points: [[40, 50], [30, 50], [18, 50], [6, 50]] },
    { type: 1, width: 3, points: [[18, 50], [18, 38], [18, 27]] },
    { type: 1, width: 3, points: [[18, 50], [15, 62], [20, 74], [26, 84]] },
    { type: 2, width: 4, points: [[60, 50], [82, 50], [96, 50]] },
    { type: 2, width: 3, points: [[82, 6], [82, 74]] },
    { type: 1, width: 3, points: [[46, 59], [38, 70], [30, 80]] },
    { type: 1, width: 3, points: [[30, 80], [14, 89]] },
    { type: 1, width: 3, points: [[30, 80], [46, 88], [62, 88]] },
    { type: 1, width: 3, points: [[29, 18], [40, 13]] },
    { type: 1, width: 3, points: [[60, 12], [82, 12]] },
    { type: 2, width: 3, points: [[82, 12.5], [90, 12.5]] }, // v7: stone walk up to the Tomb of Questionable Decisions' steps
    { type: 1, width: 3, points: [[67, 84], [82, 84], [82, 74]] },
    { type: 1, width: 2, points: [[5, 39], [33, 39]] },
    { type: 1, width: 2, points: [[5, 61], [33, 61]] },
    { type: 1, width: 2, points: [[70, 30], [94, 30]] },
    { type: 1, width: 2, points: [[70, 64], [94, 64]] },
    { type: 1, width: 2, points: [[40, 30], [60, 30]] },
  ],
  // Areas kept clear of scatter so there is always room to fight.
  reserved: [
    [10, 42, 17, 49], [44, 26, 56, 31], [40, 62, 47, 68], [86, 76, 95, 81], [84, 10.5, 96, 15], [22, 86, 34, 94], [76, 26, 88, 34], [56, 84, 61, 92],
  ],
  // Hand-placed landmarks and props: [kind, tileX, tileY]  (x,y = bottom-centre of the sprite).
  landmarks: [
    ["tomb", 18, 13.2],
    ["gate", 66, 98.6],
    ["shed", 50, 11.2],
    ["fountain", 50, 55.6],
    ["mausoleum", 70, 46.5], ["mausoleum", 94, 46.5], ["mausoleum", 70, 61], ["mausoleum", 94, 61],
    ["mausoleum", 75, 24], ["mausoleum", 89, 24], ["mausoleum", 75, 37], ["mausoleum", 89, 37],
    ["mausoleum", 89, 72.5],
    // v7: The Tomb of Questionable Decisions (user-supplied art; somebody lost a bet). Far north-east corner.
    ["qdtomb", 90, 10.5],
  ],
  props: [
    // King's Tomb courtyard
    ["statue", 11.5, 17], ["statue", 24.5, 17], ["lamp", 13, 23], ["lamp", 23, 23], ["pillar", 9, 21], ["pillar", 27, 21],
    ["obelisk", 9, 25.5], ["obelisk", 27, 25.5], ["ghost_candles", 15, 15.5], ["ghost_candles", 21, 15.5],
    // Maintenance grounds
    ["wheelbarrow", 44, 13], ["crates", 56.5, 8.5], ["crates", 58.5, 9.5], ["coffin_stack", 43.5, 8.5], ["tool_rack", 54.5, 14.5],
    ["lawnmower", 45.5, 17.5], ["dirt_pile", 57.5, 18], ["signpost", 53, 21.6], ["lantern_broken", 47.5, 15.5], ["coffin_stack", 41.5, 15],
    // Main entrance
    ["signpost", 62.5, 92.5], ["lantern_broken", 61.5, 95], ["lantern_broken", 70.5, 95], ["lamp", 63, 86], ["lamp", 69, 86], ["lamp", 63, 79], ["lamp", 69, 79],
    // Central grounds
    ["lamp", 42.5, 43], ["lamp", 57.5, 43], ["lamp", 42.5, 58], ["lamp", 57.5, 58],
    // Eastern mausoleum district
    ["pillar", 77, 44.5], ["pillar", 88, 44.5], ["pillar", 77, 57.5], ["pillar", 88, 57.5], ["statue", 80, 41], ["statue", 85, 41],
    ["lamp", 80, 18], ["lamp", 84, 18], ["lamp", 80, 66], ["lamp", 84, 66], ["lamp", 66, 47.5], ["statue", 82, 8.6],
    // Southern forgotten grounds landmarks
    ["ghost_candles", 28, 90], ["ghost_candles", 33, 91], ["coffin_open", 30, 93], ["tree", 24, 82], ["tree", 40, 92], ["tree", 8, 80],
  ],
  // Lines of props: [kind, x0, y0, x1, y1, stepTiles, gapFrom, gapTo] (gap measured along the line in tiles from the start).
  lines: [
    // Iron fence round the King's courtyard, openings for the west-plot path (x 15-21) and the maintenance path (y 14-20)
    ["fence", 3, 28, 33, 28, 2, 12, 18],
    ["fence_v", 32, 4, 32, 28, 2, 10, 16],
    // Wooden work-yard fence around the workshed, openings south (x 47-53) and east (y 10-14)
    ["fence_broken", 39, 5.5, 61, 5.5, 2, -1, -1],
    ["fence_broken_v", 38.5, 6, 38.5, 21, 2, 6, 10],
    ["fence_broken_v", 61.5, 6, 61.5, 21, 2, 4, 9],
    ["fence_broken", 39, 21.5, 61, 21.5, 2, 7, 15],
    // Wrought-iron rails along the eastern avenue
    ["fence", 67, 42.2, 78, 42.2, 2, -1, -1], ["fence", 87, 42.2, 97, 42.2, 2, -1, -1],
    ["fence", 67, 66.2, 78, 66.2, 2, -1, -1], ["fence", 87, 66.2, 97, 66.2, 2, -1, -1],
    // Collapsed fences in the forgotten grounds
    ["fence_broken", 6, 76, 20, 76, 2, 4, 9], ["fence_broken", 36, 78, 48, 78, 2, 3, 8], ["fence_broken", 8, 95, 22, 95, 2, 5, 10],
  ],
  // Rows of graves, deterministic jitter/gaps: [x0, x1, y, seed, gapChance]
  graveRows: [
    [4, 33, 32, 11, 0.22], [4, 33, 35, 12, 0.25], [4, 33, 43, 13, 0.3], [4, 33, 46, 14, 0.3],
    [4, 33, 55, 15, 0.22], [4, 33, 58, 16, 0.25], [4, 33, 66, 17, 0.25], [4, 33, 69, 18, 0.3],
    [38, 47, 34, 21, 0.2], [53, 63, 34, 22, 0.2], [38, 47, 37, 23, 0.25], [53, 63, 37, 24, 0.25],
    [37, 47, 65, 25, 0.25], [54, 64, 65, 26, 0.25], [54, 64, 69, 27, 0.3],
    [54, 61, 81, 31, 0.2], [72, 80, 80, 32, 0.2], [74, 96, 88, 33, 0.3], [74, 96, 92, 34, 0.3],
  ],
  // Random-but-seeded scatter inside rectangles: [rect, seed, count, kinds]
  scatter: [
    [[3, 29, 33, 72], 101, 26, ["tree", "statue", "headstone_vines", "celtic_cross", "family_crypt", "crypt", "bush"]],
    [[3, 74, 51, 97], 102, 54, ["open_grave", "coffin_open", "coffin", "headstone_vines", "grave_broken", "tree", "bush", "fence_broken", "ghost_candles", "blot", "blot", "dirt_pile"]],
    [[34, 25, 65, 73], 103, 14, ["tree", "bush", "flowers", "celtic_cross", "obelisk"]],
    [[67, 3, 97, 75], 104, 18, ["statue", "pillar", "obelisk", "flowers", "celtic_cross"]],
    [[34, 3, 65, 23], 105, 8, ["tree", "bush", "dirt_pile"]],
    [[3, 3, 32, 27], 106, 10, ["tree", "obelisk", "ghost_candles", "blot"]],
    [[74, 76, 97, 97], 107, 8, ["tree", "bush", "flowers"]],
  ],
};
