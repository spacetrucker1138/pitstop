/* Ghoul Box shared helpers: toast, copy, share (Web Share API + X intent), canvas download. */
(function () {
  'use strict';
  var GB = {};
  var toastEl;
  GB.toast = function (msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(GB._t); GB._t = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  };
  GB.copy = function (text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); GB.toast(ok ? 'Copied to clipboard 🦴' : 'Copy failed — select and copy manually');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { GB.toast('Copied to clipboard 🦴'); }, fallback);
    } else { fallback(); }
  };
  GB.xIntent = function (text, url) {
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
  };
  GB.canvasBlob = function (canvas) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, 'image/png'); });
  };
  GB.download = function (canvas, filename) {
    GB.canvasBlob(canvas).then(function (blob) {
      if (!blob) { GB.toast('Could not render image'); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      GB.toast('Downloading ' + filename);
    });
  };
  /* Share: native sheet (with image when supported) → falls back to copying the link. */
  GB.share = function (opts) {
    var data = { title: opts.title, text: opts.text, url: opts.url };
    var go = function (d) {
      return navigator.share(d).catch(function (e) { if (e && e.name !== 'AbortError') { GB.copy(opts.url); } });
    };
    if (!navigator.share) { GB.copy(opts.text + ' ' + opts.url); return; }
    if (opts.canvas && navigator.canShare) {
      GB.canvasBlob(opts.canvas).then(function (blob) {
        var withFile = data;
        try {
          var file = new File([blob], opts.filename || 'ghoulbox.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) { withFile = { title: data.title, text: data.text + ' ' + data.url, files: [file] }; }
        } catch (e) { withFile = data; }
        go(withFile);
      });
    } else { go(data); }
  };
  /* Small seeded RNG so shared links redraw identical art. */
  GB.rng = function (seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  GB.fontsReady = function () {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('80px Creepster'), document.fonts.load('700 40px Inter'), document.fonts.load('800 40px Inter')
    ]).catch(function () {}).then(function () { return document.fonts.ready; });
  };
  window.GB = GB;
})();
