/* ------------------------------------------------------------------
 * game.js -- ATTACK OF THE MUTANT ANIMALS (AMA)
 *
 * A keyboard-driven homage to Llamasoft's "Attack of the Mutant
 * Camels" (Jeff Minter, 1983), extended into a campaign: every 30
 * zones the herd is replaced by an entirely new species, unannounced.
 * 320x200 internal resolution, C64 palette, no assets.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var C = Art.C;
  var CYCLE = Art.CYCLE;
  /* Bright subset of the palette -- used for anything that must read
     instantly against the ridges. */
  var TRACER = [C.white, C.yellow, C.cyan, C.lightgreen];

  var SPECIES = Beasts.SPECIES;
  var ZONES_PER_ACT = 10;
  var MAX_LEVEL = SPECIES.length * ZONES_PER_ACT;

  /* ---- fixed geometry ---------------------------------------------- */
  var VW = 320, VH = 200;
  var HUD_H = 12;
  var SCAN_Y = 186, SCAN_H = 14;
  var GROUND_Y = 172;
  var SKY_TOP = HUD_H + 2;
  var FLY_TOP = SKY_TOP + 2;
  var FLY_BOTTOM = GROUND_Y - 10;
  var WORLD_W = 1680;
  var BASE_X = WORLD_W - 40;

  /* ---- tunables ----------------------------------------------------- */
  var SHIP_W = 16, SHIP_H = 8;
  var ACCEL = 900, FRICTION = 6.5, MAX_VX = 128, MAX_VY = 104;
  var BULLET_SPEED = 300, MAX_BULLETS = 6;
  var RESPAWN_INVULN = 2.2;
  var EXTRA_LIFE_EVERY = 15000;

  /* ---- runtime ------------------------------------------------------ */
  var canvas, ctx;
  var keys = {}, pressed = {};
  var state = 'boot';
  var stateTime = 0;
  var t = 0;
  var paused = false;

  var score = 0, hiScore = 0, lives = 3, level = 1;
  var bestZone = 0, won = false;
  var nextExtraLife = EXTRA_LIFE_EVERY;
  var killBonus = 100;
  var shake = 0, flash = 0, flashCol = C.white;

  var player, beasts, bullets, shots, particles, floaters, llama;
  var missiles, warpLines;
  var stars = Art.makeStars(70, 340, GROUND_Y - 20, 4242);
  var camX = 0;
  var hyperTimer = 0, hyperLength = 0;
  var message = null;
  var revealSp = null;

  /* ---- retro easter eggs ---- */
  var boing = null;              /* Amiga: the bouncing checkered ball */
  var neutral = null;            /* Atari: the shimmering neutral zone */
  var gridSweep = 0;             /* VIC-20: Gridrunner-style smart bomb */
  var raster = 0;                /* C64: rasterbar flash */
  var RASTER_TIME = 0.45;
  var hintPage = 0, hintTimer = 0;
  var scrollX = 0;

  /* =================================================================
   * campaign maths
   * ================================================================= */
  function actIndex(lv) {
    return Math.min(SPECIES.length - 1, Math.floor((lv - 1) / ZONES_PER_ACT));
  }
  function zoneInAct(lv) { return ((lv - 1) % ZONES_PER_ACT) + 1; }
  function speciesFor(lv) { return SPECIES[actIndex(lv)]; }
  function isActFinale(lv) { return zoneInAct(lv) === ZONES_PER_ACT; }

  /* Per-zone rates are tuned to the act length: an act has to arrive
     somewhere by its last zone, so a shorter act needs steeper steps.
     Change ZONES_PER_ACT and these want rescaling with it. */
  function beastHp(lv) {
    var sp = speciesFor(lv);
    return Math.round(sp.hp * (1 + (zoneInAct(lv) - 1) * 0.11) * (1 + actIndex(lv) * 0.20));
  }
  function beastSpeed(lv) {
    var sp = speciesFor(lv);
    return Math.min(46, sp.speed * (1 + (zoneInAct(lv) - 1) * 0.055) * (1 + actIndex(lv) * 0.14));
  }
  function beastCount(lv) {
    /* one extra beast every four zones -- at a divisor of 10 a ten-zone
       act would never grow the herd at all */
    return Math.min(8, speciesFor(lv).count + Math.floor((zoneInAct(lv) - 1) / 4));
  }
  function shotSpeed(lv) {
    return 62 + (zoneInAct(lv) - 1) * 6 + actIndex(lv) * 10;
  }

  /* Each species shift also upgrades the Antimat cannon, so the player
     keeps pace with the rising hit points. */
  function weaponTier(lv) { return actIndex(lv) + 1; }
  function fireCooldown() { return Math.max(0.062, 0.11 - actIndex(level) * 0.008); }
  function bulletDamage() { return 1 + Math.floor(actIndex(level) / 2); }

  /* =================================================================
   * input
   * ================================================================= */
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyJ: 'fire',
    Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause', KeyM: 'mute', Escape: 'pause',
    KeyH: 'hints'
  };

  function onKeyDown(e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    Sound.unlock();
  }
  function onKeyUp(e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = false;
  }
  function tapped(k) { return !!pressed[k]; }

  /* =================================================================
   * helpers
   * ================================================================= */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pad(n, w) {
    var s = String(Math.floor(n));
    while (s.length < w) s = '0' + s;
    return s;
  }

  function addScore(n) {
    score += n;
    if (score > hiScore) hiScore = score;
    while (score >= nextExtraLife) {
      nextExtraLife += EXTRA_LIFE_EVERY;
      lives++;
      Sound.extraLife();
      floater(player.x + 8, player.y - 12, 'EXTRA SHIP', C.lightgreen, 2.2);
    }
  }

  function floater(x, y, text, col, life) {
    floaters.push({ x: x, y: y, text: text, col: col, life: life || 1.1, max: life || 1.1 });
  }

  function burst(x, y, count, speed, cols, size, life) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = rnd(speed * 0.2, speed);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rnd(0.25, life || 0.8), max: life || 0.8,
        col: cols[(Math.random() * cols.length) | 0],
        size: size || 2, grav: 40
      });
    }
  }

  /* =================================================================
   * level setup
   * ================================================================= */
  function makeBeast(i, n, lv) {
    var spread = n > 1 ? (i / (n - 1)) : 0;
    var x0 = 250 + spread * 700 + rnd(-40, 40);
    var hp = beastHp(lv);
    return {
      x: x0, feetY: GROUND_Y, groundY: GROUND_Y,
      hp: hp, maxHp: hp,
      speed: beastSpeed(lv) * rnd(0.88, 1.12),
      phase: Math.random() * Math.PI * 2,
      rear: 0, dying: false, flash: 0, deathTimer: 0,
      cooldown: rnd(0.8, 3.0),
      mouth: { x: x0 + 38, y: GROUND_Y - 58 },
      /* gait state */
      gaitTimer: rnd(1.5, 4), gaitActive: 0, gaitTell: 0, hopPhase: Math.random() * 6.28
    };
  }

  function startLevel(lv) {
    level = lv;
    if (lv > bestZone) bestZone = lv;
    beasts = [];
    var n = beastCount(lv);
    for (var i = 0; i < n; i++) beasts.push(makeBeast(i, n, lv));
    bullets = [];
    shots = [];
    particles = [];
    floaters = [];
    llama = null;
    boing = null;
    killBonus = 100;
    resetPlayer(true);
    state = 'intro';
    stateTime = 0;
  }

  function resetPlayer(hard) {
    if (!player || hard) {
      player = { x: 40, y: 90, vx: 0, vy: 0, facing: 1, cooldown: 0, invuln: RESPAWN_INVULN };
      camX = 0;
    } else {
      player.x = clamp(camX + 40, 0, WORLD_W - SHIP_W);
      player.y = 80;
      player.vx = 0; player.vy = 0;
      player.invuln = RESPAWN_INVULN;
      player.cooldown = 0;
    }
  }

  function newGame() {
    score = 0;
    lives = 3;
    won = false;
    nextExtraLife = EXTRA_LIFE_EVERY;
    player = null;
    startLevel(1);
    Sound.playMusic('game');
  }

  /* =================================================================
   * gaits -- how each species covers ground
   * ================================================================= */
  function gaitStep(b, sp, dt) {
    var mul = 1, lift = 0;
    b.gaitTimer -= dt;
    switch (sp.gait) {
      case 'prowl':                       /* cats: creep, then pounce */
        if (b.gaitActive > 0) {
          b.gaitActive -= dt;
          mul = 3.0;
        } else {
          mul = 0.75;
          if (b.gaitTimer <= 0) { b.gaitActive = 0.55; b.gaitTimer = rnd(2.0, 4.0); }
        }
        break;
      case 'trot':                        /* dogs: brisk and bouncy */
        mul = 1;
        lift = -Math.abs(Math.sin(b.phase * 1.6)) * 3;
        break;
      case 'lumber':                      /* pandas: slow, with pauses */
        if (b.gaitActive > 0) { b.gaitActive -= dt; mul = 0; }
        else {
          mul = 0.95;
          if (b.gaitTimer <= 0) { b.gaitActive = 0.9; b.gaitTimer = rnd(3.5, 6.0); }
        }
        break;
      case 'charge':                      /* elephants: telegraphed rushes */
        if (b.gaitActive > 0) { b.gaitActive -= dt; mul = 3.2; b.gaitTell = 0; }
        else if (b.gaitTimer <= 0.6) {
          mul = 0.35;
          b.gaitTell = 1;
          if (b.gaitTimer <= 0) { b.gaitActive = 1.0; b.gaitTimer = rnd(3.0, 5.0); }
        } else { mul = 0.6; b.gaitTell = 0; }
        break;
      case 'hop':                         /* sheep: bound, land, bound */
        b.hopPhase += dt * 3.4;
        var s = Math.sin(b.hopPhase);
        mul = Math.max(0, s) * 2.2;
        lift = -Math.max(0, s) * 12;
        break;
      default:
        mul = 1;
    }
    b.feetY = b.groundY + lift;
    return mul;
  }

  /* =================================================================
   * weapons -- one per species
   * ================================================================= */
  function fireWeapon(b, sp, lv) {
    var mx = b.mouth.x, my = b.mouth.y;
    var tx = player.x + SHIP_W / 2, ty = player.y + SHIP_H / 2;
    var dx = tx - mx, dy = ty - my;
    var d = Math.hypot(dx, dy) || 1;
    var v = shotSpeed(lv);

    function shot(o) {
      o.life = o.life || 5;
      o.grav = o.grav || 0;
      o.bounces = o.bounces || 0;
      o.homing = o.homing || 0;
      o.spin = Math.random() * 6.28;
      shots.push(o);
    }

    switch (sp.weapon) {
      case 'spit':
        shot({ kind: 'spit', x: mx, y: my, r: 4,
               vx: dx / d * v + rnd(-8, 8), vy: dy / d * v + rnd(-8, 8), grav: 22 });
        Sound.spit();
        break;

      case 'hairball':                    /* bounces off the ground */
        shot({ kind: 'hairball', x: mx, y: my, r: 5, bounces: 2,
               vx: dx / d * v * 0.95, vy: -Math.abs(v) * 0.35, grav: 150 });
        Sound.spit();
        break;

      case 'bark':                        /* flat, fast sonic ring */
        shot({ kind: 'bark', x: mx, y: my, r: 7, life: 3.2,
               vx: (dx < 0 ? -1 : 1) * v * 1.9, vy: dy / d * v * 0.25, grav: 0 });
        Sound.bark();
        break;

      case 'bamboo':                      /* high lob that shatters */
        shot({ kind: 'bamboo', x: mx, y: my, r: 5, shatter: true,
               vx: dx / d * v * 0.8, vy: -Math.abs(v) * 0.8, grav: 95 });
        Sound.spit();
        break;

      case 'spray':                       /* a fan of three */
        for (var k = -1; k <= 1; k++) {
          var a = Math.atan2(dy, dx) + k * 0.22;
          shot({ kind: 'spray', x: mx, y: my, r: 3,
                 vx: Math.cos(a) * v * 1.05, vy: Math.sin(a) * v * 1.05, grav: 45 });
        }
        Sound.spray();
        break;

      case 'bolt':                        /* fast, briefly seeking */
        shot({ kind: 'bolt', x: mx, y: my, r: 3, life: 3.4, homing: 0.7,
               vx: dx / d * v * 1.55, vy: dy / d * v * 1.55, grav: 0 });
        Sound.bolt();
        break;
    }
  }

  /* =================================================================
   * update -- ground assault
   * ================================================================= */
  function updatePlay(dt) {
    var sp = speciesFor(level);

    /* --- player --- */
    var ax = 0, ay = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    if (keys.up) ay -= 1;
    if (keys.down) ay += 1;
    if (ax) player.facing = ax;

    player.vx += ax * ACCEL * dt;
    player.vy += ay * ACCEL * dt;
    if (!ax) player.vx -= player.vx * Math.min(1, FRICTION * dt);
    if (!ay) player.vy -= player.vy * Math.min(1, FRICTION * dt);
    player.vx = clamp(player.vx, -MAX_VX, MAX_VX);
    player.vy = clamp(player.vy, -MAX_VY, MAX_VY);
    player.x = clamp(player.x + player.vx * dt, 0, WORLD_W - SHIP_W);
    player.y = clamp(player.y + player.vy * dt, FLY_TOP, FLY_BOTTOM);
    if (player.y === FLY_TOP || player.y === FLY_BOTTOM) player.vy = 0;
    if (player.invuln > 0) player.invuln -= dt;

    camX = clamp(player.x + SHIP_W / 2 - VW / 2, 0, WORLD_W - VW);

    /* --- firing --- */
    player.cooldown -= dt;
    if (keys.fire && player.cooldown <= 0 && bullets.length < MAX_BULLETS) {
      player.cooldown = fireCooldown();
      bullets.push({
        x: player.x + (player.facing > 0 ? SHIP_W : 0),
        y: player.y + 4, vx: BULLET_SPEED * player.facing, life: 1.6
      });
      Sound.shoot();
    }

    /* --- bullets --- */
    for (var i = bullets.length - 1; i >= 0; i--) {
      var bl = bullets[i];
      bl.x += bl.vx * dt;
      bl.life -= dt;
      if (bl.life <= 0 || bl.x < camX - 20 || bl.x > camX + VW + 20) {
        bullets.splice(i, 1);
        continue;
      }
      var consumed = false;
      for (var j = 0; j < beasts.length && !consumed; j++) {
        var bt = beasts[j];
        if (bt.dying) continue;
        var zone = Beasts.beastHit(bt, sp, bl.x, bl.y);
        if (!zone) continue;
        consumed = true;
        bullets.splice(i, 1);
        var dmg = bulletDamage() * (zone === 'weak' ? 2 : 1);
        bt.hp -= dmg;
        bt.flash = 0.06;
        addScore(dmg);                    /* one point per point of damage */
        if (zone === 'weak') {
          Sound.weakSpot();
          burst(bl.x, bl.y, 4, 60, [C.white, sp.accent, C.cyan], 2, 0.35);
        } else {
          Sound.hit();
          burst(bl.x, bl.y, 2, 45, [C.yellow, C.white], 1, 0.25);
        }
        if (bt.hp <= 0) destabilise(bt, sp);
      }
      if (!consumed && boing && !boing.dead &&
          Math.abs(bl.x - boing.x) < boing.r + 2 && Math.abs(bl.y - boing.y) < boing.r + 2) {
        consumed = true;
        bullets.splice(i, 1);
        boing.dead = true;
        addScore(2000);
        floater(boing.x - 10, boing.y - 18, '2000', C.lightred, 1.8);
        burst(boing.x, boing.y, 34, 150, [C.white, C.lightred, C.lightgrey], 2, 1.1);
        Sound.bonus();
        flash = 0.08; flashCol = C.white;
        raster = RASTER_TIME;
      }
      if (!consumed && llama && !llama.dead &&
          bl.x > llama.x && bl.x < llama.x + 18 &&
          bl.y > llama.feetY - 22 && bl.y < llama.feetY) {
        bullets.splice(i, 1);
        llama.dead = true;
        addScore(500);
        floater(llama.x, llama.feetY - 26, '500', C.lightgreen, 1.4);
        burst(llama.x + 8, llama.feetY - 10, 26, 110, CYCLE, 2, 0.9);
        Sound.llama();
        flash = 0.08; flashCol = C.lightgreen;
        /* VIC-20 easter egg: the grid sweeps the screen clean */
        gridSweep = 0.7;
        shots.length = 0;
        message = { text: 'GRID SWEEP', time: 1.2, col: C.lightgreen };
        Sound.gridSweep();
      }
    }

    /* --- beasts --- */
    var alive = 0;
    for (var k = beasts.length - 1; k >= 0; k--) {
      var b = beasts[k];
      if (b.flash > 0) b.flash -= dt;

      if (b.dying) {
        b.deathTimer -= dt;
        b.rear = Math.min(1, b.rear + dt * 2.2);
        b.phase += dt * 2;
        if (Math.random() < dt * 22) {
          burst(b.x + rnd(-32, 32), b.feetY - rnd(6, 60), 3, 70, CYCLE, 2, 0.7);
        }
        if (b.deathTimer <= 0) {
          burst(b.x, b.feetY - 30, 60, 190, CYCLE, 3, 1.3);
          shake = Math.max(shake, 7);
          flash = 0.09; flashCol = C.white;
          raster = RASTER_TIME;
          beasts.splice(k, 1);
        }
        continue;
      }

      alive++;
      var mul = gaitStep(b, sp, dt);
      b.x += b.speed * mul * dt;
      b.phase += dt * (1.4 + b.speed * mul * 0.06);

      if (b.x + Beasts.W * 0.6 > BASE_X) {
        beasts.splice(k, 1);
        breachBase();
        continue;
      }

      b.cooldown -= dt;
      if (Math.abs((player.x + 8) - b.x) < 210 && b.cooldown <= 0) {
        var range = sp.fireEvery;
        b.cooldown = rnd(range[0], range[1]) / (1 + (level - 1) * 0.036);
        fireWeapon(b, sp, level);
      }

      if (player.invuln <= 0 &&
          Beasts.beastHit(b, sp, player.x + SHIP_W / 2, player.y + SHIP_H / 2)) {
        killPlayer();
      }
    }

    updateShots(dt);

    /* --- Amiga easter egg: the Boing ball will not stop bouncing --- */
    if (!boing && Math.random() < dt * 0.022) {
      var right = Math.random() < 0.5;
      boing = {
        x: right ? camX + VW + 20 : camX - 20,
        y: FLY_TOP + 20,
        vx: (right ? -1 : 1) * rnd(48, 74),
        vy: 0, r: 9, spin: 0, dead: false
      };
    }
    if (boing) {
      boing.x += boing.vx * dt;
      boing.y += boing.vy * dt;
      boing.vy += 240 * dt;
      boing.spin += (boing.vx > 0 ? 1 : -1) * dt * 26;
      if (boing.y + boing.r >= GROUND_Y) {
        boing.y = GROUND_Y - boing.r;
        boing.vy = -Math.abs(boing.vy) * 0.86;
        if (Math.abs(boing.vy) < 60) boing.vy = -170;
        burst(boing.x, GROUND_Y, 5, 50, [C.white, C.lightred], 1, 0.3);
        Sound.boing();
      }
      if (boing.dead || boing.x < camX - 90 || boing.x > camX + VW + 90) boing = null;
    }

    /* --- bonus llama, the constant in a changing bestiary --- */
    if (!llama && Math.random() < dt * 0.06) {
      var fromLeft = Math.random() < 0.5;
      llama = {
        x: fromLeft ? camX - 30 : camX + VW + 30,
        feetY: GROUND_Y - 2,
        vx: (fromLeft ? 1 : -1) * rnd(55, 85),
        phase: 0, dead: false
      };
    }
    if (llama) {
      llama.x += llama.vx * dt;
      llama.phase += dt * 9;
      if (llama.dead || llama.x < camX - 80 || llama.x > camX + VW + 80) llama = null;
    }

    if (alive === 0 && beasts.length === 0) {
      state = 'warp';
      stateTime = 0;
      Sound.warp();
      Sound.stopMusic();
    }
  }

  function updateShots(dt) {
    for (var s = shots.length - 1; s >= 0; s--) {
      var o = shots[s];
      if (o.homing > 0) {
        o.homing -= dt;
        var hx = (player.x + SHIP_W / 2) - o.x, hy = (player.y + SHIP_H / 2) - o.y;
        var hd = Math.hypot(hx, hy) || 1;
        var spd = Math.hypot(o.vx, o.vy);
        o.vx += (hx / hd * spd - o.vx) * Math.min(1, dt * 2.4);
        o.vy += (hy / hd * spd - o.vy) * Math.min(1, dt * 2.4);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vy += o.grav * dt;
      o.spin += dt * 9;
      o.life -= dt;

      if (o.y >= GROUND_Y && o.kind !== 'bark') {
        if (o.bounces > 0) {
          o.bounces--;
          o.y = GROUND_Y - 1;
          o.vy = -Math.abs(o.vy) * 0.66;
          o.vx *= 0.9;
          burst(o.x, GROUND_Y, 4, 45, [C.grey, C.white], 1, 0.3);
        } else {
          if (o.shatter) {
            for (var f = 0; f < 3; f++) {
              shots.push({ kind: 'shard', x: o.x, y: GROUND_Y - 3, r: 2,
                           vx: rnd(-70, 70), vy: rnd(-90, -40), grav: 140,
                           life: 1.4, bounces: 0, homing: 0, spin: 0 });
            }
            Sound.hit();
          }
          burst(o.x, GROUND_Y, 6, 50, [C.orange, C.yellow], 1, 0.4);
          shots.splice(s, 1);
          continue;
        }
      }

      if (o.life <= 0 || o.x < camX - 60 || o.x > camX + VW + 60) {
        shots.splice(s, 1);
        continue;
      }

      if (player.invuln <= 0 &&
          o.x + o.r > player.x + 2 && o.x - o.r < player.x + SHIP_W - 2 &&
          o.y + o.r > player.y + 1 && o.y - o.r < player.y + SHIP_H - 1) {
        shots.splice(s, 1);
        killPlayer();
      }
    }
  }

  function destabilise(b, sp) {
    b.dying = true;
    b.deathTimer = 0.85;
    b.hp = 0;
    addScore(killBonus);
    floater(b.x - 16, b.feetY - 76, String(killBonus), C.lightgreen, 1.6);
    killBonus *= 2;
    Sound.beastDeath();
    shake = Math.max(shake, 4);
  }

  function breachBase() {
    Sound.playerDeath();
    shake = 10;
    flash = 0.14; flashCol = C.red;
    message = { text: 'BASE BREACHED', time: 1.8, col: C.lightred };
    loseLife();
  }

  function killPlayer() {
    if (player.invuln > 0) return;
    burst(player.x + 8, player.y + 4, 44, 150, [C.white, C.yellow, C.lightred, C.orange], 2, 1.1);
    Sound.playerDeath();
    shake = 8;
    flash = 0.1; flashCol = C.lightred;
    loseLife();
    if (lives > 0) { state = 'dying'; stateTime = 0; }
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      state = 'over';
      stateTime = 0;
      Sound.stopMusic();
      save();
    }
  }

  /* =================================================================
   * update -- hyperspace
   * ================================================================= */
  function startHyper() {
    state = 'hyper';
    stateTime = 0;
    /* the run before a species shift goes on longer and gets uglier */
    hyperLength = Math.min(22, 11 + level * 0.25) + (isActFinale(level) ? 6 : 0);
    hyperTimer = hyperLength;
    missiles = [];
    warpLines = [];
    for (var i = 0; i < 44; i++) {
      warpLines.push({ x: Math.random() * VW, y: rnd(HUD_H + 4, SCAN_Y - 4),
                       v: rnd(220, 560), len: rnd(5, 16) });
    }
    /* Atari easter egg: from act two, a shimmering neutral zone drifts
       through the corridor. Nothing gets through it -- including you,
       if you can find it and sit still. */
    neutral = actIndex(level) >= 1
      ? { x: 150, w: Math.max(16, 30 - actIndex(level) * 3), drift: rnd(0, 6.28) }
      : null;
    if (neutral) message = { text: 'NEUTRAL ZONE DETECTED', time: 2.6, col: C.cyan };
    player.x = 40; player.y = VH / 2;
    player.vx = 0; player.vy = 0;
    player.invuln = 1.0;
    particles = [];
    floaters = [];
    Sound.playMusic('game');
  }

  function updateHyper(dt) {
    hyperTimer -= dt;

    var ax = 0, ay = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    if (keys.up) ay -= 1;
    if (keys.down) ay += 1;
    if (ax) player.facing = ax;
    player.vx += ax * ACCEL * dt;
    player.vy += ay * ACCEL * dt;
    if (!ax) player.vx -= player.vx * Math.min(1, FRICTION * dt);
    if (!ay) player.vy -= player.vy * Math.min(1, FRICTION * dt);
    player.vx = clamp(player.vx, -MAX_VX, MAX_VX);
    player.vy = clamp(player.vy, -MAX_VY, MAX_VY);
    player.x = clamp(player.x + player.vx * dt, 4, VW - SHIP_W - 4);
    player.y = clamp(player.y + player.vy * dt, HUD_H + 4, VH - SHIP_H - 4);
    if (player.invuln > 0) player.invuln -= dt;

    for (var i = 0; i < warpLines.length; i++) {
      var w = warpLines[i];
      w.x -= w.v * dt;
      if (w.x < -30) { w.x = VW + rnd(0, 40); w.y = rnd(HUD_H + 4, SCAN_Y - 4); }
    }

    var rate = 1.6 + level * 0.18 + actIndex(level) * 0.5;
    if (Math.random() < dt * rate) {
      var fromRight = Math.random() < 0.82;
      var speed = (170 + level * 5 + actIndex(level) * 20) * rnd(0.85, 1.25);
      var m = {
        x: fromRight ? VW + 8 : -18,
        y: rnd(HUD_H + 8, SCAN_Y - 12),
        vx: fromRight ? -speed : speed,
        wave: Math.random() < 0.35 ? rnd(20, 55) : 0,
        phase: Math.random() * 6.28, y0: 0
      };
      m.y0 = m.y;
      missiles.push(m);
    }

    if (neutral) {
      neutral.drift += dt * 0.55;
      neutral.x = VW / 2 + Math.sin(neutral.drift) * 76;
    }

    for (var mi = missiles.length - 1; mi >= 0; mi--) {
      var ms = missiles[mi];
      ms.x += ms.vx * dt;
      ms.phase += dt * 5;
      ms.y = ms.y0 + Math.sin(ms.phase) * ms.wave;
      if (ms.x < -40 || ms.x > VW + 40) { missiles.splice(mi, 1); continue; }
      if (neutral && ms.x + 12 > neutral.x - neutral.w / 2 &&
          ms.x < neutral.x + neutral.w / 2) {
        burst(ms.x, ms.y + 2, 8, 70, CYCLE, 1, 0.4);
        missiles.splice(mi, 1);
        continue;
      }
      if (player.invuln <= 0 &&
          ms.x + 10 > player.x + 2 && ms.x < player.x + SHIP_W - 2 &&
          ms.y + 3 > player.y + 1 && ms.y < player.y + SHIP_H - 1) {
        missiles.splice(mi, 1);
        burst(player.x + 8, player.y + 4, 40, 150, [C.white, C.cyan, C.lightblue], 2, 1.0);
        Sound.playerDeath();
        shake = 8; flash = 0.1; flashCol = C.cyan;
        loseLife();
        if (lives > 0) player.invuln = 1.8;
      }
    }

    if (hyperTimer <= 0 && state === 'hyper') {
      addScore(1000 * level);
      Sound.bonus();
      state = 'hyperclear';
      stateTime = 0;
    }
  }

  /* =================================================================
   * shared fx
   * ================================================================= */
  function updateFx(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var f = floaters.length - 1; f >= 0; f--) {
      var fl = floaters[f];
      fl.y -= 16 * dt;
      fl.life -= dt;
      if (fl.life <= 0) floaters.splice(f, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    if (flash > 0) flash -= dt;
    if (raster > 0) raster -= dt;
    if (gridSweep > 0) gridSweep -= dt;
    if (message) {
      message.time -= dt;
      if (message.time <= 0) message = null;
    }
  }

  /* =================================================================
   * top-level update
   * ================================================================= */
  function advanceZone() {
    if (level >= MAX_LEVEL) {
      won = true;
      state = 'over';
      stateTime = 0;
      save();
      return;
    }
    if (isActFinale(level)) {
      /* the surprise: a whole new species takes the field */
      revealSp = speciesFor(level + 1);
      state = 'reveal';
      stateTime = 0;
      Sound.stopMusic();
      Sound.alarm();
      return;
    }
    startLevel(level + 1);
    Sound.playMusic('game');
  }

  function update(dt) {
    t += dt;
    stateTime += dt;

    if (tapped('mute')) {
      var m = Sound.toggleMute();
      message = { text: m ? 'SOUND OFF' : 'SOUND ON', time: 1.0, col: C.cyan };
    }

    if (state === 'boot') {
      /* any key drops you straight into the game, as it should */
      if (tapped('start') || tapped('fire') || tapped('hints') ||
          tapped('pause') || stateTime > BOOT_END) {
        state = 'title';
        stateTime = 0;
        Sound.playMusic('title');
      } else if (stateTime > 2.55 && stateTime - dt <= 2.55) {
        Sound.tapeLoad();
      }
      return;
    }

    if (state === 'title') {
      Sound.playMusic('title');
      scrollX += dt * 46;
      if (tapped('hints')) { state = 'hints'; stateTime = 0; hintTimer = 0; Sound.blip(); }
      else if (tapped('start') || tapped('fire')) newGame();
      updateFx(dt);
      return;
    }

    if (state === 'hints') {
      hintTimer += dt;
      if (tapped('hints') || tapped('start')) { state = 'title'; stateTime = 0; Sound.blip(); }
      if (tapped('left')) { hintPage--; hintTimer = 0; Sound.blip(); }
      if (tapped('right') || hintTimer > 7) { hintPage++; hintTimer = 0; }
      updateFx(dt);
      return;
    }

    if (state === 'over') {
      updateFx(dt);
      if (stateTime > 1.2 && (tapped('start') || tapped('fire'))) {
        state = 'title';
        stateTime = 0;
        Sound.playMusic('title');
      }
      return;
    }

    if (tapped('pause') && (state === 'play' || state === 'hyper')) {
      paused = !paused;
      Sound.blip();
    }
    if (paused) return;

    switch (state) {
      case 'intro':
        updateFx(dt);
        if (stateTime > 2.4) { state = 'play'; stateTime = 0; }
        break;
      case 'play':
        updatePlay(dt);
        updateFx(dt);
        break;
      case 'dying':
        updateFx(dt);
        if (stateTime > 1.6) { resetPlayer(false); state = 'play'; stateTime = 0; }
        break;
      case 'warp':
        updateFx(dt);
        if (stateTime > 1.5) startHyper();
        break;
      case 'hyper':
        updateHyper(dt);
        updateFx(dt);
        break;
      case 'hyperclear':
        updateFx(dt);
        if (stateTime > 2.0) advanceZone();
        break;
      case 'reveal':
        updateFx(dt);
        if (stateTime > 2.15 && stateTime - dt <= 2.15) Sound.revealRumble();
        if (stateTime > 4.75 && stateTime - dt <= 4.75) {
          Sound.revealHit();
          flash = 0.16; flashCol = C.white;
          shake = 9;
          raster = RASTER_TIME;
        }
        if (stateTime > 8.6) {
          startLevel(level + 1);
          Sound.playMusic('game');
        }
        break;
    }
  }

  /* =================================================================
   * rendering
   * ================================================================= */
  function drawHud() {
    Art.rect(ctx, 0, 0, VW, HUD_H, C.black);
    Art.rect(ctx, 0, HUD_H, VW, 1, C.darkgrey);
    Font.draw(ctx, 'SC ' + pad(score, 6), 3, 3, C.lightgreen, 1);
    Font.draw(ctx, 'HI ' + pad(hiScore, 6), 108, 3, C.yellow, 1);
    Font.draw(ctx, 'ZONE ' + pad(zoneInAct(level), 2), 212, 3, C.cyan, 1);
    for (var i = 0; i < Math.min(lives, 5); i++) {
      Art.rect(ctx, 268 + i * 10, 4, 7, 2, C.lightgrey);
      Art.rect(ctx, 270 + i * 10, 3, 3, 1, C.cyan);
    }
    if (lives > 5) Font.draw(ctx, '+' + (lives - 5), 318 - 12, 3, C.lightgrey, 1);
  }

  function drawScanner() {
    Art.rect(ctx, 0, SCAN_Y - 1, VW, 1, C.darkgrey);
    Art.rect(ctx, 0, SCAN_Y, VW, SCAN_H, C.black);
    var y = SCAN_Y + 7;
    var TRACK_X = 40, TRACK_W = VW - TRACK_X - 6;
    Art.rect(ctx, TRACK_X, y, TRACK_W, 1, C.darkgrey);
    var sx = function (wx) { return TRACK_X + clamp(wx / WORLD_W, 0, 1) * TRACK_W; };

    Art.rect(ctx, sx(BASE_X), y - 5, 3, 10, C.lightgreen);
    Art.rect(ctx, sx(camX), y - 4, 1, 8, C.grey);
    Art.rect(ctx, sx(camX + VW), y - 4, 1, 8, C.grey);
    for (var i = 0; i < beasts.length; i++) {
      var b = beasts[i];
      var hpF = Math.max(0, b.hp / b.maxHp);
      var col = b.dying ? C.white : Art.DAMAGE[Math.min(Art.DAMAGE.length - 1,
        Math.floor((1 - hpF) * Art.DAMAGE.length))];
      Art.rect(ctx, sx(b.x) - 1, y - 3, 3, 6, col);
    }
    if (player) Art.rect(ctx, sx(player.x) - 1, y - 2, 3, 4, C.white);
    Font.draw(ctx, 'SCAN', 6, SCAN_Y + 4, C.grey, 1);
  }

  /* Particles live in world space on the ground, screen space in warp. */
  function camXOffset() {
    return (state === 'hyper' || state === 'hyperclear') ? 0 : camX;
  }

  function drawFx() {
    var off = camXOffset();
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var s = p.life / p.max > 0.4 ? p.size : Math.max(1, p.size - 1);
      Art.rect(ctx, p.x - off, p.y, s, s, p.col);
    }
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      if (Math.floor(fl.life * 20) % 2 === 0 || fl.life > 0.4) {
        Font.draw(ctx, fl.text, fl.x - off, fl.y, fl.col, 1);
      }
    }
  }

  function drawShot(o) {
    var x = o.x - camX, y = o.y;
    var col = CYCLE[(Math.floor(t * 22) + Math.floor(o.spin)) % CYCLE.length];
    switch (o.kind) {
      case 'spit':
        Art.rect(ctx, x - 4, y - 3, 8, 6, C.black);
        Art.rect(ctx, x - 3, y - 4, 6, 8, C.black);
        Art.rect(ctx, x - 3, y - 2, 6, 4, col);
        Art.rect(ctx, x - 2, y - 3, 4, 6, col);
        Art.rect(ctx, x - 1, y - 1, 2, 2, C.white);
        break;
      case 'hairball':
        Art.rect(ctx, x - 5, y - 5, 10, 10, C.black);
        Art.rect(ctx, x - 4, y - 4, 8, 8, C.grey);
        Art.rect(ctx, x - 3, y - 3, 6, 6, C.lightgrey);
        /* stray tufts */
        Art.rect(ctx, x - 6 + (Math.floor(o.spin) % 3), y - 1, 2, 1, C.grey);
        Art.rect(ctx, x + 4, y - 3 + (Math.floor(o.spin * 1.7) % 4), 2, 1, C.grey);
        break;
      case 'bark':
        for (var r = 0; r < 3; r++) {
          var h = 12 - r * 3;
          var bx = x + (o.vx > 0 ? -r * 4 : r * 4);
          Art.rect(ctx, bx - 1, y - h / 2 - 1, 4, h + 2, C.black);
          Art.rect(ctx, bx, y - h / 2, 2, h, r === 0 ? C.white : col);
        }
        break;
      case 'bamboo':
        var vert = Math.sin(o.spin) > 0;
        var w = vert ? 4 : 14, hh = vert ? 14 : 4;
        Art.rect(ctx, x - w / 2 - 1, y - hh / 2 - 1, w + 2, hh + 2, C.black);
        Art.rect(ctx, x - w / 2, y - hh / 2, w, hh, C.green);
        Art.rect(ctx, x - w / 2, y - hh / 2 + (vert ? 5 : 0), vert ? w : 2, vert ? 1 : hh, C.lightgreen);
        break;
      case 'spray':
        Art.rect(ctx, x - 3, y - 3, 6, 6, C.black);
        Art.rect(ctx, x - 2, y - 2, 4, 4, C.cyan);
        Art.rect(ctx, x - 1, y - 1, 2, 2, C.white);
        break;
      case 'bolt':
        Art.rect(ctx, x - 4, y - 4, 8, 8, C.black);
        Art.rect(ctx, x - 3, y - 1, 3, 2, C.white);
        Art.rect(ctx, x, y - 3, 2, 3, C.yellow);
        Art.rect(ctx, x, y + 1, 3, 2, C.white);
        Art.rect(ctx, x - 1, y - 1, 2, 2, col);
        break;
      case 'shard':
        Art.rect(ctx, x - 2, y - 2, 4, 4, C.black);
        Art.rect(ctx, x - 1, y - 1, 3, 3, C.lightgreen);
        break;
    }
  }

  function drawPlay() {
    var sp = speciesFor(level);
    Art.rect(ctx, 0, 0, VW, VH, sp.biome.sky);
    Art.drawStars(ctx, stars, camX, t);
    Art.drawTerrain(ctx, camX, GROUND_Y, level, t, sp.biome);

    if (BASE_X - camX < VW + 60) Art.drawBase(ctx, BASE_X - camX, GROUND_Y, t);
    if (llama) Art.drawLlama(ctx, llama.x - camX, llama.feetY, llama.phase, t);
    if (boing) {
      var bx = boing.x - camX;
      var drop = clamp(1 - (GROUND_Y - boing.y) / 120, 0.25, 1);
      Art.rect(ctx, bx - 8 * drop, GROUND_Y + 1, 16 * drop, 2, C.black);
      Art.drawBoing(ctx, bx, boing.y, boing.r, boing.spin);
    }

    for (var i = 0; i < beasts.length; i++) {
      var b = beasts[i];
      var screenX = b.x - camX;
      if (screenX < -Beasts.W - 20 || screenX > VW + Beasts.W + 20) {
        b.mouth.x = b.x + 40;
        b.mouth.y = b.feetY - 50;
        continue;
      }
      var shim = {
        x: screenX, feetY: b.feetY, hp: b.hp, maxHp: b.maxHp,
        phase: b.phase, rear: b.rear, dying: b.dying, flash: b.flash,
        mouth: { x: 0, y: 0 }
      };
      Beasts.drawBeast(ctx, shim, t, sp);
      b.mouth.x = shim.mouth.x + camX;
      b.mouth.y = shim.mouth.y;

      /* charge telegraph */
      if (b.gaitTell && Math.floor(t * 14) % 2 === 0) {
        Art.rect(ctx, screenX - 20, b.feetY - Beasts.H - 14, 40, 3, C.lightred);
      }
      if (!b.dying && b.hp < b.maxHp) {
        var w = 34;
        Art.rect(ctx, screenX - w / 2, b.feetY - Beasts.H - 8, w, 2, C.darkgrey);
        Art.rect(ctx, screenX - w / 2, b.feetY - Beasts.H - 8, w * (b.hp / b.maxHp), 2, C.lightred);
      }
    }

    for (var bi = 0; bi < bullets.length; bi++) {
      var bul = bullets[bi];
      Art.rect(ctx, bul.x - camX, bul.y, 4, 2, TRACER[(Math.floor(t * 40) + bi) % TRACER.length]);
    }
    for (var s = 0; s < shots.length; s++) drawShot(shots[s]);

    drawFx();

    if (state !== 'dying' && player) {
      var blink = player.invuln > 0 && Math.floor(t * 20) % 2 === 0;
      if (!blink) Art.drawShip(ctx, player.x - camX, player.y, player.facing, t, false);
    }

    drawHud();
    drawScanner();
  }

  function drawHyper() {
    Art.rect(ctx, 0, 0, VW, VH, C.black);
    var DIM = [C.darkgrey, C.blue, C.grey, C.purple];
    for (var i = 0; i < warpLines.length; i++) {
      var w = warpLines[i];
      Art.rect(ctx, w.x, w.y, w.len, 1, DIM[i % DIM.length]);
    }
    for (var b = 0; b < 3; b++) {
      var y = 46 + b * 46 + Math.sin(t * 1.6 + b * 2) * 9;
      ctx.globalAlpha = 0.35;
      Art.rect(ctx, 0, y, VW, 1, CYCLE[(b + Math.floor(t * 4)) % CYCLE.length]);
      ctx.globalAlpha = 1;
    }
    /* the neutral zone: a column of pure shimmer, redrawn every frame */
    if (neutral) {
      var nx = Math.round(neutral.x - neutral.w / 2);
      Art.rect(ctx, nx - 1, HUD_H + 2, 1, SCAN_Y - HUD_H - 4, C.darkgrey);
      Art.rect(ctx, nx + neutral.w, HUD_H + 2, 1, SCAN_Y - HUD_H - 4, C.darkgrey);
      for (var q = 0; q < 420; q++) {
        Art.rect(ctx, nx + Math.random() * neutral.w,
                 HUD_H + 3 + Math.random() * (SCAN_Y - HUD_H - 6), 1, 2,
                 CYCLE[(Math.random() * CYCLE.length) | 0]);
      }
    }

    for (var m = 0; m < missiles.length; m++) {
      var mi = missiles[m];
      var dir = mi.vx > 0 ? 1 : -1;
      var nose = dir > 0 ? mi.x + 12 : mi.x - 3;
      var tail = dir > 0 ? mi.x - 8 : mi.x + 12;
      Art.rect(ctx, tail, mi.y + 1, 8, 2, TRACER[(m + Math.floor(t * 30)) % TRACER.length]);
      Art.rect(ctx, mi.x - 1, mi.y - 1, 14, 6, C.black);
      Art.rect(ctx, mi.x, mi.y, 12, 4, C.white);
      Art.rect(ctx, mi.x + (dir > 0 ? 8 : 0), mi.y, 4, 4, C.lightred);
      Art.rect(ctx, nose, mi.y + 1, 3, 2, C.red);
    }
    drawFx();
    if (player) {
      var blink = player.invuln > 0 && Math.floor(t * 20) % 2 === 0;
      if (!blink) Art.drawShip(ctx, player.x, player.y, player.facing, t, false);
    }
    drawHud();

    var frac = clamp(hyperTimer / hyperLength, 0, 1);
    Art.rect(ctx, 0, SCAN_Y - 1, VW, SCAN_H + 1, C.black);
    Font.center(ctx, 'HYPERSPACE  ' + Math.ceil(Math.max(0, hyperTimer)),
                VW / 2, SCAN_Y, C.white, 1);
    Art.rect(ctx, 4, SCAN_Y + 9, VW - 8, 4, C.darkgrey);
    Art.rect(ctx, 4, SCAN_Y + 9, (VW - 8) * frac, 4, C.cyan);
  }

  /* ---- the species-shift reveal ------------------------------------
   * Three beats: the signal breaks up, a silhouette comes out of the
   * dark, then the thing lights up and tells you what it is.
   */
  function drawReveal() {
    var s = stateTime;
    Art.rect(ctx, 0, 0, VW, VH, C.black);

    /* beat one: interference */
    if (s < 2.6) {
      var n = Math.floor(clamp(2.6 - s, 0, 2.6) * 12);
      for (var i = 0; i < n; i++) {
        Art.rect(ctx, 0, Math.random() * VH, VW, 1 + Math.random() * 3,
                 [C.darkgrey, C.grey, C.lightgrey, C.white][(Math.random() * 4) | 0]);
      }
    }
    if (s < 2.4) {
      if (Math.floor(s * 5) % 2 === 0) {
        Font.center(ctx, 'WARNING', VW / 2, 62, C.lightred, 3);
      }
      Font.center(ctx, 'BIOSIGN SHIFT DETECTED', VW / 2, 96, C.white, 1);
      Font.center(ctx, 'THE HERD IS NOT THE HERD', VW / 2, 110, C.grey, 1);
      return;
    }

    /* beat two and three: the shape */
    var lit = s > 4.75;
    var dark = clamp((s - 2.4) / 2.35, 0, 1);
    var shades = ['#0d0d0d', '#1a1a1a', C.darkgrey, C.grey];
    var mock = {
      x: VW / 2, feetY: 166, hp: 1, maxHp: 1,
      phase: t * 3, rear: 0, dying: false, flash: 0, mouth: { x: 0, y: 0 },
      silhouette: lit ? null : shades[Math.min(shades.length - 1, Math.floor(dark * shades.length))]
    };
    Beasts.drawBeast(ctx, mock, t, revealSp, 5);

    /* a scan sweep crawling down the silhouette */
    if (!lit) {
      var sy = 40 + ((s - 2.4) * 60) % 150;
      Art.rect(ctx, 0, sy, VW, 1, C.cyan);
    }

    if (lit) {
      var c1 = CYCLE[Math.floor(t * 10) % CYCLE.length];
      Font.centerShadow(ctx, revealSp.name, VW / 2, 20, c1, C.black, 2);
      Font.center(ctx, revealSp.reveal, VW / 2, 40, C.white, 1);
      if (s > 5.9) {
        Font.center(ctx, 'AIM FOR ' + revealSp.weakName, VW / 2, 174, revealSp.accent, 1);
      }
      if (s > 6.8 && Math.floor(t * 4) % 2 === 0) {
        Font.center(ctx, 'ANTIMAT CANNON  TIER ' + weaponTier(level + 1),
                    VW / 2, 188, C.lightgreen, 1);
      }
    } else {
      Font.center(ctx, 'INBOUND', VW / 2, 20, C.grey, 1);
    }
  }

  /* ---- C64 tape-loader boot ------------------------------------------
   * A pastiche, not a copy: the machine, the byte count and the file
   * name are all this game's. The colour bars are the real memory.
   */
  var BOOT_END = 7.6;

  function drawBoot() {
    var s = stateTime;
    /* the famous blue-on-blue, straight out of the palette */
    var SCREEN = C.blue, BORDER = C.lightblue;

    /* the loader paints the whole raster while it reads the tape */
    if (s > 2.6 && s < 6.4) {
      for (var i = 0; i < 70; i++) {
        Art.rect(ctx, 0, Math.random() * VH, VW, 1 + Math.random() * 3,
                 CYCLE[(Math.random() * CYCLE.length) | 0]);
      }
      Art.rect(ctx, 30, 84, 260, 30, C.black);
      Font.center(ctx, s < 4.2 ? 'SEARCHING FOR AMA' : 'LOADING', VW / 2, 92, C.white, 1);
      Font.center(ctx, 'PRESS ANY KEY TO SKIP', VW / 2, 104, C.grey, 1);
      return;
    }

    Art.rect(ctx, 0, 0, VW, VH, BORDER);
    Art.rect(ctx, 16, 14, VW - 32, VH - 28, SCREEN);

    var L = 22, y = 22;
    function line(txt) { Font.draw(ctx, txt, L, y, BORDER, 1); y += 10; }

    if (s > 0.15) line('    **** AMA SYSTEM 64 BASIC V2 ****');
    if (s > 0.5) { y += 4; line(' 38911 MUTANT BYTES FREE'); }
    if (s > 0.9) { y += 4; line('READY.'); }

    if (s > 1.2) {
      /* the LOAD line types itself in */
      var cmd = 'LOAD "AMA",1,1';
      var shown = cmd.slice(0, Math.floor((s - 1.2) * 14));
      Font.draw(ctx, shown, L, y, BORDER, 1);
      if (Math.floor(s * 3) % 2 === 0 && s < 2.3) {
        Art.rect(ctx, L + Font.width(shown, 1) + 1, y - 1, 5, 8, BORDER);
      }
      y += 14;
    }
    if (s > 2.2) line('PRESS PLAY ON TAPE');

    if (s > 6.4) {
      y = 22;
      Art.rect(ctx, 16, 14, VW - 32, VH - 28, SCREEN);
      line('READY.');
      line('RUN');
      if (Math.floor(s * 6) % 2 === 0) Art.rect(ctx, L, y + 1, 5, 8, BORDER);
    }

    if (s < 2.6) Font.center(ctx, 'PRESS ANY KEY TO SKIP', VW / 2, VH - 26, C.purple, 1);
  }

  /* ---- the hint book -------------------------------------------------- */
  function wrap(text, cols) {
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var next = cur ? cur + ' ' + words[i] : words[i];
      if (next.length > cols && cur) { lines.push(cur); cur = words[i]; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawHints() {
    var list = Hints.HINTS;
    var h = list[((hintPage % list.length) + list.length) % list.length];
    var mach = Hints.MACHINES[h.m];

    Art.rect(ctx, 0, 0, VW, VH, C.black);
    Art.drawStars(ctx, stars, t * 8, t);

    Font.centerShadow(ctx, 'THE HINT BOOK', VW / 2, 8,
                      CYCLE[Math.floor(t * 8) % CYCLE.length], C.black, 2);
    Art.rect(ctx, 40, 26, 240, 1, C.darkgrey);

    mach.badge(ctx, VW / 2 - 20, 34);
    Font.center(ctx, mach.name, VW / 2, 66, mach.tint, 1);

    var lines = wrap(h.t, 46);
    for (var i = 0; i < lines.length; i++) {
      Font.center(ctx, lines[i], VW / 2, 86 + i * 11, C.white, 1);
    }

    if (h.here && Math.floor(t * 3) % 2 === 0) {
      Font.center(ctx, '> ALSO TRUE IN THIS GAME <', VW / 2, 138, C.lightgreen, 1);
    }

    /* page pips, grouped by machine */
    var per = 5;
    for (var p = 0; p < list.length; p++) {
      var on = p === (((hintPage % list.length) + list.length) % list.length);
      var gx = 68 + (p % per) * 8 + Math.floor(p / per) * 46;
      Art.rect(ctx, gx, 156, on ? 5 : 3, on ? 5 : 3,
               on ? C.white : Hints.MACHINES[list[p].m].tint);
    }

    Art.rect(ctx, 0, SCAN_Y, VW, SCAN_H, C.black);
    Font.center(ctx, '< AND > TURN THE PAGE      H OR ENTER CLOSES',
                VW / 2, SCAN_Y + 4, C.grey, 1);
  }

  /* ---- demoscene greets scroller --------------------------------------
   * One character at a time, each on its own sine offset, colours
   * cycling along the line. It would not be a title screen without it.
   */
  function drawScroller(baseY) {
    var txt = Hints.SCROLLER;
    var cw = Font.width('A', 1) + 1;
    var total = txt.length * cw;
    if (scrollX > total) scrollX -= total;
    var first = Math.floor(scrollX / cw) - 1;
    for (var i = first; i < first + VW / cw + 3; i++) {
      var idx = ((i % txt.length) + txt.length) % txt.length;
      var ch = txt.charAt(idx);
      if (ch === ' ') continue;
      var x = i * cw - scrollX;
      var y = baseY + Math.sin(t * 3.4 + i * 0.42) * 3;
      Font.draw(ctx, ch, x, y, CYCLE[(i + Math.floor(t * 12)) % CYCLE.length], 1);
    }
  }

  function drawTitle() {
    Art.rect(ctx, 0, 0, VW, VH, C.black);
    Art.drawStars(ctx, stars, t * 22, t);
    Art.drawTerrain(ctx, t * 18, GROUND_Y, 1, t, SPECIES[0].biome);

    /* attract mode: one camel plods past, and only ever a camel --
       the rest of the bestiary is a surprise the player earns */
    var demo = {
      x: ((t * 26) % (VW + 200)) - 100,
      feetY: GROUND_Y, hp: 20, maxHp: 26,
      phase: t * 4, rear: 0, dying: false, flash: 0, mouth: { x: 0, y: 0 }
    };
    /* drawn at two thirds scale so it stays clear of the text above it */
    Beasts.drawBeast(ctx, demo, t, SPECIES[0], 2);

    var c1 = CYCLE[Math.floor(t * 8) % CYCLE.length];
    var c2 = CYCLE[(Math.floor(t * 8) + 3) % CYCLE.length];
    Font.centerShadow(ctx, 'ATTACK OF THE', VW / 2, 10, c2, C.black, 2);
    Font.centerShadow(ctx, 'MUTANT', VW / 2, 24, c1, C.black, 4);
    Font.centerShadow(ctx, 'ANIMALS', VW / 2, 54, c1, C.black, 4);
    Font.centerShadow(ctx, 'A M A   -   AFTER LLAMASOFT 1983', VW / 2, 86, C.grey, C.black, 1);
    Font.centerShadow(ctx, 'HI SCORE ' + pad(hiScore, 6), VW / 2, 98, C.lightgreen, C.black, 1);
    if (Math.floor(t * 2) % 2 === 0) {
      Font.centerShadow(ctx, 'PRESS ENTER TO DEFEND THE BASE', VW / 2, 112, C.white, C.black, 1);
    }

    Font.centerShadow(ctx, 'ARROWS / WASD - FLY   SPACE - FIRE   H - HINTS',
                      VW / 2, 124, C.cyan, C.black, 1);

    Art.rect(ctx, 0, SCAN_Y, VW, SCAN_H, C.black);
    Art.rect(ctx, 0, SCAN_Y - 1, VW, 1, C.darkgrey);
    drawScroller(SCAN_Y + 4);
  }

  function drawOverlays() {
    var sp = speciesFor(level);
    if (state === 'intro') {
      var boxY = 66;
      Art.rect(ctx, 26, boxY, 268, 60, C.black);
      Art.rect(ctx, 26, boxY, 268, 1, C.cyan);
      Art.rect(ctx, 26, boxY + 59, 268, 1, C.cyan);
      Font.center(ctx, 'ZONE ' + pad(zoneInAct(level), 2), VW / 2, boxY + 8,
                  CYCLE[Math.floor(t * 10) % CYCLE.length], 2);
      Font.center(ctx, beastCount(level) + ' ' + sp.name + ' INBOUND', VW / 2, boxY + 28, C.white, 1);
      Font.center(ctx, 'AIM FOR ' + sp.weakName, VW / 2, boxY + 40, sp.accent, 1);
      Font.center(ctx, 'HOLD THE LINE', VW / 2, boxY + 50, C.yellow, 1);
    }
    if (state === 'warp') {
      var a = Math.min(1, stateTime / 1.5);
      for (var i = 0; i < 26 * a; i++) {
        Art.rect(ctx, 0, Math.random() * VH, VW, 1 + Math.random() * 2,
                 CYCLE[(i + Math.floor(t * 30)) % CYCLE.length]);
      }
      Font.center(ctx, 'ZONE CLEAR', VW / 2, 70, C.white, 2);
      Font.center(ctx, isActFinale(level) ? 'WARP SIGNAL DEGRADING' : 'ENTERING HYPERSPACE',
                  VW / 2, 96, C.cyan, 1);
      Font.center(ctx, 'DODGE THE MISSILES', VW / 2, 108, C.yellow, 1);
    }
    if (state === 'hyperclear') {
      Font.center(ctx, 'WARP SURVIVED', VW / 2, 80,
                  CYCLE[Math.floor(t * 12) % CYCLE.length], 2);
      Font.center(ctx, 'BONUS ' + (1000 * level), VW / 2, 102, C.lightgreen, 1);
    }
    if (state === 'dying') {
      Font.center(ctx, 'SHIP LOST', VW / 2, 88, C.lightred, 2);
      Font.center(ctx, lives + ' REMAINING', VW / 2, 108, C.white, 1);
    }
    if (state === 'over') {
      Art.rect(ctx, 0, 0, VW, VH, C.black);
      Art.drawStars(ctx, stars, t * 14, t);
      Font.center(ctx, won ? 'BASE SAVED' : 'GAME OVER', VW / 2, 46,
                  CYCLE[Math.floor(t * 6) % CYCLE.length], 3);
      if (won) Font.center(ctx, 'EVERY SPECIES REPELLED', VW / 2, 70, C.lightgreen, 1);
      Font.center(ctx, 'SCORE ' + pad(score, 6), VW / 2, 88, C.white, 1);
      Font.center(ctx, 'HI    ' + pad(hiScore, 6), VW / 2, 100, C.yellow, 1);
      Font.center(ctx, 'ZONES CLEARED ' + pad(won ? level : Math.max(0, level - 1), 3),
                  VW / 2, 112, C.cyan, 1);
      Font.center(ctx, 'LAST SEEN  ' + sp.name, VW / 2, 124, C.lightgrey, 1);
      if (stateTime > 1.2 && Math.floor(t * 2) % 2 === 0) {
        Font.center(ctx, 'PRESS ENTER', VW / 2, 146, C.lightgreen, 1);
      }
    }
    if (paused) {
      Art.rect(ctx, 100, 86, 120, 26, C.black);
      Art.rect(ctx, 100, 86, 120, 1, C.white);
      Art.rect(ctx, 100, 111, 120, 1, C.white);
      Font.center(ctx, 'PAUSED', VW / 2, 94, C.white, 2);
    }
    if (message) {
      Font.centerShadow(ctx, message.text, VW / 2, 60, message.col, C.black, 1);
    }
  }

  /* C64 rasterbars -- a band of colour sweeping the raster, the oldest
     flourish in the book. */
  function drawRaster() {
    if (raster <= 0) return;
    var p = 1 - raster / RASTER_TIME;
    ctx.globalAlpha = 0.18 + 0.42 * (raster / RASTER_TIME);
    for (var i = 0; i < 9; i++) {
      Art.rect(ctx, 0, p * (VH + 70) - 70 + i * 8, VW, 7,
               CYCLE[(i + Math.floor(t * 20)) % CYCLE.length]);
    }
    ctx.globalAlpha = 1;
  }

  /* VIC-20 Gridrunner: the grid slams across and takes the shots with it. */
  function drawGridSweep() {
    if (gridSweep <= 0) return;
    var p = 1 - gridSweep / 0.7;
    ctx.globalAlpha = 0.25 + 0.5 * (gridSweep / 0.7);
    var col = CYCLE[Math.floor(t * 26) % CYCLE.length];
    var step = 16, off = Math.floor(p * step);
    for (var x = -off; x < VW; x += step) Art.rect(ctx, x, HUD_H, 1, SCAN_Y - HUD_H, col);
    for (var y = HUD_H + off; y < SCAN_Y; y += step) Art.rect(ctx, 0, y, VW, 1, col);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (state === 'boot') drawBoot();
    else if (state === 'title') drawTitle();
    else if (state === 'hints') drawHints();
    else if (state === 'reveal') drawReveal();
    else if (state === 'hyper' || state === 'hyperclear') drawHyper();
    else if (state === 'over') Art.rect(ctx, 0, 0, VW, VH, C.black);
    else drawPlay();

    if (state !== 'reveal' && state !== 'boot' && state !== 'hints') drawOverlays();

    drawGridSweep();
    drawRaster();

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.75, flash * 5);
      Art.rect(ctx, 0, 0, VW, VH, flashCol);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* =================================================================
   * persistence, boot, loop
   * ================================================================= */
  function save() {
    try {
      localStorage.setItem('ama.hiscore', String(hiScore));
      localStorage.setItem('ama.bestzone', String(bestZone));
    } catch (e) {}
  }

  function load() {
    try {
      var v = parseInt(localStorage.getItem('ama.hiscore'), 10);
      if (!isNaN(v)) hiScore = v;
      var z = parseInt(localStorage.getItem('ama.bestzone'), 10);
      if (!isNaN(z)) bestZone = z;
    } catch (e) {}
  }

  function resize() {
    var padY = 46;
    var sx = (global.innerWidth - 16) / VW;
    var sy = (global.innerHeight - padY) / VH;
    var s = Math.max(1, Math.floor(Math.min(sx, sy)));
    canvas.style.width = (VW * s) + 'px';
    canvas.style.height = (VH * s) + 'px';
  }

  var last = 0;
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    update(dt);
    render();
    pressed = {};
    requestAnimationFrame(frame);
  }

  function boot() {
    canvas = document.getElementById('screen');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    load();
    beasts = []; bullets = []; shots = [];
    particles = []; floaters = []; missiles = []; warpLines = [];
    player = { x: 40, y: 90, vx: 0, vy: 0, facing: 1, cooldown: 0, invuln: 0 };
    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('resize', resize);
    global.addEventListener('blur', function () { keys = {}; });
    resize();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* exposed for debugging from the console */
  global.AMA = {
    state: function () { return state; },
    debug: function () {
      return {
        state: state, score: score, lives: lives, level: level,
        act: actIndex(level), species: speciesFor(level).id,
        zone: zoneInAct(level), beasts: beasts.length,
        hp: beasts.map(function (b) { return b.hp; }),
        playerX: Math.round(player.x), playerY: Math.round(player.y)
      };
    },
    skip: function () { beasts.length = 0; },
    endWarp: function () { hyperTimer = 0.05; },
    boot: function () { state = 'boot'; stateTime = 0; },
    egg: function (which) {
      if (which === 'boing') {
        boing = { x: player.x + 70, y: FLY_TOP + 20, vx: -20, vy: 0,
                  r: 9, spin: 0, dead: false };
      } else if (which === 'llama') {
        llama = { x: player.x + 60, feetY: GROUND_Y - 2, vx: -10, phase: 0, dead: false };
      }
    },
    hints: function (n) { state = 'hints'; hintPage = n || 0; hintTimer = 0; },
    setLevel: function (n) { startLevel(n); Sound.playMusic('game'); },
    pushToBase: function () {
      if (beasts[0]) { beasts[0].x = BASE_X - 30; player.x = BASE_X - 240; }
    }
  };
})(window);
