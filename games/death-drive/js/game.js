// ─── DEATH DRIVE core game ──────────────────────────────────────────────────
var fps = 60, step = 1 / fps;
var width = 640, height = 480;
var centrifugal = 0.30;
var skySpeed = 0.001, hillSpeed = 0.002, treeSpeed = 0.003;
var skyOffset = 0, hillOffset = 0, treeOffset = 0;
var segments = [], cars = [];
var canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
var background = null, sprites = null, billboardSprites = null, mobCarSprites = null, sceneSprites = null;
var resolution = 1, roadWidth = 2000, segmentLength = 200, rumbleLength = 3, trackLength = null, lanes = 3;
var fieldOfView = 100, cameraHeight = 1450, cameraDepth = null, drawDistance = 210;
var playerX = 0, playerZ = null, fogDensity = 19, position = 0, speed = 0;
var maxSpeed = segmentLength / step, accel = maxSpeed / 5, breaking = -maxSpeed, decel = -maxSpeed / 5;
var offRoadDecel = -maxSpeed / 2, offRoadLimit = maxSpeed / 4, totalCars = 200;
var keyLeft = false, keyRight = false, keyFaster = false, keySlower = false;
var TOTAL_LAPS = 2;

var DD = {
  state: 'title',          // title | countdown | racing | finishing | finished
  countdownT: 0, lastBeep: 4, finishT: 0,
  raceTime: 0, lapTime: 0, lap: 1, lapTimes: [], raceDist: 0,
  hitCooldown: 0, offroad: 0, playerRect: null,
  bestLap: Util.toFloat(localStorage.getItem('dd_best_lap'), 0),
  bestRace: Util.toFloat(localStorage.getItem('dd_best_race'), 0),
  hooks: { onLap: null, onFinish: null, onGo: null, onCount: null },
  isTouch: window.matchMedia && matchMedia('(pointer:coarse)').matches
};

