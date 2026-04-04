# 🎟️ BATCH 6 — Frontend Booking & POS Flow (Sprint 10)

## Implementation Plan

---

## Current State

### Frontend Passenger App (`apps/frontend`)

| File                                                                                                                                      | Status          | Issue                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [core/models/trip.model.ts](../apps/frontend/src/app/core/models/trip.model.ts)                                                           | ❌ LEGACY       | Flat model: `originId/destinationId/totalPrice`. Missing `ACTIVE` status, segments, stops, express fares, pickup/dropoff.      |
| [core/models/ticket.model.ts](../apps/frontend/src/app/core/models/ticket.model.ts)                                                       | ❌ LEGACY       | Uses `BOOKED/PAID` statuses. Backend uses `PENDING/CONFIRMED`. No `segmentIds`, `expressId`, `appliedPrice`.                   |
| [modules/pages/bus/trip.service.ts](../apps/frontend/src/app/modules/pages/bus/trip.service.ts)                                           | ❌ LEGACY       | Flat search params, no booking methods, no `loading$`. Response shape `data.objects` may differ from new API.                  |
| [modules/pages/bus/trip.resolver.ts](../apps/frontend/src/app/modules/pages/bus/trip.resolver.ts)                                         | ⚠️ NEEDS UPDATE | References old `TripSearchParams`, old `TripType`. Logic is salvageable.                                                       |
| [shared/components/search-card/search-card.component.ts](../apps/frontend/src/app/shared/components/search-card/search-card.component.ts) | ⚠️ NEEDS UPDATE | Bound to old model — `origin.id`, `destination.id` params. Search logic correct but error toast is hardcoded English.          |
| [modules/pages/bus/list/list.component.ts](../apps/frontend/src/app/modules/pages/bus/list/list.component.ts)                             | ❌ REWRITE      | `computeDisplayPrice()` uses legacy `stops[i].fare` accumulation. Needs segment-based pricing.                                 |
| [modules/pages/bus/details/details.component.ts](../apps/frontend/src/app/modules/pages/bus/details/details.component.ts)                 | ❌ EMPTY SHELL  | Only static HTML mockup. No bindings, no booking flow.                                                                         |
| [modules/modules.routes.ts](../apps/frontend/src/app/modules/modules.routes.ts)                                                           | ⚠️ NEEDS UPDATE | Routes exist for `/bus-listing`, `/bus-listing/details/:id`, `/seat-select`, `/verification`. Need booking confirmation route. |
| `core/services/booking.service.ts`                                                                                                        | ❌ MISSING      | Does not exist.                                                                                                                |

### Terminal Admin App (`apps/terminal`)

| File                                                                                                          | Status     | Issue                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| [core/models/ticket.model.ts](../apps/terminal/src/app/core/models/ticket.model.ts)                           | ❌ LEGACY  | Uses `BOOKED/PAID` statuses, seat row/col model, no `segmentIds/expressId/appliedPrice`.                               |
| [pages/tickets/ticket.service.ts](../apps/terminal/src/app/pages/tickets/ticket.service.ts)                   | ❌ LEGACY  | `fetchTickets()` hits `GET /api/tickets` but model mapping is wrong. `updateStatus()` uses nonexistent `PUT` endpoint. |
| [pages/tickets/ticket-list.component.ts](../apps/terminal/src/app/pages/tickets/ticket-list.component.ts)     | ❌ LEGACY  | Status options `BOOKED/PAID`, seat display, no pagination, no filters, no POS scoping.                                 |
| [pages/tickets/ticket-list.component.html](../apps/terminal/src/app/pages/tickets/ticket-list.component.html) | ❌ LEGACY  | Columns for `reference/agency/seats` — backend returns `segmentIds/target/appliedPrice`.                               |
| POS sell-ticket flow                                                                                          | ❌ MISSING | No sell-ticket component exists.                                                                                       |
| Ticket routes                                                                                                 | ⚠️ MINIMAL | Only `ticketsRoutes` with single root path → `TicketListComponent`.                                                    |

### Backend (Reference — Already Complete ✅)

| Endpoint                           | Method | Status                                                    |
| ---------------------------------- | ------ | --------------------------------------------------------- |
| `/api/bookings`                    | POST   | ✅ BookingController.createBooking                        |
| `/api/bookings/{ticketId}/confirm` | POST   | ✅ BookingController.confirmBooking                       |
| `/api/bookings/{ticketId}/cancel`  | POST   | ✅ BookingController.cancelBooking                        |
| `/api/tickets`                     | GET    | ✅ TicketController.getAllTickets                         |
| `/api/tickets/by-pos/{posId}`      | GET    | ✅ TicketController.getTicketsByPos (paginated, filtered) |
| `/api/tickets/{id}`                | GET    | ✅ TicketController.getTicket                             |
| `/api/tickets/{id}/document`       | GET    | ✅ TicketController.getTicketDocument                     |
| `/api/tickets/{id}/send-email`     | POST   | ✅ TicketController.sendTicketEmail                       |
| `/api/refunds/{refundId}/approve`  | POST   | ✅ RefundController.approve                               |
| `/api/refunds/{refundId}/reject`   | POST   | ✅ RefundController.reject                                |
| `/api/refunds/{refundId}/complete` | POST   | ✅ RefundController.complete                              |

---

## Target State

### Frontend Passenger App

A customer can:

1. **Search** for trips by origin/destination/date → see results with segment-based pricing & availability
2. **Select** a trip → see pickup/dropoff points, price breakdown (express vs segment sum)
3. **Book** → provide passenger info, generate idempotency key, call `POST /api/bookings`
4. **Confirm** → see PENDING ticket, expiry countdown, proceed to payment (confirm booking)
5. **View** their tickets with correct status colors and actions

### Terminal Admin App

A POS agent can:

1. **Quick-sell** tickets via a streamlined flow (search → select → customer → book → confirm)
2. **List** all tickets for their POS, with filters (status, date range, search)
3. **Manage** tickets: confirm (mark paid), cancel, print, email resend
4. **Admin view**: company-wide ticket list with POS filter

---

## Phase Breakdown

### Phase 0 — Foundation: Model Rewrites (No UI)

> Rewrite all TypeScript models to match the backend contract. This is the foundation — everything else depends on it.

#### Phase 0.1 — Frontend Trip Model Rewrite

