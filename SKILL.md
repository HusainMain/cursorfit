---
name: cursorfit
description: Choose and build the right custom cursor for a website. Audits a repo's palette, typography, motion and layout, scores the site's design character on five axes, then picks one cursor family and implements it using the site's own design tokens. Use when someone asks for a custom cursor, mouse follower, cursor trail, magnetic cursor, blend-mode cursor, dot-and-ring cursor, or asks which cursor style fits their site. Reads a repo or CSS files; no live URL needed.
license: MIT
compatibility: No runtime dependencies. Node 18+ for the optional scripts/audit.mjs reader; Playwright is optional and used only by scripts/verify.mjs for the browser pass. Covers HTML/CSS, Vite/React, Next, Vue, Svelte, Astro, WordPress and Shopify themes.
metadata:
  author: makeityours
  version: "0.2.0"
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
| 1. Audit | `cursorfit.json` — tokens, type, motion, density, controls, and a coverage report |
| 1b. Read | the components, inline styles and utility classes the audit could not read |
| 2. Score | five axes, each with evidence and a confidence level; motion signature |
| 3. Gap-fill | at most three questions, each with a default |
| 4. Decide | safe, reach and fallback — each with its disadvantage; overrides allowed with evidence |
| 5. Build | files written into the repo, wired into the entry point |
| 6. Verify | greps, the build, and a browser pass with `scripts/verify.mjs` |
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

It counts `<Button>` and `<Link>` as well as `<button>` and `<a>`, and it reads a coverage
block: how many stylesheets and markup files it parsed, how many inline styles, utility-class
lists and CSS-in-JS files it could not read, and which five files are worth opening first. A
score is only as good as that coverage, so read `coverage` before reading `scores`.

If the helper can't run, do the same extraction by hand using the signal table in
`references/audit.md`. Every signal in that table maps to a scoring input, so skipping one
means that axis becomes `UNKNOWN` rather than guessed.

## Stage 1b — Read what the audit couldn't

Static analysis has a known blind spot list, and pretending otherwise is how a profile gets
confident about a site it half-read. Open the files in `coverage.hotspots` and answer three
questions for each:

1. **What padding, radius and type size are actually rendered?** Inline styles and utility
   classes hold values the stylesheet scan never saw.
2. **Do the component wrappers change the structure?** A `<Button>` may render a `<div>` with
   a click handler, not a `<button>`. That changes the state-label recipe, which hooks
   `data-cursor` onto a control.
3. **Is there a layout or stacking context the audit could not see?** Sticky wrappers,
   `overflow: hidden` sections, `isolation: isolate`, `backdrop-filter` — any of these can
   move what the cursor sits above.

Rules for this pass:

- Read only the hotspots plus the entry point and layout shell. Not the whole repo.
- If a hotspot changes a measured value by more than ~20%, record the corrected value and say
  in the report that it came from reading, not from the script.
- If a hotspot can't be resolved (generated styles, a build-time theme), downgrade the
  affected axis to `medium` and say which file caused it.
- Never re-run the audit to make a number nicer. The script's output is evidence, not a draft.

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
4. **Every score carries a confidence.** `high`, `medium` or `low`, from the audit's coverage
   block. A medium score is quoted as a band, not a number. A low score is not quoted at all —
   it becomes a gap-fill question. Full rules in `references/profile.md`.

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

Score every family in `references/families.md` against the profile, then apply the hard gates.
Fit is a floor of 80, not a rank, and the output is three named slots rather than a menu:

- **safe** — the highest-fit eligible family. This is what gets built if the owner says nothing.
- **reach** — the most expressive eligible family at most one tier above safe and within 10 fit
  points of it. The "what if I want more" answer. It may be empty.
- **fallback** — `css-static` when it is eligible, otherwise the cheapest family left. The
  answer to "nothing moving, thanks".

`magnetic` is a modifier: add it to one or two elements of whichever slot is built, never as a
slot itself. Only one slot is ever built.

Each slot carries its disadvantage in the same breath, not in a footnote:

> **Reach — mask reveal.** Highest expressive floor of the eligible set; it costs a canvas
> layer over every project image, and it will look broken on any card whose image fails to
> load.

A menu hands the decision back to the person who asked for it. Three slots do not — they are an
answer, a stretch, and a floor.

**"Keep the native cursor" is a valid verdict.** When the site is reading-heavy, form-heavy,
or accessibility-critical, say so — then still offer the lowest-risk slot and its cost, because
the person asked for a cursor and refusing outright helps nobody. An empty reach is the same
honesty: it means no louder family still fits, not that the question went unanswered.

