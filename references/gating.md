# Gating — the checks that decide whether this ships

Nine rules, each of which is broken in most custom-cursor code that reaches production. A
cursor failing any of them is not "nearly done"; it is a page that loses its pointer or its
clicks for a subset of visitors.

Run these as greps after writing the files. They are cheap and they catch what a code review
does not, because the failures are behavioural.

## The nine rules

### 1. `pointer-events: none` on every cursor layer

```css
.cf-cursor { pointer-events: none; }
```

Without it the cursor element swallows every click directly beneath the pointer. The page
looks fine and nothing works — the worst possible bug, because it reads as "the site is
broken" rather than "the cursor is broken".

### 2. `aria-hidden="true"`

```js
el.setAttribute('aria-hidden', 'true');
```

The element is decoration and it sits at the end of `<body>`; without the attribute some
screen readers announce an unnamed group on every page.

### 3. Coarse pointer gets nothing

```js
if (!matchMedia('(pointer: fine)').matches) return () => {};
```

Plus the CSS fallback:

```css
@media (pointer: coarse) { html.cf-active *, .cf-cursor { cursor: auto; display: none; } }
```

`cursor: none` on a phone does not hide a custom cursor — it hides the *only* cursor. This is
the single most damaging mistake in the family and it ships constantly.

### 4. Reduced motion gets nothing, or a static dot

```js
if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
```

"Reduced" means reduced, not removed-occasionally. Do not lerp, do not trail, do not breathe.
If a static dot is genuinely part of the brand, ship it with `lerp: 1` and no animations —
but the safer default is to leave the native cursor alone.

### 5. `cursor: none` only after JS init

```js
root.classList.add('cf-active');   // and the CSS keys off html.cf-active
```

Static `body { cursor: none }` means a script error or a blocked bundle leaves the visitor
with no cursor at all. Gating it behind a class the script adds turns a catastrophic failure
into a cosmetic one.

### 6. Hide on `mouseleave`, show on `mouseenter`

```js
document.addEventListener('mouseleave', () => { el.dataset.visible = 'false'; });
document.addEventListener('mouseenter', () => { el.dataset.visible = 'true'; });
```

Also bind `window.blur`. Without both, the cursor is left parked at the last known position
when the user switches windows, and it's the first thing anyone notices.

### 7. No CSS transition on the transform of the RAF element

```css
.cf-cursor { /* transition: transform … ← forbidden */ }
.cf-cursor__mark { transition: transform 300ms … /* allowed */ }
```

The outer element's transform is rewritten every frame. A transition on it fights the loop,
and the result is a cursor that lags differently depending on frame timing — the "feels
laggy while scrolling" complaint. Transitioning an **inner** element's scale is fine, because
the RAF loop never writes to it.

### 8. `position: fixed`, not `absolute`

```css
.cf-cursor { position: fixed; inset: auto; top: 0; left: 0; }
```

`absolute` makes the cursor scroll with the document and inherit every transformed ancestor's
coordinate space. If any ancestor has a `transform`, `filter`, or `will-change`, `fixed`
becomes containing-block-relative too — which is why the cursor is appended to `<body>`, not
into a section.

### 9. No custom cursor on a text-heavy page

This is a judgment gate, not a code gate. If the page is a docs site, a blog, a legal page, or
a form flow, the honest answer is "no cursor" or the quietest T0/T1 option. The skill may
still build one — the user asked — but the report must state the cost in the verdict, not in
a footnote.

## Supporting rules

| Rule | Check | Why |
|---|---|---|
| I-beam preserved | `html.cf-active input, textarea, select, [contenteditable] { cursor: auto }` | the caret location is information a dot cannot carry |
| Focus stays visible | `:focus-visible { outline: 2px solid … }` untouched | keyboard users need the ring, and a custom cursor must not replace it |
| No state on disabled | `:disabled { … opacity: .35 }` only | a hover state on a dead control is a lie |
| Mounted once | one `<Cursor />` above the router | per-route mounts stack, three routes = three cursors |
| No state per mousemove | `useRef` + RAF, never `setState` | a React re-render at 60fps drops frames on mid-range phones |
| Not in print | `@media print { .cf-cursor { display: none } }` | it otherwise appears on exported PDFs |
| Below modals | `z-index: 2147483647` | a cursor under a modal overlay is invisible exactly when it's needed |

## Verification commands

Run from the repo root. Each is a grep, so it works on any framework.