function fmt(t) {
  if (!t && t !== 0) return '--';
  var m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

// ── UPDATE ────────────────────────────────────────────────────────────────
function update(dt) {
  FX.update(dt);
  var playerSegment = findSegment(position + playerZ);
  var playerW = SPRITES.PLAYER.w * SPRITES.PLAYER.scale * SPRITES.SCALE * 0.75;
  var racing = DD.state === 'racing', finishing = DD.state === 'finishing';
  var speedPercent = speed / maxSpeed;
  var dx = dt * 2 * speedPercent;
  var startPosition = position;
  var n, car, carW, sprite, spriteW;

  updateCars(dt, playerSegment, playerW);
  updateGhost(dt);
  if (DD.state === 'racing') {
    // exhaust backfire: lifting off the gas at speed, or the odd pop when flat out
    if (DD.wasFaster && !keyFaster && speedPercent > 0.55) FX.backfire(1);
    else if (keyFaster && speedPercent > 0.92 && Math.random() < dt * 0.25) FX.backfire(0.6);
  }
  DD.wasFaster = keyFaster;
  DD.hitCooldown = Math.max(0, DD.hitCooldown - dt);

  if (DD.state === 'countdown') {
    DD.countdownT -= dt;
    var c = Math.ceil(DD.countdownT);
    if (c < DD.lastBeep && c > 0) { DD.lastBeep = c; AudioEngine.beep(false); DD.hooks.onCount && DD.hooks.onCount(c); }
    if (DD.countdownT <= 0) { DD.state = 'racing'; AudioEngine.beep(true); DD.hooks.onGo && DD.hooks.onGo(); }
    AudioEngine.setEngineSpeed(keyFaster ? 0.55 : 0.05, true); // rev on the line
    return;
  }
  if (!racing && !finishing) { AudioEngine.setEngineSpeed(0, false); AudioEngine.setOffroad(0); return; }

  position = Util.increase(position, dt * speed, trackLength);

  var steerL = racing && keyLeft, steerR = racing && keyRight;
  if (steerL) { playerX -= dx; AudioEngine.playScreech(speedPercent - 0.5); }
  else if (steerR) { playerX += dx; AudioEngine.playScreech(speedPercent - 0.5); }
  playerX -= dx * speedPercent * playerSegment.curve * centrifugal;

  if (finishing) speed = Util.accelerate(speed, decel * 1.6, dt);
  else if (keyFaster) speed = Util.accelerate(speed, accel, dt);
  else if (keySlower) speed = Util.accelerate(speed, breaking, dt);
  else speed = Util.accelerate(speed, decel, dt);

  var off = playerX < -1 || playerX > 1;
  DD.offroad = off ? speedPercent : 0;
  if (off) {
    if (speed > offRoadLimit) speed = Util.accelerate(speed, offRoadDecel, dt);
    for (n = 0; n < playerSegment.sprites.length; n++) {
      sprite = playerSegment.sprites[n];
      spriteW = sprite.source.w * (sprite.source.scale || 1) * SPRITES.SCALE;
      if (DD.hitCooldown <= 0 && Util.overlap(playerX, playerW, sprite.offset + spriteW / 2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
        // bounce off scenery instead of getting pinned to it
        var impact = speed / maxSpeed;
        speed = Math.min(speed * 0.35, maxSpeed * 0.3);
        playerX += (playerX > 0 ? -1 : 1) * 0.22;
        DD.hitCooldown = 0.6;
        AudioEngine.playCrash(); if (DD.raceTime - (DD.dmgT || -9) > 1.5) { DD.damage += 1; DD.dmgT = DD.raceTime; }
        FX.hit('crash', playerX, 0, 0.6 + impact);
        break;
      }
    }
  }
  AudioEngine.setOffroad(Math.min(1, DD.offroad * 1.4));

  for (n = 0; n < playerSegment.cars.length; n++) {
    car = playerSegment.cars[n];
    carW = car.sprite.w * (car.sprite.scale || 1) * SPRITES.SCALE * 0.75;
    if (speed > car.speed && Util.overlap(playerX, playerW, car.offset, carW, 0.8)) {
      AudioEngine.playCollision(); if (DD.raceTime - (DD.dmgT || -9) > 1.5) { DD.damage += 0.34; DD.dmgT = DD.raceTime; }
      FX.hit('bump', playerX, 0, 0.5 + (speed - car.speed) / maxSpeed);
      speed = car.speed * (car.speed / speed);
      position = Util.increase(car.z, -playerZ, trackLength);
      break;
    }
  }

  playerX = Util.limit(playerX, -3, 3);
  speed = Util.limit(speed, 0, maxSpeed);
  AudioEngine.setEngineSpeed(speed / maxSpeed, true);

  var moved = position - startPosition;
  if (moved < -trackLength / 2) moved += trackLength;
  if (moved > trackLength / 2) moved -= trackLength;
  skyOffset = Util.increase(skyOffset, skySpeed * playerSegment.curve * moved / segmentLength, 1);
  hillOffset = Util.increase(hillOffset, hillSpeed * playerSegment.curve * moved / segmentLength, 1);
  treeOffset = Util.increase(treeOffset, treeSpeed * playerSegment.curve * moved / segmentLength, 1);

  if (finishing) {
    DD.finishT -= dt;
    if (DD.finishT <= 0) { DD.state = 'finished'; DD.hooks.onFinish && DD.hooks.onFinish(); }
    return;
  }

  DD.raceTime += dt; DD.lapTime += dt; DD.raceDist += moved;
  if (DD.raceDist >= trackLength * DD.lap) {
    var lt = DD.lapTime; DD.lapTimes.push(lt); DD.lapTime = 0;
    var newBestLap = !DD.bestLap || lt < DD.bestLap;
    if (newBestLap) { DD.bestLap = lt; localStorage.setItem('dd_best_lap', lt); }
    if (DD.lap >= TOTAL_LAPS) {
      DD.state = 'finishing'; DD.finishT = 2.2;
      DD.prevBestRace = DD.bestRace;
      if (!DD.bestRace || DD.raceTime < DD.bestRace) { DD.bestRace = DD.raceTime; localStorage.setItem('dd_best_race', DD.raceTime); }
      AudioEngine.fanfare(); FX.finish();
      DD.hooks.onLap && DD.hooks.onLap(DD.lap, lt, newBestLap, true);
    } else {
      DD.hooks.onLap && DD.hooks.onLap(DD.lap, lt, newBestLap, false);
      DD.lap++;
    }
  }
}

function updateCars(dt, playerSegment, playerW) {
  var n, car, oldSegment, newSegment;
  for (n = 0; n < cars.length; n++) {
    car = cars[n];
    oldSegment = findSegment(car.z);
    car.laneTimer = (car.laneTimer || 0) - dt;
    if (car.laneTimer <= 0) {
      if (Math.random() < 0.10) {
        var far = [-0.65, -0.33, 0.33, 0.65].filter(function (l) { return Math.abs(l - car.offset) > 0.25; });
        if (far.length) car.laneTarget = far[Math.floor(Math.random() * far.length)];
      }
      car.laneTimer = 4 + Math.random() * 4;
    }
    if (car.laneTarget !== undefined) {
      var diff = car.laneTarget - car.offset;
      if (Math.abs(diff) > 0.01) car.offset += diff * Math.min(0.04, Math.abs(diff));
    }
    car.offset += updateCarOffset(car, oldSegment, playerSegment, playerW);
    car.z = Util.increase(car.z, dt * car.speed, trackLength);
    car.percent = Util.percentRemaining(car.z, segmentLength);
    newSegment = findSegment(car.z);
    if (oldSegment != newSegment) {
      oldSegment.cars.splice(oldSegment.cars.indexOf(car), 1);
      newSegment.cars.push(car);
    }
  }
}

function updateCarOffset(car, carSegment, playerSegment, playerW) {
  var i, j, dir, segment, other, otherW, lookahead = 20, carW = car.sprite.w * (car.sprite.scale || 1) * SPRITES.SCALE;
  if ((carSegment.index - playerSegment.index) > drawDistance) return 0;
  for (i = 1; i < lookahead; i++) {
    segment = segments[(carSegment.index + i) % segments.length];
    if (segment === playerSegment && car.speed > speed && Util.overlap(playerX, playerW, car.offset, carW, 1.2)) {
      dir = playerX > 0.5 ? -1 : playerX < -0.5 ? 1 : (car.offset > playerX ? 1 : -1);
      return dir * 1 / i * (car.speed - speed) / maxSpeed;
    }
    for (j = 0; j < segment.cars.length; j++) {
      other = segment.cars[j]; otherW = other.sprite.w * (other.sprite.scale || 1) * SPRITES.SCALE;
      if (car.speed > other.speed && Util.overlap(car.offset, carW, other.offset, otherW, 1.2)) {
        dir = other.offset > 0.5 ? -1 : other.offset < -0.5 ? 1 : (car.offset > other.offset ? 1 : -1);
        return dir * 1 / i * (car.speed - other.speed) / maxSpeed;
      }
    }
  }
  return car.offset < -0.9 ? 0.1 : car.offset > 0.9 ? -0.1 : 0;
}

// ── RENDER ────────────────────────────────────────────────────────────────
function render() {
  var baseSegment = findSegment(position), basePercent = Util.percentRemaining(position, segmentLength);
  var playerSegment = findSegment(position + playerZ), playerPercent = Util.percentRemaining(position + playerZ, segmentLength);
  var playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
  var maxy = height, x = 0, dx = -(baseSegment.curve * basePercent);
  var sp = speed / maxSpeed;
  var depth = cameraDepth * FX.renderDepthFactor(sp);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.SKY; ctx.fillRect(0, 0, width, height);
  ctx.save();
  FX.preWorld(ctx, width, height);

  Render.background(ctx, background, width, height, BACKGROUND.SKY, skyOffset, resolution * skySpeed * playerY);
  Render.background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
  Render.background(ctx, background, width, height, BACKGROUND.TREES, treeOffset, resolution * treeSpeed * playerY);

  var n, i, segment, car, sprite, spriteScale, spriteX, spriteY, r;
  for (n = 0; n < drawDistance; n++) {
    segment = segments[(baseSegment.index + n) % segments.length];
    segment.looped = segment.index < baseSegment.index;
    segment.fog = Util.exponentialFog(n / drawDistance, fogDensity);
    segment.clip = maxy;
    Util.project(segment.p1, playerX * roadWidth - x, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), depth, width, height, roadWidth);
    Util.project(segment.p2, playerX * roadWidth - x - dx, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), depth, width, height, roadWidth);
    x += dx; dx += segment.curve;
    if (segment.p1.camera.z <= depth || segment.p2.screen.y >= segment.p1.screen.y || segment.p2.screen.y >= maxy) continue;
    Render.segment(ctx, width, lanes, segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w,
      segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w, segment.fog, segment.color);
    maxy = segment.p1.screen.y;
  }

  for (n = drawDistance - 1; n > 0; n--) {
    segment = segments[(baseSegment.index + n) % segments.length];
    for (i = 0; i < segment.cars.length; i++) {
      car = segment.cars[i];
      var ti = car.typeIndex || 0, view = car.offset < -0.15 ? -1 : car.offset > 0.15 ? 1 : 0;
      sprite = view < 0 ? SPRITES.CARS_L[ti] : view > 0 ? SPRITES.CARS_R[ti] : SPRITES.CARS[ti];
      spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
      spriteX = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, car.percent) + spriteScale * car.offset * roadWidth * XS;
      spriteY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, car.percent);
      r = Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip, car.tint);
      if (r) FX.afterCar(ctx, r, sprite, segment.fog);
    }
    if (DD.ghost && DD.ghost.on && findSegment(DD.ghost.z) === segment) drawGhost(segment);
    for (i = 0; i < segment.sprites.length; i++) {
      sprite = segment.sprites[i];
      spriteScale = segment.p1.screen.scale;
      spriteX = segment.p1.screen.x + spriteScale * sprite.offset * roadWidth * XS;
      spriteY = segment.p1.screen.y;
      r = Render.sprite(ctx, width, height, resolution, roadWidth, sprite.source.sheet || sprites, sprite.source, spriteScale, spriteX, spriteY, sprite.offset < 0 ? -1 : 0, -1, segment.clip);
      if (r && sprite.source.glow) FX.afterProp && FX.afterProp(ctx, r, sprite.source, segment.fog);
    }
    if (segment == playerSegment) {
      var pScale = depth / playerZ;
      var pY = height / 2 - (pScale * Util.interpolate(playerSegment.p1.camera.y, playerSegment.p2.camera.y, playerPercent) * height / 2);
      var steer = (DD.state === 'racing') ? speed * (keyLeft ? -1 : keyRight ? 1 : 0) : 0;
      FX.beforePlayer && FX.beforePlayer(ctx, width / 2, pY, pScale, sp);
      DD.playerRect = Render.player(ctx, width, height, resolution, roadWidth, sprites, sp, pScale, width / 2, pY, steer, playerSegment.p2.world.y - playerSegment.p1.world.y);
      if (DD.playerRect) FX.afterPlayer(ctx, DD.playerRect, sp, DD.offroad, playerX);
    }
  }
  ctx.restore();
  FX.overlay(ctx, width, height, sp);
  drawGauge(sp);
}

