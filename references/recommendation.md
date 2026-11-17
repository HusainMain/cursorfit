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

**VERDICT** <one sentence, no jargon, names the family and the reason>
**CONFIDENCE** high | medium | low
**TIER** T0 | T1 | T2 | T3 — <cost in one clause: "zero JS", "~45 lines", "a canvas layer">

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

> **<family>** — <what it looks like in one line>

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
| link | … |
| primary button | … |
| card / media | … |
| text | … |
| input | native I-beam restored |
| disabled | … |
| window leave | hides in 150ms |
| touch | nothing — no cursor element at all |
| reduced motion | nothing |

**It will not** — <the honest limitation of this family on this site, one sentence>

**Override** *(include only if you changed the ranking)*
Audit ranked `<family>` first at fit `<n>`. Chose `<family>` instead because `<evidence, with a
file path or a measured value>`. What that costs: `<the downside the audit's pick did not have>`.

## Alternates

**A — `<family>`** <what it would look like>. **Disadvantage:** <the real cost, in this
sentence, not a footnote.>

**B — `<family>`** <what it would look like>. **Disadvantage:** <the real cost.>

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

**Every profile bullet is checkable.** "Uses `cubic-bezier(0.23,1,0.32,1)` once, on the hero
copy" is checkable. "Modern feel" is not.

**Alternates are real alternatives, not strawmen.** Each must be a family that genuinely
scored close. Putting an obviously wrong option second is worse than offering one alternate.

**The disadvantage goes in the same sentence as the offer.** Splitting it into a footnote is
how a recommendation becomes a sales pitch.

**"It will not" is mandatory.** Every family has a cost. A report with no cost in it is
either dishonest or hasn't understood the family.

**Never claim rendered verification you didn't perform.** `static` is the honest word for
"greps and build passed". `rendered` requires `scripts/verify.mjs` to have run, or the nine
checks done by hand, with skips named.

**Scores are decision support, never a percentage of anything.** Quote a score when it is
`high` confidence. At `medium`, quote it as a band and name the blind spot that caused it. At
`low`, don't quote it — ask.

**An override appears in the report, not in the reasoning.** If the ranking was changed, the
audit's pick, the override, the evidence and the cost are all visible to the reader. A silent
override is indistinguishable from a bug.

**Confidence must match the profile.** A low-confidence profile cannot produce a verdict with
no condition. Write it as: "If <answer> is true, `<family>`. If not, `<family>`."

---

## Condensed example (one family, abridged)

> **VERDICT** Dot and ring in `--neon-cyan`, 12px dot, 34px ring, with "View" labels on the
> three project cards. It matches the site's neon editorial register and stays out of the
> way of a hero that already runs a 3D canvas.
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

That's the shape. Three reasons, each a fact and a consequence, then the cost.
