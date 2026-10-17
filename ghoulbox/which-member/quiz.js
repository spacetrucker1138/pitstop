/* Ghoul Box — "Which JURN Member Are You?" quiz.
   Bios condensed from The JURN Wiki character pages (linked per member). Don't add lore that isn't on the wiki. */
(function () {
  'use strict';
  var GB = window.GB, $ = function (id) { return document.getElementById(id); };
  var WIKI = 'https://thejurn.fandom.com/wiki/';
  var M = {
    vox: { num: 1, name: 'Vox De Gaunt', role: 'Lead Vocals · The Voice of the Grave', card: '../assets/cards/vox.webp', wiki: WIKI + 'Vox_De_Gaunt', color: '#00ffff',
      quote: 'Some songs survive longer than the worlds that created them.',
      tag: 'Pure theater on stage, quiet keeper of secrets off it.',
      bio: 'You are the lead vocalist and voice of The JURN. On stage you are pure theater: sweeping monologues, every lyric your own, and total confidence that the band is headed for the history books (or at least the tombstones). Off stage the showman goes quiet, calm, watchful and keeping old songs and older secrets. Under the ego, you are the one holding the band (barely) together.',
      facts: [['Loves', 'the spotlight, fog machines, dark poetry, vintage horror hosts'], ['Hates', 'being ignored, bad sound systems, broken mics, Taz\'s ideas'], ['Never without', 'a vintage chrome mic and a skeleton-key necklace']] },
    taz: { num: 2, name: 'Taz De Gaunt', role: 'Bass · The Chaos Engine', card: '../assets/cards/taz.webp', wiki: WIKI + 'Taz_De_Gaunt', color: '#ff1744',
      quote: 'THIS PLACE IS AWESOME!',
      tag: 'The heart of the band, and the headache.',
      bio: 'You are the bassist, Vox\'s younger brother, and the band\'s Chaos Engine: loud, impulsive and permanently overcaffeinated. A former gravedigger brought back by The Encore, you live entirely in the moment, break at least one thing every show, and forget lyrics but never a bass line. You also host the late-night horror show Top Tombs, where your classy horror-host act never survives the episode.',
      facts: [['Loves', 'loud bass, cheap fireworks, arcade games, horror B-movies, energy drinks'], ['Hates', 'rules, boring gigs, being told no, waiting around'], ['Secretly', 'a soft spot for animals and a pocket full of weird keychains']] },
    riff: { num: 3, name: 'Riff-Rot', role: 'Lead Guitar · The Sound Surgeon', card: '../assets/cards/riff.webp', wiki: WIKI + 'Riff-Rot', color: '#39ff14',
      quote: 'Yeah… that\'s not how any of this works.',
      tag: 'The voice of reason with a flying V.',
      bio: 'You are the lead guitarist and the brains behind The JURN\'s wall of sound. A sarcastic perfectionist with trust issues, you know more about gear than people, and if it rattles, squeals or breaks you will fix it, or jury-rig it until it screams the right way. You complain about everyone, but without you the band would sound like skeletons falling down stairs. Your origins are the most mysterious in the band.',
      facts: [['Loves', 'classic horror films, old amps, black coffee, late-night drives, the perfect tone'], ['Hates', 'unnecessary drama, broken gear, bad sound, Taz\'s ideas'], ['Always', 'tuning something, and knows every back road']] },
    bonecrush: { num: 4, name: 'Sir Bonecrush', role: 'Drums · The Warlord', card: '../assets/cards/bonecrush.webp', wiki: WIKI + 'Sir_Bonecrush', color: '#ffaa00',
      quote: 'Every war has a rhythm.',
      tag: 'The sound of the apocalypse keeping time.',
      bio: 'You are the drummer, the tallest member of the band, and once a wandering knight named Sir Cethan. You have literally died many times across history and keep coming back ("Must have gotten better"). You hit drums like an artillery bombardment, yet you are one of the kindest members of the band: fond of animals, remembering every fan you meet, and apologizing to furniture after you break it.',
      facts: [['Loves', 'precision, structure, classic horror, strong coffee, old battle stories'], ['Dislikes', 'rushing, dishonor, broken drumsticks, unnecessary chaos'], ['Never', 'forgets a promise']] }
  };
  var Q = [
    { q: 'You walk into a party. What happens next?', a: [
      ['vox', 'I deliver a dramatic welcome speech nobody asked for.'], ['taz', 'A mosh pit somehow starts around me. Not my fault. Probably.'],
      ['riff', 'I find the sound system and fix it while complaining.'], ['bonecrush', 'I guard the snacks and remember everyone\'s name.']] },
    { q: 'Pick your fuel.', a: [
      ['vox', 'Whatever looks most dramatic through the fog machine.'], ['taz', 'Energy drinks. Plural. At once.'],
      ['riff', 'Black coffee. No sugar, no small talk.'], ['bonecrush', 'Strong coffee, sipped slowly, like a knight at dawn.']] },
    { q: 'Perfect Friday night?', a: [
      ['vox', 'A vintage horror-host marathon and some dark poetry.'], ['taz', 'Arcade games, cheap fireworks, then a weird roadside attraction.'],
      ['riff', 'A late-night drive down back roads nobody else knows.'], ['bonecrush', 'Swapping old battle stories with the people I love.']] },
    { q: 'Something just broke. What do you do?', a: [
      ['vox', 'Turn it into a monologue about the impermanence of all things.'], ['taz', 'Look innocent. I definitely broke it.'],
      ['riff', 'Jury-rig it until it screams the right way.'], ['bonecrush', 'Apologize to it. Sincerely.']] },
    { q: 'Your biggest pet peeve?', a: [
      ['vox', 'Being ignored. Or a broken microphone. Same pain.'], ['taz', 'Being told no. And waiting. And quiet.'],
      ['riff', 'Bad sound and unnecessary drama.'], ['bonecrush', 'Rushing, and dishonor.']] },
    { q: 'In a group project, you are…', a: [
      ['vox', 'The visionary who writes every word and takes it very seriously.'], ['taz', 'Pure energy. Everyone locks onto my vibe, for better or worse.'],
      ['riff', 'The one quietly fixing everybody else\'s mistakes.'], ['bonecrush', 'The loyal one who never forgets a promise.']] },
    { q: 'Pick a catchphrase.', a: [
      ['vox', '"Ladies, ghouls, and creatures of the night… WELCOME."'], ['taz', '"THIS PLACE IS AWESOME!"'],
      ['riff', '"Yeah… that\'s not how any of this works."'], ['bonecrush', '"Must have gotten better."']] },
    { q: 'What\'s in your pockets?', a: [
      ['vox', 'A skeleton key to a crypt no one has found.'], ['taz', 'A tangle of weird keychains and a pocket watch.'],
      ['riff', 'Broken guitar picks and strange knobs.'], ['bonecrush', 'A spare drumstick. Origin: unknown. Do not ask.']] }
  ];
  var ORDER = ['vox', 'taz', 'riff', 'bonecrush'];
  var i = 0, score, last;
  function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  function start() {
    i = 0; score = { vox: 0, taz: 0, riff: 0, bonecrush: 0 }; last = null;
    $('intro').hidden = true; $('res').hidden = true; $('quiz').hidden = false; ask();
    history.replaceState(null, '', location.pathname);
  }
  function ask() {
    var item = Q[i];
    $('qcount').textContent = 'Question ' + (i + 1) + ' of ' + Q.length;
    $('bar').style.width = (i / Q.length * 100) + '%';
    $('qtext').textContent = item.q;
    var box = $('opts'); box.textContent = '';
    shuffle(item.a).forEach(function (ans) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = ans[1];
      b.addEventListener('click', function () {
        if (box.dataset.locked) return; box.dataset.locked = '1'; b.classList.add('picked');
        score[ans[0]]++; last = ans[0];
        setTimeout(function () { delete box.dataset.locked; i++; if (i < Q.length) ask(); else finish(); }, 260);
      });
      box.appendChild(b);
    });
    var first = box.querySelector('button'); if (first && i > 0) first.focus({ preventScroll: true });
  }
  function finish() {
    $('bar').style.width = '100%';
    var best = Math.max.apply(null, ORDER.map(function (k) { return score[k]; }));
    var tied = ORDER.filter(function (k) { return score[k] === best; });
    var pick = tied.indexOf(last) !== -1 ? last : tied[0];
    var u = new URL(location.href); u.search = ''; u.searchParams.set('m', pick);
    history.replaceState(null, '', u.toString());
    showResult(pick, false);
  }
  function resultURL(key) { var u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('m', key); return u.toString(); }
  var cardImg = new Image(), curKey = null;
  function showResult(key, fromLink) {
    var m = M[key]; curKey = key;
    $('intro').hidden = true; $('quiz').hidden = true; $('res').hidden = false;
    $('youare').textContent = fromLink ? 'Someone got… (take the quiz to find yours)' : 'You are…';
    $('mname').textContent = m.name; $('mrole').textContent = '#' + m.num + ' · ' + m.role;
    $('mquote').textContent = '“' + m.quote + '”'; $('mbio').textContent = m.bio;
    var ul = $('mfacts'); ul.textContent = '';
    m.facts.forEach(function (f) { var li = document.createElement('li'), b = document.createElement('b'); b.textContent = f[0] + ': '; li.appendChild(b); li.appendChild(document.createTextNode(f[1])); ul.appendChild(li); });
    var img = $('mcard'); img.src = m.card; img.alt = m.name + ' — The JURN Series 1 trading card #' + m.num;
    $('msrc').href = m.wiki; $('msrc').textContent = 'The JURN Wiki — ' + m.name; $('mwiki').href = m.wiki;
    $('xshare').href = GB.xIntent('I took the quiz and I\'m ' + m.name + ' from The JURN 💀 “' + m.quote + '” Which JURN member are you?', resultURL(key));
    $('again').textContent = fromLink ? '💀 Take the Quiz' : '🔁 Retake Quiz';
    document.title = 'I\'m ' + m.name + ' — Which JURN Member Are You? | Ghoul Box';
    cardImg = new Image(); cardImg.src = m.card;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function drawShare() {
    var m = M[curKey], c = $('sharecard'), x = c.getContext('2d'), W = 1080, H = 1350;
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0430'); g.addColorStop(1, '#050508'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    var r = x.createRadialGradient(540, 700, 50, 540, 700, 700); r.addColorStop(0, 'rgba(191,0,255,.35)'); r.addColorStop(1, 'rgba(191,0,255,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.fillStyle = '#c084fc'; x.font = '800 34px Inter, sans-serif'; x.fillText('WHICH JURN MEMBER ARE YOU?', 540, 80);
    x.font = '400 92px Creepster, cursive'; x.fillStyle = '#e8e0d4'; x.fillText('I GOT', 540, 180);
    var cw = 560, ch = 840, cx = 260, cy = 220;
    x.save(); x.shadowColor = m.color; x.shadowBlur = 60; x.fillStyle = '#000'; x.fillRect(cx, cy, cw, ch); x.restore();
    if (cardImg.complete && cardImg.naturalWidth) x.drawImage(cardImg, cx, cy, cw, ch);
    x.font = '400 96px Creepster, cursive'; x.lineWidth = 12; x.strokeStyle = '#000'; x.lineJoin = 'round';
    x.strokeText(m.name.toUpperCase(), 540, 1160); x.fillStyle = '#39ff14'; x.shadowColor = '#39ff14'; x.shadowBlur = 24; x.fillText(m.name.toUpperCase(), 540, 1160); x.shadowBlur = 0;
    x.font = 'italic 600 34px Inter, sans-serif'; x.fillStyle = '#e8e0d4'; x.fillText(m.tag, 540, 1220);
    x.font = '700 30px Inter, sans-serif'; x.fillStyle = '#00ff88'; x.fillText('thejurn.com/ghoulbox', 540, 1300);
    return c;
  }
  function withCard(fn) {
    GB.fontsReady().then(function () {
      if (cardImg.complete) fn(drawShare());
      else { cardImg.onload = cardImg.onerror = function () { fn(drawShare()); }; }
    });
  }
  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('dl').addEventListener('click', function () { withCard(function (c) { GB.download(c, 'i-am-' + curKey + '-the-jurn.png'); }); });
  $('copy').addEventListener('click', function () { GB.copy(resultURL(curKey)); });
  $('share').addEventListener('click', function () {
    var m = M[curKey];
    withCard(function (c) { GB.share({ title: 'I\'m ' + m.name + '!', text: 'I took the quiz and I\'m ' + m.name + ' from The JURN 💀 Which JURN member are you?', url: resultURL(curKey), canvas: c, filename: 'i-am-' + curKey + '.png' }); });
  });
  var p = new URLSearchParams(location.search).get('m');
  if (p && M[p]) showResult(p, true);
})();
