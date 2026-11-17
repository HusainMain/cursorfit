# Credits and provenance

This skill is a **decision system built on top of published cursor techniques**. The
catalogue of families, the tuning numbers, and the failure lists were harvested from the
skills below. The scoring model, the fit bands, the gate weights, and the recommendation
format are original to cursorfit.

**No source code was copied.** Every snippet in `recipes.md` was written for this skill. What
was taken is technique, structure, and measured values — the parts that are craft knowledge
rather than anyone's implementation.

## Sources

### `custom-cursor-systems` — UltraUI

The closest ancestor. Contributed the mental model (a DOM element translated on every
`mousemove`, native cursor hidden, lerp for trail), the state-machine vocabulary
(`default / hover / drag / text / view / hidden`), the dot-and-ring geometry, the guidance on
keeping the ring's lerp at roughly half the dot's, the `data-cursor` attribute pattern, and
most of the failure list in `gating.md` — `pointer-events`, `position: fixed`, `cursor: none`
after init, no transition on the driven transform, hide on `mouseleave`. Also the
blend-difference caveat about `isolation` and `opacity`.

### `gsap-cursor` — iotron / gsap-cookbook

Contributed the performance lifecycle for pointer effects: a `quickTo`-style tween per element
rather than a new tween per event, explicit `overwrite`, and cleanup on unmount. The magnetic
recipe in `recipes.md` follows that shape with a hand-written lerp instead of GSAP, so the
family has no dependency.

### `cursor-effects` — ikastner

Contributed the React framing: a dot plus an outline, state driven by data attributes, and an
explicit mobile disable. The "auto-disable on touch" behaviour is now rule 3 rather than an
option.

### Meng To — `add-shader-cursor-trail`, `shaders-cursor-ripples`, `pointer-trail-emitter`

Contributed three things that shaped the upper tiers. The **capability gate** pattern — check
WebGPU, pointer type, reduced motion, and document visibility before loading the heavy module,
and keep the gate in a separate module from the effect. The **distance-based emission** for
trails, which is the difference between a ribbon and confetti. And the diagnostic framing for
shader effects, which is why `shader-ripple` is gated behind an existing GPU dependency rather
than offered as an upgrade.

### `cursor-reveal-hero` + `image-layer-alignment-validator` — sergekostenchuk

Contributed the mask-reveal family and, more importantly, the requirement that the two image
layers be verified as aligned. That check is the reason the family's stated disadvantage in
`families.md` is a seam rather than "it costs a canvas".

### `ztx5-pointer-cursor-follower`, `ztx14-motion-cursor-follow` — Realjustawall

Contributed the acceptance-gate structure: a viewport matrix, reduced-motion checks, and the
practice of marking unverified claims `NOT_TESTED` rather than implying success. The
verification section of `recommendation.md` is built on that convention.

### `swarm-cursors` — harshit403-pixel

Reviewed and deliberately excluded. The theatrical tier — a swarm of cursors rebuilding the
page — is a site-wide concept rather than a cursor decision, and its install cost is an order
of magnitude above the rest of the catalogue. It is named in `families.md` so the exclusion is
a decision rather than an omission.

### `cursorkit`

Contributed the T0 details: SVG cursor dimensions, hotspot arguments in `url()`, and the `@2x`
requirement on high-density displays.

### `design-taste-frontend` — the author's own reference

Contributed the tension this skill is built around: a study of 99 Awwwards sites found 28
using custom cursors, while the same reference advises against them because they cost
usability. cursorfit exists to hold both positions at once — offer the effect, price the cost.

## What is original

- The five-axis profile and its scoring formulas
- The per-family fit bands and the penalty function over them
- The hard gates that override fit
- The tier model as a cost axis rather than a quality axis
- The gap-fill rule (three questions, each with a default)
- The "keep the native cursor is a valid verdict" rule, paired with the obligation to still
  offer the lowest-risk option
- The recommendation format, including the mandatory "It will not" line
- The audit helper (`scripts/audit.mjs`)

## Licence

MIT. See `LICENSE`. The techniques above belong to their authors; if you reuse this skill's
scoring model, attribution is appreciated but not required.
