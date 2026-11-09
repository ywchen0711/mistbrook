# 霧溪之燈 · Lantern of Mistbrook

An isometric party RPG in the browser. Lead four adventurers through a village at dusk, a misty stream, a goblin camp and a ruined shrine. You talk, roll d20 checks and fight turn-based battles. The world, characters, story and art are all original. Every model, texture and sound is made in code, so there are no asset files.

**Play:** https://ywchen0711.github.io/mistbrook/

## The story

Three days ago someone stole the Morning Star Lantern from the old shrine north of Mistbrook. Without it, the mist on the stream rises higher every night, and something walks inside it. The village elder has hired you to bring it back. He isn't telling you everything.

There are four endings. Which one you get depends on what you find out and what you decide to do with the lantern.

## How it looks

- A three.js scene viewed from a tilted, rotatable camera. The sun is low and gives long shadows, and firelight, lamps and glowing windows bloom against the dusk. There is fog, swaying grass and trees, fireflies, chimney smoke and mist drifting over the stream.
- Trees and buildings between the camera and your party are dithered away, so you can always see your people.
- Characters are built and animated in code: walking, attacks, spells, getting hit, going down. Each party member has a ring under their feet, and their portrait is rendered from the 3D model.
- The models aim for a grounded, realistic look. They have human proportions and sculpted faces with eyelids, brows, noses and lips. Armor is layered from plates, mail, leather and cloth, and every surface gets a painted texture with bump detail. Shields carry painted heraldry, and metal reflects a dusk sky. Goblins hunch and have wrinkled skin and claws, skeletons are built bone by bone, and wolves have a two-tone coat and a jaw that opens when they bite.

## How it plays

- **Explore.** Click the ground to move the whole party; the selected hero leads and the others follow in formation. Click people to talk, and click chests, the campfire or braziers to use them.
- **Talk and roll.** Some dialogue options have a skill check, such as Persuasion DC 13. A d20 is rolled with the best skill bonus in the party. Every check can be tried only once, and a good talk can skip a whole fight.
- **Turn-based combat.**
  - Turns follow initiative order.
  - Each turn gives you movement, one action and one bonus action.
  - An attack hits when d20 plus your bonus is at least the target's AC. A natural 20 is a critical hit and a natural 1 always misses.
  - Hovering an enemy shows the hit chance, damage and how far you would need to walk.
  - Ranged attacks have disadvantage while an enemy is next to you.
  - Area spells show their radius before you cast them.
  - Downed allies can be helped up, given a potion or healed.
- **The party:**
  - Kael the fighter: Cleave, Second Wind.
  - Vera the ranger: Hunter's Mark, Volley.
  - Orin the wizard: Fire Bolt, Magic Missile, Thunderwave.
  - Sera the cleric: Sacred Flame, Healing Word, Bless.
- **Enemies have fixed stats** and never scale with the party.
  - Wolves.
  - The goblin camp and its chief.
  - Skeletons, which are weak to bludgeoning and thunder damage.
  - The grey-robed priest, who raises more skeletons while his blue braziers burn. Kick the braziers over.
- **Rest** at the village campfire to restore HP, spell slots and ability uses. The game autosaves, F5 saves and F9 loads.

## Controls

| | Mouse / keyboard | Touch |
|---|---|---|
| Move / interact | left click | tap |
| Rotate camera | right-drag, Q / E | two-finger twist, ⟲ ⟳ buttons |
| Zoom | wheel | pinch |
| Pan | WASD, left-drag | one-finger drag |
| Abilities | 1–6, Esc or right click to cancel | tap the hotbar |
| End turn | Space | 結束回合 button |

In combat on touch, the first tap on a target shows the preview and the second tap confirms.

## Files

- `js/main.js` sets up the renderer, post-processing, camera and input. It also runs exploration, the dialogue glue, saving and the endings.
- `js/world.js` builds the map: the painted ground, stream and bridge, houses, the camp, the ruins, trees and grass, and the see-through shader.
- `js/models.js` builds the character and creature models: painted textures, sculpted heads, hair, armor, weapons and shields.
- `js/actors.js` runs their procedural animation.
- `js/combat.js` handles initiative, attacks, spells and enemy AI.
- `js/rules.js` holds dice, stats, heroes, enemies and abilities.
- `js/story.js` holds dialogue trees, spawns and endings.
- `js/nav.js` is the walk grid, with A* and path smoothing.
- `js/ui.js` is the HUD, dialogue box, dice roll, tooltips and floating text.
- `js/fx.js` has particles, projectiles and spell lights.
- `js/audio.js` makes the synthesized sound and music.

three.js is pinned to 0.160.0 and loaded from a CDN. There is no build step.
