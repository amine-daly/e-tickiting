# Trip Business Model — Copilot Agent Specification

> Attach this file to VS Code Copilot agent before generating any code related to trips, bookings, segments, or fares.
> This is the single source of truth. Do not deviate from these definitions.

---

## 1. Core Principles

1. **Seats are physical, pricing is logical** — segments own inventory, express fares are pricing overlays only
2. **Stop classification via flags** — `boardingAllowed` + `droppingAllowed` determine stop type, no `isCommercialStop` field
3. **Segments are frozen after creation** — never add or remove segments post-creation
4. **Ticket is an immutable financial snapshot** — never mutate a ticket, use Refund entity instead
5. **Currency is global** — declared once at trip level, inherited by all price fields
6. **UTC storage, timezone display** — store all timestamps in UTC, render in `trip.timezone`
7. **Exactly-once booking semantics** — idempotency key required on all booking requests

---

## 1.1 Marketplace Scoping

Every entity on the platform is scoped to a `target: { pos }`.
All queries must always filter by `target.pos` — operators cannot see each other's data.

| Entity   | target field | Meaning                           |
| -------- | ------------ | --------------------------------- |
| `Bus`    | `target.pos` | Which operator owns this bus      |
| `Trip`   | `target.pos` | Which operator sells this trip    |
| `Ticket` | `target.pos` | Which POS the booking was made on |

---

## 2. Trip Object — Full Schema

```typescript
interface Trip {
  // Layer 1 — Identity
  tripId: string; // system-generated
  target: { pos: string }; // point of sale
  departureDate: string; // ISO date, must be future, UTC
  timezone: string; // MANDATORY — IANA e.g. "Africa/Tunis"
  status: TripStatus; // default: SCHEDULED

  // Layer 2 — Bus (pure reference — no snapshot) (done)
  bus: {
    busId: string; // reference only — totalSeats read live from Bus entity
    // totalSeats locked on Bus entity when bus is in
    // any SCHEDULED or ACTIVE trip — no snapshot needed
  };

  // Layer 3 — Global Currency
  currency: string; // ISO 4217 e.g. "TND"
  // inherited by ALL price fields
  // no per-segment override allowed

  // Layer 4 — Seat Hold
  seatHoldMinutes: number; // default: 10
  // how long PENDING ticket holds seats
  // changing while ACTIVE affects new bookings only

  // Layer 5 — Stop Schedule
  stopSchedule: Stop[];

  // Layer 6 — Pickup Points (optional per commercial stop)
  pickupPoints: PickupPoint[];

  // Layer 7 — Dropoff Points (optional per commercial stop)
  dropoffPoints: DropoffPoint[];

  // Layer 8 — Segments (inventory layer, frozen after creation)
  segments: Segment[];

  // Layer 9 — Express Fares (pricing overlay, no inventory)
  expressFares: ExpressFare[];
}
```

---

## 3. Enums

```typescript
enum TripStatus {
  SCHEDULED = "SCHEDULED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

enum TicketStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

enum RefundStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
}
```

---

## 4. Stop Schema

```typescript
interface Stop {
  placeId: string;
  sequence: number; // strictly ascending, unique per trip
  arrivalTime: string | null; // null for first stop only (UTC)
  departureTime: string | null; // null for last stop only (UTC)
  boardingAllowed: boolean;
  droppingAllowed: boolean;
}

// Stop type is derived — NO isCommercialStop field:
// boarding=true  + dropping=false  → Origin
// boarding=false + dropping=true   → Destination
// boarding=true  + dropping=true   → Intermediate commercial
// boarding=false + dropping=false  → Technical stop (skipped in segment generation)
```

### Stop Validation Rules

- `sequence` strictly ascending, unique per trip
- Timeline strictly increasing — no equal or backward timestamps
- `departureTime >= arrivalTime` for all intermediate stops
- At least 2 commercial stops required
- First stop: `arrivalTime = null`
- Last stop: `departureTime = null`

---

## 5. Pickup & Dropoff Point Schemas

```typescript
interface PickupPoint {
  pointId: string; // unique per trip
  placeId: string; // must exist in stopSchedule, boardingAllowed=true
  address: string;
  scheduledDepartureTime: string; // UTC, must align with stopSchedule
  active: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface DropoffPoint {
  pointId: string; // unique per trip
  placeId: string; // must exist in stopSchedule, droppingAllowed=true
  address: string;
  scheduledArrivalTime: string; // UTC, must align with stopSchedule
  active: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}
```

