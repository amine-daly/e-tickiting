# Frontoffice Angular Roadmap

**Status:** Planning Phase
**Last Updated:** April 25, 2026
**Angular Version:** 19 (Standalone Components)
**Backend API Version:** Spring Boot 3.3 with Order-based Group Bookings
**Design Rule:** Always stick to the current purple gradient / rounded card / soft shadow pattern

---

## Direction

This roadmap is journey-first, not module-first.

Build the frontoffice in the same order the user experiences it:

1. Home
2. Search entry
3. Search results / bus listing
4. Bus details
5. Seat selection
6. Passenger verification
7. Checkout / payment
8. Success confirmation
9. Post-booking account pages

Ticket-focused UI must not be used as the starting point. The ticket modal belongs only after the success page, inside My Tickets.

Loyalty, offers, and coupons stay in the UI, but they remain static placeholders for now.

---

## Design System

Keep the same visual language everywhere:

- Purple gradient header on each major page
- Rounded white cards with soft shadows
- Mobile-first layout with full-width primary actions
- Status accents: green, amber, red, gray
- Sticky bottom navigation on mobile
- Clear hierarchy: hero, cards, summary blocks, action row

### Core Tokens

- Primary gradient: `linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)`
- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#EF4444`
- Background: `#F9FAFB`
- Card: `#FFFFFF`
- Primary text: `#1F2937`
- Secondary text: `#6B7280`

---

## Journey Roadmap

### 0. Foundation and Shell

**Route:** global shell
**Goal:** establish the app frame before any feature page.

**Interfaces to build:**

- Header with brand strip and auth actions
- Sticky mobile bottom nav
- Shared card, badge, button, and toast styles
- Search card as the first shared interactive block

**State:**

- Router structure
- Auth token interceptor
- Recent searches service
- Places service

**Exit criteria:**

- App renders correctly on mobile and desktop
- Shared layout and tokens exist before page work starts

---

### 1. Home Page

**Route:** `/`
**Goal:** give the user one obvious entry point into booking.

**Interfaces to build:**

- Purple hero section
- Search card inside the hero
- Featured routes grid
- Recent searches section
- Static loyalty / offers / coupons teaser cards

**State:**

- Places list
- Recent searches history
- Featured trips from `TripService`
- Static promo mock data only

**Exit criteria:**

- Search CTA works
- Featured route cards navigate correctly
- Promo areas are visible but non-functional

---

### 2. Search Entry

**Route:** `/search`
**Goal:** let the user define origin, destination, and date.

**Interfaces to build:**

- Origin autocomplete
- Destination autocomplete
- Date picker
- Swap origin/destination control
- Quick recent-route chips

**State:**

- Selected search form values
- Places autocomplete data
- Recent search history

**Exit criteria:**

- Form validation works
- Search can be prefilled from home or saved routes
- Submit moves the user to results

---

### 3. Search Results / Bus Listing

**Route:** `/bus-listing`
**Goal:** show the available trips for the search.

**Interfaces to build:**

- Filter panel
- Sort control
- Trip cards
- Availability badge
- Price badge
- Empty state for no matches

**State:**

- `TripService.filtredTrips$`
- Search parameters
- Price and seat availability summaries

**Exit criteria:**

- Cards match the screenshot style
- Filters and sorting work
- Empty results go to the not-available page

---

### 4. Bus Details

**Route:** `/bus-listing/details/:id`
**Goal:** explain the trip before seat selection.

**Interfaces to build:**

- Trip summary header
- Stop schedule
- Amenities row
- Driver / bus info card
- Fare breakdown
- Seat layout preview

**State:**

- `TripService.trip$`
- Trip segments
- Bus metadata

**Exit criteria:**

- User understands route, price, and duration before booking

---

### 5. Seat Selection

**Route:** `/seat-select`
**Goal:** let the user choose seats with live availability.

**Interfaces to build:**

- Interactive seat map
- Deck selector if needed
- Seat legend
- Selected seat chips
- Hold timer
- Continue button

**State:**

- Available seats
- Route availability is computed from the requested segment chain and uses the minimum remaining across the covered segments.
- Selected seats
- Seat hold status

