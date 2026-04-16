# Ticket Business Model - Copilot Agent Specification

> Attach this file to VS Code Copilot before generating any code related to tickets, bookings, ticket lists, ticket detail modals, payment confirmation, cancellation, refunds, ticket documents, or ticket delivery.
> This is the single source of truth for ticket behavior. Do not deviate from these definitions.

---

## 1. Core Principles

1. **Ticket is an immutable financial snapshot** - never mutate `appliedPrice`, `currency`, `segmentIds`, or original attribution after creation
2. **Company is mandatory ownership** - every ticket belongs to exactly one company
3. **POS is operational attribution** - `target.pos` captures where the sale or reservation originated when a POS context exists
4. **Original POS attribution is immutable** - later payment at another POS must not overwrite `target.pos`
5. **Standard flow is reserve first, confirm second** - create `PENDING`, then transition to `CONFIRMED` after payment success
6. **Exactly-once booking is mandatory** - every booking request requires `idempotencyKey`
7. **Refund is a separate entity** - cancellation and refund logic must not rewrite ticket money fields
8. **Backend validates ownership context** - company ownership must be derived from trip and authenticated scope, not blindly trusted from raw client input

---

## 1.1 Relationship To Other Specs

This document is ticket-specific.

- `TRIP_SPEC.md` owns trip, stop, segment, express fare, CAS reservation, and expiry rules
- `POS_AGENT.md` owns POS ticket operations, permissions, and cross-POS payment workflow
- This file owns ticket data shape, attribution, lifecycle, query model, and ticket-facing API/UI contracts

If another document conflicts with this one on ticket behavior, this file wins for ticket rules and `TRIP_SPEC.md` wins for trip and inventory rules.

---

## 2. Marketplace Attribution Model

The platform uses a company + POS model.

- `company` is the business ownership boundary
- `pos` is the operational source boundary inside the company

Ticket attribution rules:

- `target.company` is mandatory on every ticket
- `target.pos` is required for POS-originated reservations or sales
- `target.pos` may be `null` for company-level or online flows where no POS exists
- payment completion by another POS in the same company must not overwrite original `target.pos`
- cross-company ticket operations are forbidden

Operational meaning:

- company answers: which business owns this ticket
- POS answers: where the reservation or sale originated
- authenticated actor answers: who performed the current action

For V1, the minimum persisted operational attribution on the ticket is `target.company` and optional `target.pos`. Additional actor/event attribution may be logged separately later.

---

## 3. Ticket Object - Full Schema

```typescript
interface Ticket {
  // Layer 1 - Identity
  ticketId: string; // system-generated
  tripId: string; // reference to trip

  // Layer 2 - Ownership and operational attribution
  target: {
    company: string; // mandatory - owning company of the trip
    pos?: string | null; // original POS attribution if the ticket originated from a POS
  };

  // Layer 3 - Journey snapshot
  segmentIds: string[]; // ordered segment ids covered by this ticket
  expressId?: string | null; // set only if express fare was applied
  pickupPointId: string; // mandatory boarding point snapshot
  dropoffPointId: string; // mandatory dropoff point snapshot
  passengerId: string; // user/customer reference

  // Layer 4 - Financial snapshot
  appliedPrice: number; // snapshot at booking time - NEVER changes
  currency: string; // snapshot of trip currency at booking time - NEVER changes

  // Layer 5 - Lifecycle
  status: TicketStatus;
  idempotencyKey: string; // exactly-once booking key
  expiresAt: string; // UTC - meaningful while PENDING
  createdAt: string; // UTC
  confirmedAt?: string | null; // UTC
  cancelledAt?: string | null; // UTC
}
```

Notes:

- `ticketId` is the domain identifier; implementation may serialize it as `id`
- `segmentIds`, `pickupPointId`, and `dropoffPointId` are snapshots and must remain stable after creation
- `expressId` is optional because many tickets will price from summed segment base prices

---

## 4. Enums

