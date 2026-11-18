# Recommendation — the output format

One page. The person asked "which cursor should my site have", so the first line answers
that, and every line after it is the receipt.

The order matters: verdict first because they asked a question, evidence second because they
will otherwise assume it's taste, build details last because they only need those if they say
yes.

---

## Template

```markdown
# cursorfit — <project name>

**VERDICT** <one sentence, no jargon, names the safe family and the reason>
**SAFE** `<family>` · fit `<n>` · T1 · ~45 own lines over the shared core
**REACH** `<family>` · fit `<n>` · T2 · ~90 own lines   *(or: none — <the reason, one clause>)*
**FALLBACK** `<family>` · fit `<n>` · T0 · zero JS
**CONFIDENCE** high | medium | low

## What the site is

<3–5 lines. Facts only, each with a file or a number. No adjectives.>

## Profile

RESTRAINED  <bar>  <score>  EXPRESSIVE
  · <evidence>
  · <evidence>

PRECISE     <bar>  <score>  ORGANIC
  · <evidence>
  · <evidence>

DENSE       <bar>  <score>  AIRY
  · <evidence>
  · <evidence>

CALM        <bar>  <score>  ENERGETIC
  · <evidence>
  · <evidence>

PRODUCT     <bar>  <score>  EDITORIAL
  · <evidence>
  · <evidence>

**MOTION** <n> keyframes · median transition <ms> · <n> overshoot curve(s) ·
scroll-driven: <yes/no> · reduced-motion: <present/absent> · touch guard: <present/absent>

**MISSING** <what the repo couldn't tell us, and the default used>

**CONFIDENCE** expressive <high|medium|low> · organic <…> · airy <…> · energy <…> · editorial <…>
**COVERAGE** <n> stylesheets, <n> markup files, <n> blind spots · <the two that matter>

## Decision

> **SAFE — `<family>`** — <what it looks like in one line>

**Why this one**
1. <evidence → consequence>
2. <evidence → consequence>
3. <evidence → consequence>

**Colour** `<token>` → `<value>` — <where it comes from, why this one>
**Motion** dot lerp `<n>` · ring lerp `<n>` · settle `<ms>` `<easing>` · dot `<n>px` · hover `<n>px`

**Behaviour**

| State | Cursor does |
|---|---|
| default | … |
| link | hollow ring at `<n>`px |
| button | capsule, `<w>`×`<h>`px |
| card / media | ring + "View" (only where `data-cursor` was added) |
| body text | unchanged |
| input | mark hides, native I-beam restored |
| disabled | dimmed, no reaction |
| window leave | hides in 150ms |
| touch | nothing — no cursor element at all |
| reduced motion | nothing |

**Control coverage** — every interactive group the audit found, and the state it gets. A row
with an empty state is a build that is not finished.

| Control | Count | State |
|---|---|---|
| nav links | 6 | link ring |
| project card links | 4 | `view` label |
| `<button>` CTAs | 3 | button capsule |
| text inputs | 2 | native I-beam |
| disabled buttons | 1 | dimmed |

**It will not** — <the honest limitation of this family on this site, one sentence>

**Override** *(include only if you changed the pick)*
Audit chose `<family>` for the safe slot at fit `<n>`. Chose `<family>` instead because
`<evidence, with a file path or a measured value>`. What that costs: `<the downside the audit's
pick did not have>`.

## The other two offers

**REACH — `<family>`** (T2, fit `<n>`) <what it would look like on this site>. **Disadvantage:**
<the real cost, in this sentence, not a footnote.>

**FALLBACK — `<family>`** (T0, fit `<n>`) <what it looks like>. **Disadvantage:** <the real cost.>

## Pick one

**Safe — `<family>`.** <what you get>. **Cost:** <what it costs>.
**Reach — `<family>`.** <what you get>. **Cost:** <what it costs>.

Nothing is written until this is answered. Say "safe", "reach", or "you pick".

## Build

| File | What it does |
|---|---|
| `src/styles/cursor.css` | layer, tokens, states, guards |
| `src/lib/cursor.js` | one RAF loop, one delegated listener |
| `src/components/Cursor.tsx` | mounts once, above the router |

Wired at: `<file>:<line>`
Markup to annotate: `<n>` elements — <which groups>
Not annotating a group leaves it on the default state, which is fine for `<group>` and wrong
for `<group>`.

## Verification

- ✅ static: <n>/9 gates pass, build passes
- ⬜ rendered: not run (no browser)
- ❌ not tested: appearance over <section>, behaviour at 200% zoom

## Look at this

1. <the single most likely thing to look wrong>
2. <the second>
3. <the thing that only shows up on a real device>

## Deliberately not done

- <effect that would fit but costs too much>
- <state left off because no control needs it>
- <tier not offered and why>
```