function drawGauge(sp) {
  if (DD.state === 'title') return;
  var R = height * 0.085, cx, cy, m = height * 0.03;
  if (DD.isTouch) { cx = width - R - m; cy = height * 0.16 + R; }
  else { cx = width - R - m * 1.2; cy = height - R - m; }
  var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, a = a0 + (a1 - a0) * sp;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,0,20,0.72)'; ctx.fill();
  ctx.lineWidth = R * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, a0, a1); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
  var g = ctx.createLinearGradient(cx - R, cy, cx + R, cy); g.addColorStop(0, '#c8ff00'); g.addColorStop(0.65, '#ffb000'); g.addColorStop(1, '#ff2bd6');
  if (sp > 0.005) { ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, a0, a); ctx.strokeStyle = g; ctx.stroke(); ctx.globalAlpha = 0.25; ctx.lineWidth = R * 0.3; ctx.stroke(); ctx.globalAlpha = 0.92; ctx.lineWidth = R * 0.16; }
  ctx.lineWidth = Math.max(1, R * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (var k = 0; k <= 12; k++) {
    var ta = a0 + (a1 - a0) * k / 12, r0 = R * (k % 3 ? 0.7 : 0.64);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0); ctx.lineTo(cx + Math.cos(ta) * R * 0.76, cy + Math.sin(ta) * R * 0.76); ctx.stroke();
  }
  ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = Math.max(2, R * 0.06);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72); ctx.stroke();
  ctx.fillStyle = '#c8ff00'; ctx.font = 'bold ' + Math.round(R * 0.5) + 'px Courier New, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(5 * Math.round(speed / 500)), cx, cy + R * 0.42);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = Math.round(R * 0.22) + 'px Courier New, monospace';
  ctx.fillText('MPH', cx, cy + R * 0.78);
  ctx.restore();
}