> Pickup and dropoff points are MANDATORY — every commercial stop must have at least one entry.
> `boardingAllowed = true` → at least one `PickupPoint` required for this `placeId`
> `droppingAllowed = true` → at least one `DropoffPoint` required for this `placeId`
> Trip creation is blocked if any commercial stop is missing its required pickup or dropoff point.

---

## 6. Segment Schema

```typescript
interface Segment {
  segmentId: string; // system-generated
  fromPlaceId: string; // start commercial stop
  toPlaceId: string; // end commercial stop
  departureTime: string; // UTC, derived from stopSchedule
  arrivalTime: string; // UTC, derived from stopSchedule
  maxSeats: number; // admin-defined, must be <= bus.totalSeats
  bookedSeats: number; // starts at 0, incremented via atomic CAS
  basePrice: number; // in trip.currency
  distanceKm: number; // owns physical distance data
  durationMinutes: number; // owns physical duration data
  // NO active field — segments are frozen and always exist
  // NO currency field — inherited from trip.currency
}
```

### Segment Rules

- Auto-generated between consecutive commercial stops only
- Technical stops (boarding=false + dropping=false) are skipped
- **Frozen after creation** — no add or remove after trip is created
- Two overlapping segments CAN both have `maxSeats = bus.totalSeats` — they are independent inventory
- `distanceKm` and `durationMinutes` are owned by the segment

### Atomic CAS — Oversell Prevention

```sql
UPDATE segments
SET bookedSeats = bookedSeats + 1
WHERE segmentId = :id
AND bookedSeats + 1 <= maxSeats

-- 0 rows updated = no seats available → reject booking
-- Applied to ALL segments in the journey chain
```

---

## 7. Express Fare Schema

```typescript
interface ExpressFare {
  expressId: string; // system-generated
  fromPlaceId: string; // must match start of first covered segment
  toPlaceId: string; // must match end of last covered segment
  segmentsCovered: string[]; // ordered segmentIds, must form continuous chain
  price: number; // in trip.currency — NO currency field on fare
  validFrom: string | null; // null = active immediately
  validUntil: string | null; // null = no expiry
  active: boolean;
  totalDistanceKm: number; // DERIVED: sum of covered segment distanceKm
  totalDurationMinutes: number; // DERIVED: sum of covered segment durationMinutes
  // NO maxSeats — express fares have zero inventory
  // NO bookedSeats — inventory tracked in segments only
}
```

### Express Fare Rules

- `segmentsCovered` must form an unbroken chain — `toPlaceId` of seg[n] must equal `fromPlaceId` of seg[n+1]
- Fare application: if passenger journey matches express fare chain → apply express price, otherwise → sum segment `basePrice` values
- Removing a stop that breaks a chain is hard-blocked: `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`
- `totalDistanceKm` and `totalDurationMinutes` are computed, not stored independently

---

## 8. Ticket Schema

```typescript
interface Ticket {
  ticketId: string;
  tripId: string;
  segmentIds: string[]; // segments this ticket covers
  expressId?: string; // if express fare was applied
  passengerId: string;
  appliedPrice: number; // snapshot at booking time — NEVER changes
  currency: string; // snapshot of trip.currency at booking time
  status: TicketStatus;
  idempotencyKey: string; // required, exactly-once semantics
  expiresAt: string; // UTC — now() + seatHoldMinutes (PENDING only)
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}
```

### Ticket State Machine

```
PENDING   → CONFIRMED  (payment success)
PENDING   → EXPIRED    (payment failure or seatHoldMinutes elapsed)
CONFIRMED → CANCELLED  (full cancellation — triggers Refund)
EXPIRED   → terminal
CANCELLED → terminal
```

> Tickets are immutable financial records. Never mutate `appliedPrice`, `currency`, or `segmentIds` after creation.

---

## 9. Refund Schema

