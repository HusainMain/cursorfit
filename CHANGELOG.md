# Changelog

## 0.3.1 — 2026-11-18

### Fixed — the ask was a subsection, so it was skipped

0.3.0 put the ask at the end of Stage 4 as a sub-heading. The first real run went straight past
it: the report listed the slots and started writing. An instruction that sits inside the stage
before the decision reads as commentary on that stage, not as a step.

The ask is now Stage 5 with its own row in the pipeline table, and the build moved to Stage 6.
The section opens with the gate — write no files, end the message with the question — and closes
with what counts as an answer, including the awkward reply ("ok") that is neither silence nor a
choice.

### Changed — the question is in plain words

The old example asked with `fit 98.5`, `T1`, `85 own lines`, `4 states`. None of that means
anything to the person who owns the website, and it made the choice read like a spec sheet
instead of a trade-off. The question now carries no family ids and no audit numbers: each option
gets a plain description, one advantage and one disadvantage, one sentence each.

A disadvantage has to be a felt consequence. "It smears across paragraphs while you read" is
allowed. "~90 own lines" is not.

### Added — the repair job asks too

A repo that already has a cursor skips straight to the repair checklist, and 0.3.0 never said
whether the owner wanted that. Repairing someone's site is still changing it. Stage 5 now has a
two-option question for that case — repair or replace — and only asks safe-versus-reach if the
answer is replace.

## 0.3.0 — 2026-11-18

### Changed — the skill asks before it writes

0.2.1 fixed the wording by stating that safe is installed unless you ask for the reach. That was
honest about the behaviour and wrong about the behaviour itself: a site owner who asked for a
cursor recommendation got a diff before they got a choice.

Stage 4 now ends with an ask. Both slots go out in one message, each with its cost in the same
sentence, and no file is written until the answer comes back. Safe stays the recommendation, and
the default when there is nobody to ask — which the report must name as a skipped ask, never as
consent.

This is a minor bump rather than a patch because the pipeline's last step changed: an agent
following the skill now stops for an answer instead of writing files.

The CLI line changes with it:

| Before | After |
|---|---|
| `safe is built unless you ask for the reach` | `ask which slot before writing files` |
| `safe is built; nothing louder clears the bar` | `no reach clears the bar · ask before writing files` |

`recommendation.md` gains a "Pick one" block so the written report ends with the question rather
than the build. The "say which slot is installed" rule from 0.2.1 survives, scoped to after the
build.

No selection behaviour changed. Ties, the fit floor, the tier cap and the reach slack are
untouched.

## 0.2.1 — 2026-11-18

### Fixed — three offers looked like three installs

`DECISION` printed `fit is a floor (80); safe and reach are both offers` above the three slots.
True, and misleading to anyone who then opens their repo: nothing said that only the safe slot
is written. The first real test of 0.2.0 was someone looking for `trail` in a repo built with
`state-label` — exactly the reading that line invited.

The line now names what is installed: `safe is built unless you ask for the reach`, or
`safe is built; nothing louder clears the bar` when the reach is empty. `recommendation.md`
gains the matching rule for the written report.

No selection behaviour changed. The golden set and the selection tests are untouched and pass.

## 0.2.0 — 2026-11-18

### Changed — the ranking was measuring the wrong thing

Three critique passes were run against the 0.1.2 selection. Two findings were adopted, one was
verified false against the code, and one was rejected on principle. What survived:

The score up to 0.1.2 was `100 × Π (1 − 0.45 × min(1, d/30))`. Four problems, all real.

1. **The product punished families for having opinions.** It multiplied a penalty for every axis
   a family declares, so a family judged on two axes out-scored one judged on five at identical
   per-axis quality. `css-static` was judged on two, `dot` on three, everything else on five. The
   catalogue was rewarding silence.
2. **Confidence was computed and never used.** An axis the reader could not parse was scored as
   if it were in range, so an unreadable site came out looking quiet.
