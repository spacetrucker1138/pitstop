// Based on Jake Gordon's javascript-racer (MIT). Modified for DEATH DRIVE.
var XS = 320; // horizontal projection scale (px per unit). = height*2/3 so 4:3 matches the original, wider screens see more road-side.

var Util = {
  timestamp: function () { return performance.now(); },
  toInt: function (obj, def) { if (obj !== null && obj !== undefined) { var x = parseInt(obj, 10); if (!isNaN(x)) return x; } return def === undefined ? 0 : Util.toInt(def, 0); },
  toFloat: function (obj, def) { if (obj !== null && obj !== undefined) { var x = parseFloat(obj); if (!isNaN(x)) return x; } return def || 0; },
  limit: function (v, min, max) { return Math.max(min, Math.min(v, max)); },
  randomInt: function (min, max) { return Math.round(Util.interpolate(min, max, Math.random())); },
  randomChoice: function (o) { return o[Util.randomInt(0, o.length - 1)]; },
  percentRemaining: function (n, total) { return (n % total) / total; },
  accelerate: function (v, accel, dt) { return v + accel * dt; },
  interpolate: function (a, b, p) { return a + (b - a) * p; },
  easeIn: function (a, b, p) { return a + (b - a) * Math.pow(p, 2); },
  easeOut: function (a, b, p) { return a + (b - a) * (1 - Math.pow(1 - p, 2)); },
  easeInOut: function (a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); },
  exponentialFog: function (d, density) { return 1 / Math.pow(Math.E, d * d * density); },
  increase: function (start, inc, max) { var r = start + inc; while (r >= max) r -= max; while (r < 0) r += max; return r; },
  project: function (p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round(width / 2 + p.screen.scale * p.camera.x * XS);
    p.screen.y = Math.round(height / 2 - p.screen.scale * p.camera.y * height / 2);
    p.screen.w = Math.round(p.screen.scale * roadWidth * XS);
  },
  overlap: function (x1, w1, x2, w2, percent) {
    var half = (percent || 1) / 2;
    return !((x1 + w1 * half < x2 - w2 * half) || (x1 - w1 * half > x2 + w2 * half));
  }
};

