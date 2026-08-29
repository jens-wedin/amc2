/* ------------------------------------------------------------------
 * sprites.js -- everything that puts pixels on the 320x200 screen.
 * The C64 palette is authentic (VICE values). Species artwork lives
 * in beasts.js; everything shared -- ship, terrain, base, stars --
 * lives here.
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
     blue, dark grey) so a wounded beast never camouflages itself
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
   * Parallax ridges plus the strip the beasts walk on.
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

  /** Three parallax ridges plus the strip the beasts walk on, coloured
      by the current act's biome. */
  function drawTerrain(ctx, camX, groundY, level, t, biome) {
    var seed = 1337 + level * 77;
    drawRidge(ctx, ridge(seed, 24, 46, groundY - 34), 34, camX * 0.15, 0, biome.far, groundY);
    drawRidge(ctx, ridge(seed + 1, 20, 34, groundY - 18), 26, camX * 0.35, 0, biome.mid, groundY);
    drawRidge(ctx, ridge(seed + 2, 18, 20, groundY - 4), 21, camX * 0.62, 0, biome.near, groundY);

    rect(ctx, 0, groundY, 320, 200 - groundY, biome.ground);
    rect(ctx, 0, groundY, 320, 1, biome.edge);
    ctx.fillStyle = biome.fleck;
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
    drawLlama: drawLlama,
    drawTerrain: drawTerrain,
    drawBase: drawBase,
    makeStars: makeStars,
    drawStars: drawStars
  };
})(window);