```typescript
interface Refund {
  refundId: string;
  ticketId: string; // reference to original ticket (unchanged)
  segmentsRefunded: string[]; // which segments are being refunded
  amount: number;
  currency: string;
  status: RefundStatus;
  createdAt: string;
  processedAt?: string;
}

// Revenue reconciliation:
// NetRevenue = SUM(Tickets.appliedPrice) - SUM(Refunds.amount)
```

> Partial cancellation creates a Refund record. The original Ticket is never modified.

### Refund Seat Release Rule

```
Refund status transitions:
REQUESTED → APPROVED → COMPLETED
REQUESTED → REJECTED

bookedSeats is decremented ONLY when Refund.status transitions to APPROVED.

Why not REQUESTED:
  Refund could be REJECTED later — seats would be freed incorrectly.

Why not COMPLETED:
  Too late — money processing can take days, seat stays blocked unnecessarily.

Why APPROVED:
  A human or system has confirmed the cancellation is valid.
  Safe to release the seat back into inventory at this point.
```

```typescript
// On Refund APPROVED — atomic seat release:
UPDATE segments
SET bookedSeats = bookedSeats - 1
WHERE segmentId IN refund.segmentsRefunded

// Revenue reconciliation:
// NetRevenue = SUM(Tickets.appliedPrice) - SUM(Refunds.amount WHERE status = APPROVED | COMPLETED)
```

---

## 10. Booking Flow

```
1. User selects journey (fromPlaceId → toPlaceId)
2. System resolves segment chain or matching express fare
3. Atomic CAS: bookedSeats + qty <= maxSeats for ALL segments in chain
   └─ Fails → return "no seats available", no ticket created
4. Create Ticket { status: PENDING, expiresAt: now() + seatHoldMinutes }
   └─ DB error → rollback CAS decrement
5. Start expiry timer
6. User completes payment
   ├─ Success → Ticket { status: CONFIRMED }, snapshot appliedPrice + currency
   └─ Failure or timeout → Ticket { status: EXPIRED }, decrement bookedSeats
7. Store idempotencyKey → replay returns existing ticket, no duplicate created
```

---

## 10.1 — Seat Hold Expiry Worker

```
// Expiry worker runs periodically (e.g. every 1 minute):

FOR EACH ticket WHERE status = PENDING AND expiresAt < now():
    ticket.status = EXPIRED
    FOR EACH segmentId IN ticket.segmentIds:
        UPDATE segments
        SET bookedSeats = bookedSeats - 1
        WHERE segmentId = :id
        // atomic decrement — seat returned to available pool

// This worker is critical — without it, expired PENDING tickets
// permanently hold seats and cause false "sold out" states.
// Worker must be idempotent — safe to run multiple times on same ticket.
```

---

## 11. Trip Status Transitions

```
SCHEDULED ──→ ACTIVE      Admin publishes trip. Booking engine opens.
SCHEDULED ──→ CANCELLED   Admin cancels before publish. No tickets, no refund flow.
ACTIVE    ──→ COMPLETED   Final stop reached (auto or manual). Booking engine closes.
ACTIVE    ──→ CANCELLED   Emergency. PENDING → EXPIRED (seats released).
                          CONFIRMED → Refund records auto-created.
COMPLETED ──→ terminal    No further transitions.
CANCELLED ──→ terminal    No further transitions.
```

---

## 12. Edit Permissions

| Field / Action                | SCHEDULED  | ACTIVE       | Rule                                                                                                                      |
| ----------------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| All fields                    | ✅ Free    | —            | No tickets exist yet                                                                                                      |
| Stop times                    | ✅ Free    | ⚠ Restricted | Blocked if any segment using this stop has bookedSeats > 0                                                                |
| maxSeats                      | ✅ Free    | ⚠ Restricted | Cannot reduce below current bookedSeats                                                                                   |
| seatHoldMinutes               | ✅ Free    | ⚠ Restricted | Change affects new bookings only                                                                                          |
| basePrice (segment)           | ✅ Free    | ✅ Allowed   | Tickets are snapshots — existing tickets unaffected                                                                       |
| Express fare price            | ✅ Free    | ✅ Allowed   | Tickets are snapshots — existing tickets unaffected                                                                       |
| validFrom/Until               | ✅ Free    | ✅ Allowed   | Affects future bookings only                                                                                              |
| Deactivate express fare       | ✅ Free    | ✅ Allowed   | Existing tickets unaffected                                                                                               |
| Add/deactivate pickup/dropoff | ✅ Free    | ✅ Allowed   | Always allowed                                                                                                            |
| Trip status                   | ✅ Free    | ✅ Allowed   | State machine rules only                                                                                                  |
| Bus reassignment              | ✅ Free    | ⚠ Restricted | New bus totalSeats must be >= MAX(bookedSeats across all segments). Error: BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY |
| departureDate / currency      | ✅ Free    | ❌ Blocked   | Cannot change after tickets exist                                                                                         |
| Remove any stop               | ✅ Free    | ❌ Blocked   | Blocked if referenced by segment or express fare                                                                          |
| Add / remove segments         | ❌ Blocked | ❌ Blocked   | Segments frozen at creation — create new trip if route changes                                                            |

