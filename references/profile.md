# Profile — five axes and a motion signature

Five numbers and one sentence. That is the whole description of the site this skill is
allowed to act on. Every axis is 0–100 and every score carries at least two evidence strings.

The axes exist to make the recommendation arguable. "This site is expressive (74) because it
runs 23 keyframes and three gradient text treatments" can be checked. "This site is modern"
cannot.

---

## 1. RESTRAINED ←→ EXPRESSIVE

**What it measures:** how much visual event is already happening per viewport.

| Raises the score | Lowers it |
|---|---|
| many keyframes / animations | flat, static surfaces |
| gradient text, gradient borders | single accent used sparingly |
| blend modes, glassmorphism, glow | no blur, no shadow beyond elevation |
| multiple saturated colours | monochrome or one accent |
| oversized display type | body-scale type throughout |
| custom illustration, 3D, canvas | stock layout, standard components |

**Compute:** `expressiveness = 0.30·norm(keyframes, 0–24) + 0.20·norm(animationCount, 0–40)
+ 0.20·norm(vividColourCount, 0–4) + 0.15·norm(displaySize, 1.5–6rem)
+ 0.15·(hasGradientText + hasGlass + hasBlend ? 1 : 0)`

**What it changes about the cursor:**

- **0–35** — the cursor is the only moving thing on the page. Keep it small, slow, and
  quiet, or it becomes the whole personality of a site that didn't ask for one.
- **36–65** — the cursor can be noticeable but must not out-perform the content.
- **66–100** — a strong cursor is *expected* here; a plain one reads as unfinished. This is
  the only band where a trail or reveal is the safe default rather than a risk.

---

## 2. PRECISE ←→ ORGANIC

**What it measures:** whether the site's shapes and curves are engineered or grown.

| Raises (organic) | Lowers (precise) |
|---|---|
| large border-radius (12px+, pill) | 0–4px radii, sharp corners |
| overshoot / spring easings | linear, `ease-out`, exact cubic-beziers |
| serif or humanist type | geometric sans, mono, tight tracking |
| texture, grain, hand-drawn marks | flat fills, hard grids |
| asymmetric layout, overlap | strict alignment grid |

**Compute:** `organic = 0.30·norm(medianRadius, 0–20px) + 0.25·overshootRatio
+ 0.25·(serifDisplay ? 1 : 0) + 0.20·(grainOrTexture ? 1 : 0)`

**What it changes:**

- **Precise (0–40)** — the cursor should track *exactly*. High lerp (0.18–0.22), no
  overshoot, hard edges, a ring that snaps rather than drifts. A bouncy cursor on a precise
  site reads as a bug.
- **Organic (60–100)** — lower lerp (0.10–0.14), a settle easing with a hint of overshoot,
  soft edges. The cursor is allowed to lag because the site already lags.

**The common mistake:** assuming a rounded, friendly site wants a playful cursor. A playful
*cursor* on a rounded site is redundant. Contrast is what makes it read as intentional.

---

## 3. DENSE ←→ AIRY

**What it measures:** how much empty space the layout gives each element.

| Raises (airy) | Lowers (dense) |
|---|---|
| `min-height: 100vh` sections | compact rows, tables, lists |
| few elements per viewport | many controls per viewport |
| large `clamp()` padding | tight padding, 8px rhythm |
| long `ch` measures | narrow columns, sidebars |
| one idea per screen | dashboards |

**Compute:** `airy = 0.35·norm(medianSectionPadding, 24–160px) + 0.25·norm(containerWidth,
720–1440px) + 0.20·(hasFullHeightSections ? 1 : 0) + 0.20·(1 − norm(controlDensity, 2–20
per page))`

**What it changes:**

- **Dense (0–40)** — a large cursor covers text and controls it shouldn't. Cap the default
  size at 10–12px and the hover size at 32–40px.
- **Airy (60–100)** — there is room for a 16px dot and an 80px hover ring without obscuring
  anything. Trail and reveal families only work when there is space to travel through.

---

## 4. CALM ←→ ENERGETIC

**What it measures:** the tempo of what already moves.

| Raises (energetic) | Lowers (calm) |
|---|---|
| short durations (<250ms) | long fades (600ms+) |
| many concurrent animations | one transition at a time |
| scroll-driven movement | static scroll |
| rapid state changes, marquees | slow ambient loops |
| hard cuts | crossfades |

**Compute:** `energy = 0.40·(1 − norm(medianTransitionMs, 120–700)) + 0.25·norm(concurrent
Animations, 0–12) + 0.20·(scrollDriven ? 1 : 0) + 0.15·norm(shortestDuration, 80–400ms)`,
inverted for the shortest-duration term.

**What it changes:**

- **Calm (0–40)** — cursor settle 400–500ms, no idle animation, no pulse. Anything that
  loops will be the only loop on the page.
- **Energetic (60–100)** — 250–320ms settle, an idle breath is acceptable, trailing elements
  can keep moving after the pointer stops.

---

## 5. PRODUCT ←→ EDITORIAL

**What it measures:** whether the page is a tool or a piece of writing.

| Raises (editorial) | Lowers (product) |
|---|---|
| display serif + large type | UI sans throughout |
| long-form copy, `prose`, 60ch+ measures | forms, tables, dashboards |
| few controls, one CTA | many controls, repeated actions |
| imagery as content | imagery as decoration |
| narrative scroll sections | task flow |

