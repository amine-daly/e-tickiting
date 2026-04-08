# Trip Module — Sprint Plan & User Stories

**Status:** Development Plan
**Last Updated:** April 2026
**Source of Truth:** `docs/TRIP_SPEC.md`, `docs/POS_AGENT.md`, `docs/COMPLETE_SPECIFICATIONS.md`

---

## Gap Analysis — Current State vs Target State

### What Exists Today (Legacy Model)

| Layer           | Current Implementation                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Entity**      | `TripType.java` — flat model: `originId`, `destinationId`, `totalPrice`, `stops` with rank+fare               |
| **Inventory**   | `seats: List<SeatUnit>` — flat seat map on trip, no segment-based inventory                                   |
| **Scoping**     | `target.pos` — legacy POS-only scoping                                                                        |
| **Status**      | `SCHEDULED`, `COMPLETED`, `CANCELLED` — missing `ACTIVE`                                                      |
| **Pricing**     | Single `totalPrice` — no per-segment pricing, no express fares                                                |
| **Points**      | `pickupPoints` as `List<PickupPointType>` — legacy trip-level points, no active flag, no mandatory validation |
| **Segments**    | Does not exist                                                                                                |
| **Express**     | Does not exist                                                                                                |
| **Currency**    | Does not exist — no currency field                                                                            |
| **Timezone**    | Does not exist — no timezone field                                                                            |
| **Seat Hold**   | Does not exist — no `seatHoldMinutes`                                                                         |
| **Ticket**      | Separate `ticket` package exists but does not follow TRIP_SPEC schema                                         |
| **Refund**      | Does not exist                                                                                                |
| **Booking CAS** | Does not exist — no atomic seat reservation                                                                   |
| **Frontend**    | Terminal: trip list + CRUD form (flat model). Frontend: trip search + results (simple)                        |

### What Must Be Built (Target Model — TRIP_SPEC)

| Layer              | Target                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Entity**         | Trip with 9 layers: identity, bus ref, currency, seat hold, stops, pickup, dropoff, segments, express fares |
| **Scoping**        | `target: { company }` — company-scoped ownership                                                            |
| **Status**         | `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED` — full state machine                                        |
| **Stops**          | `boardingAllowed` + `droppingAllowed` flags, sequence, arrivalTime/departureTime (UTC)                      |
| **Segments**       | Auto-generated between consecutive commercial stops. Frozen after creation. Inventory owner                 |
| **Express Fares**  | Pricing overlay over segment chains. Computed distance/duration. No inventory                               |
| **Pickup/Dropoff** | Mandatory per commercial stop. Active flag. Location. Linked to placeId                                     |
| **Ticket**         | Immutable financial snapshot. `target: { company, pos }`. Idempotency. Expiry                               |
| **Refund**         | Separate entity. Seat release on APPROVED                                                                   |
| **Booking**        | Atomic CAS on segments. Exactly-once semantics. Seat hold timer                                             |
| **Expiry Worker**  | Periodic job expiring PENDING tickets and releasing seats                                                   |

---

## Sprint Structure

| Sprint    | Theme                                      | Duration |
| --------- | ------------------------------------------ | -------- |
| Sprint 1  | Backend — Trip Entity & Stop Logic         | ~5 days  |
| Sprint 2  | Backend — Segments & Express Fares         | ~4 days  |
| Sprint 3  | Backend — Pickup/Dropoff & Trip CRUD API   | ~3 days  |
| Sprint 4  | Backend — Trip Status Machine & Edit Rules | ~3 days  |
| Sprint 5  | Frontend — Trip Models & Service Layer     | ~3 days  |
| Sprint 6  | Frontend — Trip Creation (Multi-Step Form) | ~5 days  |
| Sprint 7  | Frontend — Trip List, Detail & Edit        | ~4 days  |
| Sprint 8  | Backend — Ticket & Booking Engine          | ~5 days  |
| Sprint 9  | Backend — Refund & Expiry Worker           | ~3 days  |
| Sprint 10 | Frontend — Booking Flow & Seat Selection   | ~5 days  |

---

## Sprint 1 — Backend: Trip Entity & Stop Logic

### Goal

Rewrite `TripType.java` and all embedded value objects to match TRIP_SPEC schema. Implement stop validation logic.

---

### US-1.1 — Rewrite TripType Entity

**As a** developer
**I want** the Trip MongoDB document to match the 9-layer schema from TRIP_SPEC
**So that** all downstream features (segments, fares, tickets) have a correct foundation

**Acceptance Criteria:**

- [ ] `TripType.java` has these fields:
  - `id` (String, auto-generated)
  - `version` (Long, `@Version` for optimistic locking)
  - `target` (`TargetInput` with `company` field — NOT `pos`)
  - `departureDate` (String, ISO date, UTC)
  - `timezone` (String, IANA format e.g. `"Africa/Tunis"`)
  - `status` (`TripStatusEnum`, default `SCHEDULED`)
  - `bus` (embedded `TripBusRef` with `busId` only — no snapshot)
  - `currency` (String, ISO 4217 e.g. `"TND"`)
  - `seatHoldMinutes` (int, default 10)
  - `stopSchedule` (`List<StopType>`)
  - `pickupPoints` (`List<PickupPointType>`)
  - `dropoffPoints` (`List<DropoffPointType>`)
  - `segments` (`List<SegmentType>`)
  - `expressFares` (`List<ExpressFareType>`)
  - `createdAt`, `updatedAt` (Instant)
- [ ] `@Document("trips")` annotation
- [ ] `@CompoundIndex` on `target.company`
- [ ] `@CompoundIndex` on `originId` removed (no longer exists — route is defined by stopSchedule)
- [ ] Remove legacy fields: `originId`, `destinationId`, `totalPrice`, `availableSeats`, `totalPlaces`, `seats`, `agencyId`, `stops` (old rank+fare model)
- [ ] `target` uses `TargetInput` with `company` field only (not `pos`)
- [ ] `version` field retained for optimistic locking

**Tasks:**

1. Delete legacy `SeatUnit.java`, `SeatStateEnum.java` (seat map is replaced by segment-based inventory)
2. Rewrite `TripType.java` with all 9 layers
3. Create `TripBusRef.java` embedded type (`busId` only)
4. Update `TripStatusEnum.java` to add `ACTIVE` status
5. Verify `TargetInput.java` has `company` field (already done in prior migration)

---

### US-1.2 — Rewrite StopType Value Object

**As a** developer
**I want** stops to use `boardingAllowed` + `droppingAllowed` flags instead of rank+fare
**So that** stop type is derived from flags as per TRIP_SPEC section 4

**Acceptance Criteria:**

- [ ] `StopType.java` has:
  - `placeId` (String, references Place entity)
  - `sequence` (int, strictly ascending, unique per trip)
  - `arrivalTime` (Instant, null for first stop)
  - `departureTime` (Instant, null for last stop)
  - `boardingAllowed` (boolean)
  - `droppingAllowed` (boolean)
- [ ] Old fields removed: `rank`, `fare`
- [ ] No `isCommercialStop` field — type is derived from flags
- [ ] Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`

**Tasks:**

1. Rewrite `StopType.java` with spec fields
2. Remove `rank` and `fare` fields
3. Add Boolean flags `boardingAllowed`, `droppingAllowed`

---

### US-1.3 — Implement Stop Validation Rules

**As a** developer
**I want** all stop validation rules from TRIP_SPEC section 4 enforced
**So that** invalid stop configurations are rejected at creation time

**Acceptance Criteria:**

- [ ] `sequence` values are strictly ascending with no duplicates
- [ ] Timeline is strictly increasing — no equal or backward timestamps
- [ ] `departureTime >= arrivalTime` for all intermediate stops
- [ ] At least 2 commercial stops required (stops where `boardingAllowed || droppingAllowed`)
- [ ] First stop: `arrivalTime == null` (enforced)
- [ ] Last stop: `departureTime == null` (enforced)
- [ ] First stop: `arrivalTime != null` → validation error
- [ ] Last stop: `departureTime != null` → validation error
- [ ] Error code `INVALID_STOP_SEQUENCE` for sequence violations
- [ ] Error code `INVALID_TIMELINE` for timestamp violations

**Tasks:**

1. Create `StopValidator.java` utility class (or as a `@Component`)
2. Implement `validateStopSchedule(List<StopType> stops)` method
3. Return specific error codes per violation type
4. Unit test: ascending sequence — valid
5. Unit test: duplicate sequence — rejected with `INVALID_STOP_SEQUENCE`
6. Unit test: backward timestamp — rejected with `INVALID_TIMELINE`
7. Unit test: less than 2 commercial stops — rejected
8. Unit test: first stop has non-null arrivalTime — rejected
9. Unit test: last stop has non-null departureTime — rejected
10. Unit test: intermediate stop with departureTime < arrivalTime — rejected

---

### US-1.4 — Create TripBusRef Embedded Type

**As a** developer
**I want** the bus reference on Trip to be a pure reference (busId only)
**So that** `totalSeats` is always read live from the Bus entity, not snapshotted

**Acceptance Criteria:**

- [ ] `TripBusRef.java` has `busId` (String) only
- [ ] No `totalSeats`, `name`, or any other bus field stored on Trip
- [ ] Lombok annotations: `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`

**Tasks:**

1. Create `TripBusRef.java`
2. Replace any inline bus fields in `TripType.java` with `TripBusRef bus`

---

### US-1.5 — Update TripStatusEnum

**As a** developer
**I want** the trip status enum to include ACTIVE
**So that** the full state machine (SCHEDULED → ACTIVE → COMPLETED/CANCELLED) is supported

**Acceptance Criteria:**

- [ ] `TripStatusEnum.java` contains: `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- [ ] Default status for new trips is `SCHEDULED`

**Tasks:**

1. Add `ACTIVE` to `TripStatusEnum.java`
2. Verify no existing code breaks with the new enum value

---

## Sprint 2 — Backend: Segments & Express Fares

### Goal

Implement segment auto-generation from stops, segment schema, express fare schema, and all validation rules.

---

### US-2.1 — Create SegmentType Value Object

**As a** developer
**I want** the segment embedded type to match TRIP_SPEC section 6
**So that** each segment holds its own inventory, pricing, and physical data

**Acceptance Criteria:**

- [ ] `SegmentType.java` has:
  - `segmentId` (String, system-generated UUID)
  - `sequence` (int, strictly ascending, unique per trip)
  - `fromPlaceId` (String)
  - `toPlaceId` (String)
  - `departureTime` (Instant, derived from stopSchedule)
  - `arrivalTime` (Instant, derived from stopSchedule)
  - `maxSeats` (int, admin-defined, must be <= bus.totalSeats)
  - `bookedSeats` (int, starts at 0)
  - `basePrice` (BigDecimal, in trip.currency)
  - `distanceKm` (double)
  - `durationMinutes` (int)