var Render = {
  polygon: function (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  },
  segment: function (ctx, width, lanes, x1, y1, w1, x2, y2, w2, fog, color) {
    var r1 = Render.rumbleWidth(w1, lanes), r2 = Render.rumbleWidth(w2, lanes),
        l1 = Render.laneMarkerWidth(w1, lanes), l2 = Render.laneMarkerWidth(w2, lanes), lanew1, lanew2, lanex1, lanex2, lane;
    ctx.fillStyle = color.grass; ctx.fillRect(0, y2, width, y1 - y2 + 1);
    Render.polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
    Render.polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
    Render.polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);
    if (color.lane) {
      lanew1 = w1 * 2 / lanes; lanew2 = w2 * 2 / lanes; lanex1 = x1 - w1 + lanew1; lanex2 = x2 - w2 + lanew2;
      for (lane = 1; lane < lanes; lanex1 += lanew1, lanex2 += lanew2, lane++)
        Render.polygon(ctx, lanex1 - l1 / 2, y1, lanex1 + l1 / 2, y1, lanex2 + l2 / 2, y2, lanex2 - l2 / 2, y2, color.lane);
    }
    Render.fog(ctx, 0, y1, width, y2 - y1, fog);
  },
  // layers are seamless 1280px strips; keep their aspect ratio and tile them across any screen width
  background: function (ctx, background, width, height, layer, rotation, offset) {
    var k = height / layer.h, tw = layer.w * k;
    var x = -((rotation || 0) * tw) % tw; if (x > 0) x -= tw;
    for (; x < width; x += tw - 1)
      ctx.drawImage(background, layer.x, layer.y, layer.w, layer.h, Math.floor(x), offset || 0, Math.ceil(tw), height);
  },
  _tint: {},
  tinted: function (sheet, sprite, tint) {
    var key = sprite.x + ',' + sprite.y + ',' + tint, c = Render._tint[key];
    if (c) return c;
    c = document.createElement('canvas'); c.width = sprite.w; c.height = sprite.h;
    var x = c.getContext('2d');
    x.drawImage(sheet, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(0, 0, sprite.w, sprite.h);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(sheet, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
    return (Render._tint[key] = c);
  },
  // returns the drawn rect (or null) so effects can attach to it
  sprite: function (ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY, tint) {
    var k = sprite.scale || 1;
    var destW = (sprite.w * scale * XS) * (SPRITES.SCALE * roadWidth) * k;
    var destH = (sprite.h * scale * XS) * (SPRITES.SCALE * roadWidth) * k;
    destX = destX + destW * (offsetX || 0);
    destY = destY + destH * (offsetY || 0);
    var clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;
    var drawH = destH - clipH, srcSheet = sprite.sheet || sprites;
    if (clipH < destH && destW > 0.5 && drawH > 0.5) {
      var srcH = sprite.h - (sprite.h * clipH / destH);
      if (tint) {
        // tinted cars are pre-baked once per (sprite, colour) at native size, then drawn like any sprite.
        // (v2 preview tinted every car on an offscreen canvas every frame - that stalled the GPU in traffic)
        var tc = Render.tinted(srcSheet, sprite, tint);
        ctx.drawImage(tc, 0, 0, sprite.w, srcH, destX, destY, destW, drawH);
      } else {
        ctx.drawImage(srcSheet, sprite.x, sprite.y, sprite.w, srcH, destX, destY, destW, drawH);
      }
      return { x: destX, y: destY, w: destW, h: destH, drawH: drawH };
    }
    return null;
  },
  player: function (ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer, updown) {
    var bounce = (1.5 * Math.random() * speedPercent * resolution) * Util.randomChoice([-1, 1]);
    var base = DD.damage >= 3 ? 'PLAYERD' : 'PLAYER';
    if (keySlower && DD.state === 'racing') base += '_BRAKE';
    var sprite = SPRITES[base + (steer < 0 ? '_L' : steer > 0 ? '_R' : '')];
    DD.playerSprite = sprite;
    return Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1);
  },
  fog: function (ctx, x, y, width, height, fog) {
    if (fog < 1) { ctx.globalAlpha = 1 - fog; ctx.fillStyle = COLORS.FOG; ctx.fillRect(x, y, width, height); ctx.globalAlpha = 1; }
  },
  rumbleWidth: function (w, lanes) { return w / Math.max(6, 2 * lanes); },
  laneMarkerWidth: function (w, lanes) { return w / Math.max(32, 8 * lanes); }
};

var COLORS = {
  SKY: '#0d0025', TREE: '#0a0018', FOG: '#1a0535',
  LIGHT: { road: '#1c1c1c', grass: '#1a0030', rumble: '#d4a017', lane: '#666666' },
  DARK: { road: '#242424', grass: '#250040', rumble: '#b8860b' },
  START: { road: 'white', grass: 'white', rumble: 'white' },
  FINISH: { road: 'black', grass: 'black', rumble: 'black' }
};

var BACKGROUND = {
  HILLS: { x: 5, y: 5, w: 1280, h: 480 },
  SKY: { x: 5, y: 495, w: 1280, h: 480 },
  TREES: { x: 5, y: 985, w: 1280, h: 480 }
};

