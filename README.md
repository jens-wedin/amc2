# MUTANT CAMEL WARP (AMC II)

A browser shoot-'em-up played entirely on the keyboard, built as an homage to
**Attack of the Mutant Camels** (Jeff Minter / Llamasoft, 1983). No build step,
no dependencies, no assets — open `index.html` and play.

```
git clone <this repo> && cd amc2
python3 -m http.server 8000     # or: npx serve .
# then open http://localhost:8000
```

Opening `index.html` straight off disk works too — the scripts are plain
classic `<script>` tags, not ES modules.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` `↑` `↓` or `WASD` | Fly |
| `SPACE` | Fire (hold for auto) |
| `ENTER` | Start / continue |
| `P` or `ESC` | Pause |
| `M` | Sound on/off |

## How it plays

You fly a small jet over a mountainous desert. A column of giant mutant camels
is trundling left-to-right toward your home base at the far right of the map.
Each one soaks up dozens of shots and spits fireballs back at you. Let a camel
reach the base and it costs you a ship.

- **Shoot the humps.** The green crest on the front hump is the weak spot —
  double damage, exactly the "get in behind the top of the back" tactic the
  original rewarded.
- **Watch the colours.** A camel shifts through the palette as it takes damage
  and goes fully multicoloured just before it folds. Its neck rears up as it
  dies.
- **Use the scanner.** The strip along the bottom shows the whole map: your
  ship, every camel colour-coded by health, your viewport, and the base.
- **Clear the zone, then survive hyperspace.** With the herd down you are
  thrown into a warp corridor and have to dodge high-speed missiles on a timer
  for a per-zone bonus.
- **Bonus llama.** Occasionally one bolts across the sand. 500 points.

Scoring follows the 1983 scheme: **1 point per hit**, plus a destabilisation
bonus starting at **100** and **doubling** for each camel killed in a zone
(100 · 200 · 400 · 800 …). Hyperspace pays 1000 × zone. Extra ship every
15,000. 30 zones; camels, spit and missiles all get faster as you climb.

## Research: what the original actually was

Findings that shaped the design, gathered before writing any code:

- **Attack of the Mutant Camels** (Llamasoft, 1983, C64 and Atari 8-bit) is a
  surrealist horizontally-scrolling shooter by Jeff Minter — the sequel to
  *Gridrunner*, and known in the US as *Matrix: Gridrunner 2*. It riffs on the
  Atari 2600 *Empire Strikes Back* (1982) with the AT-AT walkers swapped for
  giant camels.
- The player pilots a highly manoeuvrable craft — "long range scanner, shields,
  Antimat cannon and trans-spatial warp fields" — against a row of six huge
  camels ambling across mountainous terrain. If they reach the far side, you
  lose.
- Camels take **several dozen shots** each and retaliate by spitting fireballs
  from their mouths.
- **Damage was shown by colour**: camels cycled colours as they were hurt until
  they went "all multicoloured", the neck went up, and they died.
- The community-favourite tactic was to **get in behind the top of the back**,
  which gave you time to dodge the spitballs.
- **Scoring**: one point per hit, plus a bonus for destabilising a camel,
  starting at 100 and doubling with each camel destroyed.
- Clearing a level dropped you into a **"hyperspace" sequence** where you had to
  survive high-speed missiles.
- 30 levels; you could start at any of them, and the only difference was the
  speed of the camels and their shots.
- Minter's house style: gameplay first, surrealism over realism, psychedelic
  visuals, ruminants everywhere, quirky audio.

Sources:
[Wikipedia — Attack of the Mutant Camels](https://en.wikipedia.org/wiki/Attack_of_the_Mutant_Camels) ·
[MobyGames](https://www.mobygames.com/game/19262/attack-of-the-mutant-camels/) ·
[Lemon64](https://www.lemon64.com/game/amc-attack-of-the-mutant-camels-llamasoft) ·
[GameFAQs review](https://gamefaqs.gamespot.com/c64/565059-attack-of-the-mutant-camels/reviews/51149) ·
[Commodore User review (Everygamegoing)](https://www.everygamegoing.com/larticle/attack-of-the-mutant-camels-000/52452) ·
[Wikipedia — Jeff Minter](https://en.wikipedia.org/wiki/Jeff_Minter) ·
[Internet Archive](https://archive.org/details/Attack_of_the_Mutant_Camels_1983_Llamasoft)

This is an original game inspired by that research, not a port or a copy of
Llamasoft's code or artwork.

## Retro tech notes

- Fixed **320×200** internal canvas — the C64's screen resolution — scaled up by
  whole integers only, with `image-rendering: pixelated`, so every game pixel
  stays a perfect square at any window size.
- The **16-colour C64 palette** (VICE values) and nothing outside it.
- All text is drawn with a hand-plotted **5×7 bitmap font** (`js/font.js`); no
  webfonts, no antialiasing.
- Camels are plotted from a 30×24 unit grid at 3px per unit (90×72 px), stamped
  twice — once fattened in black for a hard keyline, once in the body colour —
  so they stay legible against the parallax ridges.
- Audio is a small **WebAudio SID impersonator** (`js/audio.js`): pulse and
  sawtooth voices, a generated noise buffer for explosions, and a lookahead step
  sequencer running two chip tunes. Nothing is loaded from disk.
- CSS supplies the CRT: bezel, scanlines, vignette and phosphor glow.

## Layout

```
index.html        page shell
css/style.css     CRT cabinet and scanlines
js/font.js        5x7 bitmap font
js/audio.js       WebAudio chiptune + SFX
js/sprites.js     palette, camels, ship, terrain, base, starfield
js/game.js        state machine, entities, collision, HUD, main loop
```

High scores persist in `localStorage` under `amc2.hiscore`.

## Debug console

`AMC.debug()` dumps game state, `AMC.skip()` clears the current zone,
`AMC.setLevel(n)` jumps to a zone.