**Exit criteria:**

- Unavailable seats are disabled
- Seat selection is visually clear
- Holds are released correctly on timeout or cancel

---

### 6. Passenger Verification

**Route:** `/verification` or a future `/checkout` preparation page
**Goal:** collect passenger data and confirm the manifest before payment.

**Interfaces to build:**

- One passenger form row per seat
- Seat-to-passenger mapping summary
- Price breakdown card
- Contact and identity fields
- Terms checkbox
- Continue to payment button

**State:**

- Selected seats
- Passenger form array
- Order draft

**Exit criteria:**

- Every seat has valid passenger info
- Validation blocks incomplete submissions
- The order draft is ready for checkout

---

### 7. Checkout / Payment

**Route:** `/payment`
**Goal:** finalize the booking and collect payment.

**Interfaces to build:**

- Payment method cards
- Payment form by method
- Order amount summary
- Static coupon placeholder
- Static offer placeholder
- Pay button

**State:**

- Pending order total
- Selected payment method
- Static promo UI only

**Exit criteria:**

- Checkout is visually consistent
- Payment can confirm the order
- Coupons and offers remain static for now

---

### 8. Success Confirmation

**Route:** `/success`
**Goal:** show the booking result and ticket summary.

**Interfaces to build:**

- Success banner
- Booking reference summary
- Passenger and seat summary
- QR preview
- Action buttons: home, bookings, tickets

**State:**

- Confirmed order response
- Ticket or order reference

**Exit criteria:**

- Success state is clear and reusable after refresh

---

### 9. My Bookings

**Route:** `/my-bookings`
**Goal:** manage orders after checkout.

**Interfaces to build:**

- Booking cards
- Status badges
- Filter tabs
- Booking actions modal
- Order details drawer or panel

**State:**

- User order list
- Passenger manifest
- Order status

**Exit criteria:**

- User can inspect, cancel, and manage bookings
- Single-member cancellation stays here, not in the early booking flow

---

### 10. My Tickets

**Route:** `/my-tickets`
**Goal:** show issued tickets only after booking exists.

**Interfaces to build:**

- Ticket cards
- Ticket detail modal
- QR preview
- Status badge
- Share and download actions

**State:**

- Ticket list
- Parent order summary

**Exit criteria:**

- Ticket modal appears here, not earlier
- Tickets are read-only post-booking surfaces

---

### 11. Profile and Settings

**Routes:** `/profile`, `/settings`
**Goal:** expose user identity, preferences, and account settings.

**Interfaces to build:**

- Profile header
- Profile summary card
- Edit form
- Settings toggles
- Security section

**State:**

- `/api/users/me`
- Notification preferences
- Language preference

**Exit criteria:**

- Account pages keep the same card language and spacing as booking pages

---

### 12. Notifications

**Route:** `/notifications`
**Goal:** show system and booking updates.

**Interfaces to build:**

- Notification list
- Read/unread marker
- Filter tabs
- Mark as read action

**State:**

- Notification feed

**Exit criteria:**

- Notifications are readable and easy to scan on mobile

---

### 13. Saved Routes

**Route:** `/saved-routes`
**Goal:** let the user rebook frequently used routes.

**Interfaces to build:**

- Saved route cards
- Quick rebook action
- Remove action

**State:**

- Saved routes list or derived booking history

**Exit criteria:**

- Rebook pre-fills the search page correctly

---

### 14. Trip History

**Route:** `/trip-history`
**Goal:** show past trips and optional reviews.

**Interfaces to build:**

- Trip history cards
- Rebook action
- Review modal trigger

**State:**

- Completed bookings list
- Optional review draft

**Exit criteria:**

- Trip history stays as a post-booking archive, not part of the first booking flow

---

### 15. Help and Support

**Route:** `/help`
**Goal:** provide FAQ and contact options.

**Interfaces to build:**

- FAQ accordion
- Contact form
- Support links
- Optional chat widget placeholder

**State:**

- Static FAQ content or CMS content

**Exit criteria:**

- Support page keeps the same visual pattern as the rest of the app

---

### 16. Not Available

**Route:** `/not-available`
**Goal:** handle empty search results cleanly.