function findSegment(z) { return segments[Math.floor(z / segmentLength) % segments.length]; }

// ── ROAD GEOMETRY ─────────────────────────────────────────────────────────
function lastY() { return segments.length == 0 ? 0 : segments[segments.length - 1].p2.world.y; }
function addSegment(curve, y) {
  var n = segments.length;
  segments.push({ index: n, p1: { world: { y: lastY(), z: n * segmentLength }, camera: {}, screen: {} },
    p2: { world: { y: y, z: (n + 1) * segmentLength }, camera: {}, screen: {} }, curve: curve, sprites: [], cars: [],
    color: Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT });
}
function addSprite(n, sprite, offset) { if (segments[n]) segments[n].sprites.push({ source: sprite, offset: offset }); }
function addRoad(enter, hold, leave, curve, y) {
  var startY = lastY(), endY = startY + Util.toInt(y, 0) * segmentLength, n, total = enter + hold + leave;
  for (n = 0; n < enter; n++) addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
  for (n = 0; n < hold; n++) addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
  for (n = 0; n < leave; n++) addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
}
var ROAD = { LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 }, HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 }, CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 } };
function addStraight(num) { num = num || ROAD.LENGTH.MEDIUM; addRoad(num, num, num, 0, 0); }
function addHill(num, h) { addRoad(num || 50, num || 50, num || 50, 0, h || ROAD.HILL.MEDIUM); }
function addCurve(num, curve, h) { num = num || 50; addRoad(num, num, num, curve || ROAD.CURVE.MEDIUM, h || 0); }
function addLowRollingHills(num, h) {
  num = num || ROAD.LENGTH.SHORT; h = h || ROAD.HILL.LOW;
  addRoad(num, num, num, 0, h / 2); addRoad(num, num, num, 0, -h); addRoad(num, num, num, ROAD.CURVE.EASY, h);
  addRoad(num, num, num, 0, 0); addRoad(num, num, num, -ROAD.CURVE.EASY, h / 2); addRoad(num, num, num, 0, 0);
}
function addSCurves() {
  var M = ROAD.LENGTH.MEDIUM;
  addRoad(M, M, M, -ROAD.CURVE.EASY, 0); addRoad(M, M, M, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
  addRoad(M, M, M, ROAD.CURVE.EASY, -ROAD.HILL.LOW); addRoad(M, M, M, -ROAD.CURVE.EASY, ROAD.HILL.MEDIUM);
  addRoad(M, M, M, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
}
function addBumps() { [5, -2, -5, 8, 5, -7, 5, -2].forEach(function (h) { addRoad(10, 10, 10, 0, h); }); }
function addDownhillToEnd(num) { num = num || 200; addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY() / segmentLength); }

function resetRoad() {
  segments = [];
  addStraight(ROAD.LENGTH.SHORT); addLowRollingHills(); addSCurves();
  addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW); addBumps(); addLowRollingHills();
  addCurve(ROAD.LENGTH.LONG * 2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM); addStraight();
  addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH); addSCurves();
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE); addHill(ROAD.LENGTH.LONG, ROAD.HILL.HIGH);
  addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW); addBumps();
  addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM); addStraight(); addSCurves(); addDownhillToEnd();
  (window.resetSprites || defaultSprites)();
  resetCars();
  segments[findSegment(playerZ).index + 2].color = COLORS.START;
  segments[findSegment(playerZ).index + 3].color = COLORS.START;
  for (var n = 0; n < rumbleLength; n++) segments[segments.length - 1 - n].color = COLORS.FINISH;
  trackLength = segments.length * segmentLength;
}

