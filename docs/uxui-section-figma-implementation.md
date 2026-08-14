# UX/UI Section Figma Implementation Plan

- Date: 2026-08-14 KST
- Repository: `hwahyo-o/yehyun_portfolio`
- Working branch: `drill`
- Design source: Figma file `uWvPfF4BWYEgniRXAqLvfT`, node `1:181`
- Visual source: user-provided bridge PNG

## Scope

Only `index.html > section.work-section.ux-section`, its dedicated CSS, and the committed bridge asset are in scope. The `header.gnb`, Gallery, Film, About, category routing, `app.js`, Firebase, Cloudflare Worker, D1, Google Drive, authentication, and existing third-party dependencies remain unchanged.

## Layered Structure

### Screen

- White UX/UI section with the bridge illustration anchored at the lower-left background.
- Yellow `UX/UI` label with blue left rule.
- Italic portfolio title and existing `View More` route button.
- Overlapped featured media panel and gradient copy panel.
- Two vertically stacked additional project slots on desktop.

### Processing

Existing `data-route="category/UX%2FUI"` and `data-media-slot` attributes stay intact. No new JavaScript state, event handler, or route is added.

### Core Rules

- Figma hierarchy, palette, radius, overlap, shadow, and desktop composition are the reference.
- The original bridge PNG is committed under `public/`; no temporary Figma asset URL is shipped.
- The featured media slot remains usable for future real media, not a flattened screenshot.
- Narrow viewports must preserve readable content without horizontal overflow.

### Storage and External Services

No database, Worker, Firebase, Drive, session, or API change is permitted. The committed public image is a static Pages asset only.

### Dependencies and App Start

No package or CDN dependency is added. Bootstrap Icons and current static app startup remain unchanged.

## Process Phases and Gates

1. **Documentation gate**: this plan is committed before implementation; no API keys, tokens, IDs, or private data are included.
2. **Asset and structure gate**: the supplied bridge PNG is committed as `public/uxui-bridge.png`; semantic section markup and existing route/media hooks remain present.
3. **Desktop fidelity gate**: at 1920px, the label, title, button, 858px featured panel, gradient copy layer, and blue/green side slots match the Figma composition.
4. **Responsive and accessibility gate**: desktop rail collapses without clipping; heading/button and cards remain keyboard reachable and text remains legible.
5. **Quality and deploy gate**: static checks, security diff review, desktop/mobile browser inspection, pull-request CI, and GitHub Pages deployment pass before `main` is updated.

## Failure and Retry Loop

```
failed gate -> record reproducible cause -> make the smallest scoped correction
-> repeat the same gate -> continue only after it passes
```

- Visual mismatch: change only UX/UI markup/CSS/asset positioning.
- Route or media-hook regression: restore the existing attribute or element connection; do not change app services.
- Asset failure: correct only the committed local asset reference.
- CI/deploy failure: inspect the relevant workflow or static condition, then repeat its gate.

## Verification

- Inspect the changed HTML and CSS for the required existing data attributes and for no temporary Figma URL.
- Verify JavaScript syntax and existing static validation workflow where available.
- Review the code diff for secrets and unintended Worker/service changes.
- In a browser, compare a 1920px render with the Figma reference and supplied bridge image; inspect a mobile-sized render for overflow and readability.
- Exercise `View More` and confirm the existing UX/UI category route still activates.
- After PR validation, merge to `main`, confirm Pages deployment, and record evidence separately as local/static, CI, deployed, and browser-verified.

## Handoff and Safety

A collaborator can reproduce the change by retaining the local `public/uxui-bridge.png` asset, the existing UX/UI DOM hooks, and this document's gates. Do not place secrets, external temporary asset URLs, session values, or private identifiers in source, commits, or documentation.