```typescript
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

## 5. Booking API Contracts

The ticket module exposes two kinds of contracts:

- write contracts for booking and state transitions
- read contracts for ticket list/detail/document views

### 5.1 Booking Request

```typescript
interface BookingRequest {
  tripId: string;
  fromPlaceId: string;
  toPlaceId: string;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId: string;
  idempotencyKey: string;
}
```

Rules:

- client must not send `companyId` as ticket ownership input in the request body
- backend derives company ownership from the trip and authenticated scope
- client may send active company/POS context in headers for scoping, but backend must validate it

### 5.2 Booking Response

```typescript
interface BookingResponse {
  ticketId: string;
  tripId: string;
  companyId: string;
  posId?: string | null;
  segmentIds: string[];
  expressId?: string | null;
  pickupPointId: string;
  dropoffPointId: string;
  passengerId: string;
  appliedPrice: number;
  currency: string;
  status: TicketStatus;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
}
```

Rules:

- read responses may flatten `target.company` and `target.pos` as `companyId` and `posId`
- flattening is for API convenience only; the source of truth remains ticket `target`

### 5.3 Ticket Read Model

Ticket list and detail views may enrich the raw ticket with related read-only data.

```typescript
interface TicketReadModel extends BookingResponse {
  passengerName?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  pickupCity?: string | null;
  dropoffCity?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  tripDepartureDate?: string | null;
  tripStatus?: string | null;
}
```

These are projection fields only. They must not be written back into the ticket document.

---

## 6. Ticket State Machine

```text
PENDING   -> CONFIRMED  (payment success)
PENDING   -> EXPIRED    (seat-hold timeout, failed payment, or manual cancellation)
CONFIRMED -> CANCELLED  (cancellation accepted, Refund created)
EXPIRED   -> terminal
CANCELLED -> terminal
```

State transition rules:

- `PENDING -> CONFIRMED` sets `confirmedAt`
- `PENDING -> EXPIRED` does not change pricing fields and releases seats through the expiry path
- Manual cancel on a `PENDING` ticket uses the same expiry path: status becomes `EXPIRED` and seats are released immediately
- `CONFIRMED -> CANCELLED` sets `cancelledAt` and creates a `Refund` with status `REQUESTED`
- `EXPIRED -> CONFIRMED` is forbidden
- `CANCELLED -> CONFIRMED` is forbidden
- `CONFIRMED -> PENDING` is forbidden

Tickets are immutable financial records. Status timestamps may change through valid transitions; ownership, journey, and money fields may not.

---

## 7. Ticket Creation And Confirmation Flow

### 7.1 Canonical Booking Flow

```text
1. Resolve journey from fromPlaceId -> toPlaceId
2. Validate pickupPointId and dropoffPointId
3. Resolve segment chain or matching express fare
4. Reserve seats atomically across all segments
5. Create PENDING ticket with target { company, pos }
6. If DB write fails, rollback seat reservation
7. On payment success, transition ticket to CONFIRMED
8. On timeout or failed payment, transition ticket to EXPIRED and release seats
9. Replay by idempotencyKey returns existing ticket
```

### 7.2 Ownership Resolution Rules

Backend ownership resolution must follow this priority:

1. derive `target.company` from the selected trip's owning company
2. validate that the authenticated session is allowed to operate in that company
3. use active POS context only for `target.pos`

Forbidden behavior:

- trusting arbitrary client body input for `target.company`
- creating a ticket without a company
- accepting a POS from another company

### 7.3 POS Reservation And Mark-Paid Rule

Per `POS_AGENT.md`:

- a POS agent can reserve or sell a ticket in their assigned company/POS scope
- a POS agent can mark as paid a ticket originally reserved at another POS in the same company
- later payment completion must not overwrite the ticket's original `target.pos`

This means the system must distinguish between:

- origin attribution of the ticket
- actor attribution of the payment completion action

For V1, the ticket keeps original `target.pos`; richer event attribution may be added later.

### 7.4 Immediate Counter Sale UX

The UI may present a fast counter-sale flow, but the logical backend sequence is still:

1. create `PENDING`
2. capture payment
3. transition to `CONFIRMED`

The UI may collapse these steps visually, but the backend model must preserve the state machine.

---

## 8. Query And Access Model

### 8.1 Query Scoping Rules

- all ticket ownership queries must filter by `target.company`
- POS operational views should filter by `target.company` and `target.pos`
- query by POS alone is insufficient in a multi-tenant system
- passenger self-service views may additionally allow `passengerId` ownership checks

### 8.2 Access Rules

- passenger can view their own ticket
- company staff can view tickets in their company scope
- POS agent can view tickets relevant to their assigned operational scope
- POS agent can confirm payment for same-company tickets when permitted
- cross-company access must return access denied

### 8.3 Recommended Read Endpoints

```text
GET /api/tickets/{ticketId}
GET /api/tickets/by-company/{companyId}
GET /api/tickets/by-pos/{posId}
GET /api/tickets/{ticketId}/document
POST /api/tickets/{ticketId}/send-email
```

Write endpoints:

```text
POST /api/bookings
POST /api/bookings/{ticketId}/confirm
POST /api/bookings/{ticketId}/cancel
```

---

## 9. Refund Relationship

```typescript
interface Refund {
  refundId: string;
  ticketId: string;
  segmentsRefunded: string[];
  amount: number;
  currency: string;
  status: RefundStatus;
  createdAt: string;
  processedAt?: string | null;
}
```

Refund rules:

- cancelling a confirmed ticket creates a `Refund` with status `REQUESTED`
- seat release happens only when refund transitions `REQUESTED -> APPROVED`
- `APPROVED -> COMPLETED` performs no additional seat action
- `REQUESTED -> REJECTED` performs no seat release
- the original ticket remains the immutable financial reference even after refund activity exists

Revenue logic:

```text
NetRevenue = SUM(Tickets.appliedPrice) - SUM(Refunds.amount where status in APPROVED, COMPLETED)
```

---

## 10. Expiry Behavior

Pending tickets are temporary seat holds.

```text
FOR EACH ticket WHERE status = PENDING AND expiresAt < now():
    ticket.status = EXPIRED
    release seats for ticket.segmentIds