- [ ] No `active` field — segments are frozen and always exist
- [ ] No `currency` field — inherited from `trip.currency`
- [ ] Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`

**Tasks:**

1. Create `SegmentType.java` with all spec fields
2. The `segmentId` should be generated via `UUID.randomUUID().toString()` at creation time
3. The `sequence` is assigned during auto-generation

---

### US-2.2 — Implement Segment Auto-Generation

**As a** developer
**I want** segments to be auto-generated from the stop schedule when a trip is created
**So that** inventory is properly set up between consecutive commercial stops

**Acceptance Criteria:**

- [ ] Segments are generated between consecutive commercial stops only
- [ ] Technical stops (`boardingAllowed=false` && `droppingAllowed=false`) are skipped
- [ ] A commercial stop is any stop where `boardingAllowed == true` OR `droppingAllowed == true`
- [ ] `segment.fromPlaceId` = commercial stop N's placeId
- [ ] `segment.toPlaceId` = commercial stop N+1's placeId
- [ ] `segment.departureTime` = stop N's `departureTime`
- [ ] `segment.arrivalTime` = stop N+1's `arrivalTime`
- [ ] `segment.sequence` assigned sequentially starting from 1
- [ ] `segment.bookedSeats` initialized to 0
- [ ] `segment.maxSeats` set from admin input (per segment) or defaults to bus.totalSeats
- [ ] `segment.basePrice` set from admin input (per segment)
- [ ] `segment.distanceKm` set from admin input (per segment)
- [ ] `segment.durationMinutes` computed from `departureTime` → `arrivalTime` or set from admin input
- [ ] Segments are frozen after creation — method only called at trip creation time

**Tasks:**

1. Create `SegmentGenerator.java` (or add to `TripService.java`)
2. Implement `generateSegments(List<StopType> stops, SegmentInputList adminInputs)` method
3. Filter only commercial stops
4. Pair consecutive commercial stops into segments
5. Map departure/arrival times from stop schedule
6. Assign sequential `segmentId` and `sequence`
7. Unit test: 4 commercial stops → 3 segments
8. Unit test: 4 stops with 1 technical stop → 2 segments (technical stop skipped)
9. Unit test: 2 commercial stops → 1 segment (minimum)
10. Unit test: verify segment times match stop times
11. Unit test: verify segment sequence is 1-indexed and consecutive

---

### US-2.3 — Implement Segment Frozen Rule

**As a** developer
**I want** segments to be immutable after trip creation
**So that** no one can add or remove segments post-creation

**Acceptance Criteria:**

- [ ] Trip update endpoint does NOT accept `segments` array in the request body
- [ ] Any attempt to modify `segments` is rejected with appropriate error
- [ ] Add / remove segments returns: `"Segments frozen at creation — create new trip if route changes"`
- [ ] Only allowed segment mutations (on individual segments, not the array):
  - `basePrice` — always allowed (tickets are snapshots)
  - `maxSeats` — allowed if new value >= current `bookedSeats`
- [ ] Error code `MAX_SEATS_BELOW_BOOKED` when reducing maxSeats below bookedSeats

**Tasks:**

1. In TripService update logic, strip `segments` from the incoming payload
2. Create separate endpoint or logic for individual segment field updates (price, maxSeats)
3. Add `MAX_SEATS_BELOW_BOOKED` validation on `maxSeats` reduction
4. Unit test: update trip with segments array → segments unchanged
5. Unit test: reduce maxSeats below bookedSeats → error
6. Unit test: reduce maxSeats above bookedSeats → success
7. Unit test: update basePrice → success for any status

---

### US-2.4 — Create ExpressFareType Value Object

**As a** developer
**I want** the express fare embedded type to match TRIP_SPEC section 7
**So that** express fares are pricing overlays over segment chains

**Acceptance Criteria:**

- [ ] `ExpressFareType.java` has:
  - `expressId` (String, system-generated UUID)
  - `fromPlaceId` (String)
  - `toPlaceId` (String)
  - `segmentsCovered` (List<String>, ordered segmentIds)
  - `price` (BigDecimal, in trip.currency)
  - `validFrom` (Instant, null = active immediately)
  - `validUntil` (Instant, null = no expiry)
  - `active` (boolean)
- [ ] No `maxSeats` or `bookedSeats` — zero inventory
- [ ] No `currency` — inherited from trip.currency
- [ ] `totalDistanceKm` and `totalDurationMinutes` are NOT stored — computed at read time
- [ ] Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`

**Tasks:**

1. Create `ExpressFareType.java` with all spec fields
2. Ensure no distance/duration fields are persisted
3. Computing logic is in the service/mapper layer (Sprint 2, US-2.5)

---

### US-2.5 — Implement Express Fare Validation

**As a** developer
**I want** express fare chain validation as per TRIP_SPEC section 7
**So that** only valid continuous segment chains are accepted

**Acceptance Criteria:**

- [ ] `segmentsCovered` must reference existing segment IDs on the trip
- [ ] Segments in `segmentsCovered` must form an unbroken chain:
  - `toPlaceId` of seg[n] must equal `fromPlaceId` of seg[n+1]
- [ ] `fromPlaceId` must match the `fromPlaceId` of the first segment in the chain
- [ ] `toPlaceId` must match the `toPlaceId` of the last segment in the chain
- [ ] Error code `INVALID_EXPRESS_FARE_CHAIN` if chain is broken or references invalid segments
- [ ] `totalDistanceKm` = SUM of `distanceKm` from covered segments (computed at read)
- [ ] `totalDurationMinutes` = SUM of `durationMinutes` from covered segments (computed at read)

**Tasks:**

1. Create `ExpressFareValidator.java`
2. Implement chain continuity validation
3. Implement `fromPlaceId` / `toPlaceId` boundary validation
4. Create a response mapper or `@Transient` getter that computes `totalDistanceKm` and `totalDurationMinutes`
5. Unit test: valid 3-segment chain → accepted
6. Unit test: broken chain (gap in placeIds) → `INVALID_EXPRESS_FARE_CHAIN`
7. Unit test: single segment chain → accepted
8. Unit test: segments out of order → `INVALID_EXPRESS_FARE_CHAIN`
9. Unit test: reference to non-existent segmentId → `INVALID_EXPRESS_FARE_CHAIN`
10. Unit test: computed distance/duration matches sum of covered segments

---

### US-2.6 — Express Fare Stop Removal Guard

**As a** developer
**I want** stop removal to be blocked if it breaks an express fare chain
**So that** existing express fares remain valid

**Acceptance Criteria:**

- [ ] When a stop is removed (SCHEDULED status), check if any express fare references segments that include that stop
- [ ] If removal would break any express fare chain → reject with `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`
- [ ] Stop removal is always blocked in ACTIVE status (per edit permissions table)

**Tasks:**

1. Implement dependency check in trip update logic
2. Scan `expressFares[].segmentsCovered` → resolve segments → check if any segment references the stop being removed
3. Unit test: remove stop not in any express fare → allowed
4. Unit test: remove stop that breaks express fare chain → `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`

---

## Sprint 3 — Backend: Pickup/Dropoff & Trip CRUD API

### Goal

Implement pickup/dropoff point types, mandatory validation, and the full Trip REST API.

---

### US-3.1 — Create PickupPointType Value Object

**As a** developer
**I want** the pickup point embedded type to match TRIP_SPEC section 5
**So that** each boarding-allowed stop has concrete pickup addresses

**Acceptance Criteria:**

- [ ] `PickupPointType.java` has:
  - `pointId` (String, unique per trip, system-generated UUID)
  - `placeId` (String, must exist in stopSchedule with `boardingAllowed=true`)
  - `address` (String, not blank)
  - `scheduledDepartureTime` (Instant, UTC, must align with stop schedule)
  - `active` (boolean)
  - `location` (embedded `GeoLocation` with `latitude`, `longitude` — optional)
- [ ] Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`

**Tasks:**

1. Create `PickupPointType.java`
2. Create `GeoLocation.java` embedded type (or reuse existing if present)
3. Ensure `pointId` is auto-generated

---

### US-3.2 — Create DropoffPointType Value Object

**As a** developer
**I want** the dropoff point embedded type to match TRIP_SPEC section 5
**So that** each dropping-allowed stop has concrete dropoff addresses

**Acceptance Criteria:**

- [ ] `DropoffPointType.java` has:
  - `pointId` (String, unique per trip, system-generated UUID)
  - `placeId` (String, must exist in stopSchedule with `droppingAllowed=true`)
  - `address` (String, not blank)
  - `scheduledArrivalTime` (Instant, UTC, must align with stop schedule)
  - `active` (boolean)
  - `location` (embedded `GeoLocation` with `latitude`, `longitude` — optional)
- [ ] Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`

**Tasks:**

1. Create `DropoffPointType.java`

---

### US-3.3 — Implement Pickup/Dropoff Mandatory Validation

**As a** developer
**I want** trip creation to be blocked if any commercial stop is missing its required points
**So that** every commercial stop has at least one pickup or dropoff point

**Acceptance Criteria:**

- [ ] Every stop with `boardingAllowed=true` must have at least one `PickupPoint` with matching `placeId`
- [ ] Every stop with `droppingAllowed=true` must have at least one `DropoffPoint` with matching `placeId`
- [ ] Error code `MISSING_PICKUP_POINT` if boarding stop has no pickup point
- [ ] Error code `MISSING_DROPOFF_POINT` if dropping stop has no dropoff point
- [ ] Validation runs at trip creation and when stops are modified (SCHEDULED only)
- [ ] `placeId` of point must exactly match `placeId` of a stop in `stopSchedule`

**Tasks:**

1. Create `PickupDropoffValidator.java`
2. Implement cross-check between `stopSchedule`, `pickupPoints`, and `dropoffPoints`
3. Unit test: all commercial stops covered → valid
4. Unit test: boarding stop missing pickup → `MISSING_PICKUP_POINT`
5. Unit test: dropping stop missing dropoff → `MISSING_DROPOFF_POINT`
6. Unit test: pickup point with placeId not in stopSchedule → rejected
7. Unit test: dropoff point with placeId that has `droppingAllowed=false` → rejected

---

### US-3.4 — Rewrite TripRepository

**As a** developer
**I want** the Trip MongoDB repository to use company-scoped queries
**So that** all trip queries enforce multi-tenant data isolation

**Acceptance Criteria:**

- [ ] `findByTargetCompany(String companyId, Pageable pageable)` → paginated list
- [ ] `findByTargetCompanyAndStatus(String companyId, TripStatusEnum status, Pageable pageable)`
- [ ] `searchByTargetCompany(String companyId, String searchTerm, Pageable pageable)` — search by stop placeIds or departure date
- [ ] `findByBusBusIdAndStatusIn(String busId, List<TripStatusEnum> statuses)` — for bus lock check
- [ ] Remove all `findByTargetPos` queries
- [ ] Remove `findByOriginAndDestination` queries (stops model replaces origin/destination)
- [ ] All queries scope by `target.company`

**Tasks:**

1. Rewrite `TripTypeRepository.java`
2. Add `@Query` annotations for custom queries
3. Remove legacy `posId`-scoped queries
4. Remove origin/destination queries
5. Add compound index definition for `target.company` + `status`
6. Add compound index definition for `target.company` + `departureDate`

---

### US-3.5 — Implement TripService

**As a** developer
**I want** a TripService that orchestrates trip creation, update, and read operations
**So that** all business rules are enforced in a single service layer

**Acceptance Criteria:**

- [ ] `create(TripCreateRequest req, String companyId)`:
  1. Validate stop schedule (US-1.3)
  2. Validate bus exists and belongs to company
  3. Validate bus is not already assigned to a SCHEDULED or ACTIVE trip (lock check)
  4. Validate pickup/dropoff points (US-3.3)
  5. Auto-generate segments from stops (US-2.2)
  6. Set `status = SCHEDULED`, `target.company = companyId`
  7. Persist and return
