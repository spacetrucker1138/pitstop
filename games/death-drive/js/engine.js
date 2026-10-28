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
    var sprite;
    if (steer < 0) sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
    else if (steer > 0) sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
    else sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;
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
  // NPC vehicles — mobCars sheet (339x151 per cell). Angles: left col x=0, rear x=339, right x=678
  CAR01_L: { x: 0, y: 151, w: 339, h: 151 }, CAR01: { x: 339, y: 151, w: 339, h: 151 }, CAR01_R: { x: 678, y: 151, w: 339, h: 151 },
  CAR02_L: { x: 0, y: 302, w: 339, h: 151 }, CAR02: { x: 339, y: 302, w: 339, h: 151 }, CAR02_R: { x: 678, y: 302, w: 339, h: 151 },
  CAR03_L: { x: 0, y: 453, w: 339, h: 151 }, CAR03: { x: 339, y: 453, w: 339, h: 151 }, CAR03_R: { x: 678, y: 453, w: 339, h: 151 },
  CAR04_L: { x: 0, y: 604, w: 339, h: 151 }, CAR04: { x: 339, y: 604, w: 339, h: 151 }, CAR04_R: { x: 678, y: 604, w: 339, h: 151 },
  SEMI_L: { x: 0, y: 755, w: 339, h: 151 }, SEMI: { x: 339, y: 755, w: 339, h: 151 }, SEMI_R: { x: 678, y: 755, w: 339, h: 151 },
  CAR05_L: { x: 0, y: 0, w: 339, h: 151 }, CAR05: { x: 339, y: 0, w: 339, h: 151 }, CAR05_R: { x: 678, y: 0, w: 339, h: 151 },
  PLAYER_UPHILL_LEFT: { x: 5, y: 1709, w: 119, h: 131 }, PLAYER_UPHILL_STRAIGHT: { x: 200, y: 1709, w: 119, h: 131 }, PLAYER_UPHILL_RIGHT: { x: 395, y: 1709, w: 119, h: 131 },
  PLAYER_LEFT: { x: 5, y: 1495, w: 119, h: 131 }, PLAYER_STRAIGHT: { x: 200, y: 1495, w: 119, h: 131 }, PLAYER_RIGHT: { x: 395, y: 1495, w: 119, h: 131 }
};
SPRITES.SCALE = 0.3 * (1 / SPRITES.PLAYER_STRAIGHT.w);
SPRITES.BILLBOARDS = [SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05, SPRITES.BILLBOARD06, SPRITES.BILLBOARD07, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09];
SPRITES.PLANTS = [SPRITES.TREE1, SPRITES.TREE2, SPRITES.DEAD_TREE1, SPRITES.DEAD_TREE2, SPRITES.PALM_TREE, SPRITES.BUSH1, SPRITES.BUSH2, SPRITES.CACTUS, SPRITES.STUMP, SPRITES.BOULDER1, SPRITES.BOULDER2, SPRITES.BOULDER3];
(function (L) { for (var k in L) SPRITES[k].lights = L[k]; })({
  CAR05_L: [0.225, 0.503, 0.75], CAR05: [0.261, 0.656, 0.74], CAR05_R: [0.494, 0.836, 0.77],
  CAR01_L: [0.323, 0.495, 0.734], CAR01: [0.366, 0.636, 0.717], CAR01_R: [0.49, 0.664, 0.75],
  CAR02_L: [0.278, 0.435, 0.77], CAR02: [0.374, 0.614, 0.744], CAR02_R: [0.513, 0.716, 0.744],
  CAR03_L: [0.24, 0.465, 0.758], CAR03: [0.336, 0.62, 0.758], CAR03_R: [0.536, 0.746, 0.768],
  CAR04_L: [0.21, 0.468, 0.65], CAR04: [0.314, 0.633, 0.65], CAR04_R: [0.461, 0.749, 0.623],
  SEMI_L: [0.26, 0.555, 0.734], SEMI: [0.2, 0.59, 0.734], SEMI_R: [0.438, 0.82, 0.734]
});
SPRITES.CARS = [SPRITES.CAR01, SPRITES.CAR02, SPRITES.CAR03, SPRITES.CAR04, SPRITES.SEMI, SPRITES.CAR05];
SPRITES.CARS_L = [SPRITES.CAR01_L, SPRITES.CAR02_L, SPRITES.CAR03_L, SPRITES.CAR04_L, SPRITES.SEMI_L, SPRITES.CAR05_L];
SPRITES.CARS_R = [SPRITES.CAR01_R, SPRITES.CAR02_R, SPRITES.CAR03_R, SPRITES.CAR04_R, SPRITES.SEMI_R, SPRITES.CAR05_R];
