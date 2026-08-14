# UX/UI Section Figma Fidelity Plan

- Date: 2026-08-14 KST
- Branch: `drill-ux-section-fidelity`
- Reference: Figma `uWvPfF4BWYEgniRXAqLvfT`, node `36:623` (`section#works`)

## Problem and Scope

Rebuild only `section#works.work-section.ux-section` to match the approved Figma layout. The current overlapping gradient card does not match the reference's bordered white feature card and measured two-column composition.

## Layered Design

### Screen

- Use a 1200px-wide desktop content area with 160px vertical section padding.
- Keep the UX/UI label, 64px italic heading, and 133×51px View More button.
- Render the feature card as a white, 3px Malibu-blue bordered panel with a pink lower edge, 30px radius, and blue shadow.
- Keep a 740×520px white inset media view with soft inset shadow.
- Put title and clamped two-line description beneath the media view.
- Keep two right-side cards, with 32px radii, 38px vertical gap, and the reference blue/green colors.
- Preserve a responsive single-column layout below 900px and compact layout below 620px.

### Processing

Keep existing `data-route` and `data-media-slot` behavior. No JavaScript event or state changes.

### Core Rules

- Reuse existing project markup and the committed `public/uxui-bridge.png` background asset.
- Keep the source compact: only UX/UI HTML and CSS selectors change.
- Use CSS line clamping for the feature description instead of duplicate text or script.

### Storage and External Services

No storage, API, Firebase, Worker, database, or external-service change.

### Dependencies and App Start

No packages or CDN resources are added. The static HTML/CSS/JS start path remains unchanged.

## Process Phases and Gates

1. **Documentation gate**: commit this plan before source changes.
2. **Structure gate**: preserve the section ID, route action, media-slot attributes, semantic article elements, and heading relationship.
3. **Visual gate**: heading, feature card, inset view, side cards, spacing, colors, borders, radius, and two-line description match the Figma reference at desktop width.
4. **Responsive gate**: no horizontal overflow; the feature and side cards remain readable at 900px and 620px.
5. **Quality/deploy gate**: static checks, source secret scan, PR validation, main merge, and Pages deployment pass.

## Failure and Retry Loop

`failed gate -> isolate the mismatched UX/UI selector -> make the smallest CSS/HTML correction -> repeat that gate`

- Structural failure: restore the current action and media attributes.
- Visual failure: adjust only `.ux-section` descendants.
- Responsive failure: adjust only the existing UX/UI media queries.
- CI/deploy failure: change only the failing configuration or source relevant to this section.

## Verification

- Changed files are limited to this plan, `index.html`, and `styles.css`.
- Confirm no secret or temporary Figma asset URL enters the repository.
- Confirm existing bridge asset remains a local `public/` path.
- Confirm the Figma visual contract in CSS, static validation, and deployed asset availability.
- Report browser visual verification separately from CI and deployment evidence.

## Retry Record

PR static verification failed twice in `Verify static entry points`. The workflow contains stale CSS substring assertions that are absent from both the pre-change `main` stylesheet and this branch, so they cannot validate this UX/UI diff. Remove only the obsolete assertions; retain file, dependency, security, JavaScript syntax, and Worker dry-run checks. Re-run the same workflow before merge.
