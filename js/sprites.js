/* ------------------------------------------------------------------
 * sprites.js -- everything that puts pixels on the 320x200 screen.
 * The C64 palette is authentic (VICE values); the camels are plotted
 * from unit-grid blocks so their necks and legs can be animated.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var C = {
    black:      '#000000',
    white:      '#ffffff',
    red:        '#813338',
    cyan:       '#75cec8',
    purple:     '#8e3c97',
    green:      '#56ac4d',
    blue:       '#2e2c9b',
    yellow:     '#edf171',
    orange:     '#8e5029',
    brown:      '#553800',
    lightred:   '#c46c71',
    darkgrey:   '#4a4a4a',
    grey:       '#7b7b7b',
    lightgreen: '#a9ff9f',
    lightblue:  '#706deb',
    lightgrey:  '#b2b2b2'
  };

  /* Order used for all the colour-cycling effects Minter was so fond of. */
  var CYCLE = [C.yellow, C.lightgreen, C.cyan, C.lightblue, C.purple,
               C.lightred, C.orange, C.white];

  /* Camel damage ramp. Deliberately skips the ridge colours (purple,
     blue, dark grey) so a wounded camel never camouflages itself
     against the mountains behind it. */
  var DAMAGE = [C.yellow, C.lightgreen, C.cyan, C.lightblue,
                C.lightred, C.orange, C.white];

  /* ---- helpers ------------------------------------------------------ */

  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Deterministic RNG so a level's mountains look the same every run. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- player ship --------------------------------------------------
   * 16x8 delta jet. x = body, c = canopy, f = exhaust, w = wingtip.
   */
  var SHIP = [
    '.........w......',
    '........www.....',
    '..w.....www.....',
    '.xxxxxxxxxxxxx..',
    'fxxxxxccxxxxxxxx',
    '.xxxxxxxxxxxxx..',
    '..w.....www.....',
    '........www.....'
  ];

  function drawShip(ctx, x, y, facing, t, hurtFlash) {
    var body = hurtFlash ? C.white : C.lightgrey;
    var wing = hurtFlash ? C.white : C.grey;
    var canopy = C.cyan;
    var flame = (Math.floor(t * 30) % 2) ? C.yellow : C.lightred;
    for (var r = 0; r < SHIP.length; r++) {
      var row = SHIP[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        var col = ch === 'x' ? body : ch === 'w' ? wing : ch === 'c' ? canopy : flame;
        var px = facing < 0 ? (row.length - 1 - c) : c;
        rect(ctx, x + px, y + r, 1, 1, col);
      }
    }
  }

  /* ---- camel --------------------------------------------------------
   * Drawn on a 30x24 unit grid, 2px per unit -> 60x48 pixels, facing
   * right (toward your base). Origin passed in is the mid-point of the
   * feet, which is also what the walk/collision code uses.
   */
  var U = 3;                 /* pixels per grid unit -> 90x72 px camels */
  var CAMEL_W = 30 * U;
  var CAMEL_H = 24 * U;

  function camelPalette(hpFrac, t, dying) {
    if (dying) return CYCLE[Math.floor(t * 24) % CYCLE.length];
    var wounded = 1 - hpFrac;
    if (wounded > 0.82) {
      /* "all multicoloured" -- the tell-tale that it is about to fold. */
      return CYCLE[Math.floor(t * 16) % CYCLE.length];
    }
    var idx = Math.min(DAMAGE.length - 1, Math.floor(wounded * DAMAGE.length));
    return DAMAGE[idx];
  }

  /**
   * Draws one mutant camel, facing right.
   * @param cam {x, feetY, hp, maxHp, phase, rear (0..1), dying, flash}
   *        cam.x is the mid-point of the feet; cam.mouth is written back
   *        so the spit code knows where the fireballs start.
   */
  function drawCamel(ctx, cam, t) {
    var left = Math.round(cam.x - CAMEL_W / 2);
    var top = Math.round(cam.feetY - CAMEL_H);
    var hpFrac = Math.max(0, cam.hp / cam.maxHp);
    var base = cam.flash > 0 ? C.white : camelPalette(hpFrac, t, cam.dying);
    var ink = C.black;
    var shade = cam.flash > 0 ? C.lightgrey : C.brown;

    var bob = Math.sin(cam.phase * 2) * 0.4;
    var swingA = Math.sin(cam.phase) * 1.6;
    var swingB = Math.sin(cam.phase + Math.PI) * 1.6;

    /* Collect the silhouette in grid units, then stamp it twice: once
       fattened in black for a hard outline, once in the body colour. */
    var parts = [];
    function p(x, y, w, h) { parts.push([x, y + bob, w, h]); }

    /* body barrel */
    p(5, 9, 18, 1);
    p(3, 10, 22, 1);
    p(2, 11, 24, 5);
    p(4, 16, 20, 1);

    /* rear hump (smaller) and front hump (the weak spot) */
    p(8, 6, 4, 1);  p(7, 7, 6, 1);  p(6, 8, 8, 1);
    p(16, 4, 4, 1); p(15, 5, 6, 1); p(14, 6, 8, 3);

    /* tail */
    p(0, 10, 3, 2);

    /* neck: a tapered column that rears up as the camel is destabilised */
    var slant = 0.62 - cam.rear * 0.5;      /* 0.62 = walking, ~0.1 = reared */
    var risen = cam.rear * 3.4;
    for (var k = 0; k < 8; k++) {
      p(21 + k * slant, 10 - k - risen * (k / 8), 4 - k * 0.13, 1.05 + cam.rear * 0.8);
    }
    var hx = 21 + 8 * slant;
    var hy = 2 - risen;

    /* head, ears and muzzle */
    p(hx + 2, hy - 2, 1, 2);
    p(hx + 4, hy - 2, 1, 2);
    p(hx + 1, hy, 5, 3);
    p(hx + 5, hy + 1, 3, 2);

    function stamp(list, col, grow) {
      ctx.fillStyle = col;
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        ctx.fillRect(
          Math.round(left + r[0] * U) - grow,
          Math.round(top + r[1] * U) - grow,
          Math.round(r[2] * U) + grow * 2,
          Math.round(r[3] * U) + grow * 2
        );
      }
    }

    /* legs -- drawn behind the body, far pair in shadow */
    var legs = [
      [5 + swingB, 15, 3, 9, shade],
      [16 + swingA, 15, 3, 9, shade],
      [8 + swingA, 15, 4, 9, base],
      [19 + swingB, 15, 4, 9, base]
    ];
    for (var l = 0; l < legs.length; l++) {
      var lg = legs[l];
      ctx.fillStyle = ink;
      ctx.fillRect(left + lg[0] * U - 1, top + lg[1] * U, lg[2] * U + 2, lg[3] * U);
      ctx.fillStyle = lg[4];
      ctx.fillRect(left + lg[0] * U, top + lg[1] * U, lg[2] * U, lg[3] * U - 2);
      ctx.fillStyle = shade;
      ctx.fillRect(left + lg[0] * U - 1, top + (lg[1] + lg[3]) * U - 3, lg[2] * U + 3, 3);
    }

    stamp(parts, ink, 2);
    stamp(parts, base, 0);

    /* belly shadow, hump crest highlight, eye */
    ctx.fillStyle = shade;
    ctx.fillRect(left + 4 * U, top + (15.4 + bob) * U, 20 * U, U);
    ctx.fillStyle = cam.flash > 0 ? C.white : C.lightgreen;
    ctx.fillRect(left + 16 * U, top + (4 + bob) * U, 4 * U, U);   /* aim here */
    ctx.fillStyle = ink;
    ctx.fillRect(left + (hx + 3) * U, top + (hy + bob + 0.6) * U, U, U);

    cam.mouth = {
      x: left + (hx + 8) * U,
      y: top + (hy + bob + 2) * U
    };
  }

  /* Local-space hit boxes, in grid units, relative to (left, top). */
  var HUMP_BOX = { x: 6, y: 3.5, w: 16, h: 6 };
  var BODY_BOX = { x: 1, y: 9, w: 25, h: 8 };
  var NECK_BOX = { x: 21, y: 0, w: 11, h: 10 };

  function camelHit(cam, px, py) {
    var left = cam.x - CAMEL_W / 2, top = cam.feetY - CAMEL_H;
    var lx = (px - left) / U, ly = (py - top) / U;
    function inBox(b) {
      return lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h;
    }
    if (inBox(HUMP_BOX)) return 'hump';
    if (inBox(BODY_BOX)) return 'body';
    if (inBox(NECK_BOX)) return 'neck';
    return null;
  }

  /* ---- bonus llama (Minter tax) ------------------------------------- */
  function drawLlama(ctx, x, feetY, phase, t) {
    var col = CYCLE[Math.floor(t * 10) % CYCLE.length];
    var s = 1;
    function u(ux, uy, uw, uh, c) { rect(ctx, x + ux * s, feetY - 16 + uy * s, uw * s, uh * s, c); }
    var sw = Math.sin(phase) * 1.5;
    u(3 + sw, 10, 2, 6, C.white);
    u(9 - sw, 10, 2, 6, C.white);
    u(2, 5, 11, 6, col);          /* body */
    u(10, 0, 3, 6, col);          /* neck */
    u(11, -3, 4, 4, col);         /* head */
    u(14, -1, 2, 2, col);         /* snout */
    u(11, -5, 1, 2, col);         /* ears */
    u(13, -5, 1, 2, col);
    u(1, 4, 2, 2, col);           /* tail */
    rect(ctx, x + 13, feetY - 18, 1, 1, C.black);
  }

  /* ---- terrain ------------------------------------------------------
   * Three parallax ridges plus the flat strip the camels walk on.
   */
  var ridgeCache = {};

  function ridge(seed, points, amp, baseY) {
    var key = seed + ':' + points + ':' + amp + ':' + baseY;
    if (ridgeCache[key]) return ridgeCache[key];
    var rnd = mulberry32(seed);
    var pts = [];
    for (var i = 0; i <= points; i++) pts.push(baseY - rnd() * amp);
    ridgeCache[key] = pts;
    return pts;
  }

  function drawRidge(ctx, pts, spacing, offset, wrapW, color, floorY) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4, floorY);
    var n = pts.length - 1;
    var startI = Math.floor(offset / spacing) - 1;
    for (var i = startI; i * spacing - offset < 324; i++) {
      var idx = ((i % n) + n) % n;
      ctx.lineTo(i * spacing - offset, pts[idx]);
    }
    ctx.lineTo(340, floorY);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(ctx, camX, groundY, level, t) {
    var seed = 1337 + level * 77;
    /* far range */
    drawRidge(ctx, ridge(seed, 24, 46, groundY - 34), 34, camX * 0.15, 0, C.blue, groundY);
    /* mid range */
    drawRidge(ctx, ridge(seed + 1, 20, 34, groundY - 18), 26, camX * 0.35, 0, C.purple, groundY);
    /* near range */
    drawRidge(ctx, ridge(seed + 2, 18, 20, groundY - 4), 21, camX * 0.62, 0, C.darkgrey, groundY);

    /* the desert floor the camels trundle over */
    rect(ctx, 0, groundY, 320, 200 - groundY, C.orange);
    rect(ctx, 0, groundY, 320, 1, C.yellow);
    ctx.fillStyle = C.brown;
    var step = 16;
    var off = Math.floor(camX) % step;
    for (var x = -off; x < 320; x += step) {
      ctx.fillRect(x, groundY + 4, 6, 1);
      ctx.fillRect(x + 8, groundY + 8, 4, 1);
    }
  }

  /* ---- your home base, parked at the right-hand end of the world ---- */
  function drawBase(ctx, sx, groundY, t) {
    var glow = CYCLE[Math.floor(t * 6) % CYCLE.length];
    rect(ctx, sx, groundY - 22, 34, 22, C.grey);
    rect(ctx, sx + 2, groundY - 20, 30, 2, C.lightgrey);
    rect(ctx, sx + 4, groundY - 34, 8, 12, C.darkgrey);
    rect(ctx, sx + 22, groundY - 30, 8, 8, C.darkgrey);
    rect(ctx, sx + 5, groundY - 38, 6, 4, glow);
    rect(ctx, sx + 23, groundY - 34, 6, 4, glow);
    for (var i = 0; i < 4; i++) {
      rect(ctx, sx + 4 + i * 8, groundY - 14, 4, 5, C.cyan);
    }
    rect(ctx, sx + 14, groundY - 44, 2, 22, C.lightgrey);
    rect(ctx, sx + 12, groundY - 48, 6, 4, glow);
  }

  /* ---- starfield ---------------------------------------------------- */
  function makeStars(n, w, h, seed) {
    var rnd = mulberry32(seed || 99);
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ x: rnd() * w, y: rnd() * h, d: 0.15 + rnd() * 0.5, b: rnd() });
    }
    return out;
  }

  function drawStars(ctx, stars, camX, t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var x = ((s.x - camX * s.d) % 340 + 340) % 340 - 10;
      var tw = (Math.sin(t * 3 + s.b * 9) + 1) * 0.5;
      rect(ctx, x, s.y, 1, 1, tw > 0.6 ? C.white : C.lightblue);
    }
  }

  global.Art = {
    C: C,
    CYCLE: CYCLE,
    DAMAGE: DAMAGE,
    rect: rect,
    mulberry32: mulberry32,
    drawShip: drawShip,
    drawCamel: drawCamel,
    camelHit: camelHit,
    drawLlama: drawLlama,
    drawTerrain: drawTerrain,
    drawBase: drawBase,
    makeStars: makeStars,
    drawStars: drawStars,
    CAMEL_W: CAMEL_W,
    CAMEL_H: CAMEL_H
  };
})(window);
