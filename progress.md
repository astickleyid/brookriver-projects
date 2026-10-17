Original prompt: Examine Brookriver completely and improve overall visuals, animation/action matching, character variation and quality, with the game map the biggest priority.

## 2026-10-17
- Confirmed GitHub repo astickleyid/brookriver-projects, main a1b6fce. Fresh isolated checkout; existing checkout preserved.
- Reviewing game, rendering, assets, UI, economy, property, interiors, input, persistence and test coverage.
- Found independent collision masses and rendered building placements; road meshes are rigid instances on a varying heightfield; plaza contains miniature decorative buildings without collision.
- Local startup made checkout-relative with optional port so the existing game server can remain running.

- Replaced independent building collision masses with measured rendered building footprints; draped/merged roads, continuous terrain and foundations; fixed outer-road bounds and added visible parapets; simplified the plaza.
- Added a skinned wardrobe/accessory system, stable resident identities and personality traits, names on approach, separate palettes and body proportions. User explicitly expanded scope to major character/wardrobe upgrades; this now includes geometry rather than recolors alone.
- Fixed aimed directional locomotion, moving reload/combat layers, player/NPC melee contact timing and distant animation pacing.
- Added deterministic browser review hooks and regression script. Dev gameplay regression passed steering, strafe/backpedal, jumping, melee (100 HP wind-up -> 84 HP contact), reload/refill, outer road/perimeter and resident identity with no console/page errors.
- 103 game tests, typecheck and production build pass. Eight platform PWA fixture failures reproduce from original main; see docs/CODEBASE-REVIEW.md.
- Final built-output desktop/mobile and gameplay check, selected evidence export and GitHub review branch/PR remain to finish.
- Production gameplay regression passed with the full city/cast/fleet ready: A +0.444 rad, D -0.444 rad, directional aim, jump/landing, delayed melee contact, moving reload/refill, outer-road perimeter and visible resident identity. Console/page errors: none.
- Development and built desktop/mobile render checks pass with no overflow. Added explicit full-game readiness and touch-device emulation to the smoke harness to avoid accepting the loading screen as the completed scene.
- Remaining artistic work and device-specific limitations are listed in docs/CODEBASE-REVIEW.md. This is a review candidate; no public release or final visual acceptance is claimed.
- Follow-up from touch-device capture: compacted the touch radio list to its active station and removed the idle controller footer over touch controls, preventing minimap/control overlap. Typecheck and production rebuild pass; targeted final mobile capture verifies the layout.

- Investigated cold production startup with network evidence: many glTF files requested/decoded identical city texture atlases independently. Enabled shared Three.js image/file caching for the game lifetime (restored and cleared on disposal); targeted fresh-load verification follows.
- Fresh production mobile load now passes with city, cast, fleet and renderer ready; Move/Look touch controls visible, active radio separated from minimap, no overflow or browser errors. Evidence is exported in the task outputs.

## Playable character rebuild — 2026-10-17
- User rejected same-base outfit variations and requested authored playable identities chosen at the beginning. Added Mara/AFTERHOURS, Leon/DEADSTOCK, Imani/PULSE, Rafa/TORQUE, Jules/OFFSCRIPT and Sana/SUNDOWN.
- Added independently sculpted weighted bodies/facial proportions, six chosen skin/hair treatments and separately constructed skinned garments, footwear and split coat hems. Garment hardware shares fabric skin weights to avoid drift during torso/combat animation.
- Replaced the title overlay with an actual animated model selector, turn/walk preview, biographies, personalities, voice directions, keyboard/controller navigation and saved selection. Actual chosen actor persists into gameplay and after reload; economy/property saves are separate.
- 107 game tests, TypeScript and production build pass. Final production character harness passed all six selections and actor identities, front/back walk previews, city locomotion/melee, persistence, keyboard, controller wrapping/start and mobile selection/expanded biography/touch controls, with zero browser errors.
- Existing full gameplay regression passed steering, aimed locomotion, jump/landing, 100->84 melee contact, moving reload/refill, world perimeter and mobile controls. Required standard gameplay client was rerun with full asset readiness enforced; final state is play, all assets ready, selected Mara and vehicle moving. Its earlier capture was loading only and is not accepted evidence.
- Exported the actual model captures and interactive cast review gallery to the task outputs. Source rig/facial topology remain shared Quaternius assets; procedural styling is a review candidate. Accents are written voice directions; recorded character dialogue is not implemented. No deployment or artistic acceptance claimed.

