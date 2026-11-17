# Audit — what to read, and what each signal means

The audit produces one JSON object. Nothing in it is inferred from a screenshot; every field
is a string, count, or list copied out of a file. `scripts/audit.mjs` writes this shape.

## Repo shape

| Field | Where it comes from | Why it matters |
|---|---|---|
| `framework` | `package.json` deps, file extensions, config files | decides mount point and how `cursor: none` is applied |
| `depList` | `dependencies` + `devDependencies` | unlocks tiers: `three`/`ogl` → T3, `gsap` → magnetic/trail recipes, `framer-motion` → matched easing |
| `styleFiles` | every `.css`, `.scss`, `.pcss` outside build dirs | the file that renders usually isn't the one in `tailwind.config` |
| `entryPoints` | `index.html`, `src/main.*`, `src/App.*`, `pages/_app.*`, `layout.tsx` | where the cursor gets wired in |
| `pageCount` | count of routes/pages | a 1-page site and a 40-page app take different families |

Ignore: `node_modules`, `.git`, `dist`, `build`, `.next`, `.nuxt`, `.svelte-kit`, `out`,
`coverage`, `vendor`, `.cache`.

## Colour

Extract **in this order**, because the later sources are usually stale:

1. CSS custom properties in `:root` — `--name: #hex | rgb() | hsl()`
2. Tailwind `theme.extend.colors` (and `theme.colors` if extended)
3. Tailwind v4 `@theme { --color-name: … }`
4. Repeated hex literals in CSS (count them; a value used 20 times is a token in all but name)
5. `theme.extend.backgroundImage` gradients

Then classify each colour:

- **neutral** — saturation < 0.12, or lightness < 0.06, or > 0.95
- **accent** — saturation ≥ 0.55 and lightness between 0.30 and 0.85
- **surface** — the dominant background values
- **text** — the dominant foreground values

Record `accentCandidates` sorted by (saturation × frequency). The first one is the cursor
colour *unless* the site is monochrome, in which case the cursor uses the text colour at a
lower opacity. That distinction matters: a monochrome site with a coloured cursor has a
coloured cursor as its only colour.

Also record `hasGradientText`, `hasGlass` (`backdrop-filter` present), and `colorMode`
(`dark` if body/`html` background luminance < 0.2).

## Typography

| Signal | Pattern | Meaning |
|---|---|---|
| `fonts` | Google Fonts `<link>` families, `@font-face` names, `font-family` declarations | the site's voice |
| `serifDisplay` | a serif in a heading rule or a `font-serif` utility used at display size | editorial signal |
| `mono` | any monospace in UI copy | technical signal |
| `maxDisplaySize` | largest `font-size` in `clamp()`/`rem` on `h1`, `.hero`, `display` classes | expression signal |
| `measure` | `max-width: NNch` values | editorial signal |
| `letterSpacingTight` | negative `letter-spacing` on headings | contemporary/display signal |

A site with a display serif at 5rem and 60ch measures is editorial regardless of how many
buttons it has. That combination outranks control count.

## Motion

| Signal | Pattern | Meaning |
|---|---|---|
| `keyframes` | `@keyframes <name>` | ambient motion budget already spent |
| `animationCount` | `animation:` / `animate-` utility count | same |
| `easings` | `cubic-bezier(…)`, `linear`, `ease-*` | the site's motion dialect |
| `overshoot` | cubic-bezier with a y value outside `[0,1]`, or `back`/`elastic`/`spring` | playful vs precise |
| `durations` | `NNms`, `N.Ns` in `transition`/`animation` | median = the site's tempo |
| `transitionCount` | `transition:` declarations | how much the site already moves on hover |
| `scrollDriven` | `position: sticky` + tall sections, `IntersectionObserver`, `useScroll`, `scroll-timeline` | cinematic vs static |
| `hasReducedMotion` | `prefers-reduced-motion` | existing accessibility floor |
| `hasCoarseGuard` | `pointer: coarse` / `hover: none` | existing touch handling |

