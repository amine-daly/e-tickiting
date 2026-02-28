# Bus Business Model — Copilot Agent Specification

> Attach this file to VS Code Copilot agent alongside TRIP_SPEC.md before generating any code related to buses or amenities.
> This is the single source of truth for the Bus entity.

---

## 1. Core Principles

1. **Bus is a physical vehicle** — holds only data that belongs to the vehicle itself
2. **No trip data on bus** — pickup points, dropoff points, cancellation policy, rating, pricing all belong to Trip
3. **Amenities are enums** — never free text, frontend maps enum to icon and label
4. **Media uses baseUrl + path** — full URL constructed as `baseUrl + path` on the frontend
5. **type is skipped for now** — do not add a type field until explicitly specified
6. **Platform is a marketplace** — every Bus is scoped to a `target: { pos }`. Operators cannot see or edit each other's buses
7. **Trip holds only busId** — pure reference, no snapshot. `totalSeats` is read live from the Bus entity

---

## 2. Bus Object — Full Schema

```typescript
interface Bus {
  busId:      string;            // system-generated
  target:     { pos: string };   // marketplace scope — which operator owns this bus
  name:       string;            // operator/line name e.g. "Express Lines"
  totalSeats: number;            // absolute seat ceiling — segments cannot exceed this
                                 // LOCKED if bus is in any SCHEDULED or ACTIVE trip
  amenities:  Amenity[];         // enum values only
  media:      BusMedia;
}

interface BusMedia {
  pictures: BusPicture[];
}

interface BusPicture {
  baseUrl: string;   // e.g. "https://cdn.busgo.com"
  path:    string;   // e.g. "/buses/BUS_12/photo_1.jpg"
  // Full URL = baseUrl + path
}
```

---

## 3. Trip.bus — Pure Reference (No Snapshot)

```typescript
// Inside Trip object:
bus: {
  busId: string   // reference only — totalSeats read live from Bus entity
}
```

`trip.bus` holds only `busId`. No `totalSeats` snapshot.
`totalSeats` is always fetched live from the Bus entity via `busId`.

This is safe because `totalSeats` is locked on the Bus entity
whenever the bus is assigned to a SCHEDULED or ACTIVE trip.

---

## 4. Bus.totalSeats — Lock Logic (Option B)

**Core rule:**
```
totalSeats lives only on the Bus entity.
Trip holds only busId as a pure reference.
totalSeats is locked when bus is in any SCHEDULED or ACTIVE trip.
```

**Edit flow — triggered from Backoffice > Buses page (scoped by target.pos):**

```
Admin navigates to Backoffice → Buses → selects bus → edits totalSeats

STEP 1 — System checks bus usage across ALL trips:
  SELECT trips WHERE busId = :busId
  AND status IN (SCHEDULED, ACTIVE)

STEP 2A — Bus is in use:
  → BLOCKED
  → Error: BUS_SEATS_LOCKED_ACTIVE_TRIP
  → Admin must wait until all trips using this bus
    reach COMPLETED or CANCELLED status

STEP 2B — Bus is not in use:
  → totalSeats update allowed
  → All future trips using this bus will use the new value
  → Existing COMPLETED/CANCELLED trips are historical records — unaffected
```

**Impact on segment validation:**
```
segment.maxSeats <= bus.totalSeats

Since totalSeats cannot change while bus is in an active trip,
this constraint is always safe without needing a snapshot.
```

**Bus field edit permissions:**

| Field | Editable | Rule |
|---|---|---|
| `name` | ✅ Always | Display only, no inventory impact |
| `amenities` | ✅ Always | Display only, no inventory impact |
| `media.pictures` | ✅ Always | Display only, no inventory impact |
| `totalSeats` | ⚠ Restricted | Blocked if bus is in any SCHEDULED or ACTIVE trip |

---

## 5. Bus Reassignment on Trip

```
Admin reassigns bus on a trip (from Trip management page):

SCHEDULED trip:
  → fetch new bus.totalSeats
  → check: new bus.totalSeats >= MAX(bookedSeats across all segments)
  → PASSES → trip.busId updated freely
  → FAILS  → BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY

ACTIVE trip:
  → same capacity check applies
  → PASSES → trip.busId updated, segments maxSeats adjusted
  → FAILS  → BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY

COMPLETED / CANCELLED trip:
  → BLOCKED — trip is terminal, no reassignment allowed
```

---

## 6. Amenity Enum

```typescript
enum Amenity {
  WIFI         = "WIFI",
  POWER_OUTLET = "POWER_OUTLET",
  TV           = "TV",
  SNACKS       = "SNACKS",
  AC           = "AC",
  TOILET       = "TOILET",
  LUGGAGE      = "LUGGAGE",
  USB          = "USB"
}
```

