# Behaviour — what the cursor does in every state

A cursor is a state machine with a visual. If a state isn't defined, the browser's default
behaviour leaks through and the cursor looks broken at exactly the moment the user is paying
attention.

Every recommendation must fill this matrix, even if the answer for a state is "nothing
special". "Nothing" is a decision; a blank cell is not.

## Universal matrix

| # | State | How it's detected | Behaviour | Why |
|---|---|---|---|---|
| 1 | **Idle** | no pointer movement for 2s+ | optional 1.0→1.04 breath, 2.4s ease-in-out | proves the cursor is alive without demanding attention |
| 2 | **Default** | no target | base size, base colour, `scale(1)` | the resting state must be the least interesting one |
| 3 | **Link** | `a[href]`, `[role="link"]`, `area[href]` | opens into a hollow ring at `--cf-hover` (2.4×) | the OS already told users links are clickable; keep the signal, change the shape |
| 4 | **Button** | `button`, `[role="button"]`, `input[type="submit"]`, `summary`, `label[for]` | stretches into a capsule, `--cf-button-x` × `--cf-button-y` (3.2 × 1.3) | wider than tall, mirroring the control's own geometry — a button should not look like a link |
| 5 | **Card / media** | `[data-cursor="view"]` | ring 64–88px, label "View" | the only state where a text label earns its space |
| 6 | **Playable media** | `[data-cursor="play"]` | ring + triangle glyph or "Play" | video without a cue is a still image |
| 7 | **Draggable** | `[data-cursor="drag"]`, `[draggable]` | ring + "Drag", or ↔ glyph | the cursor is the only affordance a custom slider has left |
| 8 | **Body text** | `p`, `li`, `h1–h6` | no change | text is not a target; a mark that reacts to every paragraph dims itself across most of the page |
| 9 | **Text input** | `input`, `textarea`, `select`, `[contenteditable]` | **native cursor restored** | an I-beam tells you where the caret will land; a dot cannot |
| 10 | **Disabled** | `:disabled`, `[aria-disabled="true"]` | `scale(1)`, opacity .35, no label | never signal interactivity on something that won't respond |
| 11 | **Loading** | `[aria-busy="true"]` | ring becomes a 2px arc, slow spin | distinguishes "working" from "broken" |
| 12 | **Window leave** | `document.mouseleave` | `opacity: 0` within 120ms | a cursor left floating over a background is the #1 reported bug |
| 13 | **Window blur** | `window.blur` | hide | alt-tab must not leave a ghost |
| 14 | **Touch** | `(pointer: coarse)` | **nothing. no element, no `cursor: none`** | half of all visitors |
| 15 | **Reduced motion** | `(prefers-reduced-motion: reduce)` | **nothing**, or a static dot with no lerp | the setting exists because motion makes people ill |
| 16 | **Forced colours** | `(forced-colors: active)` | nothing | the OS is overriding colours for a reason |
| 17 | **Keyboard focus** | `:focus-visible` | cursor hides, focus ring shows | keyboard users never move the mouse; a cursor sitting at 0,0 is a bug |
| 18 | **Print** | `@media print` | `display: none` | it will otherwise appear on every exported page |

States 1–7 are design. States 8–18 are correctness. A recommendation that skips 8–18 is a
demo, not an install.

**States 3, 4, 9 and 10 are the base layer, not a family choice.** They ship in
`references/recipes.md` as CSS plus a `pointerover` resolver, they need no markup, and no
family may delete them. A cursor that looks the same over a link, a button and a field is the
single most common way a custom cursor reads as broken — the visitor moves over a control,
nothing acknowledges it, and the page feels dead. Labels (5–7) are the part that is optional;
they are enhancement on top of a state that already exists.

## Detection

Use **delegated** listeners, not per-element ones:

```js
document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const t = e.target.closest('[data-cursor], a[href], button, input, textarea');
  if (!t) return;
  // resolve state from t.matches(...) and t.dataset.cursor
});
```

`pointerover` fires once per element entered, not once per movement, so the resolver costs
nothing between controls. Check the target only when it changes; writing `dataset` on every
over would thrash the DOM on a page with nested spans.

Per-element `mouseenter` on 200 links is 200 listeners and a memory leak when the route
changes. Delegation is one listener for the life of the page.

## Per-family deltas