**Interfaces to build:**

- Empty-state hero
- Nearby dates suggestions
- Alternate route cards
- Retry search CTA

**State:**

- No-results search context

**Exit criteria:**

- No-results feels like a normal part of the flow, not a dead end

---

## Static Loyalty / Offers / Coupons

Keep these elements in the UI, but do not wire them to backend logic yet.

**Where they can appear:**

- Home page
- Checkout / payment summary
- Profile / rewards area

**Rules:**

- Present them as cards, chips, or banners
- Keep interactions static or informational only
- Do not implement redemption or discount calculations yet

---

## Backend / API Mapping

### Core Journey APIs

| Page           | Endpoint                                      | Method | Status |
| -------------- | --------------------------------------------- | ------ | ------ |
| Home           | `/api/trips/search`                           | GET    | Exists |
| Search         | `/api/trips/search?...`                       | GET    | Exists |
| Bus details    | `/api/trips/:id`                              | GET    | Exists |
| Seat selection | `/api/bookings/group/:tripId/seats/available` | GET    | TBD    |
| Seat selection | `/api/bookings/group/:tripId/seats/hold`      | POST   | TBD    |
| Verification   | `/api/bookings/group`                         | POST   | TBD    |
| Payment        | `/api/bookings/group/:orderId/confirm`        | POST   | TBD    |
| Success        | `/api/tickets/:id/document`                   | GET    | TBD    |

### Account / Post-Booking APIs

| Page                 | Endpoint                                                | Method | Status |
| -------------------- | ------------------------------------------------------- | ------ | ------ |
| My bookings          | `/api/bookings`                                         | GET    | TBD    |
| Cancel full order    | `/api/bookings/:orderId/cancel`                         | POST   | Exists |
| Cancel single member | `/api/bookings/group/:orderId/tickets/:ticketId/cancel` | POST   | Exists |
| My tickets           | `/api/tickets`                                          | GET    | Exists |
| Profile              | `/api/users/me`                                         | GET    | Exists |
| Profile update       | `/api/users/me`                                         | PATCH  | TBD    |
| Notifications        | `/api/notifications`                                    | GET    | TBD    |
| Support              | `/api/support/tickets`                                  | POST   | TBD    |

---

## Implementation Phases

### Phase 0. Foundation

- App shell, header, footer, route wiring
- Shared tokens and layout blocks
- Auth interceptor and basic services

**Done when:** the app opens with the final design language and navigation shell.

### Phase 1. Home to Success

- Home
- Search
- Search results / bus listing
- Bus details
- Seat selection
- Passenger verification
- Checkout / payment
- Success confirmation

**Done when:** a user can complete the full booking flow from start to finish.

### Phase 2. Post-Booking Management

- My bookings
- My tickets
- Group booking cancellation actions
- Ticket document and QR modal

**Done when:** the user can manage bookings and tickets without breaking the main flow.

### Phase 3. Account and Utility Pages

- Profile and settings
- Notifications
- Saved routes
- Trip history
- Help and support
- Not available page

**Done when:** all support and account surfaces are consistent with the booking UI.

### Phase 4. Static Promo Activation Later

- Loyalty UI
- Offers carousel
- Coupon UI in checkout

**Done when:** the promo surfaces are ready but still safely static.

---

## Current Frontoffice Codebase Gaps

- Routing still reflects an old partial flow
- Booking service still assumes a ticket-first model
- Seat selection and verification need to be connected to order draft state
- Post-booking pages need to be added in journey order
- Static promo areas must stay visible without backend dependency

---

## Recommended Build Order

1. Shell and design tokens
2. Home page
3. Search entry
4. Search results
5. Bus details
6. Seat selection
7. Verification
8. Payment
9. Success
10. My bookings
11. My tickets
12. Profile and settings
13. Notifications
14. Saved routes
15. Trip history
16. Help
17. Not available

---

## Delivery Notes

- Keep the home-to-checkout journey as the primary implementation path.
- Do not build the ticket modal first.
- Preserve loyalty/offers/coupons in the UI as static placeholders.
- Reuse the same card, badge, and shadow language on every screen.