- [ ] `getById(String tripId, String companyId)` — company-scoped read
- [ ] `list(String companyId, TripFilterInput filter, Pageable pageable)` — paginated company-scoped list
- [ ] `update(String tripId, TripUpdateRequest req, String companyId)` — applies edit permission rules (Sprint 4)
- [ ] `delete(String tripId, String companyId)` — only if SCHEDULED and no tickets exist
- [ ] Express fare computed fields (`totalDistanceKm`, `totalDurationMinutes`) are enriched in the response layer

**Tasks:**

1. Create `TripService.java`
2. Inject `TripTypeRepository`, `BusRepository`, `BusService` (for lock checks)
3. Implement `create()` with full validation pipeline
4. Implement `getById()` with company scope check
5. Implement `list()` with filter support
6. Implement `delete()` with guards
7. Wire segment auto-generation into create flow
8. Wire pickup/dropoff validation into create flow
9. Wire stop validation into create flow

---

### US-3.6 — Implement TripController REST API

**As a** developer
**I want** a REST controller exposing the trip CRUD endpoints
**So that** the frontend can interact with the trip module

**Acceptance Criteria:**

- [ ] `POST /api/trips` — create trip (companyId from auth context)
- [ ] `GET /api/trips` — list trips (companyId from auth context, pagination params)
- [ ] `GET /api/trips/{tripId}` — get trip by ID (company-scoped)
- [ ] `PUT /api/trips/{tripId}` — update trip (company-scoped, edit rules enforced)
- [ ] `DELETE /api/trips/{tripId}` — delete trip (SCHEDULED only, no tickets)
- [ ] Request/Response DTOs:
  - `TripCreateRequest` — full creation payload (stops, pickup/dropoff, segment admin inputs, bus, currency, timezone, seatHoldMinutes)
  - `TripUpdateRequest` — partial update payload (only mutable fields)
  - `TripResponse` — full trip with computed express fare fields
  - `TripListResponse` — paginated list with summary fields
- [ ] All endpoints require authentication
- [ ] CompanyId extracted from authenticated user's `target.company`
- [ ] `@Valid` on request bodies for Bean Validation

**Tasks:**

1. Create `TripController.java` at `@RequestMapping("/api/trips")`
2. Create `TripCreateRequest.java` record/DTO
3. Create `TripUpdateRequest.java` record/DTO
4. Create `TripResponse.java` record/DTO (with computed fields)
5. Create `TripListResponse.java` for paginated summary
6. Wire authentication context to extract `companyId`
7. Add proper error handling with spec error codes
8. Swagger/OpenAPI annotations on all endpoints

---

### US-3.7 — Trip Creation Request DTO Design

**As a** developer
**I want** a well-structured creation request that captures all required inputs
**So that** the frontend knows exactly what to send

**Acceptance Criteria:**

- [ ] `TripCreateRequest` includes:
  ```
  {
    bus: { busId: String }                       // @NotBlank
    departureDate: String                         // @NotBlank, ISO date
    timezone: String                              // @NotBlank, IANA zone
    currency: String                              // @NotBlank, ISO 4217
    seatHoldMinutes: Integer                      // optional, default 10
    stopSchedule: [                               // @NotEmpty, @Valid
      {
        placeId: String                           // @NotBlank
        sequence: Integer                         // @NotNull
        arrivalTime: String                       // nullable
        departureTime: String                     // nullable
        boardingAllowed: Boolean                  // @NotNull
        droppingAllowed: Boolean                  // @NotNull
      }
    ]
    pickupPoints: [                               // @NotEmpty, @Valid
      {
        placeId: String                           // @NotBlank
        address: String                           // @NotBlank
        scheduledDepartureTime: String            // @NotBlank
        active: Boolean                           // default true
        location: { latitude, longitude }         // optional
      }
    ]
    dropoffPoints: [                              // @NotEmpty, @Valid
      {
        placeId: String
        address: String
        scheduledArrivalTime: String
        active: Boolean
        location: { latitude, longitude }
      }
    ]
    segmentInputs: [                              // @NotEmpty, @Valid
      {
        maxSeats: Integer                         // @NotNull, > 0
        basePrice: BigDecimal                     // @NotNull, >= 0
        distanceKm: Double                        // @NotNull, > 0
      }
    ]
    expressFares: [                               // optional
      {
        segmentsCovered: [String]                 // ordered segment indices (0-based, resolved to IDs after generation)
        price: BigDecimal
        validFrom: String                         // nullable
        validUntil: String                        // nullable
        active: Boolean
      }
    ]
  }
  ```
- [ ] `segmentInputs` are ordered — index 0 maps to segment between commercial stop 0 and 1, etc.
- [ ] `expressFares.segmentsCovered` initially references segment indices (0-based) because segment IDs are not known until after generation — service resolves them

**Tasks:**

1. Create `TripCreateRequest.java` with nested record types
2. Add Bean Validation annotations
3. Document in OpenAPI/Swagger

---

## Sprint 4 — Backend: Trip Status Machine & Edit Rules

### Goal

Implement the full trip status state machine and the conditional edit permissions from TRIP_SPEC section 12.

---

### US-4.1 — Implement Trip Status State Machine

**As a** developer
**I want** trip status transitions enforced per TRIP_SPEC section 11
**So that** only valid transitions are allowed

**Acceptance Criteria:**

- [ ] Valid transitions:
  - `SCHEDULED → ACTIVE` (admin publishes trip, booking engine opens)
  - `SCHEDULED → CANCELLED` (admin cancels before publish, no tickets exist)
  - `ACTIVE → COMPLETED` (final stop reached, booking engine closes)
  - `ACTIVE → CANCELLED` (emergency cancellation)
  - `COMPLETED → terminal` (no further transitions)
  - `CANCELLED → terminal` (no further transitions)
- [ ] On `ACTIVE → CANCELLED`:
  - All PENDING tickets → set to EXPIRED, decrement `bookedSeats` on their segments
  - All CONFIRMED tickets → auto-create Refund records with status REQUESTED
- [ ] Invalid transitions return HTTP 409 with descriptive error
- [ ] Status transition is a dedicated endpoint or a field on the update request

**Tasks:**

1. Create `TripStatusMachine.java` utility
2. Implement `isValidTransition(TripStatusEnum current, TripStatusEnum target)` method
3. Implement `onTransition(Trip trip, TripStatusEnum newStatus)` hook for side effects
4. Implement `ACTIVE → CANCELLED` side effects (expire pending, create refunds)
5. Add `PATCH /api/trips/{tripId}/status` endpoint (or handle via PUT)
6. Unit test: each valid transition → accepted
7. Unit test: each invalid transition → rejected (e.g. COMPLETED → ACTIVE)
8. Unit test: SCHEDULED → CANCELLED with no tickets → clean cancel
9. Unit test: ACTIVE → CANCELLED with PENDING tickets → tickets expired, seats released
10. Unit test: ACTIVE → CANCELLED with CONFIRMED tickets → refund records created

---

### US-4.2 — Implement Edit Permission Rules

**As a** developer
**I want** field-level edit permissions enforced based on trip status
**So that** TRIP_SPEC section 12 rules are respected

**Acceptance Criteria:**

- [ ] When `status == SCHEDULED`:
  - All fields freely editable (except segments array — frozen always)
  - Stop removal is allowed unless it breaks an express fare
- [ ] When `status == ACTIVE`:
  - Stop times: BLOCKED if any segment using that stop has `bookedSeats > 0`
  - `maxSeats`: cannot reduce below current `bookedSeats`
  - `seatHoldMinutes`: change affects new bookings only (allowed)
  - `basePrice` (segment): always allowed (tickets are snapshots)
  - Express fare `price`, `validFrom`, `validUntil`, `active`: always allowed
  - Add/deactivate pickup/dropoff: always allowed
  - Trip status: state machine rules only
  - Bus reassignment: new bus `totalSeats >= MAX(bookedSeats)` across all segments
  - `departureDate` / `currency`: BLOCKED
  - Remove any stop: BLOCKED
  - Add/remove segments: BLOCKED (always)
- [ ] Error `BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY` when bus reassignment fails capacity check

**Tasks:**

1. Create `TripEditRules.java`
2. Implement `validateUpdate(Trip existingTrip, TripUpdateRequest changes)` method
3. Per-field validation based on current status
4. Bus reassignment capacity check
5. Stop time edit check against segment bookedSeats
6. Unit test: SCHEDULED trip — all fields updated → success
7. Unit test: ACTIVE trip — change departureDate → blocked
8. Unit test: ACTIVE trip — change currency → blocked
9. Unit test: ACTIVE trip — remove stop → blocked
10. Unit test: ACTIVE trip — change basePrice → allowed
11. Unit test: ACTIVE trip — reduce maxSeats below bookedSeats → `MAX_SEATS_BELOW_BOOKED`
12. Unit test: ACTIVE trip — reassign bus with insufficient seats → `BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY`
13. Unit test: ACTIVE trip — reassign bus with sufficient seats → success
14. Unit test: ACTIVE trip — change stop time when segment has bookings → blocked
15. Unit test: ACTIVE trip — change stop time when segment has no bookings → allowed
16. Unit test: ACTIVE trip — add pickup/dropoff point → allowed
17. Unit test: ACTIVE trip — deactivate pickup/dropoff point → allowed

---

### US-4.3 — Bus Lock Integration

**As a** developer
**I want** a bus to be locked (totalSeats immutable) when assigned to a SCHEDULED or ACTIVE trip
**So that** bus capacity cannot change while trips depend on it

**Acceptance Criteria:**

- [ ] When creating a trip, verify the bus is not already in another SCHEDULED or ACTIVE trip
- [ ] When `BusService.update()` receives a `totalSeats` change, check if bus is in any SCHEDULED or ACTIVE trip
  - If yes → reject with error `BUS_LOCKED_BY_ACTIVE_TRIP` (or equivalent)
- [ ] The existing `BusService.isBusInActiveTrip()` and `assertTotalSeatsNotLocked()` methods remain in use
- [ ] Update `BusService` to query `TripTypeRepository.findByBusBusIdAndStatusIn()` with the new trip schema

**Tasks:**

1. Verify `BusService.isBusInActiveTrip()` still works with rewritten `TripType`
2. Update the query if field paths changed (e.g. `bus.busId` remains same)
3. Integration test: create trip → try to change bus totalSeats → blocked
4. Integration test: complete trip → change bus totalSeats → allowed

---

### US-4.4 — Express Fare CRUD Sub-Endpoints

**As a** developer
**I want** dedicated sub-endpoints for managing express fares on a trip
**So that** admins can add, update, and deactivate express fares independently

**Acceptance Criteria:**

- [ ] `POST /api/trips/{tripId}/express-fares` — add an express fare to the trip
  - Validates chain continuity (US-2.5)
  - Returns the trip with the new fare
- [ ] `PUT /api/trips/{tripId}/express-fares/{expressId}` — update an express fare
  - Can update: `price`, `validFrom`, `validUntil`, `active`
  - Cannot update: `segmentsCovered`, `fromPlaceId`, `toPlaceId` (create a new fare instead)
- [ ] `DELETE /api/trips/{tripId}/express-fares/{expressId}` — remove an express fare
  - Allowed when SCHEDULED
  - When ACTIVE: deactivate instead of delete (set `active=false`)
- [ ] All endpoints company-scoped

**Tasks:**

