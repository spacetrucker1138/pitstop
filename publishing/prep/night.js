/* GM Night Prep: pick a system, a length, and a vibe from the shared shelf. */
(function (root) {
  'use strict';

  var VIBES = [
    { id: 'isolation', label: 'Isolation', re: /\balone\b|\bsolo\b|derelict|last person|deep[- ]ocean|stranded|abandoned|s[oö]litary|\bonly you\b|empty night|\bbunker\b|lighthouse|submarine|radio station|\bisolat/ },
    { id: 'body', label: 'Body horror', re: /body horror|\bbody\b|flesh|infect|disease|parasite|mutat|\bblood|\bgore\b|cannibal|\bbloom\b|\brot\b|decay|\bcorpse\b|viscera|\borgan\b|myceli|fung|zombie|insect|\bbees?\b|\bwound\b|\bmeat\b|slime|ooze/ },
    { id: 'occult', label: 'Occult', re: /occult|\bcults?\b|\bcultist|ritual|\bdemons?\b|\bwitch|curse|haunt|\bghost\b|\bsaint\b|basilica|\bchurch\b|blasphem|relic|undead|vampire|\bchapel\b|\bgods?\b|prophet|\bgrave\b|necroman|folk horror|\bsummon|possess|\bdevil\b|\bspirit\b|\bcemetery\b|\bmonks?\b|\bunholy\b|\bhereti|\breligion/ },
    { id: 'corporate', label: 'Corporate', re: /corporat|\bcorp\b|\bcompany\b|\boffice\b|\bcontract\b|\bwage\b|\bemployer\b|cubicle|\blegal\b/ },
    { id: 'cosmic', label: 'Cosmic', re: /cosmic|eldritch|\bvoid\b|madness|psychic|cthulhu|mythos|lovecraft|unspeakable|\bstars?\b|\balien\b|outer god|incomprehensible/ },
    { id: 'roadside', label: 'Roadside / small-town', re: /roadside|\bmotel\b|\binn\b|small[- ]town|\bdiner\b|highway|drive[- ]in|\bvillage\b|\brural\b|lakeside|\btown\b|suburb|\btruck\b|\bgas\b|\bcounty\b|\bholiday\b|\bsprings\b|truck stop/ }
  ];

  function textOf(m) {
    return ((m.title || '') + ' ' + (m.blurb || '')).toLowerCase();
  }

  function signals(text) {
    var inspired = /inspired by one[- ]page/.test(text);
    var short = !inspired && !/full[- ]length/.test(text) && (
      /pamphlet|one[- ]pag(?:e|er)|one pager|trifold|micro[- ]?(?:game|module)|mini[- ]?(?:mystery|dungeon)/.test(text) ||
      /\bshort\b.{0,48}\b(?:scenario|adventure|incursion|module|one[- ]shot)\b/.test(text)
    );
    var sprawling = /campaign|hex[- ]?crawl|\bsandbox\b|sourcebook|pointcrawl|depth[- ]?crawl|megadungeon/.test(text);
    var anthology = /\banthology\b|\bfull[- ]length\b/.test(text);
    var session = /one[- ]shot|\bscenario\b|\bincursion\b|adventure|\bmodules?\b|\bmystery\b|\bquest\b|\bdungeon\b|\bfunnel\b|\bcrawl\b|\bencounter\b/.test(text);
    return { short: short, sprawling: sprawling, anthology: anthology, session: session };
  }

  function tierFor(sig, length) {
    if (length === 'short') {
      if (sig.short) return 'match';
      if (sig.sprawling || sig.session || sig.anthology) return 'miss';
      return 'unsure';
    }
    if (length === 'long') {
      if (sig.sprawling || sig.anthology) return 'match';
      if (sig.short || sig.session) return 'miss';
      return 'unsure';
    }
    if (sig.sprawling) return 'miss';
    if (sig.short && !sig.session) return 'miss';
    if (sig.session || sig.anthology || sig.short) return 'match';
    return 'unsure';
  }

  function isUtility(text, title) {
    var blob = text;
    if (/character sheet|google sheet|\bclasses\b|\bclass\b|rulebook|\brules\b|ruleset|image pack|art asset|stock image|floor ?plans?|skill list|bestiary|beatstiary|pet\/pest|\bpet\b|\bbackgrounds\b|adventure tables|\btables\b|\bd100\b|\bhandbook\b|\bguide to\b|core rule|\bun juego\b/.test(blob)) return true;
    if (/\bmaps for\b|\bmap collection\b|\bhex maps?\b/.test(blob)) return true;
    if (/\bmaps?\b/.test((title || '').toLowerCase()) && !/adventure|scenario|mystery|module|dungeon|incursion|one[- ]shot/.test(blob)) return true;
    return false;
  }

  function playScore(text, sig, length) {
    var s = 1;
    if (/one[- ]shots?/.test(text)) s += 6;
    if (/\bpamphlet\b/.test(text)) s += length === 'short' ? 4 : 1;
    if (/\b(?:incursion|scenario)s?\b/.test(text)) s += 5;
    if (/adventure/.test(text)) s += 4;
    if (/\b(?:modules?|mystery|quest|dungeon|funnel|crawl|encounter)\b/.test(text)) s += 3;
    if (/\bhorror\b|haunt|hunt|surviv|attack|murder|monster|vampire|demon|derelict|last person/.test(text)) s += 2;
    if (/\bosr\b/.test(text)) s -= 3;
    if (/\bmonsters?\b/.test(text) && !/adventure|scenario|mystery|module|dungeon|one[- ]shot|incursion/.test(text)) s -= 4;
    if (isUtility(text, '')) s -= 10;
    if (length === 'short' && sig.short) s += 4;
    if (length === 'medium' && sig.session && !sig.short && !sig.sprawling) s += 3;
    if (length === 'long' && sig.sprawling) s += 5;
    if (length === 'long' && sig.anthology && !sig.sprawling) s += 3;
    return s;
  }

  function byScore(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    var at = a.module.title.toLowerCase();
    var bt = b.module.title.toLowerCase();
    if (at < bt) return -1;
    if (at > bt) return 1;
    return 0;
  }

  function diversify(items, n) {
    var buckets = [];
    var seen = Object.create(null);
    var i, key, row, added, out;
    for (i = 0; i < items.length; i++) {
      key = items[i].module.sys[0];
      if (seen[key] === undefined) {
        seen[key] = buckets.length;
        buckets.push([]);
      }
      buckets[seen[key]].push(items[i]);
    }
    out = [];
    row = 0;
    while (out.length < n) {
      added = false;
      for (i = 0; i < buckets.length && out.length < n; i++) {
        if (buckets[i][row]) {
          out.push(buckets[i][row]);
          added = true;
        }
      }
      if (!added) break;
      row++;
    }
    return out;
  }

  function take(items, n, any) {
    if (items.length <= n && !any) return items.slice();
    if (!any) return items.slice(0, n);
    return diversify(items, n);
  }

  function vibeDef(id) {
    var i;
    for (i = 0; i < VIBES.length; i++) if (VIBES[i].id === id) return VIBES[i];
    return null;
  }

  function matchesVibe(text, id) {
    var v = vibeDef(id);
    return !!(v && v.re.test(text));
  }

  function notIn(list, item) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i] === item) return false;
    return true;
  }

  function shortlist(modules, state) {
    var length = state.length || 'medium';
    var sys = state.sys || '';
    var vibe = state.vibe || '';
    var any = !sys;
    var pool = [];
    var matches = [];
    var unsure = [];
    var misses = [];
    var i, m, text, sig, row, base, relaxed, hits, widened, hitCount, primary, fill, chosen;

    for (i = 0; i < modules.length; i++) {
      m = modules[i];
      if (sys && m.sys.indexOf(sys) === -1) continue;
      text = textOf(m);
      sig = signals(text);
      row = {
        module: m,
        text: text,
        utility: isUtility(text, m.title),
        tier: tierFor(sig, length),
        score: playScore(text, sig, length)
      };
      pool.push(row);
      if (row.utility) continue;
      if (row.tier === 'match') matches.push(row);
      else if (row.tier === 'unsure') unsure.push(row);
      else misses.push(row);
    }
    matches.sort(byScore);
    unsure.sort(byScore);
    misses.sort(byScore);

    relaxed = false;
    base = matches;
    if (matches.length < 3) {
      relaxed = true;
      base = matches.concat(unsure);
      if (base.length < 3) base = base.concat(misses);
    }

    hits = [];
    if (vibe) {
      var vibePool = matches.concat(unsure);
      for (i = 0; i < vibePool.length; i++) if (matchesVibe(vibePool[i].text, vibe)) hits.push(vibePool[i]);
      hits.sort(byScore);
    }
    hitCount = 0;
    widened = false;
    if (!vibe) {
      chosen = take(base, 6, any);
    } else {
      var strongHits = [];
      var softHits = [];
      var rankedHits;
      for (i = 0; i < hits.length; i++) {
        if (hits[i].tier === 'match') strongHits.push(hits[i]);
        else softHits.push(hits[i]);
      }
      rankedHits = strongHits.length >= 3 ? strongHits : strongHits.concat(softHits);
      if (rankedHits.length >= 3) {
        hitCount = rankedHits.length;
        chosen = take(rankedHits, 6, any);
      } else {
        widened = true;
        hitCount = hits.length;
        primary = rankedHits;
        fill = [];
        for (i = 0; i < base.length; i++) if (notIn(hits, base[i])) fill.push(base[i]);
        if (primary.length + fill.length < 3) {
          for (i = 0; i < pool.length; i++) {
            if (pool[i].utility && notIn(primary, pool[i]) && notIn(fill, pool[i]) && notIn(hits, pool[i])) fill.push(pool[i]);
          }
        }
        chosen = primary.concat(take(fill, 6 - primary.length, any && !primary.length));
        if (chosen.length > 6) chosen = chosen.slice(0, 6);
      }
    }

    return {
      items: chosen.map(function (w) { return w.module; }),
      widened: widened,
      hitCount: hitCount,
      relaxed: relaxed
    };
  }

  function lengthLabel(id) {
    if (id === 'short') return '~1 hour';
    if (id === 'long') return 'Long night';
    return '2–3 hours';
  }

  function lengthPhrase(id) {
    if (id === 'short') return 'an hour or so';
    if (id === 'long') return 'a long night';
    return 'a 2–3 hour night';
  }

  function statusLine(state, result) {
    var n = result.items.length;
    var who = state.sys || 'any system';
    var line;
    if (!n) return 'Nothing on the shelf fits this night. The Finder still has the whole list.';
    line = n + (n === 1 ? ' module' : ' modules') + ' for ' + who + ', ' + lengthPhrase(state.length) + '.';
    if (result.widened) {
      if (!result.hitCount) line += ' Nothing in the titles wears that vibe, so this is the closest shelf.';
      else if (result.hitCount === 1) line += ' One of these matches the vibe; the rest are the closest fit.';
      else line += ' ' + result.hitCount + ' of these match the vibe; the rest are the closest fit.';
    } else if (result.relaxed && !(state.vibe && result.hitCount >= 3)) {
      line += ' Few of these say how long they run, so these are the closest fit.';
    }
    return line;
  }

  function mount() {
    var sysBox = document.getElementById('sys-chips');
    var lenBox = document.getElementById('len-chips');
    var vibeBox = document.getElementById('vibe-chips');
    var status = document.getElementById('status');
    var results = document.getElementById('results');
    var cta = document.getElementById('cta');
    var systemInput = document.getElementById('f-system');
    var moduleInput = document.getElementById('f-module');
    var paperNight = document.getElementById('paper-night');
    var paperPicks = document.getElementById('paper-picks');
    var printBtn = document.getElementById('print-btn');
    var state = { sys: '', length: 'medium', vibe: '' };

    function readUrl() {
      var params;
      try { params = new URLSearchParams(location.search); } catch (e) { return; }
      var sys = params.get('sys');
      var len = params.get('len');
      var vibe = params.get('vibe');
      var buttons, i, ok;
      if (sys) {
        buttons = sysBox.querySelectorAll('button');
        ok = false;
        for (i = 0; i < buttons.length; i++) if (buttons[i].getAttribute('data-sys') === sys) ok = true;
        if (ok) state.sys = sys;
      }
      if (len === '1h' || len === 'short') state.length = 'short';
      if (len === 'long') state.length = 'long';
      if (vibe && vibeDef(vibe)) state.vibe = vibe;
    }

    function writeUrl() {
      var params = new URLSearchParams();
      if (state.sys) params.set('sys', state.sys);
      if (state.length === 'short') params.set('len', '1h');
      if (state.length === 'long') params.set('len', 'long');
      if (state.vibe) params.set('vibe', state.vibe);
      var q = params.toString();
      var path = location.pathname + (q ? '?' + q : '');
      if (path !== location.pathname + location.search) history.replaceState(null, '', path);
    }

    function press(box, attr, value) {
      var buttons = box.querySelectorAll('button');
      var i, on;
      for (i = 0; i < buttons.length; i++) {
        on = buttons[i].getAttribute(attr) === value;
        buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    function syncField(input, value) {
      if (!input) return;
      if (input.value === input.getAttribute('data-auto') || input.value === '') {
        input.value = value;
        input.setAttribute('data-auto', value);
      }
    }

    function setCta() {
      var show = !state.sys || state.sys === '24XX';
      var link;
      while (cta.firstChild) cta.removeChild(cta.firstChild);
      cta.hidden = !show;
      if (!show) return;
      link = document.createElement('a');
      link.href = '/publishing/blackthorn/';
      link.textContent = 'The Last Stop at Blackthorn';
      if (!state.sys) {
        cta.appendChild(document.createTextNode('If the table is on 24XX, or not locked to a system, '));
        cta.appendChild(link);
        cta.appendChild(document.createTextNode(' is a roadside one-shot.'));
      } else {
        cta.appendChild(document.createTextNode('For a 24XX table, '));
        cta.appendChild(link);
        cta.appendChild(document.createTextNode(' is a roadside one-shot on this shelf.'));
      }
    }

    function renderCard(m) {
      var li = document.createElement('li');
      var h = document.createElement('h3');
      var a = document.createElement('a');
      var by = document.createElement('p');
      var mono = document.createElement('p');
      var blurb;
      a.href = m.href;
      a.rel = 'noopener';
      a.textContent = m.title;
      h.appendChild(a);
      li.appendChild(h);
      by.className = 'by';
      by.textContent = 'by ' + m.by;
      li.appendChild(by);
      if (m.blurb) {
        blurb = document.createElement('p');
        blurb.textContent = m.blurb;
        li.appendChild(blurb);
      }
      mono.className = 'mono';
      mono.textContent = m.mono;
      li.appendChild(mono);
      return li;
    }

    function track(action) {
      var vibe = vibeDef(state.vibe);
      try {
        if (typeof gtag === 'function') {
          gtag('event', 'gm_night_prep', {
            site: 'publishing',
            prep_system: state.sys || 'Any',
            prep_length: state.length,
            prep_vibe: vibe ? vibe.label : 'Any',
            prep_action: action
          });
        }
      } catch (e) {}
    }

    function paint(fromUser) {
      var mods = root.PSP_MODULES || [];
      var result, i, li, titles, vibe, paperBlock;
      press(sysBox, 'data-sys', state.sys);
      press(lenBox, 'data-len', state.length);
      press(vibeBox, 'data-vibe', state.vibe);
      while (results.firstChild) results.removeChild(results.firstChild);
      while (paperPicks.firstChild) paperPicks.removeChild(paperPicks.firstChild);
      if (!mods.length) {
        status.textContent = 'The catalog did not load. Browse the Finder for the full shelf.';
        setCta();
        return;
      }
      result = shortlist(mods, state);
      status.textContent = statusLine(state, result);
      titles = [];
      for (i = 0; i < result.items.length; i++) {
        results.appendChild(renderCard(result.items[i]));
        li = document.createElement('li');
        li.textContent = result.items[i].title;
        paperPicks.appendChild(li);
        titles.push(result.items[i].title);
      }
      vibe = vibeDef(state.vibe);
      paperBlock = document.getElementById('paper-block');
      if (paperBlock) paperBlock.hidden = !titles.length;
      paperNight.textContent = (state.sys || 'Any system') + ' · ' + lengthLabel(state.length) + (vibe ? ' · ' + vibe.label : '');
      syncField(systemInput, state.sys);
      syncField(moduleInput, titles.length ? titles[0] : '');
      setCta();
      if (fromUser) {
        writeUrl();
        track('filter');
      }
    }

    function onChip(event) {
      var btn = event.target.closest ? event.target.closest('button') : null;
      var id;
      if (!btn || !event.currentTarget.contains(btn)) return;
      if (btn.hasAttribute('data-sys')) {
        if (btn.getAttribute('data-sys') === state.sys) return;
        state.sys = btn.getAttribute('data-sys');
      }
      if (btn.hasAttribute('data-len')) {
        if (btn.getAttribute('data-len') === state.length) return;
        state.length = btn.getAttribute('data-len');
      }
      if (btn.hasAttribute('data-vibe')) {
        id = btn.getAttribute('data-vibe');
        state.vibe = state.vibe === id ? '' : id;
      }
      paint(true);
    }

    sysBox.addEventListener('click', onChip);
    lenBox.addEventListener('click', onChip);
    vibeBox.addEventListener('click', onChip);
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        track('print');
        window.print();
      });
    }
    readUrl();
    paint(false);
  }

  root.PSPPrep = {
    VIBES: VIBES,
    shortlist: shortlist,
    statusLine: statusLine,
    mount: mount
  };

  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('night')) mount();
})(typeof globalThis !== 'undefined' ? globalThis : this);