---

## 13. Error Codes

| Code                                             | Trigger                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`        | Removing a stop that breaks an express fare chain                |
| `BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY` | New bus totalSeats < MAX(bookedSeats)                            |
| `SEGMENT_CAPACITY_EXCEEDED`                      | CAS update returned 0 rows — no seats available                  |
| `TICKET_IDEMPOTENCY_REPLAY`                      | Booking request replayed — existing ticket returned              |
| `INVALID_EXPRESS_FARE_CHAIN`                     | segmentsCovered does not form a continuous chain                 |
| `INVALID_STOP_SEQUENCE`                          | sequence not strictly ascending or duplicate                     |
| `INVALID_TIMELINE`                               | Stop timestamps not strictly increasing                          |
| `MAX_SEATS_BELOW_BOOKED`                         | Attempt to set maxSeats below current bookedSeats                |
| `MISSING_PICKUP_POINT`                           | A stop with `boardingAllowed = true` has no PickupPoint defined  |
| `MISSING_DROPOFF_POINT`                          | A stop with `droppingAllowed = true` has no DropoffPoint defined |

---

## 14. Canonical JSON Example

Route: **Djerba → Sfax → Sousse → Tunis** (all commercial stops)
Two express fares: full journey + partial journey (Sfax → Tunis)

```json
{
  "tripId": "TRIP_2025_04_15_DJE_TUN_01",
  "target": { "pos": "POS_ID_TN_MAIN" },
  "departureDate": "2025-04-15",
  "timezone": "Africa/Tunis",
  "status": "SCHEDULED",
  "bus": {
    "busId": "BUS_12"
    // pure reference — totalSeats read live from Bus entity
    // totalSeats is locked on Bus when bus is in SCHEDULED or ACTIVE trip
  },
  "currency": "TND",
  "seatHoldMinutes": 10,
  "stopSchedule": [
    {
      "placeId": "PLACE_DJERBA",
      "sequence": 1,
      "arrivalTime": null,
      "departureTime": "2025-04-15T06:00:00Z",
      "boardingAllowed": true,
      "droppingAllowed": false
    },
    {
      "placeId": "PLACE_SFAX",
      "sequence": 2,
      "arrivalTime": "2025-04-15T08:30:00Z",
      "departureTime": "2025-04-15T08:45:00Z",
      "boardingAllowed": true,
      "droppingAllowed": true
    },
    {
      "placeId": "PLACE_SOUSSE",
      "sequence": 3,
      "arrivalTime": "2025-04-15T10:30:00Z",
      "departureTime": "2025-04-15T10:45:00Z",
      "boardingAllowed": true,
      "droppingAllowed": true
    },
    {
      "placeId": "PLACE_TUNIS",
      "sequence": 4,
      "arrivalTime": "2025-04-15T12:30:00Z",
      "departureTime": null,
      "boardingAllowed": false,
      "droppingAllowed": true
    }
  ],
  "pickupPoints": [
    {
      "pointId": "PP_DJE_01",
      "placeId": "PLACE_DJERBA",
      "address": "Houmet Souk Bus Station",
      "scheduledDepartureTime": "2025-04-15T06:00:00Z",
      "active": true,
      "location": { "latitude": 33.8076, "longitude": 10.8451 }
    },
    {
      "pointId": "PP_SFX_01",
      "placeId": "PLACE_SFAX",
      "address": "Sfax Central Bus Station",
      "scheduledDepartureTime": "2025-04-15T08:45:00Z",
      "active": true,
      "location": { "latitude": 34.7406, "longitude": 10.7603 }
    }
  ],
  "dropoffPoints": [
    {
      "pointId": "DP_SOU_01",
      "placeId": "PLACE_SOUSSE",
      "address": "Sousse Bus Station",
      "scheduledArrivalTime": "2025-04-15T10:30:00Z",
      "active": true,
      "location": { "latitude": 35.8245, "longitude": 10.6346 }
    },
    {
      "pointId": "DP_TUN_01",
      "placeId": "PLACE_TUNIS",
      "address": "Tunis Central Bus Terminal",
      "scheduledArrivalTime": "2025-04-15T12:30:00Z",
      "active": true,
      "location": { "latitude": 36.8065, "longitude": 10.1815 }
    }
  ],
  "segments": [
    {
      "segmentId": "SEG_DJE_SFX",
      "fromPlaceId": "PLACE_DJERBA",
      "toPlaceId": "PLACE_SFAX",
      "departureTime": "2025-04-15T06:00:00Z",
      "arrivalTime": "2025-04-15T08:30:00Z",
      "maxSeats": 50,
      "bookedSeats": 0,
      "basePrice": 25,
      "distanceKm": 130,
      "durationMinutes": 150
    },
    {
      "segmentId": "SEG_SFX_SOU",
      "fromPlaceId": "PLACE_SFAX",
      "toPlaceId": "PLACE_SOUSSE",
      "departureTime": "2025-04-15T08:45:00Z",
      "arrivalTime": "2025-04-15T10:30:00Z",
      "maxSeats": 50,
      "bookedSeats": 0,
      "basePrice": 20,
      "distanceKm": 80,
      "durationMinutes": 105
    },
    {
      "segmentId": "SEG_SOU_TUN",
      "fromPlaceId": "PLACE_SOUSSE",
      "toPlaceId": "PLACE_TUNIS",
      "departureTime": "2025-04-15T10:45:00Z",
      "arrivalTime": "2025-04-15T12:30:00Z",
      "maxSeats": 50,
      "bookedSeats": 0,
      "basePrice": 25,
      "distanceKm": 60,
      "durationMinutes": 105
    }
  ],
  "expressFares": [
    {
      "expressId": "EXP_DJE_TUN",
      "fromPlaceId": "PLACE_DJERBA",
      "toPlaceId": "PLACE_TUNIS",
      "segmentsCovered": ["SEG_DJE_SFX", "SEG_SFX_SOU", "SEG_SOU_TUN"],
      "price": 55,
      "validFrom": null,
      "validUntil": null,
      "active": true,
      "totalDistanceKm": 270,
      "totalDurationMinutes": 360
    },
    {
      "expressId": "EXP_SFX_TUN",
      "fromPlaceId": "PLACE_SFAX",
      "toPlaceId": "PLACE_TUNIS",
      "segmentsCovered": ["SEG_SFX_SOU", "SEG_SOU_TUN"],
      "price": 38,
      "validFrom": null,
      "validUntil": null,
      "active": true,
      "totalDistanceKm": 140,
      "totalDurationMinutes": 210
    }
  ]
}
```

---

## 15. What Copilot Should Never Do

- Add `isCommercialStop` field to stops — use `boardingAllowed` + `droppingAllowed` only
- Add `currency` field to segments or express fares — it is inherited from `trip.currency`
- Add `maxSeats` or `bookedSeats` to express fares — they have zero inventory
- Add `active` field to segments — segments are frozen and always exist
- Store `totalDistanceKm` / `totalDurationMinutes` independently on express fares without deriving from segments
- Mutate a ticket after creation — use Refund entity for cancellations
- Create a ticket after payment success — ticket must be created as PENDING first
- Allow segments to be added or removed after trip creation
- Allow bus reassignment without checking MAX(bookedSeats) across all segments
- Use `stopId` — the canonical field name is `placeId`
- Add `totalSeats` to `trip.bus` — it is a pure reference, no snapshot needed
- Query trips or tickets without scoping by `target.pos` — platform is a marketplace

## 16. Shared Models Pattern

- One shared file: src/app/core/models/shared.model.ts
- Any type reused across more than one entity belongs in shared.model.ts
- Never redeclare shared types inside entity model files
- Always import from shared.model.ts when the type is not entity-specific
