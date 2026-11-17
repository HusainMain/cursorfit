---
name: cursorfit
description: Choose and build the right custom cursor for a website. Audits a repo's palette, typography, motion and layout, scores the site's design character on five axes, then picks one cursor family and implements it using the site's own design tokens. Use when someone asks for a custom cursor, mouse follower, cursor trail, magnetic cursor, blend-mode cursor, dot-and-ring cursor, or asks which cursor style fits their site. Reads a repo or CSS files; no live URL needed.
license: MIT
compatibility: No runtime dependencies. Node 18+ only for the optional scripts/audit.mjs helper; the audit can also be done by reading files directly. Covers HTML/CSS, Vite/React, Next, Vue, Svelte, Astro, WordPress and Shopify themes.
metadata:
  author: makeityours
  version: "0.1.0"
---

# cursorfit

A custom cursor is a design decision with a usability bill attached. Most cursor skills
sell the effect and skip the bill. This one reads the site first, decides whether the bill
is worth paying, and only then builds.

The promise in one line: **the cursor matches this site, or you get told why it shouldn't
have one.**

## What this answers

- Should this site have a custom cursor at all?
- Which family, in *this* site's colours, at *this* site's speed?
- What does it do over a button, an image, a paragraph, a disabled control, a touchscreen?

## The rule that keeps this honest

Every claim in the recommendation must cite something found in the repo: a file, a token,
a measured value, a count. If it can't, it is an opinion and gets labelled as one. "The site
feels modern and minimal" is not evidence and must never appear in the output.

## Pipeline

| Stage | Output |
|---|---|
| 0. Read the repo | framework, file map, existing cursor code |
| 1. Audit | `cursorfit.json` — tokens, type, motion, density, controls |
| 2. Score | five axes, each with evidence; motion signature |
| 3. Gap-fill | at most three questions, each with a default |
| 4. Decide | one primary + two alternates, each with its disadvantage |
| 5. Build | files written into the repo, wired into the entry point |
| 6. Verify | static gate checks; what couldn't be checked is declared |
| 7. Report | the format in `references/recommendation.md` |

Do not skip from stage 1 to stage 4. The scoring is what stops the answer from being taste
dressed up as analysis.

## Stage 0 — Read before deciding

Map the repo before scoring it. You need to know:

- **Framework**, because it decides where the cursor mounts and whether `cursor: none` on
  `body` will be overridden by a component library.
- **Where the real styles live.** One `tailwind.config` plus a 2,000-line hand-written CSS
  file is common, and the hand-written file usually wins. Score the file that renders.
- **Whether a cursor already exists.** Search for `cursor: none`, `cursor: url(`,
  `data-cursor`, `mousemove`, `mouse-follow`, `custom-cursor`. If one exists, this is a
  repair job before it's a design job — see `references/gating.md`.

## Stage 1 — Audit

Run the helper if Node is available:

```bash
node scripts/audit.mjs <repo-path> --out cursorfit.json
```

It is a static reader. It opens no browser and sends no network request. It extracts
dependencies, colour tokens, font stacks, keyframes, easings, durations, spacing, control
counts, existing cursor code, and whether the accessibility guards already exist.

If the helper can't run, do the same extraction by hand using the signal table in
`references/audit.md`. Every signal in that table maps to a scoring input, so skipping one
means that axis becomes `UNKNOWN` rather than guessed.

## Stage 2 — Score

Five axes, each 0–100, plus a motion signature. Full rubrics in `references/profile.md`.

```
RESTRAINED  ──────────▓▓▓  74  EXPRESSIVE
PRECISE     ▓▓▓▓▓▓▓▓░░░░  58  ORGANIC
DENSE       ▓▓▓░░░░░░░░░  31  AIRY
CALM        ▓▓▓▓▓▓░░░░░░  47  ENERGETIC
PRODUCT     ▓▓▓▓▓▓▓▓▓░░░  68  EDITORIAL
```

Rules:

1. **Two evidence items minimum per axis.** Fewer means `UNKNOWN`, and `UNKNOWN` becomes a
   gap-fill question, not a median guess.
2. **Scores describe the site, not the cursor.** A restrained site is not asking for a
   restrained cursor; it's telling you a loud one would be the only loud thing on the page.
3. **The motion signature is measured, not felt.** Record the actual easing curves, the
   median duration, the keyframe count, and whether anything springs or overshoots.

## Stage 3 — Gap-fill

Ask at most three questions, and only for axes that came back `UNKNOWN` or for facts a repo
cannot hold. Every question ships a default, so "I don't know" still produces a decision.

The three that are usually worth asking:

1. **Who lands on this page first?** Customers evaluating a product / developers reading
   docs / clients judging a portfolio. *Default: customers.*
2. **How much personality is the cursor allowed to carry?** Polish only / noticeable /
   signature. *Default: noticeable.*
