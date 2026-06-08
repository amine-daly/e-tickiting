# E-Ticketing Platform - Complete Specifications

Last updated: May 2026
Status: Aligned with the current Spring Boot + MongoDB + Angular implementation

## 1. Architecture Snapshot

This workspace implements a bus ticketing platform with a MongoDB backend and two Angular surfaces:

- `apps/backend`: Spring Boot 3 service layer, MongoDB persistence, scheduled expiry workers, asynchronous email hooks
- `apps/terminal`: operational/admin Angular app for trip management, ticket selling, ticket lists, and group bookings
- `apps/safra`: passenger-facing Angular app for trip search and customer flows

The current implementation is no longer based on PostgreSQL/JPA. The source of truth is MongoDB documents and service-layer rules.

### Core invariants

- Ownership is company-scoped.
- POS is an operational attribution layer, not the ownership boundary.
- Tickets are immutable financial snapshots.
- Group bookings are modeled as orders containing multiple tickets.
- Seat holds use a fixed backend constant of 600 seconds.
- Trip inventory is segment-based (`maxBooking` / `bookedCount`).
- Route availability is computed per requested segment chain: local routes are capped by the minimum of local remaining capacity (`maxBooking - bookedCount`) and physical remaining capacity (`bus.totalSeats - bookedCount - expressBookedCount` on each covered segment), while exact-match express routes use physical remaining capacity only.
- Express tickets are tracked on `expressSegments.bookedCount` and reconciled on read.
- Trip `seatHoldMinutes` no longer exists in the model.

## 2. Domain Model

### 2.1 `TargetInput`

Shared ownership envelope used across the current backend models.

| Field     | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `company` | Mandatory ownership boundary                                        |
| `pos`     | Optional operational attribution, used mainly on tickets and orders |

### 2.2 `TripType`

MongoDB document stored in `trips`.

| Field             | Meaning                                             |
| ----------------- | --------------------------------------------------- |
| `target.company`  | Owning company                                      |
| `departureDate`   | UTC departure instant                               |
| `timezone`        | IANA timezone used for display                      |
| `status`          | `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED`     |
| `bus.busId`       | Reference to the assigned bus                       |
| `currency`        | Currency reference                                  |
| `stopSchedule`    | Ordered stop definitions                            |
| `pickupPoints`    | Pickup sub-resources                                |
| `dropoffPoints`   | Dropoff sub-resources                               |
| `segments`        | Frozen inventory rows between commercial stops      |
| `expressSegments` | Multi-segment inventory records over segment chains |

Trip documents do not store a seat-hold duration. Booking expiry is controlled centrally in `BookingService`.

Segments carry `maxBooking` (local cap) and `bookedCount` (local tickets only). Express segments carry `bookedCount` for multi-segment tickets; there is no express-segment `maxBooking`.

### 2.3 `TicketType`

MongoDB document stored in `tickets`.

| Field                                     | Meaning                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `tripId`                                  | Trip reference                                 |
| `orderId`                                 | Optional order reference for group bookings    |
| `target.company`                          | Owning company                                 |
| `target.pos`                              | Optional original POS attribution              |
| `segmentIds`                              | Covered segment IDs                            |
| `expressSegmentId`                        | Optional express segment reference             |
| `pickupPointId`                           | Boarding point snapshot                        |
| `dropoffPointId`                          | Dropoff point snapshot                         |
| `passengerId`                             | Registered passenger reference when present    |
| `guestFirstName` / `guestLastName`        | Guest passenger fallback names                 |
| `seatNo`                                  | Optional seat assignment                       |
| `appliedPrice`                            | Immutable price snapshot                       |
| `currency`                                | Immutable currency snapshot                    |
| `lang`                                    | Ticket language snapshot                       |
| `status`                                  | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED` |
| `idempotencyKey`                          | Unique replay key                              |
| `expiresAt`                               | Expiry timestamp for pending holds             |
| `createdAt`, `confirmedAt`, `cancelledAt` | Lifecycle timestamps                           |

### 2.4 `OrderType`

MongoDB document stored in `orders`.

| Field               | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `tripId`            | Trip reference shared by all child tickets                   |
| `target.company`    | Owning company                                               |
| `target.pos`        | Optional POS attribution                                     |
| `contactCustomerId` | Customer chosen as the order contact                         |
| `ticketIds`         | Child ticket references                                      |
| `passengers`        | Embedded passenger manifest with seat numbers and ticket IDs |
| `totalPrice`        | Order snapshot total                                         |
| `currency`          | Currency snapshot                                            |
| `status`            | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED`               |
| `idempotencyKey`    | Unique replay key for the whole order                        |
| `expiresAt`         | Expiry timestamp shared with the child tickets               |

## 3. Booking And Inventory Model

### Single booking flow

1. Resolve the trip and company scope.
2. Validate pickup and dropoff points.
3. Resolve the segment chain or matching express segment.
4. Reserve inventory atomically across the route chain (local uses the minimum of local remaining and physical remaining on each covered segment; express uses physical remaining only).
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

