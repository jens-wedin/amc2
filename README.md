# ATTACK OF THE MUTANT ANIMALS (AMA)

A browser shoot-'em-up played entirely on the keyboard, built as an homage to
**Attack of the Mutant Camels** (Jeff Minter / Llamasoft, 1983) — and then taken
somewhere the original didn't go. No build step, no dependencies, no assets.

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

You fly a small jet over a scrolling landscape. A column of giant mutant
animals is trundling left-to-right toward your home base at the far right of
the map. Each one soaks up dozens of shots and fights back. Let one reach the
base and it costs you a ship.

- **Every species has a marked weak spot**, and it is never in the same place
  twice. Hitting it does double damage. The camels wear it on the hump — the
  "get in behind the top of the back" tactic the original rewarded — but the
  next species will make you re-learn where to stand.
- **Watch the colours.** A beast walks up the palette as it takes damage and
  goes fully multicoloured just before it folds. Its neck rears up as it dies.
- **Every species fights differently**, with its own projectile and its own
  gait. Some creep and pounce, some telegraph a charge, some bound in hops
  that put them briefly out of reach.
- **Use the scanner.** The strip along the bottom shows the whole map: your
  ship, every beast colour-coded by health, your viewport, and the base.
- **Clear the zone, then survive hyperspace.** With the herd down you are
  thrown into a warp corridor and have to dodge high-speed missiles on a timer
  for a per-zone bonus.
- **Bonus llama.** Occasionally one bolts across the ground. 500 points. It is
  the one animal on your side.

**Thirty zones per species.** Clear zone 30 and the warp goes wrong. What comes
out the other side is not what went in. Keep going and it will happen again —
and again. Six times, if you last.

Scoring follows the 1983 scheme: **one point per point of damage**, plus a
destabilisation bonus starting at **100** and **doubling** for each beast
killed in a zone (100 · 200 · 400 · 800 …). Hyperspace pays 1000 × zone. Extra
ship every 15,000. Your Antimat cannon is upgraded a tier with each species
shift, which is what keeps you level with their rising hit points.

## Spoilers — the bestiary

<details>
<summary>What is actually coming. Don't open this if you'd rather find out.</summary>

Six acts of thirty zones — 180 in all. Each species owns its own silhouette,
weak spot, weapon, gait and biome, and the campaign difficulty keeps climbing
across act boundaries rather than resetting.

| Act | Zones | Species | Weak spot | Weapon | Gait | Biome |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–30 | Camels | The hump | Arcing fireball spit | Steady amble | Desert |
| 2 | 31–60 | Cats | The bell, at the throat | Hairballs that bounce off the ground | Creep, then pounce | Moonlit ridge |
| 3 | 61–90 | Dogs | The rump patch, at the tail root | Flat, fast sonic barks | Brisk bouncing trot | Green hills |
| 4 | 91–120 | Pandas | The belly | Bamboo lobbed high, shattering on impact | Slow, with pauses | Snowfield |
| 5 | 121–150 | Elephants | The ear | A three-way water spray | Telegraphed charges | Savanna sunset |
| 6 | 151–180 | Sheep | The face | Fast, briefly seeking bolts | Bounding hops | Lunar grey |

The weak spots are deliberately spread around the body — top-middle, front-low,
rear-high, underneath, front-high — so each reveal forces a new approach angle
rather than a re-skin of the last one.

Clearing zone 180 wins the game.

</details>

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
  speed of the camels and their shots. That 30 became the length of an act here.
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
- Every animal is plotted on the same **30×24 unit grid** at 3px per unit
  (90×72 px), then stamped twice — once fattened in black for a hard keyline,
  once in the damage colour — so it stays legible against the parallax ridges
  whatever colour the damage ramp has walked it to. Weak-spot markers get their
  own keyline for the same reason.
- Adding a species is one table entry in `js/beasts.js`: a `build()` that
  returns unit-grid rectangles, three hitboxes, a palette accent, a weapon, a
  gait and a biome. The renderer, collisions and campaign maths are shared.
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
js/sprites.js     palette, ship, terrain, base, starfield, bonus llama
js/beasts.js      the bestiary: species table + shared beast renderer
js/game.js        campaign, state machine, entities, collision, HUD, main loop
```

High scores persist in `localStorage` under `ama.hiscore` / `ama.bestzone`.

## Debug console

`AMA.debug()` dumps game state, `AMA.skip()` clears the current zone,
`AMA.setLevel(n)` jumps to a zone (31, 61, 91, 121, 151 start each act),
`AMA.endWarp()` cuts a hyperspace run short.
