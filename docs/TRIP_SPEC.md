# Trip Business Model - Current Specification

Last updated: May 2026
Status: Aligned with the live MongoDB trip implementation

## 1. Purpose

This document defines the current trip model, edit rules, inventory behavior, and validation pipeline used by the backend.

The implementation is document-based and MongoDB-backed. It does not use PostgreSQL/JPA, and trip-level seat-hold fields no longer exist.

## 2. Trip Invariants

- Trip ownership is company-scoped through `target.company`.
- `target.pos` is not part of the trip document.
- Trips are stored as MongoDB documents.
- Seats are managed through frozen segment inventory, not through a separate seat table.
- Segment inventory uses `maxBooking` (local cap) and `bookedCount` (local tickets only).
- Express tickets are tracked on `expressSegments.bookedCount` and only affect physical capacity.
- `seatHoldMinutes` is not a field on the trip document.
- Pending booking expiry is controlled centrally by the booking layer with a fixed 600-second hold.
- Trip responses and route-availability calculations are reconciled against active tickets before they are returned to the client.

## 3. Trip Document Shape

| Field             | Meaning                                         |
| ----------------- | ----------------------------------------------- |
| `target.company`  | Owning company                                  |
| `departureDate`   | Trip departure instant                          |
| `timezone`        | IANA timezone used for display                  |
| `status`          | `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `bus.busId`       | Bus reference only                              |
| `currency`        | Currency reference                              |
| `stopSchedule`    | Ordered stop definitions                        |
| `pickupPoints`    | Pickup sub-resources                            |
| `dropoffPoints`   | Dropoff sub-resources                           |
| `segments`        | Frozen inventory rows                           |
| `expressSegments` | Multi-segment inventory records                 |

## 4. Validation Pipeline

Trip creation currently follows this order:

1. `StopValidator` validates the stop schedule.
2. `BusService` loads the bus and confirms company ownership.
3. `TripTypeRepository` checks that the bus is not already attached to a scheduled or active trip.
4. `SegmentGenerator` builds the frozen segments from the commercial stop chain.
5. `ExpressSegmentValidator` validates express segment chains and boundaries.
6. `PickupDropoffValidator` ensures mandatory pickup and dropoff coverage.
7. `TripService` persists the trip with `status = SCHEDULED`.

## 5. Stop Rules

The stop schedule is the source of route truth.

### Requirements

- `sequence` must be strictly ascending.
- Arrival and departure times must move forward in time.
- The first stop must not have an arrival time.
- The last stop must not have a departure time.
- There must be at least two commercial stops.
- A stop is considered commercial when it participates in boarding or dropping.
- Technical stops are allowed, but they are skipped when generating segments.

### Derived stop type

- Origin: boarding allowed, dropping not allowed
- Destination: dropping allowed, boarding not allowed
- Intermediate commercial stop: both flags true
- Technical stop: both flags false

## 6. Segment Rules

Segments are the inventory layer.

- Segments are generated between consecutive commercial stops only.
- Segments are frozen after creation.
- Each segment has its own `maxBooking`, `bookedCount`, `basePrice`, `distanceKm`, and `durationMinutes`.
- `bookedCount` starts at 0 and counts local tickets only.
- `maxBooking` is a local-ticket ceiling and must never exceed the bus capacity.
- Express tickets do not consume `maxBooking`; they only consume physical seat capacity.
- Segment arrays are not part of the editable payload.
- Individual segment price and max-booking changes are handled through dedicated service methods, not by replacing the whole array.

### Inventory meaning

- `bookedCount` counts seats reserved by local tickets only.
- `expressSegments.bookedCount` counts seats reserved by express tickets only.
- Physical occupancy for a segment is `segment.bookedCount + sum(expressSegment.bookedCount for express segments covering the segment)`.
- Route availability is the minimum remaining across the requested segment chain. Local routes are capped by the minimum of `maxBooking - bookedCount` and physical remaining on each segment; exact-match express routes use physical remaining only.
- Pending and confirmed tickets count toward inventory.
- Expired and cancelled tickets do not.
- Reconciliation is used to repair drift if local or express counters diverge from live ticket state.

## 7. Express Segment Rules

Express segments are multi-segment inventory records with express-only counters.

- Each express segment must cover at least two trip segments.
- Each express segment references an ordered chain of segment IDs.
- The chain must be continuous.
- `fromPlaceId` must match the first segment in the chain.
- `toPlaceId` must match the last segment in the chain.
- The total distance and duration are derived from the covered segments.
- `bookedCount` tracks express tickets; there is no express-segment-specific `maxBooking`.
- Single-segment bookings stay local and must not carry an `expressSegmentId`.
- Multi-segment bookings require an active express segment whose `segmentsCovered` exactly matches the resolved route chain.

### Lifecycle constraints

- New express segments cannot be added on `ACTIVE` trips.
- Existing express segments can be updated or deactivated according to the service rules.
- Express segments cannot be modified on `COMPLETED` or `CANCELLED` trips.
- Removing a stop that would break an express segment chain is blocked.

## 8. Pickup And Dropoff Rules

Pickup and dropoff sub-resources are mandatory for commercial coverage.

- Every boarding stop must have at least one pickup point.
- Every dropping stop must have at least one dropoff point.
- The `placeId` on the point must exist in the stop schedule.
- `pickupPoints` and `dropoffPoints` are validated again after trip updates.
- Points can be added or updated without replacing the trip document structure.

## 9. Status Machine

Allowed transitions:

- `SCHEDULED` -> `ACTIVE`
- `SCHEDULED` -> `CANCELLED`
- `ACTIVE` -> `COMPLETED`
- `ACTIVE` -> `CANCELLED`

Terminal states:

- `COMPLETED`
- `CANCELLED`

### Trip cancellation side effects

When a trip transitions from `ACTIVE` to `CANCELLED`:

- pending tickets are expired and their seats are released
- confirmed tickets are cancelled
- refund records are created for confirmed tickets

## 10. Edit Permissions

`TripEditRules` is the current source of truth for field-level permissions.

| Status                    | Allowed                                                                                                                                                                                                                                           | Blocked                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SCHEDULED`               | Most fields, stop schedule replacement, pickup/dropoff changes, bus changes, express segment creation and management                                                                                                                              | Segment array replacement                                                                                             |
| `ACTIVE`                  | Pickup/dropoff changes, bus reassignment if capacity is sufficient, stop additions, stop-time changes when no bookings touch the stop, segment base-price updates, segment max-booking updates, existing express segment updates and deactivation | `departureDate`, `currency`, stop removal, stop-time changes when booked segments exist, new express segment creation |
| `COMPLETED` / `CANCELLED` | Status transitions only                                                                                                                                                                                                                           | All non-status changes                                                                                                |