3. **Fit was used as the ranker.** `fit 100` means "no axis rules it out" — a pass, not a quality
   signal — so ranking on it ranked band geometry, not suitability.
4. **Ties fell to array order.** The family list is ordered simplest-first, so at equal fit the
   earliest family won by position.

### The model now

- `fit = 100 × (Π factor) ^ (1 / active)`. The geometric mean is normalised by the number of
  axes the family was actually judged on, so a two-axis family and a five-axis family land on
  the same scale.
- A `low`-confidence axis is **skipped**, not scored as a pass. If every active axis was skipped,
  fit is `null` and the family is not offered.
- Fit is a **floor of 80**, never a ranker. `breakTie` and the 2.5-point noise band are deleted.

### The output is three slots, not a primary and two alternates

| Slot | Rule |
|---|---|
| **safe** | highest fit; ties go to the cheaper tier, then more states, then id |
| **reach** | highest expressive floor at most one tier up, within 10 fit points of safe |
| **fallback** | `css-static` when eligible, otherwise the cheapest remaining family |

`css-static` is never safe or reach. Its bands are a strict subset of `dot`'s, so it can never
out-fit it, and every JS family now ships a state layer the bitmap cannot. Its honest niche is
"the buyer forbids JavaScript", a constraint a repo cannot reveal — so it is the fallback, and
the safe pick the moment that constraint is stated.

Two rules were added during the build, both found by the golden set rather than by a critique:

- The reach was chosen on floor alone, so a family at 83.7 with three missed axes could be
  offered while one at 95.8 with a single small miss was skipped. It now has to stay within
  `REACH_FIT_SLACK = 10` of the safe fit.
- At equal fit the order preferred *more states*, which could put a T3 shader in the safe slot.
  Cost now comes first. Safe means low risk.

### Added — a golden set

Eight fixtures in `test/golden/`, with expectations written before the ranker was run against
them, and `test/golden.mjs` to run them end to end. Four pass. Four are recorded as **known
gaps** rather than tuned green:

- **`fit-rewards-silence`** (agency-portfolio, photo-editorial, studio-showcase). Fit charges for
  a miss and never rewards a family for having an opinion. `dot-ring`'s bands cover almost
  anything, so it sits at or near 100 and wins by default; `state-label` requires expressive ≥ 55
  and editorial ≥ 50 — a real view about these three sites — and loses for holding it.
- **`reach-tier-cap`** (shader-hero). A reach may go one tier up, so T3 is unreachable when the
  safe pick is T1, even on a repo that already imports `three` and where `shader-ripple` scores
  exactly the floor of 80.

A mismatch that is not listed as a gap fails the run, so a regression cannot hide behind the
gap list.

### Added — selection tests

`test/selection.mjs` replaces `test/tiebreak.mjs`. 27 assertions: geometric-mean scale
independence, active-axis counting, confidence skipping, the floor, the modifier rule,
`css-static` exclusion, the safe tie-break, the reach slack and tier cap, and both empty pools.

### Changed — the documents follow the code

`families.md` describes the formula and the three slots, and the 90-line note is now explicitly a
T1 budget, not a gate — the script has never had a line-count gate. `SKILL.md` Stage 4 is safe /
reach / fallback. `recommendation.md` prints the three slots and drops the tie-break block.
`behaviour.md` states that failure mode is a gate-level risk control, never a tie-break: a quiet
failure is a bug that takes longer to notice.

### Before and after, on the four validation repos

| Repo | 0.1.2 | 0.2.0 safe / reach / fallback |
|---|---|---|
| BuildEx | `dot` 100 / `dot-ring` 82.7 / `css-static` 95.4 | `dot` 100 / **none** / `css-static` 95.4 |
| ideabridge | `state-label` 98.5 / `trail` 93.1 / `dot-ring` 91.7 | unchanged |
| IssueLens | `dot` 97.4 / `dot-ring` 96.8 / `css-static` 88.0 | unchanged |
| husain-portfolio | `blend-difference` 97.5 / `trail` 83.3 / `dot` 85.2 | `blend-difference` 97.5 / `state-label` 94.2 / `dot` 85.2 |