---

## Rules for filling it

**The verdict is one breath.** If it needs a semicolon, it's two verdicts. Example:
"Dot and ring in the site's cyan, with View labels on project cards — it matches the neon
editorial register without adding a second animation system to a page that already has one."

**The three slots are one answer, not a menu.** Safe is the recommendation; reach is the
stretch; fallback is the floor. Present them in that order and never as equals. If you would not
ship the reach yourself, say so in its disadvantage.

**Ask before you build, and never build on silence.** One message with both slots, each cost in
the same breath, is a question. Three slots listed and a file quietly written is not. If nobody
is there to answer, build safe and say the ask was skipped — an unasked build is a default, not
a decision the reader made.

**Say which slot is installed — after the build.** Three slots are three offers, not a package.
Before the build the line names what you recommend; after it, the same line names what was
actually written. The reader should never discover the difference by looking at their repo.

**A reach may be empty.** When every louder eligible family gives up more than 10 fit points,
write `none` and the reason in one clause. Do not invent a second family to fill the slot, and
do not pad the page to look thorough.

**The fallback is the zero-JS answer when one exists.** `css-static` is offered there on
purpose: it is the only family a buyer can take when JavaScript is forbidden, and a repo cannot
reveal that constraint. When it is not eligible, the fallback is the cheapest family left and
the report says which cost that choice makes.

**Every profile bullet is checkable.** "Uses `cubic-bezier(0.23,1,0.32,1)` once, on the hero
copy" is checkable. "Modern feel" is not.

**Every control group appears in the coverage table.** The table is the proof that the state
layer runs, not a description of it. If a row says "unchanged" for a link or a button, the
build is wrong; only body text, inputs and disabled controls are allowed to say that.

**The reach is a real offer, not a strawman.** It must be an eligible family that cleared the
fit slack, with a higher expressive floor than the safe. Putting an obviously wrong option in
the slot is worse than writing `none`.

**The disadvantage goes in the same sentence as the offer.** Splitting it into a footnote is
how a recommendation becomes a sales pitch.

**"It will not" is mandatory.** Every family has a cost. A report with no cost in it is
either dishonest or hasn't understood the family.

**Never claim rendered verification you didn't perform.** `static` is the honest word for
"greps and build passed". `rendered` requires `scripts/verify.mjs` to have run, or the nine
checks done by hand, with skips named.

**Scores are decision support, never a percentage of anything.** Quote fit once as "fit 97.4
against a floor of 80" so nobody reads it as a grade out of 100. At `medium` confidence quote
the axis as a band and name the blind spot. At `low`, don't quote it — ask.

**An override appears in the report, not in the reasoning.** If the pick was changed, the
audit's slot, the override, the evidence and the cost are all visible to the reader. A silent
override is indistinguishable from a bug.

**Confidence must match the profile.** A low-confidence profile cannot produce a verdict with
no condition. Write it as: "If <answer> is true, `<family>`. If not, `<family>`."

**Name a known gap when one decides the case.** The golden set records two: fit rewards the
family with the widest bands, and a reach can never jump two tiers. If either chose this
answer, one line under the verdict says so. A recommendation that hides its own weak point is
the thing this skill exists to replace.

---

## Condensed example (one family, abridged)

> **VERDICT** Dot and ring in `--neon-cyan`, 12px dot, 34px ring, with "View" labels on the
> three project cards. It matches the site's neon editorial register and stays out of the
> way of a hero that already runs a 3D canvas.
>
> **SAFE** `dot-ring` · fit 97.5 · T1 · ~45 own lines
> **REACH** `trail` · fit 83.3 · T2 · ~90 own lines
> **FALLBACK** `dot` · fit 85.2 · T1 · ~25 own lines
>
> **Why this one**
> 1. The site runs 23 keyframes and a 560vh scroll-driven hero — a trail or shader would be a
>    *second* animation system, and the hero canvas already owns the depth cue.
> 2. Playfair Display at 7rem with 52ch measures puts editorial at 85. Labels are native to
>    that register; a bare dot is not.
> 3. `--neon-cyan: #00f0ff` is the most-used accent in `landing.css` and already drives the
>    primary CTA and focus ring, so the cursor inherits a colour the site has committed to.
>
> **It will not** carry the cursor over form fields — `rate-limit` inputs keep the native
> I-beam, because the input flow is where the product actually gets used.
>
> **REACH — `trail`** (T2, fit 83.3) A particle ribbon in the same cyan, emitted by distance so
> a fast flick draws a line rather than dots. **Disadvantage:** it is the second animation
> system the hero already warned against, and it will read as noise on a page that has one
> canvas doing the depth work.

That's the shape. Three reasons, each a fact and a consequence, then the cost.
