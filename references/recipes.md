# Recipes

Working implementations for every family. Copy the one that won, then change only the values
the profile specifies: colour token, lerp, settle duration, sizes.

Every recipe assumes the same base. Read the base once; each family adds to it.

---

## Base — the part every family shares

### `cursor.css`

```css
:root {
  /* Bind these to the site's own tokens. Never leave a raw hex here. */
  --cf-color: var(--neon-cyan, currentColor);
  --cf-color-ink: var(--site-bg, #050505);
  --cf-size: 10px;
  --cf-settle: 300ms;
  --cf-ease: cubic-bezier(.23, 1, .32, 1);

  /* The state layer. Families tune these numbers; none of them delete a state. */
  --cf-hover: 2.4;          /* over a link: 10px × 2.4 = 24px ring */
  --cf-button-x: 3.2;       /* over a button: the dot becomes a wide capsule */
  --cf-button-y: 1.3;
  --cf-label-scale: 7.2;    /* only used by state-label */
}

.cf-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  pointer-events: none;
  opacity: 0;
  will-change: transform;
  transition: opacity 150ms linear;
}

.cf-cursor[data-visible="true"] { opacity: 1; }

/* The inner element owns scale. The outer one owns position, driven by RAF. */
.cf-cursor__mark {
  display: block;
  width: var(--cf-size);
  height: var(--cf-size);
  border-radius: 50%;
  background: var(--cf-color);
  transform: scale(1);
  transition:
    transform var(--cf-settle) var(--cf-ease),
    background-color var(--cf-settle) var(--cf-ease),
    border-color var(--cf-settle) var(--cf-ease),
    box-shadow var(--cf-settle) var(--cf-ease),
    opacity 140ms linear;
}

/* ---------------------------------------------------------------------------
   Base state layer - mandatory, not decorative

   A mark that behaves identically everywhere is the most common reason a custom
   cursor reads as a sticker dropped on the page. These four states cost about
   20 lines of CSS and are resolved by the JS below for every family, so a site
   with no [data-cursor] markup still tells the visitor what is under the pointer:

     link      the dot opens into a hollow ring
     button    the dot stretches into a capsule, echoing the control's shape
     text      the mark gets out of the way and the native caret returns
     disabled  no change, dimmed - a hover state on a dead control is a lie

   Families override the numbers through the tokens above. Nothing here uses
   !important, and nothing here depends on markup the site does not already have.
--------------------------------------------------------------------------- */

.cf-cursor[data-state="link"] .cf-cursor__mark {
  transform: scale(var(--cf-hover));
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--cf-color);
}

.cf-cursor[data-state="button"] .cf-cursor__mark {
  transform: scale(var(--cf-button-x), var(--cf-button-y));
}

/* Every direct child, so a family that adds a ring or a second layer is covered. */
.cf-cursor[data-state="text"] > * {
  opacity: 0;
  transform: scale(.6);
}

/* A label is a pseudo-element, so the rule above does not reach it. If a field was
   annotated by mistake, the word must leave with the mark. `display` rather than
   `opacity`, because state-label animates the label's opacity and an animation
   beats a normal declaration. */
.cf-cursor[data-state="text"]::after { display: none; }

.cf-cursor[data-state="disabled"] .cf-cursor__mark { opacity: .35; }

/*
  Only applied after JS init (html.cf-active), so a failed script leaves the
  native cursor working. Text controls keep their I-beam on purpose; every other
  control is replaced by the cursor, including submit inputs, which are buttons.
*/
html.cf-active,
html.cf-active * {
  cursor: none;
}

html.cf-active :is(
  input:not([type]),
  input[type="text"], input[type="search"], input[type="email"], input[type="url"],
  input[type="tel"], input[type="password"], input[type="number"],
  textarea,
  select,
  [contenteditable]:not([contenteditable="false"])
) {
  cursor: auto;
}

@media (pointer: coarse), (prefers-reduced-motion: reduce), (forced-colors: active) {
  html.cf-active,
  html.cf-active * { cursor: auto; }
  .cf-cursor { display: none; }
}
```

### `cursor.js` — shared core

