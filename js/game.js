/* ------------------------------------------------------------------
 * game.js -- MUTANT CAMEL WARP
 * A keyboard-driven homage to Llamasoft's "Attack of the Mutant
 * Camels" (Jeff Minter, 1983). 320x200 internal resolution, C64
 * palette, no assets, no dependencies.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var C = Art.C;
  var CYCLE = Art.CYCLE;
  /* Bright subset of the palette -- used for anything that must read
     instantly against the mountains. */
  var TRACER = [C.white, C.yellow, C.cyan, C.lightgreen];

  /* ---- fixed geometry ---------------------------------------------- */
  var VW = 320, VH = 200;
  var HUD_H = 12;
  var SCAN_Y = 186, SCAN_H = 14;
  var GROUND_Y = 172;              /* where camel feet and player floor meet */
  var SKY_TOP = HUD_H + 2;
  var FLY_TOP = SKY_TOP + 2;
  var FLY_BOTTOM = GROUND_Y - 10;
  var WORLD_W = 1680;
  var BASE_X = WORLD_W - 40;
  var MAX_LEVEL = 30;

  /* ---- tunables ----------------------------------------------------- */
  var SHIP_W = 16, SHIP_H = 8;
  var ACCEL = 900, FRICTION = 6.5, MAX_VX = 128, MAX_VY = 104;
  var BULLET_SPEED = 300, FIRE_COOLDOWN = 0.11, MAX_BULLETS = 6;
  var RESPAWN_INVULN = 2.2;
  var EXTRA_LIFE_EVERY = 15000;

  /* ---- runtime ------------------------------------------------------ */
  var canvas, ctx;
  var keys = {}, pressed = {};
  var state = 'title';
  var stateTime = 0;
  var t = 0;
  var paused = false;

  var score = 0, hiScore = 0, lives = 3, level = 1;
  var nextExtraLife = EXTRA_LIFE_EVERY;
  var camelBonus = 100;
  var shake = 0, flash = 0, flashCol = C.white;

  var player, camels, bullets, spits, particles, floaters, llama;
  var missiles, warpLines;
  var stars = Art.makeStars(70, 340, GROUND_Y - 20, 4242);
  var camX = 0;
  var hyperTimer = 0, hyperLength = 0;
  var message = null;
  var won = false;

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
    KeyP: 'pause', KeyM: 'mute', Escape: 'pause'
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
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rnd(0.25, life || 0.8), max: life || 0.8,
        col: cols[(Math.random() * cols.length) | 0],
        size: size || 2, grav: 40
      });
    }
  }

  /* =================================================================
   * level setup
   * ================================================================= */
  function camelCount(lv) { return Math.min(8, 4 + Math.floor((lv - 1) / 4)); }
  function camelSpeed(lv) { return 11 + (lv - 1) * 1.1; }
  function camelHp(lv) { return 50 + (lv - 1) * 5; }
  function spitSpeed(lv) { return 62 + (lv - 1) * 4.5; }

  function makeCamel(i, n, lv) {
    /* Spread the herd along the first two thirds of the world so the
       whole column is reachable, with the leaders already closing on
       the base. */
    var spread = n > 1 ? (i / (n - 1)) : 0;
    var x0 = 250 + spread * 700 + rnd(-40, 40);
    return {
      x: x0,
      feetY: GROUND_Y,
      hp: camelHp(lv), maxHp: camelHp(lv),
      speed: camelSpeed(lv) * rnd(0.85, 1.15),
      phase: Math.random() * Math.PI * 2,
      rear: 0, dying: false, dead: false, flash: 0,
      cooldown: rnd(0.8, 3.0),
      mouth: { x: x0 + 38, y: GROUND_Y - 58 },
      deathTimer: 0
    };
  }

  function startLevel(lv) {
    level = lv;
    camels = [];
    var n = camelCount(lv);
    for (var i = 0; i < n; i++) camels.push(makeCamel(i, n, lv));
    bullets = [];
    spits = [];
    particles = [];
    floaters = [];
    llama = null;
    camelBonus = 100;
    resetPlayer(true);
    state = 'intro';
    stateTime = 0;
  }

  function resetPlayer(hard) {
    if (!player || hard) {
      player = { x: 40, y: 90, vx: 0, vy: 0, facing: 1, cooldown: 0, invuln: RESPAWN_INVULN };
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
   * update -- ground assault
   * ================================================================= */
  function updatePlay(dt) {
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

    /* --- camera --- */
    camX = clamp(player.x + SHIP_W / 2 - VW / 2, 0, WORLD_W - VW);

    /* --- firing --- */
    player.cooldown -= dt;
    if (keys.fire && player.cooldown <= 0 && bullets.length < MAX_BULLETS) {
      player.cooldown = FIRE_COOLDOWN;
      bullets.push({
        x: player.x + (player.facing > 0 ? SHIP_W : 0),
        y: player.y + 4,
        vx: BULLET_SPEED * player.facing,
        life: 1.6
      });
      Sound.shoot();
    }

    /* --- bullets --- */
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < camX - 20 || b.x > camX + VW + 20) {
        bullets.splice(i, 1);
        continue;
      }
      var consumed = false;
      for (var j = 0; j < camels.length && !consumed; j++) {
        var cm = camels[j];
        if (cm.dead || cm.dying) continue;
        var zone = Art.camelHit(cm, b.x, b.y);
        if (!zone) continue;
        consumed = true;
        bullets.splice(i, 1);
        var dmg = zone === 'hump' ? 2 : zone === 'neck' ? 1 : 1;
        cm.hp -= dmg;
        cm.flash = 0.06;
        addScore(dmg);           /* one point per hit, as per 1983 */
        if (zone === 'hump') {
          Sound.weakSpot();
          burst(b.x, b.y, 4, 60, [C.white, C.lightgreen, C.cyan], 2, 0.35);
        } else {
          Sound.hit();
          burst(b.x, b.y, 2, 45, [C.yellow, C.white], 1, 0.25);
        }
        if (cm.hp <= 0) destabilise(cm);
      }
      /* the bonus llama is worth stopping for */
      if (!consumed && llama && !llama.dead &&
          b.x > llama.x && b.x < llama.x + 18 &&
          b.y > llama.feetY - 22 && b.y < llama.feetY) {
        bullets.splice(i, 1);
        llama.dead = true;
        addScore(500);
        floater(llama.x, llama.feetY - 26, '500', C.lightgreen, 1.4);
        burst(llama.x + 8, llama.feetY - 10, 26, 110, CYCLE, 2, 0.9);
        Sound.llama();
        flash = 0.08; flashCol = C.lightgreen;
      }
    }

    /* --- camels --- */
    var alive = 0;
    for (var k = camels.length - 1; k >= 0; k--) {
      var c = camels[k];
      if (c.flash > 0) c.flash -= dt;

      if (c.dying) {
        c.deathTimer -= dt;
        c.rear = Math.min(1, c.rear + dt * 2.2);
        c.phase += dt * 2;
        if (Math.random() < dt * 22) {
          burst(c.x + rnd(-26, 26), c.feetY - rnd(6, 44), 3, 70, CYCLE, 2, 0.7);
        }
        if (c.deathTimer <= 0) {
          burst(c.x, c.feetY - 24, 60, 190, CYCLE, 3, 1.3);
          shake = Math.max(shake, 7);
          flash = 0.09; flashCol = C.white;
          camels.splice(k, 1);
        }
        continue;
      }

      alive++;
      c.x += c.speed * dt;
      c.phase += dt * (1.4 + c.speed * 0.06);

      /* reached the home base -- that costs you a ship */
      if (c.x + Art.CAMEL_W * 0.6 > BASE_X) {
        camels.splice(k, 1);
        breachBase();
        continue;
      }

      /* spit fireballs when the player is in range */
      c.cooldown -= dt;
      var near = Math.abs((player.x + 8) - c.x) < 200;
      if (near && c.cooldown <= 0 && !c.dying) {
        c.cooldown = rnd(1.0, 2.4) / (1 + (level - 1) * 0.05);
        var mx = c.mouth.x, my = c.mouth.y;
        var dx = (player.x + SHIP_W / 2) - mx, dy = (player.y + SHIP_H / 2) - my;
        var d = Math.hypot(dx, dy) || 1;
        var sp = spitSpeed(level);
        spits.push({
          x: mx, y: my,
          vx: dx / d * sp + rnd(-8, 8),
          vy: dy / d * sp + rnd(-8, 8),
          life: 5, r: 3
        });
        Sound.spit();
      }

      /* ramming a camel is fatal for the small aircraft */
      if (player.invuln <= 0 &&
          Art.camelHit(c, player.x + SHIP_W / 2, player.y + SHIP_H / 2)) {
        killPlayer();
      }
    }

    /* --- spits --- */
    for (var s = spits.length - 1; s >= 0; s--) {
      var sp2 = spits[s];
      sp2.x += sp2.vx * dt;
      sp2.y += sp2.vy * dt;
      sp2.vy += 22 * dt;
      sp2.life -= dt;
      if (sp2.life <= 0 || sp2.y > GROUND_Y || sp2.x < camX - 40 || sp2.x > camX + VW + 40) {
        if (sp2.y >= GROUND_Y) burst(sp2.x, GROUND_Y, 6, 50, [C.orange, C.yellow], 1, 0.4);
        spits.splice(s, 1);
        continue;
      }
      if (player.invuln <= 0 &&
          sp2.x > player.x + 2 && sp2.x < player.x + SHIP_W - 2 &&
          sp2.y > player.y + 1 && sp2.y < player.y + SHIP_H - 1) {
        spits.splice(s, 1);
        killPlayer();
      }
    }

    /* --- bonus llama --- */
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

    /* --- level cleared? --- */
    if (alive === 0 && camels.length === 0) {
      state = 'warp';
      stateTime = 0;
      Sound.warp();
      Sound.stopMusic();
    }
  }

  function destabilise(c) {
    c.dying = true;
    c.deathTimer = 0.85;
    c.hp = 0;
    addScore(camelBonus);
    floater(c.x - 16, c.feetY - 60, String(camelBonus), C.lightgreen, 1.6);
    camelBonus *= 2;
    Sound.camelDeath();
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
    if (lives > 0) {
      state = 'dying';
      stateTime = 0;
    }
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      state = 'over';
      stateTime = 0;
      Sound.stopMusic();
      saveHi();
    }
  }

  /* =================================================================
   * update -- hyperspace
   * ================================================================= */
  function startHyper() {
    state = 'hyper';
    stateTime = 0;
    hyperLength = Math.min(20, 11 + level * 0.6);
    hyperTimer = hyperLength;
    missiles = [];
    warpLines = [];
    for (var i = 0; i < 44; i++) {
      warpLines.push({ x: Math.random() * VW, y: rnd(HUD_H + 4, SCAN_Y - 4),
                       v: rnd(220, 560), len: rnd(5, 16) });
    }
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

    /* missile waves get denser and faster with the level */
    var rate = 1.6 + level * 0.22;
    if (Math.random() < dt * rate) {
      var fromRight = Math.random() < 0.82;
      var speed = (170 + level * 9) * rnd(0.85, 1.25);
      missiles.push({
        x: fromRight ? VW + 8 : -18,
        y: rnd(HUD_H + 8, SCAN_Y - 12),
        vx: fromRight ? -speed : speed,
        wave: Math.random() < 0.35 ? rnd(20, 55) : 0,
        phase: Math.random() * 6.28,
        y0: 0
      });
      missiles[missiles.length - 1].y0 = missiles[missiles.length - 1].y;
    }

    for (var m = missiles.length - 1; m >= 0; m--) {
      var mi = missiles[m];
      mi.x += mi.vx * dt;
      mi.phase += dt * 5;
      mi.y = mi.y0 + Math.sin(mi.phase) * mi.wave;
      if (mi.x < -40 || mi.x > VW + 40) { missiles.splice(m, 1); continue; }
      if (player.invuln <= 0 &&
          mi.x + 10 > player.x + 2 && mi.x < player.x + SHIP_W - 2 &&
          mi.y + 3 > player.y + 1 && mi.y < player.y + SHIP_H - 1) {
        missiles.splice(m, 1);
        burst(player.x + 8, player.y + 4, 40, 150, [C.white, C.cyan, C.lightblue], 2, 1.0);
        Sound.playerDeath();
        shake = 8; flash = 0.1; flashCol = C.cyan;
        loseLife();
        if (lives > 0) player.invuln = 1.8;
      }
    }

    if (hyperTimer <= 0 && state === 'hyper') {
      var bonus = 1000 * level;
      addScore(bonus);
      Sound.bonus();
      state = 'hyperclear';
      stateTime = 0;
    }
  }

  /* =================================================================
   * shared particle / floater update
   * ================================================================= */
  function updateFx(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
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
    if (message) {
      message.time -= dt;
      if (message.time <= 0) message = null;
    }
  }

  /* =================================================================
   * top-level update
   * ================================================================= */
  function update(dt) {
    t += dt;
    stateTime += dt;

    if (tapped('mute')) {
      var m = Sound.toggleMute();
      message = { text: m ? 'SOUND OFF' : 'SOUND ON', time: 1.0, col: C.cyan };
    }

    if (state === 'title') {
      Sound.playMusic('title');
      if (tapped('start') || tapped('fire')) { newGame(); }
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
        if (stateTime > 2.2) { state = 'play'; stateTime = 0; }
        break;
      case 'play':
        updatePlay(dt);
        updateFx(dt);
        break;
      case 'dying':
        updateFx(dt);
        if (stateTime > 1.6) {
          resetPlayer(false);
          state = 'play';
          stateTime = 0;
        }
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
        if (stateTime > 2.0) {
          if (level >= MAX_LEVEL) {
            won = true;
            state = 'over';
            stateTime = 0;
            saveHi();
          } else {
            startLevel(level + 1);
            Sound.playMusic('game');
          }
        }
        break;
    }
  }

  /* =================================================================
   * rendering
   * ================================================================= */
  function skyColor() {
    var tints = [C.black, '#0a0020', '#001018', '#100010', '#001500'];
    return tints[(level - 1) % tints.length];
  }

  function drawHud() {
    Art.rect(ctx, 0, 0, VW, HUD_H, C.black);
    Art.rect(ctx, 0, HUD_H, VW, 1, C.darkgrey);
    Font.draw(ctx, 'SC ' + pad(score, 6), 3, 3, C.lightgreen, 1);
    Font.draw(ctx, 'HI ' + pad(hiScore, 6), 108, 3, C.yellow, 1);
    Font.draw(ctx, 'ZONE ' + pad(level, 2), 212, 3, C.cyan, 1);
    for (var i = 0; i < Math.min(lives, 5); i++) {
      Art.rect(ctx, 268 + i * 10, 4, 7, 2, C.lightgrey);
      Art.rect(ctx, 270 + i * 10, 3, 3, 1, C.cyan);
    }
    if (lives > 5) Font.draw(ctx, '+' + (lives - 5), 268 + 50, 3, C.lightgrey, 1);
  }

  function drawScanner() {
    Art.rect(ctx, 0, SCAN_Y - 1, VW, 1, C.darkgrey);
    Art.rect(ctx, 0, SCAN_Y, VW, SCAN_H, C.black);
    var y = SCAN_Y + 7;
    var TRACK_X = 40, TRACK_W = VW - TRACK_X - 6;
    Art.rect(ctx, TRACK_X, y, TRACK_W, 1, C.darkgrey);
    var sx = function (wx) {
      return TRACK_X + clamp(wx / WORLD_W, 0, 1) * TRACK_W;
    };

    /* base marker */
    Art.rect(ctx, sx(BASE_X), y - 5, 3, 10, C.lightgreen);
    /* viewport bracket */
    Art.rect(ctx, sx(camX), y - 4, 1, 8, C.grey);
    Art.rect(ctx, sx(camX + VW), y - 4, 1, 8, C.grey);
    /* camels */
    for (var i = 0; i < camels.length; i++) {
      var c = camels[i];
      var hpF = Math.max(0, c.hp / c.maxHp);
      var col = c.dying ? C.white : Art.DAMAGE[Math.min(Art.DAMAGE.length - 1,
        Math.floor((1 - hpF) * Art.DAMAGE.length))];
      Art.rect(ctx, sx(c.x) - 1, y - 3, 3, 6, col);
    }
    /* player */
    if (player) Art.rect(ctx, sx(player.x) - 1, y - 2, 3, 4, C.white);
    Font.draw(ctx, 'SCAN', 6, SCAN_Y + 4, C.grey, 1);
  }

  function drawFx() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var s = p.life / p.max > 0.4 ? p.size : Math.max(1, p.size - 1);
      Art.rect(ctx, p.x - camXOffset(), p.y, s, s, p.col);
    }
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      if (Math.floor(fl.life * 20) % 2 === 0 || fl.life > 0.4) {
        Font.draw(ctx, fl.text, fl.x - camXOffset(), fl.y, fl.col, 1);
      }
    }
  }

  /* Particles are stored in world space during the ground assault and
     in screen space during hyperspace. */
  function camXOffset() {
    return (state === 'hyper' || state === 'hyperclear') ? 0 : camX;
  }

  function drawPlay() {
    Art.rect(ctx, 0, 0, VW, VH, skyColor());
    Art.drawStars(ctx, stars, camX, t);
    Art.drawTerrain(ctx, camX, GROUND_Y, level, t);

    if (BASE_X - camX < VW + 60) Art.drawBase(ctx, BASE_X - camX, GROUND_Y, t);

    if (llama) Art.drawLlama(ctx, llama.x - camX, llama.feetY, llama.phase, t);

    for (var i = 0; i < camels.length; i++) {
      var c = camels[i];
      var screenX = c.x - camX;
      if (screenX < -Art.CAMEL_W || screenX > VW + Art.CAMEL_W) {
        /* still needs a mouth position for off-screen aiming maths */
        c.mouth.x = c.x + 26;
        c.mouth.y = c.feetY - 40;
        continue;
      }
      var shim = { x: screenX, feetY: c.feetY, hp: c.hp, maxHp: c.maxHp,
                   phase: c.phase, rear: c.rear, dying: c.dying, flash: c.flash,
                   mouth: { x: 0, y: 0 } };
      Art.drawCamel(ctx, shim, t);
      c.mouth.x = shim.mouth.x + camX;
      c.mouth.y = shim.mouth.y;
      /* health pip above wounded camels */
      if (!c.dying && c.hp < c.maxHp) {
        var w = 34;
        Art.rect(ctx, screenX - w / 2, c.feetY - Art.CAMEL_H - 8, w, 2, C.darkgrey);
        Art.rect(ctx, screenX - w / 2, c.feetY - Art.CAMEL_H - 8,
                 w * (c.hp / c.maxHp), 2, C.lightred);
      }
    }

    for (var b = 0; b < bullets.length; b++) {
      var bl = bullets[b];
      Art.rect(ctx, bl.x - camX, bl.y, 4, 2, TRACER[(Math.floor(t * 40) + b) % TRACER.length]);
    }

    for (var s = 0; s < spits.length; s++) {
      var sp = spits[s];
      var col = CYCLE[(Math.floor(t * 22) + s) % CYCLE.length];
      var sxp = sp.x - camX;
      /* keyline first so the fireball survives a busy ridge behind it */
      Art.rect(ctx, sxp - 4, sp.y - 3, 8, 6, C.black);
      Art.rect(ctx, sxp - 3, sp.y - 4, 6, 8, C.black);
      Art.rect(ctx, sxp - 3, sp.y - 2, 6, 4, col);
      Art.rect(ctx, sxp - 2, sp.y - 3, 4, 6, col);
      Art.rect(ctx, sxp - 1, sp.y - 1, 2, 2, C.white);
    }

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

    /* Backdrop: dim streaks only. Nothing back here is allowed to
       compete with a missile for the player's attention. */
    var DIM = [C.darkgrey, C.blue, C.grey, C.purple];
    for (var i = 0; i < warpLines.length; i++) {
      var w = warpLines[i];
      Art.rect(ctx, w.x, w.y, w.len, 1, DIM[i % DIM.length]);
    }
    /* three slow psychedelic horizon bands, kept faint */
    for (var b = 0; b < 3; b++) {
      var y = 46 + b * 46 + Math.sin(t * 1.6 + b * 2) * 9;
      ctx.globalAlpha = 0.35;
      Art.rect(ctx, 0, y, VW, 1, CYCLE[(b + Math.floor(t * 4)) % CYCLE.length]);
      ctx.globalAlpha = 1;
    }

    /* Missiles: black keyline, white body, hot nose, cycling exhaust. */
    for (var m = 0; m < missiles.length; m++) {
      var mi = missiles[m];
      var dir = mi.vx > 0 ? 1 : -1;
      var nose = dir > 0 ? mi.x + 12 : mi.x - 3;
      var tail = dir > 0 ? mi.x - 8 : mi.x + 12;
      Art.rect(ctx, tail, mi.y + 1, 8, 2,
               TRACER[(m + Math.floor(t * 30)) % TRACER.length]);
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

    /* survival timer */
    var frac = clamp(hyperTimer / hyperLength, 0, 1);
    Art.rect(ctx, 0, SCAN_Y - 1, VW, SCAN_H + 1, C.black);
    Font.center(ctx, 'HYPERSPACE  ' + Math.ceil(Math.max(0, hyperTimer)),
                VW / 2, SCAN_Y, C.white, 1);
    Art.rect(ctx, 4, SCAN_Y + 9, VW - 8, 4, C.darkgrey);
    Art.rect(ctx, 4, SCAN_Y + 9, (VW - 8) * frac, 4, C.cyan);
  }

  function drawTitle() {
    Art.rect(ctx, 0, 0, VW, VH, C.black);
    Art.drawStars(ctx, stars, t * 22, t);
    Art.drawTerrain(ctx, t * 18, GROUND_Y, 1, t);

    /* an attract-mode camel plods across the bottom */
    var demo = {
      x: ((t * 26) % (VW + 140)) - 70,
      feetY: GROUND_Y, hp: 20, maxHp: 26,
      phase: t * 4, rear: 0, dying: false, flash: 0, mouth: { x: 0, y: 0 }
    };
    Art.drawCamel(ctx, demo, t);

    var c1 = CYCLE[Math.floor(t * 8) % CYCLE.length];
    var c2 = CYCLE[(Math.floor(t * 8) + 3) % CYCLE.length];
    Font.centerShadow(ctx, 'MUTANT', VW / 2, 22, c1, C.black, 4);
    Font.centerShadow(ctx, 'CAMEL WARP', VW / 2, 52, c2, C.black, 3);
    Font.center(ctx, 'A M C   I I', VW / 2, 76, C.lightgrey, 1);
    Font.center(ctx, 'AFTER LLAMASOFT 1983', VW / 2, 86, C.darkgrey, 1);

    if (Math.floor(t * 2) % 2 === 0) {
      Font.center(ctx, 'PRESS ENTER TO DEFEND THE BASE', VW / 2, 106, C.white, 1);
    }
    Font.center(ctx, 'ARROWS / WASD - FLY      SPACE - FIRE', VW / 2, 122, C.cyan, 1);
    Font.center(ctx, 'P - PAUSE      M - SOUND', VW / 2, 132, C.cyan, 1);
    Font.center(ctx, 'SHOOT THE HUMPS - DOUBLE DAMAGE', VW / 2, 146, C.yellow, 1);
    Font.center(ctx, 'HI SCORE ' + pad(hiScore, 6), VW / 2, 160, C.lightgreen, 1);
    drawScannerlessFooter();
  }

  function drawScannerlessFooter() {
    Art.rect(ctx, 0, SCAN_Y, VW, SCAN_H, C.black);
    Font.center(ctx, 'LET NO CAMEL REACH THE RIGHT-HAND BASE', VW / 2, SCAN_Y + 4, C.grey, 1);
  }

  function drawOverlays() {
    if (state === 'intro') {
      var boxY = 70;
      Art.rect(ctx, 40, boxY, 240, 52, C.black);
      Art.rect(ctx, 40, boxY, 240, 1, C.cyan);
      Art.rect(ctx, 40, boxY + 51, 240, 1, C.cyan);
      Font.center(ctx, 'ZONE ' + pad(level, 2), VW / 2, boxY + 10,
                  CYCLE[Math.floor(t * 10) % CYCLE.length], 2);
      Font.center(ctx, camelCount(level) + ' MUTANT CAMELS INBOUND', VW / 2, boxY + 30, C.white, 1);
      Font.center(ctx, 'HOLD THE LINE', VW / 2, boxY + 40, C.yellow, 1);
    }
    if (state === 'warp') {
      var a = Math.min(1, stateTime / 1.5);
      for (var i = 0; i < 26 * a; i++) {
        Art.rect(ctx, 0, Math.random() * VH, VW, 1 + Math.random() * 2,
                 CYCLE[(i + Math.floor(t * 30)) % CYCLE.length]);
      }
      Font.center(ctx, 'ZONE CLEAR', VW / 2, 70, C.white, 2);
      Font.center(ctx, 'ENTERING HYPERSPACE', VW / 2, 96, C.cyan, 1);
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
      Font.center(ctx, won ? 'BASE SAVED' : 'GAME OVER', VW / 2, 54,
                  CYCLE[Math.floor(t * 6) % CYCLE.length], 3);
      if (won) {
        Font.center(ctx, 'ALL 30 ZONES CLEARED', VW / 2, 78, C.lightgreen, 1);
      }
      Font.center(ctx, 'SCORE ' + pad(score, 6), VW / 2, 92, C.white, 1);
      Font.center(ctx, 'HI    ' + pad(hiScore, 6), VW / 2, 104, C.yellow, 1);
      Font.center(ctx, 'ZONE REACHED ' + pad(level, 2), VW / 2, 116, C.cyan, 1);
      if (stateTime > 1.2 && Math.floor(t * 2) % 2 === 0) {
        Font.center(ctx, 'PRESS ENTER', VW / 2, 140, C.lightgreen, 1);
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

  function render() {
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (state === 'title') {
      drawTitle();
    } else if (state === 'hyper' || state === 'hyperclear') {
      drawHyper();
    } else if (state === 'over') {
      /* handled entirely in drawOverlays */
      Art.rect(ctx, 0, 0, VW, VH, C.black);
    } else {
      drawPlay();
    }

    drawOverlays();

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
  function saveHi() {
    try { localStorage.setItem('amc2.hiscore', String(hiScore)); } catch (e) {}
  }

  function loadHi() {
    try {
      var v = parseInt(localStorage.getItem('amc2.hiscore'), 10);
      if (!isNaN(v)) hiScore = v;
    } catch (e) {}
  }

  function resize() {
    var pad = 46;
    var sx = (global.innerWidth - 16) / VW;
    var sy = (global.innerHeight - pad) / VH;
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
    loadHi();
    camels = []; bullets = []; spits = [];
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
  global.AMC = {
    state: function () { return state; },
    debug: function () {
      return {
        state: state, score: score, lives: lives, level: level,
        camels: camels.length,
        hp: camels.map(function (c) { return c.hp; }),
        playerX: Math.round(player.x), playerY: Math.round(player.y),
        camX: Math.round(camX)
      };
    },
    skip: function () { camels.length = 0; },
    pushToBase: function () {
      if (camels[0]) { camels[0].x = BASE_X - 30; player.x = BASE_X - 240; }
    },
    setLevel: function (n) { startLevel(n); }
  };
})(window);
