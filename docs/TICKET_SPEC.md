# Ticket And Order Business Specification

Last updated: May 2026
Status: Aligned with the current ticket, order, and booking implementation

## 1. Purpose

This document defines the current behavior of tickets, group orders, seat assignments, expiry, confirmation, cancellation, documents, and ticket-facing UI flows.

The live model is order-aware. A single booking may produce one ticket or an order with multiple tickets.

## 2. Core Invariants

- Ticket documents are immutable financial snapshots.
- Ownership is company-scoped.
- POS is an operational attribution layer, stored when available.
- A ticket may belong to a group order.
- Seat assignments are stored as `seatNo` and may be empty for free-seating buses.
- Guest passengers are represented by `guestFirstName` and `guestLastName` when no registered passenger exists.
- The seat-hold duration is fixed in code at 600 seconds.
- Ticket and order idempotency keys must remain unique.
- Refunds remain separate records and do not rewrite ticket money fields.

## 3. Ticket Document Shape

| Field                                     | Meaning                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `tripId`                                  | Trip reference                                 |
| `orderId`                                 | Optional group order reference                 |
| `target.company`                          | Owning company                                 |
| `target.pos`                              | Optional original POS attribution              |
| `segmentIds`                              | Ordered covered segments                       |
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
| `expiresAt`                               | Pending hold expiry                            |
| `createdAt`, `confirmedAt`, `cancelledAt` | Lifecycle timestamps                           |

## 4. Order Document Shape

