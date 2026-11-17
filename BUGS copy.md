# BUGS / STATUS (honest)

## Latest Fixes & Verifications (Session)
- **Pause shortcut key 'R'**: Pure black color (`#0b0a08 !important`) on yellow `#p-resume` button in `src/style.css`.
- **Road markings & geometry**: Removed sinusoidal wobble on paved roads (`isPaved = 1.0`). Rebuilt markings as continuous curved ribbons conforming to 5.4m asphalt half-width with yellow dashed center lines and solid white shoulder lines.
- **Traffic avoidance & Indian left-lane driving**: Oncoming trucks and autos pinned strictly to right lane (`off = -2.7` to `-2.8`). Swerve avoidance uses damped shoulder steering; eliminated erratic wrong-side crossing and left-right spam.
- **Flying bike & pits removed**: Deleted interval speed breakers and vertical impulse velocity; removed pit zone fall death triggers and black pit circle meshes.
- **Vertical reflection seam artifact**: Replaced invalid 2D canvas `CubeReflectionMapping` with `EquirectangularReflectionMapping` in `src/world/env.js`.
- **Forest free roam**: Added `noRibbon: true` on trails to remove the black mud ribbon. Added open walking zone `L.walk.rect(-120, -30, 120, 230, 'forest_free_roam')` for unconstrained exploration.
- **First-person hands & viewmodel**: Replaced vertical cylinder rods with anatomically sculpted first-person arms extending forward into the screen (-Z) with tapered wrists, palms, opposable thumbs, articulated fingers with fingernails, and rolled shirt cuffs.
- **Phone pull-out animation (P key & torch F)**: Pressing `P` or toggling torch plays smooth pocket-reach and raise animation bringing illuminated 3D smartphone to eye level; closing lowers phone back into pocket.
- **3D Motorcycle rendering (NaN matrix fix)**: Resolved `NaN` vertex indices from corrupted OBJ file by parsing `moto_simple_1.obj`, removing Blender floor plane, and scaling to 0.27 (2.13m length, 1.03m height, 0.77m width) grounded at y=0. Motorcycle renders reliably in yard and street.
- **Chacha street presence**: Spawned Chacha working on his motorcycle across the street from the start of Chapter 1, visible immediately from the front yard.
- **Companion camera separation**: Added 1.45m personal space buffer in `companionUpdate` and `Actor.update(dt)` to eliminate camera clipping when turning around.
- **Build verification**: `npm run build` passes with zero errors (all 66 modules transformed, dist bundle generated).

---

## Still Open / In Progress
- Additional 3D model integration: 22-moto asset for motorcycle options.
- Low-power device optimization: dynamic far-plane LOD reduction during heavy fog scenes.
- Electron native execution validation on desktop environment with GPU acceleration.