| Family | Changes to the matrix |
|---|---|
| `css-static` | states 3–7 come from a second image cursor per element, not from JS. States 8–18 are handled by the browser. |
| `dot` | 1, 2, 12–18 plus the base states 3, 4, 9, 10 at their smallest values. No ring, no labels. |
| `dot-ring` | adds the trailing layer. States 3, 4, 9, 10 still drive the mark, so the ring is the calm layer around a mark that reacts. |
| `state-label` | the base states plus 5–7. This family exists because the labels need somewhere to live. |
| `magnetic` | replaces 4 on **one or two** elements only. Everything else unchanged. |
| `blend-difference` | state 8 is mandatory — a solid white blob over body text is unreadable. Test 11 and 12 against light sections specifically. |
| `trail` | adds emission on move; emission must stop on 12, 14, 15. Idle state must **decay**, not loop. |
| `mask-reveal` | states 5 and 12 only. The mask radius animates 0→110px in ~120ms. |
| `shader-ripple` | states 14–16 must disable the whole layer, not just hide it. |

## Size and timing defaults

| Property | Default | Acceptable range | Breaks when |
|---|---|---|---|
| dot size | 10px | 8–16px | <6px is invisible on 4K; >20px reads as a blob |
| link ring | 2.4× the dot | 1.9–3× | <1.6× the ring is indistinguishable from the dot; >3.5× it covers the link text |
| button capsule | 3.2 × 1.3 | 2.4–4 × 1.2–1.5 | below 2× the change is invisible; above 4× it becomes a banner |
| label scale | 7.2× the dot | 6.4–8.8× | below 6.4× the word doesn't fit; above 96px it reads as a badge |
| ring size | 34px | 28–40px | larger than 44px obscures small controls |
| label ring | 72px | 64–88px | <64px the word doesn't fit on one line |
| label size | 11px | 10–12px | <9px unreadable; >13px reads as UI chrome |
| lerp (dot) | 0.14 | 0.12–0.18 | <0.08 feels detached; >0.22 feels glued |
| lerp (ring) | 0.07 | 0.06–0.10 | must stay ≤ 0.6× the dot's |
| settle | 300ms | 280–420ms | <200ms snaps; >500ms lags behind intent |
| hide delay | 150ms | 120–200ms | instant hide flickers at window edges |
| idle breath | 2.4s | 2–3s | faster reads as a pulse, not breathing |

## Colour binding

The cursor takes **one** colour and one contrast colour. Both must come from tokens.

```
--cf-color: var(--neon-cyan);        ← the accent the audit ranked first
--cf-ink:   var(--act-bg);           ← the surface it sits on
```

Rules:

- On a dark site, the cursor is the accent and glows. Add `filter: drop-shadow(0 0 12px
  color-mix(in srgb, var(--cf-color) 40%, transparent))` only if the site already uses glow.
- On a light site, the cursor is the accent at full saturation, or the text colour at 80%.
- On a **monochrome** site, do not introduce colour. Use the text colour. A coloured cursor on
  a black-and-white site is the cursor announcing itself, which is the failure this skill is
  meant to prevent.
- On a site with **two** accents, use the one with the higher usage count in CSS. The second
  accent is the hover colour of the first, not the cursor's.
- Blend-difference is the exception: it uses `#fff` because the blend mode needs an absolute.

## The awkward cases, decided in advance

| Case | Decision |
|---|---|
| Cursor over an iframe | it will not follow inside. Either accept the hide at the boundary or overlay the iframe — say which. |
| Cursor over a `<video controls>` | native controls need the native cursor. Restore it for that subtree. |
| Cursor over a modal | z-index 2147483647 keeps it above; confirm the modal doesn't set `isolation: isolate`. |
| Cursor over a `<select>` | native dropdown needs the native pointer. Restore. |
| Cursor in a WebGL canvas | the canvas may capture the pointer (`setPointerCapture`). Listen on `document`, not the canvas. |
| Two browser windows | `mousemove` stops at the window edge; `mouseleave` on `document` is what prevents the ghost. |
| User zooms to 200% | sizes in `px` stay put; the layout shrinks around them. Check at 200%. |
| Very large monitor | 10px on a 32" 4K display is a speck. The audit's container width informs this; when container ≥ 1440px, step the dot to 12–14px. |
