# Trip Edit Audit

Last updated: April 2026
Status: Matches the current backend and terminal UI behavior

## 1. Source Of Truth

The current edit rules are enforced in:

- `TripEditRules`
- `TripService.update`
- `TripService.updateSegmentPrice`
- `TripService.updateSegmentMaxSeats`
- `TripService.addExpressFare`
- `TripService.updateExpressFare`
- `TripService.deleteExpressFare`
- `TripService.transitionStatus`

The frontend trip detail editor has already been aligned to remove the old seat-hold field from the form and summary views.

## 2. Current Permission Matrix

| Trip status | Allowed | Blocked |
| --- | --- | --- |
| `SCHEDULED` | Most updates, stop schedule replacement, pickup/dropoff updates, bus reassignment, express fare creation and management | Segment array replacement, stop removals that break express fare chains |
| `ACTIVE` | Pickup/dropoff updates, bus reassignment if capacity allows, stop additions, stop-time changes when no bookings touch the stop, segment price changes, segment max-seat changes, existing express fare updates and deactivation | `departureDate`, `currency`, stop removal, stop-time changes when booked segments exist, new express fare creation |
| `COMPLETED` / `CANCELLED` | Status transitions only | All non-status changes |

## 3. Important Backend Rules

- Segments are always frozen as an array.
- Segment price is editable as a separate service operation.
- Segment max seats cannot be reduced below the current booked count.
- A bus change on an active trip requires sufficient seat capacity.
- Removing a stop on a scheduled trip is blocked if an express fare depends on it.
- Removing a stop on an active trip is blocked outright.
- Stop-time changes on an active trip are blocked only when a touching segment already has bookings.
- Express fare creation is blocked on active trips.
- Express fare updates and deactivation are blocked on completed or cancelled trips.

## 4. Trip Status Transitions

Allowed transitions:

- `SCHEDULED` -> `ACTIVE`
- `SCHEDULED` -> `CANCELLED`
- `ACTIVE` -> `COMPLETED`
- `ACTIVE` -> `CANCELLED`

Trip cancellation side effects remain in force:

- pending tickets become expired and release their seats
- confirmed tickets become cancelled and create refund records

## 5. Frontend Alignment

The terminal trip editor is now aligned with the backend rules:

- The seat-hold field has been removed from the create and edit forms.
- The trip info summary no longer displays seat-hold minutes.
- The submit payload no longer sends `seatHoldMinutes`.
- The edit form only sends the fields that still exist in the current backend DTOs.

## 6. Current Audit Result

The current workspace is internally consistent on trip-edit behavior.

No open doc mismatch remains for:

- `seatHoldMinutes`
- legacy PostgreSQL/JPA trip assumptions
- flat seat-map editing on trips
- unsupported express-fare creation on active trips

## 7. What To Watch Next

- Keep backend and frontend edit matrices in sync when adding new trip fields.
- Add regression tests for active-trip stop-time changes and bus reassignment capacity checks.
- Keep the express-fare rules documented whenever the service-level guard changes.

