# Cursor families — the catalogue

Nine families, four tiers. A family is a **shape of behaviour**, not a look. The look is
supplied by the site's tokens; the family decides how the thing moves and what states it has.

Tier is cost, not quality. A T0 cursor that fits beats a T3 cursor that doesn't.

| ID | Tier | What it is | Own layer | Deps |
|---|---|---|---|---|
| `css-static` | T0 | `cursor: url(…)` — one image, one hotspot | 0 | none |
| `dot` | T1 | one small follower with lerp | ~25 lines | none |
| `dot-ring` | T1 | dot tracks exactly, ring trails behind | ~45 lines | none |
| `state-label` | T1 | the base states plus a word, resolved from `data-cursor` | ~85 lines | none |
| `magnetic` | T1 | elements pull toward the pointer inside a radius | ~60 lines | none (GSAP optional) |
| `blend-difference` | T1 | `mix-blend-mode: difference` cursor that inverts | ~40 lines | none |
| `trail` | T2 | canvas particles emitted along the pointer path | ~90 lines | none |
| `mask-reveal` | T2 | cursor is a canvas mask revealing a second image | ~110 lines | none |
| `shader-ripple` | T3 | GPU shader distortion / halftone following the pointer | ~150 lines | existing `three`/`ogl` |

Own layer is a comparative estimate of the family's own code; every family except `css-static`
also ships the shared core in `recipes.md` — about 100 lines, state layer included. The column
compares families, not installs.

The theatrical tier — swarms, drawn characters, full-page cursor takeovers — is deliberately
not in this catalogue. It is a site-wide concept, not a cursor choice, and its cost is an
order of magnitude above everything here.

---

## Fit bands

Each family declares a comfortable range on all five axes from `profile.md`. A band is a
**tolerance, not a target**: inside it costs nothing, outside it costs.

Scoring: for each axis the family misses, take the distance outside the band, divide by 30,
cap at 1, and knock 45% off the family's score. **The penalties compound**, because a family
has to fit the whole site rather than win on average. A band of `0–100` means "no preference"
and is skipped.

```
fit = 100 × Π (1 − 0.45 × min(1, distance / 30))
```

Two axes badly missed lands around 30. One axis badly missed lands around 55. Everything
inside lands at 100 — which means "no axis rules it out", not "guaranteed good". Fit is a
rank, not a probability.

It is also not a measurement of quality. Nobody has shown that a site at 85 expressiveness is
better served by a trail than one at 65 — the bands encode "designed for", not "proven on".
Read the ordering as a consistent argument you can push back on. Two things outrank it, in
this order: a hard gate, and an override with a file path.

Read `[lo, hi]` as "this family was designed for sites scoring in this range".

| Family | Expressive | Organic | Airy | Energy | Editorial |
|---|---|---|---|---|---|
| `css-static` | 0–45 | 0–100 | 0–100 | 0–55 | 0–100 |
| `dot` | 0–60 | 0–100 | 0–100 | 0–65 | 0–60 |
| `dot-ring` | 30–80 | 0–70 | 30–100 | 25–80 | 0–75 |
| `state-label` | 55–100 | 0–85 | 40–100 | 40–100 | 50–100 |
| `magnetic` | 40–90 | 0–100 | 0–100 | 40–100 | 0–65 |
| `blend-difference` | 60–100 | 30–85 | 20–100 | 30–90 | 55–100 |
| `trail` | 70–100 | 30–100 | 55–100 | 65–100 | 40–100 |
| `mask-reveal` | 75–100 | 20–100 | 50–100 | 40–95 | 65–100 |
| `shader-ripple` | 80–100 | 30–100 | 40–100 | 60–100 | 50–100 |

`magnetic` is a **modifier**, not a candidate. It is applied on top of another family to one
or two elements; it can never be the answer to "which cursor should my site have".

### Hard gates

These override the score. A family that fails a gate is not offered, regardless of fit.