1. Add express fare CRUD methods to `TripService`
2. Add express fare sub-resource endpoints to `TripController`
3. Create `ExpressFareRequest.java` DTO
4. Wire chain validation on create
5. Unit test: add valid express fare → success
6. Unit test: add invalid chain → `INVALID_EXPRESS_FARE_CHAIN`
7. Unit test: update price on ACTIVE trip → allowed
8. Unit test: deactivate fare on ACTIVE trip → allowed

---

### US-4.5 — Pickup/Dropoff CRUD Sub-Endpoints

**As a** developer
**I want** dedicated sub-endpoints for managing pickup and dropoff points on a trip
**So that** admins can add, update, and deactivate points independently

**Acceptance Criteria:**

- [ ] `POST /api/trips/{tripId}/pickup-points` — add a pickup point
  - Validates `placeId` exists in `stopSchedule` with `boardingAllowed=true`
- [ ] `PUT /api/trips/{tripId}/pickup-points/{pointId}` — update a pickup point
  - Can update: `address`, `scheduledDepartureTime`, `active`, `location`
- [ ] `POST /api/trips/{tripId}/dropoff-points` — add a dropoff point
  - Validates `placeId` exists in `stopSchedule` with `droppingAllowed=true`
- [ ] `PUT /api/trips/{tripId}/dropoff-points/{pointId}` — update a dropoff point
- [ ] Deactivating a point does NOT affect existing CONFIRMED tickets
- [ ] Always allowed in both SCHEDULED and ACTIVE status

**Tasks:**

1. Add pickup/dropoff CRUD methods to `TripService`
2. Add sub-resource endpoints to `TripController`
3. Create `PickupPointRequest.java` and `DropoffPointRequest.java` DTOs
4. Wire placeId validation against stopSchedule
5. Unit test: add pickup to boarding stop → success
6. Unit test: add pickup to non-boarding stop → rejected
7. Unit test: deactivate pickup on ACTIVE trip → allowed

---

## Sprint 5 — Frontend: Trip Models & Service Layer

### Goal

Rewrite the frontend trip models, service layer, and filter model to match the new backend schema. This applies to the **terminal** (admin) app.

---

### US-5.1 — Rewrite Trip TypeScript Models

**As a** developer
**I want** the frontend trip models to match the new backend schema
**So that** the frontend correctly types all trip data

**Acceptance Criteria:**

- [ ] `trip.model.ts` contains:

  ```typescript
  export enum TripStatus {
    SCHEDULED = "SCHEDULED",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
  }

  export interface TripBusRef {
    busId: string;
  }

  export interface StopType {
    placeId: string;
    sequence: number;
    arrivalTime: string | null;
    departureTime: string | null;
    boardingAllowed: boolean;
    droppingAllowed: boolean;
    // expanded fields (from backend join/lookup)
    place?: PlaceType;
  }

  export interface SegmentType {
    segmentId: string;
    sequence: number;
    fromPlaceId: string;
    toPlaceId: string;
    departureTime: string;
    arrivalTime: string;
    maxSeats: number;
    bookedSeats: number;
    basePrice: number;
    distanceKm: number;
    durationMinutes: number;
  }

  export interface ExpressFareType {
    expressId: string;
    fromPlaceId: string;
    toPlaceId: string;
    segmentsCovered: string[];
    price: number;
    validFrom: string | null;
    validUntil: string | null;
    active: boolean;
    // computed (not stored)
    totalDistanceKm?: number;
    totalDurationMinutes?: number;
  }

  export interface PickupPointType {
    pointId: string;
    placeId: string;
    address: string;
    scheduledDepartureTime: string;
    active: boolean;
    location?: GeoLocation;
  }

  export interface DropoffPointType {
    pointId: string;
    placeId: string;
    address: string;
    scheduledArrivalTime: string;
    active: boolean;
    location?: GeoLocation;
  }

  export interface GeoLocation {
    latitude: number;
    longitude: number;
  }

  export interface TripType {
    id: string;
    target: { company: string };
    departureDate: string;
    timezone: string;
    status: TripStatus;
    bus: TripBusRef;
    currency: string;
    seatHoldMinutes: number;
    stopSchedule: StopType[];
    pickupPoints: PickupPointType[];
    dropoffPoints: DropoffPointType[];
    segments: SegmentType[];
    expressFares: ExpressFareType[];
    createdAt?: string;
    updatedAt?: string;
    version?: number;
  }
  ```

- [ ] Remove legacy fields: `originId`, `destinationId`, `totalPrice`, `availableSeats`, `totalPlaces`, `seats`, `agencyId`
- [ ] Remove legacy types: `SeatUnit`, `SeatStateEnum`, `TripRouteSnapshot` (if only used here)
- [ ] Import shared types from `shared.model.ts` if any are reusable (e.g. `GeoLocation`, `TargetType`)
- [ ] Check if `GeoLocation` or `TargetType` should be in `shared.model.ts` instead

**Tasks:**

1. Rewrite `apps/terminal/src/app/core/models/trip.model.ts`
2. Review `shared.model.ts` for types that should be shared
3. Move `GeoLocation` to `shared.model.ts` if used by other entities
4. Remove or relocate seat-related types if still needed elsewhere

---

### US-5.2 — Rewrite Trip Filter Model

**As a** developer
**I want** the trip filter model to match the new query capabilities
**So that** filters work with company-scoped, status-filtered trip queries

**Acceptance Criteria:**

- [ ] `trip-filter-input.model.ts` contains:
  ```typescript
  export interface TripFilterInput {
    status?: TripStatus;
    departureDateFrom?: string;
    departureDateTo?: string;
    searchTerm?: string;
    page?: number;
    size?: number;
  }
  ```
- [ ] Remove `originId`, `destinationId`, `agencyId` from filters
- [ ] Company scoping is handled by the service (injected from auth, not from filter)

**Tasks:**

1. Rewrite `apps/terminal/src/app/core/models/trip-filter-input.model.ts`

---

### US-5.3 — Rewrite Trip Service

**As a** developer
**I want** the trip service to call the new backend endpoints with proper payloads
**So that** the frontend correctly CRUDs trips using the new schema

**Acceptance Criteria:**

- [ ] `TripService` methods:
  - `list(filter: TripFilterInput)` → `GET /api/trips` with query params
  - `getById(tripId: string)` → `GET /api/trips/{tripId}`
  - `create(payload: TripCreatePayload)` → `POST /api/trips`
  - `update(tripId: string, changes: Partial<TripUpdatePayload>)` → `PUT /api/trips/{tripId}`
  - `delete(tripId: string)` → `DELETE /api/trips/{tripId}`
  - `updateStatus(tripId: string, status: TripStatus)` → `PATCH /api/trips/{tripId}/status`
  - `addExpressFare(tripId: string, fare: ExpressFarePayload)` → `POST /api/trips/{tripId}/express-fares`
  - `updateExpressFare(tripId: string, expressId: string, changes)` → `PUT /api/trips/{tripId}/express-fares/{expressId}`
  - `addPickupPoint(tripId: string, point: PickupPointPayload)` → `POST /api/trips/{tripId}/pickup-points`
  - `updatePickupPoint(tripId: string, pointId: string, changes)` → `PUT /api/trips/{tripId}/pickup-points/{pointId}`
  - `addDropoffPoint(tripId: string, point: DropoffPointPayload)` → `POST /api/trips/{tripId}/dropoff-points`
  - `updateDropoffPoint(tripId: string, pointId: string, changes)` → `PUT /api/trips/{tripId}/dropoff-points/{pointId}`
- [ ] BehaviorSubject state: `trips$`, `trip$`, `loading$`, `pagination$`
- [ ] Company scoping via `companyId` from `localStorage` (injected by service, not component)
- [ ] Uses `FormHelper.getChangedValues()` pattern for updates

**Tasks:**

1. Rewrite `apps/terminal/src/app/pages/trip/trip.service.ts`
2. Define `TripCreatePayload`, `TripUpdatePayload` interfaces
3. Define `ExpressFarePayload`, `PickupPointPayload`, `DropoffPointPayload` interfaces
4. Implement all HTTP methods with proper URLs
5. Implement BehaviorSubject state management per design-pattern.md
6. Ensure companyId is injected from localStorage, never from component

---

### US-5.4 — Create Trip Resolver

**As a** developer
**I want** a trip resolver for the edit route
**So that** trip data is available before the edit component loads

**Acceptance Criteria:**

- [ ] `TripResolver` calls `tripService.getById(id)` which pushes to `trip$` via `tap()`
- [ ] Component subscribes to `trip$`, NOT `route.snapshot.data`
- [ ] Resolver is attached to `/trips/:id` route only
- [ ] No resolver on list or create routes

**Tasks:**

1. Create `trip.resolver.ts`
2. Implement `ResolveFn<TripType>` or class-based resolver
3. Wire to routing in `trip.routes.ts`

---

## Sprint 6 — Frontend: Trip Creation (Multi-Step Form)

### Goal

Build the trip creation form as a multi-step wizard covering stops, segments, pickup/dropoff, and optional express fares.

---

### US-6.1 — Trip Create Route & Component Shell

**As a** developer
**I want** a trip creation page accessible at `/trips/create`
**So that** company admins can create new trips

**Acceptance Criteria:**

- [ ] Route: `/trips/create` → `TripCreateComponent`
- [ ] No resolver on create route
- [ ] Component uses `ReactiveFormsModule` with `FormBuilder`
- [ ] Multi-step form with stepper navigation
- [ ] Steps can be navigated forward/backward
- [ ] Final step shows summary before submission
- [ ] `destroy$` cleanup pattern

**Tasks:**

1. Create `trip-create.component.ts` + `.html` + `.scss`
2. Wire to routing
3. Set up stepper structure (Angular Material stepper or custom)
4. Initialize form groups for each step

---

### US-6.2 — Step 1: Basic Info (Identity Layer)

**As a** company admin
**I want** to set the basic trip info (bus, date, timezone, currency)
**So that** the trip identity is established

**Acceptance Criteria:**

- [ ] Form fields:
  - Bus selector (dropdown, loads from `BusService.list()` filtered by company)
  - Departure date (date picker, must be future date)
  - Timezone (dropdown, default `Africa/Tunis`, IANA timezone list)
  - Currency (dropdown, default `TND`, ISO 4217 codes)
  - Seat hold minutes (number input, default 10, min 1)
- [ ] Bus shows name + totalSeats
- [ ] Validation: bus required, departure date required and in future, timezone required, currency required
- [ ] i18n: all labels and error messages translated

**Tasks:**

1. Build Step 1 form group
2. Load buses via `BusService` on init
3. Implement bus selector with search/filter
4. Implement date picker (UTC conversion)
5. Implement timezone dropdown
6. Implement currency dropdown
7. Add validation messages

---

### US-6.3 — Step 2: Stop Schedule

**As a** company admin
**I want** to define the route by adding stops with times and flags
**So that** the trip route is established

**Acceptance Criteria:**

- [ ] Dynamic `FormArray` of stop entries
- [ ] Each stop entry:
  - Place selector (loads from `PlacesService`, `PlaceKind.CITY`)
  - Sequence (auto-assigned, user can reorder)
  - Arrival time (datetime picker, null for first stop)
  - Departure time (datetime picker, null for last stop)
  - Boarding allowed (checkbox)
  - Dropping allowed (checkbox)
- [ ] Minimum 2 stops required
- [ ] Add stop button
- [ ] Remove stop button (with confirmation if > 2 stops)
- [ ] Drag-and-drop reorder (sequence auto-recalculated)
- [ ] Real-time validation:
  - Sequence strictly ascending
  - Timeline strictly increasing
  - At least 2 commercial stops
  - First stop: arrivalTime disabled/null
  - Last stop: departureTime disabled/null
