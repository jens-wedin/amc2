/* ------------------------------------------------------------------
 * audio.js -- WebAudio SID impersonator.
 * Pulse/saw oscillators, a noise buffer for explosions, and a tiny
 * step sequencer for the two chip tunes. Everything is generated at
 * runtime; there are no sample files to load.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicGain = null;
  var sfxGain = null;
  var noiseBuffer = null;
  var muted = false;
  var started = false;

  /* ---- tunes -------------------------------------------------------
   * Notes are MIDI numbers, 0 = rest. One entry per 16th note.
   */
  var TUNES = {
    title: {
      bpm: 124,
      bass: [45, 0, 45, 0, 45, 0, 48, 0, 43, 0, 43, 0, 43, 0, 47, 0,
             41, 0, 41, 0, 41, 0, 45, 0, 40, 0, 40, 0, 43, 0, 47, 0],
      lead: [69, 72, 76, 72, 69, 72, 76, 79, 67, 71, 74, 71, 67, 71, 74, 78,
             65, 69, 72, 69, 65, 69, 72, 76, 64, 67, 71, 67, 71, 74, 76, 79]
    },
    game: {
      bpm: 146,
      bass: [33, 33, 45, 33, 33, 40, 45, 33, 31, 31, 43, 31, 31, 38, 43, 31,
             36, 36, 48, 36, 36, 43, 48, 36, 34, 34, 46, 34, 41, 46, 41, 38],
      lead: [0, 0, 69, 0, 0, 0, 72, 0, 0, 0, 67, 0, 0, 0, 70, 0,
             0, 0, 72, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 77, 0, 79]
    }
  };

  var tune = null;
  var step = 0;
  var nextNoteTime = 0;
  var timer = null;

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function ensure() {
    if (ctx) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.30;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.75;
    sfxGain.connect(master);

    var len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /** One oscillator voice with an optional pitch slide. */
  function tone(opt) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.1;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opt.type || 'square';
    osc.frequency.setValueAtTime(Math.max(20, opt.freq), t0);
    if (opt.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
    }
    var vol = opt.vol === undefined ? 0.25 : opt.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(opt.bus || sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst -- explosions, thrusters, camel spit. */
  function noise(opt) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.2;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = opt.type || 'lowpass';
    filt.frequency.setValueAtTime(opt.freq || 1200, t0);
    if (opt.to) filt.frequency.exponentialRampToValueAtTime(Math.max(60, opt.to), t0 + dur);
    filt.Q.value = opt.q || 1;
    var gain = ctx.createGain();
    var vol = opt.vol === undefined ? 0.3 : opt.vol;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---- sequencer ---------------------------------------------------- */

  function scheduleStep(i, when) {
    var b = tune.bass[i % tune.bass.length];
    var l = tune.lead[i % tune.lead.length];
    var stepDur = 15 / tune.bpm;
    if (b) {
      tone({ freq: midi(b), dur: stepDur * 1.6, type: 'sawtooth', vol: 0.20,
             delay: when, bus: musicGain });
    }
    if (l) {
      tone({ freq: midi(l), dur: stepDur * 0.85, type: 'square', vol: 0.085,
             delay: when, bus: musicGain });
    }
    if (i % 4 === 2) {
      noise({ freq: 5200, to: 2400, dur: 0.05, vol: muted ? 0 : 0.05, delay: when, type: 'highpass' });
    }
  }

  function pump() {
    if (!ctx || !tune) return;
    var stepDur = 15 / tune.bpm;
    var now = ctx.currentTime;
    while (nextNoteTime < now + 0.18) {
      scheduleStep(step, Math.max(0, nextNoteTime - now));
      step++;
      nextNoteTime += stepDur;
    }
  }

  var Sound = {
    get muted() { return muted; },

    /** Must run from a user gesture -- browsers block audio otherwise. */
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      started = true;
    },

    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },

    playMusic: function (name) {
      if (!ensure()) return;
      var next = TUNES[name];
      if (!next || next === tune) return;
      tune = next;
      step = 0;
      nextNoteTime = ctx.currentTime + 0.05;
      if (!timer) timer = setInterval(pump, 25);
    },

    stopMusic: function () {
      tune = null;
      if (timer) { clearInterval(timer); timer = null; }
    },

    /* ---- one-shots ---- */
    shoot: function () {
      tone({ freq: 1150, to: 380, dur: 0.06, type: 'square', vol: 0.13 });
    },
    hit: function () {
      noise({ freq: 2400, to: 700, dur: 0.05, vol: 0.16, type: 'bandpass', q: 2 });
    },
    weakSpot: function () {
      tone({ freq: 640, to: 1500, dur: 0.07, type: 'square', vol: 0.2 });
      noise({ freq: 3000, to: 900, dur: 0.07, vol: 0.16, type: 'bandpass', q: 3 });
    },
    spit: function () {
      tone({ freq: 240, to: 90, dur: 0.16, type: 'sawtooth', vol: 0.12 });
    },
    beastDeath: function () {
      noise({ freq: 1800, to: 60, dur: 1.1, vol: 0.4 });
      tone({ freq: 320, to: 40, dur: 1.0, type: 'sawtooth', vol: 0.2 });
      for (var i = 0; i < 6; i++) {
        tone({ freq: 200 + i * 220, to: 60, dur: 0.5, type: 'square',
               vol: 0.07, delay: i * 0.06 });
      }
    },
    playerDeath: function () {
      noise({ freq: 900, to: 50, dur: 0.9, vol: 0.4 });
      tone({ freq: 500, to: 35, dur: 0.9, type: 'sawtooth', vol: 0.22 });
    },
    warp: function () {
      tone({ freq: 90, to: 2400, dur: 1.2, type: 'sawtooth', vol: 0.2 });
      noise({ freq: 200, to: 6000, dur: 1.2, vol: 0.18, type: 'bandpass', q: 4 });
    },
    bonus: function () {
      var n = [72, 76, 79, 84];
      for (var i = 0; i < n.length; i++) {
        tone({ freq: midi(n[i]), dur: 0.12, type: 'square', vol: 0.18, delay: i * 0.07 });
      }
    },
    llama: function () {
      tone({ freq: 300, to: 1400, dur: 0.25, type: 'square', vol: 0.16 });
    },

    /* ---- per-species weapons ---- */
    bark: function () {
      tone({ freq: 420, to: 130, dur: 0.13, type: 'square', vol: 0.16 });
      noise({ freq: 900, to: 300, dur: 0.12, vol: 0.18, type: 'bandpass', q: 1.5 });
    },
    spray: function () {
      noise({ freq: 3200, to: 900, dur: 0.3, vol: 0.16, type: 'highpass' });
    },
    bolt: function () {
      tone({ freq: 1500, to: 500, dur: 0.12, type: 'sawtooth', vol: 0.13 });
    },

    /* ---- the species-shift reveal ---- */
    alarm: function () {
      for (var i = 0; i < 5; i++) {
        tone({ freq: 660, to: 990, dur: 0.16, type: 'square', vol: 0.16, delay: i * 0.34 });
        tone({ freq: 990, to: 660, dur: 0.16, type: 'square', vol: 0.16, delay: i * 0.34 + 0.17 });
      }
    },
    revealRumble: function () {
      tone({ freq: 40, to: 110, dur: 2.4, type: 'sawtooth', vol: 0.24 });
      noise({ freq: 90, to: 500, dur: 2.4, vol: 0.16 });
    },
    revealHit: function () {
      noise({ freq: 6000, to: 80, dur: 1.4, vol: 0.42 });
      tone({ freq: 160, to: 30, dur: 1.6, type: 'sawtooth', vol: 0.28 });
      var n = [48, 55, 60, 67, 72];
      for (var j = 0; j < n.length; j++) {
        tone({ freq: midi(n[j]), dur: 0.9, type: 'square', vol: 0.12, delay: j * 0.05 });
      }
    },
    blip: function () {
      tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.14 });
    },
    extraLife: function () {
      var n = [72, 79, 84, 88, 91];
      for (var i = 0; i < n.length; i++) {
        tone({ freq: midi(n[i]), dur: 0.16, type: 'triangle', vol: 0.2, delay: i * 0.08 });
      }
    }
  };

  global.Sound = Sound;
})(window);