**File**: `apps/frontend/src/app/core/models/trip.model.ts`

**Action**: FULL REWRITE — import the same 9-layer model used in terminal

```
trip.model.ts (new)
├── TripStatusEnum        — SCHEDULED | ACTIVE | COMPLETED | CANCELLED
├── GeoLocation           — { latitude, longitude }
├── TripBusRef            — { busId }
├── StopType              — { placeId, sequence, arrivalTime, departureTime, boardingAllowed, droppingAllowed }
├── SegmentType           — { segmentId, sequence, fromPlaceId, toPlaceId, departureTime, arrivalTime, maxSeats, bookedSeats, basePrice, distanceKm, durationMinutes }
├── ExpressFareType       — { expressId, fromPlaceId, toPlaceId, segmentsCovered[], price, validFrom, validUntil, active, totalDistanceKm?, totalDurationMinutes? }
├── PickupPointType       — { pointId, placeId, address, scheduledDepartureTime, active, location? }
├── DropoffPointType      — { pointId, placeId, address, scheduledArrivalTime, active, location? }
├── TripType              — { id, target, departureDate, timezone, status, bus, currency, seatHoldMinutes, stopSchedule[], pickupPoints[], dropoffPoints[], segments[], expressFares[], createdAt?, updatedAt?, version? }
├── TripSearchParams      — { originId, destinationId, date? }  ← keep
├── TripFilterInput       — { originId?, destinationId?, date?, agencyId? }  ← keep
└── TripDestinationForm   — { origin?, destination?, date? }  ← keep
```

**Note**: Remove `AgencyType`, `AgencyPhone`, `TripRouteSnapshot` (legacy). The `AgencyType` should move to a shared/agency model if still needed elsewhere. For the passenger app, company info comes from `target.company` resolved server-side.

**Dependency**: None

---

#### Phase 0.2 — Frontend Ticket/Booking Model

**File**: `apps/frontend/src/app/core/models/ticket.model.ts`

**Action**: FULL REWRITE — align with backend `TicketType.java` + `BookingResponse.java`

```
ticket.model.ts (new)
├── TicketStatusEnum      — PENDING | CONFIRMED | EXPIRED | CANCELLED
├── TargetSnapshot        — { company: string; pos?: string }
├── Ticket                — { id, version, tripId, target, segmentIds[], expressId?, pickupPointId, dropoffPointId, passengerId, appliedPrice, currency, status, idempotencyKey, expiresAt?, createdAt?, confirmedAt?, cancelledAt?, tripDepartureDate?, tripStatus? }
├── BookingRequest        — { tripId, fromPlaceId, toPlaceId, pickupPointId, dropoffPointId, passengerId, idempotencyKey }
└── BookingResponse       — same shape as Ticket (backend returns BookingResponse which maps 1:1)
```

**Dependency**: None

---

#### Phase 0.3 — Terminal Ticket Model Rewrite

**File**: `apps/terminal/src/app/core/models/ticket.model.ts`

**Action**: FULL REWRITE — same `Ticket` interface as frontend (keep in sync), plus admin-specific types

```
ticket.model.ts (new)
├── TicketStatusEnum      — PENDING | CONFIRMED | EXPIRED | CANCELLED
├── TargetSnapshot        — { company: string; pos?: string }
├── Ticket                — { id, version, tripId, target, segmentIds[], expressId?, pickupPointId, dropoffPointId, passengerId, appliedPrice, currency, status, idempotencyKey, expiresAt?, createdAt?, confirmedAt?, cancelledAt?, tripDepartureDate?, tripStatus? }
├── BookingRequest        — { tripId, fromPlaceId, toPlaceId, pickupPointId, dropoffPointId, passengerId, idempotencyKey }
├── BookingResponse       — same as Ticket
├── TicketPage            — { content: Ticket[], totalElements, totalPages, last, number }  ← for paginated GET /api/tickets/by-pos
└── TicketFilterInput     — { posId?, status?, page?, limit?, search? }
```

**Dependency**: None

---

### Phase 1 — Frontend Services

> Rewrite trip service with new model, create booking service.

#### Phase 1.1 — Rewrite Frontend TripService

**File**: `apps/frontend/src/app/modules/pages/bus/trip.service.ts`

**Action**: REWRITE to use new `TripType`, add `loading$` BehaviorSubject, fix response mapping.

```typescript
// BehaviorSubjects: trip$, allTrips$, filteredTrips$, loading$, selectedDestination$
// Methods:
//   searchTrips(params: TripSearchParams): Observable<TripType[]>
//   getTripById(id: string): Observable<TripType>
//   getTrips(): Observable<TripType[]>
//
// Key changes:
//   - Import new TripType (with segments, stops, etc.)
//   - loading$ BehaviorSubject (true/false via finalize)
//   - Response mapping: backend returns flat List<TripResponse> — remove `data.objects` wrapper, use response directly
//   - Search params: { companyId?, status?, date? (yyyy-MM-dd), page?, limit? } — NOT { originId, destinationId }
//     NOTE: The backend search is company-scoped, not origin/destination. The frontend may need
//     client-side filtering by origin/destination stops, or a new backend endpoint for passenger search.
//   - Remove console.log statements
```

**Design pattern compliance**:

