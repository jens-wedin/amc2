/* ------------------------------------------------------------------
 * hints.js -- THE HINT BOOK.
 *
 * Twenty tips in the voice of an eighties magazine hint column, four
 * machines, five apiece. The ones flagged `here` are not just nostalgia
 * -- they describe something that is actually true of this game.
 *
 * Machine badges are drawn from rectangles like everything else: a
 * cassette, a cartridge, a bouncing ball and a joystick.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var C = Art.C;

  function r(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* ---- badges: 40x26, drawn from the top-left ----------------------- */

  function badgeCassette(ctx, x, y) {
    r(ctx, x + 1, y + 3, 38, 20, C.black);
    r(ctx, x + 2, y + 4, 36, 18, C.darkgrey);
    r(ctx, x + 5, y + 6, 30, 7, C.lightgrey);
    r(ctx, x + 6, y + 7, 12, 2, C.grey);
    r(ctx, x + 9, y + 15, 22, 6, C.black);
    r(ctx, x + 12, y + 16, 4, 4, C.grey);
    r(ctx, x + 24, y + 16, 4, 4, C.grey);
    r(ctx, x + 13, y + 17, 2, 2, C.darkgrey);
    r(ctx, x + 25, y + 17, 2, 2, C.darkgrey);
    r(ctx, x + 4, y + 21, 2, 2, C.black);
    r(ctx, x + 34, y + 21, 2, 2, C.black);
  }

  function badgeCartridge(ctx, x, y) {
    r(ctx, x + 5, y + 1, 30, 18, C.black);
    r(ctx, x + 6, y + 2, 28, 16, C.brown);
    r(ctx, x + 9, y + 4, 22, 8, C.yellow);
    r(ctx, x + 9, y + 4, 22, 2, C.red);
    for (var i = 0; i < 3; i++) r(ctx, x + 8, y + 13 + i, 24, 1, C.darkgrey);
    r(ctx, x + 9, y + 19, 22, 6, C.darkgrey);
    for (var k = 0; k < 8; k++) r(ctx, x + 11 + k * 2.5, y + 20, 1, 4, C.yellow);
  }

  function badgeBoing(ctx, x, y) {
    Art.drawBoing(ctx, x + 20, y + 13, 12, 0);
  }

  function badgeJoystick(ctx, x, y) {
    /* everything needs a light edge -- this badge sits on black */
    r(ctx, x + 2, y + 12, 36, 14, C.grey);
    r(ctx, x + 3, y + 13, 34, 12, C.darkgrey);
    r(ctx, x + 4, y + 13, 32, 2, C.lightgrey);
    r(ctx, x + 6, y + 7, 10, 6, C.grey);
    r(ctx, x + 7, y + 8, 8, 4, C.red);            /* the one button */
    r(ctx, x + 17, y + 3, 6, 11, C.grey);
    r(ctx, x + 18, y + 4, 4, 9, C.darkgrey);
    r(ctx, x + 15, y, 10, 5, C.grey);             /* knob */
    r(ctx, x + 16, y + 1, 8, 3, C.darkgrey);
  }

  var MACHINES = {
    c64:   { name: 'COMMODORE 64', tint: C.lightblue,  badge: badgeCassette },
    vic:   { name: 'VIC-20',       tint: C.lightgreen, badge: badgeCartridge },
    amiga: { name: 'AMIGA',        tint: C.lightred,   badge: badgeBoing },
    atari: { name: 'ATARI',        tint: C.yellow,     badge: badgeJoystick }
  };

  /* ---- the hints ---------------------------------------------------- */
  var HINTS = [
    /* ---- COMMODORE 64 ---- */
    { m: 'c64', here: true,
      t: 'LOAD "*",8,1 AND THEN GO AND MAKE A CUP OF TEA. THE COLOUR BARS MEAN IT IS WORKING.' },
    { m: 'c64',
      t: 'ANOTHER VISITOR. THE MAN WHO ASKS YOU TO STAY A WHILE MEANS SOMETHING RATHER LONGER. MIND THE LIFT SHAFT.' },
    { m: 'c64',
      t: 'DIG FOR THE DIAMONDS, COUNT THEM TWICE, AND NEVER LOITER UNDER A BOULDER YOU HAVE JUST LOOSENED.' },
    { m: 'c64',
      t: 'YOU CANNOT FIRE. YOU ARE ONLY AN INFLUENCE DEVICE. GO AND TAKE OVER SOMETHING THAT CAN.' },
    { m: 'c64', here: true,
      t: 'THREE VOICES AND ONE FILTER. THAT CHIP PLAYED THE BASS, THE TUNE AND THE DRUMS ALL AT ONCE.' },

    /* ---- VIC-20 ---- */
    { m: 'vic',
      t: 'FIVE KILOBYTES. NO SPRITES. TWENTY-TWO CHARACTERS ACROSS. PEOPLE STILL WROTE ARCADE GAMES ON IT.' },
    { m: 'vic', here: true,
      t: 'THE GRID COMES AT YOU AND THE ZAPPERS SWEEP IN FROM THE EDGES. SHOOT STRAIGHT UP THE COLUMN AND KEEP MOVING.' },
    { m: 'vic',
      t: 'IF THE CARTRIDGE WOBBLES, SWITCH THE MACHINE OFF BEFORE YOU PUSH IT BACK IN. NOT AFTER.' },
    { m: 'vic', here: true,
      t: 'THE LLAMAS STARTED HERE. SO, EVENTUALLY, DID THE CAMELS.' },
    { m: 'vic',
      t: 'THEY CALLED IT THE FRIENDLY COMPUTER. IT WAS ALSO THE FIRST ONE A MILLION HOMES COULD AFFORD.' },

    /* ---- AMIGA ---- */
    { m: 'amiga', here: true,
      t: 'A RED AND WHITE BALL BOUNCING IN A ROOM THAT WAS NEVER THERE. THAT ONE DEMO SOLD THE MACHINE.' },
    { m: 'amiga',
      t: 'FOUR CHANNELS OF SAMPLED SOUND. FOR THE FIRST TIME YOU COULD PUT A REAL DRUM KIT IN A GAME.' },
    { m: 'amiga',
      t: 'LET THE COPPER PAINT THE SKY. THE PROCESSOR HAS BETTER THINGS TO BE GETTING ON WITH.' },
    { m: 'amiga',
      t: 'MOUSE IN PORT ONE, JOYSTICK IN PORT TWO. GET THAT THE WRONG WAY ROUND AND NOTHING WORKS AT ALL.' },
    { m: 'amiga',
      t: 'PLEASE INSERT DISK TWO. THEN DISK ONE. THEN DISK TWO AGAIN. THIS IS NORMAL.' },

    /* ---- ATARI ---- */
    { m: 'atari', here: true,
      t: 'SIT IN THE NEUTRAL ZONE AND WAIT. THE SHIMMER WILL NOT LET ANYTHING THROUGH.' },
    { m: 'atari',
      t: 'SIX CITIES, THREE BATTERIES, AND NO WAY TO WIN. ALL YOU CAN DO IS LAST LONGER.' },
    { m: 'atari',
      t: 'GAME SELECT AND GAME RESET. THE BOX PROMISED A HUNDRED AND TWELVE VARIATIONS AND MEANT IT.' },
    { m: 'atari',
      t: 'THE DRAGON LOOKS LIKE A DUCK. IT IS STILL A DRAGON. RUN.' },
    { m: 'atari',
      t: 'BLOW INTO THE CARTRIDGE. IT NEVER HELPED, AND IT ALWAYS WORKED.' }
  ];

  /* ---- demoscene greets scroller ------------------------------------ */
  var SCROLLER =
    '   *** ATTACK OF THE MUTANT ANIMALS ***   ' +
    'GREETINGS TO EVERY BEDROOM CODER WHO EVER TYPED LOAD "*",8,1 AND WAITED   ' +
    '*** RAISED ON THE 64, THE VIC-20, THE AMIGA AND THE ATARI ***   ' +
    'PRESS H FOR THE HINT BOOK   ' +
    'FOUR OF THOSE HINTS ARE ALSO TRUE IN HERE - FIND THEM   ' +
    '*** RETRO FOR THE WIN ***   ' +
    'WRAP.   ';

  global.Hints = {
    MACHINES: MACHINES,
    HINTS: HINTS,
    SCROLLER: SCROLLER
  };
})(window);
