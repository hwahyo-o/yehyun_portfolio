# GNB 835px Mobile Menu Plan

- Date: 2026-08-14 KST
- Branch: `drill-gnb-mobile-menu`
- Design reference: Figma `uWvPfF4BWYEgniRXAqLvfT`, node `30:94`

## Scope

Only the existing `header.gnb`, related GNB CSS, and minimal menu-toggle behavior in `app.js` are changed. Gallery, home sections, category rendering, authentication, Worker, D1, Firebase, Drive, storage, and dependencies remain unchanged.

## Layered Design

### Screen

At 835px and below, the horizontal category navigation is replaced by a 44×34px hamburger button. When open, it reveals a vertical, white dropdown with a pink border, 12px corner radius, and the five existing category/community/contact items.

### Processing

The hamburger button owns the open state through `aria-expanded`. A menu item click, Escape, or a click outside the GNB closes the menu. Existing `data-route` and `data-scroll-target` delegation remain the sole navigation and scroll handlers.

### Core Rules

- At 836px and above, the existing horizontal navigation remains visible and the hamburger is hidden.
- At 835px and below, the logo, mobile menu button, and tools share one row.
- The logo-to-hamburger span receives all flexible width.
- Hamburger-to-tools spacing is exactly 8px; no automatic left margin may be introduced for tools.
- Dropdown controls preserve keyboard focus, labels, and existing action attributes.

### Storage and External Services

No persistent state, API, authentication, Worker, database, or external-service behavior changes.

### Dependencies and Start

No packages or CDN resources are added. Static HTML/CSS/JS startup and Bootstrap Icons remain in use.

## Process Phases and Gates

1. **Documentation gate**: this plan is committed before source changes and contains no secret or temporary asset URL.
2. **Structure gate**: hamburger control, controlled nav ID, and ARIA state are present; all existing menu data attributes remain.
3. **Layout gate**: desktop navigation remains horizontal above 835px; at or below 835px, the hamburger is shown, tools are 8px to its right, and remaining row space separates the logo and hamburger.
4. **Interaction gate**: toggle, item selection, Escape, and outside click close the dropdown without affecting route, scroll, theme, or admin controls.
5. **Quality and deploy gate**: source/static checks, security scope review, PR validation, and Pages deployment pass before main merge.

## Failure and Retry Loop

```
failed gate -> record cause -> make the smallest scoped correction
-> repeat the same gate -> continue only after it passes
```

- Layout failure: adjust only GNB selectors and the 835px media query.
- Toggle/accessibility failure: adjust only the menu button state or event handling.
- Existing route/scroll regression: restore current `data-route` or `data-scroll-target` behavior.
- CI/deploy failure: correct only the failed check or deployment configuration relevant to this change.

## Verification

- Check the changed file list is limited to this plan, `index.html`, `styles.css`, and `app.js`.
- Confirm no temporary Figma URL or secret pattern is introduced.
- Confirm the desktop/mobile markup contract and the exact 835px/8px CSS rules.
- Confirm GitHub static verification, deployed Pages workflow, and deployed CSS/HTML availability.
- Browser visual and interaction confirmation is reported separately from CI and deployment evidence.