- [ ] Visual indicators for stop type (Origin / Destination / Intermediate / Technical)
- [ ] All times entered in local timezone (converted to UTC on submit)
- [ ] i18n for all labels

**Tasks:**

1. Build Step 2 FormArray with dynamic stops
2. Implement place selector per stop (autocomplete)
3. Implement datetime picker per stop
4. Implement boarding/dropping checkboxes
5. Implement drag-and-drop reorder
6. Implement auto-sequence assignment on reorder
7. Implement real-time stop validation
8. Implement visual stop type indicators
9. Implement first/last stop special field behavior (disable arrival/departure respectively)
10. Implement timezone-to-UTC conversion logic

---

### US-6.4 — Step 3: Segment Configuration

**As a** company admin
**I want** to configure the auto-generated segments with pricing and capacity
**So that** each segment has a base price, max seats, and distance

**Acceptance Criteria:**

- [ ] Segments are auto-previewed from Step 2's stops (commercial stops only)
- [ ] Each segment row shows:
  - From place → To place (read-only, derived from stops)
  - Departure time → Arrival time (read-only, derived from stops)
  - Max seats (number input, default = bus.totalSeats, max = bus.totalSeats)
  - Base price (number input, required, >= 0)
  - Distance km (number input, required, > 0)
  - Duration minutes (auto-computed from times, editable override)
- [ ] Segment list auto-updates when stops change in Step 2
- [ ] If admin navigates back to Step 2 and changes stops, segments regenerate
- [ ] Total route price (sum of all segment base prices) shown as a summary
- [ ] Validation: all required segment fields must be filled

**Tasks:**

1. Build Step 3 segment preview based on Step 2 stops
2. Filter commercial stops from Step 2
3. Generate segment pairs from consecutive commercial stops
4. Implement reactive update when stops change
5. Implement segment form fields (maxSeats, basePrice, distanceKm)
6. Implement auto-duration computation
7. Implement total price summary calculation
8. Add validation

---

### US-6.5 — Step 4: Pickup & Dropoff Points

**As a** company admin
**I want** to define pickup and dropoff points for each commercial stop
**So that** passengers know exactly where to board and alight

**Acceptance Criteria:**

- [ ] For each stop with `boardingAllowed=true`:
  - Show "Pickup Points" section
  - Dynamic FormArray of pickup points
  - Each pickup point: address (text), scheduled departure time (datetime), active (toggle), location (lat/lng — optional)
  - At least one pickup point required per boarding stop
- [ ] For each stop with `droppingAllowed=true`:
  - Show "Dropoff Points" section
  - Dynamic FormArray of dropoff points
  - Each dropoff point: address (text), scheduled arrival time (datetime), active (toggle), location (lat/lng — optional)
  - At least one dropoff point required per dropping stop
- [ ] Points grouped visually by stop (stop name as section header)
- [ ] Add point / remove point buttons per stop
- [ ] Validation:
  - Every boarding stop has at least one pickup point
  - Every dropping stop has at least one dropoff point
  - Scheduled times align with stop schedule
- [ ] Visual error indicator on stops missing required points
- [ ] i18n for all labels

**Tasks:**

1. Build Step 4 dynamic form structure (grouped by stop)
2. Implement pickup point FormArray per boarding stop
3. Implement dropoff point FormArray per dropping stop
4. Implement add/remove buttons
5. Implement mandatory point validation
6. Implement scheduled time alignment validation
7. Implement location input (lat/lng optional fields)
8. Implement visual grouping by stop
9. Implement error indicators

---

### US-6.6 — Step 5: Express Fares (Optional)

**As a** company admin
**I want** to optionally create express fares as pricing overlays
**So that** multi-segment journeys can have discounted bundle prices

**Acceptance Criteria:**

- [ ] Step is optional — admin can skip it
- [ ] "Add Express Fare" button
- [ ] Each express fare:
  - Segment range selector (from segment → to segment, must be consecutive chain)
  - From place (auto-derived from first segment) — read-only
  - To place (auto-derived from last segment) — read-only
  - Price (number input, required)
  - Valid from (datetime, nullable)
  - Valid until (datetime, nullable)
  - Active (toggle, default true)
- [ ] Segment chain validation (must be consecutive segments)
- [ ] Show computed total distance and duration from covered segments
- [ ] Show comparison: express price vs sum of segment base prices (savings)
- [ ] Multiple express fares can be created
- [ ] Remove express fare button
- [ ] i18n for all labels

**Tasks:**

1. Build Step 5 express fare FormArray
2. Implement segment range selector (multi-select or from/to selector)
3. Implement chain validation (consecutive segments)
4. Implement auto-derived from/to places
5. Implement price comparison display
6. Implement computed distance/duration display
7. Implement validity date fields
8. Implement add/remove express fare buttons
9. Add validation

---

### US-6.7 — Step 6: Review & Submit

**As a** company admin
**I want** to review the entire trip configuration before submitting
**So that** I can catch any errors before creation

**Acceptance Criteria:**

- [ ] Read-only summary of all steps:
  - Basic info: bus, date, timezone, currency, seat hold
  - Route: visualized stop list with flags and times
  - Segments: table with pricing and capacity
  - Pickup/dropoff: grouped by stop
  - Express fares: table with chain and pricing
- [ ] "Edit" button per section (navigates back to that step)
- [ ] "Create Trip" submit button
- [ ] Submit uses `FormHelper.getChangedValues()` pattern + `target.company` injection
- [ ] On success: `alert.success()` → navigate to trip list
- [ ] On error: parse error codes, display translated message, stay on page
- [ ] `isSubmitting` flag to prevent double-submit
- [ ] i18n for all labels and success/error messages

**Tasks:**

1. Build Step 6 summary layout
2. Implement per-section edit navigation
3. Implement payload assembly from all steps
4. Implement submit with service call
5. Implement success/error handling per design-pattern.md
6. Implement double-submit prevention
7. Add i18n keys for all messages

---

## Sprint 7 — Frontend: Trip List, Detail & Edit

### Goal

Build the trip list page with filters, trip detail view, and trip editing.

---

### US-7.1 — Trip List Component

**As a** company admin
**I want** a paginated trip list filtered by status and date
**So that** I can manage all company trips

**Acceptance Criteria:**

- [ ] Route: `/trips` → `TripListComponent`
- [ ] Table columns: departure date, route (first stop → last stop), status, segments count, bus name, actions
- [ ] Filters:
  - Status dropdown (ALL, SCHEDULED, ACTIVE, COMPLETED, CANCELLED)
  - Departure date range (from/to)
  - Search text
- [ ] Pagination
- [ ] Actions per row:
  - View details (navigate to `/trips/:id`)
  - Quick status change (e.g. Publish = SCHEDULED → ACTIVE)
  - Delete (only SCHEDULED with no tickets, with confirmation)
- [ ] Loading state
- [ ] Empty state with create CTA
- [ ] Subscribes to `tripService.trips$`
- [ ] Calls `tripService.list()` in `ngOnInit` with default filters
- [ ] `destroy$` cleanup pattern
- [ ] i18n for all labels, statuses, and empty state message

**Tasks:**

1. Create `trip-list.component.ts` + `.html` + `.scss`
2. Implement data table with columns
3. Implement filter form (status, date range, search)
4. Implement pagination
5. Implement row actions
6. Implement loading/empty states
7. Wire to `tripService.trips$`
8. Add i18n keys

---

### US-7.2 — Trip Detail Component

**As a** company admin
**I want** a detailed trip view showing all layers
**So that** I can inspect the full trip configuration

**Acceptance Criteria:**

- [ ] Route: `/trips/:id` → `TripDetailComponent` (same component for view and edit per design-pattern.md)
- [ ] Uses `TripResolver` to preload data
- [ ] Sections:
  - **Header**: status badge, departure date, timezone, bus reference
  - **Route Map**: visual stop list with types, times, and flags
  - **Segments**: table with from/to, times, capacity (booked/max), price, distance, duration
  - **Express Fares**: table with chain, price, validity, status, computed totals
  - **Pickup Points**: grouped by stop with address, time, active, location
  - **Dropoff Points**: grouped by stop with address, time, active, location
- [ ] Status transition buttons based on current status:
  - SCHEDULED: "Publish" (→ ACTIVE), "Cancel" (→ CANCELLED)
  - ACTIVE: "Complete" (→ COMPLETED), "Emergency Cancel" (→ CANCELLED with confirmation)
  - COMPLETED/CANCELLED: no action buttons
- [ ] Edit mode toggle (switches to editable form)
- [ ] i18n for all labels

**Tasks:**

1. Create `trip-detail.component.ts` + `.html` + `.scss`
2. Implement header with status badge
3. Implement stop schedule visualization
4. Implement segments table
5. Implement express fares table with computed fields
6. Implement pickup/dropoff sections grouped by stop
7. Implement status transition buttons with confirmation dialogs
8. Wire to `tripService.trip$` via resolver
9. Add i18n keys

---

### US-7.3 — Trip Edit Mode

**As a** company admin
**I want** to edit a trip's mutable fields respecting edit permission rules
**So that** I can adjust prices, capacity, and points without recreating the trip

**Acceptance Criteria:**

- [ ] Edit mode activated from trip detail view
- [ ] Editable fields depend on trip status (per TRIP_SPEC section 12):
  - **SCHEDULED**: all fields editable (except segments array structure)
  - **ACTIVE**: only allowed fields editable; restricted/blocked fields are read-only with tooltip explaining why
- [ ] Segment editing (inline table):
  - `basePrice`: always editable
  - `maxSeats`: editable with min = current bookedSeats
- [ ] Express fare editing:
  - `price`, `validFrom`, `validUntil`, `active`: always editable
- [ ] Pickup/dropoff point operations:
  - Add new point
  - Edit existing point (address, time, active, location)
  - Deactivate point (set `active=false`)
- [ ] Bus reassignment (SCHEDULED: free, ACTIVE: capacity check)
- [ ] Uses `FormHelper.getChangedValues()` — only sends changed fields
- [ ] `isButtonDisabled = isEqual(current, initial)` pattern
- [ ] On success → navigate to detail view
- [ ] On error → translate error codes, stay on page

**Tasks:**

1. Implement edit mode toggle in trip detail component
2. Build reactive form from existing trip data
3. Implement field-level read-only based on status
4. Implement inline segment editing (price, maxSeats)
5. Implement express fare editing
6. Implement pickup/dropoff point CRUD
7. Implement bus reassignment with validation
8. Implement submit with changed-values-only pattern
9. Implement error handling with translated error codes
10. Add tooltips for blocked fields explaining the reason

---

### US-7.4 — Trip Routes Configuration

**As a** developer
**I want** the trip routes properly configured
**So that** list, create, and detail views are accessible

**Acceptance Criteria:**

- [ ] Routes:
  ```typescript
  export const tripRoutes: Routes = [
    { path: "", component: TripListComponent },
    { path: "create", component: TripCreateComponent },
    {
      path: ":id",
      component: TripDetailComponent,
      resolve: { trip: tripResolver },
    },
  ];
  ```
- [ ] Lazy-loaded from parent routing
- [ ] Resolver only on `:id` route
- [ ] No resolver on create route
- [ ] Main `app.routes.ts` updated with trips path

**Tasks:**