### Additional details

- Stop removal on `SCHEDULED` trips is allowed only if it does not break an express segment dependency.
- Bus reassignment on `ACTIVE` trips requires the new bus to have at least as many seats as the current maximum physical occupancy across the trip segments.
- Changing a stop time is blocked when any segment touching that stop already has physical occupancy.
- `TripUpdateRequest` no longer contains a seat-hold field.

## 11. Read Model And Reconciliation

`TripResponseEnricher` reconciles live trips before mapping them to API responses.

Current flow:

1. Load the requested trip or trip page.
2. Deactivate any `expressSegments` that are still marked active even though `validUntil` has passed.
3. Recompute `segments.bookedCount` from local tickets and `expressSegments.bookedCount` from express tickets.
4. Save any corrected trips.
5. Enrich the trip with related bus, currency, and place data.

When `GET /api/trips/search` is called with both `originPlaceId` and `destinationPlaceId`, the response layer also computes a query-scoped `marketplace` view per trip. That nested view carries `route`, `schedule`, `pricing`, and `capacity` for the requested route.

The dedicated `GET /api/trips/{tripId}/route-availability` endpoint uses the same route-chain math and exposes the same `availableSeats` result: local routes honor `maxBooking` and physical occupancy per segment, while exact-match express routes use physical remaining only.

Multi-segment search rows only receive that `marketplace` view when an active `expressSegment` exactly matches the resolved segment chain. Trips that satisfy the stop filter but do not have a valid exact-match `expressSegment` are omitted from the final search payload for that route.

This prevents stale inventory counters from leaking into the UI.

Separately, `ExpressSegmentExpiryWorker` sweeps for stale express segments on a fixed schedule so expired records are persisted inactive even between reads.

## 12. Current Service Anchors

- `TripService` owns create, update, search, delete, status transition, and sub-resource operations.
- `TripEditRules` enforces edit permissions.
- `TripStatusMachine` validates allowed status transitions.
- `StopValidator` validates stop ordering and timing.
- `SegmentGenerator` builds the frozen inventory chain.
- `PickupDropoffValidator` enforces mandatory pickup/dropoff coverage.
- `ExpressSegmentValidator` checks chain continuity and segment boundaries.
- `ExpressSegmentStopGuard` blocks stop removals that would invalidate express segments.
- `TripInventoryReconciliationService` repairs segment counters from active ticket state.
- `ExpressSegmentExpiryWorker` persists deactivation for express segments whose `validUntil` has passed.

## 13. Do Not Reintroduce

- PostgreSQL or JPA trip persistence
- `seatHoldMinutes` on the trip document
- flat seat-map inventory on the trip
- mutable segment arrays after creation
- legacy origin/destination-only route modeling
- legacy `maxSeats` / `bookedSeats` naming
