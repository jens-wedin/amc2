/* ------------------------------------------------------------------
 * beasts.js -- the bestiary.
 *
 * Every mutant animal is plotted on the same 30x24 unit grid facing
 * right, and rendered by one shared routine: legs first, then the
 * silhouette stamped twice (fattened in black for a keyline, then in
 * the damage colour), then details on top.
 *
 * A species owns its shape, its weak spot, its weapon, its gait and
 * its biome. Adding one is a matter of adding a table entry.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var C = Art.C;
  var CYCLE = Art.CYCLE;
  var DAMAGE = Art.DAMAGE;

  var U = 3;                       /* pixels per grid unit */
  var GRID_W = 30, GRID_H = 24;
  var BEAST_W = GRID_W * U;        /* 90 px */
  var BEAST_H = GRID_H * U;        /* 72 px */

  function geo() {
    return { parts: [], legs: [], details: [], weak: null, mouth: [30, 10] };
  }

  /* ---- damage colouring --------------------------------------------
   * Faithful to the 1983 original: the beast walks up the palette as
   * it is hurt and goes fully multicoloured just before it folds.
   */
  function damageColor(hpFrac, t, dying) {
    if (dying) return CYCLE[Math.floor(t * 24) % CYCLE.length];
    var wounded = 1 - hpFrac;
    if (wounded > 0.82) return CYCLE[Math.floor(t * 16) % CYCLE.length];
    return DAMAGE[Math.min(DAMAGE.length - 1, Math.floor(wounded * DAMAGE.length))];
  }

  /* =================================================================
   * THE BESTIARY
   * Each act runs 30 zones. Order is the reveal order -- the player
   * is not told what is coming next.
   * ================================================================= */
  var SPECIES = [

    /* ---------------------------------------------------------------- */
    {
      id: 'camel',
      name: 'MUTANT CAMELS',
      one: 'CAMEL',
      weakName: 'THE HUMP',
      accent: C.lightgreen,
      hp: 50, speed: 11, count: 4,
      weapon: 'spit', gait: 'amble',
      fireEvery: [1.0, 2.4],
      reveal: 'SIX GIANT SHAPES ON THE HORIZON',
      biome: { sky: '#000000', far: C.blue, mid: C.purple, near: C.darkgrey,
               ground: C.orange, edge: C.yellow, fleck: C.brown },
      boxes: { weak: { x: 6, y: 3.5, w: 16, h: 6 },
               body: { x: 1, y: 9, w: 25, h: 8 },
               head: { x: 21, y: 0, w: 11, h: 10 } },
      build: function (s) {
        var g = geo(), b = s.bob;
        g.legs.push([5 + s.swingB, 15, 3, 9, true], [16 + s.swingA, 15, 3, 9, true],
                    [8 + s.swingA, 15, 4, 9, false], [19 + s.swingB, 15, 4, 9, false]);
        g.parts.push([5, 9 + b, 18, 1], [3, 10 + b, 22, 1], [2, 11 + b, 24, 5], [4, 16 + b, 20, 1]);
        g.parts.push([8, 6 + b, 4, 1], [7, 7 + b, 6, 1], [6, 8 + b, 8, 1]);
        g.parts.push([16, 4 + b, 4, 1], [15, 5 + b, 6, 1], [14, 6 + b, 8, 3]);
        g.parts.push([0, 10 + b, 3, 2]);
        var slant = 0.62 - s.rear * 0.5, risen = s.rear * 3.4;
        for (var k = 0; k < 8; k++) {
          g.parts.push([21 + k * slant, 10 - k - risen * (k / 8) + b,
                        4 - k * 0.13, 1.05 + s.rear * 0.8]);
        }
        var hx = 21 + 8 * slant, hy = 2 - risen + b;
        g.parts.push([hx + 2, hy - 2, 1, 2], [hx + 4, hy - 2, 1, 2],
                     [hx + 1, hy, 5, 3], [hx + 5, hy + 1, 3, 2]);
        g.details.push([4, 15.4 + b, 20, 1, 'shade'], [hx + 3, hy + 0.6, 1, 1, 'ink']);
        g.weak = [16, 4 + b, 4, 1];
        g.mouth = [hx + 8, hy + 2];
        return g;
      }
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'cat',
      name: 'MUTANT CATS',
      one: 'CAT',
      weakName: 'THE BELL',
      accent: C.lightred,
      hp: 44, speed: 15, count: 5,
      weapon: 'hairball', gait: 'prowl',
      fireEvery: [0.9, 2.0],
      reveal: 'THE HERD IS GONE. SOMETHING IS STALKING THE RIDGE.',
      biome: { sky: '#0a0016', far: C.purple, mid: C.blue, near: C.darkgrey,
               ground: C.grey, edge: C.cyan, fleck: C.darkgrey },
      boxes: { weak: { x: 20, y: 9.5, w: 7, h: 4.5 },
               body: { x: 2, y: 9, w: 21, h: 9 },
               head: { x: 21, y: 3.5, w: 9, h: 8 } },
      build: function (s) {
        var g = geo(), b = s.bob, rise = s.rear * 3;
        g.legs.push([6 + s.swingB, 16, 2, 8, true], [18 + s.swingA, 16, 2, 8, true],
                    [9 + s.swingA, 16, 3, 8, false], [21 + s.swingB, 16, 3, 8, false]);
        /* long low body with an arched spine */
        g.parts.push([11, 10 + b, 7, 1], [9, 11 + b, 11, 1], [7, 12 + b, 15, 1],
                     [6, 13 + b, 17, 4], [8, 17 + b, 13, 1]);
        g.parts.push([4, 12 + b, 5, 5]);                  /* haunch */
        g.parts.push([19, 12 + b, 5, 4]);                 /* shoulder */
        /* tail: a thin arc sweeping up and forward over the back */
        var wag = Math.sin(s.phase * 1.7) * 0.9;
        g.parts.push([4, 10.5 + b, 1.6, 2], [3.2, 8.8 + b, 1.6, 2],
                     [2.6 + wag * 0.2, 7.1 + b, 1.6, 2], [2.6 + wag * 0.5, 5.6 + b, 1.6, 1.8],
                     [3.4 + wag * 0.8, 4.4 + b, 2, 1.6], [5 + wag, 4 + b, 2, 1.4]);
        /* chest, head, ears */
        g.parts.push([21, 11 + b - rise * 0.4, 4, 4]);
        g.parts.push([22, 6 + b - rise, 6, 5]);
        g.parts.push([22, 4 + b - rise, 2, 2], [26, 4 + b - rise, 2, 2]);
        g.parts.push([28, 8 + b - rise, 2, 2]);           /* muzzle */
        g.details.push([23.5, 7.5 + b - rise, 1, 1, 'ink'], [25.5, 7.5 + b - rise, 1, 1, 'ink'],
                       [8, 16.4 + b, 13, 1, 'shade']);
        g.weak = [21.2, 10.6 + b - rise * 0.4, 3.6, 1.6];   /* the bell */
        g.mouth = [30, 9 + b - rise];
        return g;
      }
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'dog',
      name: 'MUTANT DOGS',
      one: 'DOG',
      weakName: 'THE RUMP PATCH',
      accent: C.cyan,
      hp: 58, speed: 16, count: 5,
      weapon: 'bark', gait: 'trot',
      fireEvery: [1.1, 2.2],
      reveal: 'A NEW SCENT ON THE WIND',
      biome: { sky: '#001008', far: C.blue, mid: C.green, near: C.brown,
               ground: C.green, edge: C.lightgreen, fleck: C.brown },
      boxes: { weak: { x: 0, y: 6, w: 8, h: 6 },
               body: { x: 3, y: 9, w: 21, h: 9 },
               head: { x: 19, y: 3.5, w: 12, h: 8 } },
      build: function (s) {
        var g = geo(), b = s.bob, rise = s.rear * 3.6;
        g.legs.push([5 + s.swingB, 16, 3, 8, true], [17 + s.swingA, 16, 3, 8, true],
                    [8 + s.swingA, 16, 4, 8, false], [20 + s.swingB, 16, 4, 8, false]);
        g.parts.push([5, 9 + b, 17, 1], [4, 10 + b, 20, 7], [5, 17 + b, 18, 1]);
        g.parts.push([2, 10 + b, 4, 6]);                  /* rump */
        /* tail, hinged at the rump and wagging hard */
        var wag = Math.sin(s.phase * 3.4) * 1.4;
        g.parts.push([2.5, 8 + b, 2, 2.5],
                     [1.8 + wag * 0.5, 6 + b, 2, 2.5],
                     [1.2 + wag, 4.2 + b, 2, 2.2]);
        g.parts.push([20, 8 + b - rise * 0.4, 5, 4]);     /* neck */
        g.parts.push([21, 4 + b - rise, 7, 5]);           /* skull */
        g.parts.push([19.5, 4.5 + b - rise, 2.5, 6]);     /* floppy ear */
        g.parts.push([27, 7 + b - rise, 4, 2]);           /* snout */
        g.details.push([25, 5.6 + b - rise, 1, 1, 'ink'],
                       [30, 7.2 + b - rise, 1, 1, 'ink'],
                       [6, 16.4 + b, 16, 1, 'shade']);
        g.weak = [2.3, 8.4 + b, 2.4, 2];                  /* patch at the tail root */
        g.mouth = [31, 8.5 + b - rise];
        return g;
      }
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'panda',
      name: 'MUTANT PANDAS',
      one: 'PANDA',
      weakName: 'THE BELLY',
      accent: C.cyan,
      hp: 78, speed: 9, count: 4,
      weapon: 'bamboo', gait: 'lumber',
      fireEvery: [1.3, 2.6],
      reveal: 'THE BAMBOO LINE HAS BROKEN',
      biome: { sky: '#060612', far: C.lightblue, mid: C.grey, near: C.blue,
               ground: C.lightgrey, edge: C.white, fleck: C.grey },
      boxes: { weak: { x: 8, y: 13, w: 12, h: 5 },
               body: { x: 5, y: 9, w: 18, h: 10 },
               head: { x: 19, y: 1, w: 12, h: 10 } },
      build: function (s) {
        var g = geo(), b = s.bob, rise = s.rear * 2.6;
        g.legs.push([6 + s.swingB * 0.5, 17, 4, 7, true], [16 + s.swingA * 0.5, 17, 4, 7, true],
                    [10 + s.swingA * 0.5, 17, 4, 7, false], [20 + s.swingB * 0.5, 17, 4, 7, false]);
        /* round barrel */
        g.parts.push([11, 9 + b, 8, 1], [9, 10 + b, 12, 1], [7, 11 + b, 16, 1],
                     [6, 12 + b, 17, 6], [8, 18 + b, 13, 1]);
        /* head sits clearly proud of the shoulders */
        g.parts.push([19, 3 + b - rise, 10, 8]);
        g.parts.push([19, 1 + b - rise, 3, 3], [26, 1 + b - rise, 3, 3]);   /* ears */
        g.parts.push([28, 7 + b - rise, 2, 2]);           /* muzzle */
        g.details.push([19, 1 + b - rise, 3, 3, 'ink'], [26, 1 + b - rise, 3, 3, 'ink'],
                       [21, 5 + b - rise, 3, 3, 'ink'], [25, 5 + b - rise, 3, 3, 'ink'],
                       [22, 6 + b - rise, 1, 1, 'white'], [26, 6 + b - rise, 1, 1, 'white'],
                       [28, 7.6 + b - rise, 2, 1, 'ink'],
                       [6, 12 + b, 2.5, 6, 'ink'], [20.5, 12 + b, 2.5, 6, 'ink']);
        g.weak = [10, 14.6 + b, 7, 2];
        g.mouth = [31, 9 + b - rise];
        return g;
      }
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'elephant',
      name: 'MUTANT ELEPHANTS',
      one: 'ELEPHANT',
      weakName: 'THE EAR',
      accent: C.cyan,
      hp: 96, speed: 12, count: 4,
      weapon: 'spray', gait: 'charge',
      fireEvery: [1.4, 2.6],
      reveal: 'THE GROUND IS SHAKING',
      biome: { sky: '#180400', far: C.purple, mid: C.red, near: C.brown,
               ground: C.orange, edge: C.yellow, fleck: C.brown },
      boxes: { weak: { x: 16, y: 4.5, w: 9, h: 10 },
               body: { x: 2, y: 7, w: 20, h: 11 },
               head: { x: 25, y: 5, w: 6, h: 16 } },
      build: function (s) {
        var g = geo(), b = s.bob, rise = s.rear * 2.4;
        g.legs.push([4 + s.swingB * 0.6, 16, 5, 8, true], [15 + s.swingA * 0.6, 16, 5, 8, true],
                    [9 + s.swingA * 0.6, 16, 5, 8, false], [20 + s.swingB * 0.6, 16, 5, 8, false]);
        g.parts.push([5, 7 + b, 15, 1], [4, 8 + b, 18, 1], [3, 9 + b, 20, 8], [5, 17 + b, 16, 1]);
        g.parts.push([1, 10 + b, 3, 5]);                  /* rump */
        g.parts.push([20, 6 + b - rise, 8, 9]);           /* skull */
        /* the ear: a big rounded slab over the shoulder -- the weak spot */
        var e = b - rise * 0.6;
        g.parts.push([19, 4 + e, 4, 1], [18, 5 + e, 6, 1], [17, 6 + e, 8, 5],
                     [17.5, 11 + e, 7, 1], [18.5, 12 + e, 5, 1], [20, 13 + e, 3, 1]);
        /* trunk, hanging in front of the forelegs */
        var curl = Math.sin(s.phase * 1.3) * 0.7;
        g.parts.push([26, 13 + b - rise, 3, 2], [27 + curl, 15 + b - rise, 3, 2],
                     [27 + curl, 17 + b - rise, 3, 2], [26 + curl, 19 + b - rise, 3, 2]);
        g.details.push([18.4, 6.6 + e, 5, 4.4, 'shade'],                  /* inner ear */
                       [25.6, 9 + b - rise, 1, 1, 'ink'],
                       [24.5, 14.4 + b - rise, 5, 1.2, 'white'],          /* tusk */
                       [5, 16.4 + b, 16, 1, 'shade']);
        g.weak = [18.6, 5.2 + e, 4.4, 1.6];
        g.mouth = [30 + curl, 20 + b - rise];
        return g;
      }
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'sheep',
      name: 'MUTANT SHEEP',
      one: 'SHEEP',
      weakName: 'THE FACE',
      accent: C.lightred,
      hp: 66, speed: 18, count: 6,
      weapon: 'bolt', gait: 'hop',
      fireEvery: [0.8, 1.8],
      reveal: 'LOOK UP. THEY ARE COMING DOWN FROM ORBIT.',
      biome: { sky: '#000000', far: C.purple, mid: C.lightblue, near: C.darkgrey,
               ground: C.grey, edge: C.lightgrey, fleck: C.darkgrey },
      boxes: { weak: { x: 21, y: 8.5, w: 10, h: 8 },
               body: { x: 3, y: 6, w: 21, h: 12 },
               head: { x: 21, y: 8.5, w: 10, h: 8 } },
      build: function (s) {
        var g = geo(), b = s.bob, rise = s.rear * 3;
        g.legs.push([7 + s.swingB, 16, 2, 8, true], [17 + s.swingA, 16, 2, 8, true],
                    [10 + s.swingA, 16, 3, 8, false], [20 + s.swingB, 16, 3, 8, false]);
        /* scalloped fleece: overlapping bumps make a lumpy outline */
        g.parts.push([4, 8.4 + b, 4, 3], [7.4, 6.6 + b, 4, 3], [11, 5.8 + b, 4.4, 3],
                     [14.8, 6.6 + b, 4, 3], [18, 8.4 + b, 4.4, 3]);
        g.parts.push([4, 10 + b, 19, 1], [3, 11 + b, 21, 6], [5, 17 + b, 17, 1]);
        /* small dark head, held out in front */
        g.parts.push([22, 10 + b - rise, 6, 6]);
        g.parts.push([21, 9 + b - rise, 2, 3]);           /* ear */
        g.parts.push([27, 13 + b - rise, 3, 2]);          /* muzzle */
        g.details.push([22, 10 + b - rise, 6, 6, 'ink'], [21, 9 + b - rise, 2, 3, 'ink'],
                       [27, 13 + b - rise, 3, 2, 'ink'],
                       [23.4, 11.4 + b - rise, 1, 1, 'white'],
                       [25.6, 11.4 + b - rise, 1, 1, 'white'],
                       [5, 16.4 + b, 17, 1, 'shade']);
        g.weak = [23, 13.4 + b - rise, 4, 1.4];
        g.mouth = [30, 14 + b - rise];
        return g;
      }
    }
  ];

  /* =================================================================
   * shared renderer
   * ================================================================= */
  function buildState(beast, t) {
    return {
      bob: Math.sin(beast.phase * 2) * 0.4,
      phase: beast.phase,
      rear: beast.rear || 0,
      swingA: Math.sin(beast.phase) * 1.6,
      swingB: Math.sin(beast.phase + Math.PI) * 1.6
    };
  }

  /**
   * @param beast {x, feetY, hp, maxHp, phase, rear, dying, flash, silhouette}
   * @param sp    a SPECIES entry
   * @param u     pixels per unit; defaults to the in-game 3
   */
  function drawBeast(ctx, beast, t, sp, u) {
    u = u || U;
    var w = GRID_W * u, h = GRID_H * u;
    var left = Math.round(beast.x - w / 2);
    var top = Math.round(beast.feetY - h);
    var flat = beast.silhouette;

    var hpFrac = beast.maxHp ? Math.max(0, beast.hp / beast.maxHp) : 1;
    var base = flat || (beast.flash > 0 ? C.white : damageColor(hpFrac, t, beast.dying));
    var ink = flat || C.black;
    var shade = flat || (beast.flash > 0 ? C.lightgrey : C.brown);
    var accent = flat || (beast.flash > 0 ? C.white : sp.accent);

    var g = sp.build(buildState(beast, t));

    function px(x, y, ww, hh, col, grow) {
      grow = grow || 0;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(left + x * u) - grow, Math.round(top + y * u) - grow,
                   Math.round(ww * u) + grow * 2, Math.round(hh * u) + grow * 2);
    }

    /* legs, behind everything */
    for (var i = 0; i < g.legs.length; i++) {
      var lg = g.legs[i];
      px(lg[0], lg[1], lg[2], lg[3], ink, 1);
      px(lg[0], lg[1], lg[2], lg[3] - 0.6, lg[4] ? shade : base);
      px(lg[0] - 0.3, lg[1] + lg[3] - 0.8, lg[2] + 0.6, 0.8, shade);
    }

    /* silhouette: keyline pass, then colour pass */
    var k, p;
    for (k = 0; k < g.parts.length; k++) {
      p = g.parts[k];
      px(p[0], p[1], p[2], p[3], ink, 2);
    }
    for (k = 0; k < g.parts.length; k++) {
      p = g.parts[k];
      px(p[0], p[1], p[2], p[3], base);
    }

    /* markings, eyes, shadows */
    var named = { ink: ink, shade: shade, white: flat || C.white, accent: accent };
    for (k = 0; k < g.details.length; k++) {
      var d = g.details[k];
      px(d[0], d[1], d[2], d[3], named[d[4]] || base);
    }

    /* the weak spot is always flagged -- learning where it moved to is
       the whole point of a new species */
    if (g.weak) {
      px(g.weak[0], g.weak[1], g.weak[2], g.weak[3], ink, 1);
      px(g.weak[0], g.weak[1], g.weak[2], g.weak[3], accent);
    }

    beast.mouth = { x: left + g.mouth[0] * u, y: top + g.mouth[1] * u };
  }

  /** Which zone maps to which hitbox: 'weak', 'body', 'head' or null. */
  function beastHit(beast, sp, pxx, pyy) {
    var left = beast.x - BEAST_W / 2, top = beast.feetY - BEAST_H;
    var lx = (pxx - left) / U, ly = (pyy - top) / U;
    var b = sp.boxes;
    function inBox(r) {
      return r && lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h;
    }
    if (inBox(b.weak)) return 'weak';
    if (inBox(b.body)) return 'body';
    if (inBox(b.head)) return 'head';
    return null;
  }

  global.Beasts = {
    SPECIES: SPECIES,
    U: U,
    W: BEAST_W,
    H: BEAST_H,
    drawBeast: drawBeast,
    beastHit: beastHit,
    damageColor: damageColor
  };
})(window);
