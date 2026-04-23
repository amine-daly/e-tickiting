# Trip Module - Delivery Status and Next Steps

Last updated: April 2026
Status: Current implementation checklist, not the original migration plan

## 1. What Is Already Delivered

### Backend

- MongoDB trip documents with company-scoped ownership.
- Stop validation, segment generation, pickup/dropoff validation, and express-fare chain checks.
- Trip status machine with `SCHEDULED`, `ACTIVE`, `COMPLETED`, and `CANCELLED`.
- Status-aware edit rules through `TripEditRules`.
- Group bookings through `OrderType` plus child tickets.
- Fixed seat-hold logic at the booking layer.
- Trip inventory reconciliation on read.
- Asynchronous booking confirmation email support.

### Frontend

- Terminal trip editor aligned with the current DTOs.
- Ticket list grouped by order when `orderId` is present.
- Ticket details modal showing all passengers and seat numbers.
- Group booking flow with batch seat assignment.
- Seat-hold field removed from the trip edit UI.

### Documentation

- The stale trip and ticket specs were replaced with docs that match the live architecture.

## 2. Current Priority Order

1. Protect the current booking and trip rules with regression tests.
2. Keep the frontend edit forms and payloads aligned with the backend DTOs.
3. Validate order-level booking, seat assignment, and expiry behavior under load.
4. Keep the docs synchronized with any future domain changes.
5. Add operational visibility where it helps support and troubleshooting.

## 3. Near-Term Work

### Reliability

- Add or expand tests for active-trip stop-time changes.
- Add or expand tests for bus reassignment capacity checks.
- Add coverage for order-level seat assignment validation and duplicate seat rejection.
- Add coverage for trip inventory reconciliation when live tickets drift from segment counters.

### UX and operations

- Keep the ticket list grouping and modal manifest behavior stable.
- Keep the sell-ticket flow consistent for single and group bookings.
- Ensure email actions keep using the order document when a ticket belongs to an order.
- Keep the trip edit form free of removed fields such as seat-hold minutes.

### Data and indexing

- Keep idempotency keys unique and indexed.
- Use company-scoped indexes for trip, ticket, and order queries.
- Keep nullable unique fields on sparse unique indexes when needed.

## 4. De-Scoped From The Old Plan

The following items are no longer part of the active roadmap because the implementation has moved past them:

- PostgreSQL/JPA migration work
- seat-table inventory modeling
- trip-level seat-hold configuration
- legacy single-ticket-only booking assumptions
- old POS-only scoping language

## 5. Current Delivery State

The live system already supports the main product slices that the old sprint plan was aiming for:

- company-scoped trips
- segment-based inventory
- trip lifecycle management
- single and group bookings
- ticket and order documents
- ticket list and ticket detail grouping
- asynchronous confirmation emails

The remaining work is mostly hardening and incremental product growth rather than foundational platform reconstruction.

## 6. Suggested Next Milestones

### Milestone 1 - Test coverage

- Add focused tests around trip editing, booking expiry, and order confirmation.

### Milestone 2 - Operational tooling

- Add dashboards or reports for bookings, expiries, and inventory reconciliation.

### Milestone 3 - Passenger experience polish

- Keep the passenger app aligned with the same trip and booking rules.
- Improve the readability of order confirmations and ticket documents if needed.

## 7. Notes For Future Changes

Any future roadmap update should start from the current live model:

- MongoDB documents
- company-scoped ownership
- order-based group bookings
- fixed 600-second hold
- reconciled segment inventory
- status-aware trip edits

Do not revive the old roadmap assumptions when planning new work.

