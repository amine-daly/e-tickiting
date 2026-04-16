# Trip Edit Mode — Permission Audit

## Backend Source of Truth: `TripEditRules.java` + express fare sub-resource methods in `TripService.java`

### SCHEDULED

- **All fields editable** (departureDate, timezone, currencyId, seatHoldMinutes, bus, stops, pickup/dropoff points)
- **Segments frozen** (always — managed via separate lifecycle)
- **Express fares** — ALLOWED via sub-resource endpoints (add, update, delete)
- **Stop removal guarded** by `ExpressFareStopGuard` — blocks if stop is referenced by an express fare

### ACTIVE

- **departureDate** — BLOCKED
- **currencyId** — BLOCKED
- **Stop removal** — BLOCKED
- **Stop addition** — ALLOWED
- **Stop reorder** — BLOCKED (changing sequence on ACTIVE breaks segment integrity)
- **Stop time changes** — CONDITIONAL: blocked if any adjacent segment has `bookedSeats > 0`
- **Bus reassignment** — CONDITIONAL: `newBus.totalSeats >= max(bookedSeats)` across segments
- **Express fare price / validFrom / validUntil / active flag** — ALLOWED via sub-resource endpoints
- **Add express fare** — BLOCKED
- **Delete express fare** — DEACTIVATES instead of deleting
- **Other fields** (timezone, seatHoldMinutes, pickup/dropoff points) — ALLOWED

### COMPLETED / CANCELLED

- **All fields blocked** — only status transitions allowed (via `hasNonStatusChanges()`)
- **Express fare sub-resource changes** — BLOCKED

---

## Bugs Fixed

### BUG 1 — `onFormChanges()` swapped parameter order (Medium)

- **Before:** `FormHelper.getChangedValues(this.initialValues, this.tripForm.getRawValue())`
- **After:** `FormHelper.getChangedValues(this.tripForm.getRawValue(), this.initialValues)`
- `FormHelper.getChangedValues(current, initial)` iterates keys of the first param. Swapped order meant it was iterating initial keys and comparing against current values — would miss newly added form array items and return wrong changed set.

### BUG 2 — `submitUpdate()` raw spread leaked unrecognized fields (High)

- **Before:** `const payload: Partial<TripUpdatePayload> = { ...changed };` then selectively overwrote known fields
- **After:** `const payload: Partial<TripUpdatePayload> = {};` — only explicitly mapped fields are sent
- The spread was copying raw form values (e.g. `busId`, `segments`, `expressFares`) directly into the payload, causing backend 400 UNRECOGNIZED_FIELD errors.

### BUG 3 — Debug `console.log` statements in `submitUpdate()` (Low)

- Removed 4 `console.log` statements that leaked form data to browser console in production.

---

## Gaps Fixed

### GAP 1 — Add-stop button wrongly disabled for ACTIVE trips (Medium)

- **Before:** `[disabled]="isEditMode && trip?.status === 'ACTIVE'"` on add-stop button
- **After:** Removed disabled binding — backend allows adding stops to ACTIVE trips
- Remove-stop correctly stays disabled for ACTIVE (backend blocks it).

### GAP 2 — No stop-time-change guard for ACTIVE trips with bookings (Medium)

- **Before:** `applyEditModeRestrictions()` only disabled `departureDate` and `currencyId` for ACTIVE
- **After:** For each stop, checks if adjacent segments have `bookedSeats > 0`. If so, disables `arrivalTime` and `departureTime` on that stop.
- Matches backend rule: stop time blocked if any segment touching stop has booked seats.

### GAP 3 — Move-up/move-down buttons had no ACTIVE guard (Low → Medium)

- **Before:** Only disabled at array boundaries (`i === 0`, `i === last`)
- **After:** Also disabled when `isEditMode && trip?.status === 'ACTIVE'`
- Reordering stops on ACTIVE trips changes segment sequence integrity.

### GAP 4 — Frontend incorrectly froze express fares in edit mode (High)

- **Before:** The UI disabled express fare controls and never called the backend express fare sub-resource endpoints, even though the backend already exposed add/update/delete operations.
- **After:**
  - **SCHEDULED:** express fares can be added, removed, or edited from the trip form
  - **ACTIVE:** existing express fares can update `price`, `validFrom`, `validUntil`, and `active`; segment coverage stays locked
  - **COMPLETED/CANCELLED:** express fares remain read-only
  - Frontend now maps express fare edits to dedicated sub-resource endpoints instead of sending them through `TripUpdateRequest`
  - Backend now blocks unsupported express fare mutations on `COMPLETED` / `CANCELLED` trips and blocks express-fare creation on `ACTIVE` trips

---

## Remaining Items (Low Priority)

| #   | Gap                                                         | Severity | Notes                                                                                            |
| --- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| 5   | `TripUpdatePayload` missing `status` field                  | Low      | Status transitions use separate endpoint — by design                                             |
| 6   | No frontend `ExpressFareStopGuard` equivalent for SCHEDULED | Low      | Backend enforces it; could add UX warning later                                                  |
| 7   | No frontend bus capacity check for ACTIVE                   | Low      | Backend enforces `newBus.totalSeats >= max(bookedSeats)`; could add client-side validation later |
