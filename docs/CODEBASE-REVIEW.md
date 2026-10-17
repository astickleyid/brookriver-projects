# Brookriver codebase review and improvement pass

Reviewed against `astickleyid/brookriver-projects`, main `a1b6fce`, on October 17, 2026. This is an existing browser game, originally exported from Grok and previously named Viceroy. It is a single-player night-time crime sandbox built with Three.js/WebGPU, React 19 and TanStack Start. It contains considerably more playable systems than the initial view suggests.

## How the game fits together

| Area | Source | Responsibility |
| --- | --- | --- |
| App shell | `src/routes/`, `router.tsx`, `styles.css` | TanStack document, preview bridge, PWA integration and visual tokens |
| Game screen | `components/brookriver-app.tsx` | Canvas lifecycle, HUD, start/pause/death screens, touch input |
| Simulation | `game/create-game.ts` | Fixed-step loop, player movement, vehicles, collision, shooting/melee, police, NPC decisions, jobs, audio, camera, world synchronization and save integration |
| District | `game/city.ts` | Deterministic lots, asset placement, road geometry, terrain, visible buildings and dressing |
| Cast | `game/cast.ts` | Skeleton cloning, character appearance, animation selection/blending, guns, root-motion removal and body/arm layers |
| Wardrobe | `game/wardrobe.ts` | Resident identity, occupation, personality details, physical clothing layers and bone-attached accessories |
| Vehicles | `game/fleet.ts` | Existing CC0 car models, normalized dimensions, wheels, fleet synchronization |
| Crowd/input | `game/crowd.ts`, `game/gamepad.ts` | Personal space, crowd separation, controller layouts/deadzones and look/steer conventions |
| Economy | `game/economy.ts`, `game/property.ts` | Hustle risk/payouts, spending, owned properties, businesses, garages, stashes and vehicle ownership |
| Interiors | `game/rooms.ts`, `game/room-layout.ts`, `game/hall.ts` | Separate world-space rooms, matching furniture/walls, Dice Hall presentation |
| Casino | `game/casino.ts` | Blackjack, roulette, slots, craps, baccarat and settlement rules |
| Interaction UI | `game/desk.ts`, `components/desk/` | Typed snapshots/commands, shops, property catalogs, banking and casino boards |
| Platform template | `src/lib/`, `scripts/`, `server/`, `.grok/` | Authentication/data helpers, deployment/PWA infrastructure and preview tooling; most are infrastructure rather than game content |

The game runs a fixed 60 Hz simulation under a requestAnimationFrame render loop. It uses a seeded world and persistent browser storage. Saves continue to read both `brookriver-*` and legacy `viceroy-*` keys. This pass preserves economy rules, owned-property data, casino math and save compatibility.

The largest maintenance problem is the game orchestrator: more than 8,000 lines mix simulation, rendering, audio, UI adapters and persistence. The smaller economy, property, controller, casino and room-layout modules already have useful test coverage. A broad rewrite would create unnecessary risk; this pass isolates wardrobe and fixes specific faults while leaving those established systems intact.

## Confirmed problems and changes

### The map

- **Invisible buildings:** collision used `lotMasses()` while rendering fitted multiple smaller models inside each mass. Much of the visibly empty space was still solid. Collision, ray obstruction and the minimap now use the measured visible-building placements instead.
- **Broken road grade:** rigid street instances were placed at individual center heights. Adjacent tiles and crossings could meet at different elevations. Road vertices now follow one continuous terrain function and are merged by material.
- **Terrain snapping:** the old ground function switched between projected road heights and building pads at region boundaries. It now blends continuously toward district terraces. A regression samples centimeter-scale changes across the district.
- **Floating bases:** flat building bases over changing terrain now have foundations beneath them.
- **Outer roads blocked:** the old player clamp was at ±121 m while the outer roads were centered at ±125 m. The full outer roadway is now usable, with visible perimeter parapets explaining the limit at ±134 m.
- **Incoherent plaza scale:** the miniature decorative building cluster was removed. A clearer paved square, fountain and existing street furniture remain.
- Night fill was adjusted to improve character and street readability while preserving the existing night palette.