| Gate | Effect |
|---|---|
| no GPU/shader pipeline **imported in code** | blocks `shader-ripple` (a `three` entry in `package.json` that nothing imports does not count) |
| fewer than 4 images/media with a hover target | blocks `mask-reveal` |
| fewer than 3 hoverable controls | blocks `state-label` |
| form fields ≥ 60% of controls | blocks `trail`, `mask-reveal`, `blend-difference` |
| an existing GPU canvas in the hero | `trail` becomes alternate-only — two canvas effects compete |
| `backdrop-filter` / `isolation` on the cursor's ancestors | `blend-difference` becomes alternate-only — difference blending cannot reach the surface behind a stacking context |
| T1 budget exceeded (>90 lines) | the family is wrong; step down a tier |

---

## What each family is actually for

### `css-static` — T0

A single image cursor set in CSS. No JS, no state, no animation.

- **Fits:** restrained, precise, dense sites where any movement is noise.
- **Best for:** dashboards, tools, forms, docs.
- **Worst for:** anything that expects the cursor to be part of the design.
- **Cost:** one rule. Cannot animate, cannot change on hover, cannot carry a label.
- **Disadvantage to state:** it is a bitmap mostly drawn by the OS. It will look slightly
  different on Windows, macOS, and Linux, and it cannot be resized or recoloured at runtime.

### `dot` — T1

A small circle following the pointer with lerp. The native cursor is hidden. The base state
layer is still there, at the smallest values in the catalogue: a link opens a 15px ring, a
button stretches the dot into an 18×10px capsule, a field hands the caret back.

- **Fits:** restrained to moderately expressive sites that want polish, not personality.
- **Best for:** product sites, SaaS marketing, portfolios with quiet confidence.
- **Worst for:** editorial pages, where a mark with no labels has nothing to say about the work.
- **Cost:** a few CSS tokens over the shared core; no extra JS.
- **Disadvantage:** it is the least informative family. It removes the OS cursor and replaces it
  with a mark that is deliberately quiet — no labels, no trailing ring, no trail. What it keeps
  is the part that is not optional: links, buttons and fields still look different under it.

### `dot-ring` — T1

Dot tracks the pointer closely; a larger ring trails behind at roughly half the lerp. The
classic "designer portfolio" cursor.

- **Fits:** moderate expression, moderate airiness, calm to mid energy.
- **Best for:** agencies, studios, product launches, anything with large images.
- **Worst for:** dense tools, where the ring covers the control you're aiming at.
- **Cost:** one extra element and a second lerp; still one RAF loop.
- **Disadvantage:** the ring is a large empty circle that follows you everywhere. On a page
  with many small controls it is a persistent obstruction, and the 2:1 lerp ratio that makes
  it feel good is also what makes it feel disconnected on fast movement.

### `state-label` — T1

The base states plus a word: "View", "Read", "Play", "Drag" — from `data-cursor` on the hovered
element. The states work without any markup; the labels are the enhancement.

- **Fits:** expressive, editorial, airy sites — the family for a site that has a voice.
- **Best for:** portfolios, launch pages, editorial, agencies, anything with project cards.
- **Worst for:** product UI and dense tools. Labels are a promise that every hoverable thing
  has been given a considered state.
- **Cost:** the shared core, a label block of CSS, and the attributes you annotate.
- **Disadvantage:** the labels only appear where someone added `data-cursor`, so the value of
  the family depends on how much markup you are willing to annotate. An unlabelled card gets
  the ordinary link ring — which works, but is not the thing you bought.

### `magnetic` — T1

Buttons and cards translate toward the pointer within a radius, then snap back on leave.

- **Fits:** expressive, product-leaning, mid-to-high energy sites.
- **Best for:** a single hero CTA, pricing cards, nav items. Works best used **sparingly**.
- **Worst for:** editorial reading pages, where it makes text jump.
- **Cost:** ~60 lines, or the GSAP `quickTo` recipe.
- **Disadvantage:** applied broadly it makes the layout feel unstable, and it breaks the
  expectation that a button stays where it is. Magnets should be used on one or two elements,
  which means it is a garnish, not a cursor system.