**Compute:** `editorial = 0.30·(serifDisplay ? 1 : 0) + 0.25·norm(maxDisplaySize, 2–6rem)
+ 0.20·norm(measure, 45–75ch) + 0.15·(1 − norm(controlCount, 2–40)) + 0.10·(longCopy ? 1 : 0)`

**What it changes:**

- **Product (0–40)** — the cursor is a *tool*: precise, quiet, and it must never interfere
  with clicking. Magnetic hover is the ceiling. No labels, no trail, no reveal.
- **Editorial (60–100)** — the cursor is part of the voice. Labels ("View", "Read", "Play"),
  blend-difference, and image reveals are all native to this register.
- **40–60** — the hardest band. Pick the family from the *other* four axes and keep the
  editorial flourishes off.

---

## Motion signature

One sentence, built from measured values. It is not a score, and it is not optional — the
cursor's timings are derived from it.

Format:

> `<n>` keyframes · median transition `<ms>` · `<n>` overshoot curve(s) · scroll-driven:
> `<yes/no>` · reduced-motion block: `<present/absent>` · touch guard: `<present/absent>`

Then two derived numbers:

- **cursor settle** = median transition × 1.2–1.6, clamped to 280–420ms
- **cursor lerp** = `clamp(0.10 + energy/1000, 0.10, 0.20)` for the follower, with the ring at
  0.55–0.65× the dot's lerp

Worked example, a site with median 220ms and energy 47:

- settle = 220 × 1.35 ≈ **300ms**, `cubic-bezier(0.23, 1, 0.32, 1)`
- dot lerp = 0.10 + 0.047 = **0.15**, ring lerp = **0.09**

Higher energy gets a *higher* lerp, because a fast site makes a slow cursor feel broken. The
clamp exists so the formula never produces a cursor that is glued (0.22+) or detached (0.08−).

---

## Reading the profile as a whole

The axes are not independent, and the combinations are what select a family.

| Pattern | Reads as | Family bias |
|---|---|---|
| expressive + editorial + airy | portfolio, agency, launch page | reveal, blend-difference, label states |
| expressive + product + dense | SaaS dashboard with a designed shell | dot + magnetic, nothing else |
| restrained + product + dense | internal tool, docs | native cursor, or 8px dot |
| restrained + editorial + airy | publication, essay, docs site | native cursor; if forced, a 6px dot |
| expressive + energetic + airy | creative studio, event page | trail, reveal |
| restrained + precise + dense | fintech, dev tool | 2px crosshair or native |
| expressive + organic + calm | wellness, boutique, hospitality | soft dot + slow ring, no trail |

If the site lands in a cell that isn't here, say so and justify from the axes rather than
forcing it into the nearest row.

## Confidence

Confidence measures **how much of the site the audit could read**, not how strongly the
analysis feels. Every axis now carries its own level, and so does the profile as a whole.

| Level | Meaning | How to quote it |
|---|---|---|
| **high** | every input came from a parsed stylesheet or markup file, and no blind spot touches the axis | the number, as-is |
| **medium** | a blind spot touches the axis: inline styles, utility classes, CSS-in-JS, component internals | a band of ±5, plus one clause naming the blind spot |
| **low** | nothing readable was found for the axis | not at all — it becomes a gap-fill question |

The blind spots the audit reports, and what each one costs:

- **inline style attributes** — values set in JSX objects never reach a stylesheet, so padding,
  radius and type sizes can be wrong in either direction.
- **utility-class lists** — Tailwind composes values at build time; the class name is not the
  value.
- **CSS-in-JS** — styled-components and emotion generate rules at runtime; a static scan finds
  nothing to measure.
- **PascalCase component tags** — `<Button>` is counted at the call site; what it renders is
  unknown, and the state-label recipe depends on what it renders.
- **no stylesheet** — every CSS-derived axis is a guess.

Rules:

1. One `medium` axis makes the whole profile `medium`. Two `low` axes make it `low`.
2. A `low` axis is `UNKNOWN`, and `UNKNOWN` becomes a question — never a median, never a
   plausible-looking guess.
3. `medium` is the normal state on a modern app. Say so plainly instead of dropping the
   number: "35, ±5 — the audit couldn't read 220 inline styles."
4. Confidence never goes up because the numbers look coherent. Coherence is not evidence.
5. An override (see `SKILL.md`, stage 4) is allowed to raise confidence, but only for the
   axis the cited file actually touches, and only with a file path.

## What a score is not

The five axes are a **decision-support device**. They exist so two runs on the same repo
produce the same ranking, and so a recommendation can be argued with. They are not a
measurement of design quality, and the fit bands are not laws of nature: nobody has shown
that a site scoring 85 in expressiveness is better served by a trail than one scoring 65.

What is defensible:

- the evidence items, each one a fact from the repo;
- the direction of each band (a trail on a form-first page really does cost more than it
  gives);
- the gates, which are structural — glass really does break difference blending.

What is not defensible:

- quoting a fit of 94 as if it were a percentage of anything;
- treating a 2-point gap between families as meaningful;
- overriding a gate because the score was close.