- Segment inventory is the only inventory source of truth for local tickets (`maxBooking` / `bookedCount`).
- Express tickets are tracked on `expressSegments.bookedCount` and only consume physical capacity.
- Single-segment tickets remain local and do not carry `expressSegmentId`.
- Multi-segment tickets require an active express segment whose `segmentsCovered` exactly matches the resolved chain.
- Physical occupancy per segment is `segment.bookedCount + sum(expressSegment.bookedCount for express segments covering the segment)`.
- Route availability uses the same segment-chain math: the final `availableSeats` is the minimum remaining across the covered segments, with local routes honoring both `maxBooking` and physical occupancy.
- The current trip response layer reconciles `segments.bookedCount` (local) and `expressSegments.bookedCount` (express) from active tickets before mapping the trip to an API response.
- Expired express segments are persisted inactive once `validUntil` has passed, both during reconciliation and by a scheduled cleanup worker.
- Pending and confirmed tickets count toward inventory.
- Expired and cancelled tickets do not.

## 4. Trip Creation Pipeline

Trip creation is handled by `TripService` and is currently enforced in this order:

1. `StopValidator` validates the stop schedule.
2. The bus is loaded and checked against company ownership.
3. The bus is checked against existing scheduled/active trips.
4. `SegmentGenerator` builds the frozen segment chain.
5. `ExpressSegmentValidator` validates express segment chains.
6. `PickupDropoffValidator` verifies mandatory pickup/dropoff coverage.
7. The trip is persisted as `SCHEDULED`.

## 5. Trip Lifecycle And Edit Model

### Trip statuses

- `SCHEDULED`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

### Current edit rules

| Status                    | Allowed                                                                                                                                                    | Blocked                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SCHEDULED`               | Most fields, pickup/dropoff updates, stop schedule updates, bus changes                                                                                    | Segment array structure is always frozen                                                                       |
| `ACTIVE`                  | Pickup/dropoff updates, bus change with capacity check, stop additions, segment price and max-booking edits, existing express segment updates/deactivation | `departureDate`, `currency`, stop removal, stop-time changes when bookings exist, new express segment creation |
| `COMPLETED` / `CANCELLED` | Status transitions only                                                                                                                                    | All non-status changes                                                                                         |

### Edit guardrails

- Segment arrays are frozen after creation.
- Individual segment fields can still be adjusted through dedicated service methods.
- A bus change on an active trip must satisfy the current maximum physical occupancy.
- Stop time changes are blocked if any touching segment has physical occupancy.
- Removing a stop is blocked if it would break an express segment chain.

## 6. Express Segment Rules

- Express segments are multi-segment inventory records with their own `bookedCount`.
- They do not have a `maxBooking` cap, but they track express tickets via `bookedCount`.
- They must cover at least two trip segments.
- They reference ordered segment chains.
- `TripService.addExpressSegment` is blocked on `ACTIVE` trips.
- `TripService.updateExpressSegment` and `deleteExpressSegment` are blocked on `COMPLETED` and `CANCELLED` trips.
- On `ACTIVE` trips, deleting an express segment deactivates it instead of removing the record.

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
- `GET /api/trips/search` returns the standard `TripResponse`; when both `originPlaceId` and `destinationPlaceId` are supplied it also includes a nested `marketplace` view (`route`, `schedule`, `pricing`, `capacity`) computed for that exact route.
- Multi-segment search rows without an active exact-match `expressSegment` are filtered out of that route-scoped search payload.
- `GET /api/trips/{tripId}`
- `GET /api/trips/{tripId}/route-availability` returns backend-calculated sellability and `availableSeats` for the requested route chain.
- `PUT /api/trips/{tripId}`
- `DELETE /api/trips/{tripId}`
- `PATCH /api/trips/{tripId}/status`
- `POST /api/trips/{tripId}/express-segments`
- `PUT /api/trips/{tripId}/express-segments/{expressSegmentId}`
- `DELETE /api/trips/{tripId}/express-segments/{expressSegmentId}`
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

For POS ticket selling, create requests may now carry either an existing customer id (`passengerId` / `contactCustomerId`) or an inline contact payload. When the contact payload is provided, the backend resolves or creates the customer inside the booking create flow and still persists the ticket or order as company- and POS-attributed.

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
- `ExpressSegmentExpiryWorker` deactivates stale express segments between reads.
- `BookingService` owns single and group booking flows.
- `SeatReservationService` owns atomic seat counting.
- `OrderExpiryWorker` expires pending orders and standalone tickets.
- `TicketDocumentService` owns printable documents.
- `TicketController` owns ticket reads, docs, and email endpoints.

## 12. What This Spec Replaces

This spec replaces the older PostgreSQL/JPA, seat-map, and seat-hold-per-trip documentation. The current implementation is document-based, order-aware, and reconciles inventory from tickets rather than from a separate seat table.
