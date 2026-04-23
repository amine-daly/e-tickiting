# E-Ticketing Platform - Complete Specifications

Last updated: April 2026
Status: Aligned with the current Spring Boot + MongoDB + Angular implementation

## 1. Architecture Snapshot

This workspace implements a bus ticketing platform with a MongoDB backend and two Angular surfaces:

- `apps/backend`: Spring Boot 3 service layer, MongoDB persistence, scheduled expiry workers, asynchronous email hooks
- `apps/terminal`: operational/admin Angular app for trip management, ticket selling, ticket lists, and group bookings
- `apps/frontend`: passenger-facing Angular app for trip search and customer flows

The current implementation is no longer based on PostgreSQL/JPA. The source of truth is MongoDB documents and service-layer rules.

### Core invariants

- Ownership is company-scoped.
- POS is an operational attribution layer, not the ownership boundary.
- Tickets are immutable financial snapshots.
- Group bookings are modeled as orders containing multiple tickets.
- Seat holds use a fixed backend constant of 600 seconds.
- Trip inventory is segment-based and reconciled against active tickets on read.
- Trip `seatHoldMinutes` no longer exists in the model.

## 2. Domain Model

### 2.1 `TargetInput`

Shared ownership envelope used across the current backend models.

| Field | Meaning |
| --- | --- |
| `company` | Mandatory ownership boundary |
| `pos` | Optional operational attribution, used mainly on tickets and orders |

### 2.2 `TripType`

MongoDB document stored in `trips`.

| Field | Meaning |
| --- | --- |
| `target.company` | Owning company |
| `departureDate` | UTC departure instant |
| `timezone` | IANA timezone used for display |
| `status` | `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `bus.busId` | Reference to the assigned bus |
| `currency` | Currency reference |
| `stopSchedule` | Ordered stop definitions |
| `pickupPoints` | Pickup sub-resources |
| `dropoffPoints` | Dropoff sub-resources |
| `segments` | Frozen inventory rows between commercial stops |
| `expressFares` | Pricing overlays over segment chains |

Trip documents do not store a seat-hold duration. Booking expiry is controlled centrally in `BookingService`.

### 2.3 `TicketType`

MongoDB document stored in `tickets`.

| Field | Meaning |
| --- | --- |
| `tripId` | Trip reference |
| `orderId` | Optional order reference for group bookings |
| `target.company` | Owning company |
| `target.pos` | Optional original POS attribution |
| `segmentIds` | Covered segment IDs |
| `expressId` | Optional express fare reference |
| `pickupPointId` | Boarding point snapshot |
| `dropoffPointId` | Dropoff point snapshot |
| `passengerId` | Registered passenger reference when present |
| `guestFirstName` / `guestLastName` | Guest passenger fallback names |
| `seatNo` | Optional seat assignment |
| `appliedPrice` | Immutable price snapshot |
| `currency` | Immutable currency snapshot |
| `lang` | Ticket language snapshot |
| `status` | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED` |
| `idempotencyKey` | Unique replay key |
| `expiresAt` | Expiry timestamp for pending holds |
| `createdAt`, `confirmedAt`, `cancelledAt` | Lifecycle timestamps |

### 2.4 `OrderType`

MongoDB document stored in `orders`.