1. Rewrite `trip-list.routes.ts` → `trip.routes.ts`
2. Add all three routes
3. Wire resolver to detail route
4. Update parent routing if needed

---

### US-7.5 — i18n Keys for Trip Module

**As a** developer
**I want** all trip-related i18n keys defined
**So that** no hardcoded strings appear in the UI

**Acceptance Criteria:**

- [ ] `en-gb.json` and `fr-fr.json` updated with `TRIPS` section:
  ```json
  "TRIPS": {
    "TITLE": "Trips",
    "CREATE": "Create Trip",
    "EDIT": "Edit Trip",
    "DELETE": "Delete Trip",
    "DELETE_CONFIRM": "Are you sure you want to delete this trip?",
    "STATUS": {
      "SCHEDULED": "Scheduled",
      "ACTIVE": "Active",
      "COMPLETED": "Completed",
      "CANCELLED": "Cancelled"
    },
    "FIELDS": {
      "DEPARTURE_DATE": "Departure Date",
      "TIMEZONE": "Timezone",
      "CURRENCY": "Currency",
      "SEAT_HOLD_MINUTES": "Seat Hold (minutes)",
      "BUS": "Bus"
    },
    "STOPS": {
      "TITLE": "Stop Schedule",
      "ADD": "Add Stop",
      "REMOVE": "Remove Stop",
      "PLACE": "Place",
      "SEQUENCE": "Order",
      "ARRIVAL_TIME": "Arrival Time",
      "DEPARTURE_TIME": "Departure Time",
      "BOARDING_ALLOWED": "Boarding Allowed",
      "DROPPING_ALLOWED": "Dropping Allowed",
      "TYPES": {
        "ORIGIN": "Origin",
        "DESTINATION": "Destination",
        "INTERMEDIATE": "Intermediate",
        "TECHNICAL": "Technical Stop"
      }
    },
    "SEGMENTS": {
      "TITLE": "Segments",
      "FROM": "From",
      "TO": "To",
      "MAX_SEATS": "Max Seats",
      "BOOKED_SEATS": "Booked Seats",
      "BASE_PRICE": "Base Price",
      "DISTANCE_KM": "Distance (km)",
      "DURATION_MIN": "Duration (min)"
    },
    "EXPRESS_FARES": {
      "TITLE": "Express Fares",
      "ADD": "Add Express Fare",
      "PRICE": "Price",
      "VALID_FROM": "Valid From",
      "VALID_UNTIL": "Valid Until",
      "ACTIVE": "Active",
      "SEGMENTS_COVERED": "Segments Covered",
      "TOTAL_DISTANCE": "Total Distance (km)",
      "TOTAL_DURATION": "Total Duration (min)",
      "SAVINGS": "Savings vs Segments"
    },
    "PICKUP_POINTS": {
      "TITLE": "Pickup Points",
      "ADD": "Add Pickup Point",
      "ADDRESS": "Address",
      "SCHEDULED_TIME": "Scheduled Departure",
      "ACTIVE": "Active",
      "LOCATION": "Location"
    },
    "DROPOFF_POINTS": {
      "TITLE": "Dropoff Points",
      "ADD": "Add Dropoff Point",
      "ADDRESS": "Address",
      "SCHEDULED_TIME": "Scheduled Arrival",
      "ACTIVE": "Active",
      "LOCATION": "Location"
    },
    "ACTIONS": {
      "PUBLISH": "Publish Trip",
      "COMPLETE": "Complete Trip",
      "CANCEL": "Cancel Trip",
      "EMERGENCY_CANCEL": "Emergency Cancel"
    },
    "ERRORS": {
      "INVALID_STOP_SEQUENCE": "Stop sequence must be strictly ascending with no duplicates",
      "INVALID_TIMELINE": "Stop timestamps must be strictly increasing",
      "MISSING_PICKUP_POINT": "Every boarding stop must have at least one pickup point",
      "MISSING_DROPOFF_POINT": "Every dropping stop must have at least one dropoff point",
      "INVALID_EXPRESS_FARE_CHAIN": "Express fare segments must form a continuous chain",
      "MAX_SEATS_BELOW_BOOKED": "Cannot reduce max seats below current booked seats",
      "BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY": "New bus has insufficient capacity for current bookings",
      "STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY": "Cannot remove this stop — an express fare depends on it",
      "BUS_LOCKED_BY_ACTIVE_TRIP": "Bus capacity is locked by a scheduled or active trip"
    },
    "MESSAGES": {
      "CREATED": "Trip created successfully",
      "UPDATED": "Trip updated successfully",
      "DELETED": "Trip deleted successfully",
      "STATUS_UPDATED": "Trip status updated",
      "PUBLISH_CONFIRM": "Publishing will open this trip for booking. Continue?",
      "CANCEL_CONFIRM": "This action will cancel the trip. Continue?",
      "EMERGENCY_CANCEL_CONFIRM": "Emergency cancel will expire all pending tickets and create refunds for confirmed tickets. Continue?"
    },
    "EMPTY": "No trips found. Create your first trip.",
    "FILTERS": {
      "STATUS": "Filter by Status",
      "DATE_FROM": "From Date",
      "DATE_TO": "To Date",
      "SEARCH": "Search trips..."
    }
  }
  ```
- [ ] Same structure in `fr-fr.json` with French translations

**Tasks:**

1. Add `TRIPS` section to `en-gb.json`
2. Add `TRIPS` section to `fr-fr.json`
3. Verify all component templates use translate pipe

---

## Sprint 8 — Backend: Ticket & Booking Engine

### Goal

Implement the ticket entity, booking flow with atomic CAS, and idempotency.

---

### US-8.1 — Rewrite Ticket Entity

**As a** developer
**I want** the Ticket MongoDB document to match TRIP_SPEC section 8
**So that** tickets are immutable financial snapshots with proper attribution

**Acceptance Criteria:**

- [ ] `TicketType.java` has:
  - `id` (String, auto-generated)
  - `tripId` (String, reference to trip)
  - `target` (embedded `TicketTarget` with `company` and `pos`)
  - `segmentIds` (List<String>, segments covered)
  - `expressId` (String, nullable — if express fare applied)
  - `pickupPointId` (String, mandatory)
  - `dropoffPointId` (String, mandatory)
  - `passengerId` (String)
  - `appliedPrice` (BigDecimal, snapshot at booking — never changes)
  - `currency` (String, snapshot of trip.currency)
  - `status` (TicketStatusEnum)
  - `idempotencyKey` (String, unique index, required)
  - `expiresAt` (Instant, UTC — `now() + seatHoldMinutes`)
  - `createdAt` (Instant)
  - `confirmedAt` (Instant, nullable)
  - `cancelledAt` (Instant, nullable)
- [ ] `@Document("tickets")`
- [ ] Unique index on `idempotencyKey`
- [ ] Compound index on `target.company`
- [ ] Compound index on `target.company` + `target.pos`
- [ ] Compound index on `tripId` + `status`
- [ ] `TicketStatusEnum`: `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED`

**Tasks:**

1. Rewrite `TicketType.java` with spec fields
2. Create `TicketTarget.java` embedded type (company + pos)
3. Update `TicketStatusEnum.java`
4. Define indexes

---

### US-8.2 — Implement Atomic CAS Booking

**As a** developer
**I want** atomic compare-and-swap seat reservation on segments
**So that** overselling is prevented even under concurrent access

**Acceptance Criteria:**

- [ ] Booking atomically increments `bookedSeats` on ALL segments in the journey chain
- [ ] CAS condition: `bookedSeats + quantity <= maxSeats` for each segment
- [ ] If ANY segment fails CAS → entire booking rejected, no partial reservation
- [ ] Error code: `SEGMENT_CAPACITY_EXCEEDED`
- [ ] MongoDB update query pattern:
  ```
  db.trips.updateOne(
    { "segments.segmentId": segId, "segments.bookedSeats": { $lte: maxSeats - qty } },
    { $inc: { "segments.$.bookedSeats": qty } }
  )
  ```
- [ ] On rollback (booking fails after partial CAS), decrement all already-incremented segments
- [ ] Thread-safe / concurrent-safe
- [ ] Unit test: single booking on available segment → success
- [ ] Unit test: booking exceeding maxSeats → `SEGMENT_CAPACITY_EXCEEDED`
- [ ] Unit test: concurrent bookings on last seat → only one succeeds

**Tasks:**

1. Implement `SeatReservationService.java`
2. Implement `reserveSeats(String tripId, List<String> segmentIds, int quantity)` method
3. Implement CAS update per segment using `MongoTemplate`
4. Implement rollback on partial failure
5. Implement `releaseSeats(String tripId, List<String> segmentIds, int quantity)` for expiry/cancel
6. Write concurrent booking unit/integration tests

---

### US-8.3 — Implement Booking Service

**As a** developer
**I want** a booking service that orchestrates the full booking flow
**So that** the booking flow from TRIP_SPEC section 10 is implemented

**Acceptance Criteria:**

- [ ] `BookingService.createBooking(BookingRequest req)`:
  1. Resolve segment chain from `fromPlaceId` → `toPlaceId`
  2. Check for matching express fare
  3. Calculate `appliedPrice`:
     - If express fare matches → use express fare price
     - Otherwise → sum segment base prices
  4. Atomic CAS: reserve seats on all segments
  5. Create ticket with `status = PENDING`, `expiresAt = now() + seatHoldMinutes`
  6. If DB error on ticket creation → rollback CAS (release seats)
  7. Return ticket
- [ ] Idempotency: if `idempotencyKey` already exists → return existing ticket, no duplicate
  - Return code: `TICKET_IDEMPOTENCY_REPLAY`
- [ ] Segment chain resolution: find ordered segments from departure stop to arrival stop
- [ ] Pickup/dropoff point validation: `pickupPointId` must belong to departure stop, `dropoffPointId` must belong to arrival stop, both must be `active=true`

**Tasks:**

1. Create `BookingService.java`
2. Implement segment chain resolution algorithm
3. Implement express fare matching logic
4. Implement price calculation (express or sum)
5. Implement booking creation with CAS
6. Implement idempotency check
7. Implement pickup/dropoff validation
8. Implement rollback on failure
9. Unit test: full booking flow (happy path)
10. Unit test: idempotency replay
11. Unit test: express fare applied
12. Unit test: segment sum fallback
13. Unit test: invalid pickup point → rejected
14. Unit test: inactive dropoff point → rejected

---

### US-8.4 — Implement Booking Controller

**As a** developer
**I want** a REST endpoint for creating bookings
**So that** the frontend and POS can create tickets

**Acceptance Criteria:**

- [ ] `POST /api/bookings` — create a booking
  ```json
  {
    "tripId": "string",
    "fromPlaceId": "string",
    "toPlaceId": "string",
    "pickupPointId": "string",
    "dropoffPointId": "string",
    "passengerId": "string",
    "idempotencyKey": "string"
  }
  ```
- [ ] Response: full ticket object with applied price and status
- [ ] `target.company` from trip's target, `target.pos` from authenticated user's POS
- [ ] Authentication required
- [ ] Proper error responses with spec error codes

**Tasks:**

1. Create `BookingController.java` at `@RequestMapping("/api/bookings")`
2. Create `BookingRequest.java` DTO
3. Create `BookingResponse.java` DTO
4. Wire `BookingService`
5. Extract company/pos from auth context

---

### US-8.5 — Implement Payment Confirmation

