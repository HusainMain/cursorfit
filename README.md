# cursorfit

### Fit the cursor to the site, not the site to the cursor.

Your site has a typeface, a palette, a spacing rhythm and a speed. The cursor is still the
system arrow. So you go looking for a cursor, find forty of them, and have no way to choose
except taste — which is exactly the thing that made the rest of the site good in the first
place.

**cursorfit reads your repo, scores its design character, and picks one cursor for it.** Then
it writes the code into the project, in your own colour token, at your own tempo.

It will also tell you when the right answer is no cursor at all.

![Seven cursor shapes and four image cursors](docs/shapes.png)

---

## The part everyone skips

A custom cursor is a usability decision with a design budget attached. It replaces a control
the visitor has used since they were six. That costs something, and the cost is specific:

- It has to survive over text, images, glass, video, and a disabled button.
- It has to disappear on touch, and calm down under reduced-motion.
- It has to keep working when JavaScript loads late or not at all.
- And it has to look like it belongs to *this* site — not to the skill that generated it.

Most cursor skills sell the effect and leave you with the bill. This one is built the other way
round: audit first, verdict second, code last.

## What it actually does

```
read the repo  →  score five axes  →  gate the impossible  →  pick one  →  implement  →  verify
```

1. **Reads** — framework, files, colour tokens, type stack, radii, spacing, keyframes,
   transitions, control count, media count, and any cursor code already there.
2. **Scores** five axes, each one requiring evidence from the code:
   `restrained ↔ expressive` · `precise ↔ organic` · `dense ↔ airy` · `calm ↔ energetic` ·
   `product ↔ editorial`.
3. **Measures** the motion signature — keyframe count, median transition, overshoot curves,
   scroll-driven animations, reduced-motion support, touch guards.
4. **Gates** — hard constraints that outrank the score. Glass panels kill blend modes. An
   unused GPU package kills the shader. Zero images kills the reveal.
5. **Asks** at most three questions, only where the code genuinely can't answer, each with a
   default so "I don't know" still produces a decision.
6. **Builds** the winner as `cursor.css` + `cursor.js`, or a React component, wired to the
   site's existing tokens. Then it checks its own work with a grep list and a live pass.

Nothing is invented at build time. The colour is a token that already exists. The speed comes
from the site's measured transitions. The size comes from its spacing.

## A real run

Run against a dark, animation-heavy AI product landing page — 85 files, 46 controls, 24
keyframes, median transition 200ms.

```
profile     expressive 91 · organic 57 · airy 35 · energetic 94 · editorial 70
motion      24 keyframes · median transition 200ms · 0 overshoot · scroll-driven
            reduced-motion: present · touch guard: absent
```

| Family | Fit | Verdict |
|---|---:|---|
| `blend-difference` | 94 | **rejected as primary** — `backdrop-filter` glass creates a stacking context; difference blending cannot reach behind it |
| `state-label` | 93 | **picked** — dot + ring in `--neon-cyan`, word on hover |
| `shader-ripple` | 93 | blocked — `three` is in `package.json` but never imported |
| `magnetic` | 91 | modifier, not a family — applied to the buttons instead |
| `trail` | 70 | alternate |
| `dot-ring` | 66 | alternate |
| `css-static` | 30 | |
| `dot` | 26 | |

Two things to notice. The top scorer lost. And the cursor that shipped was not the most
impressive one available — it was the one the site could carry.

## Install

No runtime, no dependencies, no build step. It's a folder of markdown and one Node script.

**As a skill** — drop it where your agent looks for skills:

```bash
git clone https://github.com/HusainMain/cursorfit.git ~/.claude/skills/cursorfit   # user-wide
git clone https://github.com/HusainMain/cursorfit.git .claude/skills/cursorfit     # per project
```

**As a package** — zip the folder and upload it. `SKILL.md` sits at the root, so it works
unchanged with the Agensi skill format.

**Or just point an agent at it** — `SKILL.md` is self-contained, and every reference file it
cites is a plain path.

Then ask, in your own words:

> give this site a custom cursor
> which cursor fits this repo?
> my cursor feels wrong — audit it

## The catalogue

Nine families, four tiers. Nothing here was invented for this skill — every family is an effect
that already exists in a published cursor skill. What's new is the ranking, the gating, and the
decision to say no.

| Tier | Family | JS | Fits | Fails when |
|---|---|---|---|---|
| T0 | `css-static` | 0 | docs, marketing, anything that needs zero risk | the page needs state or motion |
| T1 | `dot` | ~25 lines | quiet, dense product UI | the site is expressive and editorial |
| T1 | `dot-ring` | ~45 lines | portfolios, agencies, image-led pages | the page is already busy |
| T1 | `state-label` | ~85 lines | sites with clear, distinct actions | fewer than 3 hoverable controls |
| T1 | `magnetic` | ~60 lines | buttons and cards that want weight | applied to whole-page elements |
| T1 | `blend-difference` | ~40 lines | high-contrast, big-type pages | glass, `backdrop-filter`, or an isolated stacking context |
| T2 | `trail` | ~90 lines | expressive, motion-ready showcases | form-first pages, weak devices |
| T2 | `mask-reveal` | ~110 lines | galleries with real image density | fewer than 4 images |
| T3 | `shader-ripple` | ~150 lines | sites already running a GPU canvas | no imported shader pipeline — a `package.json` entry does not count |

