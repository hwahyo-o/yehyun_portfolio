# UX Heading Gap Adjustment

- Date: 2026-08-14 KST
- Branch: `drill-ux-heading-gap`
- Scope: `.ux-heading-copy` in the home UX/UI section only.

## Problem and Change

The supplied reference shows the yellow `UX/UI` label immediately above `My UX/UI Design Portfolio`. The current `gap: 18px` adds unintended vertical distance. Change that gap to `0`.

## Layered Scope

- Screen: only the visual spacing between the UX/UI label and title changes.
- Processing: no JavaScript, route, or event behavior changes.
- Core rules: preserve the current label, title, typography, and existing Figma-aligned composition.
- Storage and external services: no change.
- Dependencies and start: no change.

## Phases and Gates

1. Documentation gate: this file is committed before CSS.
2. CSS gate: `.ux-heading-copy` has exactly `gap: 0`.
3. Regression gate: no other selector or source file changes beyond the plan and target CSS.
4. Delivery gate: GitHub static verification and Pages deployment succeed before main merge.

## Retry and Verification

If a check fails, change only this CSS declaration and repeat the failed gate. Verify the branch diff, static workflow result, deployed HTTP availability, and user visual confirmation. No secrets or temporary URLs may be added.