**As a** developer
**I want** a payment confirmation endpoint that transitions a ticket from PENDING to CONFIRMED
**So that** the payment completion step of the booking flow is handled

**Acceptance Criteria:**

- [ ] `POST /api/bookings/{ticketId}/confirm` — confirm payment
- [ ] Only PENDING tickets can be confirmed
- [ ] On confirmation:
  - `status = CONFIRMED`
  - `confirmedAt = now()`
  - `appliedPrice` and `currency` remain as-is (already snapshot)
- [ ] If ticket is not PENDING → return error
- [ ] If ticket is EXPIRED → return error (seats already released)

**Tasks:**

1. Add `confirmBooking(String ticketId)` to `BookingService`
2. Add endpoint to `BookingController`
3. Validate current status before transition
4. Unit test: confirm PENDING → CONFIRMED
5. Unit test: confirm EXPIRED → error
6. Unit test: confirm already CONFIRMED → error

---

### US-8.6 — Implement Ticket Cancellation

**As a** developer
**I want** a ticket cancellation endpoint that creates a refund record
**So that** CONFIRMED tickets can be cancelled per the ticket state machine

**Acceptance Criteria:**

- [ ] `POST /api/bookings/{ticketId}/cancel` — cancel a confirmed ticket
- [ ] Only CONFIRMED tickets can be cancelled
- [ ] On cancellation:
  - `ticket.status = CANCELLED`
  - `ticket.cancelledAt = now()`
  - Create `Refund` record with `status = REQUESTED`
  - Seat release does NOT happen yet (waits for refund APPROVED — see Sprint 9)
- [ ] If ticket is not CONFIRMED → return error

**Tasks:**

1. Add `cancelBooking(String ticketId)` to `BookingService`
2. Create refund record in the same operation
3. Add endpoint to `BookingController`
4. Unit test: cancel CONFIRMED → CANCELLED + refund created
5. Unit test: cancel PENDING → error
6. Unit test: cancel already CANCELLED → error

---

## Sprint 9 — Backend: Refund & Expiry Worker

### Goal

Implement the Refund entity, refund seat release logic, and the PENDING ticket expiry worker.

---

### US-9.1 — Implement Refund Entity

**As a** developer
**I want** the Refund MongoDB document to match TRIP_SPEC section 9
**So that** cancellation records are properly stored

**Acceptance Criteria:**

- [ ] `RefundType.java` has:
  - `id` (String, auto-generated)
  - `ticketId` (String)
  - `segmentsRefunded` (List<String>)
  - `amount` (BigDecimal)
  - `currency` (String)
  - `status` (RefundStatusEnum: REQUESTED, APPROVED, COMPLETED, REJECTED)
  - `createdAt` (Instant)
  - `processedAt` (Instant, nullable)
- [ ] `@Document("refunds")`
- [ ] Index on `ticketId`
- [ ] Index on `status`

**Tasks:**

1. Create `RefundType.java`
2. Create `RefundStatusEnum.java`
3. Create `RefundRepository.java`
4. Define indexes

---

### US-9.2 — Implement Refund Service

**As a** developer
**I want** a refund service with status transitions and seat release on APPROVED
**So that** refund processing follows TRIP_SPEC rules

**Acceptance Criteria:**

- [ ] Valid transitions:
  - `REQUESTED → APPROVED` → decrement `bookedSeats` on refunded segments
  - `REQUESTED → REJECTED` → no seat release
  - `APPROVED → COMPLETED` → no further seat action (already released)
- [ ] Seat release happens ONLY on `APPROVED` transition (not REQUESTED, not COMPLETED)
- [ ] Revenue reconciliation: `NetRevenue = SUM(tickets.appliedPrice) - SUM(refunds.amount WHERE status IN [APPROVED, COMPLETED])`
- [ ] `RefundService.approve(refundId)`:
  1. Validate current status = REQUESTED
  2. Set status = APPROVED
  3. Atomic decrement bookedSeats on each segment in `segmentsRefunded`
  4. Set `processedAt = now()`
- [ ] `RefundService.reject(refundId)`:
  1. Validate current status = REQUESTED
  2. Set status = REJECTED
- [ ] `RefundService.complete(refundId)`:
  1. Validate current status = APPROVED
  2. Set status = COMPLETED

**Tasks:**

1. Create `RefundService.java`
2. Implement `approve()` with atomic seat release
3. Implement `reject()`
4. Implement `complete()`
5. Create `RefundController.java` with endpoints
6. Unit test: approve → seats released
7. Unit test: reject → no seats released
8. Unit test: complete → no additional seat change
9. Unit test: approve already approved → error
10. Unit test: reject already approved → error

---

### US-9.3 — Implement Seat Hold Expiry Worker

**As a** developer
**I want** a scheduled worker that expires PENDING tickets past their hold time
**So that** held seats are released back to inventory automatically

**Acceptance Criteria:**

- [ ] Runs periodically (every 1 minute)
- [ ] Finds all tickets where `status = PENDING AND expiresAt < now()`
- [ ] For each expired ticket:
  1. Set `status = EXPIRED`
  2. For each `segmentId` in `ticket.segmentIds`:
     - Atomic decrement `bookedSeats` on the trip's segment
- [ ] Worker must be idempotent — safe to run multiple times on the same ticket
- [ ] Worker must not process tickets already set to EXPIRED
- [ ] Logging: log each expired ticket ID
- [ ] If no expired tickets found → skip silently

**Tasks:**

1. Create `SeatHoldExpiryWorker.java` with `@Scheduled(fixedRate = 60000)`
2. Query tickets with `status = PENDING and expiresAt < Instant.now()`
3. Transition each to EXPIRED
4. Release seats via `SeatReservationService.releaseSeats()`
5. Ensure idempotency (check status before transitioning)
6. Add logging
7. Unit test: expired PENDING ticket → EXPIRED + seats released
8. Unit test: non-expired PENDING ticket → unchanged
9. Unit test: already EXPIRED ticket → no action (idempotent)
10. Integration test: create PENDING ticket → wait past expiry → verify worker expires it

---

### US-9.4 — Implement Trip Cancellation Side Effects

**As a** developer
**I want** emergency trip cancellation to properly handle all existing tickets
**So that** ACTIVE → CANCELLED transitions are clean

**Acceptance Criteria:**

- [ ] When trip transitions `ACTIVE → CANCELLED`:
  1. All PENDING tickets → set to EXPIRED
     - Decrement bookedSeats on their segments
  2. All CONFIRMED tickets → set to CANCELLED
     - Create Refund records with `status = REQUESTED` for each
     - Refund amount = ticket's `appliedPrice`
     - Seats NOT released yet (waits for refund APPROVED)
- [ ] Operation must be atomic or at minimum idempotent
- [ ] Log all affected ticket IDs

**Tasks:**

1. Implement `TripCancellationHandler.java`
2. Implement PENDING ticket expiry batch
3. Implement CONFIRMED ticket cancellation batch with refund creation
4. Wire into `TripStatusMachine` transition hook
5. Unit test: cancel trip with 3 PENDING + 2 CONFIRMED tickets → 3 expired + 2 cancelled with refunds

---

## Sprint 10 — Frontend: Booking Flow & Seat Selection

### Goal

Implement the customer-facing booking flow and POS agent selling flow in the frontend.

---

### US-10.1 — Update Frontend Trip Search (Passenger App)

**As a** developer
**I want** the passenger-facing trip search to work with the new trip model
**So that** customers can find trips by stop locations and dates

**Acceptance Criteria:**

- [ ] Search by departure place (origin) and arrival place (destination)
- [ ] System finds all trips where:
  - A stop with `boardingAllowed=true` matches the origin place
  - A stop with `droppingAllowed=true` matches the destination place
  - Origin stop sequence < destination stop sequence
  - Trip status = ACTIVE
- [ ] Search results show:
  - Departure time (from origin stop)
  - Arrival time (at destination stop)
  - Price (express fare if available, else sum of segment base prices)
  - Available seats (MIN of `maxSeats - bookedSeats` across covered segments)
  - Bus info (from bus reference)
  - Company info (from target.company)
- [ ] Date filter
- [ ] Results sorted by departure time

**Tasks:**

1. Update `TripService` in frontend app (`apps/frontend`)
2. Update search params model
3. Update search card component
4. Update trip list/results component
5. Implement availability calculation display
6. Implement price display (express vs segment sum)

---

### US-10.2 — Implement Journey Selection

**As a** developer
**I want** the customer to select a journey and see pickup/dropoff options
**So that** the booking can proceed with complete information

**Acceptance Criteria:**

- [ ] After selecting a trip from results:
  - Show available pickup points at the origin stop (active only)
  - Show available dropoff points at the destination stop (active only)
  - Each point shows: address, scheduled time, location (if available)
- [ ] Customer must select exactly one pickup point and one dropoff point
- [ ] Show price breakdown:
  - If express fare available: express fare price + "saves X TND vs standard"
  - If no express fare: sum of segment base prices
- [ ] Show covered segments with departure/arrival times
- [ ] "Book Now" button → proceeds to passenger info

**Tasks:**

1. Create journey selection component (or step in booking flow)
2. Display pickup points for origin stop
3. Display dropoff points for destination stop
4. Implement price calculation and display
5. Implement segment chain visualization
6. Implement proceed-to-booking action

---

### US-10.3 — Implement Booking Confirmation

**As a** developer
**I want** the customer to provide passenger info and confirm the booking
**So that** a PENDING ticket is created

**Acceptance Criteria:**

- [ ] Passenger info form:
  - Existing customer lookup (by phone/email)
  - Or quick customer creation (name, phone, email)
- [ ] Booking summary:
  - Trip info (date, bus, route)
  - Pickup point (address, time)
  - Dropoff point (address, time)
  - Price
  - Seat hold time (countdown shown)
- [ ] "Confirm Booking" button → calls `POST /api/bookings`
- [ ] Generates `idempotencyKey` (UUID) on client side
- [ ] On success:
  - Show ticket with PENDING status
  - Show expiry countdown
  - Show "Proceed to Payment" button
- [ ] On error:
  - `SEGMENT_CAPACITY_EXCEEDED` → "No seats available, please try another trip"
  - Other errors → translated messages
- [ ] Double-submit prevention (idempotencyKey returns same ticket)

**Tasks:**

1. Create booking confirmation component
2. Implement passenger lookup/creation form
3. Implement booking summary display
4. Implement idempotency key generation
5. Implement booking API call
6. Implement success state with ticket display
7. Implement error handling with translated error codes
8. Implement expiry countdown timer

---

### US-10.4 — POS Agent Selling Flow (Terminal App)

**As a** POS agent
**I want** a streamlined ticket selling interface
**So that** I can sell tickets quickly at the counter

**Acceptance Criteria:**

- [ ] Quick trip search (departure place, arrival place, date)
- [ ] Results show available trips with pricing
- [ ] Select trip → show pickup/dropoff options
- [ ] Customer lookup or quick create
- [ ] Create booking (POST /api/bookings)
  - `target.pos` from POS agent's assigned POS
- [ ] For cash payment: immediately confirm (mark paid)
- [ ] For card payment: proceed to payment flow
- [ ] Print ticket action after confirmation
- [ ] Resend ticket action (email)
- [ ] POS dashboard shows today's tickets

**Tasks:**

1. Build POS sell ticket flow in terminal app
2. Implement quick trip search
3. Implement inline customer lookup/create
4. Implement booking creation with POS attribution
5. Implement cash sale (immediate confirm)
6. Implement ticket print action
7. Implement ticket resend action
8. Update POS dashboard with today's tickets

