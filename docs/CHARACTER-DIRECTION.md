# Brookriver playable cast

The title screen is a casting screen: choose one of six authored protagonists, inspect their actual animated game model, turn it, preview a walk, and begin. Selection is stored under `brookriver-character-v1`; unknown values recover to Mara without changing financial or property saves. Mouse, touch, keyboard arrows, and controller LB/RB or D-pad can choose a character. Controller A confirms.

| Character | Personal brand | Silhouette and wardrobe | Personality |
| --- | --- | --- | --- |
| Mara Voss | AFTERHOURS | Tall and lean; silver hair, ink tailoring, split coat hem, narrow boots | Private, observant, dry; a concierge who notices everything |
| Leon Bell | DEADSTOCK | Broad and heavyset; rounded curls, oxblood and cream varsity layers, loose denim, high-tops | Warm, competitive, generous; a collector keeping his aunt's record shop alive |
| Imani Okafor | PULSE | Athletic; loc buns, cobalt and lime trackwear, cargo pockets, wide trousers | Magnetic, inventive, impatient; a dancer saving for her own studio |
| Rafa Solis | TORQUE | Short and sturdy; beard, copper workwear, rolled cream sleeves, utility pockets and boots | Patient, practical, stubborn; a mechanic who fixes things for people who cannot pay |
| Jules Park | OFFSCRIPT | Slender; lavender side part, seafoam shirt, asymmetric charcoal panels and crossbody bag | Theatrical, curious, resourceful; an anonymous neighborhood printmaker |
| Sana Haddad | SUNDOWN | Full figure; auburn hair, saffron longline layers, ivory trousers and terracotta boots | Warm, shrewd, headstrong; a supper-club host building a restaurant |

## What changes in the actual models

Playable actors use six separate prototypes and independently sculpted weighted body vertices. Chest, waist, hip, depth, jaw and nose parameters vary independently. Skin and hair colors are authored per character rather than derived from a random resident index. The source rig and face topology remain Quaternius CC0 assets.

Playable clothing is constructed as separate skinned surfaces with its own torso, sleeve, trouser, shoulder transition, hip and shoe geometry. It does not copy the old superhero body's muscle contours. Split coat hems blend pelvis and thigh movement. Chest details and panels share garment skin weights so they stay against the fabric through reloads, shoves and torso rotation. Only exposed skin remains in the underlying body mesh.

Character selection lazily creates and caches the six actors, reuses their existing animation library and weapon attachments, and disposes their resources with the game. The chosen actor remains selected when returning to the title screen, respawning or reloading the page. Gameplay movement, weapons and economy remain shared; visual gait variation does not change travel speed.

## Personality and voice

The selector includes authored biography, a contradiction/flaw, three personality traits, fashion direction and an introductory line. Idle performances differ, and the chosen character's line appears as an introductory caption in gameplay. Accent/cadence and vocal register are explicitly labeled **voice direction**. Recorded dialogue, accent audio and character-specific quest writing are not implemented by this change.

## Verification

- `npm run typecheck`
- `npm run test:game`: 107 tests, including body sculpt immutability, preserved weights, garment bindings, exposed-skin filtering, split hems and corrupt-selection recovery.
- `npm run build`
- `npm run test:characters:browser -- 'http://127.0.0.1:8083/?qa=1'`: six selections, actual actor/profile identity, front/back walking captures, city locomotion and melee, reload persistence, controller wrapping/confirmation, mobile biography/selection/start and console errors.
- `npm run test:game:browser -- 'http://127.0.0.1:8083/?qa=1'`: existing steering, aim/strafe, jumping, contact timing, reload, city perimeter and mobile gameplay regression.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using an installed Chrome executable. Screenshots and machine-readable reports are written beneath `screenshots/review/`; they are local review evidence, not committed build output. Automated checks establish functionality, not the user's artistic approval.