```js
const LERP = 0.14;

export function initCursor({ lerp = LERP, root = document.documentElement } = {}) {
  const fine = matchMedia('(pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const forced = matchMedia('(forced-colors: active)').matches;
  if (!fine || reduced || forced) return () => {};

  const el = document.createElement('div');
  el.className = 'cf-cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="cf-cursor__mark"></span>';
  document.body.appendChild(el);
  root.classList.add('cf-active');

  let tx = innerWidth / 2, ty = innerHeight / 2;
  let x = tx, y = ty;
  let started = false;
  let raf = 0;

  const onMove = (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!started) {
      x = tx; y = ty; started = true;
      el.dataset.visible = 'true';
    }
  };

  const onLeave = () => { el.dataset.visible = 'false'; };
  const onEnter = () => { if (started) el.dataset.visible = 'true'; };
  const onBlur = () => { el.dataset.visible = 'false'; };

  const tick = () => {
    x += (tx - x) * lerp;
    y += (ty - y) * lerp;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  };

  /* ------------------------------------------------------------------ state
     Resolved from pointerover, which fires once per element entered - not once
     per movement - and only written when the answer changes. A handful of
     closest() calls per control, zero work between controls.

     The selector lists are deliberately tag-based. A site does not have to
     annotate anything for the cursor to acknowledge a link, a button or a
     field; data-cursor only adds a label on top of the state it would get
     anyway. That is the difference between a state layer and a checklist.
  */
  const TEXTUAL = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea, select, [contenteditable]:not([contenteditable="false"])';
  const DEAD = '[disabled], [aria-disabled="true"], :disabled';

  const resolve = (target) => {
    if (!(target instanceof Element)) return { state: '', label: '' };
    if (target.closest(DEAD)) return { state: 'disabled', label: '' };

    const labelled = target.closest('[data-cursor]');
    const label = labelled ? labelled.dataset.cursor || '' : '';

    if (target.closest(TEXTUAL)) return { state: 'text', label };
    // A button wins over a link when they nest: the inner control is what the
    // visitor is pointing at.
    if (target.closest('button, summary, label[for], [role="button"], [role="tab"], [role="menuitem"]')) {
      return { state: 'button', label };
    }
    if (target.closest('a[href], area[href], [role="link"]')) return { state: 'link', label };
    // Checkboxes, radios, ranges, colour and date pickers are controls, not text.
    if (target.closest('input')) return { state: 'button', label };
    return { state: '', label: '' };
  };

  let current = '';
  const onOver = (e) => {
    if (e.pointerType === 'touch') return;
    const next = resolve(e.target);
    if (next.state === current && next.label === (el.dataset.label || '')) return;
    current = next.state;
    el.dataset.state = next.state;
    if (next.label) el.dataset.label = next.label;
    else delete el.dataset.label;
  };

  addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseenter', onEnter);
  document.addEventListener('pointerover', onOver, { passive: true });
  addEventListener('blur', onBlur);
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseenter', onEnter);
    document.removeEventListener('pointerover', onOver);
    removeEventListener('blur', onBlur);
    root.classList.remove('cf-active');
    el.remove();
  };
}
```

Three things this core gets right that most hand-written cursors don't: it never shows at
`0,0`, it never hides the native cursor before it knows the script ran, and it answers a link,
a button and a field differently without a single line of markup from the site.

The state goes stale in one situation: an element scrolls under a stationary pointer. Browsers
fire `pointerover` inconsistently on scroll, so the mark can keep the last state until the
pointer moves again. Watch for it on pages with a sticky header over links; if it bites, clear
the state on `scroll` behind a 100ms debounce.

---

## Shape module — the silhouette

The base above draws a circle. `assets/shapes.css` swaps the silhouette without touching the
JS: same loop, same colour token, same states.

```html
<div class="cf-cursor" aria-hidden="true">
  <span class="cf-cursor__mark cf-shape--crosshair"></span>
</div>
```

| Class | Shape | Fits |
|---|---|---|
| `cf-shape--circle` | filled dot | default; any site that wants a dot |
| `cf-shape--ring` | hollow circle | editorial, portfolio, image-led |
| `cf-shape--square` | small sharp square | tools, grids, technical products |
| `cf-shape--crosshair` | two lines, no fill | maps, editors, precision work |
| `cf-shape--pill` | wide rounded bar | art direction, editorial, "brush" feel |
| `cf-shape--bracket` | four corner marks | galleries, case-study grids |
| `cf-shape--blob` | asymmetrical squircle | wellness, hospitality, craft |

Three rules the module enforces:

- **The resting silhouette is the site's; the states are shared.** Every shape opens the same
  24px ring on a link and the same 32×13px capsule on a button, whatever it looks like at
  rest. Scaling each silhouette by its own factor instead gave a 19px crosshair a 45px link
  ring — the shape the site chose, inflated past recognition.