- ✅ BehaviorSubject for each state
- ✅ loading$ with finalize()
- ✅ No posId passing (passenger app doesn't need POS scoping)

**Dependency**: Phase 0.1

---

#### Phase 1.2 — Create Frontend BookingService

**File**: `apps/frontend/src/app/core/services/booking.service.ts` (NEW)

**Action**: CREATE — handles all booking API calls.

```typescript
// BehaviorSubjects: currentBooking$, loading$
// Methods:
//   createBooking(req: BookingRequest): Observable<BookingResponse>
//     → POST /api/bookings
//     → pushes to currentBooking$ via tap()
//   confirmBooking(ticketId: string): Observable<BookingResponse>
//     → POST /api/bookings/{ticketId}/confirm
//   cancelBooking(ticketId: string): Observable<BookingResponse>
//     → POST /api/bookings/{ticketId}/cancel
//   getTicket(id: string): Observable<Ticket>
//     → GET /api/tickets/{id}
//   getMyTickets(): Observable<Ticket[]>
//     → GET /api/tickets (for current user context)
```

**Design pattern compliance**:

- ✅ BehaviorSubject pattern
- ✅ loading$ with finalize()
- ✅ No posId — passenger app context

**Dependency**: Phase 0.2

---

#### Phase 1.3 — Rewrite Terminal TicketService

**File**: `apps/terminal/src/app/pages/tickets/ticket.service.ts`

**Action**: REWRITE — new model, paginated API, POS scoping.

```typescript
// BehaviorSubjects: tickets$, ticket$, loading$, pagination$
// Methods:
//   fetchTickets(filters?: TicketFilterInput): Observable<TicketPage>
//     → GET /api/tickets/by-pos/{posId} with params: status, page, limit
//     → posId from localStorage.getItem('posId')
//   fetchAllTickets(filters?: TicketFilterInput): Observable<TicketPage>
//     → GET /api/tickets (admin only, company-scoped)
//   getTicketById(id: string): Observable<Ticket>
//     → GET /api/tickets/{id}
//   confirmTicket(ticketId: string): Observable<BookingResponse>
//     → POST /api/bookings/{ticketId}/confirm
//   cancelTicket(ticketId: string): Observable<BookingResponse>
//     → POST /api/bookings/{ticketId}/cancel
//   sendEmail(id: string, email?: string): Observable<any>
//     → POST /api/tickets/{id}/send-email
//   getDocument(id: string): Observable<any>
//     → GET /api/tickets/{id}/document
//   createBooking(req: BookingRequest): Observable<BookingResponse>
//     → POST /api/bookings
```

**Design pattern compliance**:

- ✅ BehaviorSubject + finalize()
- ✅ posId from localStorage (NEVER passed from component)
- ✅ Pagination state in BehaviorSubject

**Dependency**: Phase 0.3

---

#### Phase 1.4 — Create Terminal BookingService (POS Sell Flow)

**File**: `apps/terminal/src/app/pages/tickets/booking.service.ts` (NEW)

**Action**: CREATE — POS-specific booking flow service.

```typescript
// BehaviorSubjects: searchResults$, selectedTrip$, currentBooking$, loading$
// Methods:
//   searchTrips(params: TripSearchParams): Observable<TripType[]>
//     → GET /api/trips/search with params
//   selectTrip(trip: TripType): void
//     → pushes to selectedTrip$
//   createBooking(req: BookingRequest): Observable<BookingResponse>
//     → POST /api/bookings
//   confirmBooking(ticketId: string): Observable<BookingResponse>
//     → POST /api/bookings/{ticketId}/confirm
//   reset(): void
//     → clears all BehaviorSubjects back to initial state
```

**Dependency**: Phase 0.3

---

### Phase 2 — Frontend Passenger App: Search & Results (US-10.1)

> Update search card and trip list to work with the new model.

#### Phase 2.1 — Update SearchCardComponent

**File**: `apps/frontend/src/app/shared/components/search-card/search-card.component.ts`

**Changes**:

- Import new `TripSearchParams` (interface hasn't changed shape — `originId`, `destinationId`, `date?`)
- Replace hardcoded error string `'No trips found...'` with i18n: `this.translate.instant('SEARCH.NO_RESULTS')`
- No structural changes needed — the search params are already `{ originId, destinationId, date }` which matches the backend `GET /api/trips/search`

**Dependency**: Phase 0.1

---

#### Phase 2.2 — Rewrite BusListComponent

**File**: `apps/frontend/src/app/modules/pages/bus/list/list.component.ts`

**Changes**:

- `computeDisplayPrice()` → REWRITE for segment-based pricing:
  ```
  1. Find originStop (where placeId matches originId & boardingAllowed)
  2. Find destinationStop (where placeId matches destinationId & droppingAllowed)
  3. Find segments between originStop.sequence and destinationStop.sequence
  4. Check for express fare covering those segments → if found, use express price
  5. Else → sum of segment.basePrice for covered segments
  ```
- Compute `availableSeats` → `MIN(segment.maxSeats - segment.bookedSeats)` across covered segments
- Update template columns: departure time (from origin stop), arrival time (at destination stop), duration, price, available seats, company

**File**: `apps/frontend/src/app/modules/pages/bus/list/list.component.html`

**Rewrite template** to show:

- Company name (from target, or bus info)
- Departure time → Arrival time
- Duration
- Price (express or segment sum) with currency
- Available seats badge
- "Select" button → navigate to details/:id with `queryParams: { originId, destinationId }`

**Dependency**: Phase 1.1, Phase 2.1

---

#### Phase 2.3 — Update TripResolver

**File**: `apps/frontend/src/app/modules/pages/bus/trip.resolver.ts`

**Changes**:

- Import new `TripType`, `TripSearchParams`
- Verify it still works — logic is already correct (reads queryParams, calls searchTrips)
- Remove stale type references

**Dependency**: Phase 0.1, Phase 1.1

---

### Phase 3 — Frontend Passenger App: Journey Selection & Booking (US-10.2 + US-10.3)

> The details page becomes the full booking flow: pickup/dropoff selection → passenger info → confirm.

#### Phase 3.1 — Rewrite BusDetailsComponent (Journey Selection + Booking)

**File**: `apps/frontend/src/app/modules/pages/bus/details/details.component.ts`

**Action**: FULL REWRITE — multi-step booking flow component.

```
BusDetailsComponent (rewrite)
├── Inputs: route param :id, queryParams { originId, destinationId }
├── OnInit:
│   ├── Load trip via TripService.getTripById(id)
│   ├── Resolve origin/destination stops from queryParams
│   ├── Compute covered segments (origin.sequence → destination.sequence)
│   ├── Compute price (express fare check, then segment sum fallback)
│   ├── Filter active pickup points for origin stop's placeId
│   └── Filter active dropoff points for destination stop's placeId
├── Step 1: Journey Summary
│   ├── Show route visual (origin → covered stops → destination)
│   ├── Show departure/arrival times from stops
│   ├── Show segment chain with times
│   ├── Show price breakdown (express vs standard)
│   ├── Pickup point radio list (reactive form)
│   └── Dropoff point radio list (reactive form)
├── Step 2: Passenger Info
│   ├── passengerId field (logged-in user auto-filled, or manual entry)
│   └── Booking summary card
├── Step 3: Confirm
│   ├── "Book Now" button
│   ├── Generates UUID idempotencyKey
│   ├── Calls BookingService.createBooking()
│   ├── On success → shows ticket card with PENDING status
│   │   ├── Expiry countdown timer (seatHoldMinutes)
│   │   ├── "Confirm Payment" button → BookingService.confirmBooking()
│   │   └── "Cancel" button → BookingService.cancelBooking()
│   └── On error:
│       ├── SEGMENT_CAPACITY_EXCEEDED → i18n "no seats available"
│       └── Other → generic translated error
└── Cleanup: destroy$ + takeUntil pattern
```

**Reactive Form**:

```typescript
bookingForm = fb.group({
  pickupPointId: [null, Validators.required],
  dropoffPointId: [null, Validators.required],
});
```

**Design pattern compliance**:

- ✅ destroy$ / takeUntil cleanup
- ✅ Reactive forms with FormBuilder
- ✅ OnPush change detection + markForCheck()
- ✅ i18n for all strings
- ✅ No hardcoded posId (passenger app)

**Dependency**: Phase 1.1, Phase 1.2

---

#### Phase 3.2 — Rewrite BusDetailsComponent Template

**File**: `apps/frontend/src/app/modules/pages/bus/details/details.component.html`

**Action**: FULL REWRITE — replace static mockup with data-bound template.

```
Template structure:
├── Back button (routerLink to /bus-listing with queryParams preserved)
├── Trip header (company, bus type, departure date)
├── Journey visual (timeline: origin stop → intermediate stops → destination stop)
├── Price card
│   ├── Express fare price (if available) + "saves X TND vs standard"
│   └── Standard price (sum of segment base prices)
├── Pickup Points section
│   └── Radio list: *ngFor pickup points → form control pickupPointId
├── Dropoff Points section
│   └── Radio list: *ngFor dropoff points → form control dropoffPointId
├── Covered Segments section (collapsible)
│   └── *ngFor segments: from → to, departure → arrival, basePrice
├── Availability badge: "X seats left" (min across segments)
├── "Book Now" button [disabled]="bookingForm.invalid || loading"
├── Booking success card (shown after booking)
│   ├── Ticket ID, status badge, price
│   ├── Expiry countdown
│   ├── "Confirm Payment" button
│   └── "Cancel Booking" button
└── Error alert (shown on failure)
```

**Dependency**: Phase 3.1

---

#### Phase 3.3 — BusDetailsComponent Styles

**File**: `apps/frontend/src/app/modules/pages/bus/details/details.component.scss`

**Action**: REWRITE — clean styles for journey visual, pickup/dropoff radio cards, price card, countdown timer.

**Dependency**: Phase 3.2

---

### Phase 4 — Frontend Passenger App: Routes & Glue

#### Phase 4.1 — Update Frontend Routes

**File**: `apps/frontend/src/app/modules/pages/bus/bus.routes.ts`

**Changes**:

- Add resolver to `details/:id` route for fetching trip by ID
- Optionally add a `/booking-confirmation/:ticketId` route (or keep it within details component state)

```typescript
export const busRoutes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./list/list.component").then((m) => m.BusListComponent),
  },
  {
    path: "details/:id",
    loadComponent: () =>
      import("./details/details.component").then((m) => m.BusDetailsComponent),
    // No resolver — component fetches trip via TripService.getTripById()
    // This is correct: details page needs route param + query params, not resolver data
  },
];
```

**Decision**: Keep booking flow WITHIN the details component (no separate booking route). The component manages its own state machine: `SELECTING → BOOKED → CONFIRMED`. This avoids route complexity and keeps the flow linear.

**Dependency**: Phase 3.1

---

### Phase 5 — Terminal App: Ticket List Rewrite (US-10.5)

> Rewrite the ticket list for the admin/POS views.

#### Phase 5.1 — Rewrite TicketListComponent

**File**: `apps/terminal/src/app/pages/tickets/ticket-list.component.ts`

**Action**: FULL REWRITE

```
TicketListComponent (rewrite)
├── Injects: TicketService, AlertService, TranslateService, NgbModal
├── State:
│   ├── tickets$ from TicketService.tickets$
│   ├── loading$ from TicketService.loading$
│   ├── pagination$ from TicketService.pagination$
│   ├── activeFilter: TicketStatusEnum | null
│   └── searchTerm: string
├── OnInit:
│   └── fetchTickets() with default filters
├── Status config:
│   ├── TicketStatusEnum.PENDING → badge-light-warning
│   ├── TicketStatusEnum.CONFIRMED → badge-light-success
│   ├── TicketStatusEnum.CANCELLED → badge-light-danger
│   └── TicketStatusEnum.EXPIRED → badge-light-secondary
├── Actions:
│   ├── confirmTicket(ticket) → alert.confirm() → ticketService.confirmTicket()
│   ├── cancelTicket(ticket) → alert.confirm() → ticketService.cancelTicket()
│   ├── sendEmail(ticket) → ticketService.sendEmail()
│   ├── viewDocument(ticket) → ticketService.getDocument() → open in modal/new tab
│   ├── filterByStatus(status) → fetchTickets with filter
│   ├── onPageChange(page) → fetchTickets with page
│   └── openDetailModal(ticket) → modal with full ticket info
└── Cleanup: destroy$ pattern
```

**Design pattern compliance**:

- ✅ BehaviorSubject subscriptions with takeUntil
- ✅ AlertService for confirmations
- ✅ TranslateModule for all labels
- ✅ posId never passed — service reads from localStorage

**Dependency**: Phase 1.3

---

#### Phase 5.2 — Rewrite TicketListComponent Template

**File**: `apps/terminal/src/app/pages/tickets/ticket-list.component.html`

**Action**: FULL REWRITE

```
Template structure:
├── Header: title + refresh button
├── Filter bar:
│   ├── Status filter (ng-select or button group: ALL / PENDING / CONFIRMED / CANCELLED / EXPIRED)
│   ├── Date range filter (mwlFlatpickr)
│   └── Search input (ticket ID or passenger name)
├── Table:
│   ├── Columns: Ticket ID, Trip (route + date), Passenger, Price, Status, POS, Created
│   ├── Row click → open detail modal
│   └── Action buttons: Confirm (if PENDING), Cancel (if PENDING/CONFIRMED), Email, Document
├── Pagination (ngb-pagination)
├── Empty state: "No tickets found"
└── Detail modal template (#ticketDetail)
```

**Dependency**: Phase 5.1

---

#### Phase 5.3 — Ticket List Styles

**File**: `apps/terminal/src/app/pages/tickets/ticket-list.component.scss`

**Action**: REWRITE — consistent with existing terminal table styles (reference trip-list).

**Dependency**: Phase 5.2

---

### Phase 6 — Terminal App: POS Sell-Ticket Flow (US-10.4)

> New component for POS agents to sell tickets directly.

#### Phase 6.1 — Create SellTicketComponent

**File**: `apps/terminal/src/app/pages/tickets/sell-ticket.component.ts` (NEW)

**Action**: CREATE — streamlined POS selling wizard.

```
SellTicketComponent (new)
├── Injects: BookingService (terminal), TicketService, AlertService, TranslateService, PlacesService, UserService (requires new GET /api/users/search?q= endpoint)
├── Steps:
│   ├── Step 1: Quick Search
│   │   ├── origin (ng-select places)
│   │   ├── destination (ng-select places)
│   │   ├── date (mwlFlatpickr)
│   │   └── Search button → BookingService.searchTrips()
│   ├── Step 2: Select Trip
│   │   ├── Trip cards with price, availability, departure/arrival
│   │   ├── Select → loads pickup/dropoff points
│   │   ├── Pickup point radio
│   │   └── Dropoff point radio
│   ├── Step 3: Customer
│   │   ├── Search existing customer (by phone/email)
│   │   ├── Or quick-create (name, phone, email)
│   │   └── Customer selected → passengerId
│   ├── Step 4: Confirm & Pay
│   │   ├── Booking summary
│   │   ├── "Create Booking" → BookingService.createBooking()
│   │   ├── On success: show PENDING ticket
│   │   ├── "Cash Payment" → TicketService.confirmTicket() (immediate)
│   │   ├── Success → alert.success() + option to print/email
│   │   └── "Print Ticket" / "Email Ticket" actions
│   └── Reset button → BookingService.reset() → back to Step 1
├── Reactive Form:
│   └── fb.group({
│         origin: [null, Validators.required],
│         destination: [null, Validators.required],
│         date: [null],
│         pickupPointId: [null, Validators.required],
│         dropoffPointId: [null, Validators.required],
│         passengerId: [null, Validators.required],
│       })
└── Cleanup: destroy$ pattern
```

**Design pattern compliance**:

- ✅ Reactive forms with FormBuilder
- ✅ destroy$ cleanup
- ✅ AlertService for confirmations
- ✅ i18n everywhere
- ✅ OnPush + markForCheck()
- ✅ posId from localStorage in service

**Dependency**: Phase 1.3, Phase 1.4

---

#### Phase 6.2 — SellTicketComponent Template

**File**: `apps/terminal/src/app/pages/tickets/sell-ticket.component.html` (NEW)

```
Template structure:
├── Card with stepper (nav-pills or Bootstrap steps)
├── Step 1: Search form (origin/dest ng-select + date picker + search button)
├── Step 2: Trip results cards + pickup/dropoff radio selection
├── Step 3: Customer search/create inline form
├── Step 4: Summary + action buttons (Create Booking → Confirm Cash → Print/Email)
└── Footer: Reset / Back / Next navigation
```

**Dependency**: Phase 6.1

---

#### Phase 6.3 — SellTicketComponent Styles

**File**: `apps/terminal/src/app/pages/tickets/sell-ticket.component.scss` (NEW)

**Dependency**: Phase 6.2

---

#### Phase 6.4 — Update Terminal Ticket Routes

**File**: `apps/terminal/src/app/pages/tickets/ticket-list.routes.ts`

**Action**: ADD sell-ticket route.

```typescript
export const ticketsRoutes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./ticket-list.component").then((m) => m.TicketListComponent),
  },
  {
    path: "sell",
    loadComponent: () =>
      import("./sell-ticket.component").then((m) => m.SellTicketComponent),
  },
];
```

**Dependency**: Phase 6.1

---

### Phase 7 — i18n for Both Apps

#### Phase 7.1 — Frontend Passenger App i18n

**Files**:

- `apps/frontend/src/assets/i18n/en-gb.json`
- `apps/frontend/src/assets/i18n/fr-fr.json`

**Keys to add**:

```json
{
  "SEARCH": {
    "NO_RESULTS": "No trips found for the selected criteria.",
    "PLACEHOLDER_ORIGIN": "From",
    "PLACEHOLDER_DESTINATION": "To",
    "PLACEHOLDER_DATE": "Travel date",
    "BUTTON": "Search"
  },
  "TRIPS": {
    "LIST": {
      "DEPARTURE": "Departure",
      "ARRIVAL": "Arrival",
      "DURATION": "Duration",
      "PRICE": "Price",
      "SEATS_LEFT": "{{count}} seats left",
      "NO_SEATS": "Sold out",
      "SELECT": "Select",
      "EXPRESS_FARE": "Express",
      "STANDARD_FARE": "Standard",
      "SAVES": "Saves {{amount}} {{currency}}"
    },
    "DETAILS": {
      "TITLE": "Trip Details",
      "JOURNEY": "Journey",
      "PICKUP_POINTS": "Pickup Points",
      "DROPOFF_POINTS": "Dropoff Points",
      "SEGMENTS": "Route Segments",
      "PRICE_BREAKDOWN": "Price Breakdown",
      "EXPRESS_PRICE": "Express fare",
      "STANDARD_PRICE": "Standard fare (segment sum)",
      "AVAILABLE": "{{count}} seats available",
      "SELECT_PICKUP": "Select pickup point",
      "SELECT_DROPOFF": "Select dropoff point"
    }
  },
  "BOOKING": {
    "TITLE": "Book Ticket",
    "PASSENGER_INFO": "Passenger Information",
    "SUMMARY": "Booking Summary",
    "CONFIRM": "Book Now",
    "CONFIRMING": "Booking...",
    "SUCCESS_TITLE": "Booking Created!",
    "SUCCESS_TEXT": "Your ticket is reserved. Please confirm payment before it expires.",
    "TICKET_ID": "Ticket ID",
    "STATUS": "Status",
    "EXPIRES_IN": "Expires in",
    "EXPIRED": "Reservation expired",
    "CONFIRM_PAYMENT": "Confirm Payment",
    "CANCEL_BOOKING": "Cancel Booking",
    "PAYMENT_SUCCESS": "Payment confirmed! Your ticket is ready.",
    "CANCEL_SUCCESS": "Booking cancelled.",
    "ERRORS": {
      "SEGMENT_CAPACITY_EXCEEDED": "No seats available for this trip. Please try another trip.",
      "GENERIC": "Something went wrong. Please try again.",
      "TICKET_EXPIRED": "Your reservation has expired. Please book again."
    },
    "STATUS_LABELS": {
      "PENDING": "Pending",
      "CONFIRMED": "Confirmed",
      "EXPIRED": "Expired",
      "CANCELLED": "Cancelled"
    }
  }
}
```

**Dependency**: Phase 3 (frontend booking flow)

---

#### Phase 7.2 — Terminal App i18n

**Files**:

- `apps/terminal/src/assets/i18n/en-gb.json`
- `apps/terminal/src/assets/i18n/fr-fr.json`

**Keys to add/update**:

```json
{
  "TICKETS": {
    "TITLE": "Tickets",
    "LOADING": "Loading tickets...",
    "EMPTY": "No tickets found.",
    "SELL_TICKET": "Sell Ticket",
    "LABEL": {
      "TICKET_ID": "Ticket ID",
      "TRIP_ROUTE": "Route",
      "TRIP_DATE": "Trip Date",
      "PASSENGER": "Passenger",
      "PRICE": "Price",
      "STATUS": "Status",
      "POS": "POS",
      "CREATED_AT": "Created",
      "EXPIRES_AT": "Expires"
    },
    "STATUS": {
      "PENDING": "Pending",
      "CONFIRMED": "Confirmed",
      "EXPIRED": "Expired",
      "CANCELLED": "Cancelled"
    },
    "ACTIONS": {
      "CONFIRM": "Confirm Payment",
      "CANCEL": "Cancel Ticket",
      "SEND_EMAIL": "Send Email",
      "VIEW_DOCUMENT": "View Ticket",
      "PRINT": "Print",
      "VIEW_DETAILS": "View Details"
    },
    "FILTERS": {
      "ALL": "All",
      "STATUS": "Status",
      "DATE_RANGE": "Date Range",
      "SEARCH": "Search by ticket ID or passenger..."
    },
    "MESSAGES": {
      "CONFIRM_TITLE": "Confirm Payment",
      "CONFIRM_TEXT": "Mark this ticket as paid?",
      "CONFIRM_OK": "Confirm",
      "CONFIRM_SUCCESS": "Ticket confirmed successfully.",
      "CANCEL_TITLE": "Cancel Ticket",
      "CANCEL_TEXT": "Cancel this ticket? A refund request will be created.",
      "CANCEL_OK": "Cancel Ticket",
      "CANCEL_SUCCESS": "Ticket cancelled.",
      "EMAIL_SUCCESS": "Ticket emailed successfully.",
      "EMAIL_ERROR": "Failed to send email.",
      "LOAD_ERROR_TITLE": "Error",
      "LOAD_ERROR_TEXT": "Failed to load tickets."
    },
    "SELL": {
      "TITLE": "Sell Ticket",
      "STEP_SEARCH": "Search Trip",
      "STEP_SELECT": "Select Trip",
      "STEP_CUSTOMER": "Customer",
      "STEP_CONFIRM": "Confirm & Pay",
      "SEARCH_TRIPS": "Search",
      "NO_TRIPS": "No trips found.",
      "SELECT_TRIP": "Select",
      "PICKUP": "Pickup Point",
      "DROPOFF": "Dropoff Point",
      "CUSTOMER_SEARCH": "Search customer by phone or email...",
      "CUSTOMER_CREATE": "Create New Customer",
      "BOOKING_SUMMARY": "Booking Summary",
      "CREATE_BOOKING": "Create Booking",
      "CASH_PAYMENT": "Cash Payment (Confirm Now)",
      "BOOKING_CREATED": "Booking created!",
      "PAYMENT_CONFIRMED": "Payment confirmed. Ticket is ready.",
      "PRINT_TICKET": "Print Ticket",
      "EMAIL_TICKET": "Email Ticket",
      "NEW_SALE": "New Sale",
      "RESET": "Start Over"
    }
  }
}
```

**Dependency**: Phase 5, Phase 6

---

### Phase 8 — Build Verification & Cleanup

#### Phase 8.1 — Remove Legacy Code

- Delete `TicketSeat`, `TicketUserSnapshot` from both apps' old ticket models (they're being fully replaced)
- Remove `AgencyType` / `AgencyPhone` from frontend trip model if not used elsewhere
- Remove `TripRouteSnapshot` from frontend trip model
- Clean up any `console.log` statements in trip.service.ts

#### Phase 8.2 — Build Both Apps

```bash
# Frontend
cd apps/frontend && ng build --configuration=production

# Terminal
cd apps/terminal && ng build --configuration=production
```

Verify zero compilation errors in both apps.

**Dependency**: All phases complete

---

## Task Summary (Ordered with Dependencies)

| #      | Task                                                     | Phase   | App         | Depends On      | Complexity   |
| ------ | -------------------------------------------------------- | ------- | ----------- | --------------- | ------------ |
| #      | Task                                                     | Phase   | App         | Depends On      | Complexity   |
| ---    | ------                                                   | ------- | -----       | ------------    | ------------ |
| **0a** | **Add origin/dest filtering to `GET /api/trips/search`** | **PRE** | **backend** | **—**           | **M**        |
| **0b** | **Add `GET /api/users/search?q=...` endpoint**           | **PRE** | **backend** | **—**           | **S**        |
| 1      | Rewrite frontend `trip.model.ts`                         | 0.1     | frontend    | —               | S            |
| 2      | Rewrite frontend `ticket.model.ts`                       | 0.2     | frontend    | —               | S            |
| 3      | Rewrite terminal `ticket.model.ts`                       | 0.3     | terminal    | —               | S            |
| 4      | Rewrite frontend `trip.service.ts`                       | 1.1     | frontend    | #1, **#0a**     | M            |
| 5      | Create frontend `booking.service.ts`                     | 1.2     | frontend    | #2              | M            |
| 6      | Rewrite terminal `ticket.service.ts`                     | 1.3     | terminal    | #3              | M            |
| 7      | Create terminal `booking.service.ts`                     | 1.4     | terminal    | #3              | M            |
| 8      | Update `search-card.component.ts` (i18n fix)             | 2.1     | frontend    | #1              | S            |
| 9      | Rewrite `list.component.ts` + `.html`                    | 2.2     | frontend    | #4, #8          | L            |
| 10     | Update `trip.resolver.ts`                                | 2.3     | frontend    | #1, #4          | S            |
| 11     | Rewrite `details.component.ts` (booking flow)            | 3.1     | frontend    | #4, #5          | XL           |
| 12     | Rewrite `details.component.html`                         | 3.2     | frontend    | #11             | L            |
| 13     | Rewrite `details.component.scss`                         | 3.3     | frontend    | #12             | S            |
| 14     | Update `bus.routes.ts`                                   | 4.1     | frontend    | #11             | S            |
| 15     | Rewrite `ticket-list.component.ts`                       | 5.1     | terminal    | #6              | L            |
| 16     | Rewrite `ticket-list.component.html`                     | 5.2     | terminal    | #15             | L            |
| 17     | Rewrite `ticket-list.component.scss`                     | 5.3     | terminal    | #16             | S            |
| 18     | Create `sell-ticket.component.ts`                        | 6.1     | terminal    | #6, #7, **#0b** | XL           |
| 19     | Create `sell-ticket.component.html`                      | 6.2     | terminal    | #18             | L            |
| 20     | Create `sell-ticket.component.scss`                      | 6.3     | terminal    | #19             | S            |
| 21     | Update `ticket-list.routes.ts`                           | 6.4     | terminal    | #18             | S            |
| 22     | Frontend i18n (en-gb + fr-fr)                            | 7.1     | frontend    | #11             | M            |
| 23     | Terminal i18n (en-gb + fr-fr)                            | 7.2     | terminal    | #15, #18        | M            |
| 24     | Remove legacy code + cleanup                             | 8.1     | both        | all             | S            |
| 25     | Build verification                                       | 8.2     | both        | #24             | S            |

---

## API Contract Reference (for frontend developers)

### Search Trips (Current — needs backend update for origin/dest filtering)

```
GET /api/trips/search?companyId=...&status=ACTIVE&date=2026-04-10&page=0&limit=10
Authorization: Bearer <token>  (optional — trips are public per SecurityConfig)

Current params: companyId?, status?, date? (yyyy-MM-dd), page (default 0), limit (default 10)
⚠️ NEEDED: originPlaceId?, destinationPlaceId? (Task #0a adds these)

→ 200: TripResponse[]  (flat array, NOT wrapped — no { objects } or { content })
```

### Create Booking

```
POST /api/bookings
Content-Type: application/json
Authorization: Bearer <token>

{
  "tripId": "string",
  "fromPlaceId": "string",      // origin stop's placeId
  "toPlaceId": "string",        // destination stop's placeId
  "pickupPointId": "string",    // selected pickup point ID
  "dropoffPointId": "string",   // selected dropoff point ID
  "passengerId": "string",      // customer/user ID
  "idempotencyKey": "string"    // client-generated UUID
}

→ 201: BookingResponse (Ticket with PENDING status)
→ 409: { message: "SEGMENT_CAPACITY_EXCEEDED" }
→ 409: { message: "TICKET_IDEMPOTENCY_REPLAY" } (returns existing ticket)
```

### Confirm Booking

```
POST /api/bookings/{ticketId}/confirm

→ 200: BookingResponse (Ticket with CONFIRMED status)
→ 409: { message: "INVALID_TICKET_TRANSITION: expected PENDING, got ..." }
```

### Cancel Booking

```
POST /api/bookings/{ticketId}/cancel

→ 200: BookingResponse (Ticket with CANCELLED status + Refund created)
→ 409: { message: "INVALID_TICKET_TRANSITION" }
```

### List Tickets (POS-scoped)

```
GET /api/tickets/by-pos/{posId}?status=PENDING&page=0&limit=20

→ 200: { content: Ticket[], totalElements, totalPages, last, number }
```

### List All Tickets (Admin)

```
GET /api/tickets

→ 200: Ticket[]
```

### Get Ticket Document

```
GET /api/tickets/{id}/document
Authorization: Bearer <token>

→ 200: TicketDocumentView JSON:
  {
    "ticketId": "string",
    "reference": "string",
    "htmlContent": "string",        // rendered HTML for printing (use iframe + window.print())
    "qrCodeUrl": "string",
    "qrCodeDataUri": "string",      // base64 data URI for inline QR display
    "renderedAt": "ISO instant",
    "passengerEmail": "string",
    "subject": "string",
    "metadata": { ... }
  }
```

### Send Ticket Email

```
POST /api/tickets/{id}/send-email
{ "email": "optional@override.com" }

→ 200: { status: "sent", email: "..." }
```

---

## Component Tree

### Frontend Passenger App

```
/ (HomeComponent)
├── SearchCardComponent
│   └── → navigates to /bus-listing?originId=...&destinationId=...&date=...
│
/bus-listing (BusListComponent)  ← resolver: TripResolver
│   └── Trip result cards → click → /bus-listing/details/:id?originId=...&destinationId=...
│
/bus-listing/details/:id (BusDetailsComponent)  ← booking flow
    ├── Journey summary (stops, segments, times)
    ├── Pickup/dropoff radio selection
    ├── Price breakdown (express vs standard)
    ├── "Book Now" → POST /api/bookings
    ├── Ticket card (PENDING state)
    │   ├── Expiry countdown
    │   ├── "Confirm Payment" → POST /api/bookings/{id}/confirm
    │   └── "Cancel" → POST /api/bookings/{id}/cancel
    └── Injects: TripService, BookingService
```

### Terminal Admin App

```
/tickets (TicketListComponent)
│   ├── Filter bar (status, date, search)
│   ├── Paginated ticket table
│   ├── Row actions: confirm, cancel, email, document
│   └── "Sell Ticket" button → /tickets/sell
│
/tickets/sell (SellTicketComponent)
    ├── Step 1: Search (origin/dest/date → search trips)
    ├── Step 2: Select trip + pickup/dropoff
    ├── Step 3: Customer lookup/create
    ├── Step 4: Confirm + Cash payment
    │   ├── POST /api/bookings (create)
    │   ├── POST /api/bookings/{id}/confirm (cash payment)
    │   ├── Print / Email ticket
    │   └── "New Sale" resets flow
    └── Injects: BookingService, TicketService, PlacesService, UserService (for customer lookup — requires new GET /api/users/search?q= endpoint)
```

---

## Risks & Notes

### Risks

| Risk                                           | Impact              | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Model migration breaks existing pages**      | HIGH                | Phase 0 rewrites models with no UI changes — build-verify before proceeding                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Backend response shape mismatch**            | ~~MEDIUM~~ RESOLVED | ✅ `GET /api/trips/search` returns a flat `List<TripResponse>` (no wrapper). Frontend `data.objects` mapping must be removed — use response directly.                                                                                                                                                                                                                                                                                                                                                                                |
| **Trip search API param mismatch**             | HIGH                | ⚠️ Backend `GET /api/trips/search` accepts `companyId, status, date, page, limit` — NOT `originId, destinationId`. The passenger app needs origin/destination filtering. **Two options**: (A) Add `originPlaceId` and `destinationPlaceId` query params to `TripController.searchTrips()` with server-side stop matching, or (B) fetch all ACTIVE trips for the date and filter client-side by stops' placeId + boardingAllowed/droppingAllowed. **Recommended: Option A** (backend filter) for performance. This is a backend task. |
| **Customer lookup API does not exist**         | MEDIUM              | ❌ No customer/passenger search endpoint exists. `UserController` has `GET /api/users` (paginated) and `GET /api/users/{id}` but NO search by phone/email. **Action**: Add `GET /api/users/search?q=...` endpoint to backend before Phase 6 (POS sell flow).                                                                                                                                                                                                                                                                         |
| **Expiry countdown requires interval cleanup** | LOW                 | Use `interval(1000)` with takeUntil(destroy$) — standard pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Concurrent booking (race condition)**        | LOW                 | Already handled by backend CAS + idempotencyKey. Frontend just needs to show capacity errors.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Backend Pre-requisites (NEW — discovered from code inspection)

Before Batch 6 frontend work begins, two backend changes are needed:

1. **`GET /api/trips/search` — Add origin/destination filtering** (HIGH priority, blocks Phase 1.1 + 2.x)
   - Current: `TripController.searchTrips(companyId, status, date, page, limit)`
   - Needed: Add `originPlaceId` and `destinationPlaceId` params
   - Logic: Filter trips where `stopSchedule` contains a stop with `placeId=originPlaceId && boardingAllowed=true` at a lower sequence than a stop with `placeId=destinationPlaceId && droppingAllowed=true`, AND `status=ACTIVE`
   - This is the core passenger search use case

2. **`GET /api/users/search?q=...` — Customer search endpoint** (MEDIUM priority, blocks Phase 6.1)
   - Current: `UserController` has no search-by-phone/email endpoint
   - Needed: Add `GET /api/users/search?q={phone_or_email}` that returns matching users
   - Used by POS sell flow to look up existing customers before booking

### Open Questions — RESOLVED

All 4 questions answered by inspecting backend Java controllers:

1. **Customer API**: ❌ **Does NOT exist.** `UserController.java` has `GET /api/users` (paginated list), `GET /api/users/{id}`, `GET /api/users/by-target`, `GET /api/users/by-company` — but NO search by phone or email. **Pre-requisite**: Add `GET /api/users/search?q=...` endpoint to `UserController` before implementing Phase 6 (POS sell flow). This is a NEW backend task.

2. **Trip search response**: ✅ **Flat `List<TripResponse>`** — no wrapper object. `TripController.searchTrips()` returns `ResponseEntity.ok(content)` where `content = results.stream().map(TripResponse::from).toList()`. The current frontend `data.objects` mapping is WRONG — must be fixed in Phase 1.1 to use the response array directly. Search params: `companyId`, `status`, `date` (LocalDate), `page`, `limit`.

3. **Ticket document/print**: ✅ **JSON view model with HTML content.** `TicketDocumentService.buildDocument()` returns a `TicketDocumentView` POJO with fields: `ticketId`, `reference`, `htmlContent` (rendered HTML string), `qrCodeUrl`, `qrCodeDataUri` (base64 data URI), `renderedAt`, `passengerEmail`, `subject`, `metadata` (Map). For printing: render `htmlContent` in an iframe and call `window.print()`. For display: show QR code via `qrCodeDataUri`.

4. **Frontend auth**: ✅ **YES, JWT-authenticated.** `SecurityConfig.java` uses `.anyRequest().authenticated()` — `/api/bookings` requires auth. `JwtAuthFilter` extracts `Bearer` token from `Authorization` header, validates via `JwtService`, sets `SecurityContext` with user ID as principal and role as authority. Session is stateless. The frontend must include `Authorization: Bearer <token>` header on all booking calls. Verify that the frontend HTTP interceptor adds this header (check `apps/frontend/src/app/core/interceptors/`).

### Breaking Changes

- `TripType` interface changes everywhere it's imported → search-card, list, details, resolver, service
- `TicketStatus` enum values change from `BOOKED/PAID` to `PENDING/CONFIRMED` → all ticket-related code
- `Ticket` interface fields change drastically → any code accessing `seats`, `userId`, `totalAmount`, `bookingReference` will break

### Migration Strategy

Phases 0.1–0.3 (model rewrites) will intentionally break compilation. Phases 1.x (service rewrites) fix the service layer. Phases 2–3 (component rewrites) fix the UI layer. **Do not try to build between Phase 0 and Phase 2 completion** — expect compilation errors during that window.

**Recommended implementation order**: Do one app at a time.

1. Frontend: Phase 0.1 → 0.2 → 1.1 → 1.2 → 2.x → 3.x → 4.1 → 7.1 → build
2. Terminal: Phase 0.3 → 1.3 → 1.4 → 5.x → 6.x → 7.2 → build

---

## Estimated File Count

| Action | Count |
| Action | Count |
|--------|-------|
| Backend files to UPDATE (pre-req) | 2 |
| Frontend/Terminal files to REWRITE | 10 |
| Frontend/Terminal files to CREATE | 6 |
| Frontend/Terminal files to UPDATE | 6 |
| i18n files to UPDATE | 4 |
| **Total** | **28 files** |

---

**END OF BATCH 6 IMPLEMENTATION PLAN**
