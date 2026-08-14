# GNB Unified Sub-835px Layout Plan

- Date: 2026-08-14 KST
- Branch: `drill-gnb-mobile-grid`
- Related plans: `gnb-mobile-menu-plan.md`, `gnb-mobile-single-row-fix-plan.md`, `gnb-small-viewport-consistency-plan.md`

## Problem and Scope

The screenshot shows that below 835px the hamburger can remain beside the logo while the tools stay at the far edge. This means the intended flexible logo-to-hamburger space is not structurally owned by the mobile layout. A flex auto-margin alone is not strong enough to express the required relationship across every sub-835px width.

Only GNB CSS changes. Navigation content, menu behavior, routes, scrolling, theme, administration, storage, services, dependencies, and startup remain unchanged.

## Layered Design

### Screen

Every viewport narrower than 835px uses one mobile header composition: logo | flexible spacer | hamburger | 8px | tools. No narrower breakpoint replaces that composition. Side padding scales continuously within one rule so the header remains inside very narrow viewports without a sudden layout switch.

### Processing and Core Rules

No JavaScript changes. The mobile GNB uses a four-column grid. The second column is the sole flexible track, so it always places the hamburger directly before the tool group. The dropdown remains absolutely positioned and uses the same continuous edge spacing.

### Storage, External Services, Dependencies, and Start

No persistence, API, authentication, Worker, database, package, CDN, or startup change.

## Process Phases and Gates

1. **Documentation gate**: this plan is committed before source changes.
2. **Unified layout gate**: at every width below 835px, the four-column mobile composition stays in one row; only the logo-to-hamburger spacer flexes; hamburger-to-tools is 8px.
3. **Narrow-width gate**: header width does not exceed the viewport and no sub-835px breakpoint replaces the mobile composition.
4. **Regression gate**: desktop GNB, menu interaction, routes, scrolling, and non-GNB styles remain unchanged.
5. **Quality/deploy gate**: static checks, PR validation, merge, and Pages deployment pass.

## Failure and Retry Loop

`failed unified-layout gate -> replace only the conflicting GNB layout declaration -> repeat broad sub-835px contract checks`

## Verification

- Confirm the changed source file after this plan is only `styles.css`.
- Confirm the mobile GNB uses four columns with one flexible middle track and an 8px tools margin.
- Confirm no `max-width` rule smaller than 835px targets `.gnb`, `.gnb-menu-toggle`, `.gnb-tools`, or `.gnb nav`.
- Confirm static validation and deployed CSS availability; browser screenshots remain separate evidence.