### `blend-difference` — T1

A cursor that inverts whatever is beneath it via `mix-blend-mode: difference`.

- **Fits:** highly expressive, editorial, contrast-rich sites.
- **Best for:** portfolios and editorial sites with large light/dark image areas.
- **Worst for:** glass, gradients, and low-contrast sections, where it turns muddy grey.
- **Cost:** ~40 lines.
- **Disadvantage:** it only looks intentional over pure black and pure white. Over a gradient,
  a photo, or a `backdrop-filter` panel it inverts to an unpredictable colour — and it
  disappears entirely inside any ancestor with `opacity < 1` or `isolation: isolate`.

### `trail` — T2

A canvas layer emitting particles along the pointer path, by distance travelled rather than
per frame (so a fast flick draws a ribbon, not scattered dots).

- **Fits:** highly expressive, high energy, airy sites.
- **Best for:** creative studios, event pages, launch moments, music.
- **Worst for:** anything with a canvas already, anything text-heavy.
- **Cost:** ~90 lines plus a full-viewport canvas at `pointer-events: none`.
- **Disadvantage:** it is a second animation system competing with the page's own. On a site
  that already runs a 3D hero, the two read as noise rather than depth, and it is the family
  most likely to be called "distracting" in review.

### `mask-reveal` — T2

The cursor is a circular canvas mask; inside it, a second version of an image (colour,
alternate angle, "before") is revealed.

- **Fits:** very expressive, editorial, airy, image-led sites.
- **Best for:** photography, architecture, fashion, case-study grids.
- **Worst for:** sites without a strong image set. It has nothing to reveal.
- **Cost:** ~110 lines plus a paired image per target.
- **Disadvantage:** it doubles the image payload on every target and depends on the two layers
  being pixel-aligned. Any misalignment shows up as a visible seam at the mask edge, and on a
  card whose image fails to load the effect looks broken rather than absent.

### `shader-ripple` — T3

A GPU shader distorts, ripples, or halftones the content following the pointer.

- **Fits:** maximally expressive sites that already ship a renderer.
- **Best for:** hero sections with an existing WebGL/WebGPU layer.
- **Worst for:** everything else. It is the highest-cost, highest-risk family.
- **Cost:** ~150 lines, a capability gate, and a renderer that must already be in the bundle.
- **Disadvantage:** it only works on hardware that supports it, it needs a static fallback
  that someone has to design, and it is the single easiest way to turn a fast site into a
  hot laptop. Never offer it unless the dependency is already paid for.

---

## How to choose between near-ties

A gap under **2.5 points is not a preference**. The bands are heuristics; 93 against 91 means
the two families fit the site about equally well. The audit settles that case mechanically:
inside the band, a family **in the same tier** that reacts to more of the controls the site
actually has wins, and the swap is printed as `TIE-BREAK` so the report can show it. It never
crosses a tier — at equal fit the cheaper family is the safer answer, and a T1 does not get to
leapfrog a T0 on state count. The rules below are the human version of the same judgement, for
gaps the script leaves alone.

1. **Prefer the family that does more at a control.** If two families fit within 2.5 points and
   one has labels, take the one with labels — a state system is what the visitor notices.
2. **Prefer the lower tier.** If `dot-ring` and `trail` score within 8 points, take `dot-ring`.
3. **Prefer the family that uses controls that exist.** `state-label` needs hoverable groups;
   if the audit found 2, it can't carry labels.
4. **Prefer the family whose failure is quiet.** A broken trail is invisible; a broken
   blend-difference cursor is a grey smudge in the middle of the page.
5. **Break ties with the motion signature.** If the site already has 20+ keyframes, adding a
   continuously animating cursor is the difference between "alive" and "busy".

None of these rules may override a hard gate, and none of them may revive a family the audit
blocked. A tie-break changes the order of two eligible families, nothing more.