The **motion signature** is a single sentence built from these, e.g.:

> 23 keyframes, median transition 220ms, one overshoot curve
> `cubic-bezier(0.23, 1, 0.32, 1)`, scroll-driven hero via sticky + 560vh, reduced-motion
> block present.

The cursor must be *slower* than the fastest thing on the page and *faster* than the
ambient loops. Median transition duration is the anchor: cursor settle ≈ 1.2–1.6× the median.

## Layout and density

| Signal | Pattern | Meaning |
|---|---|---|
| `containerWidth` | `max-width` values ≥ 600px | how much horizontal room the cursor travels |
| `sectionMinHeight` | `min-height: NNvh` | full-screen moments → trail/reveal families earn their keep |
| `radiusScale` | `border-radius` values | large radii → soft/organic; 0–4px → precise/technical |
| `spacingScale` | `padding`/`gap` clamp medians | airiness |
| `blurLayers` | `backdrop-filter`, `filter: blur()` | glass surfaces → blend-mode cursors misbehave across them |

## Interaction surface

Count in markup (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`):

- `buttons`, `links`, `inputs`, `textareas`, `images`, `canvases`, `videos`
- `data-cursor` occurrences (existing per-element cursor labels)
- `onMouseMove` / `mousemove` listeners (existing pointer logic that may conflict)

Count both spellings. `<button>` and `<Button>`, `<a>` and `<Link>`, `<img>` and `<Image>` are
the same thing to a visitor and different things to a regex. A Next app can hide every control
from a lowercase-only scan, which is why the audit reports `componentTags` separately — it tells
you how much of the count came from a component call site whose internals were never seen.

Also count CSS `background-image: url(...)`. A hero built from background images is media for
the purpose of a reveal even though it never appears in the markup.

A page with 40 links and 2 buttons is a reading page with navigation. A page with 12 buttons
and 3 inputs is a tool. The state machine should be sized to the controls that actually exist —
a `view` state with nothing to attach it to is dead code.

## Coverage

Counts are only as good as what the reader could parse, so the audit reports its own limits:

| Field | Meaning |
|---|---|
| `inlineStyles` | `style={{…}}` / `style="…"` attributes — values that never reach a stylesheet |
| `utilityClassLists` | class lists with two or more Tailwind-shaped tokens |
| `cssInJsFiles` | files importing styled-components or emotion, or using `styled.` / `css\`` |
| `componentTags` | PascalCase controls and media found at the call site |
| `cssBackgroundImages` | `url(...)` in `background` / `background-image`, excluding data URIs |
| `hotspots` | the five files most likely to hold the unread styling |
| `blindSpots` | human-readable list of what the scan could not read |

These feed the confidence on each axis. They do not change the scores — a site with 177 inline
styles is still that site. They change how loudly the score may be stated.

## What the audit cannot know

Two categories, handled differently.

**Blind spots** — the code exists but the parser can't read it. These are counted, reported, and
must be opened by hand before the score is trusted:

- inline styles and utility classes (values live in JSX or in the build)
- CSS-in-JS (rules are generated at runtime)
- component internals (`<Button>` may render a `<div>` with a click handler)
- runtime layout: sticky wrappers, `overflow: hidden`, `isolation: isolate`, `backdrop-filter`
- media queries that change the whole layout at a breakpoint the scan doesn't render

**True unknowns** — facts no repo holds. These become gap-fill questions, never silent
assumptions:

- who the audience is
- whether the cursor may carry personality
- brand colours that exist only in a Figma file
- whether a client will reject "playful"
- whether the site is about to be redesigned

## Existing cursor code

Search for all of these before designing anything:

```
cursor: none
cursor: url(
data-cursor
custom-cursor
cursor-follower
mouse-follow
mousemove
```

Three outcomes:

- **None found** → clean install.
- **Found and broken** → run the repair checklist in `gating.md`, then decide whether the
  family is still right. Repair is usually cheaper and the report should say so.
- **Found and working** → the job is a tuning pass, not a replacement. Say that.
