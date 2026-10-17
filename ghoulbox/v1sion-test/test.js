/* Ghoul Box — V1SION Compliance Test (a fake NeuraNest survey). Each answer carries 0-3 compliance points.
   Share links store only the final percentage (?c=0..100), and tiers are derived from it, so you can reword copy freely,
   but changing tier ranges changes what old links show. Lore: https://thejurn.fandom.com/wiki/V1SION */
(function () {
  'use strict';
  var GB = window.GB, $ = function (id) { return document.getElementById(id); };
  var Q = [
    { q: 'Your alarm goes off at 6:00 AM. You:', a: [[3, 'Rise instantly. Hydrate. Smile at the wall screen.'], [2, 'Hit snooze exactly once, as scheduled.'], [1, 'Snooze four times and dream about a haunted mall.'], [0, 'Alarm? I go to sleep at 6 AM.']] },
    { q: 'NeuraNest recommends a playlist: "Calm Focus Beige, Vol. 9." You:', a: [[3, 'Already on repeat. It is perfectly balanced.'], [2, 'Leave it on in the background. It\'s fine.'], [1, 'Skip to anything with a guitar in it.'], [0, 'Replace it with horror punk at a volume the neighbors can feel.']] },
    { q: 'The Terms & Conditions are 400 pages long. You:', a: [[3, 'Read all 400 pages and agree enthusiastically.'], [2, 'Click "Accept All". Life is short.'], [1, 'Accept, but feel weird about it for a week.'], [0, 'Fold them into a paper bat and set it free.']] },
    { q: 'Pick an outfit for the weekend.', a: [[3, 'Crisp white suit, white gloves. Spotless.'], [2, 'Business casual, but make it beige.'], [1, 'Band tee under a blazer. A compromise.'], [0, 'Leather jacket, ripped jeans, a little fake blood.']] },
    { q: 'A friend suggests a midnight trip to the abandoned drive-in. You:', a: [[3, 'Report them to the Department of Wellness.'], [2, 'Decline. Midnight is for sleep cycles.'], [1, 'Go, but wear a reflective vest.'], [0, 'Already there. Brought snacks and a boombox.']] },
    { q: 'At a concert, the ideal crowd should:', a: [[3, 'Stand motionless and sway in synchronized rhythm.'], [2, 'Clap politely at the designated intervals.'], [1, 'Nod aggressively near the back.'], [0, 'Form a mosh pit with at least one skeleton in it.']] },
    { q: 'Your feelings are:', a: [[3, 'Optimized, quantized and sealed for freshness.'], [2, 'Mostly on mute.'], [1, 'Kept in a shoebox under the bed.'], [0, 'Turned into songs and screamed into the void.']] },
    { q: 'A pirate radio signal hijacks your feed with something weird. You:', a: [[3, 'Report the frequency. Static is a threat.'], [2, 'Switch back to the approved station.'], [1, 'Listen for a minute, just to confirm it\'s bad.'], [0, 'Turn it up, record it and tell everyone.']] }
  ];
  var MAXP = Q.length * 3;
  var TIERS = [
    { max: 12, name: 'Unregistered Signal', good: true, desc: 'NeuraNest has no file on you. You are pure static in their system, a song that refuses to be quantized. The JURN would let you roadie, and Grave Hog is already making you a homemade backstage pass.', verdict: '[ STATUS: NONCOMPLIANT · THREAT LEVEL: ENCORE ]', stamp: 'REBEL' },
    { max: 37, name: 'Certified Glitch', good: true, desc: 'You have a couple of beige habits, but your heart runs on distortion. The algorithm keeps trying to sort you and keeps getting a 404. Keep glitching.', verdict: '[ STATUS: UNSTABLE · RECOMMEND: MORE HORROR PUNK ]', stamp: 'GLITCH' },
    { max: 62, name: 'Partially Optimized', good: false, desc: 'Half rebel, half spreadsheet. The algorithm thinks it has you figured out. It doesn\'t. Yet. Tune into Double Future Radio before the beige sets in.', verdict: '[ STATUS: UNDER OBSERVATION ]', stamp: 'PENDING' },
    { max: 87, name: 'Model Citizen (Concerning)', good: false, desc: 'NeuraNest likes you. That\'s the problem. Your applause is right on the beat and your sock drawer is labeled. Prescription: one JURN album, played loud, immediately.', verdict: '[ STATUS: COMPLIANT · SOUL: OPTIONAL ]', stamp: 'COMPLIANT' },
    { max: 100, name: 'V1SION Front Row', good: false, desc: 'Fully compliant. White suit pressed, gloves spotless, imagination archived for your safety. Don\'t panic: the cure for "This Is the Cure" is a loud guitar. Blink twice if you need us.', verdict: '[ STATUS: OPTIMIZED · IMAGINATION: NOT FOUND ]', stamp: 'OPTIMIZED' }
  ];
  var tierFor = function (p) { for (var i = 0; i < TIERS.length; i++) if (p <= TIERS[i].max) return TIERS[i]; return TIERS[TIERS.length - 1]; };
  var i = 0, pts = 0, cur = null;
  function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  function start() { i = 0; pts = 0; $('intro').hidden = true; $('res').hidden = true; $('quiz').hidden = false; history.replaceState(null, '', location.pathname); ask(); }
  function ask() {
    var item = Q[i]; $('qcount').textContent = 'Item ' + (i + 1) + ' of ' + Q.length; $('bar').style.width = (i / Q.length * 100) + '%'; $('qtext').textContent = item.q;
    var box = $('opts'); box.textContent = '';
    shuffle(item.a).forEach(function (ans) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = ans[1];
      b.addEventListener('click', function () {
        if (box.dataset.locked) return; box.dataset.locked = '1'; b.classList.add('picked'); pts += ans[0];
        setTimeout(function () { delete box.dataset.locked; i++; if (i < Q.length) ask(); else finish(); }, 260);
      });
      box.appendChild(b);
    });
    var first = box.querySelector('button'); if (first && i > 0) first.focus({ preventScroll: true });
  }
  function finish() { $('bar').style.width = '100%'; var p = Math.round(pts / MAXP * 100); history.replaceState(null, '', resultURL(p)); show(p, false); }
  function resultURL(p) { var u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('c', String(p)); return u.toString(); }
  function shareText(p) { var t = tierFor(p); return '🧾 I scored ' + p + '% compliant on the V1SION Compliance Test: ' + t.name.toUpperCase() + '. ' + (t.good ? 'NeuraNest is worried. 🤘' : 'Send horror punk. 🆘') + ' Low is good. How compliant are you?'; }
  function show(p, fromLink) {
    cur = p; var t = tierFor(p);
    $('intro').hidden = true; $('quiz').hidden = true; $('res').hidden = false;
    $('res').querySelector('.vres').classList.toggle('bad', !t.good);
    $('youare').textContent = fromLink ? 'Someone\'s assessment (take the test to get yours)' : 'Assessment complete';
    $('vpct').textContent = p; $('vtier').textContent = t.name; $('vdesc').textContent = t.desc; $('vverdict').textContent = t.verdict;
    $('xshare').href = GB.xIntent(shareText(p), resultURL(p));
    $('again').textContent = fromLink ? '🧾 Take the Test' : '🔁 Retake Test';
    document.title = p + '% Compliant: ' + t.name + ' — V1SION Compliance Test | Ghoul Box';
    GB.fontsReady().then(function () { draw(p); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function draw(p) {
    var t = tierFor(p), c = $('report'), x = c.getContext('2d'), W = 1080, H = 1350, R = GB.rng(p * 2654435761 + 7);
    x.save();
    x.fillStyle = '#050508'; x.fillRect(0, 0, W, H);
    // the sterile form
    x.save(); x.translate(540, 660); x.rotate(-.015); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 50; x.fillStyle = '#f4f6f8'; x.fillRect(-440, -580, 880, 1160); x.shadowBlur = 0;
    x.fillStyle = '#1d2430'; x.textAlign = 'left'; x.font = '900 40px Inter, sans-serif'; x.fillText('NEURANEST INSTITUTE', -390, -490);
    x.font = '600 22px Inter, sans-serif'; x.fillStyle = '#5b6676'; x.fillText('FORM NN-01 · BEHAVIORAL COMPLIANCE REPORT', -390, -450);
    x.fillRect(-390, -428, 780, 4);
    x.fillText('CITIZEN #' + (100000 + (p * 7919 + 4243) % 899999), -390, -385); x.textAlign = 'right'; x.fillText('ENGINEERED FOR COMPLIANCE', 390, -385);
    x.textAlign = 'center'; x.fillStyle = '#5b6676'; x.font = '700 30px Inter, sans-serif'; x.fillText('COMPLIANCE INDEX', 0, -300);
    x.fillStyle = t.good ? '#9aa3af' : '#1d2430'; x.font = '900 220px Inter, sans-serif'; x.fillText(p + '%', 0, -100);
    // bar
    x.fillStyle = '#dde3ea'; x.fillRect(-360, -60, 720, 34); x.fillStyle = t.good ? '#9aa3af' : '#1d2430'; x.fillRect(-360, -60, 720 * p / 100, 34);
    x.font = '600 20px Inter, sans-serif'; x.fillStyle = '#8a94a3'; x.textAlign = 'left'; x.fillText('REBEL', -360, 0); x.textAlign = 'right'; x.fillText('V1SION', 360, 0);
    x.textAlign = 'center'; x.fillStyle = '#1d2430'; x.font = '800 54px Inter, sans-serif'; x.fillText(t.name.toUpperCase(), 0, 100, 800);
    x.font = '500 26px ui-monospace, monospace'; x.fillStyle = '#5b6676'; x.fillText(t.verdict, 0, 150, 800);
    // redacted lines
    x.fillStyle = '#1d2430'; for (var r = 0; r < 6; r++) { var lw = 300 + R() * 440; x.fillRect(-390, 210 + r * 44, lw, 18); }
    x.font = '600 18px Inter, sans-serif'; x.fillStyle = '#8a94a3'; x.fillText('[ deviation suppressed ]   [ risk eliminated ]   [ soul: not required ]', 0, 510);
    // stamp
    x.save(); x.translate(170, 330); x.rotate(-.18); x.strokeStyle = t.good ? 'rgba(255,23,68,.85)' : 'rgba(29,36,48,.85)'; x.lineWidth = 8;
    x.font = '900 56px Inter, sans-serif'; var sw = x.measureText(t.stamp).width + 60; x.strokeRect(-sw / 2, -50, sw, 90); x.fillStyle = x.strokeStyle; x.fillText(t.stamp, 0, 15); x.restore();
    x.restore();
    // JURN graffiti over the top
    x.save(); x.translate(540, 1185); x.rotate(-.06); x.textAlign = 'center'; x.lineJoin = 'round';
    var tag = t.good ? 'STAY UNCOMPLIANT' : 'WAKE UP! LISTEN TO THE JURN';
    x.font = '400 ' + (t.good ? 104 : 74) + 'px Creepster, cursive'; x.lineWidth = 14; x.strokeStyle = '#000'; x.strokeText(tag, 0, 0, 980);
    x.shadowColor = '#39ff14'; x.shadowBlur = 30; x.fillStyle = '#39ff14'; x.fillText(tag, 0, 0, 980); x.shadowBlur = 0;
    for (var d = 0; d < 14; d++) { var dx = -420 + R() * 840, dh = 20 + R() * 60; x.fillRect(dx, 10, 6, dh); x.beginPath(); x.arc(dx + 3, 10 + dh, 6, 0, 7); x.fill(); }
    x.restore();
    x.textAlign = 'center'; x.font = '700 30px Inter, sans-serif'; x.fillStyle = '#00ff88'; x.fillText('Test yourself: thejurn.com/ghoulbox', 540, H - 30);
    x.restore(); return c;
  }
  $('start').addEventListener('click', start); $('again').addEventListener('click', start);
  $('dl').addEventListener('click', function () { if (cur !== null) GB.fontsReady().then(function () { GB.download(draw(cur), 'v1sion-compliance-' + cur + '.png'); }); });
  $('copy').addEventListener('click', function () { if (cur !== null) GB.copy(shareText(cur) + ' ' + resultURL(cur)); });
  $('share').addEventListener('click', function () { if (cur === null) return; GB.fontsReady().then(function () { GB.share({ title: 'V1SION Compliance Test: ' + cur + '%', text: shareText(cur), url: resultURL(cur), canvas: draw(cur), filename: 'v1sion-compliance-' + cur + '.png' }); }); });
  var raw = new URLSearchParams(location.search).get('c'), pv = /^\d{1,3}$/.test(raw || '') ? parseInt(raw, 10) : NaN;
  if (!isNaN(pv) && pv >= 0 && pv <= 100) show(pv, true);
})();