---

### US-10.5 — Ticket List Views

**As a** user (admin or POS agent)
**I want** ticket list views filtered by status
**So that** I can manage tickets operationally

**Acceptance Criteria:**

- [ ] **Admin view** (`/tickets`):
  - Company-scoped (all POS tickets)
  - Filters: status, date range, POS, search by ticket ID / passenger
  - Columns: ticket ID, trip (route + date), passenger, price, status, POS, created
- [ ] **POS Agent view** (`/pos/tickets` or dashboard section):
  - POS-scoped (only tickets from this POS)
  - Filters: status, date range
  - Focus on: today's tickets, unpaid (PENDING), recently confirmed
  - Actions: mark paid, print, resend
- [ ] Pagination
- [ ] i18n for all labels

**Tasks:**

1. Create admin ticket list component
2. Create POS ticket list component (or filtered view)
3. Implement filters
4. Implement pagination
5. Implement row actions (mark paid, print, resend)
6. Add i18n keys

---

## Appendix A — Error Code Registry

| Code                                             | Sprint | Trigger                                                |
| ------------------------------------------------ | ------ | ------------------------------------------------------ |
| `INVALID_STOP_SEQUENCE`                          | 1      | sequence not strictly ascending or duplicate           |
| `INVALID_TIMELINE`                               | 1      | Stop timestamps not strictly increasing                |
| `SEGMENT_CAPACITY_EXCEEDED`                      | 8      | CAS update returned 0 rows — no seats available        |
| `TICKET_IDEMPOTENCY_REPLAY`                      | 8      | Booking request replayed — existing ticket returned    |
| `INVALID_EXPRESS_FARE_CHAIN`                     | 2      | segmentsCovered does not form a continuous chain       |
| `MAX_SEATS_BELOW_BOOKED`                         | 2      | Attempt to set maxSeats below current bookedSeats      |
| `MISSING_PICKUP_POINT`                           | 3      | Boarding stop has no pickup point defined              |
| `MISSING_DROPOFF_POINT`                          | 3      | Dropping stop has no dropoff point defined             |
| `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`        | 2      | Removing a stop that breaks an express fare chain      |
| `BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY` | 4      | New bus totalSeats < MAX(bookedSeats)                  |
| `BUS_LOCKED_BY_ACTIVE_TRIP`                      | 4      | Bus totalSeats change blocked by SCHEDULED/ACTIVE trip |

---

## Appendix B — API Endpoint Registry

| Method   | Path                                            | Sprint | Description                       |
| -------- | ----------------------------------------------- | ------ | --------------------------------- |
| `POST`   | `/api/trips`                                    | 3      | Create trip                       |
| `GET`    | `/api/trips`                                    | 3      | List trips (company-scoped)       |
| `GET`    | `/api/trips/{tripId}`                           | 3      | Get trip by ID                    |
| `PUT`    | `/api/trips/{tripId}`                           | 4      | Update trip (edit rules enforced) |
| `DELETE` | `/api/trips/{tripId}`                           | 3      | Delete trip (SCHEDULED only)      |
| `PATCH`  | `/api/trips/{tripId}/status`                    | 4      | Update trip status                |
| `POST`   | `/api/trips/{tripId}/express-fares`             | 4      | Add express fare                  |
| `PUT`    | `/api/trips/{tripId}/express-fares/{expressId}` | 4      | Update express fare               |
| `DELETE` | `/api/trips/{tripId}/express-fares/{expressId}` | 4      | Delete/deactivate express fare    |
| `POST`   | `/api/trips/{tripId}/pickup-points`             | 4      | Add pickup point                  |
| `PUT`    | `/api/trips/{tripId}/pickup-points/{pointId}`   | 4      | Update pickup point               |
| `POST`   | `/api/trips/{tripId}/dropoff-points`            | 4      | Add dropoff point                 |
| `PUT`    | `/api/trips/{tripId}/dropoff-points/{pointId}`  | 4      | Update dropoff point              |
| `POST`   | `/api/bookings`                                 | 8      | Create booking                    |
| `POST`   | `/api/bookings/{ticketId}/confirm`              | 8      | Confirm payment                   |
| `POST`   | `/api/bookings/{ticketId}/cancel`               | 8      | Cancel ticket                     |
| `GET`    | `/api/tickets`                                  | 10     | List tickets (company/POS scoped) |
| `PATCH`  | `/api/refunds/{refundId}/approve`               | 9      | Approve refund                    |
| `PATCH`  | `/api/refunds/{refundId}/reject`                | 9      | Reject refund                     |
| `PATCH`  | `/api/refunds/{refundId}/complete`              | 9      | Complete refund                   |

---

## Appendix C — File Creation Checklist

### Backend Files

| File Path (relative to `apps/backend/src/main/java/com/eticketing/app/`) | Sprint | Action              |
| ------------------------------------------------------------------------ | ------ | ------------------- |
| `trip/TripType.java`                                                     | 1      | Rewrite             |
| `trip/StopType.java`                                                     | 1      | Rewrite             |
| `trip/TripBusRef.java`                                                   | 1      | Create              |
| `trip/TripStatusEnum.java`                                               | 1      | Update (add ACTIVE) |
| `trip/SeatUnit.java`                                                     | 1      | Delete              |
| `trip/SeatStateEnum.java`                                                | 1      | Delete              |
| `trip/SegmentType.java`                                                  | 2      | Create              |
| `trip/ExpressFareType.java`                                              | 2      | Create              |
| `trip/SegmentGenerator.java`                                             | 2      | Create              |
| `trip/ExpressFareValidator.java`                                         | 2      | Create              |
| `trip/StopValidator.java`                                                | 1      | Create              |
| `trip/PickupPointType.java`                                              | 3      | Create              |
| `trip/DropoffPointType.java`                                             | 3      | Create              |
| `trip/GeoLocation.java`                                                  | 3      | Create              |
| `trip/PickupDropoffValidator.java`                                       | 3      | Create              |
| `trip/TripTypeRepository.java`                                           | 3      | Rewrite             |
| `trip/TripService.java`                                                  | 3      | Create              |
| `trip/TripController.java`                                               | 3      | Rewrite             |
| `trip/TripCreateRequest.java`                                            | 3      | Create              |
| `trip/TripUpdateRequest.java`                                            | 3      | Create              |
| `trip/TripResponse.java`                                                 | 3      | Create              |
| `trip/TripListResponse.java`                                             | 3      | Create              |
| `trip/TripStatusMachine.java`                                            | 4      | Create              |
| `trip/TripEditRules.java`                                                | 4      | Create              |
| `trip/ExpressFareRequest.java`                                           | 4      | Create              |
| `trip/PickupPointRequest.java`                                           | 4      | Create              |
| `trip/DropoffPointRequest.java`                                          | 4      | Create              |
| `ticket/TicketType.java`                                                 | 8      | Rewrite             |
| `ticket/TicketTarget.java`                                               | 8      | Create              |
| `ticket/TicketStatusEnum.java`                                           | 8      | Update              |
| `ticket/TicketRepository.java`                                           | 8      | Rewrite             |
| `booking/BookingService.java`                                            | 8      | Create              |
| `booking/BookingController.java`                                         | 8      | Create              |
| `booking/BookingRequest.java`                                            | 8      | Create              |
| `booking/BookingResponse.java`                                           | 8      | Create              |
| `booking/SeatReservationService.java`                                    | 8      | Create              |
| `refund/RefundType.java`                                                 | 9      | Create              |
| `refund/RefundStatusEnum.java`                                           | 9      | Create              |
| `refund/RefundRepository.java`                                           | 9      | Create              |
| `refund/RefundService.java`                                              | 9      | Create              |
| `refund/RefundController.java`                                           | 9      | Create              |
| `booking/SeatHoldExpiryWorker.java`                                      | 9      | Create              |
| `trip/TripCancellationHandler.java`                                      | 9      | Create              |

### Frontend Files (Terminal App)

| File Path (relative to `apps/terminal/src/app/`) | Sprint | Action  |
| ------------------------------------------------ | ------ | ------- |
| `core/models/trip.model.ts`                      | 5      | Rewrite |
| `core/models/trip-filter-input.model.ts`         | 5      | Rewrite |
| `pages/trip/trip.service.ts`                     | 5      | Rewrite |
| `pages/trip/trip.resolver.ts`                    | 5      | Create  |
| `pages/trip/trip.routes.ts`                      | 7      | Rewrite |
| `pages/trip/trip-create.component.ts`            | 6      | Create  |
| `pages/trip/trip-create.component.html`          | 6      | Create  |
| `pages/trip/trip-create.component.scss`          | 6      | Create  |
| `pages/trip/trip-list.component.ts`              | 7      | Rewrite |
| `pages/trip/trip-list.component.html`            | 7      | Rewrite |
| `pages/trip/trip-list.component.scss`            | 7      | Rewrite |
| `pages/trip/trip-detail.component.ts`            | 7      | Create  |
| `pages/trip/trip-detail.component.html`          | 7      | Create  |
| `pages/trip/trip-detail.component.scss`          | 7      | Create  |

### Frontend Files (Passenger App)

| File Path (relative to `apps/frontend/src/app/`)         | Sprint | Action  |
| -------------------------------------------------------- | ------ | ------- |
| `core/models/trip.model.ts`                              | 10     | Rewrite |
| `modules/pages/bus/trip.service.ts`                      | 10     | Rewrite |
| `modules/pages/bus/trip.resolver.ts`                     | 10     | Update  |
| `modules/pages/bus/list/` (trip results)                 | 10     | Update  |
| `modules/pages/bus/details/` (trip details / booking)    | 10     | Update  |
| `shared/components/search-card/search-card.component.ts` | 10     | Update  |
| `core/services/seat.service.ts`                          | 10     | Rewrite |

### i18n Files

| File Path                                  | Sprint | Action |
| ------------------------------------------ | ------ | ------ |
| `apps/terminal/src/assets/i18n/en-gb.json` | 7      | Update |
| `apps/terminal/src/assets/i18n/fr-fr.json` | 7      | Update |
| `apps/frontend/src/assets/i18n/en-gb.json` | 10     | Update |
| `apps/frontend/src/assets/i18n/fr-fr.json` | 10     | Update |

---

## Appendix D — Dependencies Between Sprints

```
Sprint 1 (Entity + Stops)
    ↓
Sprint 2 (Segments + Express Fares)
    ↓
Sprint 3 (Pickup/Dropoff + CRUD API)
    ↓
Sprint 4 (Status Machine + Edit Rules)
    ↓
Sprint 5 (Frontend Models + Service) ──→ Sprint 6 (Create Form) ──→ Sprint 7 (List + Detail + Edit)
    ↓
Sprint 8 (Ticket + Booking Engine)
    ↓
Sprint 9 (Refund + Expiry Worker)
    ↓
Sprint 10 (Frontend Booking Flow)
```

- Sprints 1–4 are sequential (backend foundation)
- Sprint 5 depends on Sprint 4 (needs final backend API shape)
- Sprints 6 and 7 depend on Sprint 5 (frontend models/service)
- Sprint 8 depends on Sprint 4 (needs trip CRUD working)
- Sprint 9 depends on Sprint 8 (needs ticket entity)
- Sprint 10 depends on Sprints 7 + 9 (needs both frontend and booking backend)

---

**END OF SPRINT PLAN**