**You may override the pick, but never silently.** The numbers are decision support, not a
measurement, and the audit does not know what it could not read. An override is allowed when
the coverage pass found something the script missed — a real interaction pattern, a component
that changes the control structure, a stacking context the CSS scan couldn't see — or when the
buyer states a constraint the repo cannot hold. To claim one, state all four:

1. the slot the audit chose and its fit,
2. the specific evidence that changes it, with a file path or a measured value,
3. the slot you are replacing it with,
4. what the reader loses by taking the override.

The golden set in `test/golden/` records two places the model is known to be wrong: fit rewards
the family with the widest bands, and a reach can never jump two tiers. If either decides the
case, name it instead of presenting the pick as settled.

An override with no file path is taste. Taste is allowed in the last mile — size, easing, the
exact label — never in the choice of family.

## Stage 5 — Build

Complete implementations for every family live in `references/recipes.md`. Copy the recipe,
then change only what the profile says to change.

Non-negotiables:

- **Colour comes from a token, never a new hex.** Bind to the strongest brand colour the
  audit found (`var(--neon-cyan)`, `theme('colors.accent')`, an exported constant). A
  hardcoded `#00f0ff` is the difference between "matches your site" and "matches the site
  it was copied from".
- **The base state layer ships with every family.** Link, button, text and disabled are
  resolved in `cursor.js` and styled in `cursor.css` before any family code is added. No
  family deletes them; `dot` only turns the numbers down. A cursor that does nothing when it
  crosses a button is unfinished — the visitor has no way to tell it from a sticker.
- **Labels are the enhancement, not the state.** `[data-cursor]` adds a word on top of a
  state that already exists. If the build only reacts where the site was annotated, the state
  layer is missing.
- **T1 family code stays under ~90 lines, on top of the shared core.** That is a T1 promise,
  not a rule for every tier: a T2 or T3 family is allowed to be long, because that is what the
  tier is for. If a T1 family needs more than ~90 lines, the family is wrong for the site. The
  core is ~100 lines once, because it now carries the state layer for every family.
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

Three levels, in order. Each one catches what the previous one can't.

**1. Greps.** Run the static checks in `references/gating.md`. They are greps, not opinions:
`pointer-events`, `position: fixed`, `aria-hidden`, coarse-pointer guard, reduced-motion
guard, no `transition` on `transform`, hide on `mouseleave`, blend-context check.

**2. Build.** `npm run build` or `tsc --noEmit`. A cursor that breaks the build is not shipped.

**3. Browser.** Greps prove the code says the right things; they cannot prove the cursor
works. If Playwright is available, run the harness:

```bash
node scripts/verify.mjs http://localhost:3000 --cursor .cf-cursor --json verify.json
```

It opens the page and checks what a grep cannot: the element exists and is visible, it has
`pointer-events: none`, it lags then converges, hover changes its state, a click still reaches
the control underneath, focus keeps its ring, a route change doesn't spawn a second one, the
console stays clean, a tap doesn't make it appear, and `prefers-reduced-motion` disables the
follow. Ten checks run by default; add `--modal "#trigger"` for an eleventh that opens an
overlay and compares its stacking against the cursor.

Playwright is the only optional dependency in the package. If it isn't installed, or the page
can't be served, do the same eleven checks by hand at 1366×768 and 390×844 — and if you don't,
the report says `NOT_TESTED: rendered behaviour` in those words. Never imply you saw it.

A skipped check is not a pass. `verify.mjs` prints skips separately for that reason: it means
the page didn't expose enough to test, and the report has to say which check was skipped and
why.

## Stage 7 — Report

Use `references/recommendation.md`. The report always ends with two lists: **what to look
at** and **what is deliberately disabled**.

## Limits

- **Code is not the render.** The audit reads source. A `backdrop-filter`, a stacking
  context, or a `transform` on an ancestor can change what the cursor looks like, and source
  won't show it.
- **Static analysis only sees what it can parse.** Styling can live in inline objects, utility
  classes resolved at build time, CSS-in-JS, or component internals. The audit counts what it
  missed, names the files worth opening, and lowers confidence — it does not paper over the gap.
- **Browser verification needs a browser.** `scripts/verify.mjs` requires Playwright and a
  running page. Without it, behaviour stays `NOT_TESTED`, and the report must say so.
- **Scores are heuristics, not measurements.** They rank families against a site. They do
  not predict conversion, taste, or whether the client's boss likes it.
- **Fit rewards the widest bands.** A family with opinions it can satisfy almost anywhere
  (`dot-ring`: expressive 30–80, airy 30–100) sits at or near 100 and wins by default, while a
  family with a narrower opinion loses for holding it. `test/golden/` records this as a known
  gap rather than hiding it.
- **A reach cannot jump two tiers.** The cap that stops a T3 being offered to a T1 site also
  means the GPU family is unreachable on a site whose safe pick is cheap — even one that
  already runs WebGL.
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
