# Free sourced character quality check

The user rejected the procedural/reshaped cast and requires free assets only.
Do not treat the previous nine-character cast as artistically accepted.

Axel Briggs now uses **Diesel by THEUNSEENVULGA**, a complete, hand-painted
CC0 character with its own modeled face, auburn side-part, goatee, leather
jacket, denim and boots. The other eight selectable characters are unchanged
and remain below the requested finished-asset target. This is one integrated
quality candidate, not a completed cast replacement or an SSX-quality claim.

Creator and download: https://theunseenvulga.itch.io/3d-charater-riggeddiesel
License and modifications: `public/models/sourced/ATTRIBUTION.md`.
Asset measurements/hashes: `public/models/sourced/manifest.json`.

## Reproduce

Download Diesel.glb through the creator's free download option. No purchase,
donation, subscription or paid generation is needed. Then:

```
node --experimental-strip-types scripts/import-diesel.mjs /path/to/Diesel.glb
gltf-transform optimize public/models/sourced/diesel-unoptimized.glb public/models/sourced/diesel.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false
```

The glTF Transform CLI is a build tool, not a runtime dependency. Tested with
4.5.1; retain its version in future asset rebuild reports. Keep intermediate
unoptimized exports outside public/ after optimization. Refresh the manifest
byte count and SHA-256 after rebuilding. `npm run assets:cast` preserves the
native sourced entry rather than feeding it through the old body fitter.

## Integration contract

- Preserve the whole authored head, wardrobe, textures, anatomy and skinning.
- Rename source Mixamo joints to the existing semantic joint names, retaining
  source bind rotations/positions and weights. No Universal head harvesting,
  procedural wardrobe overlay, branding mesh or nonuniform body scaling.
- Bake 37 existing CC0 Quaternius gameplay clips at 30 Hz with bind-pose
  correction and boot-sole grounding. The shorter arms use a support-wrist reach solve on firearm clips.
- Keep per-character clips separate from the shared resident/legacy library.
  Weapon attachment uses the source hand's corrected bind basis.
- WebP textures at 1024px, meshopt decoding via the standard Three.js decoder.
- Preserve `briggs` save ID and all other character/economy saves.

## Scope still open

All eight other playable models need finished source assets. This character
has a fixed goatee/jacket design, not a modular wardrobe; recorded accents,
facial speech/blinking and wardrobe customization are not implemented. Animation
retargets need visual acceptance, especially firearm hand contact, jacket
self-intersection and combat extremes. Native phone GPU performance is untested.

Rocketbox/Microsoft's MIT human library was also downloaded for evaluation,
but its everyday realistic outfits were a weaker match for the requested
expressive arcade leads and are not shipped in this change. Faceless sample
packs were rejected. The paid Fab pack is excluded under the free-only direction.

## Final verification

109 game tests, typecheck and production build pass. Final production character
regression passes all nine selections, persistence, walk previews, keyboard and
explicit controller navigation, and mobile selector/touch accessibility. Native
Axel gameplay regression passes aimed strafing/backpedal, jump/landing, melee
contact (100 to 84 HP after wind-up), moving reload, world perimeter and touch
controls with no browser errors. The native mobile selector is visually checked.
A custom mobile review-camera capture pointed into the model and is not accepted
as on-foot visual evidence; native phone gameplay/GPU acceptance remains open.

The standard gameplay client also passes in the final build with all assets ready.
Its driving scenario uses default Rhett; it is not native-character evidence.