- **Labelled states collapse to a ring.** A 72px bracket reads as a weapon sight, and text
  needs a circular container. The rule is at the bottom of `shapes.css`, and it sets an
  explicit size for that reason.
- **Nothing is an image.** Every shape is gradients and radii, so it inherits the colour token
  and costs no request.

Pick the shape from the profile, not from taste: a square on a site with 20px radii is a
contradiction, and a blob on a site with 2px radii is a different one.

---

## `css-static` — T0

Four ready files ship in `assets/cursors/`. They are white with a dark outline on purpose: a
cursor that matches the section it sits on disappears over it, and a branded colour will
vanish over a section of that same colour.

```css
html {
  cursor: url('/cursors/arrow.svg') 2 1, auto;
}
a, button, [role="button"] {
  cursor: url('/cursors/pointer.svg') 16 2, pointer;
}
input, textarea {
  cursor: url('/cursors/crosshair.svg') 16 16, text;
}
```

| File | Hotspot | Use |
|---|---|---|
| `arrow.svg` | `2 1` | default on any site |
| `pointer.svg` | `14 4` | links and buttons |
| `crosshair.svg` | `16 16` | precise, technical, map-like |
| `dot.svg` | `16 16` | minimal, near-invisible |

A note on the hand: a drawn hand is almost always worse than the operating system's own, which
is hinted and tuned for its platform. Ship `pointer.svg` only when the OS hand genuinely
clashes with the site's line weight, and keep the keyword fallback so a failed load still
gives a real pointer.

Rules that decide whether a bitmap cursor looks professional or cheap:

- **32×32 is the ceiling.** Browsers clip anything larger, and Windows may refuse it entirely.
- **The hotspot is the argument pair after the filename**, measured from the top-left of the
  image. Get it wrong by 4px and every click feels like it lands somewhere else.
- **Always end with a keyword fallback** (`auto`, `pointer`, `text`, `crosshair`). If the file
  fails to load, the visitor keeps a usable cursor.
- **SVG cursors cannot read `currentColor` or `var()`.** They are loaded as images, outside
  the cascade, so the colour is baked into the file. Ship a light and a dark variant if the
  site has both, or use the outlined pair here, which works on both.
- **A bitmap cursor cannot animate.** That is the whole trade: zero JS, zero state.

This is the only family where the cursor still conveys state without JS. Don't dismiss it —
on a docs site it is the correct answer and everything above it is decoration.

---

## `dot` — T1

The base, tuned down. `--cf-size: 8px`, `--cf-hover: 1.9`, `--cf-button-x: 2.2`, `--cf-button-y: 1.2`,
`LERP: 0.18`. No second layer, no trail, no labels. That is the whole family.

```css
:root {
  --cf-size: 8px;
  --cf-hover: 1.9;      /* 15px ring - a reaction, not a badge */
  --cf-button-x: 2.2;   /* 18×10px capsule */
  --cf-button-y: 1.2;
}
```

Quiet is not the same as inert. The three base states still run, at the smallest sizes in the
catalogue — a link opens a thin ring, a button stretches the dot slightly wider, a text field
hands the caret back. On a dense page this is usually all the feedback the site can carry, and
it is the difference between a cursor that works and one that looks frozen.

**The one thing to get wrong here** is deleting the base state rules because "a dot should stay
a dot". A 15px ring is still a dot. A mark that never changes is a bug.

---

## `dot-ring` — T1

Add a second element that lags behind the dot with its own lerp.

```js
const ring = document.createElement('span');
ring.className = 'cf-cursor__ring';
el.appendChild(ring);

const ringLerp = lerp * 0.5;   // the 2:1 ratio is what makes it read as trailing
let rx = tx, ry = ty;

// inside tick():
rx += (tx - rx) * ringLerp;
ry += (ty - ry) * ringLerp;
ring.style.transform = `translate3d(${rx - x}px, ${ry - y}px, 0)`;
```

The ring is a child positioned at the dot's origin, so its transform is a *delta* from the
dot. That keeps one RAF loop instead of two.

```css
.cf-cursor__ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 1px solid var(--cf-color);
  border-radius: 50%;
  opacity: .55;
  transition: transform var(--cf-settle) var(--cf-ease), opacity var(--cf-settle) var(--cf-ease);
}
```

Never below a 1.8:1 ratio between dot and ring lerp. Below that the ring looks glued; above
3:1 it looks detached.

---

## `state-label` — T1

The base state layer, plus a word. The states run with no markup at all; the labels are the
enhancement. That order matters — annotate nothing and the cursor still answers every link and
button, because the resolver in the base already found them.