| Field | Meaning |
| --- | --- |
| `tripId` | Trip reference shared by all child tickets |
| `target.company` | Owning company |
| `target.pos` | Optional POS attribution |
| `contactCustomerId` | Customer chosen as the order contact |
| `ticketIds` | Child ticket references |
| `passengers` | Embedded passenger manifest with seat numbers and ticket IDs |
| `totalPrice` | Order snapshot total |
| `currency` | Currency snapshot |
| `status` | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED` |
| `idempotencyKey` | Unique replay key for the whole order |
| `expiresAt` | Expiry timestamp shared with the child tickets |

## 3. Booking And Inventory Model

### Single booking flow

1. Resolve the trip and company scope.
2. Validate pickup and dropoff points.
3. Resolve the segment chain or matching express fare.
4. Reserve inventory atomically across all segments.
5. Create a `PENDING` ticket with `expiresAt = now + 600s`.
6. Confirm the ticket after payment.
7. Expiry or cancellation releases the held seats.

### Group booking flow

1. Resolve the trip and company scope.
2. Validate the route, pickup, and dropoff points.
3. Reserve seats atomically for the full passenger count.
4. Create one `OrderType` plus one `TicketType` per passenger.
5. Store the manifest in the order and back-link each ticket to the order.
6. Batch seat updates are applied through one order-level endpoint.
7. Order confirmation/cancellation cascades to the child tickets.

### Inventory rules

- Segment inventory is the only inventory source of truth.
- The current trip response layer reconciles `segments.bookedSeats` from active tickets before mapping the trip to an API response.
- Pending and confirmed tickets count toward inventory.
- Expired and cancelled tickets do not.

## 4. Trip Creation Pipeline

Trip creation is handled by `TripService` and is currently enforced in this order:

1. `StopValidator` validates the stop schedule.
2. The bus is loaded and checked against company ownership.
3. The bus is checked against existing scheduled/active trips.
4. `SegmentGenerator` builds the frozen segment chain.
5. `ExpressFareValidator` validates segment-chain fares.
6. `PickupDropoffValidator` verifies mandatory pickup/dropoff coverage.
7. The trip is persisted as `SCHEDULED`.

## 5. Trip Lifecycle And Edit Model

### Trip statuses

- `SCHEDULED`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

### Current edit rules

| Status | Allowed | Blocked |
| --- | --- | --- |
| `SCHEDULED` | Most fields, pickup/dropoff updates, stop schedule updates, bus changes | Segment array structure is always frozen |
| `ACTIVE` | Pickup/dropoff updates, bus change with capacity check, stop additions, segment price and max-seat edits, existing express fare updates/deactivation | `departureDate`, `currency`, stop removal, stop-time changes when bookings exist, new express fare creation |
| `COMPLETED` / `CANCELLED` | Status transitions only | All non-status changes |

### Edit guardrails

- Segment arrays are frozen after creation.
- Individual segment fields can still be adjusted through dedicated service methods.
- A bus change on an active trip must satisfy the current booked-seat ceiling.
- Stop time changes are blocked if any touching segment has bookings.
- Removing a stop is blocked if it would break an express fare chain.

## 6. Express Fare Rules

- Express fares are pricing overlays only.
- They do not carry inventory.
- They reference ordered segment chains.
- `TripService.addExpressFare` is blocked on `ACTIVE` trips.
- `TripService.updateExpressFare` and `deleteExpressFare` are blocked on `COMPLETED` and `CANCELLED` trips.
- On `ACTIVE` trips, deleting an express fare deactivates it instead of removing the record.

## 7. Ticket And Order Delivery

### Document generation

- Single ticket documents are built from `TicketDocumentService.buildDocument`.
- Order-level documents are built from `TicketDocumentService.buildOrderDocument`.
- Order documents include a passenger manifest table with seat numbers.

### Email delivery

- `BookingEmailNotifier` sends asynchronous confirmation emails after successful confirmation.
- `TicketController` supports single-ticket and order-level email resend endpoints.
- If no valid recipient email exists, the send operation fails cleanly.

## 8. API Surface

### Trips

- `POST /api/trips`
- `GET /api/trips`
- `GET /api/trips/{tripId}`
- `PUT /api/trips/{tripId}`
- `DELETE /api/trips/{tripId}`
- `PATCH /api/trips/{tripId}/status`
- `POST /api/trips/{tripId}/express-fares`
- `PUT /api/trips/{tripId}/express-fares/{expressId}`
- `DELETE /api/trips/{tripId}/express-fares/{expressId}`
- `POST /api/trips/{tripId}/pickup-points`
- `PUT /api/trips/{tripId}/pickup-points/{pointId}`
- `POST /api/trips/{tripId}/dropoff-points`
- `PUT /api/trips/{tripId}/dropoff-points/{pointId}`

### Bookings

- `POST /api/bookings`
- `POST /api/bookings/{ticketId}/confirm`
- `POST /api/bookings/{ticketId}/cancel`
- `PATCH /api/bookings/{ticketId}/seat`
- `POST /api/bookings/group`
- `POST /api/bookings/group/{orderId}/confirm`
- `POST /api/bookings/group/{orderId}/cancel`
- `PATCH /api/bookings/group/{orderId}/seats`
- `GET /api/bookings/occupied-seats/{tripId}`

### Tickets

- `GET /api/tickets`
- `GET /api/tickets/{ticketId}`
- `GET /api/tickets/orders/{orderId}/document`
- `POST /api/tickets/orders/{orderId}/send-email`

## 9. Frontend Surface

### Terminal app

- Trip management follows the backend edit matrix.
- The trip forms no longer expose a seat-hold field.
- Ticket lists group rows by order when `orderId` is present.
- Ticket details modals show all passengers and their seat numbers.
- Group booking flows support batch seat assignment.

### Passenger app

- Uses the same trip and ticket read models for search and booking UX.
- Must respect the same company-scoped and inventory rules.

## 10. Persistence And Indexing Notes

- MongoDB is the persistence layer.
- `idempotencyKey` is unique on both tickets and orders.
- Company-scoped compound indexes are used for trip, ticket, and order lookups.
- For nullable unique fields, prefer sparse unique indexes over partial filters that local MongoDB rejects at startup.

## 11. Canonical Implementation Anchors

- `TripService` orchestrates trip creation, update, search, and status transitions.
- `TripEditRules` enforces status-aware updates.
- `TripStatusMachine` guards allowed transitions.
- `TripInventoryReconciliationService` repairs segment counters from live tickets.
- `BookingService` owns single and group booking flows.
- `SeatReservationService` owns atomic seat counting.
- `OrderExpiryWorker` expires pending orders and standalone tickets.
- `TicketDocumentService` owns printable documents.
- `TicketController` owns ticket reads, docs, and email endpoints.

## 12. What This Spec Replaces

This spec replaces the older PostgreSQL/JPA, seat-map, and seat-hold-per-trip documentation. The current implementation is document-based, order-aware, and reconciles inventory from tickets rather than from a separate seat table.
