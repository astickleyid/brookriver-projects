# Brookriver playable cast

The title screen is a casting screen: choose one of nine protagonists, inspect their actual animated game model, turn it, preview a walk, and begin. Selection is stored under `brookriver-character-v1`; unknown values recover to Rhett without changing financial or property saves. Mouse, touch, keyboard arrows, and controller LB/RB or D-pad choose a character. Controller A confirms.

## Art direction

The previous tube-shaped garments and inflated torsos did not meet the requested quality. This revision targets the bold silhouettes, sportswear, attitude and readable personal identities associated with early-2000s arcade and extreme-sports games. Fuzion Frenzy and SSX Tricky are stylistic references, not sources of copied characters or assets.

Rhett, Cole and Axel lead the selection: three white adult men with different masculine silhouettes, hair, fashion and personalities. The remaining six characters also receive rebuilt clothing and revised proportions. Broad shoulders and a defined waist replace the old oversized barrel-shaped torso treatment. The cast retains different heights, skin tones and builds.

| Character | Personal brand | Silhouette and wardrobe | Personality |
| --- | --- | --- | --- |
| Rhett Vale | REDLINE | Athletic V-taper; brown swept hair, forehead goggles, scarlet racing tee, dark denim, fingerless gloves and red high-tops | Cocky, competitive, loyal; a street racer chasing a clean win |
| Cole Mercer | KICKFLIP | Lean and long-limbed; blond quiff, forest/gold hoodie, baggy black shorts, headphones and chunky skate shoes | Relaxed, mischievous, technical; a skate filmmaker building a late-night shop |
| Axel Briggs | HEAVY HITTER | Broad muscular shoulders, thick neck and tapered waist; dark crest/beard, cut-off vest, amber tank, torn denim and wrist wraps | Boisterous, protective, hot-headed; a heavyweight who secretly repairs skate ramps |
| Mara Voss | AFTERHOURS | Tall and lean; ice-blond crest, ink/silver cropped streetwear, utility trousers and heavy boots | Private, observant, dry; a concierge who notices everything |
| Leon Bell | DEADSTOCK | Broad and strong with a tapered waist; oxblood hoodie, cream sneakers, loose denim shorts and headphones | Warm, competitive, generous; a collector keeping his aunt's record shop alive |
| Imani Okafor | PULSE | Athletic; cobalt/lime utility sportswear and strong hips | Magnetic, inventive, impatient; a dancer saving for her own studio |
| Rafa Solis | TORQUE | Short, solid and broad-shouldered; beard, copper shirt, dark suspenders, olive trousers and cream work shoes | Patient, practical, stubborn; a mechanic who fixes things for people who cannot pay |
| Jules Park | OFFSCRIPT | Slender; lavender hair, seafoam streetwear and charcoal trousers | Theatrical, curious, resourceful; an anonymous neighborhood printmaker |
| Sana Haddad | SUNDOWN | Curvy with a defined waist; saffron tee, ivory trousers, terracotta sneakers and swept auburn hair | Warm, shrewd, headstrong; a supper-club host building a restaurant |

## Actual model implementation

`npm run assets:cast` reproducibly builds nine compact GLBs from the existing CC0 Quaternius modular men/women meshes. These contain authored garment topology, trouser legs, sleeves, shoes and hairstyles. The old player tube/coat generator has been removed. Resident NPCs retain their lighter wardrobe system.

The offline pipeline fits anatomy continuously to the Universal skeleton's bind landmarks, maps four bone weights per vertex and preserves the original skeleton rotations. Chest, waist, hip, depth, arm and footwear shapes vary without enlarging every torso. Per-bone positional fitting was rejected because it pinched collars at mismatched spine joints. Unused vertices and source block faces are removed before export; each generated body is below 10,000 triangles. The manifest records source files, bounds, mesh counts and skeleton names.

At runtime, detailed source heads/eyes/brows replace the modular block faces. Jaw and nose proportions vary, skin is tinted per character, and source hair/beards plus fitted sports accessories complete the heads. Garment graphics are separate skinned surfaces sharing the shirt's weights; they follow walking, torso rotation and melee. They show each character's own brand rather than a portrait-only overlay.

The nine prototypes reuse the established animation library and weapon attachments. Selection persists through returning to the title screen, respawning and page reloads. Gameplay speed, weapons and economy remain shared. Body fitting and successful animation checks are distinct from the user's artistic acceptance.

## Personality and voice

The selector includes biography, a contradiction/flaw, three traits, fashion direction and an introductory line. Idle performances differ; Rhett and Axel use a folded-arm selection pose. The selected character's introductory caption appears in gameplay. Accent/cadence and vocal register are explicitly labeled **voice direction**. Recorded dialogue, accent audio and character-specific quests are not implemented.

## Verification

- `npm run typecheck`
- `npm run test:game`: 108 tests, including nine identities, safe selection recovery, face sculpt immutability, actual GLB bounds/weights/joint indices, triangle budgets and matching skeleton bind rotations.
- `npm run build`
- `npm run test:characters:browser -- 'http://127.0.0.1:8083/?qa=1'`: nine selections, actor/profile identity, front/back walking captures, city locomotion/melee, reload persistence, keyboard/controller selection/start, mobile biography/selection/start and browser errors.
- `npm run test:game:browser -- 'http://127.0.0.1:8083/?qa=1'`: steering, aim/strafe, jumping, melee contact, reload, city perimeter and mobile gameplay regression.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use installed Chrome. Local review clients request gzip because Nitro preview otherwise recompresses every asset with Brotli on demand. Captures and machine-readable reports are local review evidence under `screenshots/review/`. The source heads and skeleton remain shared Quaternius assets; bespoke facial topology, richer clothing textures and recorded performances remain further art work.

Reference viewing: [Fuzion Frenzy original character art](https://mikerooker.blogspot.com/2011/09/fuzion-frenzy-2001-microsoft-games.html), [SSX Tricky promotional art](https://www.mobygames.com/game/5327/ssx-tricky/promo/).
