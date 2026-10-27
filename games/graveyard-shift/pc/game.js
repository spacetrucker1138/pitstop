/* GRAVEYARD SHIFT v10 "Aisles of Doom" (Stage 2: Mega Mart, outro slideshows, gothic HUD) on v7 "New Faces" (on v6 "Gameplay Polish" (built on v5 "The Living Cemetery") — local, dependency-free Canvas game.
 * Map layout lives in map-data.js. Rendering: the world is drawn 1:1 into a small pixel buffer
 * (VIEW_W x VIEW_H) with an integer-snapped camera, then scaled by an integer ZOOM with
 * nearest-neighbour sampling. The HUD is drawn afterwards at full canvas resolution. */
(() => {
  "use strict";
  const canvas = document.getElementById("game"),
    ctx = canvas.getContext("2d"),
    panel = document.getElementById("panel");
  const W = canvas.width,
    H = canvas.height,
    TAU = Math.PI * 2,
    URLQ = new URLSearchParams(location.search),
    WORLD_ZOOM = Math.max(1, Math.min(5, Number(URLQ.get("zoom")) || 3)),
    BASE_VIEW_W = Math.round(W / WORLD_ZOOM),
    BASE_VIEW_H = Math.round(H / WORLD_ZOOM),
    // Mouse-wheel zoom-out steps (visible-world width as a multiple of the default view). 100% is the max zoom-in.
    ZOOM_STEPS = [1, 1.2, 1.35, 1.5, 1.65, 1.8, 2],
    SHIFT_SECONDS = 720,
    REAL_SECONDS_PER_HOUR = 120;
  const rand = (a, b) => a + Math.random() * (b - a),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    pick = (a) => a[Math.floor(Math.random() * a.length)];
  const GAME_VERSION = "v0.9.2 (Early Access)"; // shown on the title screen and the pause menu
  const saveKey = "graveyard-shift-save-v1";
  const freshSave = () => ({
    wages: 0,
    perks: { health: 0, damage: 0, speed: 0, xp: 0, magnet: 0, reroll: 0, banish: 0, cheese: 0, limit: 0 },
    bestKills: 0,
    bestLevel: 1,
    shifts: 0,
    music: 0.45,
    sfx: 0.65,
    stage2Unlocked: false, // v10: set the first time Grave Hog reaches the Mega Mart (Stage 2 can then be started from the title)
    megaMartClears: 0,
    dex: { w: {}, e: {}, b: {} }, // compendium: weapons owned, monster kills, boss kills (0 = met, not beaten yet)
  });
  let save = freshSave();
  try {
    const raw = localStorage.getItem(saveKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object")
        save = { ...freshSave(), ...parsed, perks: { ...freshSave().perks, ...(parsed.perks || {}) } };
    }
  } catch (e) {
    console.warn("Save data was unreadable; starting with a clean timecard.", e);
  }
  function saveGame() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(save));
      document.getElementById("save-status").textContent = "TIME CARD SAVED";
    } catch (e) {
      document.getElementById("save-status").textContent = "SAVE UNAVAILABLE";
      console.warn("Local save failed", e);
    }
  }
  // Current visible world size in buffer pixels (changes with the mouse-wheel zoom; default = BASE_VIEW_*).
  let VIEW_W = BASE_VIEW_W,
    VIEW_H = BASE_VIEW_H,
    zoomIndex = Math.max(0, Math.min(ZOOM_STEPS.length - 1, save.zoomIndex | 0)),
    zoomCur = 1;
  let mode = "title",
    keys = new Set(),
    mouse = { x: W / 2, y: H / 2 },
    last = performance.now(),
    state = null,
    worldSeed = 1,
    shake = 0,
    toast = "",
    toastUntil = 0,
    audio = null,
    pendingLevelUps = 0,
    debugMode = URLQ.has("debug"),
    showBigMap = false,
    assetsReady = false,
    fps = 60,
    cleanRender = false,
    touchVec = { x: 0, y: 0, m: 0 },
    photoFreeze = false, // P: freeze the action with no menu over it (for screenshots); P again resumes // mobile: virtual joystick direction (set by mobile.js)
    photoCam = null; // QA/screenshot only: frame a landmark instead of following Hog // QA only: hides Hog + vignette for pixel-shift (shimmer) comparisons
  // v16: the user's music pack. One looping track per screen (title / Stage 1 / Stage 2), crossfaded over
  // MUSIC_FADE seconds by musicTick(); the Music slider scales everything and 0 means silent (tracks paused).
  const MUSIC_FILES = { title: "assets/music/Title.ogg", stage1: "assets/music/stage1.ogg", stage2: "assets/music/stage2.ogg" };
  const MUSIC_FADE = 1.2;
  const musicEls = {},
    musicStats = { starts: {}, switches: 0, errors: {} };
  for (const [n, src] of Object.entries(MUSIC_FILES)) {
    const a = new Audio(src);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    a.addEventListener("error", () => (musicStats.errors[n] = true));
    musicEls[n] = a;
  }
  let musicWant = "title",
    musicDuck = 1,
    musicOn = false;
  function musicTarget(n) {
    return musicOn && n === musicWant && save.music > 0 ? Math.min(1, save.music * musicDuck) : 0;
  }
  function musicStart(n) {
    const a = musicEls[n];
    if (!a || !a.paused || a._pending || performance.now() < (a._retryAt || 0)) return;
    if (a.volume === 0)
      try {
        a.currentTime = 0;
      } catch {}
    a._pending = true;
    a.play()
      .then(() => ((a._pending = false), (musicStats.starts[n] = (musicStats.starts[n] || 0) + 1)))
      .catch(() => ((a._pending = false), (a._retryAt = performance.now() + 1000))); // autoplay blocked: retry after a gesture
  }
  function playMusic(n) {
    if (!MUSIC_FILES[n]) return;
    if (n !== musicWant) musicStats.switches++;
    musicWant = n;
    musicDuck = 1;
    musicOn = true;
    if (save.music > 0) musicStart(n);
  }
  function musicTick(dt) {
    const step = clamp(dt || 0, 0, 1) / MUSIC_FADE; // rAF can hand a negative dt on the first frame
    for (const [n, a] of Object.entries(musicEls)) {
      const t = musicTarget(n);
      if (t > 0 && a.paused) musicStart(n);
      let v = a.volume;
      v = t > v ? Math.min(t, v + step) : Math.max(t, v - step);
      if (save.music <= 0) v = 0;
      a.volume = v = clamp(v, 0, 1);
      if (v === 0 && t === 0 && !a.paused) a.pause();
    }
  }
  // Older code talks to "musicTrack" (duck to 60% for slides, pause for the victory sting...): keep that interface.
  const musicTrack = {
    set volume(v) {
      musicDuck = save.music > 0 ? clamp(v / save.music, 0, 1) : 1;
    },
    get volume() {
      return musicTarget(musicWant);
    },
    pause() {
      musicOn = false;
    },
    play() {
      playMusic(musicWant);
      return Promise.resolve();
    },
    get paused() {
      return !musicOn;
    },
  };
  const victoryTrack = new Audio("assets/victory-sting.wav");
  victoryTrack.volume = save.music;
  // ---- Asset loading: nothing is drawn from an image until it has fully decoded (no half-loaded flashes).
  const IMAGES = {};
  const IMAGE_FILES = {
    hog: "assets/grave-hog-v7.png", // v7: the user's own Grave Hog sheet (12 rows x 4 frames, 64px)
    fx6: "assets/fx-v6.png",
    enemy: "assets/enemy-v5.png",
    digger: "assets/grave-digger-v7.png", // v7: the user's cleaned Grave Digger (4x4 frames, 160px)
    bosses: "assets/bosses-v7.png", // v7: Widow + King at the Digger's size (4x2 frames, 160px)
    qdtomb: "assets/landmark-qd-tomb.png", // v7: The Tomb of Questionable Decisions
    icons: "assets/weapon-icons-ai.png",
    ai: "assets/cemetery-ai.png",
    p5: "assets/props-v5.png",
    fx: "assets/weapons-ai.png",
    ground: "assets/ground-v5.png",
    tomb: "assets/landmark-tomb.png",
    gate: "assets/landmark-gate.png",
    shed: "assets/landmark-shed.png",
    mausoleum: "assets/landmark-mausoleum.png",
    fountain: "assets/landmark-fountain.png",
    // v10: Stage 2 (the user's Mega Mart sheets: 64px frames, forklift 96px; 3 rows = move / attack / death, facing right)
    mm_shopper_zombie: "assets/megamart/shopper_zombie.png",
    mm_cashier_corpse: "assets/megamart/cashier_corpse.png",
    mm_stock_clerk: "assets/megamart/stock_clerk.png",
    mm_cleaning_bot: "assets/megamart/cleaning_bot.png",
    mm_mutated_produce: "assets/megamart/mutated_produce.png",
    mm_rat_swarm: "assets/megamart/rat_swarm.png",
    mm_security_drone: "assets/megamart/security_drone.png",
    mm_forklift_zombie: "assets/megamart/forklift_zombie.png",
    mmBoss: "assets/megamart/bosses-megamart.png", // Produce Horror, Cart Beast, Meat Manager: 160px cells, 3 rows each
    // v10: gothic HUD kit (generated from the user's HUD mockup)
    hud_portrait: "assets/hud/portrait.png",
    hud_bars: "assets/hud/bars.png",
    hud_minimap: "assets/hud/minimap.png",
    hud_slot: "assets/hud/slot.png",
    hud_slot_on: "assets/hud/slot_on.png",
    hud_coins: "assets/hud/coins.png",
    hud_banner: "assets/hud/banner.png",
    // v14
    wpn2: "assets/weapons-v14.png", // 19 new weapon sprites, 64px cells in NW_IDS order
    splat_green: "assets/fx/splat-green.png", // the user slime splatter sheet (6x5, 64px), plus red / black tints
    splat_red: "assets/fx/splat-red.png",
    splat_black: "assets/fx/splat-black.png",
    title: "assets/title.webp", // the user title art
    // v15
    standees: "assets/props/jurn-standees.png", // the user's JURN band standees (Electronics decoration, no collision)
    coffinDrop: "assets/fx/coffin-drop.png", // 84px coffin; v16: re-baked at 2x2-pixel blocks so the pixels show
    // v16 (the user's sheets, white removed, 4 frames each)
    dig: "assets/fx/chest-dig.webp", // loot machine: Grave Hog digging through the chest, 22 frames of 220x170
    hat: "assets/fx/sprinkler-hat.png", // Graveyard Sprinkler hat worn by Hog: 2 frames of 31x30 (spinning pipe head)
    hatIcon: "assets/fx/sprinkler-hat-icon.png", // hat frame 1 as the weapon icon (64x64)
    chest: "assets/fx/chest.png", // treasure chest, 4 frames of 44x49 (green ghost-glow loop)
    hud_clockmap: "assets/hud/clockmap.png", // clock + minimap device (176x272); window at CLOCKMAP_WIN
    hud_clockmap_broken: "assets/hud/clockmap_broken.png", // same device after the 6 AM clock explosion
    fire: "assets/fx/molotov-fire.png", // Molotov fire, 4 x 112x72
    flies: "assets/fx/witch-flies.png", // Witch's Jar fly swarm, 4 x 96x80
    trashQueen: "assets/props/trash-queen.png", // Trash Queen cameo: idle + 3 run frames, 4 x 84x80 (faces right)
  };
  // v10: Stage 2 floor = 16 x 1024px chunks of the remade Mega Mart map, loaded in the background after the main art.
  const megaFloor = [];
  let megaFloorPromise = null,
    megaFloorReady = false;
  function loadMegaMartFloor() {
    if (megaFloorPromise) return megaFloorPromise;
    const M = window.MEGAMART_MAP;
    megaFloorPromise = Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = im.onerror = () => res(im);
          im.src = M.chunks.replace("{x}", i % 4).replace("{y}", Math.floor(i / 4));
          megaFloor[i] = im;
        }),
      ),
    ).then(() => {
      megaFloorReady = true;
      if (STAGE === 2) buildMinimap();
    });
    return megaFloorPromise;
  }
  const PANEL_SETS = {
    1: ["assets/panels/endstage1-1.webp", "assets/panels/endstage1-2.webp"],
    2: ["assets/panels/endstage2-1.webp", "assets/panels/endstage2-2.webp", "assets/panels/endstage2-3.webp"],
  };
  let imagesPending = Object.keys(IMAGE_FILES).length;
  for (const [k, src] of Object.entries(IMAGE_FILES)) {
    const im = new Image();
    im.onload = im.onerror = () => {
      if (--imagesPending === 0) onAssetsReady();
    };
    im.src = src;
    IMAGES[k] = im;
  }
  const ready = (im) => im && im.complete && im.naturalWidth > 0;
  const hogSheet = IMAGES.hog,
    enemySheet = IMAGES.enemy,
    weaponIcons = IMAGES.icons,
    cemeteryProps = IMAGES.ai,
    weaponFx = IMAGES.fx,
    groundTexture = IMAGES.ground,
    diggerSheet = IMAGES.digger,
    bossSheet = IMAGES.bosses;
  // v7 boss frames: 160px cells, feet baseline at y=154 -> drawn so the baseline sits 25px below the body centre.
  const BOSS_CELL = 160,
    BOSS_BASE = 154,
    BOSS_DY = -(BOSS_BASE - 25);
  const TYPES = {
    zombie: { name: "Shambler", hp: 34, speed: 34, xp: 3, color: "#92a36a", r: 13, damage: 8 },
    skeleton: { name: "Bonehead", hp: 23, speed: 57, xp: 3, color: "#ddd1aa", r: 11, damage: 7 },
    hand: { name: "Crawling Hand", hp: 17, speed: 86, xp: 2, color: "#c87665", r: 9, damage: 6 },
    ghost: { name: "Ghost", hp: 27, speed: 43, xp: 4, color: "#8dc9d1", r: 13, damage: 8, phase: true },
    worm: { name: "Grave Worm", hp: 20, speed: 66, xp: 3, color: "#b78b62", r: 10, damage: 7 },
    keeper: { name: "Possessed Keeper", hp: 60, speed: 28, xp: 7, color: "#a08358", r: 16, damage: 12 },
  };
  // v10 Stage 2 regulars (behaviour from the sprite pack's notes). anchor = feet point inside the frame.
  const TYPES2 = {
    shopper_zombie: { name: "Shopper Zombie", hp: 36, speed: 36, xp: 3, color: "#8ea06a", r: 13, damage: 8 },
    cashier_corpse: { name: "Cashier Corpse", hp: 26, speed: 40, xp: 4, color: "#c9505a", r: 12, damage: 6, ranged: "scanner" },
    stock_clerk: { name: "Stock Clerk", hp: 54, speed: 30, xp: 5, color: "#6d7fa8", r: 14, damage: 9, ranged: "box" },
    cleaning_bot: { name: "Cleaning Bot", hp: 40, speed: 46, xp: 4, color: "#cfd6d0", r: 14, damage: 6 },
    mutated_produce: { name: "Mutated Produce", hp: 22, speed: 52, xp: 3, color: "#e08a2a", r: 12, damage: 5 },
    rat_swarm: { name: "Rat Swarm", hp: 18, speed: 90, xp: 2, color: "#7a5a5a", r: 10, damage: 6 },
    security_drone: { name: "Security Drone", hp: 24, speed: 52, xp: 4, color: "#b8c0c8", r: 11, damage: 6, fly: true },
    forklift_zombie: { name: "Forklift Zombie", hp: 115, speed: 32, xp: 9, color: "#d08a2a", r: 20, damage: 12, size: 96 },
  };
  for (const d of Object.values(TYPES2)) ((d.s2 = true), (d.size = d.size || 64), (d.anchor = d.size === 96 ? [48, 92] : [32, 61]));
  const BOSS_HP_MULT = 3 * 1.05; // v6: every boss has 3x its v5 health; v17: +5%. Applied once, here, never per spawn.
  const BOSS = {
    digger: { name: "THE GRAVE DIGGER", hp: 680 * BOSS_HP_MULT, color: "#b68452", r: 31, taunt: "That shovel ain’t OSHA approved!" },
    widow: { name: "THE WIDOW", hp: 850 * BOSS_HP_MULT, color: "#a084bd", r: 31, taunt: "Lady, I am on my break!" },
    king: { name: "THE CEMETERY KING", hp: 1250 * BOSS_HP_MULT, color: "#d4cda7", r: 33, taunt: "Six o’clock. I’m OUT." },
    // v10 Stage 2 (order from the pack's README: 1 Produce Horror, 2 Cart Beast, 3 Meat Manager = final boss)
    produce_horror: { name: "THE PRODUCE HORROR", hp: 900 * BOSS_HP_MULT, color: "#8fbf4a", r: 33, taunt: "Fresh today. Rotten forever.", s2: true, idx: 0, speed: 40, damage: 15 },
    cart_beast: { name: "THE CART BEAST", hp: 1050 * BOSS_HP_MULT, color: "#c45a3a", r: 36, scale: 1.1, taunt: "3 FOR 1. YOU'RE THE 1.", s2: true, idx: 1, speed: 52, damage: 16 },
    meat_manager: { name: "THE MEAT MANAGER", hp: 1400 * BOSS_HP_MULT, color: "#e0d0c8", r: 34, taunt: "Clean up on aisle YOU.", s2: true, idx: 2, speed: 46, damage: 20 },
  };
  const BOSS_TIMES = {
    1: [["digger", 2], ["widow", 4], ["king", 6]],
    2: [["produce_horror", 2], ["cart_beast", 4], ["meat_manager", 6]],
  };
  const finalBossId = () => (STAGE === 2 ? "meat_manager" : "king");
  const typesFor = () => (STAGE === 2 ? TYPES2 : TYPES);
  const UPGRADES = [
    { id: "damage", title: "Knuckle Sandwich", desc: "+18% all weapon damage", apply: (s) => (s.player.damage *= 1.18) },
    { id: "speed", title: "Clock Out Legs", desc: "+12% movement speed", apply: (s) => (s.player.speed *= 1.12) },
    {
      id: "maxhp",
      title: "Union Benefits",
      desc: "+25 max health and heal 25",
      apply: (s) => {
        s.player.maxHp += 25;
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25);
      },
    },
    { id: "regen", title: "Found a Bandaid", desc: "Regenerate 0.35 health / sec", apply: (s) => (s.player.regen += 0.35) },
    { id: "magnet", title: "Long Grabber", desc: "+30% pickup radius", apply: (s) => (s.player.magnet *= 1.3) },
    {
      id: "nail",
      title: "Nail Gun",
      desc: "One more nail per shot each level (each nail a bit weaker) and a quicker reload",
      apply: (s) => {
        s.weapons.nail.level++;
        s.weapons.nail.speed += 35;
      },
    },
    {
      id: "sprinkler",
      title: "Holy Water Sprinkler",
      desc: "Sprays a wider, longer holy-water cone at nearby monsters",
      apply: (s) => {
        s.weapons.sprinkler.level++;
        s.weapons.sprinkler.range += 14;
        s.weapons.sprinkler.width += 0.055;
        s.weapons.sprinkler.duration += 0.035;
      },
    },
    {
      id: "chainsaw",
      title: "Chainsaw",
      desc: "Sustained close-range damage; upgrades add reach and bite",
      apply: (s) => {
        s.weapons.chainsaw.level++;
        s.weapons.chainsaw.damage *= 1.22;
        s.weapons.chainsaw.range += 8;
        s.weapons.chainsaw.duration += 0.025;
      },
    },
    {
      id: "lantern",
      title: "Haunted Lantern",
      desc: "Add a lantern, widen the orbit, and intensify contact damage",
      apply: (s) => {
        s.weapons.lantern.level++;
        s.weapons.lantern.count++;
        s.weapons.lantern.radius += 6;
      },
    },
    {
      id: "shovel",
      title: "Shovel Practice",
      desc: "Harder, faster, broader melee sweeps with extra knockback",
      apply: (s) => {
        s.weapons.shovel.level++;
        s.weapons.shovel.cooldown = Math.max(0.32, s.weapons.shovel.cooldown * 0.84);
        s.weapons.shovel.damage *= 1.16;
        s.weapons.shovel.range += 10;
        s.weapons.shovel.arc += 0.12;
      },
    },
  ];
  // ---- v15: the user's lean SFX pack (assets/sfx/*.ogg). Plain <audio> elements, so it also works when the game is
  // opened straight from the folder (file://). Each sound: [volume, minimum gap in seconds, pool size]. A global
  // voice cap stops crowds from spamming; the SFX slider scales everything; anything unplayable falls back to the bleep.
  const SFX_DEF = {
    alarm_short: [0.45, 0.5, 2],
    boss_death_groan: [0.9, 1, 1],
    boss_death_monster: [0.9, 1, 1],
    boss_death_scream: [0.85, 1, 1],
    boss_laugh_entrance: [0.85, 1, 1],
    boss_laugh_entrance_high: [0.85, 1, 1],
    boss_roar_entrance: [0.85, 1, 1],
    boss_roar_entrance_deep: [0.85, 1, 1],
    chainsaw_rev: [0.28, 0.9, 1],
    clock_explosion: [0.9, 0.5, 1],
    enemy_shot_generic: [0.32, 0.12, 3],
    enemy_throw_whoosh: [0.4, 0.1, 3],
    gas_hiss: [0.32, 0.4, 2],
    holywater_spell: [0.28, 0.45, 2],
    lantern_spell: [0.24, 0.6, 1],
    laser_zap: [0.32, 0.1, 3],
    level_up: [0.6, 0.3, 1],
    nailgun_shot: [0.28, 0.08, 3],
    pickup: [0.056, 0.07, 3], // v16: the user asked for item pickups 80% quieter (was 0.28)
    player_death: [0.8, 1, 1],
    player_hurt: [0.5, 0.25, 2],
    shovel_hit: [0.42, 0.12, 2],
    slam_impact: [0.6, 0.15, 3],
    sunrise_burn: [0.6, 0.6, 1],
  };
  // v16: extra game events reuse files from the pack (no new files, per the user's lean-audio rule):
  // name: [source file, volume, min gap s, pool, playback rate (pitch)].
  const SFX_VAR = {
    gem: ["pickup", 0.07, 0.06, 3, 1.5], // XP gem: brighter, higher chime than the wage coin
    mob_death: ["boss_death_monster", 0.16, 0.12, 3, 1.7], // regular monster deaths: short, high, quiet
    chains: ["shovel_hit", 0.32, 0.3, 2, 0.7], // Ghost Chains: low clank
    whistle: ["laser_zap", 0.35, 0.5, 1, 0.55], // Death Whistle shockwave
    bell_toll: ["holywater_spell", 0.45, 0.5, 1, 0.5], // Funeral Bell: the spell chime an octave down
    vacuum: ["gas_hiss", 0.5, 0.5, 1, 0.75], // Ghost Vacuum suction
    ui_click: ["pickup", 0.22, 0.05, 2, 0.8], // menu buttons / level-up choice / start shift
    countdown: ["shovel_hit", 0.35, 0.3, 1, 1.6], // sunrise countdown ticks
    horde: ["boss_roar_entrance_deep", 0.55, 2, 1, 0.8], // "the dead are rising" horde before sunrise
  };
  const SFX_MAX_VOICES = 8;
  const sfxPool = {},
    sfxLast = {},
    sfxBad = {},
    sfxStats = { played: 0, throttled: 0, fallback: 0, capped: 0, byName: {} };
  const SFX_CAN = (() => {
    try {
      return !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
    } catch {
      return false;
    }
  })();
  const SFX_ALL = {};
  for (const [n, d] of Object.entries(SFX_DEF)) SFX_ALL[n] = { file: n, vol: d[0], gap: d[1], pool: d[2], rate: 1 };
  for (const [n, d] of Object.entries(SFX_VAR)) SFX_ALL[n] = { file: d[0], vol: d[1], gap: d[2], pool: d[3], rate: d[4] };
  if (SFX_CAN)
    for (const [n, def] of Object.entries(SFX_ALL))
      sfxPool[n] = Array.from({ length: def.pool }, () => {
        const a = new Audio(`assets/sfx/${def.file}.ogg`);
        a.preload = "auto";
        if (def.rate !== 1) a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false;
        a.addEventListener("error", () => (sfxBad[n] = true));
        return a;
      });
  function sfx(name, vol = 1, fallback, rate) {
    if (save.sfx === 0) return;
    const def = SFX_ALL[name],
      pool = sfxPool[name];
    if (!def || !pool || sfxBad[name]) {
      sfxStats.fallback++;
      if (fallback) fallback();
      return;
    }
    const now = performance.now() / 1000;
    if (now - (sfxLast[name] ?? -99) < def.gap) {
      sfxStats.throttled++;
      return;
    }
    let voices = 0;
    for (const pl of Object.values(sfxPool)) for (const a of pl) if (!a.paused && !a.ended) voices++;
    const a = pool.find((x) => x.paused || x.ended);
    if (voices >= SFX_MAX_VOICES || !a) {
      sfxStats.capped++;
      return;
    }
    sfxLast[name] = now;
    a.volume = Math.max(0, Math.min(1, def.vol * vol * save.sfx));
    const r = rate ?? def.rate;
    if (rate != null) a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false; // let the rate shift the pitch
    if (r !== 1 || a.playbackRate !== 1) a.playbackRate = r;
    try {
      a.currentTime = 0;
    } catch {}
    a.play().catch(() => {});
    sfxStats.played++;
    sfxStats.byName[name] = (sfxStats.byName[name] || 0) + 1;
  }
  function audioBeep(freq = 180, duration = 0.07, type = "square", volume = 0.035) {
    if (!audio || save.sfx === 0) return;
    try {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = volume * save.sfx;
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + duration);
    } catch {}
  }
  function unlockAudio() {
    if (!audio) {
      try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    if (audio?.state === "suspended") audio.resume();
    if (musicOn) musicStart(musicWant); // first click/key: browsers only allow music after a gesture
  }
  function panelShow(html) {
    panel.classList.remove("title-mode");
    panel.style.backgroundImage = "";
    panel.innerHTML = `<div class="card">${html}</div>`;
    panel.classList.add("visible");
  }
  function panelHide() {
    panel.classList.remove("visible");
    panel.innerHTML = "";
  }
  function btn(label, fn, kind = "") {
    const b = document.createElement("button");
    b.className = `game-btn ${kind}`;
    b.textContent = label;
    b.onclick = fn;
    return b;
  }
  function addButtons(target, items) {
    const row = document.createElement("div");
    row.className = "button-row";
    for (const [label, fn, kind] of items) row.appendChild(btn(label, fn, kind));
    target.appendChild(row);
  }
  function showTitle() {
    mode = "title";
    menuBack = "title";
    playMusic("title");
    // v14: the user's title art ("Grave Hog's Break") fills the frame; the logo is part of the art, so the menu
    // sits in a dark strip along the bottom where it can't cover Hog or the logo.
    panelShow(`<p class="title-sub">SIX HOURS TILL HE CLOCKS OUT</p>`);
    panel.classList.add("title-mode");
    panel.insertAdjacentHTML("beforeend", `<span class="version-tag">${GAME_VERSION}</span>`);
    panel.style.backgroundImage = `url(${IMAGE_FILES.title})`;
    const c = panel.firstElementChild;
    c.className = "card title-card";
    addButtons(c, [
      ["START SHIFT", () => startRun(1), "primary"],
      ["MAINTENANCE OFFICE", () => showOffice("title")],
      ["OPTIONS", () => showOptions("title")],
      ["COMPENDIUM", () => showCompendium("w")],
      ["CONTROLS", showControls],
    ]);
    if (save.shifts > 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = `Timecards filed: ${save.shifts} · Best kills: ${save.bestKills} · Best level: ${save.bestLevel}`;
      c.appendChild(p);
    }
  }
  // ---- v10: outro slideshows (the user's panels) and the ending screen ----
  let slides = null;
  function showSlides(stage, onDone) {
    mode = "slides";
    keys.clear();
    slides = { list: PANEL_SETS[stage], i: 0, onDone, stage };
    playMusic("title");
    musicTrack.volume = save.music * 0.6;
    renderSlide();
  }
  function renderSlide() {
    const s = slides,
      last = s.i === s.list.length - 1;
    panel.innerHTML = `<div class="slides"><img class="slide-img" alt="Story panel ${s.i + 1}" src="${s.list[s.i]}"><div class="slide-bar"><span class="slide-count">${s.i + 1} / ${s.list.length}</span><button class="game-btn primary slide-next" data-next>${last ? "CONTINUE ▶" : "NEXT ▶"}</button></div></div>`;
    panel.classList.add("visible");
    panel.querySelector("[data-next]").onclick = nextSlide;
    panel.querySelector("[data-next]").focus({ preventScroll: true });
  }
  function nextSlide() {
    if (mode !== "slides" || !slides) return;
    sfx("ui_click", 1, () => audioBeep(520, 0.05, "square", 0.02));
    if (slides.i < slides.list.length - 1) {
      slides.i++;
      renderSlide();
      return;
    }
    const done = slides.onDone;
    slides = null;
    done();
  }
  function showEnding() {
    mode = "ending";
    playMusic("title");
    panelShow(
      `<div class="eyebrow">THE END… OR IS IT?</div><h2>GRAVE HOG SURVIVED THE MEGA MART</h2><p>Two shifts. Six bosses. Zero overtime pay.</p><p class="status-line">MEGA MART CLEARED ${save.megaMartClears}× · WAGES ${save.wages}</p>`,
    );
    addButtons(panel.firstElementChild, [
      ["WAKE UP AND START OVER", () => startRun(1), "primary"],
      ["TITLE SCREEN", showTitle],
      ["EXIT", exitGame, "danger"],
    ]);
  }
  // Browsers only let a page close a tab the page itself opened, so Exit tries, then falls back to a goodbye screen.
  function exitGame() {
    try {
      window.close();
    } catch {}
    setTimeout(() => {
      if (window.closed) return;
      mode = "goodbye";
      musicTrack.pause();
      panelShow(`<div class="eyebrow">SHIFT OVER</div><h2>GRAVE HOG HAS CLOCKED OUT</h2><p>Thanks for playing. You can close this tab now.</p>`);
      addButtons(panel.firstElementChild, [["CHANGED MY MIND", showTitle, "primary"]]);
    }, 250);
  }
  function showControls() {
    mode = "title";
    panelShow(
      `<div class="eyebrow">THE RULES</div><h2>HOW TO SURVIVE THE SHIFT</h2><p><b>WASD or Arrow Keys</b> move (on a phone: drag your thumb anywhere to steer). Grave Hog attacks nearby monsters automatically. Walk over the glowing drops to collect them: <b>gems</b> are experience, <b>gold coins</b> are Cemetery Wages, pizza heals.</p><p>XP fills the bar; every level pauses the shift and offers three upgrades. Don't like them? <b>Reroll</b> (R) draws three new ones, <b>Banish</b> (B) removes one for the rest of the shift. Buy extra rerolls and banishes in the office. <b>ESC</b> pauses (or the ❚❚ button on touch screens). <b>F</b> toggles fullscreen. <b>P</b> freezes the action with no menu over it, for clean screenshots. <b>Mouse wheel</b> or <b>Z</b> zooms out to see more (pinch or the ZOOM button on touch screens). The run lasts from midnight to 6 AM (about 12 minutes).</p><p><b>Controller:</b> left stick or D-pad moves, Start pauses, Back/Select shows the map, bumpers zoom, A picks, B goes back, X rerolls, Y banishes.</p><p>Shovel, nail gun, holy water, chainsaw and haunted lanterns can all stack. The maintenance office buys permanent upgrades with Cemetery Wages.</p>`,
    );
    addButtons(panel.firstElementChild, [
      ["BACK", showTitle, "primary"],
      ["START SHIFT", startRun],
    ]);
  }
  // ---- Compendium: every weapon, monster and boss you've found (saved forever). Unknown ones are silhouettes. ----
  const DEX_LORE = {
    zombie: "Clocked out years ago. Never got the memo.",
    skeleton: "All bone, no brains. Fast, though.",
    hand: "Somebody lost a hand. It found its way back. Angry.",
    ghost: "Flickers in and out. Mostly in when you're not looking.",
    worm: "Lunges out of the dirt. Grave Hog hates these.",
    keeper: "The old groundskeeper. Possessed, slow and very, very tough.",
    shopper_zombie: "Still looking for the coupon aisle.",
    cashier_corpse: "Scans you from across the store. Unexpected item in bagging area: you.",
    stock_clerk: "Throws boxes. It's the only part of the job he ever liked.",
    cleaning_bot: "Cleans up messes. You are a mess.",
    mutated_produce: "Fresh produce. Too fresh. It has teeth.",
    rat_swarm: "Small, fast, everywhere. The health inspector never came back.",
    security_drone: "Hovers, zaps, and calls for backup.",
    forklift_zombie: "OSHA violation on wheels. Do not stand in front of it.",
  };
  const DEX_ENEMY_ROW = { zombie: 0, skeleton: 1, hand: 2, ghost: 3, worm: 4, keeper: 5 };
  function drawDexArt(c, kind, id, known) {
    const x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    const W2 = c.width;
    if (kind === "w") drawUpgradeIcon(c, id);
    else if (kind === "e") {
      if (DEX_ENEMY_ROW[id] !== undefined) ready(enemySheet) && x.drawImage(enemySheet, 0, DEX_ENEMY_ROW[id] * 64, 64, 64, 0, 0, W2, W2);
      else {
        const im = IMAGES["mm_" + id],
          fs = TYPES2[id].size;
        ready(im) && x.drawImage(im, 0, 0, fs, fs, 0, 0, W2, W2);
      }
    } else {
      const S = BOSS_CELL,
        d = BOSS[id];
      if (d.s2) ready(IMAGES.mmBoss) && x.drawImage(IMAGES.mmBoss, 0, d.idx * 3 * S, S, S, 0, 0, W2, W2);
      else if (id === "digger") ready(diggerSheet) && x.drawImage(diggerSheet, 0, 0, S, S, 0, 0, W2, W2);
      else ready(bossSheet) && x.drawImage(bossSheet, 0, (id === "widow" ? 0 : 1) * S, S, S, 0, 0, W2, W2);
    }
    if (!known) {
      // silhouette: keep the shape, paint it black
      x.globalCompositeOperation = "source-in";
      x.fillStyle = "#06070a";
      x.fillRect(0, 0, W2, W2);
      x.globalCompositeOperation = "source-over";
    }
  }
  let dexBack = "title";
  function showCompendium(tab = "w", back) {
    if (typeof back === "string") dexBack = back;
    mode = "compendium";
    const dx = dexBook(),
      lists = {
        w: ALL_WEAPONS().map((id) => ({ id, known: !!dx.w[id], name: weaponName(id), line: UPGRADES.find((u) => u.id === id)?.desc || "", stat: "" })),
        e: [...Object.keys(TYPES), ...Object.keys(TYPES2)].map((id) => ({ id, known: dx.e[id] !== undefined, name: (TYPES[id] || TYPES2[id]).name, line: DEX_LORE[id] || "", stat: `Killed: ${dx.e[id] || 0}`, stage: TYPES[id] ? 1 : 2 })),
        b: Object.keys(BOSS).map((id) => ({ id, known: dx.b[id] !== undefined, name: BOSS[id].name, line: `“${BOSS[id].taunt}”`, stat: dx.b[id] ? `Defeated: ${dx.b[id]}` : "Not defeated yet", stage: BOSS[id].s2 ? 2 : 1 })),
      },
      list = lists[tab],
      found = list.filter((r) => r.known).length,
      label = { w: "WEAPONS", e: "MONSTERS", b: "BOSSES" };
    panelShow(
      `<div class="eyebrow">THE GRAVEYARD SHIFT</div><h2>COMPENDIUM</h2><div class="dex-tabs">${["w", "e", "b"]
        .map((k) => `<button class="game-btn${k === tab ? " primary" : ""}" data-tab="${k}">${label[k]} ${lists[k].filter((r) => r.known).length}/${lists[k].length}</button>`)
        .join("")}</div><div class="dex-grid">${list
        .map(
          (r, i) =>
            `<div class="dex-card${r.known ? "" : " unknown"}"><canvas width="48" height="48" data-i="${i}"></canvas><div><b>${r.known ? r.name : "???"}</b><p>${r.known ? r.line : r.stage === 2 ? "Haunts the Mega Mart." : tab === "w" ? "Pick it up on a shift to learn more." : "Lurks somewhere in the cemetery."}</p>${r.known && r.stat ? `<span class="dex-stat">${r.stat}</span>` : ""}</div></div>`,
        )
        .join("")}</div><p class="muted">${found} of ${list.length} ${label[tab].toLowerCase()} found.</p>`,
    );
    const card = panel.firstElementChild;
    card.querySelectorAll(".dex-grid canvas").forEach((c) => {
      const r = list[+c.dataset.i];
      drawDexArt(c, tab, r.id, r.known);
    });
    card.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => showCompendium(b.dataset.tab)));
    // BACK sits in the tab row so it's always visible, even when the list scrolls
    const backBtn = document.createElement("button");
    backBtn.className = "game-btn dex-back";
    backBtn.textContent = dexBack === "pause" && state ? "◀ BACK TO SHIFT" : "◀ BACK";
    backBtn.onclick = () => (dexBack === "pause" && state ? showPause() : showTitle());
    card.querySelector(".dex-tabs").prepend(backBtn);
  }
  // v16: the office and the new Options screen remember where they were opened from: the title, or the pause menu
  // mid-shift (BACK then returns to the paused shift instead of the title screen).
  let menuBack = "title";
  const PERK_ITEMS = [
    ["health", "Bigger Health Plan", "+10 max health / level"],
    ["damage", "Union Knuckles", "+5% starting damage / level"],
    ["speed", "Fast Clock-Out", "+4% movement speed / level"],
    ["xp", "Experience Clause", "+5% XP gain / level"],
    ["magnet", "Long-Handled Grabber", "+8% pickup radius / level"],
    ["reroll", "Second Opinion", "+1 level-up reroll per shift"],
    ["banish", "Write 'Em Up", "+1 level-up banish per shift"],
    ["cheese", "Extra Cheese", "+3 health from every pizza"],
    ["limit", "Limit Break", "+1 max level for every weapon (normally 5)"],
  ];
  // Rerolls / banishes: every shift starts with BASE_*; the office adds up to PERK_MAX more (and costs a step more).
  const BASE_REROLLS = 2,
    BASE_BANISHES = 1,
    PERK_MAX = { reroll: 3, banish: 2, cheese: 5, limit: 3 },
    LIMIT_COSTS = [400, 800, 1400]; // Limit Break is the big wage sink
  const perkCost = (lvl) => Math.floor(12 + 12 * lvl * lvl + lvl * 8);
  const perkCostFor = (id, lvl) => (id === "limit" ? LIMIT_COSTS[Math.min(lvl, LIMIT_COSTS.length - 1)] : PERK_MAX[id] ? perkCost(lvl + 1) : perkCost(lvl));
  const wmax = () => WMAX_BASE + Math.min(PERK_MAX.limit, save.perks.limit || 0); // current weapon max level
  function perkRefund() {
    let t = 0;
    for (const id of Object.keys(save.perks)) for (let l = 0; l < save.perks[id]; l++) t += perkCostFor(id, l);
    return t;
  }
  let resultsView = null; // reopens the end-of-shift results card (set by finishRun)
  function menuBackBtn() {
    if (menuBack === "results" && resultsView) return ["BACK TO RESULTS", resultsView, "primary"];
    return menuBack === "pause" && state ? ["BACK TO SHIFT", showPause, "primary"] : ["BACK TO TITLE", showTitle, "primary"];
  }
  function showOffice(back) {
    if (typeof back === "string") menuBack = back;
    mode = "office";
    const p = save.perks,
      midShift = menuBack === "pause" && state;
    panelShow(
      `<div class="eyebrow">CEMETERY MAINTENANCE OFFICE</div><h2>PAYDAY, SORT OF</h2><p class="status-line">CEMETERY WAGES: ${save.wages}</p><p>Permanent perks survive a bad shift.${midShift ? " Perks bought now kick in from your next shift." : ""} Changed your mind? Reset the time card for a full refund.</p><div class="shop-grid">${PERK_ITEMS.map(([id, name, desc]) => {
        const maxed = PERK_MAX[id] && p[id] >= PERK_MAX[id];
        return `<div class="shop-item"><b>${name}</b><p>${desc}<br>Level ${p[id]}${PERK_MAX[id] ? `/${PERK_MAX[id]}` : ""} · ${maxed ? "MAXED" : `Next cost ${perkCostFor(id, p[id])}`}</p><button class="game-btn" data-buy="${id}"${maxed ? " disabled" : ""}>${maxed ? "MAXED" : "BUY"}</button></div>`;
      }).join("")}</div>`,
    );
    for (const b of panel.querySelectorAll("[data-buy]"))
      b.onclick = () => {
        const id = b.dataset.buy,
          c = perkCostFor(id, p[id]);
        if (PERK_MAX[id] && p[id] >= PERK_MAX[id]) return;
        if (save.wages < c) {
          toastMsg("Not enough wages. Grave Hog has filed a complaint.");
          return;
        }
        save.wages -= c;
        p[id]++;
        saveGame();
        sfx("pickup", 3, () => audioBeep(760, 0.08, "triangle", 0.03));
        showOffice();
      };
    addButtons(panel.firstElementChild, [menuBackBtn(), ["RESET TIME CARD", confirmReset, "danger"]]);
  }
  // v16: Reset Time Card = refund every wage spent on perks (perks back to level 0) so they can be re-spent.
  // Records, stage unlocks, wages and the current shift are all kept; you stay in the office.
  function confirmReset() {
    mode = "office";
    const r = perkRefund();
    panelShow(
      `<div class="eyebrow">RESET TIME CARD</div><h2>REFUND YOUR PERKS?</h2><p>All perks go back to level 0 and you get <b>${r} wages</b> back to spend on different upgrades.</p><p class="muted">Nothing else changes: wages, records, unlocked stages${state && menuBack === "pause" ? " and your current shift" : ""} are kept.</p>`,
    );
    addButtons(panel.firstElementChild, [
      ["KEEP MY PERKS", () => showOffice(), "primary"],
      [
        r ? `REFUND ${r} WAGES` : "NOTHING TO REFUND",
        () => {
          if (r) {
            save.wages += r;
            for (const id of Object.keys(save.perks)) save.perks[id] = 0;
            saveGame();
            toastMsg(`Time card reset: ${r} wages refunded.`);
          }
          showOffice();
        },
        "danger",
      ],
    ]);
  }
  function showOptions(back) {
    if (typeof back === "string") menuBack = back;
    mode = "options";
    panelShow(
      `<div class="eyebrow">OPTIONS</div><h2>SOUND</h2><div class="volume-controls options-grid"><label>Music <input id="musicvol" type="range" min="0" max="1" step="0.05" value="${save.music}"><span id="musicval">${Math.round(save.music * 100)}%</span></label><label>Sound FX <input id="sfxvol" type="range" min="0" max="1" step="0.05" value="${save.sfx}"><span id="sfxval">${Math.round(save.sfx * 100)}%</span></label></div><p class="muted">Saved on this browser's time card.</p>`,
    );
    const c = panel.firstElementChild;
    c.querySelector("#musicvol").oninput = (e) => {
      save.music = Number(e.target.value);
      victoryTrack.volume = save.music;
      c.querySelector("#musicval").textContent = `${Math.round(save.music * 100)}%`;
      saveGame();
    };
    c.querySelector("#sfxvol").oninput = (e) => {
      save.sfx = Number(e.target.value);
      c.querySelector("#sfxval").textContent = `${Math.round(save.sfx * 100)}%`;
      saveGame();
    };
    c.querySelector("#sfxvol").onchange = () => sfx("pickup", 3); // preview at the new level
    addButtons(c, [menuBackBtn()]);
  }
  // v16: Trash Queen cameo — Stage 1 only, once per run. Stands near the middle of the cemetery; when Grave Hog bumps
  // into her she sprints off to the right and is gone. Not an enemy: weapons/monsters ignore her and she blocks nothing.
  const TQ_W = 84,
    TQ_H = 80,
    TQ_SPEED = 250;
  function placeCameo() {
    const p = state.player;
    for (let i = 0; i < 600; i++) {
      const cx = Math.floor(rand(0.38, 0.62) * CW),
        cy = Math.floor(rand(0.38, 0.62) * CHH);
      if (!WORLD.reach[cy * CW + cx]) continue;
      let ok = true;
      for (let dy = -3; dy <= 1 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) if (isSolidCell(cx + dx, cy + dy)) ok = false;
      const x = (cx + 0.5) * CELL,
        y = (cy + 0.5) * CELL;
      if (!ok || Math.hypot(x - p.x, y - p.y) < 260) continue;
      return { x, y, run: false, t: 0, runT: 0, gone: false };
    }
    return null;
  }
  function updateCameo(dt) {
    const c = state.cameo,
      p = state.player;
    if (!c || c.gone) return;
    c.t += dt;
    if (!c.run) {
      if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + 18) {
        c.run = true;
        state.cameoBumps = (state.cameoBumps || 0) + 1;
      }
      return;
    }
    c.runT += dt;
    c.x += TQ_SPEED * Math.min(1, 0.35 + c.runT * 3) * dt;
    if (c.x - TQ_W / 2 > p.x + VIEW_W * 0.65 || c.x - TQ_W / 2 > WORLD_W) c.gone = true; // off the right of the screen
  }
  function drawCameo(c, sx, sy) {
    const im = IMAGES.trashQueen;
    if (!ready(im)) return;
    const fr = c.run ? 1 + (Math.floor(c.runT * 11) % 3) : 0;
    c.frame = fr;
    g.globalAlpha = 0.3;
    g.fillStyle = "#000";
    g.beginPath();
    g.ellipse(sx, sy + 1, 15, 5, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.drawImage(im, fr * TQ_W, 0, TQ_W, TQ_H, Math.round(sx - TQ_W / 2), Math.round(sy - TQ_H + 3), TQ_W, TQ_H);
  }
  function zoomHint() {
    if (save.zoomHint) return;
    setTimeout(() => {
      if (mode !== "playing" || save.zoomHint) return;
      save.zoomHint = true;
      saveGame();
      toastMsg(document.body.classList.contains("touch") ? "TIP: pinch or tap ZOOM to see more of the map." : "TIP: mouse wheel (or Z) zooms out to see more of the map.");
    }, 7000);
  }
  function startRun(stageArg) {
    zoomHint();
    const stage = stageArg === 2 ? 2 : 1; // also used directly as a click handler (event arg -> Stage 1)
    if (!assetsReady) {
      toastMsg("Still loading the cemetery art…");
      return;
    }
    if (stage === 2 && !megaFloorReady) {
      mode = "loading";
      panelShow(`<div class="eyebrow">STAGE 2</div><h2>MEGA MART</h2><p class="status-line">Unlocking the doors…</p>`);
      loadMegaMartFloor().then(() => startRun(2));
      return;
    }
    if (stage === 2 && !save.stage2Unlocked) {
      save.stage2Unlocked = true;
      saveGame();
    }
    setStage(stage);
    playMusic(stage === 2 ? "stage2" : "stage1");
    unlockAudio();
    victoryTrack.pause();
    victoryTrack.currentTime = 0;
    musicTrack.volume = save.music;
    pendingLevelUps = 0;
    worldSeed = Math.random() * 100000;
    state = {
      t: 0,
      player: {
        x: WORLD.startX,
        y: WORLD.startY,
        r: 14,
        dir: "up",
        dirHold: 0,
        stride: 0,
        hurtAnim: 0,
        pose: 0,
        poseType: "",
        aim: -Math.PI / 2,
        blessT: 0,
        hp: 100 + save.perks.health * 10,
        maxHp: 100 + save.perks.health * 10,
        xp: 0,
        nextXp: 10,
        level: 1,
        speed: 152 * (1 + save.perks.speed * 0.04),
        damage: 1 + save.perks.damage * 0.05,
        regen: 0,
        baseMaxHp: 100 + save.perks.health * 10, // v9: start-of-shift values, for the HUD stat readout
        baseSpeed: 152 * (1 + save.perks.speed * 0.04),
        magnet: 78 * (1 + save.perks.magnet * 0.08),
        face: 0,
        invuln: 0,
        attackAnim: 0,
      },
      enemies: [],
      drops: [],
      particles: [],
      projectiles: [],
      deaths: [],
      kills: 0,
      earned: 0,
      damageTaken: 0,
      bosses: 0,
      spawn: 0,
      clock: 0,
      eventText: "",
      eventUntil: 0,
      bossesDead: {},
      bossesSpawned: {},
      rerolls: BASE_REROLLS + Math.min(PERK_MAX.reroll, save.perks.reroll || 0),
      banishes: BASE_BANISHES + Math.min(PERK_MAX.banish, save.perks.banish || 0),
      banished: [], // upgrade ids banished this shift: never offered again
      weapons: {
        shovel: { level: 1, cooldown: 0, range: 48, arc: 1.05, damage: 25 },
        nail: { level: 0, cooldown: 0.9, damage: 17, speed: 350 },
        sprinkler: { level: 0, cooldown: 0, range: 112, width: 0.44, duration: 0.22 },
        chainsaw: { level: 0, damage: 42, cooldown: 0, range: 66, duration: 0.16 },
        lantern: { level: 0, count: 0, radius: 47, sfxCooldown: 0 },
      },
      lastBoss: null,
      walk: 0,
      region: null,
      regionBanner: 0,
      flowT: 0,
      rewards: stage === 2 ? [] : makeRewards(),
      stage,
      clouds: [],
      lastUpgrade: "shovel",
      visited: {},
      bonus: { hp: 0, speed: 0, weapon: 0, regen: 0 },
      bonusAmt: { hp: 0, regen: 0 }, // v9: absolute amounts the treasures added (for the HUD breakdown) // v8: treasure bonuses, this shift only (pickup counts; each = +2%)
      floaters: [],
      kingDark: 0,
      bossFireHits: { widow: 0, king: 0 },
    };
    initWeapons2(state);
    if (stage === 2) makeStage2Rewards();
    computeFlowField();
    state.cameo = stage === 1 ? placeCameo() : null;
    mode = "playing";
    panelHide();
    toastMsg(
      stage === 2
        ? "MEGA MART, MIDNIGHT. Prices are to die for. The Meat Manager runs this place."
        : save.shifts
          ? "MIDNIGHT. Clock in at the MAIN ENTRANCE."
          : "MIDNIGHT. Your weapons swing on their own: just move, grab the glowing gems and survive till 6 AM.",
    );
    sfx("ui_click", 1.3, () => audioBeep(260, 0.12));
  }
  function toastMsg(s) {
    toast = s;
    toastUntil = performance.now() + 2400 + Math.max(0, s.length - 50) * 35; // long messages stay up longer
  }
  // =====================================================================================
  //  FINITE CEMETERY WORLD  (data: map-data.js)
  // =====================================================================================
  const MAP1 = window.GRAVEYARD_MAP,
    MAP2 = window.MEGAMART_MAP;
  if (!MAP1 || !MAP2) throw new Error("map-data.js and megamart-data.js must be loaded before game.js");
  // v10: world size depends on the stage (Stage 1 cemetery 3200px, Stage 2 Mega Mart 4096px).
  let STAGE = 1,
    MAP = MAP1,
    TILE,
    MW,
    MH,
    WORLD_W,
    WORLD_H,
    CW,
    CHH;
  const CELL = 16;
  function setDims() {
    TILE = MAP.tile;
    MW = MAP.width;
    MH = MAP.height;
    WORLD_W = MW * TILE;
    WORLD_H = MH * TILE;
    CW = WORLD_W / CELL;
    CHH = WORLD_H / CELL;
  }
  setDims();
  const CHUNK = 256,
    GROUND_T = 128,
    PATHLIKE = new Set([1, 2, 5, 6]);
  // Sprite definitions. src: atlas key + source rect; foot: [w, h, offsetY] collision box above the base point.
  const AI = (c, r) => ["ai", c * 64, r * 64, 64, 64];
  const P5 = (i) => ["p5", (i % 4) * 64, Math.floor(i / 4) * 64, 64, 64];
  const KINDS = {
    grave: { src: AI(0, 1), foot: [34, 14, 2] },
    grave2: { src: AI(1, 1), foot: [34, 14, 2] },
    crypt: { src: AI(2, 1), foot: [56, 24, 2] },
    fence: { src: AI(3, 1), foot: [64, 16, 1] },
    fence_v: { src: AI(5, 1), foot: [30, 32, 0] },
    hedge: { src: AI(5, 1), foot: [56, 22, 2] },
    tree: { src: AI(0, 2), foot: [18, 12, 2] },
    bush: { src: AI(1, 2), solid: false },
    open_grave: { src: AI(2, 2), foot: [30, 30, 10], flat: true },
    coffin: { src: AI(3, 2), foot: [32, 18, 6] },
    lamp: { src: AI(4, 2), foot: [10, 8, 1] },
    statue: { src: AI(5, 2), foot: [28, 16, 2] },
    wall: { src: AI(0, 3), foot: [64, 22, 2] },
    celtic: { src: AI(2, 3), foot: [48, 14, 2] },
    grave_broken: { src: AI(2, 3), foot: [48, 14, 2] },
    flowers: { src: AI(4, 3), solid: false },
    blot: { src: AI(5, 3), flat: true, solid: false },
    wheelbarrow: { src: P5(0), foot: [38, 12, 2] },
    crates: { src: P5(1), foot: [36, 18, 2] },
    coffin_stack: { src: P5(2), foot: [40, 18, 2] },
    tool_rack: { src: P5(3), foot: [40, 12, 2] },
    lawnmower: { src: P5(4), foot: [30, 12, 2] },
    signpost: { src: P5(5), foot: [10, 8, 2] },
    lantern_broken: { src: P5(6), flat: true, solid: false },
    pillar: { src: P5(7), foot: [20, 12, 2] },
    family_crypt: { src: P5(8), foot: [50, 24, 2] },
    fence_broken: { src: P5(9), foot: [60, 16, 2] },
    fence_broken_v: { src: P5(9), foot: [30, 32, 0] },
    coffin_open: { src: P5(10), foot: [40, 18, 4] },
    headstone_vines: { src: P5(12), foot: [30, 12, 2] },
    celtic_cross: { src: P5(13), foot: [26, 12, 2] },
    obelisk: { src: P5(14), foot: [20, 12, 2] },
    dirt_pile: { src: P5(15), flat: true, solid: false },
    tomb: { img: "tomb", foot: [232, 84, 4] },
    gate: { img: "gate", foot: [181, 28, 2] },
    shed: { img: "shed", foot: [118, 64, 6] },
    mausoleum: { img: "mausoleum", foot: [128, 62, 6] },
    fountain: { img: "fountain", foot: [146, 88, 44], fountain: true },
    qdtomb: { img: "qdtomb", foot: [220, 72, 26] }, // v7: building body + plinth; the front steps stay walkable
  };
  const LANDMARK_SIZE = { tomb: [254, 200], gate: [181, 134], shed: [137, 156], mausoleum: [139, 150], fountain: [208, 197], qdtomb: [320, 216] };
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const WORLD = {
    stage: 0,
    ground: new Uint8Array(MW * MH),
    solid: new Uint8Array(CW * CHH),
    nav: new Uint8Array(CW * CHH), // solid grown by one cell: paths keep body-width clearance from scenery
    props: [],
    tall: [],
    flat: [],
    buckets: new Map(),
    flow: new Uint16Array(CW * CHH),
    reach: new Uint8Array(CW * CHH),
    arenas: {},
    startX: (MAP.start[0] + 0.5) * TILE,
    startY: (MAP.start[1] + 0.5) * TILE,
  };
  const UNREACHED = 65535;
  function regionAt(x, y) {
    const tx = x / TILE,
      ty = y / TILE;
    for (const r of MAP.regions) if (tx >= r.rect[0] && tx < r.rect[2] && ty >= r.rect[1] && ty < r.rect[3]) return r;
    return MAP.regions[MAP.regions.length - 1];
  }
  const groundTile = (tx, ty) => WORLD.ground[clamp(ty, 0, MH - 1) * MW + clamp(tx, 0, MW - 1)];
  const isSolidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CHH || WORLD.solid[cy * CW + cx] === 1;
  const solidAt = (x, y) => isSolidCell(Math.floor(x / CELL), Math.floor(y / CELL));
  function spriteSize(kind) {
    const k = KINDS[kind];
    return k.img ? LANDMARK_SIZE[k.img] : [64, 64];
  }
  function footRect(kind, x, y) {
    const f = KINDS[kind].foot;
    if (!f) return null;
    return [x - f[0] / 2, y - f[2] - f[1], x + f[0] / 2, y - f[2]];
  }
  function rectHitsPathOrSolid(r, pad) {
    const x0 = r[0] - pad,
      y0 = r[1] - pad,
      x1 = r[2] + pad,
      y1 = r[3] + pad;
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++)
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) if (PATHLIKE.has(groundTile(tx, ty))) return true;
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) if (isSolidCell(cx, cy)) return true;
    return false;
  }
  function inReserved(x, y, extra = 0) {
    const tx = x / TILE,
      ty = y / TILE;
    for (const r of MAP.reserved) if (tx > r[0] - extra && tx < r[2] + extra && ty > r[1] - extra && ty < r[3] + extra) return true;
    for (const a of Object.values(MAP.arenas)) if (Math.hypot(tx - a.at[0], ty - a.at[1]) < 5.5) return true;
    if (Math.hypot(tx - MAP.start[0], ty - MAP.start[1]) < 4) return true;
    for (const rw of MAP.rewards) for (const c of rw.candidates || [rw.at]) if (Math.hypot(tx - c[0], ty - c[1]) < 2) return true;
    return false;
  }
  function markSolid(r) {
    for (let cy = Math.floor((r[1] + 2) / CELL); cy <= Math.floor((r[3] - 2) / CELL); cy++)
      for (let cx = Math.floor((r[0] + 2) / CELL); cx <= Math.floor((r[2] - 2) / CELL); cx++)
        if (cx >= 0 && cy >= 0 && cx < CW && cy < CHH) WORLD.solid[cy * CW + cx] = 1;
  }
  function addProp(kind, x, y, validate) {
    const k = KINDS[kind];
    if (!k) throw new Error("Unknown prop kind " + kind);
    x = Math.round(x);
    y = Math.round(y);
    const foot = footRect(kind, x, y);
    if (validate) {
      if (inReserved(x, y)) return false;
      const probe = foot || [x - 14, y - 12, x + 14, y];
      if (rectHitsPathOrSolid(probe, 8)) return false;
    }
    const [sw, sh] = spriteSize(kind);
    const prop = {
      kind,
      x,
      y,
      w: sw,
      h: sh,
      flat: !!k.flat,
      solid: k.solid !== false && !!foot,
      foot,
      sortY: k.fountain ? y - k.foot[2] - k.foot[1] / 2 : y,
    };
    if (prop.solid) markSolid(foot);
    WORLD.props.push(prop);
    (prop.flat ? WORLD.flat : WORLD.tall).push(prop);
    return true;
  }
  function setStage(stage) {
    if (WORLD.stage === stage) return;
    STAGE = stage;
    MAP = stage === 2 ? MAP2 : MAP1;
    setDims();
    buildWorld();
    chunkCache.clear(); // zoom is the player's choice and carries over between stages (saved)
  }
  function allocWorld() {
    if (WORLD.solid.length !== CW * CHH) {
      for (const k of ["solid", "nav", "reach"]) WORLD[k] = new Uint8Array(CW * CHH);
      WORLD.flow = new Uint16Array(CW * CHH);
      bfsQueue = new Int32Array(CW * CHH);
    }
    if (WORLD.ground.length !== MW * MH) WORLD.ground = new Uint8Array(MW * MH);
    WORLD.startX = (MAP.start[0] + 0.5) * TILE;
    WORLD.startY = (MAP.start[1] + 0.5) * TILE;
    WORLD.stage = STAGE;
  }
  // v10 Stage 2: collision comes from the bit-packed grid in megamart-data.js; the floor is the remade map art.
  function buildMegaMart() {
    WORLD.ground.fill(0);
    const bin = atob(MAP.solid);
    for (let i = 0; i < CW * CHH; i++) WORLD.solid[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    for (let cy = 0; cy < CHH; cy++)
      for (let cx = 0; cx < CW; cx++) if (cx < 4 || cy < 4 || cx >= CW - 4 || cy >= CHH - 4) WORLD.solid[cy * CW + cx] = 1;
    WORLD.props.length = WORLD.tall.length = WORLD.flat.length = 0;
    WORLD.buckets.clear();
    WORLD.testBox = null;
    for (const k of Object.keys(WORLD.arenas)) delete WORLD.arenas[k];
    for (const [id, a] of Object.entries(MAP.arenas)) WORLD.arenas[id] = { x: (a.at[0] + 0.5) * TILE, y: (a.at[1] + 0.5) * TILE, label: a.label, region: a.region };
    finishWorld();
  }
  function finishWorld() {
    WORLD.nav.set(WORLD.solid);
    for (let cy = 0; cy < CHH; cy++)
      for (let cx = 0; cx < CW; cx++)
        if (!WORLD.solid[cy * CW + cx])
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSolidCell(cx + dx, cy + dy)) WORLD.nav[cy * CW + cx] = 1;
    bfs(Math.floor(WORLD.startX / CELL), Math.floor(WORLD.startY / CELL), WORLD.flow);
    for (let i = 0; i < WORLD.flow.length; i++) WORLD.reach[i] = WORLD.flow[i] !== UNREACHED ? 1 : 0;
    buildMinimap();
  }
  // v10 test shortcut: a blue box on the ground near the Stage 1 entrance ends the stage and plays the Stage 1 outro.
  function placeTestBox() {
    // Release build: the test box is disabled. Add ?testbox to the URL to bring it back for testing.
    if (!URLQ.has("testbox")) return (WORLD.testBox = null);
    const sx = WORLD.startX + 5 * TILE,
      sy = WORLD.startY - 2 * TILE;
    const open = (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isSolidCell(Math.floor(x / CELL) + dx, Math.floor(y / CELL) + dy)) return false;
      return WORLD.reach[Math.floor(y / CELL) * CW + Math.floor(x / CELL)] === 1;
    };
    for (let r = 0; r < 12; r++)
      for (let a = 0; a < 16; a++) {
        const x = sx + Math.cos((a / 16) * TAU) * r * 16,
          y = sy + Math.sin((a / 16) * TAU) * r * 16;
        if (open(x, y)) return (WORLD.testBox = { x: Math.round(x), y: Math.round(y), s: 40 });
      }
    WORLD.testBox = null;
  }
  function buildWorld() {
    allocWorld();
    if (STAGE === 2) return buildMegaMart();
    const g = WORLD.ground;
    g.fill(0);
    const noise = (tx, ty) =>
      (Math.sin(tx * 0.37 + ty * 0.21) + Math.sin(tx * 0.11 - ty * 0.29 + 1.7) + Math.sin((tx + ty) * 0.17 + 0.5) + 3) / 6;
    for (const a of MAP.areas) {
      if (a.rect) {
        for (let ty = a.rect[1]; ty < a.rect[3]; ty++) for (let tx = a.rect[0]; tx < a.rect[2]; tx++) g[ty * MW + tx] = a.type;
      } else {
        const [cx, cy, r] = a.circle;
        for (let ty = cy - r; ty <= cy + r; ty++)
          for (let tx = cx - r; tx <= cx + r; tx++) if (Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) <= r) g[ty * MW + tx] = a.type;
      }
    }
    for (const w of MAP.worn)
      for (let ty = w.rect[1]; ty < w.rect[3]; ty++)
        for (let tx = w.rect[0]; tx < w.rect[2]; tx++) {
          const i = ty * MW + tx;
          if ((g[i] === 0 || g[i] === 3) && noise(tx, ty) > w.threshold) g[i] = 4;
        }
    for (const path of MAP.paths) {
      for (let s = 0; s < path.points.length - 1; s++) {
        const [ax, ay] = path.points[s],
          [bx, by] = path.points[s + 1],
          half = path.width / 2;
        for (let ty = Math.floor(Math.min(ay, by) - half - 1); ty <= Math.max(ay, by) + half + 1; ty++)
          for (let tx = Math.floor(Math.min(ax, bx) - half - 1); tx <= Math.max(ax, bx) + half + 1; tx++) {
            if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
            const px = tx + 0.5,
              py = ty + 0.5,
              vx = bx - ax,
              vy = by - ay,
              l2 = vx * vx + vy * vy || 1,
              t = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
            if (Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) <= half) {
              const cur = g[ty * MW + tx];
              if (!(cur === 5 || cur === 6) || path.type === 2) g[ty * MW + tx] = cur === 6 || cur === 5 ? cur : path.type;
            }
          }
      }
    }
    for (let ty = 0; ty < MH; ty++)
      for (let tx = 0; tx < MW; tx++) if (tx < 2 || ty < 2 || tx >= MW - 2 || ty >= MH - 2) g[ty * MW + tx] = 3;
    // Boundary walls: two tiles of solid all round (the drawn fences/hedges sit on top of it).
    WORLD.solid.fill(0);
    for (let cy = 0; cy < CHH; cy++)
      for (let cx = 0; cx < CW; cx++) if (cx < 4 || cy < 4 || cx >= CW - 4 || cy >= CHH - 4) WORLD.solid[cy * CW + cx] = 1;
    WORLD.props.length = WORLD.tall.length = WORLD.flat.length = 0;
    const T = (v) => v * TILE;
    for (const [kind, tx, ty] of MAP.landmarks) addProp(kind, T(tx), T(ty), false);
    // Boundary dressing (purely visual — the boundary is already solid).
    const deco = (kind, x, y) => {
      const [sw, sh] = spriteSize(kind);
      const pr = { kind, x, y, w: sw, h: sh, flat: false, solid: false, foot: null, sortY: y, boundary: true };
      WORLD.props.push(pr);
      WORLD.tall.push(pr);
    };
    for (let x = 32; x < WORLD_W; x += 64) {
      deco("fence", x, 62);
      if (x < T(62.5) || x > T(69.5)) deco("fence", x, WORLD_H - 4);
    }
    for (let y = 72; y < WORLD_H - 20; y += 30) {
      deco("hedge", 30, y);
      deco("hedge", WORLD_W - 30, y);
    }
    for (const [kind, tx, ty] of MAP.props) addProp(kind, T(tx), T(ty), false);
    for (const [kind, x0, y0, x1, y1, step, g0, g1] of MAP.lines) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d <= len + 0.01; d += kind.endsWith("_v") ? 1 : step) {
        if (g0 >= 0 && d >= g0 && d <= g1) continue;
        const f = d / (len || 1);
        addProp(kind, T(x0 + (x1 - x0) * f), T(y0 + (y1 - y0) * f), false);
      }
    }
    const graveKinds = ["grave", "grave2", "headstone_vines", "celtic_cross", "grave", "grave2", "celtic"];
    for (const [x0, x1, y, seed, gap] of MAP.graveRows) {
      const rnd = mulberry32(seed);
      for (let x = x0; x <= x1; x += 2) {
        if (rnd() < gap) continue;
        addProp(graveKinds[Math.floor(rnd() * graveKinds.length)], T(x) + rnd() * 8 - 4, T(y) + rnd() * 6 - 3, true);
      }
    }
    for (const [rect, seed, count, kinds] of MAP.scatter) {
      const rnd = mulberry32(seed);
      let placed = 0;
      for (let attempt = 0; attempt < count * 12 && placed < count; attempt++) {
        const x = T(rect[0] + rnd() * (rect[2] - rect[0])),
          y = T(rect[1] + rnd() * (rect[3] - rect[1]));
        if (addProp(kinds[Math.floor(rnd() * kinds.length)], x, y, true)) placed++;
      }
    }
    // Spatial buckets (by 256px chunk) for viewport culling of tall props.
    WORLD.buckets.clear();
    for (const pr of WORLD.tall) {
      const x0 = Math.floor((pr.x - pr.w / 2) / CHUNK),
        x1 = Math.floor((pr.x + pr.w / 2) / CHUNK),
        y0 = Math.floor((pr.y - pr.h) / CHUNK),
        y1 = Math.floor(pr.y / CHUNK);
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const key = cx + "," + cy;
          if (!WORLD.buckets.has(key)) WORLD.buckets.set(key, []);
          WORLD.buckets.get(key).push(pr);
        }
    }
    for (const [id, a] of Object.entries(MAP.arenas))
      WORLD.arenas[id] = { x: T(a.at[0] + 0.5), y: T(a.at[1] + 0.5), label: a.label, region: a.region };
    // Reachability from the entrance: spawns and rewards only ever use reachable cells.
    finishWorld();
    placeTestBox();
  }
  let bfsQueue = new Int32Array(CW * CHH);
  function bfs(sx, sy, out) {
    out.fill(UNREACHED);
    const block = WORLD.nav;
    if (block[sy * CW + sx] || isSolidCell(sx, sy)) {
      // Start inside a solid cell (e.g. knocked into a wall edge): search outward for the nearest open cell.
      let found = false;
      for (let r = 1; r < 4 && !found; r++)
        for (let dy = -r; dy <= r && !found; dy++)
          for (let dx = -r; dx <= r && !found; dx++)
            if (!isSolidCell(sx + dx, sy + dy) && !block[(sy + dy) * CW + sx + dx]) {
              sx += dx;
              sy += dy;
              found = true;
            }
      if (!found) return;
    }
    let head = 0,
      tail = 0;
    out[sy * CW + sx] = 0;
    bfsQueue[tail++] = sy * CW + sx;
    while (head < tail) {
      const i = bfsQueue[head++],
        cx = i % CW,
        cy = (i / CW) | 0,
        d = out[i] + 1;
      if (cx > 0 && out[i - 1] === UNREACHED && !block[i - 1]) ((out[i - 1] = d), (bfsQueue[tail++] = i - 1));
      if (cx < CW - 1 && out[i + 1] === UNREACHED && !block[i + 1]) ((out[i + 1] = d), (bfsQueue[tail++] = i + 1));
      if (cy > 0 && out[i - CW] === UNREACHED && !block[i - CW]) ((out[i - CW] = d), (bfsQueue[tail++] = i - CW));
      if (cy < CHH - 1 && out[i + CW] === UNREACHED && !block[i + CW]) ((out[i + CW] = d), (bfsQueue[tail++] = i + CW));
    }
    // Cells hugging scenery get a value from their best open neighbour, so anyone standing there is steered back out.
    for (let pass = 0; pass < 2; pass++)
      for (let i = CW; i < CW * CHH - CW; i++) {
        if (out[i] !== UNREACHED || WORLD.solid[i]) continue;
        const m = Math.min(out[i - 1], out[i + 1], out[i - CW], out[i + CW]);
        if (m < UNREACHED - 1 && (pass === 0 ? !block[i - 1] || !block[i + 1] || !block[i - CW] || !block[i + CW] : true)) out[i] = m + 1;
      }
  }
  function computeFlowField() {
    if (!state) return;
    bfs(Math.floor(state.player.x / CELL), Math.floor(state.player.y / CELL), WORLD.flow);
  }
  // Direction an enemy should walk to reach the player around obstacles (null = walk straight at him).
  function flowDir(e) {
    const cx = Math.floor(e.x / CELL),
      cy = Math.floor(e.y / CELL);
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CHH) return null;
    const here = WORLD.flow[cy * CW + cx];
    if (here === UNREACHED || here <= 3) return null;
    let best = here,
      bx = 0,
      by = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx,
          ny = cy + dy;
        if (isSolidCell(nx, ny)) continue;
        if (dx && dy && (isSolidCell(cx + dx, cy) || isSolidCell(cx, cy + dy))) continue;
        const v = WORLD.flow[ny * CW + nx];
        if (v < best) ((best = v), (bx = dx), (by = dy));
      }
    if (!bx && !by) return null;
    const tx = (cx + bx + 0.5) * CELL - e.x,
      ty = (cy + by + 0.5) * CELL - e.y,
      l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  }
  // Circle-vs-solid-cell resolution. Axis-separated moves let characters slide along walls.
  function resolveCircle(ent, r) {
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor((ent.x - r) / CELL),
        x1 = Math.floor((ent.x + r) / CELL),
        y0 = Math.floor((ent.y - r) / CELL),
        y1 = Math.floor((ent.y + r) / CELL);
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          if (!isSolidCell(cx, cy)) continue;
          const nx = clamp(ent.x, cx * CELL, cx * CELL + CELL),
            ny = clamp(ent.y, cy * CELL, cy * CELL + CELL);
          let dx = ent.x - nx,
            dy = ent.y - ny,
            d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (d < 0.001) {
            // centre inside the cell: push toward the closest open side
            const opts = [
              [-1, 0, ent.x - cx * CELL],
              [1, 0, cx * CELL + CELL - ent.x],
              [0, -1, ent.y - cy * CELL],
              [0, 1, cy * CELL + CELL - ent.y],
            ].sort((a, b) => a[2] - b[2]);
            ent.x += opts[0][0] * (opts[0][2] + r);
            ent.y += opts[0][1] * (opts[0][2] + r);
            continue;
          }
          ent.x += (dx / d) * (r - d);
          ent.y += (dy / d) * (r - d);
        }
    }
    ent.x = clamp(ent.x, 4 * CELL + r, WORLD_W - 4 * CELL - r);
    ent.y = clamp(ent.y, 4 * CELL + r, WORLD_H - 4 * CELL - r);
  }
  function moveCircle(ent, dx, dy, r) {
    ent.x += dx;
    resolveCircle(ent, r);
    ent.y += dy;
    resolveCircle(ent, r);
  }
  // Spawn just outside the visible view, on an open cell the player can actually reach.
  function findSpawnPoint(minExtra = 0) {
    const p = state.player,
      base = Math.hypot(VIEW_W, VIEW_H) / 2 + 26 + minExtra;
    for (let attempt = 0; attempt < 24; attempt++) {
      const a = rand(0, TAU),
        d = rand(base, base + 90),
        x = p.x + Math.cos(a) * d,
        y = p.y + Math.sin(a) * d,
        cx = Math.floor(x / CELL),
        cy = Math.floor(y / CELL);
      if (isSolidCell(cx, cy) || isSolidCell(cx + 1, cy) || isSolidCell(cx - 1, cy) || isSolidCell(cx, cy + 1) || isSolidCell(cx, cy - 1))
        continue;
      const fd = WORLD.flow[cy * CW + cx];
      if (fd === UNREACHED || !WORLD.reach[cy * CW + cx]) continue;
      if (fd * CELL > d * 2.6) continue; // reachable, but only by a long detour: pick somewhere fairer
      return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
    }
    return null;
  }
  const CHEST_SKIP = ["monument-blessing"]; // v17: Stage 1 keeps 3 chests (the fountain landmark still blesses)
  function makeRewards() {
    return MAP.rewards.filter((rw) => !CHEST_SKIP.includes(rw.id)).map((rw) => {
      const at = rw.candidates ? pick(rw.candidates) : rw.at;
      return {
        id: rw.id,
        kind: rw.kind,
        label: rw.label,
        x: (at[0] + 0.5) * TILE,
        y: (at[1] + 0.5) * TILE,
        taken: false,
        phase: Math.random() * TAU,
      };
    });
  }
  // v10 Stage 2: the same four treasure types, placed at random valid spots when the shift starts.
  function makeStage2Rewards() {
    const defs = [
      ["supply", "SUPPLY CRATE"],
      ["cache", "HIDDEN WAGE CACHE"],
      ["heal", "OLD OFFERING"],
    ]; // v17: 3 chests per stage (each is a guaranteed +1 level, so 6 was a lot of free power)
    state.rewards = [];
    defs.forEach(([kind, label], i) => {
      const rw = { id: "mm" + i, kind, label, x: WORLD.startX, y: WORLD.startY, taken: false, phase: Math.random() * TAU };
      state.rewards.push(rw);
      if (!relocateTreasure(rw)) state.rewards.pop();
    });
  }
  // Starting treasures: after every boss defeat, every collected one returns to the exact spot it was
  // placed at when the shift began (same object, same coordinates -> never a duplicate). Uncollected ones are untouched.
  // v8: a collected treasure comes back at a NEW random spot: reachable, open ground (no solid cell within 3
  // cells), at least 7 tiles from Grave Hog and 12 tiles from every other treasure. Same object -> never a duplicate.
  const TREASURE_MIN_HOG = 7,
    TREASURE_MIN_APART = 12;
  function treasureSpotOk(x, y, others) {
    const cx = Math.floor(x / CELL),
      cy = Math.floor(y / CELL);
    if (cx < 4 || cy < 4 || cx >= CW - 4 || cy >= CHH - 4) return false;
    if (!WORLD.reach[cy * CW + cx] || WORLD.nav[cy * CW + cx]) return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (isSolidCell(cx + dx, cy + dy)) return false;
    // keep it out from behind tall scenery (sprites drawn above their footprint)
    for (const pr of WORLD.props) if (pr.foot && x > pr.foot[0] - 24 && x < pr.foot[2] + 24 && y > pr.foot[1] - 70 && y < pr.foot[3] + 16) return false;
    const p = state.player;
    if (Math.hypot(x - p.x, y - p.y) < TREASURE_MIN_HOG * TILE) return false;
    for (const o of others) if (Math.hypot(x - o.x, y - o.y) < TREASURE_MIN_APART * TILE) return false;
    return true;
  }
  function relocateTreasure(rw) {
    const others = state.rewards.filter((o) => o !== rw);
    for (let i = 0; i < 600; i++) {
      const x = (Math.floor(Math.random() * MW) + 0.5) * TILE,
        y = (Math.floor(Math.random() * MH) + 0.5) * TILE;
      if (treasureSpotOk(x, y, others)) {
        rw.x = x;
        rw.y = y;
        return true;
      }
    }
    return false; // keep the old spot (never observed in testing; QA counts it)
  }
  function restoreTreasures() {
    let n = 0;
    for (const rw of state.rewards)
      if (rw.taken) {
        if (!relocateTreasure(rw)) state.treasureRelocateFails = (state.treasureRelocateFails || 0) + 1;
        rw.taken = false;
        rw.restoredAt = state.t;
        n++;
        addParticle(rw.x, rw.y, "#ffe08a", 14, 1);
      }
    state.treasureRestores = (state.treasureRestores || 0) + 1;
    return n;
  }
  // v8: each treasure type carries one shift-long +2% bonus (stacks per pickup; gone when the next shift starts).
  const TREASURE_BONUS = {
    supply: { id: "hp", label: "MAX HP", color: "#ff7a6a" },
    cache: { id: "speed", label: "FOOT SPEED", color: "#8affb0" },
    blessing: { id: "weapon", label: "WEAPON SPEED", color: "#8fe8ff" },
    heal: { id: "regen", label: "HEALTH REGEN", color: "#ffd36a" },
  };
  const BONUS_STEP = 0.02;
  function weaponSpeedMul() {
    return 1 + BONUS_STEP * (state.bonus?.weapon || 0);
  }
  function hudStatChips() {
    const p = state.player,
      B = state.bonus,
      A = state.bonusAmt,
      out = [],
      tr = (s) => (s ? ` (treasure ${s})` : "");
    if (Math.round(p.maxHp) !== Math.round(p.baseMaxHp))
      out.push({ id: "hp", color: "#ff7a6a", text: `MAX HP ${Math.round(p.maxHp)}${tr(A.hp ? "+" + A.hp : "")}` });
    if (p.regen > 0.0001)
      out.push({ id: "regen", color: "#ffd36a", text: `REGEN ${p.regen.toFixed(2)}/s${tr(A.regen ? "+" + A.regen.toFixed(2) : "")}` });
    if (Math.abs(p.speed - p.baseSpeed) > 0.01)
      out.push({ id: "speed", color: "#8affb0", text: `SPEED +${Math.round((p.speed / p.baseSpeed - 1) * 100)}%${tr(B.speed ? "+" + B.speed * 2 + "%" : "")}` });
    if (B.weapon > 0) out.push({ id: "weapon", color: "#8fe8ff", text: `WEAPON SPEED +${B.weapon * 2}% (treasure)` });
    return out;
  }
  // v9: base ghosts drift in and out of sight, each on its own rhythm. They never drop below 30% opacity,
  // so they stay readable; hitboxes and contact damage are unchanged.
  function ghostAlpha(e) {
    const k = 0.5 + 0.5 * Math.sin(state.t * 1.4 + (e.phase || 0) * 1.7);
    return 0.3 + 0.7 * k * k * (3 - 2 * k);
  }
  function grantTreasureBonus(rw) {
    const b = TREASURE_BONUS[rw.kind],
      p = state.player;
    if (!b) return;
    state.bonus[b.id]++;
    if (b.id === "hp") {
      const inc = Math.max(1, Math.round(p.maxHp * BONUS_STEP));
      p.maxHp += inc;
      p.hp = Math.min(p.maxHp, p.hp + inc);
      state.bonusAmt.hp += inc;
    } else if (b.id === "speed") p.speed *= 1 + BONUS_STEP;
    else if (b.id === "regen") {
      const r = p.maxHp * BONUS_STEP * 0.1; // 2% of max HP every 10 seconds
      p.regen += r;
      state.bonusAmt.regen += r;
    }
    state.floaters.push({ x: p.x, y: p.y - 70, text: `+2% ${b.label}`, color: b.color, t: 0 });
  }
  // Chests: opening one pauses the shift and runs the LOOT MACHINE: three reels spin through icons of the weapons and
  // passives Grave Hog already has, stop one by one on the winner, and that weapon/passive gets +1 level.
  // Everything maxed (or nothing owned yet beyond maxed) -> full heal + wages instead.
  function collectReward(rw) {
    if (rw.taken) return; // one collection per placement
    rw.taken = true;
    rw.collects = (rw.collects || 0) + 1;
    state.chests = (state.chests || 0) + 1;
    addParticle(rw.x, rw.y, "#9dff5a", 18, 1);
    sfx("pickup", 1.3, () => audioBeep(760, 0.18, "triangle", 0.04));
    try {
      showLootMachine();
    } catch (err) {
      // never leave the game stuck behind a chest: give the reward without the show and carry on
      console.warn("Loot machine failed; granting the reward directly.", err);
      lootSpin = null;
      const c = lootCandidates();
      if (c.length) {
        const w = pick(c);
        w.apply(state);
        if (STAT_IDS.includes(w.id)) state.statPicks[w.id] = (state.statPicks[w.id] || 0) + 1;
        syncSlots();
        toastMsg(`CHEST: ${w.title} upgraded!`);
      } else ((state.player.hp = state.player.maxHp), toastMsg("CHEST: full heal!"));
      mode = "playing";
      panelHide();
    }
  }
  function lootCandidates() {
    return UPGRADES.filter((u) => {
      const w = state.weapons[u.id];
      if (w) return w.level > 0 && w.level < wmax();
      if (STAT_IDS.includes(u.id)) return (state.statPicks?.[u.id] || 0) > 0 && state.statPicks[u.id] < STAT_MAX;
      return false;
    });
  }
  const STAT_GLYPH = { damage: ["✊", "#c8452e"], speed: ["»", "#3f8f5a"], maxhp: ["♥", "#b02a3a"], regen: ["✚", "#2f7f6a"], magnet: ["◎", "#5a4aa8"] };
  // Draws an upgrade's icon into a 48x48 canvas. (Never exported with toDataURL: browsers block that when the
  // game is opened from a local file, which used to crash the loot machine and freeze the game.)
  function drawUpgradeIcon(c, id) {
    const x = c.getContext("2d");
    x.clearRect(0, 0, 48, 48);
    x.imageSmoothingEnabled = false;
    if (STAT_GLYPH[id] || id === "jackpot") {
      const [gl, col] = STAT_GLYPH[id] || ["$", "#a8862a"];
      x.fillStyle = col;
      x.fillRect(4, 4, 40, 40);
      x.strokeStyle = "#000";
      x.lineWidth = 2;
      x.strokeRect(5, 5, 38, 38);
      x.fillStyle = "#fff4d8";
      x.font = "bold 26px monospace";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(gl, 24, 26);
    } else if (id === "gsprinkler" && ready(IMAGES.hatIcon)) x.drawImage(IMAGES.hatIcon, 0, 0, 48, 48);
    else if (id in OLD_ICON) ready(weaponIcons) && x.drawImage(weaponIcons, OLD_ICON[id] * 32, 0, 32, 32, 0, 0, 48, 48);
    else if (ready(IMAGES.wpn2)) x.drawImage(IMAGES.wpn2, NW_IDS.indexOf(id) * 64, 0, 64, 64, 0, 0, 48, 48);
  }
  // Loot machine animation: the user's chest-digging sheet. [frame, ms] steps; "reveal" marks where the prize pops up.
  const DIG_W = 220,
    DIG_H = 170,
    DIG_SEQ = [
      [0, 260], [1, 130], [2, 130], [3, 130], [4, 160], [5, 260], // wrestle the lid open
      [6, 220], [7, 130], [8, 130], [9, 160], // dive in head first
      [10, 140], [11, 140], [10, 140], [11, 140], // dig dig dig
      [12, 330], [13, 330], [14, 330], [18, 330], [15, 380], // ...junk. junk. junk. junk. JUNK.
      [10, 140], [11, 140], [16, 260], // one more dig, a sniff...
      [19, 520, "reveal"], [20, 300], [21, 0], // THE GOODS (holds on the last frame)
    ];
  let lootSpin = null;
  function showLootMachine() {
    mode = "loot";
    keys.clear();
    const cands = lootCandidates(),
      jackpot = !cands.length,
      win = jackpot ? null : pick(cands),
      winLabel = win ? `${win.title} — ${upgradeLabel(win).replace("PERK", "PERK LV")}` : "";
    panelShow(
      `<div class="eyebrow">YOU CRACKED OPEN A CHEST</div><h2>LOOT MACHINE</h2><div class="loot-stage"><canvas class="loot-dig" width="${DIG_W}" height="${DIG_H}"></canvas><div class="loot-prize"><canvas class="loot-icon" width="48" height="48"></canvas></div></div><p class="loot-result status-line">Grave Hog is digging…</p>`,
    );
    const card = panel.firstElementChild,
      cv = card.querySelector(".loot-dig"),
      cx = cv.getContext("2d"),
      prize = card.querySelector(".loot-prize"),
      _icon = drawUpgradeIcon(card.querySelector(".loot-icon"), win ? win.id : "jackpot"),
      result = card.querySelector(".loot-result");
    let step = 0,
      stepAt = performance.now(),
      revealed = false;
    const drawFrame = (f) => {
      cx.fillStyle = "#000";
      cx.fillRect(0, 0, DIG_W, DIG_H);
      if (ready(IMAGES.dig)) cx.drawImage(IMAGES.dig, f * DIG_W, 0, DIG_W, DIG_H, 0, 0, DIG_W, DIG_H);
    };
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      prize.classList.add("shown");
      if (win) {
        win.apply(state);
        if (STAT_IDS.includes(win.id)) state.statPicks[win.id] = (state.statPicks[win.id] || 0) + 1;
        if (state.weapons[win.id]) state.lastUpgrade = win.id;
        syncSlots();
        result.innerHTML = `UPGRADED: <b>${winLabel}</b>`;
      } else {
        state.player.hp = state.player.maxHp;
        save.wages += 25;
        state.earned += 25;
        saveGame();
        result.innerHTML = "ALL MAXED OUT: <b>full heal + 25 wages</b>";
      }
      sfx("level_up", 1, () => audioBeep(990, 0.25, "triangle", 0.05));
    };
    const finish = () => {
      if (!lootSpin) return;
      cancelAnimationFrame(lootSpin.raf);
      lootSpin = null;
      drawFrame(DIG_SEQ[DIG_SEQ.length - 1][0]);
      reveal();
      addButtons(card, [["BACK TO WORK ▶", closeLootMachine, "primary"]]);
      card.querySelector(".game-btn.primary")?.focus({ preventScroll: true });
    };
    const tick = (now) => {
      let [f, ms, tag] = DIG_SEQ[step];
      while (ms && now - stepAt >= ms && step < DIG_SEQ.length - 1) {
        stepAt += ms;
        step++;
        [f, ms, tag] = DIG_SEQ[step];
        if (f >= 12 && f <= 15 || f === 18) audioBeep(240 + Math.random() * 60, 0.05, "square", 0.02); // junk thunk
        if (tag === "reveal") reveal();
      }
      drawFrame(f);
      if (step >= DIG_SEQ.length - 1) return finish();
      lootSpin.raf = requestAnimationFrame(tick);
    };
    drawFrame(0);
    lootSpin = { raf: requestAnimationFrame(tick), finish };
    if (!ready(IMAGES.dig)) finish(); // art missing: straight to the result
    // tap / click / Enter / A during the animation skips straight to the result
    card.addEventListener("click", () => lootSpin && finish(), { once: true });
  }
  function closeLootMachine() {
    if (lootSpin) return lootSpin.finish();
    if (pendingLevelUps) return showLevelUp();
    mode = "playing";
    panelHide();
  }
  // ---- Minimap (one pixel per tile) ----
  const minimap = document.createElement("canvas");
  minimap.width = MW;
  minimap.height = MH;
  const GROUND_COLORS = ["#20352a", "#5a4532", "#6b6f7b", "#2b2833", "#3a3d2c", "#58506a", "#7a776f"];
  function buildMinimap() {
    if (minimap.width !== MW) ((minimap.width = MW), (minimap.height = MH));
    const m = minimap.getContext("2d");
    if (STAGE === 2) {
      m.imageSmoothingEnabled = true;
      m.fillStyle = "#0b0d12";
      m.fillRect(0, 0, MW, MH);
      const cs = MW / 4;
      if (megaFloorReady) for (let i = 0; i < 16; i++) if (ready(megaFloor[i])) m.drawImage(megaFloor[i], (i % 4) * cs, Math.floor(i / 4) * cs, cs, cs);
      // darken what can't be walked on, so the map reads like the mockup's
      m.fillStyle = "rgba(5,6,10,0.55)";
      for (let ty = 0; ty < MH; ty++)
        for (let tx = 0; tx < MW; tx++) if (isSolidCell(tx * 2, ty * 2) && isSolidCell(tx * 2 + 1, ty * 2 + 1)) m.fillRect(tx, ty, 1, 1);
      return;
    }
    for (let ty = 0; ty < MH; ty++)
      for (let tx = 0; tx < MW; tx++) {
        m.fillStyle = GROUND_COLORS[WORLD.ground[ty * MW + tx]];
        m.fillRect(tx, ty, 1, 1);
      }
    for (const pr of WORLD.props) {
      if (!pr.foot) continue;
      const big = KINDS[pr.kind].img;
      m.fillStyle = big ? (pr.kind === "qdtomb" ? "#ff9a4a" : pr.kind === "tomb" ? "#a37fd0" : pr.kind === "fountain" ? "#8fd0e0" : "#c9c2b0") : "#11161a";
      m.fillRect(
        Math.floor(pr.foot[0] / TILE),
        Math.floor(pr.foot[1] / TILE),
        Math.max(1, Math.round((pr.foot[2] - pr.foot[0]) / TILE)),
        Math.max(1, Math.round((pr.foot[3] - pr.foot[1]) / TILE)),
      );
    }
    m.fillStyle = "#0b0d12";
    m.fillRect(0, 0, MW, 2);
    m.fillRect(0, MH - 2, MW, 2);
    m.fillRect(0, 0, 2, MH);
    m.fillRect(MW - 2, 0, 2, MH);
  }
  // ---- Keep the action on screen ----
  // Player weapons only target / damage monsters inside REACH (the default screen around Hog plus a small margin).
  // It's fixed to the default zoom so zooming out never adds damage. Enemies only start ranged attacks or charges
  // when they're inside the CURRENT view (no more sniping from off-screen).
  const REACH_X = 172,
    REACH_Y = 112;
  function inReach(e) {
    const p = state.player,
      m = (e.r || 10) * 0.6;
    return Math.abs(e.x - p.x) <= REACH_X + m && Math.abs(e.y - p.y) <= REACH_Y + m;
  }
  function onScreen(e, inset = 12) {
    const c = lastCam;
    if (!c) return true;
    return e.x > c.x + inset && e.x < c.x + VIEW_W - inset && e.y > c.y + inset && e.y < c.y + VIEW_H - inset;
  }
  let dmgSrc = "other"; // which weapon is dealing damage right now (set by each weapon before it hits)
  function nearestEnemy(max = Infinity) {
    if (!state) return null;
    const p = state.player;
    let best = null,
      dmax = max;
    for (const e of state.enemies) {
      if (!inReach(e)) continue;
      const d = dist(p, e);
      if (d < dmax) {
        best = e;
        dmax = d;
      }
    }
    return best;
  }
  function addParticle(x, y, color, n = 6, scale = 1) {
    for (let i = 0; i < n; i++)
      state.particles.push({ x, y, vx: rand(-90, 90), vy: rand(-100, 80), life: rand(0.18, 0.6), max: 0.6, color, r: rand(2, 4) * scale });
  }
  function damageEnemy(e, amount, knock = true) {
    if (!state.enemies.includes(e)) return;
    if (!inReach(e)) return; // off-screen monsters can't be hurt (projectiles that fly off just miss)
    // damage breakdown: credit what was actually dealt (overkill doesn't count) to the weapon doing it
    const dealt = Math.max(0, Math.min(amount, e.hp));
    state.dmgBy = state.dmgBy || {};
    const src = dmgSrc || "other";
    state.dmgBy[src] = (state.dmgBy[src] || 0) + dealt;
    e.hp -= amount;
    if (e.type === "ghost" && !e.enraged && e.hp > 0) ((e.enraged = true), (e.speed *= 1.6)); // v17: hit a ghost and it comes for you is throttled so sustained damage (lanterns, chainsaw) doesn't leave a monster permanently white.
    if (!e.flashAt || state.t - e.flashAt > 0.28) {
      e.flash = 0.1;
      e.flashAt = state.t;
    }
    shake = Math.max(shake, e.boss ? 2 : 1);
    if (knock) {
      const d = dist(state.player, e) || 1;
      e.vx += ((e.x - state.player.x) / d) * 95;
      e.vy += ((e.y - state.player.y) / d) * 95;
    }
    addParticle(e.x, e.y, e.boss ? "#f2c76a" : "#e7b75e", 3, 0.7);
    spawnSplat(e); // v14: tinted hit splatter (throttled per monster + global cap)
    if (e.hp <= 0) killEnemy(e);
  }
  const BOSS_CORPSE_HOLD = 2; // Grave Digger / Widow bodies stay down this many extra seconds before fading
  function dexBook() {
    save.dex = save.dex || {};
    for (const k of ["w", "e", "b"]) save.dex[k] = save.dex[k] || {};
    return save.dex;
  }
  function killEnemy(e) {
    const i = state.enemies.indexOf(e);
    if (i < 0) return;
    {
      const dx = dexBook(),
        key = e.boss ? e.bossId : e.type,
        book = e.boss ? dx.b : dx.e;
      book[key] = (book[key] || 0) + 1;
    }
    state.enemies.splice(i, 1);
    state.deaths.push({
      x: e.x,
      y: e.y,
      row: e.boss
        ? e.bossId === "digger"
          ? 9
          : e.bossId === "widow"
            ? 10
            : 11
        : ({ zombie: 0, skeleton: 1, hand: 2, ghost: 3, worm: 4, keeper: 5 }[e.type] ?? 0),
      s2: !!e.s2,
      type: e.type,
      hold: e.boss && (e.bossId === "digger" || e.bossId === "widow") ? BOSS_CORPSE_HOLD : 0, // lingers before fading
      exploded: !!e.exploded,
      boss: !!e.boss,
      bossId: e.bossId || null,
      faceLeft: !!e.faceLeft,
      age: 0,
    });
    state.kills++;
    spawnSplat(e, true);
    addParticle(e.x, e.y, e.boss ? "#f3d67f" : e.color, 16, e.boss ? 1.8 : 1);
    if (e.boss) {
      state.bossesDead[e.bossId] = true;
      state.lastBoss = e.bossId;
      drop(e.x, e.y, "wage", 12);
      if (state.limitless) state.limitless.bosses++;
      state.eventText = state.limitless ? "BOSS CLOCKED OUT" : e.bossId === finalBossId() ? "TIME TO CLOCK OUT!" : "BOSS CLOCKED OUT";
      state.eventUntil = state.t + 3;
      const restored = restoreTreasures();
      if (restored && (e.bossId !== finalBossId() || state.limitless)) toastMsg(`${restored} ${STAGE === 2 ? "store" : "cemetery"} treasure${restored > 1 ? "s" : ""} reappeared. Go take another look around.`);
      sfx(BOSS_DEATH_SFX[e.bossId] || "boss_death_groan", 1, () => audioBeep(120, 0.5, "sawtooth", 0.06));
    } else if (!e.exploded) {
      drop(e.x, e.y, "xp", e.xp);
      // Rare Vacuum: ~1 in 280 regular kills, and never more than one lying on the ground at a time.
      if (Math.random() < VACUUM_CHANCE && !state.drops.some((d) => d.type === "vacuum"))
        drop(e.x + rand(-6, 6), e.y + rand(-6, 6), "vacuum", 0);
      if (Math.random() < 0.14) {
        // wages and pizza each get their own value (they used to share one roll, so pizza sometimes healed 2)
        if (Math.random() < 0.55) drop(e.x + rand(-8, 8), e.y + rand(-8, 8), "wage", Math.random() < 0.55 ? 2 : 20);
        // v17: during the final-boss fight the screen is packed with mobs, so 75% of pizza drops are skipped
        else if (!state.enemies.some((b) => b.bossId === finalBossId()) || Math.random() < 0.25) drop(e.x + rand(-8, 8), e.y + rand(-8, 8), "pizza", pizzaHeal());
      }
      sfx("mob_death", 1, () => audioBeep(115 + Math.random() * 90, 0.055, "triangle", 0.02));
    }
  }
  const VACUUM_CHANCE = 1 / 280;
  // v8 pickup art: tiny pixel sprites built once, each with an automatic dark outline, drawn at 2x nearest-neighbour.
  function makeIcon(w, h, mask, color, outline = "#1a0f08") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d"),
      m = (i, j) => i >= 0 && j >= 0 && i < w && j < h && mask(i, j);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let col = null;
        if (m(i, j)) col = color(i, j);
        else if (m(i - 1, j) || m(i + 1, j) || m(i, j - 1) || m(i, j + 1)) col = outline;
        if (col) {
          x.fillStyle = col;
          x.fillRect(i, j, 1, 1);
        }
      }
    return c;
  }
  const PEPPERONI = [[4.5, 4.5], [9.5, 5], [5, 9.5], [9.5, 10], [7.2, 7.2]];
  // v16: XP gems (diamond-cut, 3 tiers by value) so experience never looks like money. Wages = gold coins.
  const GEM_PAL = [
    ["#e4f6ff", "#59b4ff", "#2a6fd0", "#173c8a"], // small (1-3 XP): blue
    ["#e2ffe6", "#4ee07a", "#1f9a44", "#0e5a26"], // medium (4-6 XP): green
    ["#f8e4ff", "#c46cff", "#7a2cc4", "#45127a"], // large (7+ XP): purple
  ];
  const makeGem = (pal) =>
    makeIcon(9, 11, (i, j) => Math.abs(i - 4) / 4.6 + Math.abs(j - 4) / (j <= 4 ? 4.4 : 6.2) <= 1, (i, j) => {
      if (j <= 1 && i >= 3 && i <= 4) return pal[0]; // glint
      if (j === 3) return i < 4 ? pal[0] : pal[1]; // girdle line
      if (j < 3) return i <= 4 ? pal[1] : pal[2]; // crown facets
      return i < 4 ? pal[1] : i === 4 ? pal[2] : pal[3]; // pavilion: lit left, shaded right
    }, "#0b0816");
  const gemTier = (v) => (v >= 7 ? 2 : v >= 4 ? 1 : 0);
  const ICONS = {
    // v8 coin art; since v16 it is the WAGES pickup (XP is gems)
    coin: makeIcon(10, 10, (i, j) => Math.hypot(i - 4.5, j - 4.5) <= 3.9, (i, j) => {
      const d = Math.hypot(i - 4.5, j - 4.5);
      if ((i === 3 || i === 4) && j === 3) return "#fff6c0";
      if (i === 3 && j === 4) return "#fff6c0";
      if (d > 3) return "#c8861f";
      if ((i === 4 || i === 5) && j >= 4 && j <= 5) return "#b8781c";
      return "#f7c948";
    }),
    // Wages: folded green paycheck/banknote, clearly not round or gold
    bill: makeIcon(14, 9, (i, j) => i >= 1 && i <= 12 && j >= 1 && j <= 7, (i, j) => {
      const d = Math.hypot((i - 6.5) / 1.6, j - 4);
      if (i === 1 || i === 12 || j === 1 || j === 7) return "#2f8a45";
      if (d < 1.3) return "#d6ffd8";
      if (d < 2.2) return "#2a7a3e";
      return (i + j) % 5 === 0 ? "#5ccf74" : "#46b462";
    }, "#0d2a14"),
    // Health: a whole pepperoni pizza pie
    pizza: makeIcon(15, 15, (i, j) => Math.hypot(i - 7, j - 7) <= 6.6, (i, j) => {
      const d = Math.hypot(i - 7, j - 7);
      if (d > 5.2) return j < 7 ? "#e0a050" : "#b8762e";
      for (const [px, py] of PEPPERONI) {
        const pd = Math.hypot(i - px, j - py);
        if (pd <= 1.3) return i < px && j < py ? "#e8604f" : "#b8302a";
      }
      if (i === 7 || j === 7 || i === j || i + j === 14) return "#e3aa3a";
      return (i * 7 + j * 3) % 9 === 0 ? "#fff0a8" : "#ffd65a";
    }),
    // Vacuum: red horseshoe magnet with silver tips
    gem1: makeGem(GEM_PAL[0]),
    gem2: makeGem(GEM_PAL[1]),
    gem3: makeGem(GEM_PAL[2]),
    magnet: makeIcon(14, 14, (i, j) => {
      if (j <= 6) {
        const d = Math.hypot(i - 6.5, j - 6.5);
        return d >= 2.6 && d <= 6.2;
      }
      return (i >= 1 && i <= 3) || (i >= 10 && i <= 12) ? j <= 12 : false;
    }, (i, j) => {
      if (j >= 10) return j === 10 ? "#9aa3ad" : "#e8edf2";
      return i <= 3 || (j <= 2 && i < 7) ? "#ff6a5a" : "#d22a2a";
    }),
  };
  // Pizza: a flat 5 HP, plus 3 per level of the office's Extra Cheese perk
  const PIZZA_BASE = 5,
    PIZZA_PER_CHEESE = 3;
  function pizzaHeal() {
    return PIZZA_BASE + PIZZA_PER_CHEESE * Math.min(PERK_MAX.cheese, save.perks.cheese || 0);
  }
  function drop(x, y, type, value) {
    state.drops.push({ x, y, type, value, r: type === "xp" ? 5 : type === "vacuum" ? 10 : 8, phase: Math.random() * TAU });
  }
  // Vacuum: one-shot. Every loose ground pickup that exists right now (XP, wages, pizza) is pulled to Hog and
  // collected through the normal pickup code. Fixed starting treasures (state.rewards) are never affected.
  function triggerVacuum(x, y) {
    let n = 0;
    for (const d of state.drops)
      if (d.type !== "vacuum" && !d.pulled) {
        d.pulled = true;
        d.pullV = 60 + Math.random() * 40;
        n++;
      }
    state.vacuumFx = { x, y, t: 0 };
    state.vacuums = (state.vacuums || 0) + 1;
    toastMsg(n ? `GHOST VACUUM! Sucking up ${n} pickups.` : "GHOST VACUUM! ...nothing to suck up. Nice.");
    sfx("vacuum", 1, () => (audioBeep(220, 0.5, "sawtooth", 0.03), audioBeep(440, 0.35, "sine", 0.03)));
    return n;
  }
  function collectDrop(d) {
    const p = state.player;
    const i = state.drops.indexOf(d);
    if (i < 0) return; // already collected: a pickup can only pay out once
    state.drops.splice(i, 1);
    if (d.type === "xp") awardXP(d.value);
    else if (d.type === "wage") {
      save.wages += d.value;
      state.earned += d.value;
      saveGame();
    } else if (d.type === "vacuum") triggerVacuum(d.x, d.y);
    else {
      const heal = pizzaHeal(); // read at pickup so an office upgrade bought mid-shift counts right away
      p.hp = Math.min(p.maxHp, p.hp + heal);
      toastMsg(`PIZZA TIME. +${heal} health.`);
    }
    state.collected = state.collected || { xp: 0, wage: 0, pizza: 0, vacuum: 0 };
    state.collected[d.type] = (state.collected[d.type] || 0) + 1;
    // v16: XP gems chime (higher), wage coins / pizza use the (now 80% quieter) pickup sound
    if (d.type === "xp") sfx("gem", 1, () => audioBeep(900, 0.05, "triangle", 0.012));
    else if (d.type !== "vacuum") sfx("pickup", d.type === "pizza" ? 1.2 : 1, () => audioBeep(360, 0.05, "triangle", 0.02));
  }
  function updateDrops(dt) {
    const p = state.player;
    for (const d of [...state.drops]) {
      d.phase += dt * 3;
      const dd = dist(p, d);
      if (d.pulled) {
        // visible flight toward Hog, accelerating
        d.pullV = Math.min(900, d.pullV + 700 * dt);
        const l = Math.max(1, dd),
          step = Math.min(dd, d.pullV * dt);
        d.x += ((p.x - d.x) / l) * step;
        d.y += ((p.y - d.y) / l) * step;
        if (Math.random() < 0.35) state.particles.push({ x: d.x, y: d.y, vx: 0, vy: 0, life: 0.18, max: 0.18, color: "#7fffe0", r: 2, float: true });
      } else if (dd < p.magnet) {
        const l = Math.max(1, dd);
        d.x += ((p.x - d.x) / l) * (210 + Math.max(0, p.magnet - dd) * 3) * dt;
        d.y += ((p.y - d.y) / l) * (210 + Math.max(0, p.magnet - dd) * 3) * dt;
      }
      if (dist(p, d) < p.r + p.r + 10) collectDrop(d);
    }
    if (state.vacuumFx) {
      state.vacuumFx.t += dt;
      if (state.vacuumFx.t > 0.9 && !state.drops.some((d) => d.pulled)) state.vacuumFx = null;
    }
  }
  function updateParticles(dt) {
    for (const d of [...state.deaths]) {
      d.age += dt;
      if (d.age > (d.burn ? 0.7 : d.boss ? 1.4 + (d.hold || 0) : d.s2 ? 1.1 : 0.48)) state.deaths.splice(state.deaths.indexOf(d), 1);
    }
    for (const part of [...state.particles]) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      if (!part.float) part.vy += 120 * dt;
      part.life -= dt;
      if (part.life <= 0) state.particles.splice(state.particles.indexOf(part), 1);
    }
  }
  const STAGE1_HP_RAMP = 220; // seconds per +100% enemy health on Stage 1 (lower = tougher monsters later in the shift)
  function addEnemy(type, bossId = null) {
    const p = state.player;
    if (bossId) {
      const def = BOSS[bossId],
        arena = WORLD.arenas[bossId];
      state.enemies.push({
        x: arena.x,
        y: arena.y,
        engaged: false,
        lureT: 0,
        hp: def.hp,
        maxHp: def.hp,
        r: def.r,
        speed: def.speed || (bossId === "digger" ? 43 : bossId === "widow" ? 52 : 48),
        color: def.color,
        damage: def.damage || (bossId === "king" ? 20 : 15),
        s2: !!def.s2,
        type: bossId,
        boss: true,
        bossId,
        name: def.name,
        vx: 0,
        vy: 0,
        attack: 0,
        phase: 0,
        xp: 0,
      });
      state.bosses++;
      state.bossesSpawned[bossId] = true;
      state.lastBoss = bossId;
      state.eventText = def.name;
      state.eventUntil = state.t + 5;
      { const db = dexBook().b; if (db[bossId] === undefined) db[bossId] = 0; } // compendium: met this boss
      toastMsg(`${def.name} is waiting at the ${arena.label}! — ${def.taunt}`);
      sfx(BOSS_ENTRY_SFX[bossId] || "boss_roar_entrance", 1, () => audioBeep(82, 0.45, "sawtooth", 0.06));
      return;
    }
    const def = typesFor()[type];
    // Health ramps over the shift. Stage 1 ramps much harder (testers could stand still and win): ~2.6x at 3 AM,
    // ~3.7x at 5 AM, ~4.3x at 6 AM. Stage 2 keeps its original curve (~2.4x by 6 AM).
    const scale = 1 + state.t / (STAGE === 1 ? STAGE1_HP_RAMP : 520);
    const spot = findSpawnPoint();
    if (!spot) return; // no valid reachable cell this tick — skip rather than spawn inside scenery
    { const de = dexBook().e; if (de[type] === undefined) de[type] = 0; } // compendium: met this monster
    state.enemies.push({
      x: spot.x,
      y: spot.y,
      lastX: spot.x,
      lastY: spot.y,
      stuckT: 0,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      r: def.r,
      speed: def.speed * (1 + state.t / 1200),
      color: def.color,
      damage: def.damage,
      xp: def.xp,
      type,
      name: def.name,
      vx: 0,
      vy: 0,
      attack: rand(0.3, 1.5),
      phase: Math.random() * TAU,
      s2: !!def.s2,
      fly: !!def.fly,
      size: def.size || 64,
    });
  }
  function awardXP(amount) {
    const p = state.player;
    p.xp += amount * (1 + save.perks.xp * 0.05) * (state.limitless ? LIMITLESS_XP : 1);
    while (p.xp >= p.nextXp) {
      p.xp -= p.nextXp;
      p.level++;
      p.nextXp = Math.floor(p.nextXp * 1.3 + 5);
      pendingLevelUps++;
    }
    if (state.sunrise) pendingLevelUps = 0; // XP still counts; no pop-ups during the sunrise cinematic
    if (pendingLevelUps && mode === "playing") showLevelUp();
  }
  // =====================================================================================
  //  v14: 19 new weapons (random pool, 5-slot cap), hit splatters, Stage 2 cold fog + map edge shade
  // =====================================================================================
  const MAX_SLOTS = 5,
    WMAX_BASE = 5, // weapon max level before Limit Break (office perk adds up to +3)
    STAT_IDS = ["maxhp", "regen", "damage", "speed", "magnet"],
    STAT_MAX = 6;
  const NW_IDS = ["molotov", "deadanomicon", "beartrap", "boomerang", "coffin", "chains", "rockets", "flyswatter", "flies", "tombstone", "gnome", "soda", "whistle", "cleaver", "gsprinkler", "witchjar", "bell", "dust", "lastnail"];
  const NW = {
    molotov: ["Molotov Cocktail", "Lobs a burning bottle that leaves a fire patch on the floor.", "Wider, longer fire; an extra bottle at L3 and L5"],
    deadanomicon: ["The Deadanomicon", "Opens mini black holes that swallow ordinary monsters whole. Bosses resist.", "More black holes, shorter cooldown"],
    beartrap: ["Rusty Bear Traps", "Drops traps around Grave Hog that snap shut on monsters.", "More traps, harder bite, longer hold"],
    boomerang: ["Bone Boomerang", "A giant femur that hits on the way out AND on the way back.", "More bones, longer range, more damage"],
    coffin: ["Coffin Drop", "A coffin falls from the sky onto the biggest crowd.", "More coffins, bigger impact"],
    chains: ["Ghost Chains", "Spectral chains burst from the floor and hold monsters in place.", "More targets, longer hold"],
    rockets: ["Bottle Rockets", "Erratic fireworks zig-zag into monsters and pop.", "More rockets, bigger blasts"],
    flyswatter: ["Electric Flyswatter", "Zaps a monster; the arc jumps to its neighbours.", "More jumps, stronger shocks"],
    flies: ["Swarm of Flies", "A buzzing cloud around Grave Hog chews on anything close.", "Bigger swarm, more damage"],
    tombstone: ["Tombstone Slam", "Tombstones burst up from under monsters.", "More tombstones, bigger area"],
    gnome: ["Cursed Garden Gnome", "A possessed gnome runs off and stabs monsters on its own.", "More gnomes, faster stabbing"],
    soda: ["Soda Bomb", "Shaken cans burst into sticky, damaging foam that slows.", "More cans, bigger splash"],
    whistle: ["Death Whistle", "A sonic ring that damages and shoves monsters back.", "Bigger ring, harder shove"],
    cleaver: ["Haunted Meat Cleaver", "Spinning cleavers fly at the nearest monsters.", "More cleavers, then they pierce"],
    gsprinkler: ["Graveyard Sprinkler", "Rotating streams of corrosive water sweep all around Grave Hog.", "More streams, longer range"],
    witchjar: ["Witch's Jar", "Smashes into a cloud of poison bugs that hunts monsters.", "Bigger cloud, lasts longer"],
    bell: ["Funeral Bell", "A ghostly bell tolls, hurts every monster in a wide radius and sends them fleeing in terror (bosses don't scare).", "Wider radius, faster tolls, 1s more terror"],
    dust: ["Grave Dust", "A spreading dust cloud that slows and wears monsters down.", "Wider cloud, lasts longer"],
    lastnail: ["The Last Nail", "Fires a huge spectral railroad spike through a whole line of monsters.", "More spikes, pierces more"],
  };
  for (const id of NW_IDS)
    UPGRADES.push({ id, title: NW[id][0], desc: NW[id][1], up: NW[id][2], apply: (s) => (s.weapons[id].level = Math.min(wmax(), s.weapons[id].level + 1)) });
  const OLD_ICON = { shovel: 0, nail: 1, sprinkler: 2, chainsaw: 3, lantern: 4 };
  const FALLBACK_UPS = [
    { id: "fb_heal", title: "Overtime Snack", desc: "Every weapon and perk is maxed. Heal 40% of your health.", apply: (s) => (s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * 0.4)) },
    {
      id: "fb_cash",
      title: "Hazard Pay",
      desc: "Every weapon and perk is maxed. +15 wages, banked now.",
      apply: (s) => {
        save.wages += 15;
        s.earned += 15;
        saveGame();
      },
    },
  ];
  const SPLAT_TINT = {
    // green: pumpkins/produce, ghosts and magic undead; red: flesh (zombies, hands, rats); black: machines
    zombie: "red", skeleton: "green", hand: "red", ghost: "green", worm: "red", keeper: "red",
    shopper_zombie: "red", cashier_corpse: "red", stock_clerk: "red", forklift_zombie: "red", rat_swarm: "red",
    mutated_produce: "green", cleaning_bot: "black", security_drone: "black",
    digger: "red", widow: "green", king: "green", produce_horror: "green", cart_beast: "green", meat_manager: "red",
  };
  const splatTint = (e) => SPLAT_TINT[e.boss ? e.bossId : e.type] || "red";
  function initWeapons2(s) {
    for (const id of NW_IDS) s.weapons[id] = { level: 0, cd: 0.6 };
    s.slots = ["shovel"];
    s.wfx = [];
    s.splats = [];
    s.gnomes = [];
    s.statPicks = {};
    s.splatStats = { spawned: 0, skipped: 0 };
  }
  const CLEAVER_SIZE = 30, // v15: 25% bigger than v14 (24px) ...
    CLEAVER_HIT_R = 10; // ... and the hit radius scaled with it (was 8)
  const COFFIN_HIT_T = 0.55, // v15 Coffin Drop: falls for 0.55 s, lands, lingers, then sinks away
    COFFIN_LIFE = 1.6,
    coffinRadius = (L) => 56 + 10 * L; // was 44 + 9L; matches the bigger coffin and dust ring
  const ALL_WEAPONS = () => ["shovel", "nail", "sprinkler", "chainsaw", "lantern", ...NW_IDS];
  function syncSlots() {
    if (!state.slots) initWeapons2(state);
    for (const id of ALL_WEAPONS()) if (state.weapons[id]?.level > 0 && !state.slots.includes(id)) state.slots.push(id);
    const dw = dexBook().w;
    for (const id of state.slots) dw[id] = 1; // compendium: weapons you've used
    return state.slots;
  }
  function getAvailableUpgrades() {
    const full = syncSlots().length >= MAX_SLOTS;
    return UPGRADES.filter((u) => {
      if (state.banished?.includes(u.id)) return false;
      if (STAT_IDS.includes(u.id)) return (state.statPicks?.[u.id] || 0) < STAT_MAX;
      const w = state.weapons[u.id];
      if (!w || w.level >= wmax()) return false;
      return w.level > 0 || !full;
    });
  }
  function pickChoices(available) {
    const lv = (u) => state.weapons[u.id]?.level,
      ups = available.filter((u) => lv(u) > 0),
      news = available.filter((u) => lv(u) === 0),
      out = [],
      take = (arr) => {
        const pool = arr.filter((u) => !out.includes(u));
        if (pool.length) out.push(pick(pool));
      };
    take(ups);
    take(news);
    while (out.length < Math.min(3, available.length)) take(available);
    return out.sort(() => Math.random() - 0.5);
  }
  function upgradeLabel(u) {
    const w = state.weapons[u.id];
    if (!w) return u.id.startsWith("fb_") ? "BONUS" : `PERK ${(state.statPicks?.[u.id] || 0) + 1}/${STAT_MAX}`;
    return w.level ? `LV ${w.level} → ${w.level + 1}${w.level + 1 === wmax() ? " (MAX)" : ""}` : "NEW WEAPON";
  }
  // ---------- helpers ----------
  function enemiesIn(x, y, r) {
    const out = [];
    for (const e of state.enemies) if (Math.hypot(e.x - x, e.y - y) < r + e.r && inReach(e)) out.push(e);
    return out;
  }
  function randomEnemyNear(r) {
    const p = state.player,
      c = [];
    for (const e of state.enemies) if (Math.abs(e.x - p.x) < r && Math.abs(e.y - p.y) < r && dist(p, e) < r && inReach(e)) c.push(e);
    return c.length ? pick(c) : null;
  }
  function densestNear(r, rad = 70) {
    const p = state.player,
      c = [];
    for (const e of state.enemies) if (dist(p, e) < r && inReach(e)) c.push(e);
    if (!c.length) return null;
    let best = c[0],
      bn = -1;
    for (let k = 0; k < Math.min(12, c.length); k++) {
      const e = pick(c);
      let n = 0;
      for (const o of c) if (Math.abs(o.x - e.x) < rad && Math.abs(o.y - e.y) < rad) n++;
      if (n > bn) ((bn = n), (best = e));
    }
    return best;
  }
  const wdmg = (base) => base * state.player.damage;
  function hitStatus(e, stun, slowT, slowK) {
    if (stun) e.stun = Math.max(e.stun || 0, e.boss ? stun * 0.25 : stun);
    if (slowT) {
      const k = e.boss ? Math.max(slowK, 0.75) : slowK;
      e.slowK = e.slowT > 0 && e.slowK ? Math.min(e.slowK, k) : k;
      e.slowT = Math.max(e.slowT || 0, slowT);
    }
  }
  function aoe(x, y, r, dmg, knock = 0, ex) {
    let n = 0;
    for (const e of enemiesIn(x, y, r)) {
      damageEnemy(e, dmg, false);
      if (knock && state.enemies.includes(e)) {
        const d = Math.hypot(e.x - x, e.y - y) || 1,
          k = e.boss ? knock * 0.2 : knock;
        e.vx += ((e.x - x) / d) * k;
        e.vy += ((e.y - y) / d) * k;
      }
      if (ex) ex(e);
      n++;
    }
    return n;
  }
  const fx = (o) => (state.wfx.length < 260 ? ((o.src = o.src || dmgSrc), state.wfx.push(o), o) : null); // remembers its weapon for the damage breakdown
  // ---------- per-frame weapon logic ----------
  function doAttack2(dt, wdt) {
    const p = state.player,
      W = state.weapons;
    syncSlots();
    for (const id of NW_IDS) {
      const w = W[id],
        L = w.level;
      if (!L) continue;
      dmgSrc = id;
      w.cd -= wdt;
      if (id === "flies") {
        w.tick = (w.tick || 0) - dt;
        if (w.tick <= 0) {
          w.tick = 0.3;
          aoe(p.x, p.y, 40 + 8 * L, wdmg((7 + 4 * L) * 0.3));
        }
        continue;
      }
      if (id === "gsprinkler") {
        w.tick = (w.tick || 0) - dt;
        if (w.tick <= 0) {
          w.tick = 0.2;
          // the water comes out of the hat on Hog's head, so the spray zone is centred up there, not on his body
          const [nx, ny] = hatNozzle(),
            ox = p.x + nx,
            oy = p.y + ny,
            n = 2 + Math.floor((L - 1) / 2),
            range = 80 + 16 * L,
            a0 = state.t * 2.1;
          for (const e of enemiesIn(ox, oy, range)) {
            const ea = Math.atan2(e.y - oy, e.x - ox);
            for (let k = 0; k < n; k++) {
              const a = a0 + (k * TAU) / n,
                d = Math.atan2(Math.sin(ea - a), Math.cos(ea - a));
              if (Math.abs(d) < 0.22) {
                damageEnemy(e, wdmg((16 + 5 * L) * 0.2), false);
                break;
              }
            }
          }
        }
        continue;
      }
      if (id === "gnome") {
        const want = Math.ceil(L / 2) + (L >= WMAX_BASE ? 1 : 0);
        while (state.gnomes.length < want) state.gnomes.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), cd: 0, stab: 0, face: 1, hits: 0 });
        continue;
      }
      if (w.cd > 0) continue;
      if (id === "molotov") {
        const n = 1 + (L >= 3) + (L >= 5);
        let fired = 0;
        for (let k = 0; k < n; k++) {
          const t = randomEnemyNear(260);
          if (!t) break;
          fx({ k: "bottle", x: p.x, y: p.y - 10, sx: p.x, sy: p.y - 10, tx: t.x + rand(-12, 12), ty: t.y + rand(-12, 12), t: 0, life: 0.6, L });
          fired++;
        }
        if (fired) ((w.cd = 2.6 - 0.2 * L), sfx("enemy_throw_whoosh", 0.7, () => audioBeep(260, 0.08, "triangle", 0.02)));
      } else if (id === "deadanomicon") {
        const n = 1 + Math.floor((L - 1) / 2);
        let fired = 0;
        for (let k = 0; k < n; k++) {
          const t = k ? randomEnemyNear(240) : densestNear(240);
          if (!t) break;
          fx({ k: "hole", x: t.x, y: t.y, t: 0, life: 2.2, L, kills: 0, cap: 5 + 2 * L, tick: 0 });
          fired++;
        }
        if (fired) ((w.cd = 8.5 - 0.7 * L), sfx("lantern_spell", 1.3, () => audioBeep(70, 0.35, "sine", 0.03)), (p.bookFx = 0.6));
      } else if (id === "beartrap") {
        const live = state.wfx.filter((f) => f.k === "trap").length,
          maxLive = 3 + 2 * L,
          n = Math.min(1 + Math.floor(L / 2), maxLive - live);
        for (let k = 0; k < n; k++) {
          // dropped on the approach path of a nearby monster (or a random spot when none is close)
          const t = randomEnemyNear(170),
            a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.3, 0.3) : rand(0, TAU),
            d = t ? Math.max(26, dist(p, t) * rand(0.45, 0.8)) : rand(40, 110);
          let x = p.x + Math.cos(a) * d,
            y = p.y + Math.sin(a) * d;
          if (solidAt(x, y)) ((x = p.x), (y = p.y + 14));
          fx({ k: "trap", x, y, t: 0, life: 14, L, snap: -1 });
        }
        w.cd = 2.8 - 0.25 * L;
      } else if (id === "boomerang") {
        const t = nearestEnemy(260);
        if (!t) continue;
        const n = 1 + Math.floor((L - 1) / 2),
          base = Math.atan2(t.y - p.y, t.x - p.x);
        for (let k = 0; k < n; k++) fx({ k: "bone", a: base + (k - (n - 1) / 2) * 0.5, t: 0, life: 1.25, range: 140 + 22 * L, L, hit: new Map(), x: p.x, y: p.y });
        w.cd = 1.9 - 0.12 * L;
        sfx("enemy_throw_whoosh", 0.8, () => audioBeep(330, 0.05, "triangle", 0.015));
      } else if (id === "coffin") {
        const n = 1 + Math.floor(L / 2);
        let fired = 0;
        for (let k = 0; k < n; k++) {
          const t = k ? randomEnemyNear(260) : densestNear(260);
          if (!t) break;
          fx({ k: "coffin", x: t.x + rand(-10, 10), y: t.y + rand(-10, 10), t: 0, life: COFFIN_LIFE, L, done: false, seed: rand(0, 6), spin: rand(-1, 1) });
          fired++;
        }
        if (fired) w.cd = 4.4 - 0.35 * L;
      } else if (id === "chains") {
        const n = 2 + L,
          c = state.enemies.filter((e) => dist(p, e) < 230).sort((a, b) => dist(p, a) - dist(p, b)).slice(0, n);
        if (!c.length) continue;
        for (const e of c) {
          hitStatus(e, 1.2 + 0.3 * L, 0, 0);
          fx({ k: "chain", e, x: e.x, y: e.y, t: 0, life: 1.2 + 0.3 * L, L, tick: 0 });
        }
        w.cd = 3.4 - 0.22 * L;
        sfx("chains", 1, () => audioBeep(180, 0.1, "square", 0.015));
      } else if (id === "rockets") {
        if (!nearestEnemy(280)) continue;
        const n = 2 + Math.floor((L - 1) / 2);
        for (let k = 0; k < n; k++) {
          const a = rand(0, TAU);
          fx({ k: "rocket", x: p.x, y: p.y - 8, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 60, t: 0, life: 1.4, L, seed: rand(0, 99) });
        }
        w.cd = 1.7 - 0.1 * L;
        sfx("nailgun_shot", 0.7, () => audioBeep(900, 0.05, "sawtooth", 0.01));
      } else if (id === "flyswatter") {
        let cur = nearestEnemy(160);
        if (!cur) continue;
        const pts = [[p.x, p.y - 6]],
          seen = new Set(),
          jumps = 2 + L;
        let dmg = wdmg(20 + 8 * L);
        for (let j = 0; j <= jumps && cur; j++) {
          seen.add(cur);
          pts.push([cur.x, cur.y - 6]);
          const was = cur;
          damageEnemy(cur, dmg, false);
          hitStatus(was, 0.15, 0, 0);
          dmg *= 0.9;
          let nb = null,
            bd = 95;
          for (const e of state.enemies)
            if (!seen.has(e)) {
              const d = Math.hypot(e.x - was.x, e.y - was.y);
              if (d < bd) ((bd = d), (nb = e));
            }
          cur = nb;
        }
        fx({ k: "zap", pts, t: 0, life: 0.18 });
        w.cd = 1.45 - 0.1 * L;
        sfx("laser_zap", 0.8, () => audioBeep(1200, 0.05, "square", 0.012));
      } else if (id === "tombstone") {
        const n = 2 + Math.floor((L - 1) / 2);
        let fired = 0;
        for (let k = 0; k < n; k++) {
          const t = randomEnemyNear(240);
          if (!t) break;
          fx({ k: "stone", x: t.x, y: t.y + 4, t: 0, life: 0.85, L, done: false });
          fired++;
        }
        if (fired) w.cd = 2.9 - 0.2 * L;
      } else if (id === "soda") {
        const n = 1 + Math.floor(L / 2);
        let fired = 0;
        for (let k = 0; k < n; k++) {
          const t = randomEnemyNear(230);
          if (!t) break;
          fx({ k: "can", x: p.x, y: p.y, sx: p.x, sy: p.y, tx: t.x, ty: t.y, t: 0, life: 0.75, L });
          fired++;
        }
        if (fired) w.cd = 2.3 - 0.15 * L;
      } else if (id === "whistle") {
        if (!nearestEnemy(120 + 18 * L)) continue;
        fx({ k: "ring", x: p.x, y: p.y, t: 0, life: 0.45, R: 105 + 18 * L, L, hit: new Set() });
        w.cd = 3.1 - 0.2 * L;
        sfx("whistle", 1, () => audioBeep(1500, 0.18, "sine", 0.02));
      } else if (id === "cleaver") {
        const c = state.enemies.filter((e) => dist(p, e) < 280).sort((a, b) => dist(p, a) - dist(p, b));
        if (!c.length) continue;
        const n = 1 + Math.floor((L - 1) / 2);
        for (let k = 0; k < n; k++) {
          const t = c[k % c.length],
            a = Math.atan2(t.y - p.y, t.x - p.x) + (k >= c.length ? 0.3 : 0);
          fx({ k: "cleaver", x: p.x, y: p.y - 6, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, t: 0, life: 1.0, L, pierce: Math.max(0, L - 2), hit: new Set() });
        }
        w.cd = 1.25 - 0.08 * L;
        sfx("enemy_throw_whoosh", 0.7, () => audioBeep(500, 0.04, "triangle", 0.012));
      } else if (id === "witchjar") {
        const t = nearestEnemy(240);
        if (!t) continue;
        fx({ k: "jar", x: p.x, y: p.y, sx: p.x, sy: p.y, tx: t.x, ty: t.y, t: 0, life: 0.55, L });
        w.cd = 5.2 - 0.4 * L;
      } else if (id === "bell") {
        const R = 130 + 26 * L;
        if (!nearestEnemy(R)) continue;
        aoe(p.x, p.y, R, wdmg(16 + 6 * L), 0);
        // v17: no knockback; every regular monster in range flees in terror for 1s per bell level (bosses don't scare)
        for (const e of enemiesIn(p.x, p.y, R)) {
          if (e.boss) continue;
          e.fearT = Math.max(e.fearT || 0, L);
          e.charge = null; // drop whatever they were winding up
          e.throwAt = 0;
          e.prime = 0;
        }
        fx({ k: "toll", x: p.x, y: p.y, t: 0, life: 0.8, R });
        w.cd = 4.6 - 0.45 * L;
        sfx("bell_toll", 1, () => audioBeep(196, 0.6, "sine", 0.035));
      } else if (id === "dust") {
        const t = densestNear(180) || nearestEnemy(180);
        if (!t) continue;
        fx({ k: "dust", x: (t.x + p.x) / 2, y: (t.y + p.y) / 2, t: 0, life: 3 + 0.8 * L, R: 60 + 12 * L, L, tick: 0 });
        w.cd = 4.2 - 0.3 * L;
      } else if (id === "lastnail") {
        const t = nearestEnemy(320);
        if (!t) continue;
        const n = 1 + Math.floor((L - 1) / 2),
          base = Math.atan2(t.y - p.y, t.x - p.x);
        for (let k = 0; k < n; k++) {
          const a = base + (k - (n - 1) / 2) * 0.22;
          fx({ k: "spike", x: p.x, y: p.y - 6, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, a, t: 0, life: 0.9, L, pierce: 3 + 2 * L, hit: new Set() });
        }
        w.cd = 2.7 - 0.2 * L;
        sfx("nailgun_shot", 1.3, () => audioBeep(140, 0.12, "sawtooth", 0.02));
      }
    }
    updateGnomes(dt);
    updateWfx(dt);
    if (p.bookFx) p.bookFx = Math.max(0, p.bookFx - dt);
  }
  function updateGnomes(dt) {
    const p = state.player,
      L = state.weapons.gnome.level;
    if (!L) return (state.gnomes.length = 0);
    for (const gn of state.gnomes) {
      gn.cd -= dt;
      gn.stab = Math.max(0, gn.stab - dt);
      if (Math.hypot(gn.x - p.x, gn.y - p.y) > 320) ((gn.x = p.x + rand(-16, 16)), (gn.y = p.y + rand(-16, 16)));
      let t = null,
        bd = 260;
      for (const e of state.enemies) {
        const d = Math.hypot(e.x - gn.x, e.y - gn.y);
        if (d < bd && dist(p, e) < 300) ((bd = d), (t = e));
      }
      const tx = t ? t.x : p.x + 26,
        ty = t ? t.y : p.y + 10,
        d = Math.hypot(tx - gn.x, ty - gn.y) || 1;
      if (t && d < t.r + 12) {
        if (gn.cd <= 0) {
          gn.cd = 0.8 - 0.09 * L;
          gn.stab = 0.15;
          gn.hits++;
          damageEnemy(t, wdmg(14 + 5 * L), false);
        }
      } else if (d > 6) {
        const sp = 150 * dt;
        moveCircle(gn, ((tx - gn.x) / d) * sp, ((ty - gn.y) / d) * sp, 6);
        gn.face = tx < gn.x ? -1 : 1;
      }
    }
  }
  function updateWfx(dt) {
    const keep = [];
    for (const f of state.wfx) {
      f.t += dt;
      dmgSrc = f.src || "other";
      const k = f.k,
        L = f.L;
      if (k === "bottle" || k === "can" || k === "jar") {
        const u = Math.min(1, f.t / f.life);
        f.x = f.sx + (f.tx - f.sx) * u;
        f.y = f.sy + (f.ty - f.sy) * u;
        f.z = Math.sin(u * Math.PI) * (k === "can" ? 18 : 42);
        if (u >= 1) {
          if (k === "bottle") fx({ k: "fire", x: f.tx, y: f.ty, t: 0, life: 2.4 + 0.5 * L, R: 30 + 7 * L, L, tick: 0 });
          else if (k === "can") {
            const R = 34 + 8 * L;
            aoe(f.tx, f.ty, R, wdmg(15 + 6 * L), 40, (e) => hitStatus(e, 0, 1.6, 0.55));
            fx({ k: "foam", x: f.tx, y: f.ty, t: 0, life: 0.7, R });
            sfx("gas_hiss", 0.9, () => audioBeep(620, 0.12, "triangle", 0.018));
          } else fx({ k: "bugs", x: f.tx, y: f.ty, t: 0, life: 3 + 0.9 * L, R: 26 + 5 * L, L, tick: 0 });
          continue;
        }
      } else if (k === "fire" || k === "dust" || k === "bugs") {
        f.tick -= dt;
        if (k === "bugs") {
          const t = enemiesIn(f.x, f.y, 200).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
          if (t) {
            const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
            f.x += ((t.x - f.x) / d) * Math.min(d, 75 * dt);
            f.y += ((t.y - f.y) / d) * Math.min(d, 75 * dt);
          }
        }
        const R = k === "dust" ? 22 + (f.R - 22) * Math.min(1, f.t / 1.2) : f.R;
        f.cur = R;
        if (f.tick <= 0) {
          f.tick = 0.25;
          const dps = k === "fire" ? 9 + 3 * L : k === "dust" ? 7 + 2.5 * L : 11 + 3 * L;
          aoe(f.x, f.y, R, wdmg(dps * 0.25), 0, k === "dust" ? (e) => hitStatus(e, 0, 0.5, 0.5) : null);
        }
      } else if (k === "hole") {
        f.tick -= dt;
        const pullR = 115 + 8 * L,
          strength = 170;
        for (const e of enemiesIn(f.x, f.y, pullR)) {
          const dx = f.x - e.x,
            dy = f.y - e.y,
            d = Math.hypot(dx, dy) || 1;
          if (e.boss) continue;
          if (d < 20 && f.kills < f.cap) {
            f.kills++;
            e.vacuumed = true;
            damageEnemy(e, e.hp + 1, false); // swallowed whole
            continue;
          }
          const s = Math.min(d, strength * dt * (1.4 - d / pullR));
          if (e.fly || e.type === "ghost") ((e.x += (dx / d) * s), (e.y += (dy / d) * s));
          else moveCircle(e, (dx / d) * s, (dy / d) * s, Math.min(e.r, 11));
        }
        if (f.tick <= 0) {
          f.tick = 0.25;
          for (const e of enemiesIn(f.x, f.y, 60)) if (e.boss) damageEnemy(e, wdmg((6 + 2 * L) * 0.25), false); // bosses resist: no pull, no swallow, light damage only
        }
      } else if (k === "trap") {
        if (f.snap < 0) {
          const e = state.enemies.find((e) => Math.hypot(e.x - f.x, e.y - f.y) < e.r + 10);
          if (e) {
            f.snap = f.t;
            f.life = f.t + 0.7;
            damageEnemy(e, wdmg(38 + 15 * L), false);
            if (state.enemies.includes(e)) hitStatus(e, 1.0 + 0.35 * L, 0, 0);
            sfx("shovel_hit", 0.8, () => audioBeep(240, 0.06, "square", 0.025));
          }
        }
      } else if (k === "bone") {
        const p = state.player,
          u = f.t / f.life,
          r = Math.sin(u * Math.PI) * f.range,
          leg = u < 0.5 ? 0 : 1;
        f.x = p.x + Math.cos(f.a) * r;
        f.y = p.y + Math.sin(f.a) * r * 0.85;
        for (const e of enemiesIn(f.x, f.y, 16))
          if (f.hit.get(e) !== leg) {
            f.hit.set(e, leg);
            damageEnemy(e, wdmg(18 + 7 * L), true);
          }
      } else if (k === "coffin" || k === "stone") {
        const hitAt = k === "coffin" ? COFFIN_HIT_T : 0.12;
        if (!f.done && f.t >= hitAt) {
          f.done = true;
          const R = k === "coffin" ? coffinRadius(L) : 26 + 6 * L;
          aoe(f.x, f.y, R, wdmg(k === "coffin" ? 38 + 14 * L : 22 + 8 * L), k === "coffin" ? 140 : 60, k === "stone" ? (e) => hitStatus(e, 0.35, 0, 0) : null);
          f.R = R;
          shake = Math.max(shake, k === "coffin" ? 8 : 2);
          addParticle(f.x, f.y, "#6a5a48", k === "coffin" ? 22 : 8);
          if (k === "coffin") state.coffinLandings = (state.coffinLandings || 0) + 1;
          sfx("slam_impact", k === "coffin" ? 1 : 0.55, () => audioBeep(k === "coffin" ? 80 : 120, 0.12, "square", 0.03));
        }
      } else if (k === "chain") {
        if (!state.enemies.includes(f.e)) continue;
        f.x = f.e.x;
        f.y = f.e.y;
        f.tick -= dt;
        if (f.tick <= 0) ((f.tick = 0.3), damageEnemy(f.e, wdmg((10 + 4 * L) * 0.3), false));
      } else if (k === "rocket") {
        const t = enemiesIn(f.x, f.y, 260).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
        if (t && f.t > 0.15) {
          const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
          f.vx += ((t.x - f.x) / d) * 900 * dt;
          f.vy += ((t.y - f.y) / d) * 900 * dt;
        }
        const wob = Math.sin(f.t * 22 + f.seed) * 260 * dt;
        f.vx += -f.vy * wob * 0.01;
        f.vy += f.vx * wob * 0.01;
        const sp = Math.hypot(f.vx, f.vy) || 1,
          max = 260;
        if (sp > max) ((f.vx *= max / sp), (f.vy *= max / sp));
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (enemiesIn(f.x, f.y, 6).length || f.t >= f.life || solidAt(f.x, f.y)) {
          const R = 28 + 7 * L;
          aoe(f.x, f.y, R, wdmg(13 + 5 * L), 50);
          fx({ k: "pop", x: f.x, y: f.y, t: 0, life: 0.35, R, seed: f.seed });
          continue;
        }
      } else if (k === "cleaver" || k === "spike") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (k === "cleaver" && solidAt(f.x, f.y)) continue;
        let dead = false;
        for (const e of enemiesIn(f.x, f.y, k === "spike" ? 10 : CLEAVER_HIT_R))
          if (!f.hit.has(e)) {
            f.hit.add(e);
            damageEnemy(e, wdmg(k === "spike" ? 48 + 16 * L : 22 + 8 * L), k === "cleaver");
            if (f.pierce-- <= 0) {
              dead = true;
              break;
            }
          }
        if (dead) continue;
      } else if (k === "ring") {
        const r = (f.t / f.life) * f.R;
        f.r = r;
        for (const e of enemiesIn(f.x, f.y, r))
          if (!f.hit.has(e)) {
            f.hit.add(e);
            damageEnemy(e, wdmg(16 + 6 * L), false);
            if (state.enemies.includes(e)) {
              const d = Math.hypot(e.x - f.x, e.y - f.y) || 1,
                kb = (150 + 45 * L) * (e.boss ? 0.25 : 1);
              e.vx += ((e.x - f.x) / d) * kb;
              e.vy += ((e.y - f.y) / d) * kb;
            }
          }
      }
      if (f.t < f.life) keep.push(f);
    }
    state.wfx = keep;
    // splatters age out
    if (state.splats.length) state.splats = state.splats.filter((s) => (s.t += dt) < s.life);
  }
  // ---------- hit splatters (throttled) ----------
  const SPLAT_CAP = 40;
  const SPLAT_SCALE = 0.5; // v15: the user asked for the splatters at half size
  // v15 boss sounds, from the labels in the user's SFX pack
  const BOSS_DEATH_SFX = { digger: "boss_death_groan", king: "boss_death_groan", meat_manager: "boss_death_groan", produce_horror: "boss_death_monster", cart_beast: "boss_death_monster", widow: "boss_death_scream" };
  const BOSS_ENTRY_SFX = { digger: "boss_laugh_entrance", king: "boss_roar_entrance_deep", meat_manager: "boss_laugh_entrance", produce_horror: "boss_roar_entrance", cart_beast: "boss_roar_entrance", widow: "boss_laugh_entrance_high" };
  function spawnSplat(e, big = false) {
    if (!state.splats) return;
    if (!big && ((e.splatAt && state.t - e.splatAt < 0.22) || state.splats.length >= SPLAT_CAP)) {
      state.splatStats.skipped++;
      return;
    }
    if (big && state.splats.length >= SPLAT_CAP + 12) return;
    e.splatAt = state.t;
    state.splatStats.spawned++;
    state.splats.push({ x: e.x + rand(-4, 4), y: e.y - (e.boss ? 22 : 8) + rand(-4, 4), c: splatTint(e), i: Math.floor(rand(0, 30)), t: 0, life: big ? 0.55 : 0.36, s: (e.boss ? 76 : Math.max(30, e.r * 2.6)) * (big ? 1.5 : 1) * SPLAT_SCALE, flip: Math.random() < 0.5 });
  }
  function drawSplats(camX, camY) {
    for (const s of state.splats) {
      const im = IMAGES["splat_" + s.c];
      if (!ready(im)) continue;
      const u = s.t / s.life,
        sz = Math.round(s.s * (0.6 + 0.5 * Math.min(1, u * 3))),
        x = Math.round(s.x - camX),
        y = Math.round(s.y - camY);
      g.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      g.save();
      g.translate(x, y);
      if (s.flip) g.scale(-1, 1);
      g.drawImage(im, (s.i % 6) * 64, Math.floor(s.i / 6) * 64, 64, 64, -sz / 2, -sz / 2, sz, sz);
      g.restore();
    }
    g.globalAlpha = 1;
  }
  // ---------- rendering ----------
  function spr(id, x, y, size, rot = 0, flip = false, alpha = 1) {
    const im = IMAGES.wpn2;
    if (!ready(im)) return false;
    const i = NW_IDS.indexOf(id);
    g.save();
    g.globalAlpha = alpha;
    g.translate(Math.round(x), Math.round(y));
    if (rot) g.rotate(rot);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, i * 64, 0, 64, 64, -size / 2, -size / 2, size, size);
    g.restore();
    return true;
  }
  function pxCircle(x, y, r, color, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(Math.round(x), Math.round(y), r, r * 0.62, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  function drawWeapons2(camX, camY, hx, hy) {
    const hxBody = hx,
      hyBody = hy;
    // Funeral Bell terror: a shaking "!" over every fleeing monster
    for (const e of state.enemies)
      if (e.fearT > 0) {
        const x = Math.round(e.x - camX + Math.sin(state.t * 40 + e.phase) * 1.5),
          y = Math.round(e.y - camY - (e.s2 ? 56 : 46));
        g.fillStyle = "#120c08";
        g.fillRect(x - 2, y - 1, 6, 12);
        g.fillStyle = "#fff4d8";
        g.fillRect(x - 1, y, 4, 6);
        g.fillRect(x - 1, y + 8, 4, 2);
      }
    const T = state.t,
      p = state.player,
      W = state.weapons;
    // ground layer first
    for (const f of state.wfx) {
      const x = f.x - camX,
        y = f.y - camY;
      if (f.k === "fire" && ready(IMAGES.fire)) {
        // v16: the user's 4-frame fire sheet, sized to the burn radius (hit area = circle of radius R)
        const fade = Math.min(1, (f.life - f.t) / 0.4, f.t / 0.1),
          fr = (Math.floor(T * 10 + (f.x | 0)) % 4 + 4) % 4,
          dw = Math.round(f.R * 2.3),
          dh = Math.round((dw * 72) / 112);
        pxCircle(x, y, f.R, "#5a1a08", 0.28 * fade);
        g.globalAlpha = fade;
        g.drawImage(IMAGES.fire, fr * 112, 0, 112, 72, Math.round(x - dw / 2), Math.round(y + f.R * 0.55 - dh), dw, dh);
        g.globalAlpha = 1;
        f.drawnFrame = fr;
      } else if (f.k === "fire") {
        const fade = Math.min(1, (f.life - f.t) / 0.4);
        pxCircle(x, y, f.R, "#5a1a08", 0.35 * fade);
        for (let i = 0; i < 14; i++) {
          const a = i * 2.39996 + f.x,
            rr = f.R * (0.15 + ((i * 37) % 10) / 12),
            fl = Math.sin(T * 14 + i * 3) * 0.5 + 0.5,
            fxp = x + Math.cos(a) * rr,
            fyp = y + Math.sin(a) * rr * 0.6;
          g.globalAlpha = fade;
          g.fillStyle = fl > 0.6 ? "#ffe07a" : fl > 0.3 ? "#ff9a2a" : "#e2441a";
          g.fillRect(Math.round(fxp) - 2, Math.round(fyp - 3 - fl * 6), 4, Math.round(4 + fl * 6));
        }
        g.globalAlpha = 1;
      } else if (f.k === "dust") {
        const fade = Math.min(1, (f.life - f.t) / 0.6, f.t / 0.3);
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7 + T * 0.4 * (i % 2 ? 1 : -1),
            rr = (f.cur || f.R) * (0.25 + (i % 3) * 0.28);
          pxCircle(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.4, (f.cur || f.R) * 0.45, i % 2 ? "#8f8498" : "#b4a8a0", 0.13 * fade);
        }
      } else if (f.k === "hole") {
        const u = f.t / f.life,
          s = Math.min(1, f.t / 0.25, (f.life - f.t) / 0.3),
          R = 26 * s;
        pxCircle(x, y, R * 2.4, "#3a1050", 0.25 * s);
        g.strokeStyle = "#b25bff";
        g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          g.globalAlpha = 0.7 * s;
          g.beginPath();
          g.ellipse(x, y, R * (1.2 + i * 0.5), R * (0.7 + i * 0.3), 0, T * (4 - i) + i, T * (4 - i) + i + 3.6);
          g.stroke();
        }
        pxCircle(x, y, R * 0.75, "#050208", s);
        g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
          const a = T * 5 + i,
            rr = ((1 - ((T * 1.7 + i / 6) % 1)) * 70) * s;
          g.fillStyle = i % 2 ? "#d9a3ff" : "#7a3cc0";
          g.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.6), 2, 2);
        }
      } else if (f.k === "trap") {
        const snapped = f.snap >= 0;
        spr("beartrap", x, y, snapped ? 22 : 26, 0, false, snapped ? Math.max(0, 1 - (f.t - f.snap) / 0.7) : 1);
        if (snapped && f.t - f.snap < 0.12) pxCircle(x, y, 16, "#ffffff", 0.6);
      } else if (f.k === "coffin") {
        if (f.t < COFFIN_HIT_T) {
          // shadow grows and darkens as the coffin comes down
          const u = f.t / COFFIN_HIT_T;
          pxCircle(x, y + 6, 8 + 30 * u * u, "#000000", 0.18 + 0.4 * u);
        } else {
          // cracked ground under the landed coffin, fading out with it
          const a = f.t < 1.25 ? 1 : Math.max(0, 1 - (f.t - 1.25) / 0.35);
          pxCircle(x, y + 6, 30, "#000000", 0.4 * a);
          g.globalAlpha = 0.8 * a;
          g.strokeStyle = "#1a120c";
          g.lineWidth = 2;
          for (let i = 0; i < 7; i++) {
            const aa = i * 0.9 + f.seed;
            g.beginPath();
            g.moveTo(Math.round(x + Math.cos(aa) * 18), Math.round(y + 6 + Math.sin(aa) * 11));
            for (let j = 1; j <= 3; j++) {
              const bend = aa + (j % 2 ? 0.28 : -0.22);
              g.lineTo(Math.round(x + Math.cos(bend) * (18 + f.R * 0.22 * j)), Math.round(y + 6 + Math.sin(bend) * (11 + f.R * 0.13 * j)));
            }
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      } else if (f.k === "foam") {
        const u = f.t / f.life;
        for (let i = 0; i < 12; i++) {
          const a = i * 0.52,
            rr = f.R * (0.3 + 0.7 * u) * (0.5 + (i % 3) * 0.25);
          pxCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 6 + (i % 3) * 3, i % 2 ? "#fff8ec" : "#ffd2c0", 1 - u);
        }
      } else if (f.k === "ring") {
        g.globalAlpha = 1 - f.t / f.life;
        g.strokeStyle = "#d8f4ff";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, f.r || 1, (f.r || 1) * 0.62, 0, 0, TAU);
        g.stroke();
        g.strokeStyle = "#7fb6ff";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x, y, (f.r || 1) * 0.8, (f.r || 1) * 0.5, 0, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      } else if (f.k === "toll") {
        const u = f.t / f.life;
        g.globalAlpha = (1 - u) * 0.8;
        g.strokeStyle = "#ffd98a";
        g.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const r = f.R * Math.min(1, u * 1.6 - i * 0.25);
          if (r <= 0) continue;
          g.beginPath();
          g.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
    // sprinkler streams + fly swarm (around Hog)
    if (W.gsprinkler.level) {
      const L = W.gsprinkler.level,
        n = 2 + Math.floor((L - 1) / 2),
        range = 80 + 16 * L,
        [nzx, nzy] = hatNozzle(),
        hx = Math.round(hxBody + nzx), // streams start at the hat's spinning pipe head
        hy = Math.round(hyBody + nzy);
      // v16: water pulses out along each rotating stream in spurts of droplets (no sprinkler head at Hog's feet).
      // Droplets stay inside the damage band: same range, at most 0.12 rad behind the stream angle (band = +-0.22).
      state.sprinklerDrops = 0;
      for (let k = 0; k < n; k++) {
        const a = T * 2.1 + (k * TAU) / n;
        for (let sp = 0; sp < 5; sp++) {
          const u = (T * 1.8 + sp / 5 + k * 0.13) % 1,
            d = 12 + u * (range - 12);
          for (let j = 0; j < 7; j++) {
            const dj = d - j * 3.5;
            if (dj < 10) continue;
            const aa = a - (dj / range) * 0.1 + ((j * 7) % 3 - 1) * 0.03,
              px = Math.round(hx + Math.cos(aa) * dj),
              py = Math.round(hy + Math.sin(aa) * dj * 0.62 - 4 - Math.sin(u * Math.PI) * 7 + ((j * 5) % 3) - 1),
              sz = j === 0 ? 5 : j < 3 ? 4 : j < 5 ? 3 : 2;
            g.globalAlpha = (1 - u * 0.45) * (1 - j * 0.1);
            g.fillStyle = "#123a48"; // dark rim so the droplets read on any floor
            g.fillRect(px - (sz >> 1) - 1, py - (sz >> 1), sz + 2, sz);
            g.fillStyle = j === 0 ? "#f2fffb" : j < 3 ? "#a8f2ff" : j < 5 ? "#62d2e6" : "#58c8a0";
            g.fillRect(px - (sz >> 1), py - (sz >> 1), sz, sz);
            if (sz >= 4) {
              g.fillStyle = "#ffffff";
              g.fillRect(px - (sz >> 1), py - (sz >> 1), 2, 1);
            }
            state.sprinklerDrops++;
          }
          if (u > 0.86) {
            // splash where the spurt lands
            const ex = Math.round(hx + Math.cos(a - 0.1) * range),
              ey = Math.round(hy + Math.sin(a - 0.1) * range * 0.62);
            g.globalAlpha = (1 - u) * 5;
            g.fillStyle = "#c8f6ff";
            g.fillRect(ex - 6, ey, 3, 2);
            g.fillRect(ex + 4, ey, 3, 2);
            g.fillRect(ex - 1, ey - 4, 3, 3);
            g.fillRect(ex - 3, ey + 3, 2, 2);
            g.fillRect(ex + 2, ey + 3, 2, 2);
          }
        }
      }
      g.globalAlpha = 1;
    }
    if (W.flies.level) {
      const L = W.flies.level,
        n = 8 + 4 * L,
        R = 40 + 8 * L;
      pxCircle(hx, hy, R, "#3a4a1a", 0.08);
      for (let i = 0; i < n; i++) {
        const a = T * (2 + (i % 5) * 0.5) * (i % 2 ? 1 : -1) + i * 1.7,
          rr = R * (0.45 + ((i * 53) % 10) / 18);
        const fxp = Math.round(hx + Math.cos(a) * rr),
          fyp = Math.round(hy - 8 + Math.sin(a * 1.3) * rr * 0.55);
        g.fillStyle = "#1a1f12";
        g.fillRect(fxp, fyp, 3, 2);
        g.fillStyle = (T * 20 + i) % 2 < 1 ? "#cfe6ff" : "#7c9a3a";
        g.fillRect(fxp - 1, fyp - 1, 1, 1);
        g.fillRect(fxp + 3, fyp - 1, 1, 1);
      }
    }
    // gnomes
    for (const gn of state.gnomes) {
      const x = gn.x - camX,
        y = gn.y - camY;
      pxCircle(x, y + 8, 8, "#000", 0.3);
      spr("gnome", x + (gn.stab ? gn.face * 4 : 0), y - 4 + Math.abs(Math.sin(T * 12 + gn.x)) * -2, 30, gn.stab ? gn.face * 0.3 : 0, gn.face < 0);
    }
    // air layer
    for (const f of state.wfx) {
      const x = f.x - camX,
        y = f.y - camY;
      if (f.k === "bottle") spr("molotov", x, y - (f.z || 0), 22, f.t * 12);
      else if (f.k === "can") spr("soda", x, y - (f.z || 0), 18, f.t * 9);
      else if (f.k === "jar") spr("witchjar", x, y - (f.z || 0), 22, f.t * 8);
      else if (f.k === "bone") spr("boomerang", x, y - 6, 30, f.t * 16);
      else if (f.k === "cleaver") spr("cleaver", x, y, CLEAVER_SIZE, f.t * 18);
      else if (f.k === "spike") {
        g.globalAlpha = 0.45;
        g.strokeStyle = "#8ff6ff";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - Math.cos(f.a) * 40, y - Math.sin(f.a) * 40);
        g.stroke();
        g.globalAlpha = 1;
        spr("lastnail", x, y, 40, f.a - Math.PI / 4); // sprite tip points down-right
      } else if (f.k === "rocket") {
        const a = Math.atan2(f.vy, f.vx);
        g.fillStyle = (f.t * 30) % 2 < 1 ? "#ffd65a" : "#ff6a3a";
        g.fillRect(Math.round(x - Math.cos(a) * 9), Math.round(y - Math.sin(a) * 9), 3, 3);
        spr("rockets", x, y, 18, a + Math.PI / 4);
      } else if (f.k === "pop") {
        const u = f.t / f.life;
        const cols = ["#ff5a5a", "#ffe45a", "#5af0ff", "#ff7ae0"];
        for (let i = 0; i < 12; i++) {
          const a = i * 0.5236,
            rr = f.R * u;
          g.globalAlpha = 1 - u;
          g.fillStyle = cols[(i + Math.floor(f.seed)) % 4];
          g.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.7), 3, 3);
        }
        pxCircle(x, y, f.R * 0.4 * (1 - u), "#fff4c0", 0.8 * (1 - u));
        g.globalAlpha = 1;
      } else if (f.k === "coffin") {
        const H = COFFIN_HIT_T,
          im = IMAGES.coffinDrop;
        let z = 0,
          rot = 0,
          alpha = 1,
          sink = 0;
        if (f.t < H) {
          const u = f.t / H;
          z = (1 - u * u) * 420; // accelerates down from well above the screen edge
          rot = (1 - u) * 0.55 * f.spin;
          g.globalAlpha = 0.35 * u;
          g.fillStyle = "#efe4c8";
          for (let i = 0; i < 4; i++) g.fillRect(Math.round(x - 26 + i * 17), Math.round(y - z - 78 - (i % 2) * 14), 2, 34 + (i % 2) * 12);
          g.globalAlpha = 1;
        } else {
          const b = f.t - H;
          z = b < 0.16 ? Math.sin((b / 0.16) * Math.PI) * 9 : 0; // small bounce on landing
          if (f.t > 1.25) {
            const k2 = (f.t - 1.25) / 0.35;
            alpha = Math.max(0, 1 - k2);
            sink = k2 * 14;
          }
        }
        if (ready(im)) {
          g.save();
          g.globalAlpha = alpha;
          g.translate(Math.round(x), Math.round(y - z - 30 + sink));
          if (rot) g.rotate(rot);
          g.drawImage(im, -42, -42, 84, 84);
          g.restore();
          g.globalAlpha = 1;
        } else spr("coffin", x, y - z - 30, 64, rot, false, alpha);
        if (f.done && f.t < H + 0.45) {
          const u = (f.t - H) / 0.45;
          g.globalAlpha = 1 - u;
          g.strokeStyle = "#e8d7b0";
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(Math.round(x), Math.round(y + 6), f.R * (0.55 + 0.45 * u), f.R * 0.6 * (0.55 + 0.45 * u), 0, 0, TAU);
          g.stroke();
          g.globalAlpha = 1;
          for (let i = 0; i < 12; i++) {
            const aa = (i / 12) * TAU + f.seed,
              rr = f.R * (0.35 + 0.65 * u);
            pxCircle(x + Math.cos(aa) * rr, y + 6 + Math.sin(aa) * rr * 0.6 - u * 10, 6 + 6 * u, i % 2 ? "#8a7a62" : "#b3a283", 0.65 * (1 - u));
          }
        }
      } else if (f.k === "stone") {
        const u = Math.min(1, f.t / 0.12),
          fade = f.t > 0.6 ? 1 - (f.t - 0.6) / 0.25 : 1;
        g.save();
        g.beginPath();
        g.rect(x - 30, y - 60, 60, 62);
        g.clip();
        spr("tombstone", x, y - 12 + (1 - u) * 26, 32, Math.sin(f.t * 30) * 0.04 * (1 - u), false, Math.max(0, fade));
        g.restore();
        if (f.t < 0.3) for (let i = 0; i < 5; i++) (g.fillStyle = "#5a4634"), g.fillRect(Math.round(x - 12 + i * 6), Math.round(y - f.t * 60 * ((i % 3) + 1) * 0.5), 3, 3);
      } else if (f.k === "chain") {
        const fade = Math.min(1, (f.life - f.t) / 0.3, f.t / 0.1),
          by = y + 10;
        g.globalAlpha = 0.9 * fade;
        for (let s = 0; s < 3; s++) {
          const ox = (s - 1) * 12;
          for (let i = 0; i < 7; i++) {
            const u = i / 6,
              lx = x + ox * (1 - u),
              ly = by + 8 - u * 22;
            g.strokeStyle = i % 2 ? "#bff6ff" : "#5ad0e8";
            g.lineWidth = 2;
            g.strokeRect(Math.round(lx) - 2, Math.round(ly) - 2, 4, 3);
          }
        }
        pxCircle(x, by + 4, 14, "#5ad0e8", 0.25 * fade);
        g.globalAlpha = 1;
      } else if (f.k === "zap") {
        g.globalAlpha = 1 - f.t / f.life;
        for (const [col, lw] of [["#5aa8ff", 4], ["#eaf6ff", 1.5]]) {
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.beginPath();
          for (let i = 0; i < f.pts.length - 1; i++) {
            const [ax, ay] = f.pts[i],
              [bx, by] = f.pts[i + 1];
            g.moveTo(ax - camX, ay - camY);
            for (let s = 1; s <= 4; s++) {
              const u = s / 4;
              g.lineTo(ax + (bx - ax) * u - camX + (s < 4 ? rand(-5, 5) : 0), ay + (by - ay) * u - camY + (s < 4 ? rand(-5, 5) : 0));
            }
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      } else if (f.k === "bugs" && ready(IMAGES.flies)) {
        // v16: the user's fly-swarm sheet, animated, sized to the poison cloud radius
        const fade = Math.min(1, (f.life - f.t) / 0.5, f.t / 0.15),
          fr = Math.floor(T * 12 + f.L) % 4,
          dw = Math.round(f.R * 2.3),
          dh = Math.round((dw * 80) / 96);
        pxCircle(x, y, f.R, "#4a7a1a", 0.14 * fade);
        g.globalAlpha = fade;
        g.drawImage(IMAGES.flies, fr * 96, 0, 96, 80, Math.round(x - dw / 2 + Math.sin(T * 5) * 2), Math.round(y - 6 - dh / 2 + Math.cos(T * 4) * 2), dw, dh);
        g.globalAlpha = 1;
        f.drawnFrame = fr;
      } else if (f.k === "bugs") {
        const fade = Math.min(1, (f.life - f.t) / 0.5);
        pxCircle(x, y, f.R, "#5a2a7a", 0.18 * fade);
        for (let i = 0; i < 10 + f.L * 3; i++) {
          const a = T * (3 + (i % 4)) * (i % 2 ? 1 : -1) + i,
            rr = f.R * (0.2 + ((i * 29) % 10) / 12);
          g.globalAlpha = fade;
          g.fillStyle = i % 3 ? "#c46cff" : "#7dff6a";
          g.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y - 6 + Math.sin(a) * rr * 0.6), 2, 2);
        }
        g.globalAlpha = 1;
      } else if (f.k === "toll") {
        const sw = Math.sin(f.t * 18) * 0.5 * (1 - f.t / f.life);
        spr("bell", hx, hy - 46, 34, sw, false, 1 - Math.max(0, f.t - 0.5) / 0.3);
      }
    }
    if (p.bookFx > 0) spr("deadanomicon", hx, hy - 42, 28, 0, false, Math.min(1, p.bookFx * 3));
  }
  // ---------- Stage 2 cold mist (Frozen Foods + Dairy only) and the shaded map edge ----------
  let fogTex = null;
  function makeFogTex(dark = false) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const cx = rnd() * 256,
        cy = rnd() * 256,
        r = 18 + rnd() * 46;
      for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256], [256, 256], [-256, -256], [256, -256], [-256, 256]]) {
        const gr = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        gr.addColorStop(0, dark ? "rgba(8,8,14,0.95)" : "rgba(246,250,255,0.95)");
        gr.addColorStop(1, dark ? "rgba(8,8,14,0)" : "rgba(220,238,255,0)");
        x.fillStyle = gr;
        x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
      }
    }
    return c;
  }
  const FOG_REGIONS = ["frozen", "dairy"];
  // v15: Dairy's mist is drawn ABOVE Hog and the monsters (thinner, so they stay readable); Frozen Foods stays under them.
  const FOG_OVER = { dairy: true, frozen: true }; // v16: Frozen Foods now matches Dairy
  function drawColdFog(camX, camY, over = false) {
    if (STAGE !== 2) return;
    const M = window.MEGAMART_MAP,
      T = performance.now() / 1000;
    if (!fogTex) fogTex = makeFogTex();
    if (!over) (state.fogDrawn = []), (state.fogOver = []);
    for (const id of FOG_REGIONS) {
      if (!!FOG_OVER[id] !== over) continue;
      const r = M.regions.find((q) => q.id === id);
      if (!r) continue;
      const x0 = r.rect[0] * 32 - camX,
        y0 = r.rect[1] * 32 - camY,
        w = (r.rect[2] - r.rect[0]) * 32,
        h = (r.rect[3] - r.rect[1]) * 32;
      if (x0 > VIEW_W || y0 > VIEW_H || x0 + w < 0 || y0 + h < 0) continue;
      state.fogDrawn.push(id);
      if (over) state.fogOver.push(id);
      g.save();
      g.beginPath();
      g.rect(Math.round(x0), Math.round(y0), w, h);
      g.clip();
      for (const [sp, al, sc] of over ? [[7, 0.36, 1.3]] : [[9, 0.46, 1], [-6, 0.32, 1.6]]) {
        const ts = 256 * sc,
          ox = (((T * sp + camX * 0) % ts) + ts) % ts;
        g.globalAlpha = al;
        for (let yy = Math.floor((y0 - 8) / ts) * ts - ts; yy < y0 + h; yy += ts)
          for (let xx = x0 - ts + ox - (((x0 % ts) + ts) % ts); xx < x0 + w; xx += ts) g.drawImage(fogTex, Math.round(xx), Math.round(yy + Math.sin(T * 0.3 + xx * 0.01) * 4), ts, ts);
      }
      // soft edge so the mist fades out at the department boundary instead of a hard box
      g.globalAlpha = 1;
      g.restore();
    }
  }
  // v15: dark drifting fog around the OUTSIDE of the store only (the 4-tile strip around the building and the edges of
  // the parking lot). Drawn through an even-odd clip of "whole map minus the building", so it can never reach inside.
  const STORE_RECT = [4, 4, 124, 105];
  // v15 decoration props: drawn depth-sorted with the characters, NO collision (everything walks through them).
  // Base (x, y) in world px = bottom-centre of the art. The JURN standees sit in Electronics' upper-right corner.
  const MM_DECOR = [{ id: "jurn_standees", img: "standees", x: 120.8 * 32, y: 54.9 * 32, w: 123, h: 88, solid: false, region: "electronics" }];
  function drawDecor(d, sx, sy) {
    const im = IMAGES[d.img];
    if (!ready(im)) return;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(sx, sy - 2, d.w / 2, 5, 0, 0, TAU);
    g.fill();
    g.drawImage(im, Math.round(sx - d.w / 2), Math.round(sy - d.h), d.w, d.h);
    state && (state.decorDrawn = (state.decorDrawn || 0) + 1);
  } // outer walls of the building, in tiles
  const EDGE_FOG_D = 360;
  let edgeFogTex = null;
  function makeEdgeFogTex() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = EDGE_FOG_D;
    const x = c.getContext("2d"),
      t = makeFogTex(true);
    for (let xx = 0; xx < 512; xx += 256) for (let yy = 0; yy < EDGE_FOG_D; yy += 256) x.drawImage(t, xx, yy);
    x.globalCompositeOperation = "destination-over";
    x.fillStyle = "rgba(4,4,10,0.78)";
    x.fillRect(0, 0, 512, EDGE_FOG_D);
    x.globalCompositeOperation = "destination-in";
    const gr = x.createLinearGradient(0, 0, 0, EDGE_FOG_D);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(0.3, "rgba(0,0,0,0.85)");
    gr.addColorStop(0.65, "rgba(0,0,0,0.35)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 512, EDGE_FOG_D);
    return c;
  }
  function drawMapEdge(camX, camY) {
    if (STAGE !== 2) return;
    if (!edgeFogTex) edgeFogTex = makeEdgeFogTex();
    const D = EDGE_FOG_D,
      T = performance.now() / 1000,
      bx0 = STORE_RECT[0] * TILE,
      by0 = STORE_RECT[1] * TILE,
      bx1 = STORE_RECT[2] * TILE,
      by1 = STORE_RECT[3] * TILE;
    // side: [visible?, transform a,b,c,d,e,f (local u along the edge, v inward), edge length, first visible u, scroll dir]
    const sides = [
      [camY < D, [1, 0, 0, 1, -camX, -camY], WORLD_W, camX, 1],
      [camY + VIEW_H > WORLD_H - D, [1, 0, 0, -1, -camX, WORLD_H - camY], WORLD_W, camX, -1],
      [camX < D, [0, 1, 1, 0, -camX, -camY], WORLD_H, camY, 1],
      [camX + VIEW_W > WORLD_W - D, [0, 1, -1, 0, WORLD_W - camX, -camY], WORLD_H, camY, -1],
    ];
    let drawn = 0;
    g.save();
    g.beginPath();
    g.rect(-camX, -camY, WORLD_W, WORLD_H);
    g.rect(bx0 - camX, by0 - camY, bx1 - bx0, by1 - by0);
    g.clip("evenodd");
    for (const [vis, m, len, u0, dir] of sides) {
      if (!vis) continue;
      drawn++;
      g.save();
      g.transform(...m);
      const span = m[0] ? VIEW_W : VIEW_H,
        off = (((T * 7 * dir) % 512) + 512) % 512;
      for (let u = Math.floor((u0 - off) / 512) * 512 + off - 512; u < Math.min(len, u0 + span + 512); u += 512) g.drawImage(edgeFogTex, Math.round(u), 0);
      g.restore();
    }
    g.restore();
    state.edgeDrawn = drawn;
  }
  function weaponIcon(id, x, y, size) {
    if (id === "gsprinkler" && ready(IMAGES.hatIcon)) return ctx.drawImage(IMAGES.hatIcon, x, y, size, size);
    // HUD slot icon: original five from the v5 icon strip, new ones from the v14 sheet
    if (id in OLD_ICON) {
      if (ready(weaponIcons)) ctx.drawImage(weaponIcons, OLD_ICON[id] * 32, 0, 32, 32, x, y, size, size);
    } else if (ready(IMAGES.wpn2)) ctx.drawImage(IMAGES.wpn2, NW_IDS.indexOf(id) * 64, 0, 64, 64, x, y, size, size);
  }
  let levelUpKeys = null; // keyboard/gamepad shortcuts for the open level-up card (R reroll, B banish, 1-3 pick)
  function showLevelUp() {
    if (!state || !pendingLevelUps) return;
    if (mode !== "levelup") sfx("level_up");
    mode = "levelup";
    let available = getAvailableUpgrades();
    const fallback = !available.length;
    if (fallback) available = FALLBACK_UPS.slice(); // v14: everything maxed -> heal or hazard pay
    const choices = fallback ? available : pickChoices(available);
    const slotsUsed = syncSlots().length;
    state.lastChoices = choices.map((u) => u.id);
    panelShow(
      `<div class="eyebrow">LEVEL ${state.player.level - pendingLevelUps + 1} — CLOCK'S STILL RUNNING</div><h2>PICK YOUR POISON</h2><p>${pendingLevelUps > 1 ? `${pendingLevelUps} level-ups waiting. ` : ""}Time's paused. Choose one upgrade.</p><p class="slot-count">WEAPON SLOTS ${slotsUsed}/${MAX_SLOTS}${slotsUsed >= MAX_SLOTS ? " — FULL: upgrades only" : ""}</p><div class="choice-grid">${choices
        .map((u, i) => {
          const w = state.weapons[u.id],
            isNew = w && !w.level;
          return `<button class="choice${isNew ? " is-new" : ""}" data-choice="${i}" data-id="${u.id}"><span class="choice-tag">${upgradeLabel(u)}</span><b>${u.title}</b>${w && w.level && u.up ? u.up : u.desc}</button>`;
        })
        .join("")}</div>${
        fallback
          ? ""
          : `<div class="button-row lu-tools"><button class="game-btn" data-reroll${state.rerolls > 0 && available.length > choices.length ? "" : " disabled"}>⟳ REROLL (${state.rerolls})</button><button class="game-btn danger" data-banish${state.banishes > 0 ? "" : " disabled"}>✖ BANISH (${state.banishes})</button></div><p class="muted lu-hint">Reroll draws three new cards. Banish removes one card for the rest of this shift.</p>`
      }`,
    );
    const card = panel.firstElementChild;
    let banishing = false;
    const rerollBtn = card.querySelector("[data-reroll]"),
      banishBtn = card.querySelector("[data-banish]");
    const doReroll = () => {
      if (!rerollBtn || rerollBtn.disabled || state.rerolls <= 0) return;
      state.rerolls--;
      sfx("ui_click", 0.9, () => audioBeep(420, 0.08, "square", 0.02));
      showLevelUp();
    };
    const toggleBanish = () => {
      if (!banishBtn || banishBtn.disabled || state.banishes <= 0) return;
      banishing = !banishing;
      card.classList.toggle("banishing", banishing);
      banishBtn.textContent = banishing ? "CANCEL BANISH" : `✖ BANISH (${state.banishes})`;
      card.querySelector(".lu-hint").textContent = banishing ? "Pick the card to banish. It won't show up again this shift." : "Reroll draws three new cards. Banish removes one card for the rest of this shift.";
    };
    if (rerollBtn) rerollBtn.onclick = doReroll;
    if (banishBtn) banishBtn.onclick = toggleBanish;
    levelUpKeys = { reroll: doReroll, banish: toggleBanish, choose: (i) => card.querySelectorAll("[data-choice]")[i]?.click() };
    panel.querySelectorAll("[data-choice]").forEach(
      (b, i) =>
        (b.onclick = () => {
          const selected = choices[i];
          if (!selected) return;
          if (banishing) {
            state.banished.push(selected.id);
            state.banishes--;
            sfx("ui_click", 0.7, () => audioBeep(200, 0.15, "sawtooth", 0.03));
            toastMsg(`${selected.title} banished for this shift.`);
            showLevelUp();
            return;
          }
          if (!fallback && !getAvailableUpgrades().some((u) => u.id === selected.id)) return;
          selected.apply(state);
          if (STAT_IDS.includes(selected.id)) state.statPicks[selected.id] = (state.statPicks[selected.id] || 0) + 1;
          if (state.weapons[selected.id]) state.lastUpgrade = selected.id; // v10: that weapon's HUD slot glows gold
          syncSlots();
          pendingLevelUps = Math.max(0, pendingLevelUps - 1);
          sfx("ui_click", 1.2, () => audioBeep(520, 0.12, "triangle"));
          if (pendingLevelUps) showLevelUp();
          else {
            mode = "playing";
            levelUpKeys = null;
            panelHide();
          }
        }),
    );
  }
  // ---- Attack poses: priority + minimum display time so walking never instantly cancels a visible attack.
  // shovel (melee) > nail gun (ranged) > chainsaw > holy water. Shovel and gun poses also play while walking;
  // chainsaw / holy water only take over the body when Hog is standing still (their effects always show).
  const POSE_PRI = { shovel: 4, nail: 3, chainsaw: 2, water: 1 },
    POSE_DUR = { shovel: 0.32, nail: 0.24, chainsaw: 0.18, water: 0.2 },
    POSE_MIN = 0.16,
    SWING_HIT = 0.08;
  function setPose(type, aim) {
    const p = state.player,
      cur = p.pose;
    if (cur && cur.t < cur.dur) {
      const higher = POSE_PRI[type] > POSE_PRI[cur.type];
      if (!higher && (cur.t < POSE_MIN || POSE_PRI[type] < POSE_PRI[cur.type])) return false;
      if (cur.type === type && type === "nail" && cur.t < POSE_MIN) return false;
    }
    p.pose = { type, t: 0, dur: POSE_DUR[type], aim };
    p.aim = aim;
    return true;
  }
  function doAttack(dt) {
    const p = state.player,
      weapons = state.weapons,
      nearest = nearestEnemy(230),
      wdt = dt * weaponSpeedMul(); // v8 treasure bonus: weapons recharge faster
    weapons.shovel.cooldown -= wdt;
    if (p.swing) {
      p.swing.t += dt;
      if (!p.swing.hit && p.swing.t >= SWING_HIT) {
        p.swing.hit = true;
        const a = p.swing.a;
        let hits = 0;
        dmgSrc = "shovel";
        for (const e of [...state.enemies]) {
          const ea = Math.atan2(e.y - p.y, e.x - p.x),
            delta = Math.atan2(Math.sin(ea - a), Math.cos(ea - a));
          if (dist(p, e) < weapons.shovel.range + e.r && Math.abs(delta) < weapons.shovel.arc) {
            damageEnemy(e, weapons.shovel.damage * p.damage, true);
            hits++;
          }
        }
        state.swingLog = state.swingLog || [];
        if (state.swingLog.length < 50) state.swingLog.push({ t: state.t, poseFrame: hogAnimState().frame, pose: p.pose?.type, hits });
        sfx("shovel_hit", 1, () => audioBeep(155, 0.06, "square", 0.03));
      }
      if (p.swing.t >= POSE_DUR.shovel) p.swing = null;
    }
    if (weapons.shovel.level && nearest && dist(p, nearest) <= weapons.shovel.range + nearest.r && weapons.shovel.cooldown <= 0 && !p.swing) {
      const a = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      p.aim = a;
      weapons.shovel.cooldown = Math.max(0.32, 0.72 - weapons.shovel.level * 0.045);
      setPose("shovel", a);
      // Wind-up frame first; the hit is applied on the strike frame (SWING_HIT s later), synced with the animation.
      p.swing = { t: 0, a, hit: false };
    }

    if (weapons.nail.level) {
      const NAIL_BASE = 20,
        NAIL_VOLLEY = [1, 1.5, 1.9, 2.3, 2.7, 3.0, 3.3, 3.6]; // total damage of one volley at each level (6-8 = Limit Break), split across its nails
      weapons.nail.cooldown -= wdt;
      if (nearest && weapons.nail.cooldown <= 0) {
        // v17 rebalance: +1 nail per level, the volley's total damage grows modestly (x1 -> x2.7) and is split across
        // the nails, reload 0.73s -> 0.45s. Level 5 vs level 1 on one target: ~4.5x (was ~22x).
        const NL = Math.min(weapons.nail.level, NAIL_VOLLEY.length);
        weapons.nail.cooldown = Math.max(0.4, 0.8 - NL * 0.07);
        const count = NL,
          base = Math.atan2(nearest.y - p.y, nearest.x - p.x);
        p.aim = base;
        setPose("nail", base);
        p.muzzle = { t: 0.08, a: base }; // muzzle flash on the same frame the nails leave the barrel
        state.shotLog = state.shotLog || [];
        if (state.shotLog.length < 50) state.shotLog.push({ t: state.t, pose: p.pose?.type, frame: p.pose ? hogAnimState().frame : -1 });
        for (let i = 0; i < count; i++) {
          const a = base + (i - (count - 1) / 2) * 0.18,
            muzzle = 18;
          state.projectiles.push({
            x: p.x + Math.cos(a) * muzzle,
            y: p.y + Math.sin(a) * muzzle,
            vx: Math.cos(a) * weapons.nail.speed,
            vy: Math.sin(a) * weapons.nail.speed,
            life: 1.2,
            damage: (NAIL_BASE * NAIL_VOLLEY[NL - 1]) / count,
            r: 3,
            weapon: "nail",
          });
        }
        // random pitch + slight volume wobble per shot so rapid fire doesn't sound like a metronome
        const pr = rand(0.82, 1.2);
        sfx("nailgun_shot", rand(0.8, 1.05), () => audioBeep(400 * pr, 0.04, "square", 0.018), pr);
      }
    }
    if (weapons.sprinkler.level) {
      const w = weapons.sprinkler;
      w.cooldown -= wdt;
      const target = nearestEnemy(w.range + 20);
      if (target && w.cooldown <= 0) {
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        p.fxWater = { t: w.duration, a };
        setPose("water", a);
        w.cooldown = Math.max(0.22, 0.46 - w.level * 0.025);
        dmgSrc = "sprinkler";
        for (const e of [...state.enemies]) {
          const d = dist(p, e),
            ea = Math.atan2(e.y - p.y, e.x - p.x),
            delta = Math.atan2(Math.sin(ea - a), Math.cos(ea - a));
          if (d < w.range + e.r && Math.abs(delta) < w.width) damageEnemy(e, (13 + w.level * 5) * p.damage, false);
        }
        for (let i = 0; i < 12; i++) {
          const aa = a + rand(-w.width, w.width),
            d = rand(18, w.range);
          state.particles.push({
            x: p.x + Math.cos(aa) * d,
            y: p.y + Math.sin(aa) * d,
            vx: Math.cos(aa) * rand(5, 35),
            vy: Math.sin(aa) * rand(5, 35),
            life: rand(0.12, w.duration + 0.12),
            max: w.duration + 0.12,
            color: i % 2 ? "#73d6e4" : "#d6fbef",
            r: rand(2, 5),
          });
        }
        sfx("holywater_spell", 1, () => audioBeep(720, 0.06, "sine", 0.012));
      }
    }
    if (weapons.chainsaw.level) {
      const w = weapons.chainsaw;
      w.cooldown -= wdt;
      const target = nearestEnemy(w.range + 22);
      if (target) {
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        if (w.cooldown <= 0) {
          p.fxSaw = { t: w.duration, a };
          setPose("chainsaw", a);
          w.cooldown = 0.12;
          dmgSrc = "chainsaw";
          for (const e of [...state.enemies]) {
            const d = dist(p, e),
              ea = Math.atan2(e.y - p.y, e.x - p.x),
              delta = Math.atan2(Math.sin(ea - a), Math.cos(ea - a));
            if (d < w.range + e.r && Math.abs(delta) < 0.78) damageEnemy(e, w.damage * p.damage * 0.12, false);
          }
          addParticle(p.x + Math.cos(a) * w.range * 0.65, p.y + Math.sin(a) * w.range * 0.65, "#e6a94f", 2, 0.7);
          sfx("chainsaw_rev", 1, () => audioBeep(105, 0.06, "sawtooth", 0.006));
        }
      }
    }
    if (weapons.lantern.level) {
      const w = weapons.lantern;
      w.sfxCooldown = Math.max(0, (w.sfxCooldown || 0) - dt);
      let lit = false;
      dmgSrc = "lantern";
      for (let i = 0; i < w.count; i++) {
        const a = state.t * (1.8 + i * 0.06) + (i * TAU) / w.count,
          x = p.x + Math.cos(a) * w.radius,
          y = p.y + Math.sin(a) * w.radius * 0.6;
        for (const e of [...state.enemies])
          if (Math.hypot(x - e.x, y - e.y) < e.r + 11) {
            damageEnemy(e, 20 * w.level * dt, false);
            lit = true;
          }
      }
      if (lit && w.sfxCooldown <= 0) {
        sfx("lantern_spell", 1, () => audioBeep(680, 0.05, "sine", 0.008));
        w.sfxCooldown = 0.35;
      }
    }
    doAttack2(dt, wdt);
  }
  // =====================================================================================
  //  UPDATE
  // =====================================================================================
  const DIRS = { down: 1, up: 2, left: 3, right: 4 };
  function dirFromVector(dx, dy, current) {
    if (!dx && !dy) return current;
    const ax = Math.abs(dx),
      ay = Math.abs(dy);
    // Diagonals keep the current facing if it is one of the two candidates (prevents frame-to-frame flipping).
    if (ax > 0 && ay > 0 && Math.abs(ax - ay) < 0.35) {
      const h = dx > 0 ? "right" : "left",
        v = dy > 0 ? "down" : "up";
      if (current === h || current === v) return current;
      return h;
    }
    return ax > ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }
  function hitPlayer(amount, invuln, shakeAmt, color = "#df6654") {
    const p = state.player;
    if (state.sunrise) return false; // the dead can't hurt anyone in daylight
    p.hp -= amount;
    state.damageTaken += amount;
    p.invuln = invuln;
    p.hurtAnim = 0.22;
    if (p.hp > 0) sfx("player_hurt", 1, () => audioBeep(95, 0.08, "sawtooth", 0.022));
    shake = Math.max(shake, shakeAmt);
    addParticle(p.x, p.y, color, 7);
    if (p.hp <= 0) {
      finishRun(false);
      return true;
    }
    return false;
  }
  function update(dt) {
    if (mode !== "playing" || !state) return;
    const p = state.player;
    state.t += dt;
    {
      const kingAlive = state.enemies.some((e) => e.bossId === finalBossId()); // v10: the final boss of either stage
      state.kingDark = clamp(state.kingDark + (kingAlive ? dt / 1.2 : -dt / 0.8), 0, 1);
    }
    for (const f of [...state.floaters]) if ((f.t += dt) > 1.6) state.floaters.splice(state.floaters.indexOf(f), 1);
    p.invuln = Math.max(0, p.invuln - dt);
    updateCameo(dt);
    p.hurtAnim = Math.max(0, p.hurtAnim - dt);
    if (p.pose) {
      p.pose.t += dt;
      if (p.pose.t >= p.pose.dur) p.pose = null;
    }
    if (p.muzzle && (p.muzzle.t -= dt) <= 0) p.muzzle = null;
    if (p.fxWater && (p.fxWater.t -= dt) <= 0) p.fxWater = null;
    if (p.fxSaw && (p.fxSaw.t -= dt) <= 0) p.fxSaw = null;
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (p.blessT > 0) {
      p.blessT -= dt;
      if (p.blessT <= 0) {
        p.blessT = 0;
        p.damage /= 1.35;
        toastMsg("The fountain's blessing wore off.");
      }
    }
    state.walk += dt;
    let dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
      dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    let tm = 1; // mobile: analog joystick strength (keyboard is always full speed)
    if (!dx && !dy && touchVec.m > 0) {
      dx = touchVec.x;
      dy = touchVec.y;
      tm = touchVec.m;
    }
    p.moving = !!(dx || dy);
    if (p.moving) {
      const l = Math.hypot(dx, dy),
        ox = p.x,
        oy = p.y;
      moveCircle(p, (dx / l) * p.speed * tm * dt, (dy / l) * p.speed * tm * dt, 12);
      // Walk frames advance with distance actually travelled, so feet never slide (and pressing into a wall stops the cycle).
      const moved = Math.hypot(p.x - ox, p.y - oy);
      p.stride += moved;
      if (moved < 0.2 * p.speed * tm * dt) p.moving = false;
      p.dir = dirFromVector(dx, dy, p.dir);
      p.face = Math.atan2(dy, dx);
      p.dirHold = 0;
    } else if (p.pose) {
      // Standing still: turn toward what he's attacking, but only after the new facing has been stable briefly.
      const want = dirFromVector(Math.cos(p.pose.aim), Math.sin(p.pose.aim), p.dir);
      if (want !== p.dir) {
        p.dirHold += dt;
        if (p.dirHold > 0.18) ((p.dir = want), (p.dirHold = 0));
      } else p.dirHold = 0;
    }
    p.idleT = p.moving || p.pose ? 0 : (p.idleT || 0) + dt;
    // Region tracking for HUD banner and visits.
    const reg = regionAt(p.x, p.y);
    if (state.region !== reg.id) {
      state.region = reg.id;
      state.regionBanner = 2.6;
      state.visited[reg.id] = true;
    }
    state.regionBanner = Math.max(0, state.regionBanner - dt);
    const place = (MAP.places || []).find((pl) => p.x / TILE >= pl.rect[0] && p.x / TILE < pl.rect[2] && p.y / TILE >= pl.rect[1] && p.y / TILE < pl.rect[3]);
    if ((place?.name || null) !== (state.place || null)) {
      state.place = place?.name || null;
      if (place) {
        state.placeBanner = 3;
        state.visitedPlaces = state.visitedPlaces || {};
        state.visitedPlaces[place.id] = true;
      }
    }
    state.placeBanner = Math.max(0, (state.placeBanner || 0) - dt);
    if (state.sunrise) {
      // Cinematic ending: no spawns, no attacks, no damage; Hog can still walk around and grab loose pickups.
      updateSunrise(dt);
      if (mode !== "playing") return;
      updateDrops(dt);
      updateParticles(dt);
      return;
    }
    state.flowT -= dt;
    if (state.flowT <= 0) {
      state.flowT = 0.3;
      computeFlowField();
    }
    state.clock = Math.min(6, state.t / REAL_SECONDS_PER_HOUR);
    if (state.t >= SHIFT_SECONDS && !state.clockBoom) explodeClock();
    state.spawn -= dt;
    const cap = Math.min(85, 34 + state.t / 9);
    if (state.spawn <= 0) {
      // v17 stream polish: a short 15s breather, then the first ~2.5 minutes run hotter (they used to feel empty)
      state.spawn = Math.max(0.27, 1.05 - state.t / 1000) * (state.t < 15 ? 1.4 : state.t < 150 ? 0.62 : 1);
      if (state.enemies.length < cap) {
        addEnemy(pick(spawnTypes()));
        if (state.t > 25 && state.t < 150 && Math.random() < 0.3) addEnemy(pick(spawnTypes())); // early packs
        if (state.t > 130 && Math.random() < 0.16) addEnemy(pick(spawnTypes(true)));
      }
    }
    const bossTimes = BOSS_TIMES[STAGE];
    if (STAGE === 1 && WORLD.testBox && !state.testBoxUsed) {
      const b = WORLD.testBox;
      if (Math.abs(p.x - b.x) < b.s / 2 && Math.abs(p.y - b.y) < b.s / 2) return triggerTestBox();
    }
    updateClouds(dt);
    if (mode !== "playing") return;
    if (state.limitless) updateLimitless();
    else for (const [id, hour] of bossTimes) if (state.clock >= hour && !state.bossesSpawned[id] && !state.bossesDead[id]) addEnemy(null, id);
    for (const rw of state.rewards) if (!rw.taken && Math.hypot(rw.x - p.x, rw.y - p.y) < 30) collectReward(rw);
    doAttack(dt);
    if (mode !== "playing") return;
    const recycleDist = Math.hypot(VIEW_W, VIEW_H) * 1.6;
    for (const e of [...state.enemies]) {
      e.flash = Math.max(0, (e.flash || 0) - dt);
      const d = dist(p, e) || 1;
      e.attack -= dt;
      const flow = e.type === "ghost" || e.fly ? null : flowDir(e);
      const dirX = flow ? flow.x : (p.x - e.x) / d,
        dirY = flow ? flow.y : (p.y - e.y) / d;
      if (!e.boss && e.fearT > 0) {
        // terrified by the Funeral Bell: run straight away from Hog, no attacks, no contact damage
        e.fearT -= dt;
        e.vx += ((e.x - p.x) / d) * e.speed * dt * 3;
        e.vy += ((e.y - p.y) / d) * e.speed * dt * 3;
      } else if (e.boss) {
        e.phase += dt;
        const arena = WORLD.arenas[e.bossId];
        if (!e.engaged) {
          e.lureT += dt;
          if (Math.hypot(p.x - arena.x, p.y - arena.y) < 330 || e.hp < e.maxHp || e.lureT > 25) {
            e.engaged = true;
            if (e.lureT > 25) toastMsg(`${e.name} got tired of waiting and is coming for you!`);
          }
          // Prowl around the arena while waiting.
          const tx = arena.x + Math.cos(e.phase * 0.5) * 40,
            ty = arena.y + Math.sin(e.phase * 0.5) * 24;
          e.vx += (tx - e.x) * dt * 0.8;
          e.vy += (ty - e.y) * dt * 0.8;
        } else if (flow && d > 160) {
          // Hunting across the cemetery: move with purpose so the encounter actually arrives.
          e.vx += flow.x * e.speed * dt * 5;
          e.vy += flow.y * e.speed * dt * 5;
        } else {
          const orbit = e.bossId === "widow" ? Math.sin(e.phase * 1.7) * 55 : Math.sin(e.phase * 0.65) * 20;
          const tx = p.x + Math.cos(e.phase * 0.7) * orbit,
            ty = p.y + Math.sin(e.phase * 0.7) * orbit;
          const dd = Math.hypot(tx - e.x, ty - e.y) || 1;
          e.vx += ((tx - e.x) / dd) * e.speed * dt * 1.5;
          e.vy += ((ty - e.y) / dd) * e.speed * dt * 1.5;
        }
        if (e.s2) {
          if (updateBoss2(e, d, dt)) return;
        } else if (e.cast) {
          updateBossCast(e, dt);
        } else if (e.bossId === "digger" && e.bone) {
          if (updateBoneThrow(e, dt)) continue;
        } else if (e.bossId === "digger" && e.attack <= 0) {
          e.attack = 2.2;
          if (e.engaged && d < 300) {
            if (d < e.r + 28) {
              // close slam (unchanged v5 mechanic)
              if (p.invuln <= 0 && hitPlayer(e.damage * 1.5, 0.75, 9)) return;
            } else startBoneThrow(e);
          }
        } else if (e.attack <= 0) {
          // v8: the Widow hurls blue fire, the King green-fire necro skulls. Both plant and wind up first (glowing
          // hand + aim line), only once engaged and reasonably close.
          e.attack = e.bossId === "king" ? 2.1 : 2.0;
          if (e.engaged && d < 320) e.cast = { t: 0, dur: e.bossId === "king" ? 0.9 : 0.75, a: Math.atan2(p.y - e.y, p.x - e.x) };
        }
      } else if (e.s2) {
        if (updateEnemy2(e, d, dirX, dirY, dt)) return;
        if (!state.enemies.includes(e)) continue; // exploded
      } else if (e.type === "ghost" && e.enraged) {
        // v17: a ghost that's been hit gets angry and rushes Hog down (fast, straight, no drifting)
        e.vx += dirX * e.speed * dt * 5.5;
        e.vy += dirY * e.speed * dt * 5.5;
      } else if (e.type === "ghost" && Math.sin(state.t * 2 + e.phase) > -0.25) {
        e.vx += dirX * e.speed * dt * 0.35;
        e.vy += dirY * e.speed * dt * 0.35;
      } else if (e.type === "worm" && d < 300) {
        // v17: worms circle round to get BEHIND Hog (opposite the way he's facing), then lunge at his back
        const bx = p.x - Math.cos(p.face || 0) * 70,
          by = p.y - Math.sin(p.face || 0) * 70,
          bd = Math.hypot(bx - e.x, by - e.y) || 1,
          ex = e.x - p.x,
          ey = e.y - p.y,
          behind = (ex * Math.cos(p.face || 0) + ey * Math.sin(p.face || 0)) / d < -0.35; // in Hog's back arc
        if (e.attack <= 0 && behind && d < 200) {
          e.attack = 2.7;
          e.vx += dirX * 240;
          e.vy += dirY * 240;
        } else if (e.attack <= 1.6) {
          // swing wide around his side rather than through his front
          const side = ex * -Math.sin(p.face || 0) + ey * Math.cos(p.face || 0) >= 0 ? 1 : -1,
            tx = (bx - e.x) / bd - Math.sin(p.face || 0) * side * (behind ? 0 : 0.7),
            ty = (by - e.y) / bd + Math.cos(p.face || 0) * side * (behind ? 0 : 0.7),
            tl = Math.hypot(tx, ty) || 1;
          e.vx += (tx / tl) * e.speed * dt * 2.4;
          e.vy += (ty / tl) * e.speed * dt * 2.4;
        }
      } else {
        e.vx += dirX * e.speed * dt * 2;
        e.vy += dirY * e.speed * dt * 2;
      }
      // v14: bear traps / ghost chains hold (bosses only slowed), soda foam and grave dust slow
      let smul = 1;
      if (e.stun > 0) ((e.stun -= dt), (smul = e.boss ? 0.6 : 0));
      if (e.slowT > 0) ((e.slowT -= dt), (smul *= e.slowK || 1));
      const mdt = dt * smul;
      if (e.type === "ghost" || e.fly) {
        e.x += e.vx * mdt;
        e.y += e.vy * mdt;
        e.x = clamp(e.x, 4 * CELL, WORLD_W - 4 * CELL);
        e.y = clamp(e.y, 4 * CELL, WORLD_H - 4 * CELL);
      } else moveCircle(e, e.vx * mdt, e.vy * mdt, e.boss ? 16 : Math.min(e.r, 11));
      e.vx *= Math.pow(0.08, dt);
      e.vy *= Math.pow(0.08, dt);
      updateFacing(e);
      // Unstick / recycle: enemies left far behind or wedged in scenery re-enter near the player.
      if (!e.boss && !e.qa) {
        e.stuckT = (e.stuckT || 0) + dt;
        if (e.stuckT > 1.5) {
          const progressed = Math.hypot(e.x - (e.lastX ?? e.x), e.y - (e.lastY ?? e.y));
          if ((progressed < 6 && d > 90) || d > recycleDist) {
            const spot = findSpawnPoint();
            if (spot) ((e.x = spot.x), (e.y = spot.y), (e.vx = e.vy = 0));
            state.recycled = (state.recycled || 0) + 1;
          }
          e.lastX = e.x;
          e.lastY = e.y;
          e.stuckT = 0;
        }
      }
      if (d < e.r + p.r && p.invuln <= 0 && !(e.fearT > 0)) {
        if (hitPlayer(e.damage, 0.55, 6)) return;
      }
    }
    for (const q of [...state.projectiles]) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.bone) q.spin += dt * 14;
      if (q.fire) {
        q.spin += dt * 6;
        if (q.home > 0) {
          q.home -= dt;
          const want = Math.atan2(p.y - q.y, p.x - q.x),
            cur = Math.atan2(q.vy, q.vx),
            sp = Math.hypot(q.vx, q.vy);
          let da = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
          const tr = q.turn || 1.5;
          da = clamp(da, -tr * dt, tr * dt);
          q.vx = Math.cos(cur + da) * sp;
          q.vy = Math.sin(cur + da) * sp;
        }
        if (Math.random() < 0.6)
          state.particles.push({ x: q.x + rand(-3, 3), y: q.y + rand(-3, 3), vx: -q.vx * 0.15, vy: -q.vy * 0.15 - 20, life: 0.3, max: 0.3, color: q.fire === "blue" ? (Math.random() < 0.5 ? "#3a6bff" : "#9fd0ff") : Math.random() < 0.5 ? "#2bd94a" : "#b8ff9a", r: 3, float: true });
      }
      if (solidAt(q.x, q.y)) {
        // Nails, bones and boss bolts stop on walls, headstones and buildings.
        if (q.bone) boneImpact(q.x, q.y);
        else addParticle(q.x, q.y, q.enemy ? q.color || "#d6c0ff" : "#d9d2bf", 3, 0.5);
        q.life = 0;
      } else if (q.enemy) {
        if (Math.hypot(q.x - p.x, q.y - p.y) < p.r + q.r && p.invuln <= 0) {
          q.life = 0;
          if (q.bone) {
            boneImpact(q.x, q.y);
            state.boneHits = (state.boneHits || 0) + 1;
          }
          if (q.src && state.bossFireHits[q.src] !== undefined) {
            state.bossFireHits[q.src]++;
            addParticle(q.x, q.y, q.color, 10, 1);
          }
          if (hitPlayer(q.damage, 0.7, 8)) return;
        }
      } else {
        for (const e of [...state.enemies])
          if (Math.hypot(q.x - e.x, q.y - e.y) < e.r + q.r) {
            dmgSrc = q.weapon || "nail";
            damageEnemy(e, q.damage, q.weapon !== "nail"); // v17: nails no longer push monsters back
            q.life = 0;
            break;
          }
      }
      if (q.life <= 0) state.projectiles.splice(state.projectiles.indexOf(q), 1);
    }
    updateDrops(dt);
    if (mode !== "playing") return;
    updateParticles(dt);
    if (state.impacts) for (const im of [...state.impacts]) if ((im.t += dt) > 0.3) state.impacts.splice(state.impacts.indexOf(im), 1);
    // v7: the clock never brings the day (at 6:00 it explodes). Only beating the Cemetery King does.
    if (state.bossesDead[finalBossId()] === true && !state.sunrise && !state.limitless) startSunrise();
  }
  // =====================================================================================
  //  SUNRISE (end-of-shift sequence, in the world)
  // =====================================================================================
  const SUNRISE_LIGHT_SECONDS = 4.5,
    COUNTDOWN_SECONDS = 5,
    HORDE_SECONDS = 3, // after the King falls, one last horde claws out of the graves before the light comes
    HORDE_COUNT = 30;
  // ---- 6:00 AM: the shift clock blows up (HUD effect + sound). It does NOT bring the sunrise. ----
  function explodeClock() {
    const shards = [];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU),
        v = rand(90, 330);
      shards.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, s: rand(3, 8), c: pick(["#ffe1a2", "#ffb347", "#ff6a3d", "#d8d0c0", "#6b6460"]), spin: rand(-9, 9) });
    }
    state.clockBoom = { t: 0, at: state.t, shards };
    state.clockBoomCount = (state.clockBoomCount || 0) + 1;
    shake = Math.max(shake, 7);
    sfx("clock_explosion", 1, audioBoom);
  }
  function audioBoom() {
    if (!audio || save.sfx === 0) return;
    try {
      const len = Math.floor(audio.sampleRate * 0.9),
        buf = audio.createBuffer(1, len, audio.sampleRate),
        d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      const src = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        gn = audio.createGain();
      src.buffer = buf;
      f.type = "lowpass";
      f.frequency.value = 900;
      gn.gain.value = 0.32 * save.sfx;
      src.connect(f);
      f.connect(gn);
      gn.connect(audio.destination);
      src.start();
    } catch {}
    audioBeep(70, 0.7, "sawtooth", 0.07);
    setTimeout(() => audioBeep(1250, 0.25, "square", 0.02), 90); // the bell spring pinging off
  }
  function startSunrise() {
    if (state.sunrise || mode !== "playing") return;
    state.sunrise = { t: 0, countdown: null, burned: 0, startedAt: state.t, hordeSpawned: 0, hordeStartCount: state.enemies.length };
    state.sunriseCount = (state.sunriseCount || 0) + 1;
    pendingLevelUps = 0; // no upgrade pop-ups during the cinematic (XP already earned is kept)
    state.projectiles = state.projectiles.filter((q) => !q.enemy);
    state.clouds = [];
    for (const e of state.enemies) ((e.atk = null), (e.charge = null), (e.prime = 0), setBurn(e));
    state.eventText = "THE DEAD ARE RISING...";
    state.eventUntil = state.t + HORDE_SECONDS;
    musicTrack.volume = save.music * 0.5;
    sfx("horde", 1, () => audioBeep(330, 0.6, "triangle", 0.04));
  }
  // Monsters catch fire a few at a time once the light arrives, so the burn spreads across the screen.
  function setBurn(e) {
    e.burnAt = HORDE_SECONDS + 0.8 + Math.random() * 2.6;
    e.burnDur = 1.0 + Math.random() * 0.6;
    e.burnT = 0;
  }
  function spawnHordeMonster() {
    const spot = findSpawnPoint(-95); // right at the edge of the view, so the rising horde is visible
    if (!spot) return false;
    const types = Object.keys(typesFor());
    const before = state.enemies.length;
    addEnemy(pick(types));
    if (state.enemies.length === before) return false;
    const e = state.enemies[state.enemies.length - 1];
    e.x = e.lastX = spot.x;
    e.y = e.lastY = spot.y;
    e.horde = true;
    e.rising = 0.6;
    setBurn(e);
    addParticle(e.x, e.y + 8, "#5a4532", 8, 0.8);
    return true;
  }
  function updateSunrise(dt) {
    const s = state.sunrise;
    s.t += dt;
    // Horde phase: spawn the last wave over the first two seconds (Hog is already invulnerable).
    const want = Math.min(HORDE_COUNT, Math.floor((s.t / (HORDE_SECONDS * 0.66)) * HORDE_COUNT));
    let guard = 0;
    while (s.hordeSpawned < want && guard++ < 6) {
      if (spawnHordeMonster()) s.hordeSpawned++;
      else break;
    }
    if (s.t >= HORDE_SECONDS && !s.lightStarted) {
      s.lightStarted = true;
      state.eventText = "SUNRISE";
      state.eventUntil = state.t + 3;
      sfx("sunrise_burn", 1, () => audioBeep(330, 0.6, "triangle", 0.04));
    }
    const p = state.player;
    for (const e of [...state.enemies]) {
      e.flash = 0;
      if (e.rising > 0) e.rising -= dt;
      if (s.t < e.burnAt) {
        // shamble toward Grave Hog (harmless now), stopping short of him
        const d = dist(p, e) || 1;
        if (d > e.r + 26 && !(e.rising > 0)) {
          const sp = (e.boss ? 0.4 : 0.55) * e.speed;
          e.vx = ((p.x - e.x) / d) * sp;
          e.vy = ((p.y - e.y) / d) * sp;
          if (e.type === "ghost" || e.fly) ((e.x += e.vx * dt), (e.y += e.vy * dt));
          else moveCircle(e, e.vx * dt, e.vy * dt, e.boss ? 16 : Math.min(e.r, 11));
        } else ((e.vx *= 0.5), (e.vy *= 0.5));
        updateFacing(e);
        continue;
      }
      e.burnT += dt;
      const k = e.burnT / e.burnDur;
      if (Math.random() < 0.6)
        state.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y - rand(0, e.r * 2), vx: rand(-8, 8), vy: rand(-45, -20), life: rand(0.5, 1), max: 1, color: Math.random() < 0.5 ? "#5b5560" : "#8a8290", r: rand(2, 4), float: true });
      if (Math.random() < 0.5)
        state.particles.push({ x: e.x + rand(-e.r * 0.8, e.r * 0.8), y: e.y - rand(0, e.r * 1.6), vx: rand(-10, 10), vy: rand(-60, -30), life: rand(0.2, 0.45), max: 0.45, color: pick(["#ffb347", "#ff7a2f", "#ffe08a"]), r: rand(1.5, 3), float: true });
      if (k >= 1) {
        state.enemies.splice(state.enemies.indexOf(e), 1);
        state.deaths.push({ x: e.x, y: e.y, row: 0, boss: !!e.boss, age: 0, burn: true });
        addParticle(e.x, e.y, "#2b2630", 12, e.boss ? 1.6 : 1);
        s.burned++;
      }
    }
    if (s.countdown === null && !state.enemies.length && s.t >= HORDE_SECONDS + SUNRISE_LIGHT_SECONDS) {
      s.countdown = COUNTDOWN_SECONDS;
      sfx("countdown", 1, () => audioBeep(520, 0.15, "square", 0.03));
    } else if (s.countdown !== null) {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      if (Math.ceil(s.countdown) !== before && s.countdown > 0) sfx("countdown", 1, () => audioBeep(520, 0.12, "square", 0.03));
      if (s.countdown <= 0) {
        s.countdown = 0;
        s.done = true;
        finishRun(true);
      }
    }
  }
  const sunriseLight = () => (state?.sunrise ? clamp((state.sunrise.t - HORDE_SECONDS) / SUNRISE_LIGHT_SECONDS, 0, 1) : mode === "victory" ? 1 : 0);
  // ---- Grave Digger: dig up bones and throw them (replaces his old energy-ball ring) ----
  // Timeline (s): 0-0.5 raise shovel | 0.5-1.0 dig | 1.0-1.35 bones burst out | 1.35-1.7 scoop | 1.7 throw | 1.95 recover
  const BONE = { raise: 0.5, dig: 1.0, burst: 1.35, scoop: 1.7, throwAt: 1.7, end: 1.95 };
  function startBoneThrow(e) {
    const p = state.player,
      a = Math.atan2(p.y - e.y, p.x - e.x);
    e.attack = 99; // the attack timer is held while the sequence plays (no slam telegraph overlap)
    e.bone = { t: 0, a, thrown: false, sx: e.x + Math.cos(a) * 26, sy: e.y + 14 + Math.sin(a) * 10 };
    state.boneThrows = (state.boneThrows || 0) + 1;
    sfx("slam_impact", 0.45, () => audioBeep(140, 0.25, "square", 0.025)); // Digger starts digging
  }
  const CAST_HAND_Y = -40;
  function updateBossCast(e, dt) {
    const p = state.player,
      c = e.cast;
    c.t += dt;
    if (c.t < c.dur * (e.bossId === "king" ? 0.92 : 0.8)) c.a = Math.atan2(p.y - (e.y + CAST_HAND_Y), p.x - e.x); // aim locks for the last 20% (King: 8%)
    e.vx *= Math.pow(0.02, dt);
    e.vy *= Math.pow(0.02, dt);
    if (c.t >= c.dur) {
      e.cast = null;
      fireBossVolley(e, c.a);
    }
  }
  function fireBossVolley(e, a) {
    if (!onScreen(e, -8)) return; // Widow / King never fire from off-screen
    const king = e.bossId === "king",
      ox = e.x + Math.cos(a) * 26,
      oy = e.y + CAST_HAND_Y + Math.sin(a) * 14,
      n = king ? 3 : 5,
      spread = king ? 0.34 : 0.22,
      speed = king ? 140 : 170;
    for (let j = 0; j < n; j++) {
      const aa = a + (j - (n - 1) / 2) * spread;
      state.projectiles.push({
        x: ox,
        y: oy,
        vx: Math.cos(aa) * speed,
        vy: Math.sin(aa) * speed,
        life: 3.2,
        damage: king ? 13 : 9,
        r: king ? 9 : 7,
        enemy: true,
        src: e.bossId,
        fire: king ? "skull" : "blue",
        home: king ? 1.8 : 0, // King's skulls chase Hog for 1.8s
        turn: king ? 2.5 : 0, // ...turning up to 2.5 rad/s (was 1.5 for 1.1s)
        spin: Math.random() * TAU,
        color: king ? "#5dff7a" : "#5fa8ff",
      });
    }
    state.bossVolleys = state.bossVolleys || { widow: 0, king: 0 };
    state.bossVolleys[e.bossId]++;
    sfx("enemy_shot_generic", 1.3, () => (audioBeep(king ? 160 : 520, 0.25, king ? "sawtooth" : "triangle", 0.04), audioBeep(king ? 90 : 780, 0.18, "square", 0.02)));
  }
  function updateBoneThrow(e, dt) {
    const b = e.bone,
      p = state.player;
    b.t += dt;
    e.vx *= Math.pow(0.001, dt); // he plants his feet for the whole sequence
    e.vy *= Math.pow(0.001, dt);
    if (b.t > BONE.raise && b.t < BONE.burst && Math.random() < 0.7)
      state.particles.push({ x: b.sx + rand(-6, 6), y: b.sy, vx: rand(-50, 50), vy: rand(-90, -30), life: rand(0.25, 0.5), max: 0.5, color: pick(["#5a4532", "#7a5a3c", "#3b2c20"]), r: rand(2, 3) });
    if (b.t >= BONE.dig && !b.burstFx) {
      b.burstFx = true;
      shake = Math.max(shake, 4);
      sfx("slam_impact", 0.8, () => audioBeep(90, 0.18, "sawtooth", 0.03));
    }
    if (b.t < BONE.scoop) b.a = Math.atan2(p.y - e.y, p.x - e.x); // keeps tracking Hog until the scoop, then commits
    if (!b.thrown && b.t >= BONE.throwAt) {
      b.thrown = true;
      const n = !onScreen(e, -8) ? 0 : e.hp < e.maxHp * 0.5 ? 4 : 3; // angrier in his second half; never off-screen
      for (let j = 0; j < n; j++) {
        const aa = b.a + (j - (n - 1) / 2) * 0.24;
        state.projectiles.push({ x: e.x + Math.cos(aa) * 20, y: e.y - 10, vx: Math.cos(aa) * 170, vy: Math.sin(aa) * 170, life: 2.6, damage: 11, r: 6, enemy: true, bone: true, spin: Math.random() * TAU, color: "#e8dcc0" });
      }
      sfx("enemy_throw_whoosh", 1, () => audioBeep(260, 0.12, "triangle", 0.03));
    }
    if (b.t >= BONE.end) {
      e.bone = null;
      e.attack = 2.4;
    }
    return false;
  }
  function boneImpact(x, y) {
    for (let i = 0; i < 7; i++) state.particles.push({ x, y, vx: rand(-80, 80), vy: rand(-110, -20), life: rand(0.25, 0.5), max: 0.5, color: i % 3 ? "#e8dcc0" : "#9b8e72", r: rand(1.5, 3) });
    state.impacts = state.impacts || [];
    state.impacts.push({ x, y, t: 0 });
    sfx("shovel_hit", 0.7, () => audioBeep(300, 0.05, "square", 0.02)); // bone lands
  }
  function finishRun(win) {
    if (mode === "victory" || mode === "gameover") return; // results only once per shift
    if (win) {
      musicTrack.pause();
      victoryTrack.volume = save.music;
      victoryTrack.currentTime = 0;
      victoryTrack.play().catch(() => {});
      audioBeep(880, 0.4, "triangle", 0.05);
    } else (sfx("player_death", 1, () => audioBeep(75, 0.3, "sawtooth", 0.035)), playMusic("title"));
    mode = win ? "victory" : "gameover";
    state.endT = 0;
    pendingLevelUps = 0;
    if (win) {
      for (const e of state.enemies) addParticle(e.x, e.y, "#f2d18a", 10, 1.2);
      state.enemies = [];
      state.projectiles = [];
    }
    save.shifts++;
    if (win && STAGE === 1) save.stage2Unlocked = true;
    if (win && STAGE === 2) save.megaMartClears = (save.megaMartClears || 0) + 1;
    save.bestKills = Math.max(save.bestKills, state.kills);
    save.bestLevel = Math.max(save.bestLevel, state.player.level);
    saveGame();
    const LM = state.limitless;
    if (LM) {
      const secs = Math.floor(state.t - LM.t0);
      save.bestLimitless = save.bestLimitless || {};
      LM.best = Math.max(save.bestLimitless[STAGE] || 0, secs);
      LM.newBest = secs > (save.bestLimitless[STAGE] || 0);
      save.bestLimitless[STAGE] = LM.best;
      saveGame();
    }
    const p = state.player,
      headline = LM ? `LIMITLESS: SURVIVED ${fmtMMSS(state.t - LM.t0)}` : win ? (STAGE === 2 ? "MEGA MART CLEARED!" : "SHIFT COMPLETE!") : "YOU GOT CLOCKED",
      endMode = mode;
    // the results card can be reopened (BACK from the office), so the run is never lost by visiting the office
    resultsView = () => {
    mode = endMode;
    menuBack = "results";
    panelShow(
      `<div class="eyebrow">${LM ? "THE NIGHT NEVER ENDS" : win ? "SUNRISE, FINALLY" : "THE NIGHT GOT YOU"}</div><h2>${headline}</h2>${LM ? `<p class="status-line">${LM.bosses} BOSSES BEATEN · ${LM.paid} LIMITLESS WAGES · BEST ${fmtMMSS(LM.best)}${LM.newBest ? " — NEW BEST!" : ""}</p>` : ""}<p>${LM ? "Grave Hog finally drops. Somebody else can cover the rest of this shift." : win ? (STAGE === 2 ? "The store lights flicker off. The aisles are quiet. Grave Hog has earned a nap." : "Grave Hog punches the timecard. The monsters burn off in the morning light.") : "Management has been notified. Management does not care."}</p><p class="status-line">${win ? "6:00 AM" : formatClock(state.clock)} · ${state.kills} KILLS · LEVEL ${p.level}<br>${state.bosses} BOSSES · ${state.earned} WAGES EARNED · ${Math.round(state.damageTaken)} DAMAGE TAKEN</p>${damageBreakdownHTML()}`,
    );
    const stageNow = STAGE;
    // v10 order: sunrise -> countdown -> results card -> CONTINUE -> outro panels -> next stage / ending screen.
    addButtons(
      panel.firstElementChild,
      LM
        ? [
            // Limitless only starts after a stage win, so the next stage (or the ending) is still earned
            [stageNow === 1 ? "CONTINUE TO STAGE 2 ▶" : "SEE THE ENDING ▶", () => ((resultsView = null), stageNow === 1 ? showSlides(1, () => startRun(2)) : showSlides(2, showEnding)), "primary"],
            ["MAINTENANCE OFFICE", () => showOffice("results")],
            ["TITLE", () => ((resultsView = null), showTitle())],
          ]
        : win
        ? [
            [stageNow === 1 ? "CONTINUE TO STAGE 2 ▶" : "CONTINUE ▶", () => ((resultsView = null), stageNow === 1 ? showSlides(1, () => startRun(2)) : showSlides(2, showEnding)), "primary"],
            ["☠ LIMITLESS MODE", () => ((resultsView = null), startLimitless()), "danger"],
            ["MAINTENANCE OFFICE", () => showOffice("results")],
          ]
        : [
            [stageNow === 2 ? "TRY THE MEGA MART AGAIN" : "ANOTHER SHIFT", () => ((resultsView = null), startRun(stageNow)), "primary"],
            ["MAINTENANCE OFFICE", () => showOffice("results")],
            ["TITLE", () => ((resultsView = null), showTitle())],
          ],
    );
    };
    resultsView();
  }
  // Results: damage dealt by each weapon this shift, biggest first, as little bars
  const weaponName = (id) => (id === "shovel" ? "Shovel" : id === "other" ? "Other" : UPGRADES.find((u) => u.id === id)?.title || id);
  function damageBreakdownHTML(max = 6) {
    const rows = Object.entries(state.dmgBy || {})
      .filter(([, v]) => v >= 1)
      .sort((a, b) => b[1] - a[1]);
    if (!rows.length) return "";
    const total = rows.reduce((a, [, v]) => a + v, 0),
      top = rows[0][1],
      shown = rows.slice(0, max),
      rest = rows.slice(max).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) shown.push(["__rest", rest]);
    return `<div class="dmg-break"><div class="dmg-title">DAMAGE BY WEAPON · ${Math.round(total).toLocaleString()} TOTAL</div>${shown
      .map(([id, v]) => {
        const pct = Math.round((v / total) * 100),
          w = Math.max(2, Math.round((v / top) * 100));
        return `<div class="dmg-row"><span class="dmg-name">${id === "__rest" ? "Everything else" : weaponName(id)}</span><span class="dmg-bar"><i style="width:${w}%"></i></span><span class="dmg-val">${Math.round(v).toLocaleString()} <em>${pct}%</em></span></div>`;
      })
      .join("")}</div>`;
  }
  // ---- LIMITLESS MODE: after a stage win, the night keeps going. A random boss of this stage every minute,
  // half XP, and a paycheck every minute that grows the longer Hog survives. Ends when Hog drops. ----
  const LIMITLESS_FIRST_BOSS = 20,
    LIMITLESS_BOSS_EVERY = 60,
    LIMITLESS_XP = 0.5,
    LIMITLESS_PAY_STEP = 15; // paycheck for minute n = 15 * n wages
  const fmtMMSS = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  function startLimitless() {
    if (!state) return;
    state.limitless = { t0: state.t, nextBoss: LIMITLESS_FIRST_BOSS, nextPay: 60, minute: 0, bosses: 0, paid: 0 };
    if (state.clockBoom) state.clockBoom.at = Math.min(state.clockBoom.at, state.t - 10); // the 6 AM blast never replays
    state.sunrise = null;
    state.endT = 0;
    state.enemies = [];
    state.projectiles = [];
    pendingLevelUps = 0;
    try {
      victoryTrack.pause();
    } catch (e) {}
    playMusic(STAGE === 2 ? "stage2" : "stage1");
    mode = "playing";
    panelHide();
    state.eventText = "LIMITLESS MODE";
    state.eventUntil = state.t + 4;
    toastMsg("LIMITLESS: a boss every minute, half XP, and a bigger paycheck every minute you survive.");
  }
  function updateLimitless() {
    const L = state.limitless,
      el = state.t - L.t0;
    if (el >= L.nextBoss) {
      L.nextBoss += LIMITLESS_BOSS_EVERY;
      const id = pick(BOSS_TIMES[STAGE].map((b) => b[0])),
        spot = findSpawnPoint(20);
      addEnemy(null, id);
      const b = state.enemies[state.enemies.length - 1];
      if (b && b.bossId === id) {
        if (spot) ((b.x = spot.x), (b.y = spot.y));
        b.engaged = true; // no arena waiting in Limitless: it comes straight for Hog
        b.limitless = true;
      }
      toastMsg(`LIMITLESS: ${BOSS[id].name} crashes the shift!`);
      shake = Math.max(shake, 9);
      sfx("slam_impact", 1.2, () => audioBeep(60, 0.5, "sawtooth", 0.07));
    }
    if (el >= L.nextPay) {
      L.nextPay += 60;
      L.minute++;
      const pay = LIMITLESS_PAY_STEP * L.minute;
      save.wages += pay;
      state.earned += pay;
      L.paid += pay;
      saveGame();
      toastMsg(`LIMITLESS PAYCHECK: minute ${L.minute} survived, +${pay} wages.`);
      sfx("pickup", 1.4, () => audioBeep(880, 0.15, "triangle", 0.04));
    }
  }
  function formatClock(hour) {
    const mins = Math.floor((hour % 1) * 60),
      whole = Math.floor(hour),
      h = whole % 12 || 12;
    return `${h}:${String(mins).padStart(2, "0")} AM`;
  }
  function showPause() {
    if (!state) return showTitle();
    mode = "paused";
    menuBack = "pause";
    panelShow(
      `<div class="eyebrow">UNPAID BREAK · ${GAME_VERSION}</div><h2>SHIFT PAUSED</h2><p class="status-line">${formatClock(state.clock)} · LEVEL ${state.player.level} · ${state.kills} KILLS</p>${document.body.classList.contains("touch") ? "" : `<p class="muted">📸 Taking a screenshot? Press <b>P</b> during play instead: it freezes the action with no menu in the way.</p>`}`,
    );
    addButtons(panel.firstElementChild, [
      ["BACK TO IT", resumeGame, "primary"],
      ["STATS", showStats],
      ["COMPENDIUM", () => showCompendium("w", "pause")],
      ["OPTIONS", () => showOptions("pause")],
      ["MAINTENANCE OFFICE", () => showOffice("pause")],
      ["QUIT SHIFT", () => finishRun(false), "danger"],
    ]);
  }
  // Stats screen (pause menu): every stat with its sources. Gold = permanent (Maintenance Office),
  // teal = this shift only (level-up picks, treasure, fountain blessing). Totals are read from Hog's real stats,
  // so anything that changes a stat shows up here even if it isn't listed as a source.
  function showStats() {
    if (!state) return showTitle();
    mode = "stats";
    menuBack = "pause";
    const p = state.player,
      P = save.perks,
      B = state.bonus || {},
      pc = (v) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`,
      cell = (v, cls) => (v ? `<td class="${cls}">${v}</td>` : `<td class="none">—</td>`),
      nz = (v, f) => (Math.abs(v) > 0.004 ? f(v) : ""),
      rows = [],
      // percent stats: TOTAL is the real multiplier; SHIFT is whatever's left after base + office, so each row adds up
      pctRow = (name, offFrac, totalFrac) => {
        const tot = Math.round(totalFrac * 100),
          off = Math.round(offFrac * 100),
          tmp = tot - 100 - off;
        add(name, "100%", off ? `+${off}%` : "", tmp ? `${tmp > 0 ? "+" : ""}${tmp}%` : "", `${tot}%`);
      };
    const add = (name, base, perm, temp, total) => rows.push(`<tr><th>${name}</th><td class="base">${base}</td>${cell(perm, "perm")}${cell(temp, "temp")}<td class="total">${total}</td></tr>`);
    const offHp = P.health * 10,
      tmpHp = Math.round(p.maxHp - p.baseMaxHp);
    add("Max health", "100", offHp ? `+${offHp}` : "", tmpHp ? `${tmpHp > 0 ? "+" : ""}${tmpHp}` : "", Math.round(p.maxHp));
    add("Regen", "0/s", "", p.regen > 0.004 ? `+${p.regen.toFixed(2)}/s` : "", `${p.regen.toFixed(2)}/s`);
    const offDmg = P.damage * 0.05;
    pctRow("Damage", offDmg, p.damage);
    const offSpd = P.speed * 0.04;
    pctRow("Move speed", offSpd, p.speed / 152);
    const wSpd = BONUS_STEP * (B.weapon || 0);
    pctRow("Weapon speed", 0, 1 + wSpd);
    pctRow("XP gain", P.xp * 0.05, 1 + P.xp * 0.05);
    const offMag = P.magnet * 0.08;
    pctRow("Pickup radius", offMag, p.magnet / 78);
    const lb = Math.min(PERK_MAX.limit, P.limit || 0);
    add("Max weapon lv", String(WMAX_BASE), lb ? `+${lb}` : "", "", String(wmax()));
    const ch = Math.min(PERK_MAX.cheese, P.cheese || 0);
    add("Pizza heal", String(PIZZA_BASE), ch ? `+${ch * PIZZA_PER_CHEESE}` : "", "", String(pizzaHeal()));
    const rr = Math.min(PERK_MAX.reroll, P.reroll || 0),
      bb = Math.min(PERK_MAX.banish, P.banish || 0);
    add("Rerolls", String(BASE_REROLLS), rr ? `+${rr}` : "", "", `${state.rerolls} left of ${BASE_REROLLS + rr}`);
    add("Banishes", String(BASE_BANISHES), bb ? `+${bb}` : "", "", `${state.banishes} left of ${BASE_BANISHES + bb}`);
    const notes = [];
    if (p.blessT > 0) notes.push(`Fountain blessing: +35% damage for ${Math.ceil(p.blessT)}s more (included above).`);
    if (state.chests) notes.push(`Chests opened this shift: ${state.chests}.`);
    panelShow(
      `<div class="eyebrow">TIME CARD</div><h2>GRAVE HOG'S STATS</h2><p class="stats-legend"><span class="perm">■ PERMANENT</span><span class="lg-d"> Maintenance Office</span> &nbsp; <span class="temp">■ THIS SHIFT</span><span class="lg-d"> level-ups, treasure, blessings</span></p><table class="stats-table"><thead><tr><th></th><th>BASE</th><th class="perm">OFFICE</th><th class="temp">SHIFT</th><th>TOTAL</th></tr></thead><tbody>${rows.join("")}</tbody></table>${notes.length ? `<p class="muted">${notes.join(" ")}</p>` : ""}<p class="muted">Shift bonuses reset when the next shift starts. Office perks are yours to keep.</p>`,
    );
    addButtons(panel.firstElementChild, [["BACK", showPause, "primary"]]);
  }
  function resumeGame() {
    if (!state) return;
    mode = "playing";
    menuBack = "title";
    panelHide();
  }
  function pauseGame() {
    if (mode === "playing") showPause();
    else if (mode === "paused") resumeGame();
    else if ((mode === "office" || mode === "options" || mode === "stats") && menuBack === "pause" && state) showPause(); // ESC = back
    else if (mode === "compendium" && dexBack === "pause" && state) showPause();
  }
  // =====================================================================================
  //  v10 STAGE 2: MEGA MART — regular enemy behaviours, bosses, gas clouds, projectiles
  // =====================================================================================
  function spawnTypes(any = false) {
    if (STAGE === 1) {
      if (any) return Object.keys(TYPES);
      return state.t < 60 ? ["zombie", "skeleton"] : state.t < 180 ? ["zombie", "skeleton", "hand", "ghost"] : Object.keys(TYPES);
    }
    const early = ["shopper_zombie", "shopper_zombie", "rat_swarm"],
      mid = [...early, "cashier_corpse", "stock_clerk", "mutated_produce"],
      late = [...mid, "cleaning_bot", "security_drone", "shopper_zombie"];
    // forklifts: never more than FORKLIFT_MAX alive at once (testers found big packs of them unfun)
    const forkOk = state.enemies.filter((e) => e.type === "forklift_zombie").length < FORKLIFT_MAX;
    if (any) return forkOk ? [...late, "forklift_zombie"] : late;
    if (state.t < 60) return early;
    if (state.t < 180) return mid;
    return forkOk && state.t > 240 && Math.random() < 0.12 ? ["forklift_zombie"] : late;
  }
  const FORKLIFT_MAX = 2;
  function triggerTestBox() {
    state.testBoxUsed = true;
    state.endedByTestBox = true;
    save.stage2Unlocked = true;
    saveGame();
    pendingLevelUps = 0;
    audioBeep(660, 0.25, "triangle", 0.05);
    showSlides(1, () => startRun(2));
  }
  function enemyShot(e, kind, speed, damage, r, spread = 0, n = 1, color) {
    if (!onScreen(e, -8)) return; // never fire from off-screen
    const p = state.player,
      a0 = Math.atan2(p.y - (e.y - 10), p.x - e.x);
    for (let j = 0; j < n; j++) {
      const a = a0 + (j - (n - 1) / 2) * spread;
      state.projectiles.push({ x: e.x + Math.cos(a) * 14, y: e.y - 10 + Math.sin(a) * 8, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 2.6, damage, r, enemy: true, kind, spin: Math.random() * TAU, color, src: e.bossId || e.type });
    }
    state.s2Shots = state.s2Shots || {};
    state.s2Shots[kind] = (state.s2Shots[kind] || 0) + n;
    // v15: mobs share a handful of sounds on purpose (lasers zap, thrown things whoosh, everything else is a generic shot)
    sfx(kind === "laser" ? "laser_zap" : kind === "box" || kind === "cleaver" ? "enemy_throw_whoosh" : "enemy_shot_generic", 1, () => audioBeep(300, 0.1, "square", 0.025));
  }
  function addCloud(x, y) {
    state.clouds.push({ x, y, r: 38, t: 0, life: 2.6 });
    sfx("gas_hiss");
    state.cloudsMade = (state.cloudsMade || 0) + 1;
  }
  function updateClouds(dt) {
    const p = state.player;
    for (const c of [...state.clouds]) {
      c.t += dt;
      if (c.t > c.life) {
        state.clouds.splice(state.clouds.indexOf(c), 1);
        continue;
      }
      if (c.t > 0.25 && p.invuln <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r * 0.5) {
        state.cloudHits = (state.cloudHits || 0) + 1;
        if (hitPlayer(6, 0.5, 3, "#7dff6a")) return true;
      }
    }
    return false;
  }
  // Regular Stage 2 enemies. Returns true if Grave Hog died.
  function updateEnemy2(e, d, dirX, dirY, dt) {
    const p = state.player,
      def = TYPES2[e.type],
      chase = (m = 2) => ((e.vx += dirX * e.speed * dt * m), (e.vy += dirY * e.speed * dt * m));
    e.animT = Math.max(0, (e.animT || 0) - dt);
    switch (e.type) {
      case "shopper_zombie":
        chase();
        if (d < e.r + p.r + 16 && e.attack <= 0) ((e.attack = 1.2), (e.animT = 0.4));
        break;
      case "rat_swarm":
        chase();
        if (e.attack <= 0 && d < 200) {
          e.attack = 2.2;
          e.animT = 0.33;
          e.vx += dirX * 210;
          e.vy += dirY * 210;
        }
        break;
      case "cashier_corpse":
      case "stock_clerk": {
        // keep a throwing distance; the projectile leaves the hand on attack frame 2 (0.2s at 10fps)
        if (d > 175) chase();
        else if (d < 105) chase(-1.6);
        else ((e.vx += -dirY * e.speed * dt * 0.8 * Math.sign(Math.sin(e.phase))), (e.vy += dirX * e.speed * dt * 0.8 * Math.sign(Math.sin(e.phase))));
        if (e.throwAt > 0 && (e.throwAt -= dt) <= 0) {
          if (e.type === "cashier_corpse") enemyShot(e, "scanner", 190, 8, 6);
          else enemyShot(e, "box", 150, 11, 8);
        }
        if (e.attack <= 0 && d < 270 && onScreen(e)) {
          e.attack = e.type === "cashier_corpse" ? 2.4 : 3.0;
          e.animT = 0.4;
          e.throwAt = 0.2;
        }
        break;
      }
      case "cleaning_bot":
        chase(1.6);
        if (e.attack <= 0 && d < 90) {
          e.attack = 2.8;
          e.animT = 0.4;
          addCloud(e.x + dirX * 26, e.y + dirY * 18);
        }
        break;
      case "mutated_produce":
        if (!e.prime) {
          chase(2.4);
          if (d < 54) ((e.prime = 0.5), (e.animT = 0.5));
        } else {
          e.vx *= Math.pow(0.01, dt);
          e.vy *= Math.pow(0.01, dt);
          e.prime -= dt;
          if (e.prime <= 0) {
            // explode: the explode row is its death and the blast; damage on explode frame 0
            e.exploded = true;
            state.produceBlasts = (state.produceBlasts || 0) + 1;
            for (let i = 0; i < 16; i++) state.particles.push({ x: e.x, y: e.y - 8, vx: rand(-150, 150), vy: rand(-170, 40), life: rand(0.3, 0.6), max: 0.6, color: pick(["#ff9a2a", "#ffd04a", "#6a9a2a", "#c0401a"]), r: rand(2, 4) });
            shake = Math.max(shake, 5);
            sfx("slam_impact", 0.9, () => audioBeep(70, 0.25, "sawtooth", 0.05));
            const hitHog = Math.hypot(p.x - e.x, p.y - e.y) < 66 && p.invuln <= 0;
            killEnemy(e);
            if (hitHog) {
              state.produceBlastHits = (state.produceBlastHits || 0) + 1;
              if (hitPlayer(16, 0.7, 8, "#ff9a2a")) return true;
            }
            return false;
          }
        }
        break;
      case "security_drone": {
        // hovers at a distance, shoots a laser; every third time it flashes the siren and calls two shoppers
        const want = 150,
          k = d > want ? 1 : -1.2;
        e.vx += (dirX * k * 1.4 - dirY * 0.6) * e.speed * dt;
        e.vy += (dirY * k * 1.4 + dirX * 0.6) * e.speed * dt;
        if (e.attack <= 0 && d < 250 && onScreen(e)) {
          e.attack = 2.4;
          e.animT = 0.4;
          e.shots = (e.shots || 0) + 1;
          if (e.shots % 3 === 0) {
            e.siren = 0.6;
            state.sirens = (state.sirens || 0) + 1;
            sfx("alarm_short", 1, () => (audioBeep(980, 0.2, "square", 0.025), setTimeout(() => audioBeep(740, 0.2, "square", 0.025), 200)));
            if (state.enemies.length < 90) for (let i = 0; i < 2; i++) addEnemy("shopper_zombie");
          } else enemyShot(e, "laser", 270, 7, 4, 0, 1, "#ff4a4a");
        }
        if (e.siren > 0) e.siren -= dt;
        break;
      }
      case "forklift_zombie":
        if (e.charge) {
          const c = e.charge;
          c.t += dt;
          e.animT = 0.2;
          if (c.t < 0.6) {
            c.a = Math.atan2(p.y - e.y, p.x - e.x); // revs up, tracking Hog
            e.vx *= Math.pow(0.02, dt);
            e.vy *= Math.pow(0.02, dt);
          } else if (c.t < 1.45) {
            e.vx = Math.cos(c.a) * 330;
            e.vy = Math.sin(c.a) * 330;
            e.damage = 18;
          } else {
            e.charge = null;
            e.damage = def.damage;
            e.attack = 3.5;
          }
        } else {
          chase(1.5);
          if (e.attack <= 0 && d < 290 && onScreen(e)) ((e.charge = { t: 0, a: Math.atan2(p.y - e.y, p.x - e.x) }), (state.forkCharges = (state.forkCharges || 0) + 1));
        }
        break;
    }
    return false;
  }
  // Stage 2 bosses. e.atk = current attack ({type, t, dur, ...}); returns true if Grave Hog died.
  function updateBoss2(e, d, dt) {
    const p = state.player;
    if (!e.atk) {
      if (e.attack > 0 || !e.engaged) return false;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.bossId === "produce_horror") {
        if (d < 125) e.atk = { type: "lash", t: 0, dur: 0.95, hitAt: 0.62, a };
        else if (d < 340) e.atk = { type: "spit", t: 0, dur: 0.85, hitAt: 0.6, a };
        e.attack = 2.3;
      } else if (e.bossId === "cart_beast") {
        if (d < 100) e.atk = { type: "grab", t: 0, dur: 0.75, hitAt: 0.45, a };
        else if (d < 400) e.atk = { type: "ram", t: 0, dur: 1.7, hitAt: 0.7, a };
        e.attack = 2.6;
      } else if (e.bossId === "meat_manager") {
        e.slams = (e.slams || 0) + 1;
        if (d < 160) e.atk = { type: "slam", t: 0, dur: 1.05, hitAt: 0.75, a };
        else if (d < 330) e.atk = { type: "cleavers", t: 0, dur: 0.9, hitAt: 0.75, a };
        e.attack = 2.2;
      }
      if (e.atk) {
        state.boss2Attacks = state.boss2Attacks || {};
        state.boss2Attacks[e.atk.type] = (state.boss2Attacks[e.atk.type] || 0) + 1;
      }
      return false;
    }
    const k = e.atk;
    const before = k.t;
    k.t += dt;
    const crossed = before < k.hitAt && k.t >= k.hitAt;
    if (k.type !== "ram" || k.t < k.hitAt) {
      e.vx *= Math.pow(0.02, dt);
      e.vy *= Math.pow(0.02, dt);
      if (k.t < k.hitAt * 0.85) k.a = Math.atan2(p.y - e.y, p.x - e.x); // aim locks shortly before the hit
    }
    const hog = (r, cx = e.x, cy = e.y) => p.invuln <= 0 && Math.hypot(p.x - cx, p.y - cy) < r;
    if (k.type === "lash" && crossed) {
      for (let i = 0; i < 18; i++) state.particles.push({ x: e.x + Math.cos((i / 18) * TAU) * 90, y: e.y + Math.sin((i / 18) * TAU) * 50, vx: 0, vy: -20, life: 0.3, max: 0.3, color: "#5aa83a", r: 3, float: true });
      shake = Math.max(shake, 5);
      if (hog(108)) {
        state.boss2Hits = (state.boss2Hits || 0) + 1;
        if (hitPlayer(16, 0.7, 7, "#8fbf4a")) return true;
      }
    } else if (k.type === "spit" && crossed) {
      enemyShot(e, "seed", 175, 9, 6, 0.18, 7, "#c8a040");
    } else if (k.type === "grab" && crossed) {
      if (hog(104)) {
        state.boss2Hits = (state.boss2Hits || 0) + 1;
        const dd = Math.hypot(e.x - p.x, e.y - p.y) || 1; // tentacles yank Hog in a little
        moveCircle(p, ((e.x - p.x) / dd) * 28, ((e.y - p.y) / dd) * 28, 12);
        if (hitPlayer(13, 0.7, 6, "#c45a3a")) return true;
      }
    } else if (k.type === "ram" && k.t >= k.hitAt && k.t < k.hitAt + 0.85) {
      e.vx = Math.cos(k.a) * 380;
      e.vy = Math.sin(k.a) * 380;
      e.ramming = true;
      if (Math.random() < 0.5) state.particles.push({ x: e.x + rand(-20, 20), y: e.y + 20, vx: -e.vx * 0.1, vy: -10, life: 0.4, max: 0.4, color: "#8a8070", r: 3, float: true });
      if (hog(e.r + p.r + 6) && !k.hit) {
        k.hit = true;
        state.boss2Hits = (state.boss2Hits || 0) + 1;
        if (hitPlayer(20, 0.8, 9, "#c45a3a")) return true;
      }
    } else if (k.type === "slam" && crossed) {
      // cleaver_slam hits on frame 3, in front of him
      const cx = e.x + Math.cos(k.a) * 40,
        cy = e.y + Math.sin(k.a) * 26;
      shake = Math.max(shake, 9);
      sfx("slam_impact", 1.2, () => audioBeep(60, 0.3, "sawtooth", 0.06));
      for (let i = 0; i < 14; i++) state.particles.push({ x: cx + rand(-30, 30), y: cy + rand(-10, 10), vx: rand(-90, 90), vy: rand(-120, -30), life: 0.4, max: 0.4, color: i % 2 ? "#9a2a2a" : "#d8d0c0", r: 3 });
      if (e.slams % 2 === 0) enemyShot(e, "cleaver", 160, 10, 7, TAU / 8, 8, "#d8d8e0"); // every other slam throws a ring of cleavers
      if (hog(92, cx, cy)) {
        state.boss2Hits = (state.boss2Hits || 0) + 1;
        if (hitPlayer(22, 0.8, 10, "#e0d0c8")) return true;
      }
    } else if (k.type === "cleavers" && crossed) {
      enemyShot(e, "cleaver", 185, 11, 7, 0.26, 3, "#d8d8e0");
    }
    if (k.t >= k.dur) {
      e.atk = null;
      e.ramming = false;
    }
    return false;
  }
  function drawTestBox(b, camX, camY) {
    const x = Math.round(b.x - camX - b.s / 2),
      y = Math.round(b.y - camY - b.s / 2),
      pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    g.globalAlpha = 0.35 + pulse * 0.25;
    g.fillStyle = "#2f7bff";
    g.fillRect(x, y, b.s, b.s);
    g.globalAlpha = 1;
    g.strokeStyle = "#a8d0ff";
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, b.s - 2, b.s - 2);
    g.font = "bold 7px monospace";
    g.textAlign = "center";
    g.fillStyle = "#e8f2ff";
    g.fillText("TEST", x + b.s / 2, y + b.s / 2 - 1);
    g.fillText("STAGE 2", x + b.s / 2, y + b.s / 2 + 8);
    g.textAlign = "left";
  }
  function drawClouds(camX, camY) {
    for (const c of state.clouds) {
      const k = c.t / c.life,
        a = (k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4)) * 0.45;
      for (let i = 0; i < 5; i++) {
        const ox = Math.cos(i * 1.3 + c.t * 0.8) * 14,
          oy = Math.sin(i * 1.7 + c.t * 0.6) * 8;
        g.globalAlpha = a;
        g.fillStyle = i % 2 ? "#7dff6a" : "#3fbf4a";
        g.beginPath();
        g.ellipse(Math.round(c.x - camX + ox), Math.round(c.y - camY + oy), c.r * 0.7, c.r * 0.45, 0, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  function drawProj2(q, qx, qy) {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(qx - 5, qy + 9, 10, 3);
    g.save();
    g.translate(qx, qy);
    if (q.kind === "laser") {
      g.rotate(Math.atan2(q.vy, q.vx));
      g.fillStyle = "rgba(255,60,60,0.45)";
      g.fillRect(-10, -3, 20, 6);
      g.fillStyle = "#ffd0d0";
      g.fillRect(-8, -1, 16, 2);
    } else if (q.kind === "scanner") {
      g.rotate(q.spin += 0.3);
      g.fillStyle = "#1a1a20";
      g.fillRect(-6, -4, 12, 8);
      g.fillStyle = "#3a3a44";
      g.fillRect(-5, -3, 10, 6);
      g.fillStyle = "#ff3a3a";
      g.fillRect(-4, -1, 8, 2);
    } else if (q.kind === "box") {
      g.rotate((q.spin += 0.12));
      g.fillStyle = "#3a2410";
      g.fillRect(-8, -8, 16, 16);
      g.fillStyle = "#b8824a";
      g.fillRect(-7, -7, 14, 14);
      g.fillStyle = "#d8b07a";
      g.fillRect(-7, -1, 14, 2);
    } else if (q.kind === "seed") {
      g.fillStyle = "#2a1a08";
      g.beginPath();
      g.ellipse(0, 0, 6, 4, Math.atan2(q.vy, q.vx), 0, TAU);
      g.fill();
      g.fillStyle = "#e0c060";
      g.beginPath();
      g.ellipse(0, 0, 4.5, 2.6, Math.atan2(q.vy, q.vx), 0, TAU);
      g.fill();
    } else if (q.kind === "cleaver") {
      g.rotate((q.spin += 0.35));
      g.fillStyle = "#20140c";
      g.fillRect(-9, -6, 18, 11);
      g.fillStyle = "#d8d8e0";
      g.fillRect(-8, -5, 11, 9);
      g.fillStyle = "#8a1a1a";
      g.fillRect(-8, 2, 6, 2);
      g.fillStyle = "#5a3a20";
      g.fillRect(3, -2, 6, 3);
    }
    g.restore();
  }
  function drawEnemy2(e, sx, sy, flip) {
    const im = IMAGES["mm_" + e.type],
      def = TYPES2[e.type];
    if (!ready(im)) return;
    const fs = def.size,
      [ax, ay] = def.anchor,
      dx = Math.round(sx - ax),
      dy = Math.round(sy + 13 - ay);
    let row = 0,
      frame = Math.floor(state.t * (e.type === "rat_swarm" ? 12 : e.type === "security_drone" ? 10 : 8) + (e.phase || 0)) % 4;
    if (e.prime) ((row = 1), (frame = Math.min(3, Math.floor((0.5 - e.prime) * 8))));
    else if (e.charge) ((row = 1), (frame = Math.floor(state.t * 12) % 4));
    else if (e.siren > 0) ((row = 1), (frame = 2 + (Math.floor(state.t * 10) % 2)));
    else if (e.animT > 0) ((row = 1), (frame = Math.min(3, Math.floor((0.4 - e.animT) * 10))));
    if (!def.fly) {
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.beginPath();
      g.ellipse(sx, sy + 13, e.r + 3, e.r * 0.4 + 2, 0, 0, TAU);
      g.fill();
    }
    if (e.charge && e.charge.t < 0.6) {
      // forklift rev-up telegraph: a dashed lane in front of it
      g.strokeStyle = "rgba(255,170,60,0.8)";
      g.setLineDash([5, 4]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(e.charge.a) * 240, sy + Math.sin(e.charge.a) * 240);
      g.stroke();
      g.setLineDash([]);
    }
    if (e.burnT > 0) {
      const k = Math.min(1, e.burnT / e.burnDur);
      g.globalAlpha = 1 - k * 0.75;
      drawTinted(im, frame * fs, row * fs, fs, fs, dx + (Math.random() < 0.5 ? -1 : 1), dy, fs, fs, flip, 0.35 + k * 0.5, k < 0.5 ? "#ff8a3d" : "#2b2630");
      g.globalAlpha = 1;
    } else if (e.flash > 0) drawTinted(im, frame * fs, row * fs, fs, fs, dx, dy, fs, fs, flip, 0.45);
    else if (e.prime && Math.floor(state.t * 16) % 2) drawTinted(im, frame * fs, row * fs, fs, fs, dx, dy, fs, fs, flip, 0.35, "#ff5a2a");
    else blit(im, frame * fs, row * fs, fs, fs, dx, dy, fs, fs, flip);
    if (e.rising > 0) {
      g.fillStyle = "#2a2420";
      g.beginPath();
      g.ellipse(sx, sy + 12, e.r + 6, 5, 0, 0, TAU);
      g.fill();
    }
  }
  function drawBoss2Telegraph(e, sx, sy) {
    const k = e.atk;
    if (!k || k.t >= k.hitAt) return;
    const f = k.t / k.hitAt;
    g.save();
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    if (k.type === "lash") {
      g.strokeStyle = `rgba(140,220,90,${0.4 + f * 0.5})`;
      g.beginPath();
      g.ellipse(sx, sy + 8, 108 * f, 62 * f, 0, 0, TAU);
      g.stroke();
    } else if (k.type === "slam") {
      const cx = sx + Math.cos(k.a) * 40,
        cy = sy + Math.sin(k.a) * 26;
      g.strokeStyle = `rgba(255,90,70,${0.4 + f * 0.5})`;
      g.fillStyle = `rgba(200,30,20,${0.12 + f * 0.18})`;
      g.beginPath();
      g.ellipse(cx, cy + 8, 92, 56, 0, 0, TAU);
      g.fill();
      g.stroke();
    } else if (k.type === "grab") {
      g.strokeStyle = `rgba(255,130,80,${0.4 + f * 0.5})`;
      g.beginPath();
      g.arc(sx, sy, 104, 0, TAU);
      g.stroke();
    } else {
      // ram / spit / cleavers: aim line toward Hog
      g.strokeStyle = k.type === "ram" ? "rgba(255,170,60,0.85)" : "rgba(240,220,140,0.75)";
      const len = k.type === "ram" ? 330 : 120;
      g.beginPath();
      g.moveTo(sx, sy - 10);
      g.lineTo(sx + Math.cos(k.a) * len, sy - 10 + Math.sin(k.a) * len);
      g.stroke();
      if (k.type !== "ram") {
        g.setLineDash([]);
        g.fillStyle = "#ffe08a";
        g.font = "bold 14px monospace";
        g.textAlign = "center";
        g.fillText("!", sx, sy - 100);
      }
    }
    g.restore();
  }
  // =====================================================================================
  //  RENDERING
  //  World -> low-res buffer (1 buffer px = 1 world px, integer camera) -> integer upscale.
  // =====================================================================================
  const view = document.createElement("canvas");
  view.width = Math.ceil(BASE_VIEW_W * ZOOM_STEPS[ZOOM_STEPS.length - 1]) + 2;
  view.height = Math.ceil(BASE_VIEW_H * ZOOM_STEPS[ZOOM_STEPS.length - 1]) + 2;
  // Ease the zoom between wheel steps; the visible size is always whole buffer pixels.
  function updateZoom(dt) {
    const target = ZOOM_STEPS[zoomIndex];
    zoomCur += (target - zoomCur) * Math.min(1, dt * 9);
    if (Math.abs(target - zoomCur) < 0.004) zoomCur = target;
    VIEW_W = Math.min(WORLD_W, Math.round(BASE_VIEW_W * zoomCur));
    VIEW_H = Math.min(WORLD_H, Math.round((VIEW_W * H) / W));
  }
  const viewScale = () => W / VIEW_W;
  const g = view.getContext("2d");
  g.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  const tintCanvas = document.createElement("canvas");
  tintCanvas.width = tintCanvas.height = 160;
  const tctx = tintCanvas.getContext("2d");
  // Draw a sprite region with a white overlay (intentional damage flash: the sprite never disappears).
  function drawTinted(img, sx, sy, sw, sh, dx, dy, dw, dh, flip, amount, color = "#ffffff") {
    tctx.clearRect(0, 0, sw, sh);
    tctx.globalCompositeOperation = "source-over";
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    tctx.globalCompositeOperation = "source-atop";
    tctx.globalAlpha = amount;
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, sw, sh);
    tctx.globalAlpha = 1;
    tctx.globalCompositeOperation = "source-over";
    blit(tintCanvas, 0, 0, sw, sh, dx, dy, dw, dh, flip);
  }
  function blit(img, sx, sy, sw, sh, dx, dy, dw, dh, flip) {
    if (!flip) {
      g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    g.save();
    g.translate(dx + dw, dy);
    g.scale(-1, 1);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    g.restore();
  }
  // ---- Ground chunk cache (LRU). Chunks are pure functions of the map, so they never shimmer or seam.
  const chunkCache = new Map();
  let chunkBuilds = 0;
  const wob = (x, y) => Math.round(5 * Math.sin(y * 0.09 + x * 0.031) + 4 * Math.sin(x * 0.13 - y * 0.05));
  function subType(wx, wy) {
    return groundTile(Math.floor((wx + wob(wx, wy)) / TILE), Math.floor((wy + wob(wy + 17, wx)) / TILE));
  }
  function getChunk(cx, cy) {
    const key = cx + "," + cy;
    let c = chunkCache.get(key);
    if (c) {
      chunkCache.delete(key);
      chunkCache.set(key, c);
      return c;
    }
    if (!ready(groundTexture)) return null;
    c = document.createElement("canvas");
    c.width = c.height = CHUNK;
    const cc = c.getContext("2d");
    cc.imageSmoothingEnabled = false;
    const S = 8,
      N = CHUNK / S,
      types = new Uint8Array((N + 2) * (N + 2));
    for (let j = -1; j <= N; j++)
      for (let i = -1; i <= N; i++) types[(j + 1) * (N + 2) + (i + 1)] = subType(cx * CHUNK + i * S + 4, cy * CHUNK + j * S + 4);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const wx = cx * CHUNK + i * S,
          wy = cy * CHUNK + j * S,
          t = types[(j + 1) * (N + 2) + (i + 1)];
        cc.drawImage(groundTexture, t * GROUND_T + (wx % GROUND_T), wy % GROUND_T, S, S, i * S, j * S, S, S);
        // Paths get a dark lip where they meet grass: readable edges without busy texture.
        if (PATHLIKE.has(t)) {
          cc.fillStyle = "rgba(0,0,0,0.32)";
          if (!PATHLIKE.has(types[j * (N + 2) + (i + 1)])) cc.fillRect(i * S, j * S, S, 2);
          if (!PATHLIKE.has(types[(j + 1) * (N + 2) + i])) cc.fillRect(i * S, j * S, 1, S);
          if (!PATHLIKE.has(types[(j + 1) * (N + 2) + (i + 2)])) cc.fillRect(i * S + S - 1, j * S, 1, S);
        }
      }
    // Flat decals (open graves, shadows, dirt piles, fountain pavement) are baked into the chunk.
    const x0 = cx * CHUNK,
      y0 = cy * CHUNK;
    for (const pr of WORLD.flat) {
      if (pr.x + pr.w / 2 < x0 || pr.x - pr.w / 2 > x0 + CHUNK || pr.y < y0 || pr.y - pr.h > y0 + CHUNK) continue;
      drawPropTo(cc, pr, pr.x - x0, pr.y - y0);
    }
    for (const pr of WORLD.tall) {
      if (!KINDS[pr.kind].fountain) continue;
      if (pr.x + pr.w / 2 < x0 || pr.x - pr.w / 2 > x0 + CHUNK || pr.y < y0 || pr.y - pr.h > y0 + CHUNK) continue;
      drawPropTo(cc, pr, pr.x - x0, pr.y - y0); // whole fountain as ground; its statue is redrawn depth-sorted
    }
    chunkCache.set(key, c);
    chunkBuilds++;
    while (chunkCache.size > 40) chunkCache.delete(chunkCache.keys().next().value);
    return c;
  }
  function drawPropTo(target, pr, bx, by, alpha = 1) {
    const k = KINDS[pr.kind];
    const img = k.img ? IMAGES[k.img] : IMAGES[k.src[0]];
    if (!ready(img)) return;
    if (alpha < 1) target.globalAlpha = alpha;
    if (k.img) target.drawImage(img, Math.round(bx - pr.w / 2), Math.round(by - pr.h));
    else target.drawImage(img, k.src[1], k.src[2], k.src[3], k.src[4], Math.round(bx - 32), Math.round(by - 64), 64, 64);
    if (alpha < 1) target.globalAlpha = 1;
  }
  // ---- Grave Hog ----
  const HOG_ROWS = {
    idle: 0,
    down: 1,
    up: 2,
    left: 3,
    right: 4,
    shovel: 5,
    nail: 6,
    chainsaw: 7,
    water: 6,
    hurt: 8,
    death: 9,
    victory: 10,
    flex: 10,
    taunt: 11,
  };
  const IDLE_FRAME = 0.35, // idle-front breathing frame time (s)
    TAUNT_AFTER = 6, // seconds standing still before a taunt
    TAUNT_EVERY = 9,
    TAUNT_FRAME = 0.6;
  let hogDebug = null;
  function hogAnimState() {
    const p = state?.player;
    if (!p) return { row: 0, frame: Math.floor(performance.now() / 500) % 4, flip: false, label: "title-idle" };
    if (mode === "gameover") return { row: 9, frame: Math.min(3, Math.floor(state.endT * 6)), flip: false, label: "death" };
    if (mode === "victory") return { row: 10, frame: Math.floor(state.endT * 4) % 4, flip: false, label: "victory" };
    // v7: during the sunrise + countdown he flexes (walking still shows the walk cycle)
    if (state.sunrise && !p.moving) return { row: 10, frame: Math.floor(state.sunrise.t * 4) % 4, flip: false, label: "flex" };
    if (p.hurtAnim > 0)
      return { row: 8, frame: Math.min(3, Math.floor((0.22 - p.hurtAnim) / 0.055)), flip: p.dir === "left", label: "hurt" };
    const pose = p.pose;
    const poseState = () => {
      const k = pose.t / pose.dur;
      // shovel: frame 0 wind-up (0-0.08s), frame 1 strike (damage lands), 2-3 follow-through.
      // nail: starts on the barrel-forward frame (1) when the nail is fired, then recoil 2-3.
      const frame = pose.type === "shovel" ? (pose.t < SWING_HIT ? 0 : Math.min(3, 1 + Math.floor(((pose.t - SWING_HIT) / (pose.dur - SWING_HIT)) * 3))) : pose.type === "nail" ? Math.min(3, 1 + Math.floor(k * 3)) : Math.min(3, Math.floor(k * 4));
      return { row: HOG_ROWS[pose.type], frame, flip: Math.cos(pose.aim) < 0, label: "attack-" + pose.type };
    };
    if (pose && (pose.type === "shovel" || pose.type === "nail")) return poseState();
    if (p.moving) return { row: DIRS[p.dir], frame: Math.floor(p.stride / 10) % 4, flip: false, label: "walk-" + p.dir };
    if (pose) return poseState();
    const it = p.idleT || 0;
    if (it >= TAUNT_AFTER) {
      const ph = (it - TAUNT_AFTER) % TAUNT_EVERY;
      if (ph < TAUNT_FRAME * 4) return { row: 11, frame: Math.floor(ph / TAUNT_FRAME), flip: false, label: "taunt" };
    }
    if (p.dir === "down") return { row: 0, frame: Math.floor(it / IDLE_FRAME) % 4, flip: false, label: "idle-front" };
    return { row: DIRS[p.dir], frame: 1, flip: false, label: "idle-" + p.dir };
  }
  // Graveyard Sprinkler hat. HAT_ANCHOR[row][frame] = [x, y] in the 64px Hog frame: x = centre of the mohawk,
  // y = where the cap's brim sits (measured from the sheet, one per frame so the hat rides every animation).
  // Rows whose art faces right get a mirrored hat so the brim always points the way Hog looks.
  const HAT_ANCHOR = [[[31, 22], [30, 21], [30, 21], [31, 20]], [[33, 25], [31, 22], [30, 22], [32, 22]], [[32, 22], [31, 22], [31, 23], [31, 23]], [[28, 21], [27, 20], [26, 19], [28, 20]], [[35, 21], [36, 20], [37, 19], [35, 20]], [[26, 23], [29, 25], [34, 20], [37, 17]], [[28, 19], [26, 21], [27, 23], [28, 21]], [[33, 17], [30, 17], [28, 19], [35, 17]], [[19, 20], [27, 16], [22, 14], [28, 13]], [[23, 43], [26, 40], [29, 47], [29, 47]], [[32, 20], [32, 18], [34, 19], [31, 22]], [[31, 22], [35, 20], [32, 22], [30, 21]]],
    HAT_W = 31,
    HAT_H = 30,
    HAT_AX = 16, // hat art: pipe hub x
    HAT_AY = 29, // hat art: brim bottom
    HAT_NOZZLE_Y = 5, // hat art: where the water comes out (pipe hub)
    HAT_RIGHT_ROWS = [4, 5, 6, 7];
  function hatPose(a) {
    const [bx, by] = HAT_ANCHOR[a.row]?.[a.frame] || [32, 21],
      mirror = HAT_RIGHT_ROWS.includes(a.row) !== !!a.flip,
      x = a.flip ? 63 - bx : bx;
    return { x, y: by, mirror };
  }
  // world-space offset of the hat's nozzle from Hog's collision centre (water + damage come from here)
  function hatNozzle() {
    if (!state?.player) return [0, -46];
    const h = hatPose(hogAnimState());
    return [h.x - 32, h.y - 48 - HAT_AY + HAT_NOZZLE_Y];
  }
  function drawHat(dx, dy, a, flash = 0) {
    if (!ready(IMAGES.hat)) return;
    const h = hatPose(a),
      fr = Math.floor(performance.now() / 110) % 2, // the pipe head spins
      ax = h.mirror ? HAT_W - 1 - HAT_AX : HAT_AX;
    const args = [IMAGES.hat, fr * HAT_W, 0, HAT_W, HAT_H, dx + h.x - ax, dy + h.y - HAT_AY, HAT_W, HAT_H, h.mirror];
    if (flash > 0) drawTinted(...args, flash); // flashes with Hog when he's hit
    else blit(...args);
  }
  function drawHog(sx, sy) {
    const a = hogAnimState(),
      p = state?.player,
      dx = sx - 32,
      dy = sy - 48; // anchor: collision centre; feet baseline lands 14px below it
    hogDebug = { ...a, dx, dy, w: 64, h: 64, drawn: false };
    if (!ready(hogSheet)) return;
    const flash = p && p.invuln > 0 && p.hurtAnim <= 0 ? (Math.floor(p.invuln * 10) % 2 ? 0.45 : 0) : p && p.hurtAnim > 0 ? 0.55 : 0;
    // soft contact shadow keeps him grounded
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(sx, sy + 13, 15, 5, 0, 0, TAU);
    g.fill();
    if (flash > 0) drawTinted(hogSheet, a.frame * 64, a.row * 64, 64, 64, dx, dy, 64, 64, a.flip, flash);
    else blit(hogSheet, a.frame * 64, a.row * 64, 64, 64, dx, dy, 64, 64, a.flip);
    if (p && state.weapons.gsprinkler?.level) drawHat(dx, dy, a, flash);
    hogDebug.drawn = true;
    // Shovel sweep: appears on the strike frame (when the damage is applied) and fades over the follow-through.
    if (p && p.pose?.type === "shovel" && p.pose.t >= SWING_HIT && ready(weaponFx)) {
      const k = (p.pose.t - SWING_HIT) / (p.pose.dur - SWING_HIT);
      g.save();
      g.globalAlpha = 0.85 * (1 - k * 0.7);
      g.translate(sx, sy - 6);
      g.rotate(p.pose.aim - 0.5 + k * 1.0);
      g.drawImage(weaponFx, 0, 128, 64, 64, 4, -30, 58, 58);
      g.restore();
    }
    // Nail gun muzzle flash, at the barrel, on the firing frame.
    if (p && p.muzzle) {
      const mx = Math.round(sx + Math.cos(p.muzzle.a) * 20),
        my = Math.round(sy - 6 + Math.sin(p.muzzle.a) * 14);
      g.fillStyle = "#fff3b0";
      g.fillRect(mx - 3, my - 3, 6, 6);
      g.fillStyle = "#ffb347";
      g.fillRect(mx - 5, my - 1, 10, 2);
      g.fillRect(mx - 1, my - 5, 2, 10);
    }
  }
  // ---- Enemies ----
  function bossFrame(e) {
    if (e.s2) {
      const base = BOSS[e.bossId].idx * 3;
      if (e.atk) {
        const k = clamp(e.atk.t / e.atk.dur, 0, 0.999);
        if (e.bossId === "meat_manager") return [base + 1, Math.min(3, Math.floor((e.atk.t / e.atk.hitAt) * 3))];
        const second = e.atk.type === "spit" || e.atk.type === "grab";
        return [base + 1, (second ? 2 : 0) + (k > 0.5 ? 1 : 0)];
      }
      return [base, Math.floor(state.t * 8 + (e.phase || 0)) % 4];
    }
    // Grave Digger (v7 sheet): row 0 idle/walk, row 1 shovel swing, row 2 overhead / dig / dig / scoop, row 3 death.
    if (e.bossId === "digger") {
      const b = e.bone,
        near = e.engaged && dist(e, state.player) < e.r + 60;
      if (b) {
        if (b.t < BONE.raise) return [1, 0]; // stops and raises the shovel
        if (b.t < BONE.dig) return [2, 1 + (Math.floor((b.t - BONE.raise) * 8) % 2)]; // digs
        if (b.t < BONE.burst) return [2, 2]; // bones burst from the disturbed earth
        if (b.t < BONE.scoop) return [2, 3]; // scoops them up
        return [1, Math.min(3, 1 + Math.floor(Math.max(0, b.t - BONE.throwAt) * 9))]; // throws
      }
      if (near && e.attack < 0.42) return [2, 0]; // slam wind-up: shovel overhead
      if (near && e.attack > 1.85) return [1, Math.min(3, 1 + Math.floor((2.2 - e.attack) * 9))]; // slam follow-through
      return [0, Math.floor(state.t * 6 + (e.phase || 0)) % 4];
    }
    return [e.bossId === "widow" ? 0 : 1, Math.floor(state.t * 6 + (e.phase || 0)) % 4];
  }
  function drawEnemy(e, sx, sy) {
    const flip = !!e.faceLeft;
    if (e.boss) {
      const sheet = e.s2 ? IMAGES.mmBoss : e.bossId === "digger" ? diggerSheet : bossSheet;
      if (!ready(sheet)) return;
      const [row, frame] = bossFrame(e),
        bsc = BOSS[e.bossId]?.scale || 1, // per-boss draw scale (Cart Beast is 10% bigger); feet stay on the baseline
        S = BOSS_CELL,
        D = Math.round(S * bsc),
        dx = sx - D / 2,
        dy = Math.round(sy + 25 - BOSS_BASE * bsc);
      if (e.burnT > 0) {
        const k = Math.min(1, e.burnT / e.burnDur);
        g.globalAlpha = 1 - k * 0.7;
        drawTinted(sheet, frame * S, row * S, S, S, dx, dy, D, D, flip, Math.min(0.85, 0.35 + k * 0.5), k < 0.5 ? "#ff8a3d" : "#2b2630");
        g.globalAlpha = 1;
      } else {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.beginPath();
        g.ellipse(sx, sy + 26, 34 * bsc, 9 * bsc, 0, 0, TAU);
        g.fill();
        if (e.flash > 0) drawTinted(sheet, frame * S, row * S, S, S, dx, dy, D, D, flip, 0.45);
        else blit(sheet, frame * S, row * S, S, S, dx, dy, D, D, flip);
      }
      if (e.s2) drawBoss2Telegraph(e, sx, sy);
      if (e.bone) drawBoneDig(e, e.bone);
      if (e.cast) drawCastTelegraph(e, sx, sy);
      if (e.bossId === "digger" && e.attack < 0.42 && e.engaged && !e.bone && dist(e, state.player) < e.r + 60) {
        g.strokeStyle = "#f1bd69";
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.beginPath();
        if (e.bossId === "digger") g.ellipse(sx, sy + 10, 52 + (0.42 - e.attack) * 24, 30 + (0.42 - e.attack) * 14, 0, 0, TAU);
        else g.arc(sx, sy, e.r + 11 + (0.42 - e.attack) * 12, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      if (false) {
        g.strokeStyle = "#f1bd69";
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.arc(sx, sy, e.r + 11 + (0.42 - e.attack) * 12, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      return;
    }
    if (e.s2) return drawEnemy2(e, sx, sy, flip);
    if (!ready(enemySheet)) return;
    const map = { zombie: 0, skeleton: 1, hand: 2, ghost: 3, worm: 4, keeper: 5 },
      row = map[e.type],
      frame = Math.floor(state.t * 7 + (e.phase || 0)) % 4,
      size = 64,
      dx = Math.round(sx - size / 2),
      dy = Math.round(sy - size * 0.76);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(sx, sy + size * 0.2, e.r + 3, e.r * 0.4 + 2, 0, 0, TAU);
    g.fill();
    if (e.burnT > 0) {
      const k = Math.min(1, e.burnT / e.burnDur);
      g.globalAlpha = 1 - k * 0.75;
      drawTinted(enemySheet, frame * 64, row * 64, 64, 64, dx + (Math.random() < 0.5 ? -1 : 1), dy, size, size, flip, 0.35 + k * 0.5, k < 0.5 ? "#ff8a3d" : "#2b2630");
      g.globalAlpha = 1;
    } else {
      const ga = e.type === "ghost" ? (e.enraged ? 0.9 : ghostAlpha(e)) : 1;
      if (ga < 1) g.globalAlpha = ga;
      if (e.enraged && !(e.flash > 0)) drawTinted(enemySheet, frame * 64, row * 64, 64, 64, dx, dy, size, size, flip, 0.55, "#ff2a1a");
      else if (e.flash > 0) drawTinted(enemySheet, frame * 64, row * 64, 64, 64, dx, dy, size, size, flip, 0.45);
      else blit(enemySheet, frame * 64, row * 64, 64, 64, dx, dy, size, size, flip);
      g.globalAlpha = 1;
    }
    if (e.rising > 0) {
      // post-King horde: clawing up out of the ground
      g.fillStyle = "#3a2a1c";
      g.beginPath();
      g.ellipse(sx, sy + 12, e.r + 6, 5, 0, 0, TAU);
      g.fill();
    }
    if (e.hp < e.maxHp) {
      g.fillStyle = "#201a21";
      g.fillRect(sx - e.r, dy + 4, e.r * 2, 3);
      g.fillStyle = "#cf6052";
      g.fillRect(sx - e.r, dy + 4, Math.round(e.r * 2 * Math.max(0, e.hp / e.maxHp)), 3);
    }
  }
  // Blue fire (Widow) and green-fire necro skulls (King): layered flame + pixel skull with empty eye sockets.
  function drawFireball(q, qx, qy) {
    const a = Math.atan2(q.vy, q.vx),
      fl = Math.sin(q.spin * 3) * 1.5,
      blue = q.fire === "blue",
      outer = blue ? "rgba(40,90,255,0.45)" : "rgba(30,200,70,0.45)",
      mid = blue ? "#5fa8ff" : "#4dff6e",
      core = blue ? "#e6f4ff" : "#e6ffd8";
    g.save();
    g.translate(qx, qy);
    g.rotate(a);
    g.fillStyle = outer;
    g.beginPath();
    g.ellipse(-q.r * 0.9, 0, q.r * 2 + fl, q.r + 2, 0, 0, TAU); // trailing tail
    g.fill();
    g.fillStyle = mid;
    g.beginPath();
    g.ellipse(-q.r * 0.4, 0, q.r * 1.3 + fl, q.r * 0.85, 0, 0, TAU);
    g.fill();
    g.restore();
    if (blue) {
      g.fillStyle = core;
      g.beginPath();
      g.arc(qx, qy, q.r * 0.5, 0, TAU);
      g.fill();
      return;
    }
    // necro skull, upright
    const x = qx - 5,
      y = qy - 5;
    g.fillStyle = "#16301a";
    g.fillRect(x - 1, y - 1, 12, 11);
    g.fillStyle = core;
    g.fillRect(x, y, 10, 7);
    g.fillRect(x + 2, y + 7, 6, 2);
    g.fillStyle = "#0b1a0d";
    g.fillRect(x + 2, y + 3, 2, 2); // empty sockets
    g.fillRect(x + 6, y + 3, 2, 2);
    g.fillRect(x + 4, y + 6, 2, 1);
    g.fillRect(x + 3, y + 8, 1, 1);
    g.fillRect(x + 6, y + 8, 1, 1);
  }
  function drawCastTelegraph(e, sx, sy) {
    const c = e.cast,
      k = clamp(c.t / c.dur, 0, 1),
      king = e.bossId === "king",
      hx = Math.round(sx + Math.cos(c.a) * 26),
      hy = Math.round(sy + CAST_HAND_Y + Math.sin(c.a) * 14),
      col = king ? "93,255,122" : "95,168,255";
    g.save();
    // aim line(s): where the volley is about to go
    g.strokeStyle = `rgba(${col},${(0.25 + k * 0.5).toFixed(2)})`;
    g.lineWidth = 2;
    g.setLineDash([6, 5]);
    const n = king ? 3 : 5,
      spread = king ? 0.34 : 0.22,
      len = 70 + k * 110;
    for (let j = 0; j < n; j++) {
      const aa = c.a + (j - (n - 1) / 2) * spread;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(Math.round(hx + Math.cos(aa) * len), Math.round(hy + Math.sin(aa) * len));
      g.stroke();
    }
    g.setLineDash([]);
    // charging fireball in the hand
    const r = 4 + k * 9 + Math.sin(state.t * 30) * 1.2;
    g.fillStyle = `rgba(${col},0.35)`;
    g.beginPath();
    g.arc(hx, hy, r + 6, 0, TAU);
    g.fill();
    g.fillStyle = `rgb(${col})`;
    g.beginPath();
    g.arc(hx, hy, r, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(hx, hy, r * 0.4, 0, TAU);
    g.fill();
    if (Math.floor(state.t * 10) % 2) {
      g.font = "bold 20px monospace";
      g.textAlign = "center";
      g.fillStyle = `rgb(${col})`;
      g.fillText("!", Math.round(sx), Math.round(sy - 118));
      g.textAlign = "left";
    }
    g.restore();
  }
  // v7: every monster sprite faces right in the art; flip it to face where it is going / who it is after.
  // Movement decides when it is clear; otherwise face Grave Hog. Dead-zones stop left/right jitter.
  function updateFacing(e) {
    const p = state.player;
    if (e.bone) e.faceLeft = Math.cos(e.bone.a) < 0;
    else if (e.cast) e.faceLeft = Math.cos(e.cast.a) < 0;
    else if (e.atk && e.atk.a !== undefined) e.faceLeft = Math.cos(e.atk.a) < 0;
    else if (e.charge) e.faceLeft = Math.cos(e.charge.a) < 0;
    else if (Math.abs(e.vx) > 14) e.faceLeft = e.vx < 0;
    else if (Math.abs(p.x - e.x) > 10) e.faceLeft = p.x < e.x;
  }
  function drawBoneDig(e, b) {
    const fx = IMAGES.fx6;
    if (!ready(fx)) return;
    const bx = Math.round(b.sx - lastCam.x),
      by = Math.round(b.sy - lastCam.y);
    // readable telegraph: "!" over his head for the whole wind-up, then an aim wedge once the bones are in hand
    if (b.t < BONE.throwAt) {
      const sx = Math.round(e.x - lastCam.x),
        sy = Math.round(e.y - lastCam.y);
      g.fillStyle = Math.floor(b.t * 8) % 2 ? "#ffd84a" : "#ff6b4f";
      g.fillRect(sx - 2, sy - 112, 5, 12);
      g.fillRect(sx - 2, sy - 97, 5, 4);
    }
    if (b.t >= BONE.raise && b.t < BONE.dig) {
      const k = (b.t - BONE.raise) / (BONE.dig - BONE.raise);
      g.drawImage(fx, 192, 32, 64, 32, bx - 16, by - 8, 32, 16); // disturbed earth growing
      g.globalAlpha = k;
      g.drawImage(fx, 192, 32, 64, 32, bx - 24, by - 12, 48, 24);
      g.globalAlpha = 1;
    } else if (b.t >= BONE.dig && b.t < BONE.burst) {
      const k = (b.t - BONE.dig) / (BONE.burst - BONE.dig),
        sz = Math.round(36 + k * 22);
      g.drawImage(fx, 128, 0, 64, 64, bx - sz / 2, by - sz + 6, sz, sz); // bones burst out of the ground
    } else if (b.t >= BONE.burst && b.t < BONE.scoop) {
      g.drawImage(fx, 192, 0, 64, 64, bx - 24, by - 40, 48, 48); // bone pile he scoops up
    }
    if (b.t >= BONE.burst && b.t < BONE.throwAt) {
      const sx = Math.round(e.x - lastCam.x),
        sy = Math.round(e.y - lastCam.y);
      g.save();
      g.translate(sx, sy);
      g.rotate(b.a);
      g.globalAlpha = 0.18 + 0.12 * Math.sin(b.t * 30);
      g.fillStyle = "#ffcf72";
      g.beginPath();
      g.moveTo(10, 0);
      g.arc(10, 0, 150, -0.32, 0.32);
      g.closePath();
      g.fill();
      g.restore();
    }
  }
  function drawDeaths(camX, camY) {
    for (const d of state.deaths) {
      if (d.burn) {
        // ash and smoke where a monster burned away in the sunlight
        const k = d.age / 0.7,
          sx = Math.round(d.x - camX),
          sy = Math.round(d.y - camY);
        g.globalAlpha = clamp(1 - k, 0, 1) * 0.7;
        g.fillStyle = "#4a4450";
        g.beginPath();
        g.ellipse(sx, sy + 6, 10 + k * 8, 4 + k * 2, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#77707c";
        g.beginPath();
        g.arc(sx, sy - 8 - k * 18, 6 + k * 8, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        continue;
      }
      const sx = Math.round(d.x - camX),
        sy = Math.round(d.y - camY);
      if (d.boss) {
        // Digger: his own 4-frame collapse (row 3). Widow / King: sink and fade out. Stage 2 bosses: their death row.
        const S = BOSS_CELL;
        g.globalAlpha = clamp((1.4 + (d.hold || 0) - d.age) / 0.4, 0, 1);
        const dsc = BOSS[d.bossId]?.scale || 1,
          DD = Math.round(S * dsc);
        if (d.s2 && ready(IMAGES.mmBoss)) blit(IMAGES.mmBoss, Math.min(3, Math.floor(d.age * 8)) * S, (BOSS[d.bossId].idx * 3 + 2) * S, S, S, sx - DD / 2, Math.round(sy + 25 - BOSS_BASE * dsc), DD, DD, d.faceLeft);
        else if (d.bossId === "digger" && ready(diggerSheet)) blit(diggerSheet, Math.min(3, Math.floor(d.age * 4)) * S, 3 * S, S, S, sx - S / 2, sy + BOSS_DY, S, S, d.faceLeft);
        else if (ready(bossSheet)) {
          const sink = Math.round(Math.min(1, d.age / 1.2) * 40);
          drawTinted(bossSheet, 0, (d.bossId === "widow" ? 0 : 1) * S, S, S - sink, sx - S / 2, sy + BOSS_DY + sink, S, S - sink, d.faceLeft, Math.min(0.8, d.age), "#f3d67f");
        }
        g.globalAlpha = 1;
      } else if (d.s2) {
        const im = IMAGES["mm_" + d.type],
          def = TYPES2[d.type];
        if (ready(im)) {
          const fs = def.size,
            [ax, ay] = def.anchor,
            fps = d.exploded ? 12 : 8;
          g.globalAlpha = clamp((1.1 - d.age) / 0.4, 0, 1);
          blit(im, Math.min(3, Math.floor(d.age * fps)) * fs, 2 * fs, fs, fs, Math.round(sx - ax), Math.round(sy + 13 - ay), fs, fs, d.faceLeft);
          g.globalAlpha = 1;
        }
      } else if (ready(enemySheet)) {
        g.globalAlpha = clamp(1 - d.age / 0.48, 0, 1);
        blit(enemySheet, 3 * 64, d.row * 64, 64, 64, sx - 32, sy - 49, 64, 64, d.faceLeft);
        g.globalAlpha = 1;
      }
    }
  }
  function cameraFor(px, py) {
    // Slight upward bias: in a three-quarter view tall scenery extends north, so show a little more of it.
    return { x: Math.round(clamp(px - VIEW_W / 2, 0, WORLD_W - VIEW_W)), y: Math.round(clamp(py - CAMERA_BIAS_Y - VIEW_H / 2, 0, WORLD_H - VIEW_H)) };
  }
  const CAMERA_BIAS_Y = 18;
  let lastCam = { x: 0, y: 0 },
    frameStamp = 0;
  function drawWorld(camX, camY) {
    g.fillStyle = "#11161d";
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (STAGE === 2) {
      // Only the 1024px chunks under the camera are drawn (normally 1, at most 4).
      const CS = MAP.chunkSize;
      for (let cy = Math.floor(camY / CS); cy <= Math.floor((camY + VIEW_H - 1) / CS); cy++)
        for (let cx = Math.floor(camX / CS); cx <= Math.floor((camX + VIEW_W - 1) / CS); cx++) {
          const im = megaFloor[cy * 4 + cx];
          if (im && ready(im)) g.drawImage(im, cx * CS - camX, cy * CS - camY);
        }
    } else
      for (let cy = Math.floor(camY / CHUNK); cy <= Math.floor((camY + VIEW_H) / CHUNK); cy++)
        for (let cx = Math.floor(camX / CHUNK); cx <= Math.floor((camX + VIEW_W) / CHUNK); cx++) {
          const c = getChunk(cx, cy);
          if (c) g.drawImage(c, cx * CHUNK - camX, cy * CHUNK - camY);
        }
    if (state && STAGE === 1 && WORLD.testBox && !state.testBoxUsed) drawTestBox(WORLD.testBox, camX, camY);
    if (state && state.clouds.length) drawClouds(camX, camY);
    if (state && STAGE === 2) (drawColdFog(camX, camY), drawMapEdge(camX, camY)); // v14
    // Visible tall props (culled by bucket), depth-sorted with characters by their base Y.
    frameStamp++;
    const list = [];
    for (let cy = Math.floor((camY - 40) / CHUNK); cy <= Math.floor((camY + VIEW_H + 220) / CHUNK); cy++)
      for (let cx = Math.floor((camX - 160) / CHUNK); cx <= Math.floor((camX + VIEW_W + 160) / CHUNK); cx++) {
        const b = WORLD.buckets.get(cx + "," + cy);
        if (!b) continue;
        for (const pr of b) {
          if (pr._stamp === frameStamp) continue;
          pr._stamp = frameStamp;
          if (pr.x + pr.w / 2 < camX || pr.x - pr.w / 2 > camX + VIEW_W || pr.y < camY || pr.y - pr.h > camY + VIEW_H) continue;
          list.push({ y: pr.sortY, prop: pr });
        }
      }
    if (state) {
      for (const rw of state.rewards) if (!rw.taken) list.push({ y: rw.y, reward: rw });
      for (const d of state.drops) {
        const x = Math.round(d.x - camX),
          y = Math.round(d.y - camY + Math.sin(d.phase) * 2);
        if (d.type === "vacuum") {
          // rare pickup: ghost vacuum icon on a swirling cyan ring
          const pulse = 0.5 + 0.5 * Math.sin(d.phase * 1.5);
          g.globalAlpha = 0.25 + pulse * 0.25;
          g.fillStyle = "#56ffd8";
          g.beginPath();
          g.ellipse(x, y + 6, 16, 7, 0, 0, TAU);
          g.fill();
          g.globalAlpha = 1;
          g.strokeStyle = "#a8fff0";
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y - 4, 13 + pulse * 3, d.phase, d.phase + 4);
          g.stroke();
          g.drawImage(ICONS.magnet, x - 14, y - 22, 28, 28);
          continue;
        }
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(x - 6, y + 7, 12, 3);
        if (d.type === "xp") {
          // v16: XP gem, bobbing with a periodic sparkle (size grows with tier)
          const tier = gemTier(d.value),
            gw = [14, 18, 22][tier],
            gh = Math.round((gw * 11) / 9);
          g.drawImage(ICONS["gem" + (tier + 1)], x - (gw >> 1), y - gh + 6, gw, gh);
          if (Math.sin(d.phase * 1.3) > 0.93) {
            g.fillStyle = "#ffffff";
            g.fillRect(x - 1 + (gw >> 2), y - gh + 6, 2, 2);
            g.fillRect(x - 2 + (gw >> 2), y - gh + 7, 4, 1);
          }
        } else if (d.type === "wage") {
          const w = Math.max(4, Math.round(20 * Math.abs(Math.cos(d.phase * 0.8)))); // v16: wages = spinning gold coin
          g.drawImage(ICONS.coin, x - (w >> 1), y - 10, w, 20);
        } else g.drawImage(ICONS.pizza, x - 15, y - 15, 30, 30);
      }
      for (const e of state.enemies)
        if (Math.abs(e.x - camX - VIEW_W / 2) < VIEW_W / 2 + 80 && Math.abs(e.y - camY - VIEW_H / 2) < VIEW_H / 2 + 110)
          list.push({ y: e.y, enemy: e });
      list.push({ y: state.player.y, hog: true });
      if (state.cameo && !state.cameo.gone) list.push({ y: state.cameo.y, cameo: state.cameo });
      if (STAGE === 2)
        for (const d of MM_DECOR)
          if (d.x + d.w / 2 > camX && d.x - d.w / 2 < camX + VIEW_W && d.y > camY && d.y - d.h < camY + VIEW_H) list.push({ y: d.y, decor: d });
    } else list.push({ y: WORLD.startY, hog: true });
    list.sort((a, b) => a.y - b.y);
    const p = state?.player || { x: WORLD.startX, y: WORLD.startY };
    const hx = Math.round(p.x - camX),
      hy = Math.round(p.y - camY);
    let hogDrawn = false;
    for (const item of list) {
      if (item.hog) {
        if (!cleanRender) drawHog(hx, hy);
        hogDrawn = true;
      } else if (item.enemy) drawEnemy(item.enemy, Math.round(item.enemy.x - camX), Math.round(item.enemy.y - camY));
      else if (item.cameo) drawCameo(item.cameo, Math.round(item.cameo.x - camX), Math.round(item.cameo.y - camY));
      else if (item.decor) drawDecor(item.decor, Math.round(item.decor.x - camX), Math.round(item.decor.y - camY));
      else if (item.reward) drawReward(item.reward, Math.round(item.reward.x - camX), Math.round(item.reward.y - camY));
      else {
        const pr = item.prop,
          k = KINDS[pr.kind],
          bx = pr.x - camX,
          by = pr.y - camY;
        // Scenery in front of Grave Hog turns translucent instead of hiding him.
        const overlapsHog = hogDrawn && bx + pr.w / 2 > hx - 18 && bx - pr.w / 2 < hx + 18 && by > hy - 34 && by - pr.h < hy + 14;
        if (k.fountain) {
          const im = IMAGES.fountain;
          if (ready(im)) {
            if (overlapsHog) g.globalAlpha = 0.5;
            const sw = Math.round(pr.w * 0.5),
              sh = Math.round(pr.h * 0.6);
            g.drawImage(im, Math.round(pr.w * 0.25), 0, sw, sh, Math.round(bx - pr.w / 2 + pr.w * 0.25), Math.round(by - pr.h), sw, sh);
            g.globalAlpha = 1;
          }
        } else drawPropTo(g, pr, bx, by, overlapsHog ? 0.5 : 1);
        if (k.glow) {
          g.globalAlpha = 0.18 + 0.08 * Math.sin(performance.now() / 180 + pr.x);
          g.fillStyle = k.glow;
          g.beginPath();
          g.arc(Math.round(bx), Math.round(by - 18), 22, 0, TAU);
          g.fill();
          g.globalAlpha = 1;
        }
      }
    }
    if (!state) return;
    drawDeaths(camX, camY);
    for (const q of state.projectiles) {
      const qx = Math.round(q.x - camX),
        qy = Math.round(q.y - camY);
      if (q.bone && ready(IMAGES.fx6)) {
        g.save();
        g.translate(qx, qy);
        g.rotate(q.spin);
        g.drawImage(IMAGES.fx6, 64 + 16, 22, 32, 20, -16, -10, 32, 20);
        g.restore();
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(qx - 6, qy + 10, 12, 3);
      } else if (q.fire) drawFireball(q, qx, qy);
      else if (q.kind) drawProj2(q, qx, qy);
      else if (q.weapon === "nail") {
        g.save();
        g.translate(qx, qy);
        g.rotate(Math.atan2(q.vy, q.vx));
        if (ready(weaponFx)) g.drawImage(weaponFx, 64, 128, 64, 64, -11, -9, 22, 18);
        else ((g.fillStyle = "#e8e3c9"), g.fillRect(-6, -1, 12, 3));
        g.restore();
      } else {
        g.fillStyle = "#1a1020";
        g.beginPath();
        g.arc(qx, qy, q.r + 1, 0, TAU);
        g.fill();
        g.fillStyle = q.color || "#f4e29b";
        g.beginPath();
        g.arc(qx, qy, q.r - 1, 0, TAU);
        g.fill();
      }
    }
    for (const part of state.particles) {
      g.globalAlpha = clamp(part.life / part.max, 0, 1);
      g.fillStyle = part.color;
      g.fillRect(
        Math.round(part.x - camX),
        Math.round(part.y - camY),
        Math.max(1, Math.round(part.r * 0.7)),
        Math.max(1, Math.round(part.r * 0.7)),
      );
    }
    g.globalAlpha = 1;
    if (state.weapons.sprinkler.level && p.fxWater) {
      const w = state.weapons.sprinkler;
      g.save();
      g.translate(hx, hy);
      g.rotate(p.fxWater.a);
      g.globalAlpha = 0.24;
      g.fillStyle = "#61d9e5";
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, w.range, -w.width, w.width);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.95;
      for (let i = 0; i < 9; i++) {
        const aa = rand(-w.width, w.width),
          d = w.range * (0.3 + 0.07 * i);
        g.fillStyle = i % 2 ? "#91ecf1" : "#d6fff3";
        g.fillRect(Math.round(Math.cos(aa) * d), Math.round(Math.sin(aa) * d), 2, 3);
      }
      g.restore();
    }
    if (state.weapons.chainsaw.level && p.fxSaw && ready(weaponFx)) {
      g.save();
      g.translate(hx, hy);
      g.rotate(p.fxSaw.a);
      g.drawImage(weaponFx, 192, 128, 64, 64, 12, -23, 68, 46);
      g.restore();
    }
    if (state.weapons.lantern.level) {
      const w = state.weapons.lantern;
      for (let i = 0; i < w.count; i++) {
        const a = state.t * (1.8 + i * 0.06) + (i * TAU) / w.count,
          lx = Math.round(hx + Math.cos(a) * w.radius),
          ly = Math.round(hy + Math.sin(a) * w.radius * 0.6);
        // v15: the lantern's own HUD icon art (green ghost-flame lantern), drawn 1:1 with a pulsing green glow
        g.globalAlpha = 0.22 + 0.08 * Math.sin(state.t * 6 + i);
        g.fillStyle = "#8dff6a";
        g.beginPath();
        g.arc(lx, ly + 2, 14, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        if (ready(weaponIcons)) g.drawImage(weaponIcons, OLD_ICON.lantern * 32, 0, 32, 32, lx - 16, ly - 18, 32, 32);
        state.lanternIconDraws = (state.lanternIconDraws || 0) + 1;
      }
    }
    drawWeapons2(camX, camY, hx, hy); // v14 weapons
    drawSplats(camX, camY);
    if (STAGE === 2) drawColdFog(camX, camY, true); // v15: Dairy mist over the characters
    if (state.vacuumFx) {
      const k = state.vacuumFx.t;
      g.strokeStyle = "#7fffe0";
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = ((1 - ((k * 1.6 + i / 3) % 1)) * 110) | 0; // rings collapsing inward onto Hog
        g.globalAlpha = 0.6 * (r / 110);
        g.beginPath();
        g.ellipse(hx, hy, r, r * 0.6, 0, 0, TAU);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (state.impacts)
      for (const im of state.impacts) {
        g.globalAlpha = 1 - im.t / 0.3;
        g.strokeStyle = "#f3ead2";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(Math.round(im.x - camX), Math.round(im.y - camY), 4 + im.t * 30, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      }
    for (const f of state.floaters) {
      const k = f.t / 1.6;
      g.globalAlpha = 1 - k * k;
      g.font = "bold 8px monospace";
      g.textAlign = "center";
      g.fillStyle = "#120c08";
      const fx = Math.round(f.x - camX),
        fy = Math.round(f.y - camY - k * 30);
      g.fillText(f.text, fx + 1, fy + 1);
      g.fillStyle = f.color;
      g.fillText(f.text, fx, fy);
      g.textAlign = "left";
      g.globalAlpha = 1;
    }
    if (cleanRender) return;
    const sun = sunriseLight();
    // Night vignette (static relative to the screen, so it can't shimmer). It lifts as the sun comes up.
    const vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
    vg.addColorStop(0, "rgba(8,6,20,0)");
    vg.addColorStop(1, `rgba(8,6,20,${(0.45 * (1 - sun * 0.85)).toFixed(3)})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (state.kingDark > 0) {
      // v8: the Cemetery King's presence closes in around the edges of the screen while he lives
      const kd = state.kingDark,
        throb = 0.92 + 0.08 * Math.sin(performance.now() / 500),
        kg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.24, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.52);
      kg.addColorStop(0, "rgba(4,10,6,0)");
      kg.addColorStop(0.5, `rgba(4,12,6,${(0.5 * kd * throb).toFixed(3)})`);
      kg.addColorStop(1, `rgba(2,6,3,${(0.93 * kd * throb).toFixed(3)})`);
      g.fillStyle = kg;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (sun > 0) drawSunrise(sun);
    if (debugMode) drawDebugWorld(camX, camY, hx, hy);
  }
  // Sunrise: pre-dawn violet -> pink -> gold light washing down from the top of the screen, plus slanted rays.
  function drawSunrise(sun) {
    g.save();
    g.globalCompositeOperation = "screen";
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
    const warm = sun < 0.4 ? [150, 110, 190] : sun < 0.7 ? [245, 140, 150] : [255, 196, 110];
    sky.addColorStop(0, `rgba(${warm[0]},${warm[1]},${warm[2]},${(0.55 * sun).toFixed(3)})`);
    sky.addColorStop(0.6, `rgba(${warm[0]},${warm[1]},${warm[2]},${(0.22 * sun).toFixed(3)})`);
    sky.addColorStop(1, `rgba(255,230,180,${(0.12 * sun).toFixed(3)})`);
    g.fillStyle = sky;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (sun > 0.35) {
      const r = (sun - 0.35) / 0.65,
        t = performance.now() / 1000;
      g.fillStyle = `rgba(255,220,150,${(0.13 * r).toFixed(3)})`;
      for (let i = 0; i < 5; i++) {
        const x0 = ((i * VIEW_W) / 4 + Math.sin(t * 0.3 + i) * 10) | 0;
        g.beginPath();
        g.moveTo(x0, 0);
        g.lineTo(x0 + 26, 0);
        g.lineTo(x0 - 60 + 26, VIEW_H);
        g.lineTo(x0 - 90, VIEW_H);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
    // overall lift so the cemetery visibly brightens
    g.save();
    g.globalCompositeOperation = "soft-light";
    g.fillStyle = `rgba(255,240,210,${(0.35 * sun).toFixed(3)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.restore();
  }
  const TREASURE_PX = 60; // v8: 50% larger than v7's 40px (kept for QA; the chest art below sets the drawn size)
  const CHEST_W = 44,
    CHEST_H = 49,
    CHEST_FRAMES = 4;
  function drawReward(rw, sx, sy) {
    if (rw.restoredAt !== undefined && state.t - rw.restoredAt < 2) {
      const k = (state.t - rw.restoredAt) / 2;
      g.globalAlpha = 1 - k;
      g.strokeStyle = "#ffe08a";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(sx, sy - 10, 10 + k * 24, 6 + k * 12, 0, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    }
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220 + rw.phase);
    // ground glow (green, matches the chest's ghost-light)
    g.globalAlpha = 0.2 + pulse * 0.18;
    g.fillStyle = "#7dff5a";
    g.beginPath();
    g.ellipse(sx, sy, 20, 8, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    // every treasure is the same animated chest; the coloured gem above it says which bonus it gives
    const fr = Math.floor(performance.now() / 150 + rw.phase * 4) % CHEST_FRAMES;
    if (ready(IMAGES.chest)) g.drawImage(IMAGES.chest, fr * CHEST_W, 0, CHEST_W, CHEST_H, Math.round(sx - CHEST_W / 2), Math.round(sy - CHEST_H + 4), CHEST_W, CHEST_H);
  }
  function drawDebugWorld(camX, camY, hx, hy) {
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = "#ff2040";
    for (let cy = Math.floor(camY / CELL); cy <= Math.floor((camY + VIEW_H) / CELL); cy++)
      for (let cx = Math.floor(camX / CELL); cx <= Math.floor((camX + VIEW_W) / CELL); cx++)
        if (isSolidCell(cx, cy)) g.fillRect(cx * CELL - camX, cy * CELL - camY, CELL, CELL);
    g.globalAlpha = 1;
    if (STAGE === 2 && MAP.solids) {
      // v11: the authored collision rectangles the Mega Mart art was painted from
      g.strokeStyle = "#ffe14a";
      for (const [x0, y0, x1, y1] of MAP.solids) {
        const X = x0 * TILE - camX, Y = y0 * TILE - camY, Wd = (x1 - x0) * TILE, Ht = (y1 - y0) * TILE;
        if (X > VIEW_W || Y > VIEW_H || X + Wd < 0 || Y + Ht < 0) continue;
        g.strokeRect(Math.round(X) + 0.5, Math.round(Y) + 0.5, Wd - 1, Ht - 1);
      }
    }
    g.lineWidth = 1;
    if (hogDebug) {
      g.strokeStyle = "#ffe14a";
      g.strokeRect(hogDebug.dx + 0.5, hogDebug.dy + 0.5, 63, 63); // sprite cell bounds
      const b = HOG_BOXES[hogDebug.row]?.[hogDebug.frame];
      if (b) {
        g.strokeStyle = "#4dff7a";
        const bx = hogDebug.flip ? hogDebug.dx + 64 - b[2] : hogDebug.dx + b[0];
        g.strokeRect(bx + 0.5, hogDebug.dy + b[1] + 0.5, b[2] - b[0] - 1, b[3] - b[1] - 1); // opaque pixel bounds
      }
      g.strokeStyle = "#ff4dff";
      g.beginPath();
      g.moveTo(hx - 4, hy + 0.5);
      g.lineTo(hx + 5, hy + 0.5);
      g.moveTo(hx + 0.5, hy - 4);
      g.lineTo(hx + 0.5, hy + 5);
      g.moveTo(hx - 10, hy + 14.5);
      g.lineTo(hx + 11, hy + 14.5); // feet baseline
      g.stroke();
      g.strokeStyle = "#5ad1ff";
      g.beginPath();
      g.arc(hx, hy, state?.player.r || 14, 0, TAU);
      g.stroke();
    }
    if (state)
      for (const e of state.enemies) {
        g.strokeStyle = e.boss ? "#ff9b3d" : "#5ad1ff";
        g.beginPath();
        g.arc(Math.round(e.x - camX), Math.round(e.y - camY), e.r, 0, TAU);
        g.stroke();
      }
    g.restore();
  }
  // Whole-cemetery render (used for the overview image / QA). Same chunk + prop pipeline as gameplay.
  function renderOverview(scale = 0.5) {
    const c = document.createElement("canvas");
    c.width = Math.round(WORLD_W * scale);
    c.height = Math.round(WORLD_H * scale);
    const cc = c.getContext("2d");
    cc.imageSmoothingEnabled = true;
    cc.scale(scale, scale);
    for (let cy = 0; cy < WORLD_H / CHUNK; cy++) for (let cx = 0; cx < WORLD_W / CHUNK; cx++) cc.drawImage(getChunk(cx, cy), cx * CHUNK, cy * CHUNK);
    for (const pr of [...WORLD.tall].sort((a, b) => a.sortY - b.sortY)) if (!KINDS[pr.kind].fountain) drawPropTo(cc, pr, pr.x, pr.y);
    cc.font = "bold 40px monospace";
    cc.textAlign = "center";
    for (const r of MAP.regions) {
      const x = ((r.rect[0] + r.rect[2]) / 2) * TILE,
        y = ((r.rect[1] + r.rect[3]) / 2) * TILE;
      const tw = cc.measureText(r.name).width;
      cc.fillStyle = "#000b";
      cc.fillRect(x - tw / 2 - 10, y - 36, tw + 20, 50);
      cc.fillStyle = "#f1d69b";
      cc.fillText(r.name, x, y);
    }
    return c.toDataURL("image/png");
  }
  // Opaque bounding boxes for every Hog frame (debug overlay + QA). Computed once after load.
  const HOG_BOXES = {};
  function measureHogFrames() {
    try {
      const c = document.createElement("canvas");
      c.width = hogSheet.naturalWidth;
      c.height = hogSheet.naturalHeight;
      const cc = c.getContext("2d");
      cc.drawImage(hogSheet, 0, 0);
      const data = cc.getImageData(0, 0, c.width, c.height).data;
      for (let r = 0; r < 12; r++) {
        HOG_BOXES[r] = [];
        for (let f = 0; f < 4; f++) {
          let x0 = 64,
            y0 = 64,
            x1 = -1,
            y1 = -1;
          for (let y = 0; y < 64; y++)
            for (let x = 0; x < 64; x++)
              if (data[((r * 64 + y) * c.width + f * 64 + x) * 4 + 3] > 40) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
              }
          HOG_BOXES[r].push(x1 >= 0 ? [x0, y0, x1 + 1, y1 + 1] : null);
        }
      }
    } catch (e) {
      console.warn("Frame measurement unavailable (file:// canvas security); debug boxes show cell bounds only.", e);
    }
  }
  // ---- v10 HUD: gothic frames generated from the user's HUD mockup, drawn at full canvas resolution ----
  const HUD_LAYOUT = {
    portrait: [6, 4],
    bars: [104, 6],
    hpTrack: [154, 32, 247, 19],
    xpTrack: [154, 64, 248, 20],
    minimap: [W - 158, 60],
    mapInner: [W - 140, 103, 117, 105],
    clockmap: [W - 180, 2], // the clock/minimap device (176x272), top-right
    slots: [8, H - 62, 62],
    coins: [W - 158, H - 56],
    banner: [445, 4],
    chipsY: 114,
  };
  function hudText(text, x, y, color, font, align = "left", outline = "#0a0608") {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.textAlign = "left";
  }
  const CLOCKMAP_WIN = [34, 54, 137, 211]; // window inside hud/clockmap.png (x0, y0, x1, y1), just inside the bevel
  function hudImg(key, x, y) {
    const im = IMAGES[key];
    if (ready(im)) ctx.drawImage(im, Math.round(x), Math.round(y));
    return ready(im);
  }
  function drawHud() {
    const p = state.player,
      L = HUD_LAYOUT,
      clock = state.clock,
      hr = Math.floor(clock),
      min = Math.floor((clock % 1) * 60),
      clockText = `${hr % 12 || 12}:${String(min).padStart(2, "0")} AM`;
    ctx.imageSmoothingEnabled = false;
    // HP + XP bars (fills go in the frame's empty tracks, so the frame is drawn first)
    hudImg("hud_bars", L.bars[0], L.bars[1]);
    const [hx, hy, hw, hh] = L.hpTrack,
      hpK = clamp(p.hp / p.maxHp, 0, 1),
      hg = ctx.createLinearGradient(0, hy, 0, hy + hh);
    hg.addColorStop(0, "#ff6a58");
    hg.addColorStop(0.5, "#d8392e");
    hg.addColorStop(1, "#8e1d1a");
    ctx.fillStyle = hg;
    ctx.fillRect(hx + 2, hy + 2, Math.round((hw - 4) * hpK), hh - 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(hx + 2, hy + 3, Math.round((hw - 4) * hpK), 2);
    hudText(`${Math.ceil(p.hp)} / ${p.maxHp}`, hx + hw - 6, hy + hh - 4, "#fff1d8", "bold 14px monospace", "right");
    const [xx, xy, xw, xh] = L.xpTrack,
      xg = ctx.createLinearGradient(0, xy, 0, xy + xh);
    xg.addColorStop(0, "#9ff2ff");
    xg.addColorStop(1, "#2f8fa8");
    ctx.fillStyle = xg;
    ctx.fillRect(xx + 2, xy + 2, Math.round((xw - 4) * clamp(p.xp / p.nextXp, 0, 1)), xh - 4);
    hudText(`LV ${p.level}`, xx + xw - 6, xy + xh - 5, "#bff6ff", "bold 14px monospace", "right");
    // portrait on top of the bar frame's left end, like the mockup
    hudImg("hud_portrait", L.portrait[0], L.portrait[1]);
    // clock + minimap device, top right: one in-world gadget (the user's frame art) with the clock readout at the top
    // of its window and the minimap below. After the 6 AM explosion it swaps to the busted version of the same frame.
    {
      const [FX, FY] = L.clockmap,
        wx = FX + CLOCKMAP_WIN[0],
        wy = FY + CLOCKMAP_WIN[1],
        ww = CLOCKMAP_WIN[2] - CLOCKMAP_WIN[0],
        wh = CLOCKMAP_WIN[3] - CLOCKMAP_WIN[1],
        ccx = wx + ww / 2;
      // frame first (its window is solid black in the art); the clock, % and minimap are drawn over it.
      // It swaps to the busted version once the clock has blown (after the white flash).
      const broken = state.clockBoom && state.t - state.clockBoom.at > 0.1;
      hudImg(broken ? "hud_clockmap_broken" : "hud_clockmap", FX, FY);
      // screen glow behind the readout
      const sg = ctx.createLinearGradient(0, wy, 0, wy + 44);
      sg.addColorStop(0, state.clockBoom ? "#2a0d0a" : "#122318");
      sg.addColorStop(1, "#07090c");
      ctx.fillStyle = sg;
      ctx.fillRect(wx, wy, ww, 44);
      const overtime = !state.limitless && state.t >= SHIFT_SECONDS && !state.bossesDead[finalBossId()],
        blink = Math.floor(performance.now() / 400) % 2;
      const LM = state.limitless;
      if (LM) hudText(`+${fmtMMSS(state.t - LM.t0)}`, ccx, wy + 23, "#ffb0a0", "bold 19px monospace", "center");
      else if (!state.clockBoom) hudText(clockText, ccx, wy + 23, "#d8ffc8", "bold 19px monospace", "center");
      else drawClockWreck(state.clockBoom);
      hudText(
        state.limitless ? "LIMITLESS" : state.sunrise ? "SUNRISE" : overtime ? "OVERTIME!" : `SHIFT ${Math.min(99, Math.floor((state.t / SHIFT_SECONDS) * 100))}%`,
        ccx,
        wy + 37,
        overtime ? (blink ? "#ff8a6a" : "#ffd0b0") : "#a9c8a0",
        "bold 11px monospace",
        "center",
      );
      // minimap
      const side = Math.min(ww - 6, wh - 62),
        mx = Math.round(ccx - side / 2),
        my = wy + 44,
        s = side / MW;
      ctx.imageSmoothingEnabled = STAGE === 2;
      ctx.drawImage(minimap, mx, my, side, side);
      ctx.imageSmoothingEnabled = false;
      const toMM = (x, y) => [mx + (x / TILE) * s, my + (y / TILE) * s];
      ctx.strokeStyle = "#e8d5ac99";
      ctx.lineWidth = 1;
      const [vx, vy] = toMM(lastCam.x, lastCam.y);
      ctx.strokeRect(Math.round(vx) + 0.5, Math.round(vy) + 0.5, Math.round((VIEW_W / TILE) * s), Math.round((VIEW_H / TILE) * s));
      for (const rw of state.rewards)
        if (!rw.taken) {
          const [rx, ry] = toMM(rw.x, rw.y);
          ctx.fillStyle = "#9dff5a";
          ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 3, 3);
        }
      if (STAGE === 1 && WORLD.testBox && !state.testBoxUsed) {
        const [tx, ty] = toMM(WORLD.testBox.x, WORLD.testBox.y);
        ctx.fillStyle = "#4a8cff";
        ctx.fillRect(Math.round(tx) - 2, Math.round(ty) - 2, 4, 4);
      }
      const boss = state.enemies.find((e) => e.boss);
      if (boss) {
        const [bx, by] = toMM(boss.x, boss.y);
        ctx.fillStyle = blink ? "#ff5a4a" : "#ffb0a0";
        ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 5, 5);
      }
      const [px, py] = toMM(p.x, p.y);
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5);
      ctx.fillStyle = "#7ff0ff";
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
      hudText(
        state.limitless ? `BOSS IN ${fmtMMSS(Math.max(0, state.limitless.nextBoss - (state.t - state.limitless.t0)))}` : overtime ? (STAGE === 2 ? "BEAT MEAT MANAGER" : "BEAT THE KING") : "M: MAP",
        ccx,
        my + side + 13,
        overtime || state.limitless ? (blink ? "#ff8a6a" : "#ffd0b0") : "#8f9a86",
        overtime ? "bold 9px monospace" : "bold 10px monospace",
        "center",
      );
    }
    // bonus readouts (v9 totals from every source), as small framed chips under the portrait
    {
      const chips = []; // stat totals moved to the pause menu's STATS screen; only timed buffs stay on the HUD
      if (p.blessT > 0) chips.unshift({ color: "#8fe8ff", text: `BLESSED ${Math.ceil(p.blessT)}s` });
      let bx = 10,
        by = L.chipsY;
      ctx.font = "bold 11px monospace";
      for (const c of chips) {
        const w = ctx.measureText(c.text).width + 24;
        if (bx + w > 430) ((bx = 10), (by += 22));
        ctx.fillStyle = "#120d0cdd";
        ctx.fillRect(bx, by, w, 19);
        ctx.strokeStyle = "#8a6a44";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 18);
        ctx.fillStyle = c.color;
        ctx.fillRect(bx + 6, by + 6, 7, 7);
        ctx.fillStyle = "#f4e4c5";
        ctx.fillText(c.text, bx + 18, by + 14);
        bx += w + 4;
      }
    }
    // numbered weapon slots, bottom left (the latest upgrade glows gold)
    // v14: 5 weapon slots, filled in the order weapons were picked up this run
    const slotIds = syncSlots(),
      [sx0, sy0, step] = L.slots;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = slotIds[i],
        w = id ? state.weapons[id] : null,
        x = sx0 + i * step,
        on = w && state.lastUpgrade === id;
      if (on) hudImg("hud_slot_on", x, sy0 - 4);
      else hudImg("hud_slot", x, sy0);
      if (w) weaponIcon(id, x + 13, sy0 + 13, 32);
      else {
        ctx.fillStyle = "rgba(10,8,12,0.55)";
        ctx.fillRect(x + 12, sy0 + 14, 34, 31);
      }
      hudText(String(i + 1), x + 9, sy0 + 20, w ? "#fff1d0" : "#7d7466", "bold 13px monospace");
      if (w) hudText(w.level >= wmax() ? "MAX" : `L${w.level}`, x + 49, sy0 + 48, "#ffd76a", "bold 11px monospace", "right");
    }
    // wages counter, bottom right
    if (hudImg("hud_coins", L.coins[0], L.coins[1])) {
      hudText(String(save.wages), L.coins[0] + 132, L.coins[1] + 35, "#fff0c8", "bold 20px monospace", "right");
      if (state.earned) hudText(`+${state.earned} this shift`, L.coins[0] + 146, L.coins[1] - 4, "#d7b46c", "bold 11px monospace", "right");
    }
    // boss banner (top centre-right, between the bars and the clock)
    const boss = state.enemies.find((e) => e.boss);
    if (boss && hudImg("hud_banner", L.banner[0], L.banner[1])) {
      const bx = L.banner[0],
        by = L.banner[1];
      hudText(boss.name, bx + 175, by + 25, "#f0dcae", "bold 13px monospace", "center");
      ctx.fillStyle = "#3a1414";
      ctx.fillRect(bx + 36, by + 31, 278, 10);
      ctx.fillStyle = "#d24a3a";
      ctx.fillRect(bx + 36, by + 31, Math.round((278 * boss.hp) / boss.maxHp), 10);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(bx + 36, by + 31, Math.round((278 * boss.hp) / boss.maxHp), 2);
    }
  }
  // The HUD clock at 6:00 AM: white flash, fireball, flying shards, then a smoking, cracked "--:--".
  function clockCentre() {
    const [fx, fy] = HUD_LAYOUT.clockmap;
    return [fx + (CLOCKMAP_WIN[0] + CLOCKMAP_WIN[2]) / 2, fy + CLOCKMAP_WIN[1] + 16];
  }
  function drawClockWreck(b) {
    const k = state.t - b.at,
      [cx, cy] = clockCentre();
    ctx.save();
    if (k > 0.25) {
      ctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? "#ff6a4a" : "#b8442e";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ERROR", cx, cy + 7);
      ctx.textAlign = "left";
      // cracked screen
      ctx.strokeStyle = "#d8d0c088";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 48, cy - 10);
      ctx.lineTo(cx - 14, cy + 3);
      ctx.lineTo(cx + 4, cy - 7);
      ctx.lineTo(cx + 48, cy + 12);
      ctx.moveTo(cx - 14, cy + 3);
      ctx.lineTo(cx - 22, cy + 18);
      ctx.stroke();
      // smoke wisps keep rising from the wreck
      for (let i = 0; i < 4; i++) {
        const ph = (k * 0.6 + i / 4) % 1;
        ctx.globalAlpha = (1 - ph) * 0.35;
        ctx.fillStyle = "#9a9298";
        ctx.beginPath();
        ctx.arc(cx - 20 + i * 14 + Math.sin(k * 2 + i) * 4, cy - 30 - ph * 40, 4 + ph * 8, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawClockBoom(b) {
    const k = state.t - b.at,
      [cx, cy] = clockCentre();
    ctx.save();
    if (k < 3) {
      // its own headline (the King's arrival announcement shares this moment)
      ctx.globalAlpha = clamp((3 - k) / 0.5, 0, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 26px monospace";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1a0806";
      ctx.strokeText("6:00 AM — THE CLOCK BLEW UP!", W / 2, H * 0.19);
      ctx.fillStyle = Math.floor(k * 8) % 2 ? "#ff8a4a" : "#ffd36a";
      ctx.fillText("6:00 AM — THE CLOCK BLEW UP!", W / 2, H * 0.19);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
    if (k < 1.6) {
      if (k < 0.12) {
        ctx.globalAlpha = 1 - k / 0.12;
        ctx.fillStyle = "#fff6d8";
        ctx.fillRect(HUD_LAYOUT.clockmap[0] - 40, 0, W - HUD_LAYOUT.clockmap[0] + 40, 290);
        ctx.globalAlpha = 1;
      }
      const r = 14 + Math.min(1, k / 0.35) * 86;
      ctx.globalAlpha = clamp(1 - k / 0.9, 0, 1);
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      grad.addColorStop(0, "#fff3c0");
      grad.addColorStop(0.4, "#ffb347");
      grad.addColorStop(1, "#ff4a2a00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = clamp(1 - k / 1.6, 0, 1);
      for (const s of b.shards) {
        const x = cx + s.vx * k,
          y = cy + s.vy * k + 260 * k * k;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.spin * k);
        ctx.fillStyle = s.c;
        ctx.fillRect(-s.s, -s.s / 2, s.s * 2, s.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawHudExtras(cam) {
    const p = state.player;
    // v10: minimap lives inside the gothic frame (drawn in drawHud); this only resolves the boss for the pointer.
    const boss = state.enemies.find((e) => e.boss);
    // Off-screen boss pointer
    if (boss) {
      const sx = (boss.x - cam.x) * viewScale(),
        sy = (boss.y - cam.y) * viewScale();
      if (sx < 0 || sy < 0 || sx > W || sy > H) {
        const a = Math.atan2(sy - H / 2, sx - W / 2),
          ex = clamp(W / 2 + Math.cos(a) * 1000, 40, W - 40),
          ey = clamp(H / 2 + Math.sin(a) * 1000, 110, H - 60),
          m = Math.round(dist(p, boss) / TILE);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = "#ff6b4f";
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-8, -11);
        ctx.lineTo(-8, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd0b0";
        ctx.fillText(`${boss.engaged ? "" : WORLD.arenas[boss.bossId].label + " · "}${m}m`, ex, ey + 26);
        ctx.textAlign = "left";
      }
    }
    // Region banner (a named landmark like the Tomb of Questionable Decisions takes priority)
    if (state.placeBanner > 0 && state.place) {
      ctx.globalAlpha = clamp(state.placeBanner / 0.6, 0, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#1a0c08d0";
      const tw = ctx.measureText(state.place).width;
      ctx.fillRect(W / 2 - tw / 2 - 14, 150, tw + 28, 30);
      ctx.fillStyle = "#ffb07a";
      ctx.fillText(state.place, W / 2, 171);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    } else if (state.regionBanner > 0) {
      const r = MAP.regions.find((x) => x.id === state.region);
      ctx.globalAlpha = clamp(state.regionBanner / 0.6, 0, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#0c1019cc";
      const tw = ctx.measureText(r.name).width;
      ctx.fillRect(W / 2 - tw / 2 - 14, 150, tw + 28, 30);
      ctx.fillStyle = "#f1d69b";
      ctx.fillText(r.name, W / 2, 171);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
    if (showBigMap) drawBigMap();
    if (debugMode) drawDebugText(cam);
  }
  function drawBigMap() {
    const S = 460 / MW,
      size = MW * S,
      x0 = (W - size) / 2,
      y0 = (H - size) / 2;
    ctx.fillStyle = "#06080ce8";
    ctx.fillRect(x0 - 10, y0 - 10, size + 20, size + 20);
    ctx.drawImage(minimap, x0, y0, size, size);
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    for (const r of MAP.regions) {
      const cx = x0 + ((r.rect[0] + r.rect[2]) / 2) * S,
        cy = y0 + ((r.rect[1] + r.rect[3]) / 2) * S;
      ctx.fillStyle = "#000a";
      const tw = ctx.measureText(r.name).width;
      ctx.fillRect(cx - tw / 2 - 4, cy - 11, tw + 8, 16);
      ctx.fillStyle = state?.visited?.[r.id] ? "#f1d69b" : "#9b927f";
      ctx.fillText(r.name, cx, cy + 1);
    }
    for (const pl of MAP.places || []) {
      const label = pl.short || pl.name,
        tw = ctx.measureText(label).width,
        cx = clamp(x0 + pl.label[0] * S, x0 + tw / 2 + 6, x0 + size - tw / 2 - 6),
        cy = y0 + pl.label[1] * S;
      ctx.fillStyle = "#000c";
      ctx.fillRect(cx - tw / 2 - 4, cy - 11, tw + 8, 16);
      ctx.fillStyle = "#ffb07a";
      ctx.fillText(label, cx, cy + 1);
    }
    if (state) {
      ctx.fillStyle = "#7ff0ff";
      ctx.fillRect(x0 + (state.player.x / TILE) * S - 3, y0 + (state.player.y / TILE) * S - 3, 7, 7);
      for (const e of state.enemies)
        if (e.boss) {
          ctx.fillStyle = "#ff5a4a";
          ctx.fillRect(x0 + (e.x / TILE) * S - 4, y0 + (e.y / TILE) * S - 4, 9, 9);
        }
    }
    ctx.textAlign = "left";
  }
  function drawDebugText(cam) {
    const p = state.player,
      h = hogDebug || {};
    const lines = [
      `DEBUG (F3)  scale ${viewScale().toFixed(3)}x  wheel ${Math.round(zoomCur * 100)}%  view ${VIEW_W}x${VIEW_H}  fps ${fps.toFixed(0)}`,
      `camera ${cam.x},${cam.y}   player ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      `hog row ${h.row} frame ${h.frame} ${h.label} flip ${!!h.flip} dir ${p.dir}`,
      `anchor ${h.dx + 32},${h.dy + 48}  invuln ${p.invuln.toFixed(2)} (intentional flash)`,
      `enemies ${state.enemies.length}  chunks ${chunkCache.size} built ${chunkBuilds}  region ${state.region}`,
    ];
    ctx.font = "12px monospace";
    ctx.fillStyle = "#000c";
    ctx.fillRect(10, H - 150, 520, lines.length * 16 + 10);
    ctx.fillStyle = "#9dff9d";
    lines.forEach((l, i) => ctx.fillText(l, 16, H - 132 + i * 16));
  }
  function draw(dt = 0) {
    updateZoom(dt);
    ctx.imageSmoothingEnabled = false;
    const p = state?.player,
      cam = photoCam ? cameraFor(photoCam[0], photoCam[1]) : cameraFor(p ? p.x : WORLD.startX, p ? p.y : WORLD.startY - 60);
    lastCam = cam;
    drawWorld(cam.x, cam.y);
    // Integer shake in buffer pixels keeps the upscale crisp.
    let sx = 0,
      sy = 0;
    if (shake > 0.5) {
      const vs = viewScale();
      sx = Math.round(Math.round(rand(-shake, shake) / vs) * vs);
      sy = Math.round(Math.round(rand(-shake, shake) / vs) * vs);
      shake *= 0.87;
    } else shake = 0;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(view, 0, 0, VIEW_W, VIEW_H, sx, sy, W, H);
    if (!state) {
      if (!assetsReady) {
        ctx.fillStyle = "#f1d69b";
        ctx.font = "bold 18px monospace";
        ctx.fillText("LOADING ART…", 20, H - 20);
      }
      return;
    }
    drawHud();
    drawHudExtras(cam);
    if (state.clockBoom) drawClockBoom(state.clockBoom); // the blast sits on top of the minimap and boss bar
    if (state.sunrise?.countdown != null && !state.sunrise.done) {
      const n = Math.max(1, Math.ceil(state.sunrise.countdown)),
        frac = state.sunrise.countdown - Math.floor(state.sunrise.countdown);
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = "#2a1a10cc";
      ctx.fillRect(W / 2 - 150, H * 0.13, 300, 34);
      ctx.fillStyle = "#ffe7b0";
      ctx.fillText("CLOCKING OUT IN", W / 2, H * 0.13 + 25);
      const size = Math.round(150 + (frac > 0.75 ? (frac - 0.75) * 160 : 0));
      ctx.font = `bold ${size}px monospace`;
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#2a1a10";
      ctx.strokeText(String(n), W / 2, H * 0.4); // above Hog, so his flex stays in view
      ctx.fillStyle = "#ffd36a";
      ctx.fillText(String(n), W / 2, H * 0.4);
      ctx.restore();
    }
    if (state.eventUntil > state.t) {
      ctx.textAlign = "center";
      ctx.font = "bold 30px monospace";
      ctx.fillStyle = "#f1d69b";
      ctx.fillText(state.eventText, W / 2, H * 0.3);
      ctx.textAlign = "left";
    }
    if (toastUntil > performance.now()) {
      // word-wrapped (long treasure messages used to run off the screen); grows upward from the bottom
      ctx.textAlign = "center";
      ctx.font = "16px monospace";
      const maxW = 600,
        lines = [];
      let cur = "";
      for (const word of toast.split(" ")) {
        const t = cur ? cur + " " + word : word;
        if (ctx.measureText(t).width > maxW && cur) (lines.push(cur), (cur = word));
        else cur = t;
      }
      if (cur) lines.push(cur);
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)),
        lh = 21,
        boxH = lines.length * lh + 8,
        top = H - 76 - boxH;
      ctx.fillStyle = "#0c1019cc";
      ctx.fillRect(W / 2 - tw / 2 - 10, top, tw + 20, boxH);
      ctx.fillStyle = "#ffdd8b";
      lines.forEach((l, i) => ctx.fillText(l, W / 2, top + 20 + i * lh));
      ctx.textAlign = "left";
    }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fps = fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    if (state && (mode === "gameover" || mode === "victory")) state.endT = (state.endT || 0) + dt;
    musicTick(dt);
    if (!photoFreeze) {
      pollPad(dt);
      update(dt);
    }
    draw(dt);
    requestAnimationFrame(frame);
  }
  function onAssetsReady() {
    assetsReady = true;
    chunkCache.clear();
    loadMegaMartFloor(); // Stage 2 floor streams in behind the title screen
    for (const set of Object.values(PANEL_SETS)) for (const src of set) new Image().src = src; // warm the outro panels
    measureHogFrames();
  }
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if ((k === "f3" || k === "`") && URLQ.has("debug")) { // release: debug overlay toggle only when the page was opened with ?debug
      e.preventDefault();
      debugMode = !debugMode;
      return;
    }
    if (mode === "slides") {
      if (["enter", " ", "arrowright", "d", "e"].includes(k) && !e.repeat) {
        e.preventDefault();
        nextSlide();
      }
      return;
    }
    if (mode === "loot" && !e.repeat && (k === "enter" || k === " ")) {
      e.preventDefault();
      return closeLootMachine();
    }
    if (mode === "levelup" && levelUpKeys && !e.repeat) {
      if (k === "r") return levelUpKeys.reroll();
      if (k === "b") return levelUpKeys.banish();
      if (k === "1" || k === "2" || k === "3") return levelUpKeys.choose(Number(k) - 1);
    }
    if (k === "f" && !e.repeat && !e.ctrlKey && !e.metaKey) {
      // F: toggle fullscreen (game only, edge to edge)
      const d = document,
        el = d.documentElement;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
      return;
    }
    if (k === "p" && !e.repeat && (mode === "playing" || photoFreeze)) {
      photoFreeze = !photoFreeze;
      keys.clear();
      document.getElementById("save-status").textContent = photoFreeze ? "PHOTO FREEZE · P TO RESUME" : "LOCAL SAVE";
      return;
    }
    if (photoFreeze && k === "escape") photoFreeze = false; // ESC still opens the normal pause menu
    if (!e.repeat && mode === "playing") {
      if (k === "z") return zoomCycle();
      if (k === "-" || k === "_") return zoomStep(1);
      if (k === "=" || k === "+") return zoomStep(-1);
    }
    if (k === "m") showBigMap = true;
    keys.add(k);
    if (k === "escape") {
      unlockAudio();
      pauseGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "m") showBigMap = false;
    keys.delete(k);
  });
  // Auto-pause: alt-tab, switching apps, a phone call or a hidden tab pauses the shift instead of leaving Hog to die.
  function autoPause() {
    if (photoFreeze) return; // a screenshot tool grabbing focus must not pop the pause menu over the shot
    keys.clear();
    touchVec.x = touchVec.y = touchVec.m = 0;
    if (mode === "playing" && state) showPause();
  }
  window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", () => document.hidden && autoPause());
  // ---------------------------------------------------------------------------------
  //  Controller (Gamepad API, standard mapping: Xbox / PlayStation / Switch Pro / Steam Deck)
  //  Left stick or D-pad move · Start = pause · Back/Select = map · in menus: D-pad/stick move the cursor,
  //  A = choose, B = back · level-up: X = reroll, Y = banish.
  // ---------------------------------------------------------------------------------
  const PAD = { prev: [], driving: false, navDir: "", navT: 0, seen: false };
  const PAD_DEAD = 0.22;
  function padButtons() {
    return [...panel.querySelectorAll("button")].filter((b) => !b.disabled && b.offsetParent !== null);
  }
  function padFocus(dir) {
    const list = padButtons();
    if (!list.length) return;
    const cur = list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) return (list.find((b) => b.classList.contains("primary") || b.classList.contains("choice")) || list[0]).focus();
    const r0 = cur.getBoundingClientRect(),
      cx = r0.left + r0.width / 2,
      cy = r0.top + r0.height / 2;
    const [vx, vy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    let best = null,
      bestScore = Infinity;
    for (const b of list) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect(),
        dx = r.left + r.width / 2 - cx,
        dy = r.top + r.height / 2 - cy,
        along = dx * vx + dy * vy;
      if (along <= 4) continue;
      const score = along + Math.abs(dx * vy + dy * vx) * 2.5;
      if (score < bestScore) (bestScore = score), (best = b);
    }
    if (best) {
      best.focus();
      best.scrollIntoView?.({ block: "nearest" });
    }
  }
  function padBack() {
    if (mode === "paused") return resumeGame();
    if ((mode === "office" || mode === "options" || mode === "stats") && menuBack === "pause" && state) return showPause();
    if (mode === "compendium" && dexBack === "pause" && state) return showPause();
    const back = padButtons().find((b) => /^(◀ )?(BACK|KEEP MY PERKS)/.test(b.textContent.trim()));
    if (back) back.click();
  }
  function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected && p.buttons.length) { gp = p; break; }
    if (!gp) {
      if (PAD.driving) (touchVec.x = touchVec.y = touchVec.m = 0), (PAD.driving = false);
      return;
    }
    if (!PAD.seen) (PAD.seen = true), toastMsg("Controller connected. Start = pause, Back = map.");
    const held = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const tap = (i) => held(i) && !PAD.prev[i];
    let x = gp.axes[0] || 0,
      y = gp.axes[1] || 0;
    if (held(14)) x = -1;
    if (held(15)) x = 1;
    if (held(12)) y = -1;
    if (held(13)) y = 1;
    const m = Math.min(1, Math.hypot(x, y));
    if (tap(9)) {
      unlockAudio();
      if (mode === "playing" || mode === "paused" || mode === "office" || mode === "options" || mode === "stats" || (mode === "compendium" && dexBack === "pause")) pauseGame();
      else if (mode !== "slides" && mode !== "levelup" && panel.classList.contains("visible")) {
        const list = padButtons(); // Start on title / results screens = press the highlighted (or main) button
        (list.includes(document.activeElement) ? document.activeElement : list.find((b) => b.classList.contains("primary")) || list[0])?.click();
      }
    }
    if (mode === "playing") {
      if (m > PAD_DEAD) {
        touchVec.x = x / (m || 1);
        touchVec.y = y / (m || 1);
        touchVec.m = Math.min(1, ((m - PAD_DEAD) / (1 - PAD_DEAD)) * 1.2);
        PAD.driving = true;
      } else if (PAD.driving) {
        touchVec.x = touchVec.y = touchVec.m = 0;
        PAD.driving = false;
      }
      if (tap(8)) showBigMap = !showBigMap;
      if (tap(4)) zoomStep(-1); // LB: zoom in
      if (tap(5)) zoomStep(1); // RB: zoom out
    } else {
      if (PAD.driving) (touchVec.x = touchVec.y = touchVec.m = 0), (PAD.driving = false);
      if (mode !== "playing" && showBigMap && !held(8)) showBigMap = false;
      if (mode === "slides") {
        if (tap(0) || tap(9)) nextSlide();
      } else if (panel.classList.contains("visible")) {
        // controller in use and nothing highlighted yet (a menu just opened): put the cursor on the main button
        const list = padButtons();
        if (list.length && !list.includes(document.activeElement)) (list.find((b) => b.classList.contains("choice") || b.classList.contains("primary")) || list[0]).focus({ preventScroll: true });
        // menu cursor: edge-triggered with auto-repeat while held
        const dir = m < 0.5 ? "" : Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
        if (dir && (dir !== PAD.navDir || (PAD.navT -= dt) <= 0)) {
          padFocus(dir);
          PAD.navT = dir !== PAD.navDir ? 0.38 : 0.14;
        }
        PAD.navDir = dir;
        if (tap(0)) {
          unlockAudio();
          const list = padButtons();
          if (list.includes(document.activeElement)) document.activeElement.click();
          else padFocus("down");
        }
        if (tap(1)) padBack();
        if (mode === "levelup" && levelUpKeys) {
          if (tap(2)) levelUpKeys.reroll();
          if (tap(3)) levelUpKeys.banish();
        }
      }
    }
    PAD.prev = gp.buttons.map((b) => b.pressed || b.value > 0.5);
  }
  window.addEventListener("gamepadconnected", () => unlockAudio());
  // Mobile hooks used by mobile.js (touch joystick + on-screen buttons).
  window.GS_MOBILE = {
    setMove(x, y, m) {
      touchVec.x = x;
      touchVec.y = y;
      touchVec.m = m;
    },
    pause() {
      unlockAudio();
      pauseGame();
    },
    toggleMap() {
      showBigMap = !showBigMap;
      return showBigMap;
    },
    zoomStep: (d) => zoomStep(d), // wrappers: the zoom helpers are defined further down
    zoomCycle: () => zoomCycle(),
    get mode() {
      return mode;
    },
  };
  window.addEventListener("pointerdown", unlockAudio); // v16: music may only start after a gesture
  window.addEventListener("keydown", unlockAudio);
  // Mouse wheel: down = zoom out (up to 160% of the default visible world), up = back toward 100%. Never zooms in past 100%.
  let wheelAcc = 0,
    wheelAt = 0;
  // Zoom: mouse wheel, Z (cycle), - / = keys, controller bumpers, pinch or the ZOOM button on touch screens.
  // The chosen level is saved, so it carries across stages and sessions.
  function zoomAllowed() {
    return !(mode === "title" || mode === "office" || mode === "options");
  }
  function setZoom(i) {
    const n = clamp(i, 0, ZOOM_STEPS.length - 1);
    if (n === zoomIndex) return;
    zoomIndex = n;
    save.zoomIndex = n;
    try {
      localStorage.setItem(saveKey, JSON.stringify(save));
    } catch (e) {}
  }
  const zoomStep = (d) => zoomAllowed() && setZoom(zoomIndex + d);
  const zoomCycle = () => zoomAllowed() && setZoom(zoomIndex >= ZOOM_STEPS.length - 1 ? 0 : zoomIndex + 1);
  function onWheel(e) {
    e.preventDefault(); // the page must not scroll while the wheel is used over the game
    if (mode === "title" || mode === "office" || mode === "options") return;
    wheelAcc += e.deltaY;
    const now = performance.now();
    if (Math.abs(wheelAcc) < 40 && now - wheelAt < 400 && Math.abs(e.deltaY) < 40) return;
    setZoom(zoomIndex + (wheelAcc > 0 ? 1 : -1));
    wheelAcc = 0;
    wheelAt = now;
  }
  canvas.parentElement.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) * W) / r.width;
    mouse.y = ((e.clientY - r.top) * H) / r.height;
  });
  buildWorld();
  if (URLQ.has("qa")) {
    window.__qa = {
      sfxInfo: () => ({ can: SFX_CAN, defs: Object.keys(SFX_DEF), stats: sfxStats, bad: Object.keys(sfxBad), pools: Object.fromEntries(Object.entries(sfxPool).map(([n, p]) => [n, p.map((a) => ({ rs: a.readyState, err: a.error ? a.error.code : 0, dur: a.duration }))])) }),
      sfx,
      get worldCanvas() {
        return g.canvas;
      },
      v15: () => ({ SPLAT_SCALE, CLEAVER_SIZE, CLEAVER_HIT_R, COFFIN_HIT_T, COFFIN_LIFE, coffinR: [1, 2, 3, 4, 5].map(coffinRadius), FOG_OVER, STORE_RECT, MM_DECOR, EDGE_FOG_D }),
      v16: () => ({ MUSIC_FILES, musicWant, musicOn, musicDuck, musicStats, music: Object.fromEntries(Object.entries(musicEls).map(([n, a]) => [n, { vol: a.volume, paused: a.paused, t: a.currentTime, ready: a.readyState, err: !!a.error }])), SFX_VAR, sfxAll: Object.keys(SFX_ALL), sfxVol: Object.fromEntries(Object.entries(SFX_ALL).map(([n, d]) => [n, d.vol])), FOG_OVER, perkRefund: perkRefund(), menuBack, gemTier: [1, 3, 4, 6, 7, 9].map(gemTier) }),
      musicTick,
      awardXP,
      finishRun,
      playMusic,
      showOptions,
      showPause,
      resumeGame,
      confirmReset,
      placeCameo,
      startRun,
      showSlides,
      nextSlide,
      showEnding,
      exitGame,
      setStage,
      finalBossId,
      spawnBoss2: (id) => addEnemy(null, id),
      addEnemy2: (type) => addEnemy(type),
      moveCircle: (e, dx, dy, r) => moveCircle(e, dx, dy, r),
      get stage() {
        return STAGE;
      },
      get world() {
        return WORLD;
      },
      get dims() {
        return { TILE, MW, MH, WORLD_W, WORLD_H, CW, CHH };
      },
      get slides() {
        return slides;
      },
      get megaFloor() {
        return megaFloor;
      },
      get megaFloorReady() {
        return megaFloorReady;
      },
      types2: TYPES2,
      bossDefs: BOSS,
      saveData: () => save,
      hudLayout: () => HUD_LAYOUT,
      update,
      awardXP,
      damageEnemy,
      doAttack,
      showLevelUp,
      pauseGame,
      showOffice,
      getAvailableUpgrades,
      v14: { NW_IDS, MAX_SLOTS, WMAX: WMAX_BASE, STAT_MAX, SPLAT_TINT, splatTint, syncSlots, spawnSplat, FALLBACK_UPS, upgrades: UPGRADES },
      draw,
      findSpawnPoint,
      computeFlowField,
      flowDir,
      get state() {
        return state;
      },
      set state(v) {
        state = v;
      },
      get mode() {
        return mode;
      },
      get save() {
        return save;
      },
      get pending() {
        return pendingLevelUps;
      },
      get assets() {
        return IMAGES;
      },
      get assetsReady() {
        return assetsReady;
      },
      get zoom() {
        return WORLD_ZOOM;
      },
      get view() {
        return [VIEW_W, VIEW_H];
      },
      get zoomCur() {
        return zoomCur;
      },
      get zoomIndex() {
        return zoomIndex;
      },
      restoreTreasures,
      treasureSpotOk,
      hudStatChips,
      upgrades: UPGRADES,
      ghostAlpha,
      weaponSpeedMul,
      fireBossVolley,
      consts8: { TREASURE_PX, BONUS_STEP, TREASURE_MIN_HOG, TREASURE_MIN_APART, TILE },
      icons: ICONS,
      triggerVacuum,
      collectDrop,
      killEnemy,
      addEnemyBoss: (id) => addEnemy(null, id),
      startSunrise,
      hogAnimState,
      explodeClock,
      bossFrame,
      updateFacing,
      consts7: { HORDE_SECONDS, HORDE_COUNT, SUNRISE_LIGHT_SECONDS, COUNTDOWN_SECONDS, BOSS_CELL, BOSS_BASE, BOSS_DY, SHIFT_SECONDS, BOSS_R: Object.fromEntries(Object.entries(BOSS).map(([k, v]) => [k, v.r])) },
      drop(x, y, type, value) {
        drop(x, y, type, value);
        return state.drops[state.drops.length - 1];
      },
      consts6: { BOSS_HP: Object.fromEntries(Object.entries(BOSS).map(([k, v]) => [k, v.hp])), BOSS_HP_MULT, VACUUM_CHANCE, ZOOM_STEPS, BASE_VIEW_W, BASE_VIEW_H, SWING_HIT, POSE_DUR },
      setZoomIndex(i) {
        zoomIndex = clamp(i, 0, ZOOM_STEPS.length - 1);
      },
      wheel(deltaY) {
        onWheel({ deltaY, preventDefault() {} });
      },
      get hog() {
        return hogDebug;
      },
      get cam() {
        return lastCam;
      },
      get world() {
        return WORLD;
      },
      get map() {
        return MAP;
      },
      get boxes() {
        return HOG_BOXES;
      },
      renderOverview,
      get chunkBuilds() {
        return chunkBuilds;
      },
      consts: { TILE, CELL, CW, CHH, WORLD_W, WORLD_H, UNREACHED },
      isSolidCell,
      solidAt,
      regionAt,
      cameraFor,
      clearToast() {
        toastUntil = 0;
      },
      setDebug(v) {
        debugMode = v;
      },
      setBigMap(v) {
        showBigMap = v;
      },
      apply(id) {
        const u = UPGRADES.find((x) => x.id === id);
        if (!u) throw Error("missing upgrade " + id);
        u.apply(state);
      },
      addEnemy(x, y, hp = 100, type = "zombie") {
        const e = {
          x,
          y,
          hp,
          maxHp: hp,
          r: 10,
          speed: 0,
          color: "#8ca36b",
          damage: 10,
          xp: 1,
          type,
          vx: 0,
          vy: 0,
          attack: 10,
          phase: 0,
          qa: true,
        };
        state.enemies.push(e);
        return e;
      },
      setKeys(list) { keys.clear(); for (const k of list) keys.add(k) },
      setPhotoCam(v) {
        photoCam = v;
      },
      setClean(v) { cleanRender = v },
      get viewCanvas() { return view },
      pathDir(tx, ty, x, y) {
        const key = STAGE + ":" + Math.floor(tx / CELL) + "," + Math.floor(ty / CELL);
        if (!this._paths) this._paths = {};
        if (!this._paths[key]) { const arr = new Uint16Array(CW * CHH); bfs(Math.floor(tx / CELL), Math.floor(ty / CELL), arr); this._paths[key] = arr }
        const saved = WORLD.flow; WORLD.flow = this._paths[key];
        const d = flowDir({ x, y }); WORLD.flow = saved; return d;
      },
      spawnType(type) {
        addEnemy(type);
      },
      spawnBoss(id) {
        addEnemy(null, id);
      },
      setMode(v) {
        mode = v;
      },
      get upgrades() {
        return UPGRADES.map((x) => x.id);
      },
      getUpgradeTitle(id) {
        return UPGRADES.find((x) => x.id === id).title;
      },
    };
  }
  showTitle();
  requestAnimationFrame(frame);
})();