| Field                                     | Meaning                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| `tripId`                                  | Shared trip reference                                |
| `target.company`                          | Owning company                                       |
| `target.pos`                              | Optional POS attribution                             |
| `contactCustomerId`                       | Order contact customer                               |
| `ticketIds`                               | Child tickets                                        |
| `passengers`                              | Passenger manifest with names, seats, and ticket IDs |
| `totalPrice`                              | Group total snapshot                                 |
| `currency`                                | Currency snapshot                                    |
| `status`                                  | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED`       |
| `idempotencyKey`                          | Unique replay key for the order                      |
| `expiresAt`                               | Hold expiry shared by the child tickets              |
| `createdAt`, `confirmedAt`, `cancelledAt` | Lifecycle timestamps                                 |

## 5. Booking Flows

### 5.1 Single booking

`BookingService.createBooking` handles the single-ticket flow.

Current behavior:

1. Validate the route and trip state.
2. Resolve the trip segment chain and enforce the inventory owner rule: single-segment routes stay local, while multi-segment routes require an active matching express segment.
3. Availability is counted per segment chain, with local routes capped by the minimum of local remaining and physical remaining, and express routes using physical remaining only.
4. Create a `PENDING` ticket.
5. Persist the hold expiry using the fixed 600-second duration.
6. Confirm, cancel, or expire the ticket through dedicated endpoints and workers.

### 5.2 Group booking

`BookingService.createGroupBooking` handles the order flow.

Current behavior:

1. Reserve inventory for the full passenger count.
2. Create one ticket per passenger.
3. Create one order that references those tickets.
4. Store the passenger manifest at the order level.
5. Allow batch seat assignment through one order-level endpoint.
6. Confirm or cancel the whole order as one unit.

### 5.3 Seat updates

- Single pending tickets can update their seat via `PATCH /api/bookings/{ticketId}/seat`.
- Pending group orders can update all seat assignments at once via `PATCH /api/bookings/group/{orderId}/seats`.
- Seat updates are blocked once the ticket or order is no longer pending.

## 6. Lifecycle Rules

### 6.1 Ticket lifecycle

- `PENDING` -> `CONFIRMED`
- `PENDING` -> `EXPIRED`
- `CONFIRMED` -> `CANCELLED`
- `EXPIRED` and `CANCELLED` are terminal

### 6.2 Order lifecycle

- `PENDING` -> `CONFIRMED`
- `PENDING` -> `EXPIRED`
- `CONFIRMED` -> `CANCELLED`
- `EXPIRED` and `CANCELLED` are terminal

### 6.3 Cancellation behavior

- Pending tickets and pending orders expire and release seats.
- Confirmed tickets and confirmed orders cancel through the refund path.
- Trip cancellation side effects also expire pending tickets and create refund records for confirmed tickets.

## 7. Inventory And Expiry

### Inventory ownership

- Segment inventory lives on the trip segments via `maxBooking` and `bookedCount` (local tickets only).
- Express tickets are tracked on `expressSegments.bookedCount`; physical occupancy is local + express.
- Route availability uses the same segment-chain minimum as the backend route-availability endpoint: local routes honor `maxBooking - bookedCount` and physical occupancy on each segment, while express routes honor physical remaining only.
- Single-segment tickets must not carry `expressSegmentId`.
- Multi-segment tickets must carry an `expressSegmentId` that exactly matches the reserved segment chain.
- `SeatReservationService` performs atomic updates for local or express reservations.
- Group reservations reserve or release the full passenger count across the full segment chain.

### Expiry workers

- `OrderExpiryWorker` expires pending orders and standalone pending tickets.
- `TripCancellationHandler` handles trip-level cancellation side effects.
- `BookingEmailNotifier` sends confirmations asynchronously after successful confirmation.

## 8. API Contract

### Booking endpoints

- `POST /api/bookings`
- `POST /api/bookings/{ticketId}/confirm`
- `POST /api/bookings/{ticketId}/cancel`
- `PATCH /api/bookings/{ticketId}/seat`
- `POST /api/bookings/group`
- `POST /api/bookings/group/{orderId}/confirm`
- `POST /api/bookings/group/{orderId}/cancel`
- `PATCH /api/bookings/group/{orderId}/seats`
- `GET /api/bookings/occupied-seats/{tripId}`

### Ticket endpoints

- `GET /api/tickets`
- `GET /api/tickets/{ticketId}`
- `GET /api/tickets/orders/{orderId}/document`
- `POST /api/tickets/orders/{orderId}/send-email`

### Response shape notes

- Ticket read responses include `orderId`, `seatNo`, guest fallback names, and passenger/account enrichment.
- Group booking responses include the order snapshot, passenger manifest, and the child tickets.

## 9. UI Rules

### Ticket list

- Standalone tickets are rendered as individual rows.
- Tickets with an `orderId` are grouped by order.
- Group rows show passenger counts, total price, and order actions.
- Single ticket details still show the original ticket view.

### Ticket details modal

- When a single ticket is selected, the modal shows the individual passenger snapshot and seat number.
- When a grouped order is selected, the modal shows all passengers and their seats.
- Guest names come from `guestFirstName` and `guestLastName` when present.
- Registered passenger names come from the user payload when available.

### Sell ticket flow

- The operational sell flow supports contact customer selection, guest passengers, seat assignment, and order confirmation.
- The UI follows the same pending/confirm/expiry lifecycle as the backend.

## 10. Document Generation

`TicketDocumentService` currently supports two document modes:

- Single-ticket document
- Order-level master document with a passenger manifest table

The order document is the current source for the master confirmation email sent to the contact customer.

## 11. Service Anchors

- `BookingController` exposes booking and group-booking endpoints.
- `BookingService` owns booking orchestration, seat updates, confirmations, and cancellations.
- `SeatReservationService` owns atomic segment inventory updates.
- `OrderRepository` and `TicketRepository` provide the query model.
- `TicketController` exposes read, document, and email endpoints.
- `TicketDocumentService` renders ticket and order documents.
- `BookingEmailNotifier` sends asynchronous confirmation emails.
- `OrderExpiryWorker` expires pending orders and standalone tickets.

## 12. Do Not Reintroduce

- Ticket-only thinking for group bookings
- Guest name logic that ignores `seatNo`
- Legacy `guestFirstName`-less modal rendering
- Seat-hold values on the trip document
- Any assumption that a booking always maps to one ticket
- Any UI that hides the order-level manifest once group bookings exist