BuildEx loses its reach because 10 fit points is a real bound: `dot-ring` at 82.7 against a safe
pick at 100 is a compromise, not a step up. husain-portfolio's reach moves from `trail` (83.3,
outside the slack) to `state-label` (94.2, inside it). No safe pick changed on any of the four.

### Verified

- `node test/selection.mjs` — 27/27.
- `node test/golden.mjs` — 4 match, 4 known gaps, no unrecorded mismatch.
- `node test/extract.mjs` — the recipes are untouched and still extract to `cursor.css` 111
  lines, `cursor.js` 101, `label.css` 28.
- Four real repos audited. No live site was built from this version; rendered behaviour stays
  `NOT_TESTED` until it is.

## 0.1.2 — 2026-11-18

### Fixed — every family looked the same

Reported after running the skill on two real sites: both produced a dot with no reaction on
hover, and every button produced the same non-state. Three causes, all real.

1. **`dot`'s recipe said "No state listeners. That's the whole family."** The quiet family was
   literally inert. A dot was all it could ever be.
2. **`state-label` resolved state only from `[data-cursor]` markup.** On a site with none, it
   rendered a bare dot — visually identical to `dot`, for 60 more lines. The labels were
   documented as the enhancement but implemented as the whole state machine.
3. **Near-ties fell to array order.** The family list is ordered simplest-first, so a 93 against
   a 91 quietly became "the simplest one wins".

### Added — a mandatory base state layer

`references/recipes.md` now ships a state layer in the shared `cursor.css` and `cursor.js`. It
resolves on `pointerover` — once per element entered, not once per movement — and needs no
markup from the site:

| State | Trigger | Mark does | Measured |
|---|---|---|---|
| default | nothing | dot | 10×10px |
| `link` | `a[href]`, `[role="link"]`, `area[href]` | opens into a hollow ring | 24×24px, 1px inset |
| `button` | `button`, `[role="button"]`, `summary`, submit inputs | stretches into a capsule | 32×13px |
| `text` | text-like `input`, `textarea`, `select`, `[contenteditable]` | hides, native I-beam returns | opacity 0 |
| `disabled` | `:disabled`, `[aria-disabled="true"]` | no reaction, dimmed | opacity .35 |
| `label` | `[data-cursor]` on top of the state above | ring + word | 72×72px |

`state-label` no longer owns the states; it adds `data-label` and a word. `attr(data-label)`
replaced the JS-built `--cf-label` string, so there is nothing to quote or escape. The dot
family keeps its quiet character by turning the numbers down (`--cf-hover: 1.9`, capsule
`2.2 × 1.2`) rather than by deleting the states.

`--cf-hover` changed meaning: it is now the **link ring multiplier** (default 2.4, was 5.6 as a
generic hover scale). `assets/shapes.css` gained explicit link, button and label rules for all
seven silhouettes and lost its per-shape hover factors. Those factors made sense when hover was
"grow this shape"; under the state layer they multiplied the link ring instead, so a square
opened a 42px ring and a blob a 44px one. Now every resting silhouette opens the same 24px ring
and the same 32×13px capsule. Labelled states still collapse to a circle, at an explicit size,
because a 2.2× bracket scaled by 7.2 would be a 158px sight.

The line counts in the catalogue always described the family's own logic, but the shared base
is now large enough that the number alone misleads. `families.md`, the README table and the
audit's `PICK` line now say **own layer** and name the ~100-line shared core beside them. No
family got smaller; the baseline became visible.

### Added — a tie-break, printed

