# Wave Visualization

A single `<canvas>` that morphs between a calm decorative idle loop and a
mic-reactive visualization while recording.

## Two layers

`src/lib/wave-renderer.ts` (pure functions, framework-free) does the drawing;
`src/components/recorder/wave-canvas.tsx` is the thin React wrapper.

### `wave-renderer.ts`

- `defaultStyles(color)` — three sine layers with descending amplitude/opacity
- `advancePhases(styles, deltaMs)` — phase update per layer (different speeds)
- `smoothReactive(freq, bins, prev, smoothing)` — bins down a Uint8Array of
  frequency data into N values and lerps toward the new reading
- `drawWaves({ ctx, styles, reactive?, reactiveBlend })` — draws all layers in
  one pass

### `wave-canvas.tsx`

- Sizes via `ResizeObserver`, accounts for `devicePixelRatio`
- Single `requestAnimationFrame` loop in a `useEffect`
- `blend` interpolates from 0 (idle) to 1 (reactive) over 600ms when `isActive`
  flips
- Picks up theme color (`--fg`) every frame so a light/dark swap is live
- When `stream && isActive`, lazily creates an AnalyserNode (FFT 1024) using
  `attachAnalyser` from `lib/audio-context.ts`

## Why two analysers?

The recorder owns one analyser for the level meter (lives & dies with the
recording). `WaveCanvas` owns its own analyser tied to its `useEffect` cleanup
so component unmount cleanly disconnects.

## Performance notes

- Path is sampled at 1px steps along the canvas width. On a 1200×120 canvas
  that's ~1200 lineTo calls × 3 layers × 60fps = ~216,000 ops/sec. Fine for any
  modern device.
- We re-create the styles array each frame (`advancePhases` returns a new
  array). Trivial GC pressure for 3 small objects per frame; keeps state pure
  and easy to test.
- The renderer functions are pure — `drawWaves`, `advancePhases`,
  `smoothReactive`, `clamp01`, `lerp` are all unit-tested in
  `wave-renderer.test.ts`.

## Reduced motion

`@media (prefers-reduced-motion: reduce)` in `globals.css` flattens all CSS
animations. The canvas loop itself isn't disabled — it would feel broken to
have NO motion at all when recording — but the idle loop's pulse is so subtle
that users with reduced-motion preferences should be fine. Open an issue if
this needs revisiting.
