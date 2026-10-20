/* Creepy Text Generator: pure client-side Unicode transforms. Text never leaves the browser (except in a ?t= link you choose to share). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MAX = 200, LINK_MAX = 100, DEFAULT = 'The JURN';
  var cps = function (s) { return Array.from(s); };
  var U = String.fromCodePoint;
  function clean(s, max) { return cps(String(s || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F<>]/g, '').replace(/\r\n?/g, '\n')).slice(0, max).join(''); }

  // Math alphanumerics: base code points + the "holes" that live in Letterlike Symbols.
  function mathStyle(up, low, dig, holes) {
    return function (s) {
      return cps(s).map(function (c) {
        if (holes && holes[c]) return U(holes[c]);
        var o = c.charCodeAt(0);
        if (c.length === 1 && o >= 65 && o <= 90 && up) return U(up + o - 65);
        if (c.length === 1 && o >= 97 && o <= 122 && low) return U(low + o - 97);
        if (c.length === 1 && o >= 48 && o <= 57 && dig) return U(dig + o - 48);
        return c;
      }).join('');
    };
  }
  function table(from, to) { var m = {}, t = cps(to); cps(from).forEach(function (c, i) { m[c] = t[i]; }); return m; }
  function mapper(m) { return function (s) { return cps(s).map(function (c) { return m[c] !== undefined ? m[c] : c; }).join(''); }; }
  function combine(mark) { return function (s) { return cps(s).map(function (c) { return /\s/.test(c) ? c : c + mark; }).join(''); }; }

  var AZ = 'abcdefghijklmnopqrstuvwxyz';
  var SMALL = table(AZ + AZ.toUpperCase(), 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ' + 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ');
  var FLIP = table('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"()[]{}<>&_;',
                   'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ᗺƆᗡƎℲ⅁HIſꓘ˥WNOԀῸᴚS⊥∩ΛMX⅄Z0ƖᄅƐㄣϛ9ㄥ86˙\'¡¿,„)(][}{><⅋‾؛');
  var MIRROR = table('bdpq()[]{}<>/\\', 'dbqp)(][}{><\\/');
  var CYR = table('ABCDEFGHIKMNORTUWXYabcdehiknoprtuwxy', 'ДБСDЄҒGНЇКМИФЯТЦШЖЧдвсԁєнїкифрятцшжу');
  var BUBBLE = {}, NEG = {};
  for (var i = 0; i < 26; i++) { BUBBLE[AZ[i].toUpperCase()] = U(0x24B6 + i); BUBBLE[AZ[i]] = U(0x24D0 + i); NEG[AZ[i]] = NEG[AZ[i].toUpperCase()] = U(0x1F150 + i); }
  for (i = 1; i <= 9; i++) { BUBBLE[i] = U(0x2460 + i - 1); NEG[i] = U(0x2776 + i - 1); }
  BUBBLE['0'] = '⓪'; NEG['0'] = '⓿';

  // Zalgo: seeded by the text, so the same text + intensity gives the same output (stable while you copy). Reroll changes the seed.
  var UP = [], MID = [0x0334, 0x0335, 0x0336, 0x0337, 0x0338, 0x0489], DOWN = [];
  for (i = 0x0300; i <= 0x0315; i++) UP.push(i); [0x031A, 0x033D, 0x0344, 0x034A, 0x034B, 0x034C, 0x0350, 0x0351, 0x0352, 0x0357, 0x035B, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369, 0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F].forEach(function (c) { UP.push(c); });
  for (i = 0x0316; i <= 0x0333; i++) if ([0x031A, 0x031B, 0x0321, 0x0322, 0x0327, 0x0328].indexOf(i) < 0) DOWN.push(i); [0x0339, 0x033A, 0x033B, 0x033C, 0x0345, 0x0347, 0x0348, 0x0349, 0x034D, 0x034E, 0x0353, 0x0354, 0x0355, 0x0356, 0x0359, 0x035A].forEach(function (c) { DOWN.push(c); });
  var LEVELS = { low: [1, 0, 1], medium: [3, 1, 3], possessed: [9, 2, 9] };
  var reroll = 0;
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function zalgo(s, level) {
    var L = LEVELS[level] || LEVELS.medium, R = GB.rng(hash(level + '|' + reroll + '|' + s));
    var pick = function (a, n) { var o = ''; for (var k = 0; k < n; k++) o += U(a[Math.floor(R() * a.length)]); return o; };
    return cps(s).map(function (c) {
      if (/\s/.test(c)) return c;
      var vary = function (n) { return n ? Math.max(1, Math.round(n * (0.5 + R()))) : 0; };
      return c + pick(UP, vary(L[0])) + pick(MID, L[1] ? Math.floor(R() * (L[1] + 1)) : 0) + pick(DOWN, vary(L[2]));
    }).join('');
  }
  var DRIP = [[0x0329], [0x0323, 0x0329], [0x0326], [0x0329, 0x0329], [0x0359], [0x0323]];
  function drip(s) { var n = 0; return cps(s).map(function (c) { return /\s/.test(c) ? c : c + DRIP[(n++) % DRIP.length].map(function (x) { return U(x); }).join(''); }).join(''); }
  var frame = function (l, r) { return function (s) { return s.split('\n').map(function (x) { return x.trim() ? l + x + r : x; }).join('\n'); }; };
  var rev = function (s) { return cps(s).reverse().join(''); };

  // id is used in tests; note = where it may not render.
  var STYLES = [
    { id: 'zalgo', name: 'Zalgo / glitch', fn: function (s) { return zalgo(s, level); }, zalgo: true, note: 'Stacked combining marks. Some sites (and some Discord/X views) clip or strip them; they add a lot of characters.' },
    { id: 'fraktur', name: 'Fraktur (blackletter)', fn: mathStyle(0x1D504, 0x1D51E, 0, { C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 }), note: 'Math letters: digits stay plain. Screen readers may read them oddly or skip them.' },
    { id: 'fraktur-bold', name: 'Bold Fraktur', fn: mathStyle(0x1D56C, 0x1D586, 0x1D7CE), note: 'Math letters. Old Android fonts may show boxes.' },
    { id: 'script', name: 'Script', fn: mathStyle(0x1D49C, 0x1D4B6, 0, { B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B, e: 0x212F, g: 0x210A, o: 0x2134 }), note: 'Math letters: digits stay plain.' },
    { id: 'script-bold', name: 'Bold script', fn: mathStyle(0x1D4D0, 0x1D4EA, 0x1D7CE), note: 'Math letters.' },
    { id: 'double', name: 'Double-struck', fn: mathStyle(0x1D538, 0x1D552, 0x1D7D8, { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 }), note: 'Math letters, very widely supported.' },
    { id: 'smallcaps', name: 'Small caps', fn: mapper(SMALL), note: 'Phonetic letters. There is no true small-caps X, so x stays plain.' },
    { id: 'upside', name: 'Upside-down', fn: function (s) { return rev(mapper(FLIP)(s)); }, note: 'A few letters are lookalikes (ᗺ, ꓘ, Ῠ) and can show as boxes on older devices.' },
    { id: 'strike', name: 'Strikethrough', fn: combine('\u0336'), note: 'Combining marks: doubles the length. The line can look broken in some fonts.' },
    { id: 'slash', name: 'Slashed', fn: combine('\u0338'), note: 'Combining marks: doubles the length.' },
    { id: 'bubble', name: 'Bubble', fn: mapper(BUBBLE), note: 'Widely supported. Some apps show these as emoji.' },
    { id: 'bubble-neg', name: 'Negative bubble', fn: mapper(NEG), note: 'Capitals only (lowercase becomes capitals). May show as boxes on older Windows.' },
    { id: 'vapor', name: 'Vaporwave (full-width)', fn: function (s) { return cps(s).map(function (c) { var o = c.charCodeAt(0); return c === ' ' ? '\u3000' : (c.length === 1 && o > 32 && o < 127 ? U(o + 0xFEE0) : c); }).join(''); }, note: 'Full-width CJK forms: very widely supported.' },
    { id: 'cursed', name: 'Cursed (Cyrillic lookalike)', fn: mapper(CYR), note: 'Real Cyrillic letters. Some sites reject mixed scripts in usernames, and it reads as gibberish to screen readers.' },
    { id: 'drip', name: 'Dripping', fn: drip, note: 'Combining marks below each letter. Some fonts draw them unevenly.' },
    { id: 'mirror', name: 'Mirror (reversed)', fn: function (s) { return s.split('\n').map(function (x) { return rev(mapper(MIRROR)(x)); }).join('\n'); }, note: 'Plain letters, just backwards: works everywhere.' },
    { id: 'bats', name: 'Bat frame 🦇', fn: frame('🦇 ', ' 🦇'), note: 'Emoji.' },
    { id: 'pentagram', name: 'Inverted pentagram ⛧', fn: frame('⛧ ', ' ⛧'), note: '⛧ is missing from some older fonts.' },
    { id: 'dagger', name: 'Daggers †', fn: frame('†', '†'), note: 'Works everywhere.' },
    { id: 'skulls', name: 'Skulls ☠', fn: frame('☠ ', ' ☠'), note: 'Shows as an emoji on most phones.' },
    { id: 'webs', name: 'Cobwebs 🕸', fn: frame('🕸 ', ' 🕸'), note: 'Emoji.' },
    { id: 'crypt', name: 'Full crypt 🦇⛧☠', fn: function (s) { return frame('🦇⛧ ', ' ⛧🦇')(frame('☠ ', ' ☠')(mathStyle(0x1D56C, 0x1D586, 0x1D7CE)(s))); }, note: 'Bold Fraktur in a bat-and-skull frame.' }
  ];
  var level = 'medium';
  var LIMITS = [['Instagram bio', 150], ['X post', 280]];

  var list = $('styles'), rows = {};
  STYLES.forEach(function (st) {
    var row = document.createElement('div'); row.className = 'ct-row'; row.dataset.style = st.id;
    row.innerHTML = '<div class="ct-head"><b></b><span class="ct-len"></span></div><div class="ct-out" lang="und"></div><p class="ct-note"></p><button class="btn sm ct-copy" type="button">Copy</button>';
    row.querySelector('b').textContent = st.name; row.querySelector('.ct-note').textContent = st.note;
    row.querySelector('.ct-copy').addEventListener('click', function () { copyText(row.querySelector('.ct-out').textContent, this); });
    list.appendChild(row); rows[st.id] = row;
  });

  function copyText(text, btn) {
    var done = function (ok) {
      if (btn) { var t = btn.dataset.label || btn.textContent; btn.dataset.label = t; btn.textContent = ok ? 'Copied!' : 'Select & copy'; btn.classList.toggle('ok', ok); clearTimeout(btn._t); btn._t = setTimeout(function () { btn.textContent = t; btn.classList.remove('ok'); }, 1500); }
      GB.toast(ok ? 'Copied! Go haunt something 🦇' : 'Copy failed: select the text and copy it manually');
    };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } document.body.removeChild(ta); done(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); else fallback();
  }

  function input() { return clean($('t').value, MAX) || DEFAULT; }
  function render() {
    var s = input(), worst = 0;
    STYLES.forEach(function (st) {
      var out = st.fn(s), n = cps(out).length, row = rows[st.id];
      row.querySelector('.ct-out').textContent = out;
      var over = LIMITS.filter(function (l) { return n > l[1]; }).map(function (l) { return l[0]; });
      var len = row.querySelector('.ct-len'); len.textContent = n + ' chars' + (over.length ? ' · too long for ' + over.join(' & ') : '');
      len.classList.toggle('warn', over.length > 0); worst = Math.max(worst, n);
    });
    var n = cps(clean($('t').value, MAX)).length;
    $('count').textContent = n + ' / ' + MAX;
    $('longwarn').hidden = worst <= 150;
    $('xshare').href = GB.xIntent('My name, but cursed: ' + STYLES[1].fn(s) + ' 🦇 Make yours:', link());
  }
  function link() {
    var t = clean($('t').value, LINK_MAX).trim(), u = location.origin + location.pathname;
    return t ? u + '?t=' + encodeURIComponent(t) : u;
  }

  document.querySelectorAll('[data-level]').forEach(function (b) {
    b.addEventListener('click', function () {
      level = b.dataset.level;
      document.querySelectorAll('[data-level]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });
  $('reroll').addEventListener('click', function () { reroll++; render(); });
  $('t').addEventListener('input', render);
  $('clear').addEventListener('click', function () { $('t').value = ''; $('t').focus(); render(); });
  $('copyall').addEventListener('click', function () {
    copyText(STYLES.map(function (st) { return st.name + ': ' + rows[st.id].querySelector('.ct-out').textContent; }).join('\n'), this);
  });
  $('copylink').addEventListener('click', function () { copyText(link(), this); });

  var q = new URLSearchParams(location.search).get('t');
  if (q) { $('t').value = clean(q, LINK_MAX); $('shared').hidden = false; }
  render();
  window.CT_DEBUG = { styles: STYLES, transform: function (id, s, lv) { var st = STYLES.filter(function (x) { return x.id === id; })[0]; var keep = level; if (lv) level = lv; var o = st.fn(s); level = keep; return o; }, clean: clean };
})();
