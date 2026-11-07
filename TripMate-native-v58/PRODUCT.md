# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Delegated by the user: React Native with Expo, chosen to ship one product as true iOS and Android native interfaces without a WebView.

## Users

Chinese travelers planning personal or family trips, including people traveling with parents or children. They need a plan that remains useful while moving through an unfamiliar city.

## Product Purpose

TripMate turns a travel request into an editable day-by-day itinerary, then helps the traveler execute it with saved plans, costs, reservations, current-location awareness, next-stop distance, walking steps, and an explicit handoff to AMap navigation.

## Positioning

TripMate is not only an itinerary generator: it connects the generated schedule to the traveler’s current position and explains what to do next, while prioritizing low walking burden and family-friendly pacing.

## Operating Context

Users plan before departure, then consult the app one-handed while walking. Accounts, AI credits, saved plans, and live navigation data come from the existing TripMate server. Location is requested only when the user starts live guidance.

## Capabilities and Constraints

- Email registration, login, guest preview, profile, account state sync, AI plan generation, credits, and live navigation use the TripMate server APIs.
- The native app stores its bearer session in the operating system secure storage.
- Foreground location permission must be requested in context. The user can refuse and enter a current location manually.
- The app does not request background location.
- AMap supplies route calculations through the server and can be opened for turn-by-turn navigation.
- The server requires a real HTTPS domain before release.

## Brand Commitments

The product name is “旅伴 TripMate”. The existing identity uses calm travel blue, direct Chinese copy, and a family-assurance voice. Customer contact email is tripmate@yeah.net.

## Evidence on Hand

The v38 TripMate server and web product are available at `C:/codex/TripMate/guest-v38`. They contain the established account, plan, credit, state-sync, AMap, DeepSeek, and recommendation behavior. No fabricated ratings, prices, testimonials, or store approval claims may be added.

## Product Principles

- Ask for sensitive permission at the moment its benefit is clear.
- Always show the next useful action, not just a destination list.
- Preserve user work when networks, AI, or permissions fail.
- Use verified source data and label uncertain prices or availability.
- Make the on-trip experience usable one-handed and readable outdoors.

## Accessibility & Inclusion

Support system font scaling, screen readers, dark mode, reduced motion, 44 pt iOS and 48 dp Android touch targets, clear error recovery, and a low-walking family mode.
