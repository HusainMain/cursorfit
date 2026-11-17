# Changelog

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