```bash
# 1 pointer-events
grep -rn "pointer-events" src/styles/cursor.css src/components/Cursor.tsx

# 2 aria-hidden
grep -rn "aria-hidden" src/lib/cursor.js src/components/Cursor.tsx

# 3 + 4 capability guards
grep -rn "pointer: coarse\|pointer: fine\|prefers-reduced-motion" src/styles/cursor.css src/lib/cursor.js

# 5 cursor:none gated
grep -rn "cursor: none" src/
# expect: only inside a rule prefixed html.cf-active, never on bare body

# 6 leave/blur handlers
grep -rn "mouseleave\|mouseenter\|blur" src/lib/cursor.js

# 7 no transition on the driven transform
grep -rn -A4 "\.cf-cursor {" src/styles/cursor.css | grep "transition"
# expect: no output

# 8 fixed positioning
grep -rn "position: fixed" src/styles/cursor.css
```

Then the build:

```bash
npm run build     # or: npx tsc --noEmit
```

A cursor that breaks the build is not shipped. If the project has no build step, open the HTML
file and confirm the `<script>` is present and `defer`red.

## Browser verification

The greps above prove the code *says* the right things. They cannot prove it works. A
`pointer-events: none` on the wrong element still swallows clicks, and a reduced-motion block
that targets the wrong query still animates.

`scripts/verify.mjs` drives a real browser and checks nine things a grep cannot:

| Check | Catches |
|---|---|
| `element` | wrong selector, element never rendered |
| `pointer-events` | the cursor swallows every click |
| `follow` | no lag, or lag that never converges |
| `hover-state` | no state hook, or a hook on the wrong control |
| `click-through` | a wrapper or overlay eats the click |
| `route-change` | a second instance after navigation |
| `console` | errors the cursor introduced |
| `touch` | `cursor: none` leaking onto a phone |
| `reduced-motion` | the follow animation still running |

```bash
npm i -D playwright && npx playwright install chromium   # once
node scripts/verify.mjs http://localhost:3000 --cursor .cf-cursor --json verify.json
```

It falls back to Edge or Chrome if the bundled Chromium was never downloaded, so a machine
with a browser already installed can run it without the 150MB download. Exit code 1 means at
least one check failed.

A skipped check is not a pass. It means the page did not expose enough to test — no visible
control, no cursor element, no observable state change — and the report must name the skip
instead of claiming the behaviour.

## What "verified" means here

| Level | Meaning |
|---|---|
| **static** | greps pass, build passes, files are wired into the entry point |
| **rendered** | `verify.mjs` passed, or the nine checks were done by hand at 1366×768 and 390×844 with every skip named |
| **not tested** | neither of the above |

A report may say `rendered` only if a browser was actually driven. Source inspection is
`static`, never `rendered`. This distinction is the difference between a skill that is trusted
and one that claims success it didn't observe.

## Repair checklist — existing cursor code

If the audit found an existing cursor, run this before designing a replacement. Repair is
usually cheaper, and saying so is the honest recommendation.

1. Is `cursor: none` static in CSS? → move it behind a JS-added class.
2. Is there a coarse-pointer guard? → add it. This alone fixes most "site is broken on my
   phone" reports.
3. Does the element have `pointer-events: none`? → add it.
4. Does it hide on `mouseleave`? → add both leave and blur handlers.
5. Does it start at `0,0`? → initialize to centre, hide until the first move.
6. Is it mounted per route? → hoist above the router.
7. Is there a transition on the driven transform? → remove it.
8. Is it `absolute`? → change to `fixed`, append to `<body>`.
9. Are inputs getting `cursor: none`? → restore the native I-beam.
10. Is the lerp below 0.10? → raise it; below that the cursor is visibly detached.

Only after all ten pass does the question become "is this the right family?".

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Invisible cursor on phones | `cursor: none` without a coarse guard | rule 3 |
| Clicks do nothing | cursor layer without `pointer-events: none` | rule 1 |
| Cursor parked at top-left | no initial position, visible before first move | initialise to centre, `data-visible="false"` until move |
| No caret in inputs | `cursor: none` applied to form fields | restore `cursor: auto` for inputs |
| Visible over one section only | blend mode inside `isolation: isolate` or `opacity < 1` | rule 8 / drop blend family |
| Two cursors after navigation | component mounted per route | hoist it |
| Laggy during scroll | transition on the driven transform, or lerp < 0.08 | rule 7 |
| Stuck after leaving the window | no `mouseleave` on `document` | rule 6 |
| Cursor under a modal | z-index too low | raise to max, check modal isolation |
| Cursor scrolls with the page | `position: absolute` | rule 8 |
| Looks different on Windows vs macOS | bitmap cursor with a bad hotspot | T0 only: supply `@2x`, verify hotspot |
| Cursor disappears over an iframe | pointer events don't cross the boundary | accept, or overlay the iframe |
| Trail appears in screenshots of a paused page | canvas never cleared on idle | clear when `dots.length === 0` |