`magnetic` is a modifier, not a family. It attaches to whichever family wins.

The theatrical tier — swarm cursors, drawn characters — is deliberately out. It's a site-wide
concept, not a cursor decision.

## What ships with it

**`assets/shapes.css`** — seven silhouettes, pure CSS, no images: `circle`, `ring`, `square`,
`crosshair`, `pill`, `bracket`, `blob`. Each carries its own hover scale, and any labelled
state collapses back to a circle, because text needs a round container.

**`assets/cursors/*.svg`** — four image cursors for the zero-JS family, with hotspots:
arrow `2 1`, pointer `14 4`, crosshair `16 16`, dot `16 16`. White with a dark outline, so they
survive both light and dark sections.

**`assets/preview.html`** — open it to move a real pointer over all seven shapes and feel the
hotspots. The screenshot at the top is that page.

**`scripts/audit.mjs`** — the only code that runs. Reads a repo and writes `cursorfit.json`:

```bash
node scripts/audit.mjs path/to/repo --out cursorfit.json
```

Static, offline, zero dependencies, ~300ms. It never opens a browser and never makes a request.

## What it refuses to do

Nine anti-slop rules live in `references/gating.md`. The short version:

- **No hardcoded hex.** The cursor binds to a token that already exists in the repo.
- **No cursor over unstyled text.** If a family can't survive a paragraph, it doesn't ship.
- **No touchscreen leak.** The listener exits on coarse pointers before it draws anything.
- **No motion without a brake.** Reduced-motion kills the follow and the labels.
- **No invented effects.** If the need isn't in the catalogue, the answer is "not in the
  catalogue", not an improvised backdrop blur.
- **No build without a fallback.** Every static cursor ends in a keyword; every JS cursor
  leaves the native one visible until it's ready.

There is also a ten-step repair list for sites that already have a broken cursor, because most
sites asking this question have one.

## The repo

```
SKILL.md                  the pipeline — start here, it is self-contained
references/audit.md       signals to extract, and what each one means
references/profile.md     the five axes, the formulas, the motion signature
references/families.md    the catalogue, fit bands, hard gates
references/recipes.md     working code for all nine families
references/behaviour.md   the 18-state matrix and size defaults
references/gating.md      the nine rules and the repair checklist
references/recommendation.md   the report shape, plus a worked example
references/credits.md     what came from where
scripts/audit.mjs         repo → cursorfit.json
assets/shapes.css         seven silhouettes, zero images
assets/cursors/*.svg      four image cursors with hotspots
assets/preview.html       open this to see both sets
```

`SKILL.md` sits at the root on purpose: that is the one hard requirement for the Agensi
package format, and it also means a plain `git clone` into a skills folder works untouched.

## Limits — read this before you judge it

- **The audit is proven; the recipes aren't.** The scoring has been run on two real repos and
  gave answers a designer would defend. The nine implementations are rewritten from published
  skills and have not yet been applied to a live site. That's next, and it's where bugs will
  appear.
- **Source is not the render.** A stacking context, a fixed header, or a transform on `body`
  can change what the cursor looks like. The code cannot see that.
- **The scores are heuristics.** They rank families against a site. They don't predict taste,
  and they're not a substitute for looking at the thing.
- **Static audit only, by design.** No live URL means rendered states stay `NOT_TESTED` unless
  you run a browser yourself. The report says so in those words.
- **T3 is a hook, not a shader.** `shader-ripple` wires a uniform into a renderer your repo
  already runs. It does not ship a shader.
- **Geometry, not artwork.** No paper planes, stickers, or drawn characters. A cursor that
  inherits the site's colour can't look pasted on; clip art can.
- **It won't pick your brand colour.** If the site has no accent token, that's a design
  problem upstream of the cursor.

## Who it's for

Someone with a site that already looks good, who wants the cursor to stop being the one thing
that doesn't match. Designers and vibe coders who'd rather be told "not this one, here's why"
than handed a gallery.

Not for someone who wants forty effects to browse. That's a different product, and it already
exists in every cursor-code pen on the internet.

## Credits

Every family is harvested from published work, and every implementation is rewritten rather
than copied — React and GSAP originals don't run on a plain HTML page. `references/credits.md`
names each source skill and what came from it, plus the three things this skill claims as its
own and the one it can't.

The short version: **the effects are borrowed and proven; the choosing is invented and
unproven.**

## Licence

MIT. Use it, fork it, ship it.
