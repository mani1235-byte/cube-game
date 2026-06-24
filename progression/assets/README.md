# Models

This game's renderer (`script.js`) draws to a single 2D `<canvas id="c">` —
there's no three.js/WebGL pipeline loaded anywhere in the project. Because
of that, the progression system's "3D" visuals (chests, trophies, portals)
are implemented as canvas2D pseudo-3D drawings in `progression/three/*.js`
(skewed-face boxes, faux-perspective shelves, spinning ring portals)
rather than loading real meshes — see the comment at the top of
`progression/three/progression-scene.js`.

The file paths below are wired up in `progression/data/*.js`
(`modelPath` / `portalModel` fields) and are ready to be used **if** a real
three.js renderer gets added to the project later — at that point, swap
the internals of `progression-scene.js` for a `THREE.Scene` and the
existing `registerLayer`-style call sites mostly stay the same. Until
then, these are empty placeholders; drop your own `.glb` exports in here
with matching filenames and the data tables will already point at them.

```
models/
  chests/    wooden.glb  silver.glb  gold.glb  crystal.glb  legendary.glb
  trophies/  bronze.glb  silver.glb  gold.glb  diamond.glb
  portals/   portal_easy.glb  portal_hard.glb  portal_extreme.glb
  xp/        crystal.glb
```