### The label, which is optional

```css
.cf-cursor[data-label] .cf-cursor__mark {
  transform: scale(var(--cf-label-scale));
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--cf-color);
}

.cf-cursor[data-label]::after {
  content: attr(data-label);
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--cf-color);
  font-family: inherit;        /* the cursor is a child of body, so this is the site's face */
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: .04em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  animation: cf-label-in 160ms var(--cf-ease) both;
}

@keyframes cf-label-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

Two details worth keeping. `attr(data-label)` instead of a JS-built `--cf-label` string: nothing
to quote, nothing to escape, and the text is visible in the DOM. And `left/top: 50%` with
`translate(-50%,-50%)` centres the pseudo on the cursor's own origin — the outer element is a
0×0 box, so `inset: 0` would collapse the label to nothing.

### The vocabulary

| `data-cursor` | Label | Use on |
|---|---|---|
| `view` | View | project cards, gallery items |
| `read` | Read | article links, case studies |
| `play` | Play | video posters |
| `open` | Open | external links, new tabs |
| `drag` | Drag | carousels, before/after sliders |

Five is the ceiling. Past that the label stops being recognition and becomes reading.

### Markup, only where a word adds something

```html
<a href="/work/atlas" data-cursor="view">Atlas</a>
<button data-cursor="play">Play reel</button>
```

Sizes: ring 64–88px, label 10–12px, uppercase optional. Below 64px the label doesn't fit; above
96px it reads as a badge rather than a cursor.

### What the install owes the report

List every control group and the state it gets, including the ones with no annotation:

| Control | State without markup | With markup |
|---|---|---|
| `<a>` in the nav | link ring | link ring |
| project card link | link ring | `view` label |
| `<button>` CTA | button capsule | button capsule |
| `input` | text — mark hides | text — mark hides |
| disabled button | dimmed, no reaction | dimmed, no reaction |

The middle column is the point. **A family that only reacts where someone remembered to add an
attribute is not a state system, it is a checklist.** If that column has empty cells, the build
is wrong, not the site.

---

## `magnetic` — T1

```js
export function initMagnetic(selector = '[data-magnetic]', strength = 0.35) {
  const cleanups = [];

  document.querySelectorAll(selector).forEach((el) => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.setProperty('--cf-mx', `${cx.toFixed(2)}px`);
      el.style.setProperty('--cf-my', `${cy.toFixed(2)}px`);
      if (active || Math.abs(cx) + Math.abs(cy) > 0.1) raf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * strength;
      ty = (e.clientY - r.top - r.height / 2) * strength;
      if (!active) { active = true; raf = requestAnimationFrame(tick); }
    };

    const onLeave = () => { tx = 0; ty = 0; active = false; raf = requestAnimationFrame(tick); };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
```

```css
[data-magnetic] {
  transform: translate(var(--cf-mx, 0), var(--cf-my, 0));
  transition: transform 400ms cubic-bezier(.23, 1, .32, 1);
  will-change: transform;
}
```

Two constraints. Apply it to a wrapper if the element already has a transform. And cap the
travel at ~24px — a button that moves 60px under the pointer is a button people miss.

---

## `blend-difference` — T1

```css
.cf-cursor__mark {
  background: #fff;
  mix-blend-mode: difference;
}
```

That's the entire visual. The failure mode is in the DOM, not the code:

```js
// refuse the family rather than ship a broken one
const blocked = [...document.querySelectorAll('body *')].some((n) => {
  const s = getComputedStyle(n);
  return s.isolation === 'isolate' || parseFloat(s.opacity) < 1;
});
```

Skip that check and the cursor turns grey or vanishes over exactly the sections you built
with glass or fade-in wrappers. Also: it needs pure white to invert to pure black. On a
`#f0f0f0` page the cursor is `#0f0f0f` — fine. On a mid-grey page it's mush.

---

## `trail` — T2

Emitted by **distance**, not per frame, so a fast flick makes a ribbon instead of confetti.

```js
export function initTrail({ color = 'currentColor', max = 90, spacing = 14 } = {}) {
  if (!matchMedia('(pointer: fine)').matches) return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 2147483646,
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const dots = [];
  let lx = null, ly = null, raf = 0;

  const resize = () => {
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const onMove = (e) => {
    if (lx === null) { lx = e.clientX; ly = e.clientY; return; }
    const dx = e.clientX - lx, dy = e.clientY - ly;
    const dist = Math.hypot(dx, dy);
    if (dist < spacing) return;
    const steps = Math.floor(dist / spacing);
    for (let i = 1; i <= steps; i++) {
      dots.push({
        x: lx + (dx * i) / steps,
        y: ly + (dy * i) / steps,
        r: 3 + Math.random() * 2,
        life: 1,
      });
    }
    lx = e.clientX; ly = e.clientY;
    if (dots.length > max) dots.splice(0, dots.length - max);
  };

  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = color;
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.life -= 0.035;
      if (d.life <= 0) { dots.splice(i, 1); continue; }
      ctx.globalAlpha = d.life * 0.6;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  addEventListener('mousemove', onMove, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('mousemove', onMove);
    removeEventListener('resize', resize);
    canvas.remove();
  };
}
```

`currentColor` on a canvas resolve to the canvas's own colour — set an explicit colour from a
token instead (read the computed value of `--cf-color` off `document.documentElement`).

**The trail is the one layer the base state does not reach.** It draws on its own canvas, so
`[data-state="text"] > *` cannot hide it, and a ribbon behind an I-beam is the thing a visitor
remembers. Read the cursor's state and stop emitting:

```js
const cursorEl = document.querySelector('.cf-cursor');

const onMove = (e) => {
  if (cursorEl?.dataset.state === 'text') { lx = null; ly = null; return; }
  // ...
};
```

Clearing `lx`/`ly` matters: without it the first move after the field joins the old position to
the new one and paints a straight line across the page.

---

## `mask-reveal` — T2

`clip-path` beats a canvas here: no second buffer, and the browser composites it.

```html
<figure class="cf-reveal" data-cf-reveal>
  <img src="base.jpg" alt="…">
  <img class="cf-reveal__over" src="alt.jpg" alt="" aria-hidden="true">
</figure>
```

```css
.cf-reveal { position: relative; overflow: hidden; }
.cf-reveal__over {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: circle(var(--cf-r, 0px) at var(--cf-x, 50%) var(--cf-y, 50%));
  transition: clip-path 120ms linear;
  will-change: clip-path;
}
```

```js
document.querySelectorAll('[data-cf-reveal]').forEach((fig) => {
  fig.addEventListener('mousemove', (e) => {
    const r = fig.getBoundingClientRect();
    fig.style.setProperty('--cf-x', `${e.clientX - r.left}px`);
    fig.style.setProperty('--cf-y', `${e.clientY - r.top}px`);
    fig.style.setProperty('--cf-r', '110px');
  });
  fig.addEventListener('mouseleave', () => fig.style.setProperty('--cf-r', '0px'));
});
```

Both images must share dimensions and crop. A 2px difference shows as a seam at the mask edge.
Images that fail to load leave a hole — the effect has no graceful fallback, which is the
family's real cost.

---

## `shader-ripple` — T3

Only offered when `three`, `ogl`, or an existing shader pipeline is already in the bundle.

Do not write a shader for a cursor. Wrap the existing renderer's material and add a uniform
driven by the pointer:

```js
material.uniforms.uPointer.value.set(x / innerWidth, 1 - y / innerHeight);
material.uniforms.uTime.value = clock.getElapsedTime();
```

The skill's job at T3 is the gate, not the shader:

```js
const canRun =
  'gpu' in navigator &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  matchMedia('(pointer: fine)').matches;
```

If `canRun` is false, render nothing and leave the native cursor alone. A static fallback
image is required, and it must be designed — not the effect with the animation switched off.

---

## React / Next adapter

One component, mounted once, above the router.

```tsx
// src/components/Cursor.tsx
import { useEffect } from 'react';
import { initCursor } from '../lib/cursor';
import '../styles/cursor.css';

export function Cursor() {
  useEffect(() => initCursor({ lerp: 0.12 }), []);
  return null;
}
```

```tsx
// src/App.tsx  (or app/layout.tsx)
<>
  <Cursor />
  <RouterProvider router={router} />
</>
```

Rules that prevent the two most common React failures:

- Mount it **outside** the router, or it remounts on every route change and stacks cursors.
- Return the cleanup from `useEffect` — the arrow form above returns the disposer. In React 18
  StrictMode the effect runs twice in dev; the cleanup is what stops the double cursor.
- Do not read the pointer into state. One `useRef` and one RAF loop; a `setState` per
  `mousemove` re-renders the tree 60 times a second.
- Import the CSS once, at the component, not in every route.
- **The state resolver is delegated on `document`, so it survives client-side navigation.** Do
  not re-bind it in the component or on route change; a second listener writes the same state
  twice and, worse, stays alive after the cleanup because the first one is never removed.