The audit now counts how many control states each family can exercise **on this site** (a text
state on a site with no fields does not count). A fit gap under 2.5 points is treated as noise,
and inside that band a family **in the same tier** that reacts to more controls wins. It never
crosses a tier: at equal fit the cheaper family stays. The swap is printed as `TIE-BREAK` and
copied into the report by `references/recommendation.md`, so it is never a silent reordering. A
tie-break never revives a blocked family or overrides a gate.

Run against the validation sites after the change:

| Site | Before | After |
|---|---|---|
| ideabridge | `state-label` 93 | `state-label` 93, 4 states |
| BuildEx | `dot` 87 | `dot` 87, 2 states, no tie-break |
| IssueLens | `dot` 93 | `dot` 93 |
| portfolio | `css-static` 100 | `css-static` 100 |

BuildEx keeps `dot` because `state-label` scores 17 there — the pick was never the bug. The bug
was that the dot had nothing to do.

### Added — the recipe is tested, not a copy of it

`test/extract.mjs` pulls the base CSS and JS straight out of `references/recipes.md` and writes
`test/_generated/`, which `test/states.html` loads. The test therefore exercises the code in the
docs, and a broken code block fails the suite.

```
states.html   10 passed · 0 failed · 1 skipped (the modal check is opt-in)
shapes.html   10 passed · 0 failed · 1 skipped
```

The skipped check is `modal`, which needs a trigger selector. Every state above was read from
the live DOM after the transition settled, not from the source.

`test/shapes.html` runs all seven silhouettes through the same four states. Every one of them
was read back from the browser: link 24×24 ring, button 32×13 capsule, text hidden, label
72×72 with `content: "view"`. The resting silhouettes are unchanged. The first run of that
fixture caught the stale per-shape hover factors described above — a square opened a 42px link
ring instead of 24px — which is why the fixture exists.

### Changed — absence is a pass, not a skip

`verify.mjs` reported "no cursor element" under touch and reduced motion as a `skip`. Absence is
the correct outcome in both contexts — the recipe bails before creating anything — so it is now
a pass with that detail. A cursor that never ran at all still fails the `element` check in the
normal context, so this cannot hide a broken build.

---

## 0.1.1 — 2026-11-18

Three corrections after review. No family, recipe or gate was added or removed — the fixes are
to what the audit can see, how confidently it says it, and what verification proves.

### Fixed — component-named elements were invisible

The control and media counters matched lowercase HTML only. A Next app writes `<Image>`,
`<Button>` and `<Link>`, so the audit could report zero controls on a modern project while
looking precise. It now counts both spellings and records which one it found.

Evidence from a Next-style fixture (`<Button>`, `<Link>`, five `<Image>`, styled-components):

| | before | after |
|---|---|---|
| controls | 0 | 2 |
| media | 0 | 5 |
| `mask-reveal` | blocked | eligible |
| gap reported | "no interactive targets found" | none |

Two related fixes: CSS `background-image` now counts toward the media gate, and test or
tooling artifacts (`.playwright-mcp`, `playwright-report`, `test-results`, `storybook-static`)
are excluded from the scan. The second one matters — a copy of a page inside `.playwright-mcp`
was double-counting 269 files on the validation repo.

Re-run on the validation repo: 82 files, 38 controls, same pick (`state-label`, fit 93), same
gates. Excluding the artifacts changed the counts by 19% and did not change the verdict.

### Added — coverage and confidence

The audit now emits a `coverage` block: stylesheets, markup files, inline style attributes,
utility-class lists, CSS-in-JS files, component tags found, CSS background images, and the five
files most likely to hold styling it could not read. Every axis carries
`confidence: high | medium | low` with a note naming the blind spot that caused it.

`SKILL.md` gained a stage between audit and score: open the flagged files, correct any value
that moves by more than ~20%, and drop the axis to `medium` if it can't be resolved.

### Added — browser verification