```

Expiry rules:

- expiry worker must be idempotent
- expired tickets must not continue to hold segment capacity
- expiry must not rewrite money fields or attribution fields

---

## 11. Ticket Document And Delivery

Ticket delivery is a read/export concern built on top of the immutable ticket.

Supported capabilities:

- build ticket document view
- resend ticket by email
- display enriched ticket details in UI

Rules:

- document generation must read from ticket + related trip/passenger/place data
- document generation must not mutate the ticket
- email resend must validate that a recipient email exists or fail cleanly

---

## 12. UI Requirements

### 12.1 Sell Ticket Flow

The sell-ticket screen must support:

1. customer lookup within company scope
2. trip selection from bookable company trips
3. pickup and dropoff point selection
4. price review
5. booking creation with idempotency key
6. success state with ticket reference and status

### 12.2 Tickets List

The tickets list must support:

- company-scoped listing by default
- optional status filter
- ticket row actions for allowed transitions
- clear empty state when no tickets exist in the active scope
- enriched display of route, passenger, amount, and timestamps when available

### 12.3 Ticket Detail Modal

The ticket detail modal should display at minimum:

- ticket reference
- trip reference and route summary
- company attribution
- POS attribution if present
- passenger identity
- pickup and dropoff snapshot
- applied price and currency
- current status
- created, confirmed, cancelled, and expiry timestamps when applicable

The modal is read-only for immutable fields.

### 12.4 Action Buttons

Allowed actions depend on state and permission:

- `PENDING`: confirm, optionally cancel (implemented as immediate expiry plus seat release), view details, resend if allowed
- `CONFIRMED`: cancel, view details, resend
- `EXPIRED`: view details, resend only if business allows
- `CANCELLED`: view details, refund visibility if present

Actions must never expose raw backend stack traces or raw database errors to the user.

---

## 13. Error Codes

| Code                        | Trigger                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `SEGMENT_CAPACITY_EXCEEDED` | one or more segments have no remaining seats                 |
| `TICKET_IDEMPOTENCY_REPLAY` | booking request reused an existing idempotency key           |
| `TICKET_EXPIRED`            | attempt to confirm an expired ticket                         |
| `INVALID_TICKET_TRANSITION` | action is not allowed from current ticket status             |
| `COMPANY_MISSING`           | backend cannot resolve company ownership for ticket creation |
| `TICKET_NOT_FOUND`          | requested ticket does not exist                              |
| `REFUND_NOT_FOUND`          | requested refund does not exist                              |
| `INVALID_REFUND_TRANSITION` | refund state change is not allowed                           |
| `ACCESS_DENIED`             | actor is outside the allowed company or passenger scope      |
| `NO_EMAIL_AVAILABLE`        | resend requested but no recipient email can be resolved      |

---

## 14. Canonical JSON Example

```json
{
  "ticketId": "TKT_2026_04_15_0001",
  "tripId": "TRIP_2026_04_15_DJE_TUN_01",
  "target": {
    "company": "cmp_01",
    "pos": "pos_03"
  },
  "segmentIds": ["SEG_DJE_SFX", "SEG_SFX_SOU", "SEG_SOU_TUN"],
  "expressId": "EXP_DJE_TUN",
  "pickupPointId": "PP_DJE_01",
  "dropoffPointId": "DP_TUN_01",
  "passengerId": "usr_passenger_01",
  "appliedPrice": 55,
  "currency": "TND",
  "status": "PENDING",
  "idempotencyKey": "6cf9ccf1-9d83-4e5d-bac2-0efc2d9ef222",
  "expiresAt": "2026-04-15T12:20:00Z",
  "createdAt": "2026-04-15T12:10:00Z",
  "confirmedAt": null,
  "cancelledAt": null
}
```

Example company-level ticket with no POS attribution:

```json
{
  "ticketId": "TKT_2026_04_15_0002",
  "tripId": "TRIP_2026_04_15_DJE_TUN_02",
  "target": {
    "company": "cmp_01",
    "pos": null
  },
  "segmentIds": ["SEG_DJE_SFX"],
  "pickupPointId": "PP_DJE_01",
  "dropoffPointId": "DP_SFX_01",
  "passengerId": "usr_passenger_02",
  "appliedPrice": 25,
  "currency": "TND",
  "status": "CONFIRMED",
  "idempotencyKey": "aa94d0fe-0fb7-4f95-9429-a77252ce4c11",
  "expiresAt": "2026-04-15T13:30:00Z",
  "createdAt": "2026-04-15T13:20:00Z",
  "confirmedAt": "2026-04-15T13:21:00Z",
  "cancelledAt": null
}
```

---

## 15. What Copilot Should Never Do

- Overwrite `target.pos` when payment is completed at another POS in the same company
- Create a ticket without `target.company`
- Trust arbitrary request body ownership fields for ticket creation
- Mutate `appliedPrice`, `currency`, `segmentIds`, `pickupPointId`, or `dropoffPointId` after creation
- Query operational ticket work without company scoping
- Query POS ticket work by `target.pos` alone without validating company ownership
- Confirm an `EXPIRED` or `CANCELLED` ticket
- Cancel a ticket by editing money fields instead of creating refund records
- Release seats on refund `REQUESTED`; release happens on refund `APPROVED`
- Return raw database or backend exception text directly to end users
- Treat enriched UI projection fields as persistent ticket fields

---

## 16. Shared Models Pattern

- One shared file: `src/app/core/models/shared.model.ts`
- Any type reused across ticket, booking, refund, or delivery features belongs in shared models
- Never redeclare shared types inside multiple entity model files
- Use entity-specific files only for entity-specific fields and read models
