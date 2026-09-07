/* Yin-Yang-Galaxie – Partikelanimation für die Test-Startseite (/index2/).
 *
 * Ablauf der Animation:
 *   1. Zwei Partikelströme fliegen von links unten und rechts oben herein.
 *   2. Sie sammeln sich zu einem Taijitu (Yin-Yang), zunächst stark gekippt
 *      und damit als Spiralgalaxie lesbar.
 *   3. Die Scheibe richtet sich auf, das Zeichen wird erkennbar.
 *   4. Der Titel "Tierheilpraxis JessICan" wird eingeblendet (per CSS).
 *   5. Danach dreht sich das Zeichen langsam weiter und lässt sich mit
 *      Maus oder Finger drehen und kippen.
 *
 * Gerendert wird mit WebGL 1: additiv gemischte Point-Sprites in einem
 * Akkumulationspuffer (das ergibt Bewegungsspuren und den weichen
 * "Rauch"), am Ende ein Durchgang mit Tone-Mapping, Hintergrund,
 * Vignette und feinem Korn. Ohne WebGL übernimmt eine schlankere
 * Canvas-2D-Fassung.
 *
 * Kein Framework, keine externen Abhängigkeiten.
 */
(function () {
  'use strict';

  var hero = document.querySelector('[data-yy-hero]');
  if (!hero) { return; }
  var canvas = hero.querySelector('[data-yy-canvas]');
  if (!canvas) { return; }
  var replayBtn = hero.querySelector('[data-yy-replay]');

  var TAU = Math.PI * 2;
  var FOV = 42 * Math.PI / 180;
  var TAN_HALF_FOV = Math.tan(FOV / 2);
  var CAM_DIST = 3.4;
  var SPAWN_DIST = 3.6;

  /* Zeitplan in Sekunden. */
  var T_FLY_START = 0.15;
  var T_FLY_DUR = 2.9;
  var T_TILT_START = 2.3;
  var T_TILT_DUR = 3.4;
  var T_REVEAL = 4.3;

  var TILT_FLY = 0.62;   // stark gekippt: wirkt wie eine Galaxie
  var TILT_REST = 0.20;  // fast frontal: das Zeichen wird lesbar
  var AUTO_SPIN = 0.11;  // rad/s, eine Umdrehung in knapp einer Minute

  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------------ *
   * Zufallshelfer
   * ------------------------------------------------------------------ */

  function rnd() { return Math.random(); }

  function gauss() {
    var u = 0, v = 0;
    while (u === 0) { u = Math.random(); }
    while (v === 0) { v = Math.random(); }
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  /* ------------------------------------------------------------------ *
   * Geometrie des Taijitu
   *
   * Konstruktion im Einheitskreis (Radius 1), senkrechte S-Kurve aus zwei
   * Halbkreisen mit Radius 1/2 um (0, ±1/2). Die helle (Yang-)Hälfte liegt
   * rechts, die dunkle links. Am Ende wird alles um 45° gedreht, damit die
   * S-Kurve von links unten nach rechts oben verläuft – also entlang der
   * Achse, aus der die beiden Partikelströme kommen.
   * ------------------------------------------------------------------ */

  var EYE_R = 0.13;

  function inCirc(x, y, cx, cy, r) {
    var dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  function isYang(x, y) {
    if (y >= 0) { return x > 0 && !inCirc(x, y, 0, 0.5, 0.5); }
    return x > 0 || inCirc(x, y, 0, -0.5, 0.5);
  }

  /* Farben wie im Vorbild: überwiegend Weiß, dazwischen warme und kühle
     Tupfen. Yin bekommt die kühlen, Yang die warmen Töne. */
  var COL_WHITE = [1.00, 0.97, 0.93];
  var COL_WARM = [1.00, 0.74, 0.42];
  var COL_COOL = [0.55, 0.76, 1.00];
  var COL_DEEP = [0.34, 0.55, 1.00];

  function mixCol(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* Größenverteilung mit langem Schwanz: viele winzige Punkte, wenige große
     Leuchtflecken. Das erzeugt den körnigen Sternenhaufen-Eindruck. */
  function starSize() { return 0.55 + Math.pow(rnd(), 3.2) * 3.2; }

  function buildGeometry(q) {
    var T = [], S = [], B = [], C = [], P = [], M = [];
    var count = 0;
    var ROT = -Math.PI / 4;
    var CR = Math.cos(ROT), SR = Math.sin(ROT);

    /* kind: 0 = Teil des Zeichens (fliegt ein), 1 = ferner Stern (bleibt). */
    function add(x, y, z, alpha, size, col, soft, kind) {
      var rx = x * CR - y * SR;
      var ry = x * SR + y * CR;

      T.push(rx, ry, z);
      C.push(col[0], col[1], col[2]);
      M.push(soft, kind);

      if (kind === 1) {
        S.push(rx, ry, z);
        B.push(0, 0, 0);
        P.push(size, alpha, 0, rnd());
      } else {
        /* Einflugecke: links unten für die untere, rechts oben für die
           obere Hälfte der Diagonale. */
        var side = (rx + ry) < 0 ? -1 : 1;
        var ax = 0.70711 * side, ay = 0.70711 * side;
        var px = -ay, py = ax;
        var dist = SPAWN_DIST + gauss() * 0.75;
        var off = gauss() * 1.15;
        S.push(ax * dist + px * off, ay * dist + py * off, gauss() * 0.5);

        /* Kontrollpunkt einer Bézierkurve: alle Bahnen krümmen sich im
           selben Drehsinn, dadurch wirbelt der Strom in die Scheibe. */
        var bend = 0.55 + rnd() * 0.95;
        B.push(ay * bend, -ax * bend, gauss() * 0.32);

        /* Innen liegende Partikel kommen früher an – die Scheibe wächst
           von innen nach außen. */
        var rLocal = Math.min(1, Math.sqrt(rx * rx + ry * ry));
        P.push(size, alpha, Math.min(0.72, 0.04 + rLocal * 0.30 + rnd() * 0.24), rnd());
      }
      count++;
    }

    function n(base) { return Math.max(24, Math.round(base * q)); }

    var i, a, r, x, y, col, guard, w, f, phi, cy, nx, ny, off;

    /* 1. Außenkreis */
    for (i = n(1500); i--;) {
      a = rnd() * TAU;
      r = 1 + gauss() * (rnd() < 0.28 ? 0.045 : 0.011);
      col = rnd() < 0.14 ? COL_WARM : (rnd() < 0.20 ? COL_COOL : COL_WHITE);
      add(Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.018,
        0.55 + rnd() * 0.45, starSize(), col, 0.12, 0);
    }

    /* 2. S-Kurve: oberer Halbkreis nach rechts, unterer nach links */
    for (i = n(2000); i--;) {
      if (rnd() < 0.5) {
        phi = rnd() * Math.PI - Math.PI / 2;
        cy = 0.5;
      } else {
        phi = rnd() * Math.PI + Math.PI / 2;
        cy = -0.5;
      }
      nx = Math.cos(phi); ny = Math.sin(phi);
      off = gauss() * 0.014;
      col = rnd() < 0.12 ? COL_WARM : (rnd() < 0.18 ? COL_COOL : COL_WHITE);
      add(nx * (0.5 + off), cy + ny * (0.5 + off), gauss() * 0.02,
        0.60 + rnd() * 0.50, starSize(), col, 0.10, 0);
    }

    /* 3. Helle Hälfte, dichter Sternenstaub. Das dunkle Auge bleibt frei. */
    for (i = n(4200); i--;) {
      guard = 0;
      do {
        a = rnd() * TAU; r = Math.sqrt(rnd()) * 0.985;
        x = Math.cos(a) * r; y = Math.sin(a) * r;
      } while (++guard < 40 && (!isYang(x, y) || inCirc(x, y, 0, -0.5, EYE_R * 1.22)));
      w = rnd();
      col = w < 0.14 ? COL_WARM : (w < 0.22 ? COL_COOL : COL_WHITE);
      add(x, y, gauss() * 0.028, (0.22 + 0.26 * (1 - r)) * (0.5 + rnd()),
        starSize(), col, 0.14, 0);
    }

    /* 4. Dunkle Hälfte: nur angedeutet, damit sie als Schatten wirkt. */
    for (i = n(1200); i--;) {
      guard = 0;
      do {
        a = rnd() * TAU; r = Math.sqrt(rnd()) * 0.985;
        x = Math.cos(a) * r; y = Math.sin(a) * r;
      } while (++guard < 40 && (isYang(x, y) || inCirc(x, y, 0, 0.5, EYE_R * 1.1)));
      col = rnd() < 0.7 ? COL_COOL : COL_DEEP;
      add(x, y, gauss() * 0.028, (0.05 + 0.07 * (1 - r)) * (0.5 + rnd()),
        starSize() * 0.8, col, 0.20, 0);
    }

    /* 5. Helles Auge: der leuchtende Kern der "Galaxie". */
    for (i = n(560); i--;) {
      a = rnd() * TAU; r = Math.sqrt(rnd()) * EYE_R;
      f = 1 - r / EYE_R;
      col = mixCol(COL_WHITE, COL_WARM, rnd() * 0.5);
      add(Math.cos(a) * r, 0.5 + Math.sin(a) * r, gauss() * 0.02,
        0.35 + 0.75 * f * f, starSize() * (1 + f), col, 0.10, 0);
    }

    /* 6. Dunkles Auge: nur als Ring, sonst wäre es auf Schwarz unsichtbar. */
    for (i = n(440); i--;) {
      a = rnd() * TAU; r = EYE_R + gauss() * 0.011;
      col = rnd() < 0.3 ? COL_COOL : COL_WHITE;
      add(Math.cos(a) * r, -0.5 + Math.sin(a) * r, gauss() * 0.016,
        0.45 + rnd() * 0.40, starSize(), col, 0.12, 0);
    }

    /* 7. Nebelschleier: wenige, sehr große und sehr schwache Sprites. */
    for (i = n(420); i--;) {
      a = rnd() * TAU; r = Math.sqrt(rnd()) * 1.02;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
      if (isYang(x, y)) {
        col = mixCol(COL_WHITE, COL_WARM, rnd() * 0.6);
        w = 0.038;
      } else {
        col = COL_DEEP;
        w = 0.008;
      }
      add(x, y, gauss() * 0.09, w * (0.5 + rnd()), 7 + rnd() * 11, col, 1, 0);
    }

    /* 8. Ferne Sterne rundherum – sie fliegen nicht mit ein. */
    for (i = n(800); i--;) {
      a = rnd() * TAU; r = 1.4 + Math.pow(rnd(), 0.6) * 2.4;
      col = rnd() < 0.16 ? COL_WARM : (rnd() < 0.30 ? COL_COOL : COL_WHITE);
      add(Math.cos(a) * r, Math.sin(a) * r, -0.6 + gauss() * 0.9,
        0.06 + Math.pow(rnd(), 3) * 0.5,
        0.5 + Math.pow(rnd(), 3) * 1.8, col, 0.15, 1);
    }

    return {
      count: count,
      target: new Float32Array(T),
      start: new Float32Array(S),
      bend: new Float32Array(B),
      color: new Float32Array(C),
      param: new Float32Array(P),
      misc: new Float32Array(M)
    };
  }

  /* ------------------------------------------------------------------ *
   * 4x4-Matrizen (spaltenweise, wie WebGL sie erwartet)
   * ------------------------------------------------------------------ */

  function m4() { return new Float32Array(16); }

  function ident(o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }

  function mul(a, b, o) {
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      for (var j = 0; j < 4; j++) {
        o[i * 4 + j] = a[j] * b0 + a[4 + j] * b1 + a[8 + j] * b2 + a[12 + j] * b3;
      }
    }
    return o;
  }

  function rotX(a, o) {
    ident(o);
    var c = Math.cos(a), s = Math.sin(a);
    o[5] = c; o[6] = s; o[9] = -s; o[10] = c;
    return o;
  }

  function rotY(a, o) {
    ident(o);
    var c = Math.cos(a), s = Math.sin(a);
    o[0] = c; o[2] = -s; o[8] = s; o[10] = c;
    return o;
  }

  function rotZ(a, o) {
    ident(o);
    var c = Math.cos(a), s = Math.sin(a);
    o[0] = c; o[1] = s; o[4] = -s; o[5] = c;
    return o;
  }

  function scaleM(s, o) {
    ident(o);
    o[0] = s; o[5] = s; o[10] = s;
    return o;
  }

  function perspective(aspect, near, far, o) {
    ident(o);
    var f = 1 / TAN_HALF_FOV;
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far);
    o[11] = -1;
    o[14] = 2 * far * near / (near - far);
    o[15] = 0;
    return o;
  }

  /* ------------------------------------------------------------------ *
   * Gemeinsamer Zustand: Zeitplan und Bedienung
   * ------------------------------------------------------------------ */

  var view = {
    w: 1, h: 1, dpr: 1, aspect: 1,
    scale: 1, sizeGain: 1, offsetY: 0
  };

  /* Durchmesser des Zeichens: im Querformat FIT_LANDSCAPE * Fensterhöhe,
     im Hochformat höchstens FIT_PORTRAIT * Fensterbreite. Derselbe Wert
     steht als --yy-disc im Stylesheet und hält dort die Mittelspalte für
     den Titel frei. */
  var FIT_LANDSCAPE = 0.62;
  var FIT_PORTRAIT = 0.72;
  /* Das Zeichen sitzt über der Mitte, darunter steht der Titel. Der Wert
     zählt in halben Bildhöhen: 0.16 hebt es um 8 % der Fensterhöhe – so
     viel verschiebt das Stylesheet auch den Titel (translateY(-8vh)). */
  var LIFT_LANDSCAPE = 0.16;
  var LIFT_PORTRAIT = 0.36;

  var st = {
    time: 0,
    flight: reduceMotion ? 1 : 0,
    spin: 0,
    spinVel: 0,
    tiltUser: 0,
    yaw: 0,
    yawTarget: 0,
    starFade: reduceMotion ? 1 : 0,
    tau: 0.11,
    dragging: false,
    revealed: false
  };

  function baseTilt() {
    if (reduceMotion) { return TILT_REST; }
    var k = clamp((st.time - T_TILT_START) / T_TILT_DUR, 0, 1);
    return TILT_FLY + (TILT_REST - TILT_FLY) * smoothstep(k) +
      0.055 * Math.sin(st.time * 0.31);
  }

  function currentTilt() {
    return clamp(baseTilt() + st.tiltUser, -1.2, 1.2);
  }

  function measure() {
    var rect = hero.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width));
    var cssH = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    view.dpr = dpr;
    view.w = Math.max(1, Math.round(cssW * dpr));
    view.h = Math.max(1, Math.round(cssH * dpr));
    view.aspect = view.w / view.h;

    /* Das Zeichen soll immer vollständig und nicht zu klein im Bild sein. */
    var halfH = TAN_HALF_FOV * CAM_DIST;
    var halfW = halfH * view.aspect;
    var portrait = view.aspect < 0.95;
    /* Im Hochformat darf das Zeichen höchstens ein knappes Drittel der
       Fensterhöhe einnehmen, sonst bleibt für den Titel darunter kein
       Platz. */
    var fit = portrait
      ? Math.min(FIT_PORTRAIT, 0.32 / view.aspect)
      : FIT_LANDSCAPE;
    view.scale = fit * Math.min(halfH, halfW);
    view.offsetY = (portrait ? LIFT_PORTRAIT : LIFT_LANDSCAPE) * halfH;

    /* Pixel pro Welteinheit in der Bildebene, daraus die Punktgröße. */
    var ppwu = (view.h * 0.5) / halfH;
    view.sizeGain = 0.0105 * Math.pow(view.scale, 0.45) * ppwu;

    canvas.width = view.w;
    canvas.height = view.h;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  }

  /* --- Zeigerbedienung: waagerecht drehen, senkrecht kippen ---------- */

  function initPointer(onChange) {
    var active = null, lastX = 0, lastY = 0, lastT = 0, allowTilt = true;

    function norm() { return Math.max(240, Math.min(canvas.clientWidth, canvas.clientHeight)); }

    canvas.addEventListener('pointerdown', function (e) {
      if (active !== null) { return; }
      active = e.pointerId;
      lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
      /* Auf Touch bleibt die senkrechte Bewegung dem Seitenscrollen
         vorbehalten (siehe touch-action: pan-y im Stylesheet). */
      allowTilt = e.pointerType !== 'touch';
      st.dragging = true;
      st.spinVel = 0;
      hero.classList.add('is-grabbing');
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (active === null) {
        /* Leichte Parallaxe, solange nicht gezogen wird. */
        var rect = canvas.getBoundingClientRect();
        st.yawTarget = clamp((e.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5) * 0.22;
        return;
      }
      if (e.pointerId !== active) { return; }
      var k = norm();
      var dx = (e.clientX - lastX) / k;
      var dy = (e.clientY - lastY) / k;
      var dt = Math.max(8, e.timeStamp - lastT) / 1000;
      lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;

      st.spin -= dx * 5.0;
      st.spinVel = -dx * 5.0 / dt;
      if (allowTilt) { st.tiltUser = clamp(st.tiltUser + dy * 2.4, -1.1, 1.1); }
      onChange();
    });

    function end(e) {
      if (active === null || (e && e.pointerId !== active)) { return; }
      active = null;
      st.dragging = false;
      hero.classList.remove('is-grabbing');
      st.spinVel = clamp(st.spinVel, -14, 14);
      onChange();
    }

    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('pointerleave', function () { st.yawTarget = 0; });
  }

  function advance(dt) {
    st.time += dt;
    if (!reduceMotion) {
      st.flight = clamp((st.time - T_FLY_START) / T_FLY_DUR, 0, 1);
      st.starFade = clamp(st.time / 1.4, 0, 1);
    }

    /* Während des Einflugs dreht sich alles schneller. */
    var auto = AUTO_SPIN + (1 - st.flight) * 0.26;
    if (!reduceMotion) { st.spin += auto * dt; }
    if (!st.dragging) {
      /* Nach dem Loslassen läuft der Schwung aus. */
      st.spin += st.spinVel * dt;
      st.spinVel *= Math.exp(-dt * 1.7);
      if (Math.abs(st.spinVel) < 0.002) { st.spinVel = 0; }
    }
    st.yaw += (st.yawTarget - st.yaw) * Math.min(1, dt * 3.5);

    /* Bewegungsspuren: lang beim Einflug, kurz im Ruhezustand, wieder
       länger, wenn kräftig gedreht wird. */
    var settle = clamp((st.time - (T_FLY_START + T_FLY_DUR)) / 1.8, 0, 1);
    st.tau = 0.11 + (0.032 - 0.11) * smoothstep(settle) +
      Math.min(0.075, Math.abs(st.spinVel) * 0.035);
    if (reduceMotion) { st.tau = 0; }

    if (!st.revealed && (reduceMotion || st.time >= T_REVEAL)) {
      st.revealed = true;
      hero.classList.add('is-revealed');
    }
  }

  function resetAnimation() {
    st.time = 0;
    st.flight = reduceMotion ? 1 : 0;
    st.spin = 0;
    st.spinVel = 0;
    st.tiltUser = 0;
    st.starFade = reduceMotion ? 1 : 0;
    st.revealed = false;
    hero.classList.remove('is-revealed');
  }

  /* ------------------------------------------------------------------ *
   * WebGL-Renderer
   * ------------------------------------------------------------------ */

  var POINT_VS = [
    'precision highp float;',
    'attribute vec3 aTarget;',
    'attribute vec3 aStart;',
    'attribute vec3 aBend;',
    'attribute vec3 aColor;',
    'attribute vec4 aParam;',   // size, alpha, delay, seed
    'attribute vec2 aMisc;',    // soft, kind
    'uniform mat4 uProj;',
    'uniform mat4 uView;',
    'uniform mat4 uModel;',
    'uniform float uFlight;',
    'uniform float uTime;',
    'uniform float uSizeGain;',
    'uniform float uFocal;',
    'uniform float uDof;',
    'uniform float uStarFade;',
    'uniform float uIntensity;',
    'uniform float uMaxPoint;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'varying float vSoft;',
    'void main() {',
    '  float seed = aParam.w;',
    '  vec3 tgt = (uModel * vec4(aTarget, 1.0)).xyz;',
    /* Leichtes Eigenleben, sobald das Zeichen steht. */
    '  tgt += vec3(sin(uTime * 0.53 + seed * 23.0),',
    '              cos(uTime * 0.47 + seed * 31.0),',
    '              sin(uTime * 0.31 + seed * 17.0)) * 0.011 * uFlight;',
    '  float dly = aParam.z;',
    '  float t = clamp((uFlight - dly) / max(1e-3, 1.0 - dly), 0.0, 1.0);',
    '  float e = 1.0 - pow(1.0 - t, 3.0);',
    '  vec3 ctrl = 0.5 * (aStart + tgt) + aBend;',
    '  vec3 p = mix(mix(aStart, ctrl, e), mix(ctrl, tgt, e), e);',
    '  vec4 vpos = uView * vec4(p, 1.0);',
    '  gl_Position = uProj * vpos;',
    '  float dist = max(0.15, -vpos.z);',
    /* Unschärfekreis: Partikel vor und hinter der Schärfeebene werden
       größer und flauer – daher die weichen Leuchtflecken. */
    '  float coc = abs(dist - uFocal) * uDof;',
    '  float fly = pow(1.0 - t, 1.7);',
    '  float size = aParam.x * (1.0 + coc * 7.0) * (1.0 + fly * 0.8);',
    '  gl_PointSize = clamp(size * uSizeGain * uFocal / dist, 0.0, uMaxPoint);',
    '  float a = aParam.y * uIntensity * (1.0 + fly * 2.6) / (1.0 + coc * coc * 16.0);',
    '  a *= mix(1.0, uStarFade, aMisc.y);',
    '  vColor = aColor;',
    '  vAlpha = a;',
    '  vSoft = clamp(aMisc.x + coc * 3.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var POINT_FS = [
    'precision highp float;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'varying float vSoft;',
    'void main() {',
    '  vec2 q = gl_PointCoord - 0.5;',
    '  float d = length(q) * 2.0;',
    '  if (d > 1.0) { discard; }',
    '  float core = exp(-d * d * mix(24.0, 4.0, vSoft));',
    '  float halo = pow(1.0 - d, mix(3.0, 1.5, vSoft));',
    '  float a = (core * mix(1.0, 0.30, vSoft) + halo * 0.45) * vAlpha;',
    '  gl_FragColor = vec4(vColor * a, a);',
    '}'
  ].join('\n');

  var QUAD_VS = [
    'precision highp float;',
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var DECAY_FS = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform float uDecay;',
    'varying vec2 vUv;',
    'void main() { gl_FragColor = texture2D(uTex, vUv) * uDecay; }'
  ].join('\n');

  var COMPOSITE_FS = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform float uExposure;',
    'uniform float uTime;',
    'uniform vec2 uRes;',
    'varying vec2 vUv;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main() {',
    '  vec3 c = texture2D(uTex, vUv).rgb;',
    '  c = vec3(1.0) - exp(-max(c, 0.0) * uExposure);',
    '  c = pow(c, vec3(0.88));',
    /* Hintergrund: fast schwarz, oben links ein Hauch Petrol. */
    '  float g = 1.0 - clamp(distance(vUv, vec2(0.10, 0.94)) * 0.85, 0.0, 1.0);',
    '  vec3 bg = vec3(0.006, 0.010, 0.014) + vec3(0.010, 0.038, 0.042) * pow(g, 2.4);',
    '  vec3 col = bg + c;',
    '  col *= 1.0 - 0.42 * pow(clamp(length(vUv - 0.5) * 1.3, 0.0, 1.0), 2.6);',
    '  col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.013;',
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(gl, vs, fs) {
    var v = compile(gl, gl.VERTEX_SHADER, vs);
    var f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { return null; }
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { return null; }
    return p;
  }

  function uniforms(gl, p, names) {
    var o = {};
    for (var i = 0; i < names.length; i++) { o[names[i]] = gl.getUniformLocation(p, names[i]); }
    return o;
  }

  function initWebGL() {
    var gl = null;
    var opts = {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false
    };
    try {
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) { gl = null; }
    if (!gl) { return null; }

    var pPoints = program(gl, POINT_VS, POINT_FS);
    var pDecay = program(gl, QUAD_VS, DECAY_FS);
    var pComp = program(gl, QUAD_VS, COMPOSITE_FS);
    if (!pPoints || !pDecay || !pComp) { return null; }

    var uPoints = uniforms(gl, pPoints, ['uProj', 'uView', 'uModel', 'uFlight',
      'uTime', 'uSizeGain', 'uFocal', 'uDof', 'uStarFade', 'uIntensity', 'uMaxPoint']);
    var uDecay = uniforms(gl, pDecay, ['uTex', 'uDecay']);
    var uComp = uniforms(gl, pComp, ['uTex', 'uExposure', 'uTime', 'uRes']);

    var aPoints = {
      aTarget: gl.getAttribLocation(pPoints, 'aTarget'),
      aStart: gl.getAttribLocation(pPoints, 'aStart'),
      aBend: gl.getAttribLocation(pPoints, 'aBend'),
      aColor: gl.getAttribLocation(pPoints, 'aColor'),
      aParam: gl.getAttribLocation(pPoints, 'aParam'),
      aMisc: gl.getAttribLocation(pPoints, 'aMisc')
    };
    var aQuadDecay = gl.getAttribLocation(pDecay, 'aPos');
    var aQuadComp = gl.getAttribLocation(pComp, 'aPos');

    /* Punktgröße wird von der Hardware begrenzt. */
    var range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    var maxPoint = Math.min(range && range[1] ? range[1] : 64, 220);

    /* Halbe Gleitkommagenauigkeit erlaubt Helligkeiten über 1 und damit ein
       sauberes Tone-Mapping. Wenn nicht verfügbar: 8 Bit, dann brennen die
       Kerne einfach aus – auch das sieht passend aus. */
    gl.getExtension('EXT_color_buffer_half_float');
    var hf = gl.getExtension('OES_texture_half_float');
    var texType = gl.UNSIGNED_BYTE;
    var exposure = 1.75;

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    var geom = null;
    var buffers = {};
    var targets = [null, null];
    var texSize = [0, 0];
    var pingPong = 0;
    var cleared = false;

    function makeTarget(w, h, type) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) {
        gl.deleteFramebuffer(fb);
        gl.deleteTexture(tex);
        return null;
      }
      return { fb: fb, tex: tex };
    }

    function allocTargets() {
      var i;
      for (i = 0; i < 2; i++) {
        if (targets[i]) {
          gl.deleteFramebuffer(targets[i].fb);
          gl.deleteTexture(targets[i].tex);
          targets[i] = null;
        }
      }
      var type = (hf && texType !== gl.UNSIGNED_BYTE) ? hf.HALF_FLOAT_OES : texType;
      for (i = 0; i < 2; i++) {
        targets[i] = makeTarget(view.w, view.h, type);
        if (!targets[i] && type !== gl.UNSIGNED_BYTE) {
          texType = gl.UNSIGNED_BYTE;
          return allocTargets();
        }
        if (!targets[i]) { return false; }
      }
      texSize = [view.w, view.h];
      cleared = false;
      return true;
    }

    /* Erst mit halben Floats versuchen. */
    if (hf) {
      texType = hf.HALF_FLOAT_OES;
      exposure = 1.5;
    }

    function upload(g) {
      geom = g;
      var names = ['target', 'start', 'bend', 'color', 'param', 'misc'];
      for (var i = 0; i < names.length; i++) {
        var b = buffers[names[i]] || (buffers[names[i]] = gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, g[names[i]], gl.STATIC_DRAW);
      }
    }

    function bindAttr(loc, buf, size) {
      if (loc < 0) { return; }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }

    var mProj = m4(), mView = ident(m4()), mModel = m4();
    var mA = m4(), mB = m4(), mC = m4(), mD = m4();

    function drawQuad(loc) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function resize() {
      if (texSize[0] !== view.w || texSize[1] !== view.h) { allocTargets(); }
    }

    function render(dt) {
      if (!targets[0] || !targets[1]) { return; }

      var decay = st.tau > 0 ? Math.exp(-dt / st.tau) : 0;
      var intensity = Math.max(0.08, 1 - decay);

      var src = targets[pingPong];
      var dst = targets[1 - pingPong];
      pingPong = 1 - pingPong;

      gl.viewport(0, 0, view.w, view.h);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);

      if (!cleared) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, src.fb);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        cleared = true;
      }

      /* 1. Verblassende Vorgeschichte übernehmen. */
      gl.useProgram(pDecay);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(uDecay.uTex, 0);
      gl.uniform1f(uDecay.uDecay, decay);
      drawQuad(aQuadDecay);

      /* 2. Partikel additiv darüber. */
      perspective(view.aspect, 0.1, 40, mProj);
      mView[13] = view.offsetY;
      mView[14] = -CAM_DIST;
      mul(rotY(st.yaw, mA), rotX(currentTilt(), mB), mC);
      mul(mC, rotZ(st.spin, mA), mD);
      mul(mD, scaleM(view.scale, mB), mModel);

      gl.useProgram(pPoints);
      gl.uniformMatrix4fv(uPoints.uProj, false, mProj);
      gl.uniformMatrix4fv(uPoints.uView, false, mView);
      gl.uniformMatrix4fv(uPoints.uModel, false, mModel);
      gl.uniform1f(uPoints.uFlight, st.flight);
      gl.uniform1f(uPoints.uTime, st.time);
      gl.uniform1f(uPoints.uSizeGain, view.sizeGain);
      gl.uniform1f(uPoints.uFocal, CAM_DIST);
      gl.uniform1f(uPoints.uDof, 0.9);
      gl.uniform1f(uPoints.uStarFade, st.starFade);
      gl.uniform1f(uPoints.uIntensity, intensity);
      gl.uniform1f(uPoints.uMaxPoint, maxPoint);

      bindAttr(aPoints.aTarget, buffers.target, 3);
      bindAttr(aPoints.aStart, buffers.start, 3);
      bindAttr(aPoints.aBend, buffers.bend, 3);
      bindAttr(aPoints.aColor, buffers.color, 3);
      bindAttr(aPoints.aParam, buffers.param, 4);
      bindAttr(aPoints.aMisc, buffers.misc, 2);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, geom.count);
      gl.disable(gl.BLEND);

      /* 3. Auf den Bildschirm: Tone-Mapping, Hintergrund, Korn. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, view.w, view.h);
      gl.useProgram(pComp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      gl.uniform1i(uComp.uTex, 0);
      gl.uniform1f(uComp.uExposure, exposure);
      gl.uniform1f(uComp.uTime, st.time);
      gl.uniform2f(uComp.uRes, view.w, view.h);
      drawQuad(aQuadComp);
    }

    return {
      gl: gl,
      upload: upload,
      resize: resize,
      render: render,
      invalidate: function () { cleared = false; },
      init: function () { return allocTargets(); }
    };
  }

  /* ------------------------------------------------------------------ *
   * Canvas-2D-Notlösung (nur wenn WebGL fehlt)
   * ------------------------------------------------------------------ */

  function initCanvas2D() {
    var ctx = canvas.getContext('2d');
    if (!ctx) { return null; }
    var geom = null;
    var sprites = [];

    function sprite(col) {
      var s = document.createElement('canvas');
      s.width = s.height = 64;
      var c = s.getContext('2d');
      var g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      var rgb = 'rgba(' + Math.round(col[0] * 255) + ',' + Math.round(col[1] * 255) +
        ',' + Math.round(col[2] * 255) + ',';
      g.addColorStop(0, rgb + '1)');
      g.addColorStop(0.18, rgb + '0.55)');
      g.addColorStop(0.5, rgb + '0.12)');
      g.addColorStop(1, rgb + '0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      return s;
    }

    var pal = [COL_WHITE, COL_WARM, COL_COOL, COL_DEEP];

    function nearest(r, g, b) {
      var best = 0, bestD = 1e9;
      for (var i = 0; i < pal.length; i++) {
        var d = (pal[i][0] - r) * (pal[i][0] - r) + (pal[i][1] - g) * (pal[i][1] - g) +
          (pal[i][2] - b) * (pal[i][2] - b);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    var palIdx = null;

    function upload(g) {
      geom = g;
      sprites = [sprite(COL_WHITE), sprite(COL_WARM), sprite(COL_COOL), sprite(COL_DEEP)];
      palIdx = new Uint8Array(g.count);
      for (var i = 0; i < g.count; i++) {
        palIdx[i] = nearest(g.color[i * 3], g.color[i * 3 + 1], g.color[i * 3 + 2]);
      }
    }

    var mModel = m4(), mA = m4(), mB = m4(), mC = m4(), mD = m4();

    function render(dt) {
      var fade = st.tau > 0 ? 1 - Math.exp(-dt / st.tau) : 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,' + fade.toFixed(4) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalCompositeOperation = 'lighter';

      mul(rotY(st.yaw, mA), rotX(currentTilt(), mB), mC);
      mul(mC, rotZ(st.spin, mA), mD);
      mul(mD, scaleM(view.scale, mB), mModel);

      var intensity = Math.max(0.1, fade);
      var cx = view.w * 0.5;
      var cy = view.h * 0.5 - view.offsetY * (view.h * 0.5) / (TAN_HALF_FOV * CAM_DIST);
      var ppwu = (view.h * 0.5) / (TAN_HALF_FOV * CAM_DIST);
      var i, i3;

      for (i = 0; i < geom.count; i++) {
        i3 = i * 3;
        var tx = geom.target[i3], ty = geom.target[i3 + 1], tz = geom.target[i3 + 2];
        var mx = mModel[0] * tx + mModel[4] * ty + mModel[8] * tz;
        var my = mModel[1] * tx + mModel[5] * ty + mModel[9] * tz;
        var mz = mModel[2] * tx + mModel[6] * ty + mModel[10] * tz;

        var dly = geom.param[i * 4 + 2];
        var t = clamp((st.flight - dly) / Math.max(1e-3, 1 - dly), 0, 1);
        var e = 1 - Math.pow(1 - t, 3);
        var sx = geom.start[i3], sy = geom.start[i3 + 1], sz = geom.start[i3 + 2];
        var kx = 0.5 * (sx + mx) + geom.bend[i3];
        var ky = 0.5 * (sy + my) + geom.bend[i3 + 1];
        var kz = 0.5 * (sz + mz) + geom.bend[i3 + 2];
        var u = 1 - e;
        var px = u * u * sx + 2 * u * e * kx + e * e * mx;
        var py = u * u * sy + 2 * u * e * ky + e * e * my;
        var pz = u * u * sz + 2 * u * e * kz + e * e * mz;

        var dist = CAM_DIST - pz;
        if (dist < 0.2) { continue; }
        var k = ppwu * CAM_DIST / dist;
        var X = cx + px * k;
        var Y = cy - py * k;
        var coc = Math.abs(dist - CAM_DIST) * 0.9;
        var fly = Math.pow(1 - t, 1.7);
        var size = geom.param[i * 4] * (1 + coc * 7) * (1 + fly * 0.8) *
          view.sizeGain * CAM_DIST / dist;
        if (size < 0.5) { size = 0.5; }
        if (size > 220) { size = 220; }
        if (X < -size || X > view.w + size || Y < -size || Y > view.h + size) { continue; }

        var a = geom.param[i * 4 + 1] * intensity * (1 + fly * 2.6) / (1 + coc * coc * 16);
        if (geom.misc[i * 2 + 1] > 0.5) { a *= st.starFade; }
        /* Ohne Tone-Mapping muss die Helligkeit von Hand gedeckelt werden,
           sonst brennt die additive Mischung schnell aus. */
        if (a <= 0.004) { continue; }
        ctx.globalAlpha = a > 0.75 ? 0.75 : a;
        var d2 = size * 1.8;
        ctx.drawImage(sprites[palIdx[i]], X - d2 * 0.5, Y - d2 * 0.5, d2, d2);
      }
      ctx.globalAlpha = 1;
    }

    return {
      gl: null,
      upload: upload,
      resize: function () { },
      render: render,
      invalidate: function () { },
      init: function () { return true; }
    };
  }

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */

  measure();

  var glRenderer = initWebGL();
  var renderer = null;
  var isGL = false;
  if (glRenderer && glRenderer.init()) {
    renderer = glRenderer;
    isGL = true;
  } else {
    /* Ein Canvas kann nur einen Kontexttyp haben. Wenn WebGL zwar da war,
       aber nicht nutzbar ist, muss für Canvas 2D ein neues her. */
    if (glRenderer) {
      var fresh = canvas.cloneNode(false);
      canvas.parentNode.replaceChild(fresh, canvas);
      canvas = fresh;
      measure();
    }
    renderer = initCanvas2D();
  }
  if (!renderer) {
    hero.classList.add('yy-hero--static', 'is-revealed');
    return;
  }
  hero.classList.add(isGL ? 'yy-hero--gl' : 'yy-hero--2d');

  /* Partikelzahl an Gerät und Fläche anpassen. */
  var area = Math.max(1, view.w * view.h);
  var q = area < 700000 ? 0.6 : (area < 1700000 ? 0.82 : 1);
  if ((navigator.hardwareConcurrency || 4) <= 4) { q *= 0.8; }
  if (!isGL) { q *= 0.28; }
  q = clamp(q, 0.16, 1);
  renderer.upload(buildGeometry(q));

  var running = false;
  var pending = false;
  var last = 0;
  var visible = true;

  function draw(dt) {
    renderer.resize();
    renderer.render(dt);
  }

  function frame(now) {
    pending = false;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    advance(dt);
    draw(dt);
    if (running) { requestFrame(); }
  }

  function requestFrame() {
    if (pending) { return; }
    pending = true;
    window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || !visible) { return; }
    running = true;
    last = 0;
    requestFrame();
  }

  function stop() {
    running = false;
  }

  function renderOnce() {
    /* Für reduzierte Bewegung: ein Bild ohne Nachleuchten. */
    renderer.invalidate();
    renderer.resize();
    advance(0);
    renderer.render(1);
  }

  initPointer(function () {
    if (reduceMotion) { renderOnce(); } else { start(); }
  });

  window.addEventListener('resize', function () {
    measure();
    renderer.invalidate();
    if (reduceMotion) { renderOnce(); } else { start(); }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else if (!reduceMotion && visible) { start(); }
  });

  if (replayBtn) {
    replayBtn.addEventListener('click', function () {
      resetAnimation();
      renderer.invalidate();
      if (reduceMotion) { renderOnce(); } else { start(); }
    });
  }

  if (canvas.addEventListener) {
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      stop();
    });
  }

  /* Nur rechnen, solange der Kopfbereich sichtbar ist. */
  if (window.IntersectionObserver) {
    new window.IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) { stop(); } else if (!reduceMotion) { start(); }
    }, { threshold: 0 }).observe(hero);
  }

  if (reduceMotion) {
    renderOnce();
  } else {
    start();
  }
})();