function defaultSprites() {
  var n, i, side;
  [SPRITES.BILLBOARD07, SPRITES.BILLBOARD06, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09, SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05]
    .forEach(function (b, k) { addSprite(20 + k * 20, b, -1); });
  addSprite(240, SPRITES.BILLBOARD07, -1.2); addSprite(240, SPRITES.BILLBOARD06, 1.2);
  addSprite(segments.length - 25, SPRITES.BILLBOARD07, -1.2); addSprite(segments.length - 25, SPRITES.BILLBOARD06, 1.2);
  for (n = 10; n < 200; n += 4 + Math.floor(n / 100)) { addSprite(n, SPRITES.PALM_TREE, 0.5 + Math.random() * 0.5); addSprite(n, SPRITES.PALM_TREE, 1 + Math.random() * 2); }
  for (n = 250; n < 1000; n += 5) { addSprite(n, SPRITES.COLUMN, 1.1); addSprite(n + Util.randomInt(0, 5), SPRITES.TREE1, -1 - Math.random() * 2); addSprite(n + Util.randomInt(0, 5), SPRITES.TREE2, -1 - Math.random() * 2); }
  for (n = 200; n < segments.length; n += 3) addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1, -1]) * (2 + Math.random() * 5));
  for (n = 1000; n < segments.length - 50; n += 100) {
    side = Util.randomChoice([1, -1]);
    addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
    for (i = 0; i < 20; i++) addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.PLANTS), side * (1.5 + Math.random()));
  }
}