## Arcade cast revision — 2026-10-17
- User rejected the previous torsos and outfits, asked for masculine white male options and named Fuzion Frenzy / SSX as the desired expressive arcade direction.
- Added Rhett/REDLINE, Cole/KICKFLIP and Axel/HEAVY HITTER, first in the nine-character roster. Distinct athletic, lean and broad muscular silhouettes; goggles/racing tee, skate hoodie/headphones, or mohawk/beard/vest and wrist wraps.
- Removed the player tube/coat generator. New reproducible `assets:cast` pipeline fits the existing CC0 modular garment meshes to the original Universal skeleton, preserving bone rotations and weapon/animation compatibility. Nine compact GLBs, each below 10k body triangles, include fitted clothes, independent skin/hair/fabric treatments and skinned brand prints. Residents retain their existing wardrobe.
- Rebuilt the other six physiques and wardrobes with defined waists and less torso depth. Detailed source faces replace modular block faces, with authored jaw/nose proportions. Voice/accent remains written direction.
- Actual close-up/walk captures exposed source arm fragments retained by height-only head filtering. Replaced that filter with head/neck bone support and added a regression for shoulders at head height. Corrected render removes the sleeve/arm overlap.
- 108 game tests, TypeScript and corrected production build pass. First cold production review timed out during Nitro preview's on-demand Brotli compression; network and Nitro source confirmed slow asset compression without browser errors. Local review clients now request gzip. Final production captures and gameplay reports follow.
- Final visual review also caught the female punk source's crest using a different material name; retained/tinted it correctly. Settled CSS animations during captures so selection borders and biographies match the selected actor.
- Final production character regression passes all nine actors, front/back walks, city locomotion/melee, selection reload persistence, keyboard/controller wrapping/start and mobile biography/start/touch input. Browser errors: none.
- Final production gameplay regression passes steering (+0.4437/-0.4437 rad), aimed strafe/backpedal, jump/landing, melee wind-up/contact (100->84 HP), moving reload/refill, outer road/perimeter and mobile controls. Standard client capture is actual play with all assets ready, Rhett selected, and a moving vehicle; no recorded browser errors.
- Exported the updated nine-character gallery and a three-man actual-model board. Source heads and rigs remain shared CC0 assets; the revised art is a review candidate, and voice directions are still text rather than recordings. No deployment or final artistic acceptance claimed.

## Free sourced asset candidate — 2026-10-17
- User rejected the generated/reshaped cast and explicitly requires free assets only. No purchase, subscription, donation or paid generation was used.
- Acquired Diesel directly from THEUNSEENVULGA's free itch.io download. Creator releases it as CC0. Microsoft Rocketbox MIT models were evaluated but not shipped because the ordinary realistic outfits fit the arcade-lead direction less well. Faceless samples were rejected.
- Axel now retains the complete authored Diesel face, hair, goatee, leather jacket, denim, boots, textures and skinning. Other eight characters remain unchanged and unaccepted. Native source models bypass head harvesting, procedural clothing and body stretching.
- Added a reproducible offline import/retarget script, per-character native clip library, meshopt loader, corrected weapon bind basis, support-wrist reach and grounded boot soles. 37 Quaternius CC0 clips; optimized asset about 1.1 MB with 1024px WebP. Provenance, hashes and changes recorded with the asset.
- Visual review caught the old folded-arms preview preset clipping the source jacket; removed it. The physique is preserved from the creator, not fitted through the old torso sculptor.
- 109 game tests, typecheck and production build pass. Khronos validator reports 0 errors, 9 tangent-generation warnings and an informational unsupported meshopt validation note; actual Three.js decoding is verified in browser.
- Host physical controller input interfered with automated captures. QA pages now explicitly isolate physical pads and the character harness still supplies its own controller scenario. Final production render/gameplay evidence is exported separately.
- This is a single sourced character quality candidate. Full wardrobe modularity, recorded voices, the other eight finished characters and artistic acceptance remain open. No merge or public release.