### Amenity Display Map (Frontend)

| Enum Value | Label | Icon |
|---|---|---|
| `WIFI` | WiFi | wifi icon |
| `POWER_OUTLET` | Power Outlet | plug icon |
| `TV` | TV | monitor icon |
| `SNACKS` | Snacks | food icon |
| `AC` | AC | snowflake icon |
| `TOILET` | Toilet | toilet icon |
| `LUGGAGE` | Luggage | bag icon |
| `USB` | USB | usb icon |

> Never render raw enum strings to the user — always map through the display map.

---

## 7. All Status Enums (Canonical)

> All status fields across the platform use enums — never raw strings.

```typescript
enum TripStatus {
  SCHEDULED = "SCHEDULED",
  ACTIVE    = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

enum TicketStatus {
  PENDING   = "PENDING",
  CONFIRMED = "CONFIRMED",
  EXPIRED   = "EXPIRED",
  CANCELLED = "CANCELLED"
}

enum RefundStatus {
  REQUESTED = "REQUESTED",
  APPROVED  = "APPROVED",
  COMPLETED = "COMPLETED",
  REJECTED  = "REJECTED"
}
```

---

## 8. Canonical JSON Example

```json
{
  "busId":      "BUS_12",
  "target":     { "pos": "POS_ID_TN_MAIN" },
  "name":       "Express Lines",
  "totalSeats": 50,
  "amenities": [
    "WIFI",
    "POWER_OUTLET",
    "TV",
    "SNACKS",
    "AC",
    "TOILET",
    "LUGGAGE",
    "USB"
  ],
  "media": {
    "pictures": [
      { "baseUrl": "https://cdn.busgo.com", "path": "/buses/BUS_12/photo_1.jpg" },
      { "baseUrl": "https://cdn.busgo.com", "path": "/buses/BUS_12/photo_2.jpg" },
      { "baseUrl": "https://cdn.busgo.com", "path": "/buses/BUS_12/photo_3.jpg" },
      { "baseUrl": "https://cdn.busgo.com", "path": "/buses/BUS_12/photo_4.jpg" }
    ]
  }
}
```

**Trip.bus reference (inside Trip object):**
```json
"bus": {
  "busId": "BUS_12"
}
```

---

## 9. Marketplace Scoping

Every entity on the platform is scoped to a `target: { pos }`.

| Entity | target field | Meaning |
|---|---|---|
| `Bus` | `target.pos` | Which operator owns this bus |
| `Trip` | `target.pos` | Which operator sells this trip |
| `Ticket` | `target.pos` | Which operator's POS the booking was made on |

Rules:
- Backoffice Buses page only shows buses WHERE `bus.target.pos = currentOperator.pos`
- An operator cannot assign a bus from another operator's pos to their trip
- Queries across entities must always be scoped by `target.pos`

---

## 10. Bus Details Page — Data Sources

> The bus details page combines data from TWO objects. Never mix them.

| UI Element | Source | Field |
|---|---|---|
| Operator name | `Bus` | `bus.name` |
| Rating | Skipped for now | — |
| Bus type | Skipped for now | — |
| Origin / destination / times | `Trip` | `trip.stopSchedule` |
| Duration | `Trip` | derived from `segment.durationMinutes` |
| Amenities | `Bus` | `bus.amenities` |
| Bus photos | `Bus` | `bus.media.pictures` |
| Pickup points | `Trip` | `trip.pickupPoints` |
| Dropoff points | `Trip` | `trip.dropoffPoints` |
| Cancellation policy | Skipped for now | — |
| Price per person | `Trip` | `trip.expressFares[].price` or sum of `trip.segments[].basePrice` |
| Select Seats | `Trip` | triggers booking flow |

---

## 11. Error Codes

| Code | Trigger |
|---|---|
| `BUS_SEATS_LOCKED_ACTIVE_TRIP` | Attempt to edit `totalSeats` while bus is in SCHEDULED or ACTIVE trip |
| `BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY` | New bus `totalSeats` < MAX(`bookedSeats`) across all segments |

---

## 12. What Copilot Should Never Do

- Add `rating` to Bus — skipped for now
- Add `type` to Bus — skipped for now
- Add `pickupPoints` or `dropoffPoints` to Bus — they belong to Trip
- Add `cancellationPolicy` to Bus — skipped for now
- Add `price` or any fare data to Bus — pricing belongs to Trip
- Add `totalSeats` to `trip.bus` — it is a pure reference, no snapshot
- Use free text for amenities — always use `Amenity` enum
- Construct image URLs as a single string — always use `baseUrl + path` pattern
- Use string literals for any status field — always use the appropriate enum
- Show buses from other operators — always scope by `target.pos`