var SPRITES = {
  PALM_TREE: { x: 5, y: 5, w: 215, h: 540 }, TREE1: { x: 625, y: 5, w: 360, h: 360 },
  DEAD_TREE1: { x: 5, y: 555, w: 135, h: 332 }, BOULDER3: { x: 230, y: 280, w: 320, h: 220 },
  COLUMN: { x: 995, y: 5, w: 200, h: 315 }, BOULDER2: { x: 621, y: 897, w: 298, h: 140 },
  TREE2: { x: 1205, y: 5, w: 282, h: 295 }, DEAD_TREE2: { x: 1205, y: 490, w: 150, h: 260 },
  BOULDER1: { x: 1205, y: 760, w: 168, h: 248 }, BUSH1: { x: 5, y: 1097, w: 240, h: 155 },
  CACTUS: { x: 929, y: 897, w: 235, h: 118 }, BUSH2: { x: 255, y: 1097, w: 232, h: 152 },
  STUMP: { x: 995, y: 330, w: 195, h: 140 },
  BILLBOARD01: { x: 0, y: 0, w: 400, h: 266 }, BILLBOARD02: { x: 400, y: 0, w: 400, h: 266 }, BILLBOARD03: { x: 800, y: 0, w: 400, h: 266 },
  BILLBOARD04: { x: 0, y: 266, w: 400, h: 266 }, BILLBOARD05: { x: 400, y: 266, w: 400, h: 266 }, BILLBOARD06: { x: 800, y: 266, w: 400, h: 266 },
  BILLBOARD07: { x: 0, y: 532, w: 400, h: 266 }, BILLBOARD08: { x: 400, y: 532, w: 400, h: 266 }, BILLBOARD09: { x: 800, y: 532, w: 400, h: 266 },
  _end: null
};
SPRITES.SCALE = 0.3 * (1 / 119); // world scale (kept from the original 119px van)
// ── VEHICLES (v3 redesign): one atlas, tight-cropped frames, light anchors measured from the art ──
var VEHICLES = {"PLAYER_L":{"x":0,"y":0,"w":162,"h":160,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.084,0.639,0.676]},"PLAYER_BRAKE_L":{"x":166,"y":0,"w":162,"h":160,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.084,0.639,0.676]},"PLAYER":{"x":332,"y":0,"w":129,"h":165,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.112,0.879,0.699]},"PLAYER_BRAKE":{"x":465,"y":0,"w":129,"h":165,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.112,0.879,0.699]},"PLAYER_R":{"x":598,"y":0,"w":159,"h":160,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.368,0.913,0.665]},"PLAYER_BRAKE_R":{"x":761,"y":0,"w":159,"h":160,"scale":0.6666666666666666,"file":"veh/player.webp","lights":[0.368,0.913,0.665]},"PLAYERD_L":{"x":0,"y":0,"w":153,"h":161,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.089,0.647,0.612]},"PLAYERD_BRAKE_L":{"x":157,"y":0,"w":153,"h":161,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.089,0.647,0.612]},"PLAYERD":{"x":314,"y":0,"w":129,"h":163,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.125,0.879,0.621]},"PLAYERD_BRAKE":{"x":447,"y":0,"w":129,"h":163,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.125,0.879,0.621]},"PLAYERD_R":{"x":580,"y":0,"w":151,"h":160,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.361,0.903,0.628]},"PLAYERD_BRAKE_R":{"x":735,"y":0,"w":151,"h":160,"scale":0.6666666666666666,"file":"veh/playerd.webp","lights":[0.361,0.903,0.628]},"HEARSE_L":{"x":0,"y":0,"w":289,"h":148,"scale":0.6666666666666666,"file":"veh/hearse.webp","lights":[0.026,0.516,0.692]},"HEARSE":{"x":293,"y":0,"w":200,"h":155,"scale":0.6666666666666666,"file":"veh/hearse.webp","lights":[0.054,0.94,0.759]},"HEARSE_R":{"x":497,"y":0,"w":288,"h":148,"scale":0.6666666666666666,"file":"veh/hearse.webp","lights":[0.48,0.971,0.693]},"MUSCLE_L":{"x":0,"y":0,"w":283,"h":154,"scale":0.6666666666666666,"file":"veh/muscle.webp","lights":[0.074,0.511,0.502]},"MUSCLE":{"x":287,"y":0,"w":208,"h":150,"scale":0.6666666666666666,"file":"veh/muscle.webp","lights":[0.121,0.87,0.524]},"MUSCLE_R":{"x":499,"y":0,"w":283,"h":154,"scale":0.6666666666666666,"file":"veh/muscle.webp","lights":[0.478,0.92,0.503]},"SEDAN_L":{"x":0,"y":0,"w":307,"h":173,"scale":0.6666666666666666,"file":"veh/sedan.webp","lights":[0.055,0.456,0.641]},"SEDAN":{"x":311,"y":0,"w":213,"h":169,"scale":0.6666666666666666,"file":"veh/sedan.webp","lights":[0.096,0.893,0.674]},"SEDAN_R":{"x":528,"y":0,"w":306,"h":173,"scale":0.6666666666666666,"file":"veh/sedan.webp","lights":[0.531,0.941,0.641]},"HOTROD_L":{"x":0,"y":0,"w":286,"h":175,"scale":0.6666666666666666,"file":"veh/hotrod.webp","lights":[0.095,0.434,0.63]},"HOTROD":{"x":290,"y":0,"w":237,"h":174,"scale":0.6666666666666666,"file":"veh/hotrod.webp","lights":[0.228,0.766,0.627]},"HOTROD_R":{"x":531,"y":0,"w":287,"h":175,"scale":0.6666666666666666,"file":"veh/hotrod.webp","lights":[0.551,0.893,0.632]},"SEMI_L":{"x":0,"y":0,"w":380,"h":342,"scale":0.8333333333333333,"file":"veh/semi.webp","lights":[0.044,0.463,0.703]},"SEMI":{"x":383,"y":0,"w":234,"h":332,"scale":0.8333333333333333,"file":"veh/semi.webp","lights":[0.097,0.899,0.699]},"SEMI_R":{"x":620,"y":0,"w":380,"h":342,"scale":0.8333333333333333,"file":"veh/semi.webp","lights":[0.526,0.951,0.704]},"ICE_L":{"x":0,"y":0,"w":328,"h":298,"scale":0.6666666666666666,"file":"veh/ice.webp","lights":[0.045,0.509,0.784]},"ICE":{"x":332,"y":0,"w":243,"h":308,"scale":0.6666666666666666,"file":"veh/ice.webp","lights":[0.107,0.892,0.797]},"ICE_R":{"x":579,"y":0,"w":328,"h":298,"scale":0.6666666666666666,"file":"veh/ice.webp","lights":[0.495,0.951,0.785]},"GHOST_L":{"x":0,"y":0,"w":280,"h":161,"scale":0.6666666666666666,"file":"veh/ghost.webp","lights":[0.091,0.583,0.587]},"GHOST":{"x":284,"y":0,"w":209,"h":160,"scale":0.6666666666666666,"file":"veh/ghost.webp","lights":[0.112,0.884,0.637]},"GHOST_R":{"x":497,"y":0,"w":279,"h":161,"scale":0.6666666666666666,"file":"veh/ghost.webp","lights":[0.414,0.905,0.59]}};
for (var vk in VEHICLES) SPRITES[vk] = VEHICLES[vk];
SPRITES.BILLBOARDS = [SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05, SPRITES.BILLBOARD06, SPRITES.BILLBOARD07, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09];
SPRITES.PLANTS = [SPRITES.TREE1, SPRITES.TREE2, SPRITES.DEAD_TREE1, SPRITES.DEAD_TREE2, SPRITES.PALM_TREE, SPRITES.BUSH1, SPRITES.BUSH2, SPRITES.CACTUS, SPRITES.STUMP, SPRITES.BOULDER1, SPRITES.BOULDER2, SPRITES.BOULDER3];
SPRITES.CAR_TYPES = ['HEARSE', 'MUSCLE', 'SEDAN', 'HOTROD', 'SEMI', 'ICE'];
SPRITES.CAR_TINT = [false, true, true, true, false, false]; // grey-bodied cars get a random paint job
SPRITES.CARS = SPRITES.CAR_TYPES.map(function (k) { return SPRITES[k]; });
SPRITES.CARS_L = SPRITES.CAR_TYPES.map(function (k) { return SPRITES[k + '_L']; });
SPRITES.CARS_R = SPRITES.CAR_TYPES.map(function (k) { return SPRITES[k + '_R']; });
SPRITES.PLAYER_STRAIGHT = SPRITES.PLAYER;