This fixes the structural mismatch between visible buildings and the playable map. It does not turn the existing regular grid into a wholly authored new city. The district still uses only three building models and repeated assets.

### Characters and wardrobe

The original cast used two superhero base bodies with recolored clothing textures. A hoodie, jacket, suit and uniform largely had the same body silhouette.

The new wardrobe system adds:

- Separately skinned clothing geometry with fuller hoodie/jacket sleeves, cloth surfaces and trouser/shoe volume. Bone weights are preserved.
- Hoodie collars, strings and pockets; jacket/suit lapels and ties; reflective workwear details; police vest, badge, radio and duty equipment.
- Bone-attached caps, beanies, hardhats, police caps, glasses, earrings, headphones, chains, backpacks, satchels and tool belts.
- Independent skin, fabric, trouser and accent colors, hair variants, height and build variation.
- Persistent resident names, roles, personality descriptions, idle preferences, walking pace and gait variation. The nearby interaction board shows the resident's identity.
- Material/bone batching for rigid accessories, plus cleanup of generated geometry and textures.

The result is a modular character upgrade using the existing animation-compatible rig. Faces still share the existing male/female base meshes. The personality system supplies visual identity and behavior traits; it is not branching dialogue or a new social AI simulation. Artist-authored faces, tailored fashion assets and additional body topology would take this further.

### Animation and contact

- Aimed strafing/backpedaling previously suppressed walking, causing sliding. The legs now animate in every direction; hips follow travel while the torso keeps aiming. Backpedaling reverses the stride cycle.
- Moving reloads and moving combat retain lower-body locomotion under upper-body actions.
- Melee damage now occurs after a wind-up, with range checked at contact. A target can evade. NPC punches use the same contact principle.
- One-shot transition and punch/shove playback lengths match their gameplay windows more closely.
- Distant NPC animation is staggered by render frame with accumulated animation time, avoiding the old bursts of triple-speed updates followed by freezes.

Shotgun and SMG animation still derive from the available pistol set. This is an asset limitation; bespoke two-handed grips, reloads and recoil remain worthwhile future work.

## Verification

- Game unit tests: **103 passing**, including new world geometry, directional movement, appearance and wardrobe regressions.
- TypeScript: passing.
- Production build: passing.
- Browser regression: steering in both directions, aimed strafe/backpedal, jump/landing, melee wind-up/contact damage, moving reload/refill, usable outer road, physical perimeter, resident identity and wardrobe captures.
- Browser render checks cover desktop and mobile. Captures are inspected as well as checking console/page errors.
- The platform template test suite has **8 existing failures** in `grok-pwa-plugin.test.mjs`; the same eight reproduce from the original main source and assets. They concern share-card/title fixture expectations. They are separate from game tests and have not been hidden or relabeled as passing.

Relevant commands:

```sh
npm run test:game
npm run typecheck
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/path/to/chrome' node scripts/game-review.mjs 'http://127.0.0.1:8082/?qa=1'
```

`?qa=1` enables controlled review poses/cameras. `render_game_to_text` and `advanceTime` drive the same gameplay/animation update functions used during ordinary play. The normal game remains driven by its render loop until a test explicitly takes over time stepping.

## Best next improvements

1. Author recognizable neighborhoods, a real waterfront, sightlines, alleys and landmarks on top of the repaired geometry contract. Add more building families before expanding map size.
2. Replace the remaining broad collision approximations for street furniture with an authored prop/collision list.
3. Add authored wardrobe meshes and distinct faces/body topology. Keep their silhouettes and accessories readable during gameplay, not just in a lineup.
4. Add proper shotgun/SMG animation assets and left-hand placement. Compare muzzle direction, hand contact and reload timing per weapon.
5. Extract world creation, combat, police/traffic, audio and persistence from the orchestrator in separate, tested changes.
6. Profile actual target devices. Browser viewport checks do not establish phone GPU performance or physical controller acceptance.

This pass is prepared on a review branch. A successful local build and playtest are distinct from public deployment or final artistic acceptance.