3. **Any colour that must or must not be used?** *Default: the repo's most saturated brand
   token.*

Never ask what the repo already answers. Never ask a cosmetic question the model can decide.
If the answer changes nothing about the recommendation, it wasn't a question.

## Stage 4 — Decide

Score every family in `references/families.md` against the profile, then apply the hard
gates. `magnetic` is a modifier — it is added to the chosen family on one or two elements and
can never be the primary. Output **one primary and two alternates**. Never a flat menu — a
menu hands the decision back to the person who asked for it.

Each alternate carries its disadvantage in the same breath, not in a footnote:

> **Alternate B — mask reveal.** Strongest editorial fit of the three; it costs a canvas
> layer over every project image, and it will look broken on any card whose image fails to
> load.

**"Keep the native cursor" is a valid verdict.** When the site is reading-heavy, form-heavy,
or accessibility-critical, say so — then still offer the lowest-risk option and its cost,
because the person asked for a cursor and refusing outright helps nobody.

## Stage 5 — Build

Complete implementations for every family live in `references/recipes.md`. Copy the recipe,
then change only what the profile says to change.

Non-negotiables:

- **Colour comes from a token, never a new hex.** Bind to the strongest brand colour the
  audit found (`var(--neon-cyan)`, `theme('colors.accent')`, an exported constant). A
  hardcoded `#00f0ff` is the difference between "matches your site" and "matches the site
  it was copied from".
- **T1 stays under ~90 lines of JS.** If it needs more, the family is wrong for the site.
- **`cursor: none` is applied by JS after the first frame**, never in static CSS. If the
  script fails, the user keeps a working cursor.
- **Mount once.** A cursor mounted per route gives you two, then three.
- **Touch gets nothing.** Not a smaller cursor. Nothing.

Vanilla ships as `cursor.css` + `cursor.js` and one `<script defer>` line. React ships as
one component plus the same CSS, mounted above the router.

Two ready-made asset sets exist so the build doesn't stall on artwork:

- `assets/shapes.css` — seven silhouettes (circle, ring, square, crosshair, pill, bracket,
  blob). Add one class to the mark; the silhouette choice comes from the profile.
- `assets/cursors/*.svg` — four image cursors with their hotspot values, for the T0 family.
  White with a dark outline so they survive both light and dark sections.

Copy the files into the repo (usually `public/cursors/` and `src/styles/`), don't reference
this skill's folder at runtime.

## Stage 6 — Verify

Run the static checks in `references/gating.md`. They are greps, not opinions: `pointer-events`,
`position: fixed`, `aria-hidden`, coarse-pointer guard, reduced-motion guard, no `transition`
on `transform`, hide on `mouseleave`, blend-context check.

Then the build must still pass: `npm run build` or `tsc --noEmit`. A cursor that breaks the
build is not shipped.

If a browser is available, check it at 1366×768 and 390×844. If not, the report says
`NOT_TESTED: rendered appearance` in those words. Never imply you saw it.

## Stage 7 — Report

Use `references/recommendation.md`. The report always ends with two lists: **what to look
at** and **what is deliberately disabled**.

## Limits

- **Code is not the render.** The audit reads source. A `backdrop-filter`, a stacking
  context, or a `transform` on an ancestor can change what the cursor looks like, and source
  won't show it.
- **Scores are heuristics, not measurements.** They rank families against a site. They do
  not predict conversion, taste, or whether the client's boss likes it.
- **No live URL.** By design — a link would let the skill skip the repo, and the repo is
  where the tokens are. The cost is that rendered states are unverified.
- **T3 needs existing GPU dependencies.** A WebGPU shader is only offered when the repo
  already ships `three`, `ogl`, or a shader pipeline. Adding a 600KB renderer for a cursor is
  not a design decision.
- **No invented brand colour.** If the audit finds no usable accent, that becomes a question,
  not a default.
- **The theatrical tier is out of scope** — swarm cursors, drawn characters, full-page
  cursor takeovers. They are site-wide gags, not cursor decisions, and they cost more than
  the rest of this skill combined.

## Failure modes this skill exists to prevent

| Symptom | Cause |
|---|---|
| Cursor invisible on phones, page unusable | `cursor: none` without a coarse-pointer guard |
| Clicks pass through the page but nothing happens | custom cursor element missing `pointer-events: none` |
| Cursor frozen at top-left until first mouse move | no initial position, and no hide until first move |
| No text caret in inputs | `cursor: none` applied to `input`/`textarea` |
| Cursor visible over one section, gone over another | blend mode inside an `isolation: isolate` or `opacity < 1` ancestor |
| Two cursors after navigation | component mounted per route |
| Feels laggy while scrolling | lerp too low, or a `transition` on `transform` fighting the RAF loop |
| Stuck on screen after the mouse leaves the window | no `mouseleave` handler on `document` |

Full causes and fixes: `references/gating.md`.
