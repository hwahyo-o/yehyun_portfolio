# GNB Small-Viewport Consistency Plan

- Date: 2026-08-14 KST
- Branch: `drill-gnb-small-viewport`
- Related plans: `gnb-mobile-menu-plan.md`, `gnb-mobile-single-row-fix-plan.md`

## Problem and Scope

The accepted mobile GNB state begins at 835px. At smaller widths, legacy breakpoint rules can still alter its padding, alignment, and dropdown position. The visible result is a hamburger position inconsistent with the 835px layout and a header that can appear clipped.

This correction changes only the GNB CSS. Existing menu HTML, JavaScript, routes, scrolling, theme, administration, storage, external services, dependencies, and startup are unchanged.

## Layered Design

### Screen

From 835px down to 320px, the logo, hamburger, and tools keep the same one-row mobile arrangement: all flexible space is between logo and hamburger; hamburger-to-tools spacing is 8px; the header stays inside the viewport.

### Processing and Core Rules

No processing changes. The 835px mobile rule explicitly owns display, sizing, spacing, and no-wrap behavior. The later 480px override is removed so smaller viewports do not change that visual contract.

### Storage, External Services, Dependencies, and Start

No persistence, API, authentication, Worker, database, package, CDN, or application-start change.

## Process Phases and Gates

1. **Documentation gate**: this plan is committed before source changes.
2. **835px-to-320px layout gate**: the mobile GNB has one row, keeps its 8px toggle-to-tools gap, and has no horizontal overflow or clipping.
3. **Regression gate**: the desktop GNB, dropdown behavior, actions, and non-GNB styles are unchanged.
4. **Quality/deploy gate**: static checks, PR validation, merge, and Pages deployment pass.

## Failure and Retry Loop

`failed viewport gate -> identify the later conflicting breakpoint rule -> make a GNB-only correction -> repeat 835px, 620px, and 320px checks`

## Verification

- Confirm the only source change after this plan is `styles.css`.
- Confirm the 835px rule explicitly uses a border-box, full-width, non-wrapping row.
- Confirm no later GNB breakpoint overrides mobile padding or dropdown placement below 835px.
- Confirm static validation and deployed CSS availability; browser rendering evidence is reported separately.