function resetCars() {
  cars = [];
  segments.forEach(function (s) { s.cars = []; });
  for (var n = 0; n < totalCars; n++) {
    var offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
    var z = Math.floor(Math.random() * segments.length) * segmentLength;
    if (z < playerZ + segmentLength * 12) z += segmentLength * 30; // keep the start grid clear
    var ti = Math.floor(Math.random() * SPRITES.CARS.length), spd;
    if (ti === 4) spd = maxSpeed * (0.25 + Math.random() * 0.15);
    else { var roll = Math.random(); spd = maxSpeed * (roll < 0.4 ? 0.30 + Math.random() * 0.15 : roll < 0.8 ? 0.45 + Math.random() * 0.15 : 0.60 + Math.random() * 0.15); }
    var h = [0, 30, 60, 120, 180, 210, 270, 300][Math.floor(Math.random() * 8)];
    var car = { offset: offset, z: z, sprite: SPRITES.CARS[ti], typeIndex: ti, speed: spd, tint: SPRITES.CAR_TINT[ti] ? 'hsl(' + h + ',70%,58%)' : null, laneTarget: offset, laneTimer: Math.random() * 5 };
    findSegment(car.z).cars.push(car); cars.push(car);
  }
}

// ── SIZE / LAYOUT ─────────────────────────────────────────────────────────
function setCanvasSize(w, h) {
  canvas.width = width = w; canvas.height = height = h;
  cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
  playerZ = cameraHeight * cameraDepth;
  resolution = height / 480;
  XS = height * 2 / 3;
}

function layout() {
  var vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
  var stage = document.getElementById('stage'), racer = document.getElementById('racer');
  var aspect = vw / vh, w, h, portrait = aspect < 1;
  if (aspect > 21 / 9) { h = vh; w = vh * 21 / 9; }
  else if (aspect < 4 / 3) { w = vw; h = vw * 3 / 4; }
  else { w = vw; h = vh; }
  w = Math.floor(w); h = Math.floor(h);
  stage.classList.toggle('portrait', portrait);
  racer.style.width = w + 'px'; racer.style.height = h + 'px';
  racer.style.setProperty('--u', (h / 100) + 'px');
  var dpr = window.devicePixelRatio || 1, k = Math.min(dpr, 1100 / h, 2000 / w);
  setCanvasSize(Math.round(w * k), Math.round(h * k));
  var mob = document.getElementById('mob-overlay');
  var wheel = portrait ? Math.min(130, vw * 0.32) : Math.max(84, Math.min(118, vh * 0.3));
  mob.style.setProperty('--wheel', wheel + 'px');
  mob.style.setProperty('--pedw', Math.round(wheel * 0.56) + 'px');
  mob.style.setProperty('--pedh', Math.round(wheel * 0.42) + 'px');
  if (segments.length) render();
}

// ── LOOP ──────────────────────────────────────────────────────────────────
function loadImages(names, cb) {
  var result = {}, count = names.length;
  names.forEach(function (name) {
    var img = new Image();
    img.onload = function () { if (--count == 0) cb(result); };
    img.onerror = function () { console.warn('missing image', name); if (--count == 0) cb(result); };
    img.src = 'images/' + name; result[name] = img;
  });
}

function startLoop() {
  var last = Util.timestamp(), gdt = 0;
  function frame() {
    var now = Util.timestamp(), dt = Math.min(1, (now - last) / 1000);
    gdt += dt;
    var steps = 0;
    while (gdt > step && steps < 6) { gdt -= step; update(step); steps++; }
    if (steps >= 6) gdt = 0; // never try to catch up after a stall (avoids a lag spiral)
    render();
    last = now;
    requestAnimationFrame(frame);
  }
  frame();
}

