# GNB Mobile Single-Row Fix Plan

- Date: 2026-08-14 KST
- Branch: `drill-gnb-mobile-menu-nowrap`
- Related baseline: `docs/gnb-mobile-menu-plan.md`

## Problem and Scope

At 620px and below, an existing `.gnb { flex-wrap: wrap; }` rule still applies after the 835px hamburger transition. This lets `.gnb-tools` move below the hamburger, producing a two-line header.

Only the 835px GNB media-query layout is changed. Menu markup, open/close behavior, existing routes, scrolling, theme, administrator controls, storage, external services, dependencies, and app startup remain unchanged.

## Layered Design

### Screen

At 835px and below, the logo, hamburger, and tools stay in one horizontal row. The logo-to-hamburger span is the only flexible space; hamburger-to-tools spacing remains 8px.

### Processing and Core Rules

No JavaScript behavior changes. The responsive CSS explicitly prevents wrapping in the mobile GNB and keeps the logo, toggle, and tools as fixed-size row items.

### Storage, External Services, Dependencies, and Start

No persistence, API, authentication, Worker, database, package, CDN, or startup change.

## Process Phases and Gates

1. **Documentation gate**: this plan is committed before the CSS correction.
2. **Layout gate**: at 835px and below, the GNB is one row; tools do not fall below the hamburger; the 8px toggle-to-tools gap remains.
3. **Regression gate**: desktop navigation, dropdown rules, existing GNB actions, and unrelated sections are unchanged.
4. **Quality/deploy gate**: source contract and GitHub validation pass before main merge and Pages deployment.

## Failure and Retry Loop

`failed layout gate -> identify the conflicting selector -> add the smallest GNB-only override -> repeat the same gate`

If the one-row gate fails, revise only the GNB mobile selector. If an unrelated header behavior changes, revert that part and keep the correction scoped to flex layout.

## Verification

- Confirm the changed source file is only `styles.css` after this plan.
- Confirm the 835px query sets `flex-wrap: nowrap`, centers items, and preserves the 8px tools margin.
- Confirm the existing 620px wrapping rule remains available for non-hamburger desktop behavior but is overridden in the 835px mobile state.
- Confirm GitHub static validation, merge, and Pages deployment. Browser visual confirmation remains separate.
