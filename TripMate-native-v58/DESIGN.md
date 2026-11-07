# TripMate Native Design System

## Direction

TripMate feels like a calm travel companion, not a booking marketplace or a dashboard. The main screen is a chronological “today strip”: current status, next destination, route, and remaining stops. Brand expression comes through a single cobalt tint, restrained route-line geometry, and warm destination photography only when real assets exist.

## Platform adaptation

- iOS uses native stack transitions, large top-level titles, edge-swipe back, safe areas, system sheets, and 44 pt minimum targets.
- Android honors predictive Back, edge-to-edge insets, Material feedback, and 48 dp minimum targets.
- Compact widths use four bottom destinations. Expanded widths use a rail with a detail pane when implemented.

## Tokens

- Interactive/brand: `#2459D3`
- Light background: `#F5F7FB`
- Light surface: `#FFFFFF`
- Primary ink: `#14233D`
- Secondary ink: `#66748A`
- Route/success: `#168568`
- Warning: `#A86116`
- Error: `#C43B49`
- Dark background: `#0D1524`
- Dark surface: `#172338`
- Radius: 14 for content surfaces, 12 for controls, full pill only for compact status labels.
- Elevation: tonal surface contrast first; one soft neutral shadow only for floating navigation elements.

## Components

- Top-level tabs: Today, Plan, Trips, Account.
- Primary action: filled platform button with a verb.
- Timeline: route line plus native icon and text; no repeated card grid.
- Permission request: an in-context full screen or system prompt, never an unexplained launch-time prompt.
- Loading: inline progress with descriptive copy; no infinite decorative marquee.
- Errors: plain-language cause plus retry or manual fallback.

## Typography and motion

Use system typography and system font scaling. Titles are compact enough to remain readable outdoors. Motion follows native navigation and honors Reduce Motion; route progress may update with a short fade, not a continuous animation.