DD.boot = function (extraImages, onReady) {
  layout();
  var vehFiles = []; for (var vf in VEHICLES) if (vehFiles.indexOf(VEHICLES[vf].file) < 0) vehFiles.push(VEHICLES[vf].file);
  var names = ['background.png', 'sprites.png', 'billboards.png'].concat(vehFiles).concat(extraImages || []);
  loadImages(names, function (imgs) {
    background = imgs['background.png']; sprites = imgs['sprites.png'];
    billboardSprites = imgs['billboards.png'];
    SPRITES.BILLBOARDS.forEach(function (s) { s.sheet = billboardSprites; });
    for (var vk in VEHICLES) VEHICLES[vk].sheet = imgs[VEHICLES[vk].file];
    onReady && onReady(imgs);
    resetRoad();
    startLoop();
  });
};

// ── GHOST RIVAL: a phantom roadster racing the same two laps. Passes through traffic; can't be hit. ──
function updateGhost(dt) {
  var g = DD.ghost; if (!g || !g.on) return;
  if (DD.state !== 'racing' && DD.state !== 'finishing') return;
  var seg = findSegment(g.z), gap = g.dist - DD.raceDist; // + = ghost ahead
  var target = maxSpeed * (0.80 - Math.min(0.08, Math.abs(seg.curve) * 0.012));
  if (gap > segmentLength * 160) target *= 0.9; else if (gap < -segmentLength * 160) target *= 1.06; // keep it in the race
  g.speed = Util.accelerate(g.speed, g.speed < target ? accel * 0.8 : decel, dt);
  g.speed = Math.min(g.speed, target * 1.02);
  g.t += dt; g.offset = Math.sin(g.t * 0.45) * 0.55 + Math.sin(g.t * 1.3) * 0.12;
  g.z = Util.increase(g.z, dt * g.speed, trackLength); g.dist += dt * g.speed;
  g.percent = Util.percentRemaining(g.z, segmentLength);
  if (!g.doneT && g.dist >= trackLength * TOTAL_LAPS) g.doneT = DD.raceTime;
  if (DD.state === 'racing') {
    var ahead = gap > 0;
    if (g.ahead !== undefined && ahead !== g.ahead && DD.raceTime - (g.msgT || -9) > 4 && Math.abs(gap) < segmentLength * 30) {
      g.msgT = DD.raceTime; DD.hooks.onGhost && DD.hooks.onGhost(ahead); AudioEngine.ghostWail && AudioEngine.ghostWail();
    }
    g.ahead = ahead;
  }
}
function drawGhost(segment) {
  var g = DD.ghost, view = g.offset < -0.15 ? '_L' : g.offset > 0.15 ? '_R' : '';
  var spr = SPRITES['GHOST' + view];
  var sc = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, g.percent);
  var sx = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, g.percent) + sc * g.offset * roadWidth * XS;
  var sy = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, g.percent);
  ctx.save(); ctx.globalAlpha = 0.55 + 0.2 * Math.sin(g.t * 6);
  var r = Render.sprite(ctx, width, height, resolution, roadWidth, sprites, spr, sc, sx, sy, -0.5, -1, segment.clip);
  ctx.restore();
  if (r) FX.afterCar(ctx, r, spr, segment.fog, '140,255,255');
}
DD.resetRace = function () {
  position = 0; speed = 0; playerX = 0;
  keyLeft = keyRight = keyFaster = keySlower = false;
  DD.raceTime = 0; DD.lapTime = 0; DD.lap = 1; DD.lapTimes = []; DD.raceDist = 0; DD.hitCooldown = 0; DD.offroad = 0;
  skyOffset = hillOffset = treeOffset = 0;
  resetCars(); FX.reset();
  DD.damage = 0; DD.dmgT = -9; DD.wasFaster = false;
  DD.ghost = { on: true, z: playerZ + segmentLength * 4, dist: segmentLength * 4, offset: 0.5, speed: 0, t: 0, percent: 0 };
};
DD.startCountdown = function () { DD.resetRace(); DD.state = 'countdown'; DD.countdownT = 3; DD.lastBeep = 4; };

window.addEventListener('resize', function () { clearTimeout(DD._rt); DD._rt = setTimeout(layout, 80); });
if (window.visualViewport) visualViewport.addEventListener('resize', function () { clearTimeout(DD._rt); DD._rt = setTimeout(layout, 80); });