`scripts/verify.mjs` — eleven checks a grep cannot make: element present, `pointer-events`, follow
lag and convergence, hover state, click-through, keyboard focus ring, modal stacking, duplicate
instances after a route change, console errors, touch, and reduced-motion. Falls back to Edge or
Chrome when bundled Chromium is missing, so a machine with a browser already installed can run
it without the download.

Tested against three pages:

| Page | Result |
|---|---|
| a correct implementation (state-label with all three guards, plus a modal) | 11 passed, 0 failed |
| the same page with the cursor's z-index dropped below the overlay | 10 passed, 1 failed — the modal check caught it |
| `assets/preview.html`, which has no hover state, no touch guard and no reduced-motion handling | 7 passed, 3 failed, 1 skipped — all three failures real |

An unreachable URL exits 2 with one line instead of a stack trace, because that is the failure
people hit first.

`references/gating.md` now defines `rendered` as "verify.mjs passed, or the eleven checks done by
hand with skips named", and says a skipped check is not a pass.

### Changed — scores are decision support, not measurement

`references/profile.md` gained a "What a score is not" section, `references/families.md` says
plainly that the fit bands are "designed for", not "proven on", and `SKILL.md` allows an
override of the ranking — but only with a file path, and only when the report shows the audit's
pick, the override, the evidence and the cost together.

Confidence is now per axis and per profile, with quoting rules: `high` quotes the number,
`medium` quotes a ±5 band plus the cause, `low` is not quoted at all.

---

## 0.1.0 — 2026-11-18

First public release.

### Added

- **Pipeline** (`SKILL.md`) — seven stages: read the repo, audit, score five axes, gate
  impossible families, gap-fill with at most three questions, recommend one family plus two
  alternates, implement and verify.
- **Audit script** (`scripts/audit.mjs`) — 631 lines, zero dependencies, static and offline.
  Reads a repo or a folder of CSS and writes `cursorfit.json` with tokens, type, motion
  signature, layout density, control count, existing cursor code, five axis scores, a ranked
  family list, and the gates that fired.
- **Nine-family catalogue** (`references/families.md`) — `css-static`, `dot`, `dot-ring`,
  `state-label`, `magnetic`, `blend-difference`, `trail`, `mask-reveal`, `shader-ripple`,
  across four cost tiers, with fit bands and hard gates.
- **Implementations** (`references/recipes.md`) — vanilla `cursor.css` + `cursor.js`, a React
  adapter, and working code for every family.
- **Asset set** (`assets/`) — seven CSS silhouettes in `shapes.css`, four image cursors with
  hotspot values in `cursors/*.svg`, and `preview.html` for checking both by eye.
- **Behaviour matrix** (`references/behaviour.md`) — eighteen states, including disabled
  controls, touchscreens, reduced motion, and print.
- **Anti-slop rules** (`references/gating.md`) — nine rules, a grep verification list, and a
  ten-step repair checklist for sites that already have a broken cursor.
- **Provenance** (`references/credits.md`) — source skill per family, and an explicit split
  between harvested effects, rewritten code, and original selection logic.

### Verified

- `audit.mjs` run against two repos: a dark animation-heavy product landing page (85 files,
  46 controls, 24 keyframes) and a synthetic essay fixture. Both produced a defensible ranking
  and at least one gate that changed the outcome.
- `assets/preview.html` checked in Chromium at 1366×768 and 390×844.
- All four SVGs parse as valid XML and render at 24px and 128px.

### Known limits

- The nine recipes have not yet been applied to a live site. The audit half is tested; the
  implementation half is written but unproven in production.
- `shader-ripple` wires a uniform into an existing GPU renderer. It does not ship a shader.
- The shape module is geometry, not artwork.
- The scoring is a heuristic. One validated site is not evidence for the next twenty.

## Unreleased

- Apply each family to a real site and record what broke.
- Add a rendered-mode verification pass so reports can say `rendered` instead of `static`.
