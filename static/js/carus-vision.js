/* carus.one – der Vision-Teil unter dem Teaser (/index4/).
 *
 * Alles hier ist scrollgetrieben und bewusst schlank: ein einziger
 * rAF-gebundener Durchlauf pro Scrollereignis, und nur fuer die
 * Abschnitte, die gerade im Bild sind (IntersectionObserver).
 *
 * Kein Framework, keine Abhaengigkeiten. Bei prefers-reduced-motion
 * uebernimmt das Stylesheet: dann laeuft hier nichts.
 */
(function () {
  'use strict';

  var root = document.querySelector('.v');
  if (!root) { return; }

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  function ramp(a, b, v) { return b === a ? (v >= b ? 1 : 0) : clamp01((v - a) / (b - a)); }

  function each(sel, ctx, fn) {
    var list = (ctx || document).querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) { fn(list[i], i); }
  }

  function setOn(el, on) {
    if (!el) { return; }
    if (el.classList.contains('is-on') !== on) { el.classList.toggle('is-on', on); }
  }

  /* Fortschritt eines normalen Abschnitts: 0 beim Hereinkommen von unten,
     1 beim Verlassen nach oben. */
  function progressPass(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    return clamp01((vh * 0.86 - r.top) / (r.height * 0.72 + vh * 0.2));
  }

  /* Fortschritt einer festgehaltenen Buehne: 0 wenn ihr Kopf oben
     ankommt, 1 wenn ihr Fuss oben ankommt. */
  function progressSticky(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    var span = Math.max(1, r.height - vh);
    return clamp01(-r.top / span);
  }

  /* ------------------------------------------------------------------ *
   * Einblenden beim Hereinscrollen
   * ------------------------------------------------------------------ */

  var fadeEls = document.querySelectorAll('[data-v-in]');
  if (reduce) {
    for (var fi = 0; fi < fadeEls.length; fi++) { fadeEls[fi].classList.add('is-in'); }
  } else if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-in');
          io.unobserve(entries[i].target);
        }
      }
    }, { rootMargin: '0px 0px -14% 0px', threshold: 0.12 });
    for (var fj = 0; fj < fadeEls.length; fj++) { io.observe(fadeEls[fj]); }
  } else {
    for (var fk = 0; fk < fadeEls.length; fk++) { fadeEls[fk].classList.add('is-in'); }
  }

  /* Die Abschnitte selbst bekommen is-in, damit CSS-Animationen (etwa der
     Lichtimpuls in Sektion 6) nur laufen, wenn sie sichtbar sind. */
  if (window.IntersectionObserver) {
    var ioSec = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        entries[i].target.classList.toggle('is-in', entries[i].isIntersecting);
      }
    }, { threshold: 0.05 });
    each('.v-sec', root, function (el) { ioSec.observe(el); });
  }

  /* ------------------------------------------------------------------ *
   * Die scrollgetriebenen Abschnitte
   * ------------------------------------------------------------------ */

  var tracks = [];

  function track(el, run) {
    if (!el) { return; }
    var t = { el: el, run: run, live: true };
    tracks.push(t);
    if (window.IntersectionObserver) {
      t.live = false;
      var io2 = new IntersectionObserver(function (entries) {
        t.live = entries[0].isIntersecting;
        if (t.live) { schedule(); }
      }, { rootMargin: '40% 0px 40% 0px' });
      io2.observe(el);
    }
  }

  /* --- Sektion 1: ein Bereich nach dem anderen ---------------------- */

  var ecoStage = root.querySelector('[data-v-eco]');
  if (ecoStage) {
    var areas = ecoStage.querySelectorAll('[data-v-area]');
    var edges = ecoStage.querySelectorAll('[data-v-edge]');
    track(ecoStage, function (p) {
      /* Vier Bereiche in der zweiten Haelfte des Durchlaufs durchgehen. */
      var k = Math.min(3, Math.floor(ramp(0.12, 0.92, p) * 4));
      for (var i = 0; i < areas.length; i++) { setOn(areas[i], i === k); }
      for (var j = 0; j < edges.length; j++) { setOn(edges[j], j === k); }
    });
  }

  /* --- Sektion 2: die Ebenen der Plattform -------------------------- */

  var stack = root.querySelector('[data-v-stack]');
  if (stack) {
    var layers = stack.querySelectorAll('[data-v-layer]');
    track(stack, function (p) {
      var k = Math.min(layers.length - 1, Math.floor(ramp(0.06, 0.96, p) * layers.length));
      for (var i = 0; i < layers.length; i++) { setOn(layers[i], i === k); }
    });
  }

  /* --- Sektion 3: der Lebenszyklus ---------------------------------- */

  var lifeScroll = root.querySelector('[data-v-life-scroll]');
  if (lifeScroll) {
    var dots = lifeScroll.querySelectorAll('[data-v-dot]');
    var panes = lifeScroll.querySelectorAll('[data-v-pane]');
    var fill = lifeScroll.querySelector('[data-v-rail-fill]');
    var n = panes.length || 1;
    var lastK = -1;
    track(lifeScroll, function (p) {
      var k = Math.min(n - 1, Math.floor(p * n * 0.999));
      if (fill) {
        var f = clamp01((k + 0.5) / n);
        fill.style.transform = window.innerWidth <= 900
          ? 'scaleY(' + f.toFixed(4) + ')'
          : 'scaleX(' + f.toFixed(4) + ')';
      }
      if (k === lastK) { return; }
      lastK = k;
      for (var i = 0; i < panes.length; i++) { setOn(panes[i], i === k); }
      for (var j = 0; j < dots.length; j++) {
        setOn(dots[j], j === k);
        dots[j].classList.toggle('is-past', j < k);
      }
    });
  }

  /* --- Phase 02: kleiner Datenraum mit synthetischer Demokohorte ---- */

  var feas = root.querySelector('[data-v-feas]');
  if (feas) {
    var nEl = feas.querySelector('[data-v-feas-n]');
    var vEl = feas.querySelector('[data-v-feas-v]');
    var qEl = feas.querySelector('[data-v-feas-q]');
    /* Jeder Filter wirkt auf Fallzahl, Variablen und Qualitaet. Rein
       synthetisch – die Zahlen zeigen nur, wie Feasibility sich anfuehlt. */
    var FIL = [
      { f: 0.71, v: 0, q: 0 },
      { f: 0.62, v: 2, q: 1 },
      { f: 0.48, v: 5, q: 1 },
      { f: 0.55, v: 3, q: 2 }
    ];
    var QUAL = ['hoch', 'hoch', 'sehr hoch', 'sehr hoch'];
    var state = [false, false, false, false];
    var shown = 4281;

    function fmt(v) {
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function recalc() {
      var cases = 4281, vars = 17, q = 0;
      for (var i = 0; i < state.length; i++) {
        if (!state[i]) { continue; }
        cases *= FIL[i].f;
        vars += FIL[i].v;
        q += FIL[i].q;
      }
      var target = Math.max(38, Math.round(cases));
      if (vEl) { vEl.textContent = String(vars); }
      if (qEl) { qEl.textContent = QUAL[Math.min(QUAL.length - 1, q)]; }
      if (!nEl) { return; }
      if (reduce) { nEl.textContent = fmt(target); shown = target; return; }
      /* Die Zahl laeuft kurz auf den neuen Wert zu. */
      var from = shown, t0 = 0;
      function step(ts) {
        if (!t0) { t0 = ts; }
        var t = smooth(Math.min(1, (ts - t0) / 420));
        shown = from + (target - from) * t;
        nEl.textContent = fmt(shown);
        if (t < 1) { window.requestAnimationFrame(step); }
      }
      window.requestAnimationFrame(step);
    }

    each('[data-v-feas-f]', feas, function (btn, i) {
      btn.addEventListener('click', function () {
        state[i] = !state[i];
        btn.setAttribute('aria-pressed', state[i] ? 'true' : 'false');
        recalc();
      });
    });
  }

  /* --- Der zentrale Moment: die Rueckkopplung ----------------------- */

  var back = root.querySelector('[data-v-back]');
  if (back && !reduce) {
    var terms = back.querySelectorAll('[data-v-back-t]');
    var stage = back.querySelector('.v-back__stage');
    track(back, function (p) {
      if (!stage) { return; }
      var w = stage.offsetWidth || 600, h = stage.offsetHeight || 300;
      var R = Math.min(w * 0.46, 520);
      for (var i = 0; i < terms.length; i++) {
        /* Jeder Begriff startet weiter aussen und wird nach innen
           gezogen – aus dem Produkt zurueck in das Netzwerk. */
        var a = (i / terms.length) * Math.PI * 2 + 0.4;
        var t = smooth(ramp(0.04 + i * 0.11, 0.34 + i * 0.11, p));
        var d = 1 - t;
        var x = Math.cos(a) * R * d;
        var y = Math.sin(a) * h * 0.42 * d;
        var op = Math.min(1, t * 5) * (1 - smooth(ramp(0.82, 1, t)));
        var el = terms[i];
        el.style.transform = 'translate(-50%,-50%) translate3d(' +
          x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        el.style.opacity = op.toFixed(3);
      }
    });
  }

  /* --- Sektion 4: die vier Raeume ----------------------------------- */

  var rooms = root.querySelector('[data-v-rooms]');
  if (rooms) {
    var roomEls = rooms.querySelectorAll('[data-v-room]');
    track(rooms, function (p) {
      var k = Math.min(roomEls.length - 1, Math.floor(ramp(0.08, 0.95, p) * roomEls.length));
      for (var i = 0; i < roomEls.length; i++) { setOn(roomEls[i], i <= k); }
    });
  }

  /* --- Sektion 5: die fuenf Faehigkeiten ---------------------------- */

  var aiList = root.querySelector('[data-v-ai]');
  if (aiList) {
    var steps = aiList.querySelectorAll('[data-v-ai-s]');
    track(aiList, function (p) {
      var k = Math.min(steps.length - 1, Math.floor(ramp(0.04, 0.96, p) * steps.length));
      for (var i = 0; i < steps.length; i++) { setOn(steps[i], i === k); }
    });
  }

  /* --- Sektion 7: die Verbindungen nach aussen ---------------------- */

  var net = root.querySelector('[data-v-net]');
  if (net) {
    var hops = net.querySelectorAll('[data-v-hop]');
    track(net, function (p) {
      var reach = ramp(0.1, 0.8, p) * 3;
      for (var i = 0; i < hops.length; i++) {
        var lvl = parseInt(hops[i].getAttribute('data-v-hop'), 10) || 0;
        setOn(hops[i], reach > lvl);
      }
    });
  }

  /* --- Sektion 8: aus der Kette wird ein Kreis ---------------------- */

  var loopScroll = root.querySelector('[data-v-loop-scroll]');
  if (loopScroll && !reduce) {
    var ring = loopScroll.querySelectorAll('[data-v-ring-i]');
    var arc = loopScroll.querySelector('[data-v-ring-arc]');
    var end = loopScroll.querySelector('.v-loop__end');
    var stageL = loopScroll.querySelector('.v-loop__stage');
    track(loopScroll, function (p) {
      var w = stageL ? stageL.offsetWidth : window.innerWidth;
      var h = stageL ? stageL.offsetHeight : window.innerHeight;
      var R = Math.min(w * (w < 700 ? 0.37 : 0.33), h * 0.36);
      var step = Math.min(h * 0.115, 62);
      /* Erst erscheinen die Begriffe untereinander, dann ordnen sie sich
         zum Kreis – die letzte Verbindung fuehrt zurueck zu "Daten". */
      var circle = smooth(ramp(0.42, 0.78, p));
      for (var i = 0; i < ring.length; i++) {
        var appear = smooth(ramp(0.02 + i * 0.05, 0.1 + i * 0.05, p));
        var ang = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
        var lx = 0, ly = (i - (ring.length - 1) / 2) * step;
        var cx = Math.cos(ang) * R, cy = Math.sin(ang) * R;
        var x = lx + (cx - lx) * circle;
        var y = ly + (cy - ly) * circle;
        /* Vor dem Schlusssatz loesen sich die Begriffe ganz auf, damit die
           Schrift nicht auf ihnen liegt. */
        var fade = 1 - smooth(ramp(0.84, 0.94, p));
        ring[i].style.transform = 'translate(-50%,-50%) translate3d(' +
          x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        ring[i].style.opacity = (appear * fade).toFixed(3);
      }
      if (arc) {
        var draw = smooth(ramp(0.56, 0.9, p));
        arc.style.strokeDashoffset = (220 * (1 - draw)).toFixed(1);
        arc.style.opacity = draw.toFixed(3);
      }
      setOn(end, p > 0.93);
    });
  }

  /* ------------------------------------------------------------------ *
   * Ein Durchlauf pro Bild, nur wenn gescrollt wurde
   * ------------------------------------------------------------------ */

  var pending = false;
  var docEl = document.documentElement;
  var heroSet = '';
  var tailSet = '';

  /* Die Deckkraft der Teaser-Schrift haengt an der Scrollposition. Sie wird
     hier gesetzt, damit sie auch dann sofort folgt, wenn die WebGL-Szene
     gerade nur wenige Bilder pro Sekunde schafft. */
  function heroFade() {
    var vh = window.innerHeight || 800;
    var y = window.pageYOffset || 0;
    var t = smooth(Math.min(1, y / (vh * 0.85)));
    var v = (1 - t).toFixed(3);
    if (v !== heroSet) {
      docEl.style.setProperty('--c1-hero', v);
      heroSet = v;
      var c1 = document.querySelector('.c1');
      if (c1) { c1.classList.toggle('is-bg', t > 0.5); }
    }
    /* Am Seitenende wird der Schleier duenner: die Datenwolke des Intros
       kommt fuer das Finale zurueck. */
    var docH = Math.max(1, docEl.scrollHeight - vh);
    var tail = smooth(ramp(0.955, 1, y / docH)).toFixed(3);
    if (tail !== tailSet) {
      docEl.style.setProperty('--v-tail', tail);
      tailSet = tail;
    }
  }

  function runAll() {
    pending = false;
    heroFade();
    for (var i = 0; i < tracks.length; i++) {
      if (!tracks[i].live) { continue; }
      var p = tracks[i].el.hasAttribute('data-v-life-scroll') ||
        tracks[i].el.hasAttribute('data-v-loop-scroll')
        ? progressSticky(tracks[i].el)
        : progressPass(tracks[i].el);
      tracks[i].run(p);
    }
  }

  function schedule() {
    if (pending) { return; }
    pending = true;
    window.requestAnimationFrame(runAll);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();

  /* Hinweis am Ende des Teasers anklickbar machen: ein Klick fuehrt in
     den Vision-Teil. */
  var hint = document.querySelector('[data-c1-hint]');
  if (hint) {
    hint.style.pointerEvents = 'auto';
    hint.style.cursor = 'pointer';
    hint.addEventListener('click', function () {
      var top = root.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    });
  }
})();
