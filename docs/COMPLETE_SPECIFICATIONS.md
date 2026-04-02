# Bus Booking Platform - Complete Development Specifications

**Version:** 1.0 - Production Ready
**Last Updated:** March 2026
**Status:** Ready for Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Model](#2-business-model)
3. [Multi-Tenant Architecture](#3-multi-tenant-architecture)
4. [Complete Entity Specifications](#4-complete-entity-specifications)
5. [Trip Business Model](#5-trip-business-model)
6. [Payment & Settlement Architecture](#6-payment--settlement-architecture)
7. [Real-Time Inventory System](#7-real-time-inventory-system)
8. [Frontend Patterns](#8-frontend-patterns)
9. [Backend Patterns](#9-backend-patterns)
10. [Development Roadmap](#10-development-roadmap)

---

## 1. Executive Summary

### What You're Building

A **SaaS marketplace platform** for bus transportation companies in Tunisia. You provide software infrastructure for operators to manage fleets, create trips, and sell tickets—both online and at physical POS locations.

### Business Identity

- ✅ **Marketplace platform** (like Omio/12Go for Tunisia)
- ✅ **Transaction-fee based** revenue model (5% per ticket)
- ✅ **First mover** in Tunisian online bus booking
- ❌ NOT a bus operator
- ❌ NOT white-label software

### Key Metrics

- **Solo founder** (technical background)
- **Budget:** ~$10,000 for MVP
- **Timeline:** 6-8 weeks to MVP with AI assistance
- **Target:** Paying customers within 3 months
- **Market:** Small-medium bus operators (5-50 buses each)

### Tech Stack

| Layer        | Technology      | Key Libraries                     |
| ------------ | --------------- | --------------------------------- |
| **Frontend** | Angular 19+     | RxJS, lodash, date-fns            |
| **Backend**  | Spring Boot 3.x | Lombok, MapStruct, Apache Commons |
| **Database** | PostgreSQL      | JPA, Hibernate                    |
| **Payment**  | SMT/ClickToPay  | Merchant-of-record model          |

---

## 2. Business Model

### 2.1 Revenue Model

**Merchant-of-Record (Reseller Model):**

```
Legal Structure:
- Platform PURCHASES ticket inventory from operators at wholesale (95%)
- Platform SELLS to customers at retail (100%)
- Platform KEEPS margin (5%)

Example:
Customer pays: 60 TND
Operator receives: 57 TND (95%)
Platform keeps: 3 TND (5%)
```

**Why this model:**

- ✅ Legal in Tunisia (no payment institution license needed)
- ✅ Banks approve SMT merchant accounts
- ✅ Clean accounting (buy/resell, not intermediation)
- ✅ Platform owns customer relationship

### 2.2 Payment Flow

**Online Payments (via SMT/ClickToPay):**

```
Customer → SMT Payment Gateway → Platform Bank Account
         ↓
Platform records:
  - appliedPrice: 60 TND
  - platformFee: 3 TND (you keep)
  - operatorRevenue: 57 TND (you owe operator)
         ↓
Weekly Settlement:
Platform → Bank Transfer → Operator Bank Account
```

**Cash Payments (at POS):**

```
Customer → Cash → Operator (directly)
         ↓
POS Agent marks ticket as sold in system
         ↓
Monthly Invoice:
Operator owes platform 5% commission
```

### 2.3 User Roles

| Role               | Access Scope     | Permissions                                           |
| ------------------ | ---------------- | ----------------------------------------------------- |
| **PLATFORM_ADMIN** | All companies    | Create companies, view all revenue, platform settings |
| **COMPANY_ADMIN**  | Own company only | Manage buses, create trips, view company revenue      |
| **POS_AGENT**      | Own POS only     | Sell tickets, view POS sales                          |

---

## 3. Multi-Tenant Architecture

### 3.1 Scoping Model

Every entity is scoped to `target: { company, pos }`

| Entity     | Target Structure   | Meaning                                                           |
| ---------- | ------------------ | ----------------------------------------------------------------- |
| **Bus**    | `{ company }`      | Which operator owns this bus                                      |
| **Trip**   | `{ company }`      | Which operator sells this trip                                    |
| **Ticket** | `{ company, pos }` | Which company's trip, which POS sold it (for commission tracking) |

### 3.2 Data Isolation

**Query Pattern (ALWAYS use):**

```java
// Backend - always filter by company
public List<Trip> listTrips(String companyId) {
    return tripRepository.findByTargetCompany(companyId);
}

// Frontend - inject from auth context
this.authService.getCurrentUser().target.company
```

**NEVER:**

- ❌ Query without company filter
- ❌ Pass `posId` from localStorage
- ❌ Allow cross-company data access

---

## 4. Complete Entity Specifications

### 4.1 Company Entity

**Purpose:** Represents a bus operator (e.g., TransTun, RapidBus)

```java
@Entity
@Table(name = "companies")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Company {

    @Id
    private String companyId;  // UUID, auto-generated

    @Column(nullable = false)
    @NotBlank
    private String name;  // Display name (e.g., "TransTun")

    @Column(nullable = false)
    @NotBlank
    private String legalName;  // Legal business name

    @Column(unique = true, nullable = false)
    @NotBlank
    private String taxId;  // Matricule Fiscale (Tunisian tax ID)

    private String logo;  // URL to logo image

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CompanyStatus status = CompanyStatus.ACTIVE;

    @Column(precision = 5, scale = 2, nullable = false)
    @DecimalMin("0.0")
    @DecimalMax("20.0")
    private BigDecimal platformFeePercentage = BigDecimal.valueOf(5.0);

    @Embedded
    private BankAccount bankAccount;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        companyId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

@Embeddable
@Data
class BankAccount {
    private String iban;
    private String bankName;
    private String accountHolder;
}

enum CompanyStatus {
    ACTIVE,      // Operating normally
    SUSPENDED    // Temporarily disabled
}
```

**Validation Rules:**

- `name`: NotBlank, max 200 characters
- `legalName`: NotBlank, max 300 characters
- `taxId`: NotBlank, unique, format validation (Tunisian tax ID pattern)
- `platformFeePercentage`: Min 0, Max 20
- `bankAccount.iban`: Required when status = ACTIVE

**Business Rules:**

- Company cannot be deleted if it has active trips
- Suspended companies cannot create new trips
- Platform fee can be customized per company (default 5%)

---

### 4.2 POS Entity

**Purpose:** Represents a physical sales location for a bus operator

```java
@Entity
@Table(name = "pos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class POS {

    @Id
    private String posId;  // UUID, auto-generated

    @Column(nullable = false)
    private String companyId;  // Foreign key to Company

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "companyId", insertable = false, updatable = false)
    private Company company;

    @Column(nullable = false)
    @NotBlank
    private String name;  // e.g., "Tunis Central Office"

    @Column(nullable = false)
    @NotBlank
    private String address;  // Physical address

    @Embedded
    private Location location;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        posId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

@Embeddable
@Data
class Location {
    private Double latitude;
    private Double longitude;
}
```

**Business Rules:**

- POS cannot be created without valid companyId
- Deactivating POS does not affect existing tickets sold by that POS
- Each company can have unlimited POS locations
- POS name must be unique within a company

---

### 4.3 User Entity

**Purpose:** Platform users with role-based multi-tenant access

```java
@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String userId;  // UUID

    @Column(unique = true, nullable = false)
    @Email
    @NotBlank
    private String email;

    @Column(nullable = false)
    private String passwordHash;  // BCrypt hashed

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Embedded
    @Valid
    @ValidUserTarget  // Custom validator
    private Target target;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        userId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

@Embeddable
@Data
class Target {
    private String company;  // Nullable for PLATFORM_ADMIN
    private String pos;      // Nullable for COMPANY_ADMIN and PLATFORM_ADMIN
}

enum UserRole {
    PLATFORM_ADMIN,   // Full platform access
    COMPANY_ADMIN,    // Company-scoped access
    POS_AGENT         // POS-scoped access
}
```

**Custom Validator:**

```java
@Constraint(validatedBy = UserTargetValidator.class)
@Target({ ElementType.FIELD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidUserTarget {
    String message() default "Invalid user target configuration for role";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class UserTargetValidator
    implements ConstraintValidator<ValidUserTarget, Target> {

    @Override
    public boolean isValid(Target target, ConstraintValidatorContext context) {
        if (target == null) return false;

        // Get user role from parent entity (context-dependent implementation)
        UserRole role = getCurrentUserRole(context);

        switch (role) {
            case PLATFORM_ADMIN:
                // Both must be null
                return target.getCompany() == null && target.getPos() == null;

            case COMPANY_ADMIN:
                // Company must be set, POS must be null
                return StringUtils.isNotBlank(target.getCompany())
                    && target.getPos() == null;

            case POS_AGENT:
                // Both must be set
                return StringUtils.isNotBlank(target.getCompany())
                    && StringUtils.isNotBlank(target.getPos());

            default:
                return false;
        }
    }
}
```

**Target Validation Matrix:**

| Role           | Company | POS  | Valid? |
| -------------- | ------- | ---- | ------ |
| PLATFORM_ADMIN | null    | null | ✅     |
| PLATFORM_ADMIN | set     | null | ❌     |
| PLATFORM_ADMIN | set     | set  | ❌     |
| COMPANY_ADMIN  | null    | null | ❌     |
| COMPANY_ADMIN  | set     | null | ✅     |
| COMPANY_ADMIN  | set     | set  | ❌     |
| POS_AGENT      | null    | null | ❌     |
| POS_AGENT      | set     | null | ❌     |
| POS_AGENT      | set     | set  | ✅     |

---

### 4.4 Ticket Entity (COMPLETE with Payment Fields)

**Purpose:** Immutable financial record of a booking

```java
@Entity
@Table(name = "tickets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Ticket {

    @Id
    private String ticketId;  // UUID

    @Column(nullable = false)
    private String tripId;

    @Embedded
    private Target target;  // { company, pos }

    @ElementCollection
    @CollectionTable(name = "ticket_segments")
    private List<String> segmentIds;

    private String expressId;  // Nullable - set if express fare applied

    @Column(nullable = false)
    private String pickupPointId;  // MANDATORY - where passenger boards

    @Column(nullable = false)
    private String dropoffPointId;  // MANDATORY - where passenger drops

    @Column(nullable = false)
    private String passengerId;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal appliedPrice;  // Total customer paid (snapshot)

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal platformFee;  // Your revenue (e.g., 3 TND = 5%)

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal operatorRevenue;  // Operator keeps (e.g., 57 TND = 95%)

    @Column(nullable = false, length = 3)
    private String currency;  // "TND"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SettlementStatus settlementStatus = SettlementStatus.PENDING;

    @Column(unique = true, nullable = false)
    private String idempotencyKey;  // Prevents duplicate bookings

    private LocalDateTime expiresAt;  // For PENDING tickets (now + seatHoldMinutes)

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime confirmedAt;
    private LocalDateTime cancelledAt;

    @PrePersist
    protected void onCreate() {
        ticketId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}

enum TicketStatus {
    PENDING,     // Payment not completed, seats temporarily held
    CONFIRMED,   // Payment completed, seats permanently booked
    EXPIRED,     // Payment timeout, seats released
    CANCELLED    // Ticket cancelled, triggers Refund entity
}

enum PaymentMethod {
    CASH_AT_POS,
    ONLINE_CARD
}

enum SettlementStatus {
    PENDING,   // Not yet settled (online: not paid to operator, cash: not collected from operator)
    SETTLED    // Money transferred
}
```

**Ticket State Machine:**

```
PENDING   → CONFIRMED  (payment success)
PENDING   → EXPIRED    (payment timeout or failure)
CONFIRMED → CANCELLED  (triggers Refund entity)
EXPIRED   → terminal
CANCELLED → terminal
```

**Immutability Rules:**

- ❌ NEVER mutate `appliedPrice`, `currency`, `segmentIds` after creation
- ❌ NEVER change `platformFee` or `operatorRevenue` after confirmation
- ✅ Use Refund entity for cancellations

---

### 4.5 Payment Entity

**Purpose:** Tracks individual payment transactions

```java
@Entity
@Table(name = "payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    private String paymentId;

    @Column(nullable = false)
    private String ticketId;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

    // SMT/ClickToPay specific fields
    private String paymentSessionId;  // SMT session ID
    private String transactionId;     // SMT transaction ID after success

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        paymentId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}

enum PaymentStatus {
    PENDING,     // Payment initiated, awaiting confirmation
    COMPLETED,   // Payment successful
    FAILED,      // Payment failed
    REFUNDED     // Payment refunded
}
```

---

### 4.6 Settlement Entity

**Purpose:** Weekly settlement tracking for operator payouts

```java
@Entity
@Table(name = "settlements")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Settlement {

    @Id
    private String settlementId;

    @Column(nullable = false)
    private String companyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "companyId", insertable = false, updatable = false)
    private Company company;

    private LocalDate periodStart;
    private LocalDate periodEnd;

    // Online tickets (you owe operator)
    private Integer onlineTicketsCount;

    @Column(precision = 10, scale = 2)
    private BigDecimal onlineRevenue;  // Total you collected via SMT

    @Column(precision = 10, scale = 2)
    private BigDecimal operatorPayoutOwed;  // 95% you must pay operator

    // Cash tickets (operator owes you)
    private Integer cashTicketsCount;

    @Column(precision = 10, scale = 2)
    private BigDecimal cashRevenue;  // Total operator collected

    @Column(precision = 10, scale = 2)
    private BigDecimal platformFeesOwed;  // 5% operator must pay you

    // Net settlement (positive = they pay you, negative = you pay them)
    @Column(precision = 10, scale = 2)
    private BigDecimal netAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SettlementStatus status;

    private String invoiceUrl;  // PDF invoice

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime paidAt;

    @PrePersist
    protected void onCreate() {
        settlementId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}
```

---

## 5. Trip Business Model

### 5.1 Core Principles

1. **Seats are physical, pricing is logical** — segments own inventory, express fares are pricing overlays
2. **Stop classification via flags** — `boardingAllowed` + `droppingAllowed` determine type
3. **Segments are frozen** — never add/remove after creation
4. **Tickets are immutable** — use Refund entity for changes
5. **Currency is global** — declared at trip level, inherited everywhere
6. **UTC storage, timezone display** — store UTC, render in trip.timezone
7. **Exactly-once booking** — idempotencyKey prevents duplicates

### 5.2 Complete Trip Schema

```typescript
interface Trip {
  // Layer 1 — Identity
  tripId: string;
  target: { company: string }; // Which operator owns this
  departureDate: string; // ISO date, UTC
  timezone: string; // IANA e.g. "Africa/Tunis"
  status: TripStatus;

  // Layer 2 — Bus (reference only, no snapshot)
  bus: { busId: string };

  // Layer 3 — Global Currency
  currency: string; // "TND"

  // Layer 4 — Seat Hold
  seatHoldMinutes: number; // default: 10

  // Layer 5 — Stop Schedule
  stopSchedule: Stop[];

  // Layer 6 — Pickup Points (MANDATORY per commercial stop)
  pickupPoints: PickupPoint[];

  // Layer 7 — Dropoff Points (MANDATORY per commercial stop)
  dropoffPoints: DropoffPoint[];

  // Layer 8 — Segments (frozen after creation)
  segments: Segment[];

  // Layer 9 — Express Fares (pricing overlay, no inventory)
  expressFares: ExpressFare[];
}

enum TripStatus {
  SCHEDULED, // Not yet active
  ACTIVE, // Booking open
  COMPLETED, // Journey finished
  CANCELLED, // Trip cancelled
}
```

### 5.3 Stop Schema

```typescript
interface Stop {
  placeId: string; // Reference to Place entity
  sequence: number; // Strictly ascending (1, 2, 3...)
  arrivalTime: string | null; // null for first stop, UTC
  departureTime: string | null; // null for last stop, UTC
  boardingAllowed: boolean;
  droppingAllowed: boolean;
}

// Stop type is DERIVED (no isCommercialStop field):
// boarding=true  + dropping=false  → Origin
// boarding=false + dropping=true   → Destination
// boarding=true  + dropping=true   → Intermediate commercial
// boarding=false + dropping=false  → Technical stop (skipped in segments)
```

**Validation Rules:**

- `sequence` strictly ascending, unique per trip
- Timeline strictly increasing (no backward timestamps)
- `departureTime >= arrivalTime` for intermediate stops
- At least 2 commercial stops required
- First stop: `arrivalTime = null`
- Last stop: `departureTime = null`

### 5.4 Pickup & Dropoff Points

```typescript
interface PickupPoint {
  pointId: string;
  placeId: string; // Must exist in stopSchedule with boardingAllowed=true
  address: string;
  scheduledDepartureTime: string; // UTC
  active: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface DropoffPoint {
  pointId: string;
  placeId: string; // Must exist in stopSchedule with droppingAllowed=true
  address: string;
  scheduledArrivalTime: string; // UTC
  active: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}
```

**MANDATORY RULE:**

- Every stop with `boardingAllowed=true` MUST have at least one PickupPoint
- Every stop with `droppingAllowed=true` MUST have at least one DropoffPoint
- Trip creation is BLOCKED if any commercial stop is missing required points

### 5.5 Segment Schema (WITH SEQUENCE)

```typescript
interface Segment {
  segmentId: string;
  sequence: number; // ⭐ MANDATORY - strictly ascending (1, 2, 3...)
  fromPlaceId: string;
  toPlaceId: string;
  departureTime: string; // UTC, derived from stopSchedule
  arrivalTime: string; // UTC
  maxSeats: number; // <= bus.totalSeats
  bookedSeats: number; // Incremented via atomic CAS
  basePrice: number; // In trip.currency
  distanceKm: number;
  durationMinutes: number;
}
```

**Rules:**

- Auto-generated between consecutive commercial stops only
- Technical stops (boarding=false + dropping=false) are SKIPPED
- **Frozen after creation** — no add/remove post-creation
- `sequence` field is CRITICAL for express fare chain validation
- `distanceKm` and `durationMinutes` owned by segment (single source of truth)

**Atomic CAS (Oversell Prevention):**

```sql
UPDATE segments
SET bookedSeats = bookedSeats + 1
WHERE segmentId = :id
  AND bookedSeats + 1 <= maxSeats

-- 0 rows updated = no seats available → reject booking
-- Applied to ALL segments in journey chain
```

### 5.6 Express Fare (COMPUTED FIELDS)

```typescript
interface ExpressFare {
  expressId: string;
  fromPlaceId: string; // Must match start of first segment
  toPlaceId: string; // Must match end of last segment
  segmentsCovered: string[]; // Ordered segmentIds, continuous chain
  price: number; // In trip.currency
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;

  // ⚠️ totalDistanceKm and totalDurationMinutes are COMPUTED
  // NOT stored in DB - calculated from segmentsCovered at read time
}
```

**Backend (Spring Boot) - Computed Fields:**

```java
@Entity
public class ExpressFare {
    // ... other fields

    @Transient  // Not stored in DB
    private Integer totalDistanceKm;

    @Transient
    private Integer totalDurationMinutes;
}

// MapStruct mapper computes these
@Mapper
public interface ExpressFareMapper {

    @Mapping(target = "totalDistanceKm",
             expression = "java(calculateTotalDistance(fare, segments))")
    @Mapping(target = "totalDurationMinutes",
             expression = "java(calculateTotalDuration(fare, segments))")
    ExpressFareDTO toDto(ExpressFare fare, List<Segment> segments);

    default Integer calculateTotalDistance(ExpressFare fare, List<Segment> segments) {
        return fare.getSegmentsCovered().stream()
            .map(segId -> findSegment(segments, segId).getDistanceKm())
            .reduce(0, Integer::sum);
    }

    default Integer calculateTotalDuration(ExpressFare fare, List<Segment> segments) {
        return fare.getSegmentsCovered().stream()
            .map(segId -> findSegment(segments, segId).getDurationMinutes())
            .reduce(0, Integer::sum);
    }
}
```

**Frontend (Angular) - Computed Property:**

```typescript
export class ExpressFare {
  expressId: string;
  segmentsCovered: string[];
  // ...

  private segments: Segment[]; // Reference to trip segments

  // Computed property (like @Transient)
  get totalDistanceKm(): number {
    return this.segmentsCovered
      .map((id) => this.segments.find((s) => s.segmentId === id).distanceKm)
      .reduce((sum, km) => sum + km, 0);
  }

  get totalDurationMinutes(): number {
    return this.segmentsCovered
      .map(
        (id) => this.segments.find((s) => s.segmentId === id).durationMinutes,
      )
      .reduce((sum, min) => sum + min, 0);
  }
}
```

**Express Fare Rules:**

- `segmentsCovered` must form unbroken chain using `segment.sequence`
- Validation: segments must be consecutive (sequence N, N+1, N+2...)
- `toPlaceId` of seg[n] must equal `fromPlaceId` of seg[n+1]
- Removing a stop that breaks chain is hard-blocked: `STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY`

---

## 6. Payment & Settlement Architecture

### 6.1 Payment Model: Merchant-of-Record

**Legal Structure (for bank approval):**

```
Contract clause with operators:

"Platform purchases bus seat inventory from Operator
 at wholesale cost of [RETAIL_PRICE × 0.95].

 Platform sells seats to customers at retail price [RETAIL_PRICE].

 Platform keeps margin of [RETAIL_PRICE × 0.05] as revenue.

 Operator delivers transportation service.
 Platform is responsible for customer satisfaction and refunds."
```

**Why this works:**

- ✅ Platform is the SELLER (not payment intermediary)
- ✅ No payment institution license required
- ✅ Banks approve SMT merchant accounts
- ✅ Clean accounting (buy/resell model)

### 6.2 SMT Payment Integration Flow

**Step-by-step implementation:**

```java
// 1. Customer initiates payment (frontend)
@PostMapping("/api/bookings/create")
public BookingResponse createBooking(@RequestBody BookingRequest request) {
    // Reserve seats atomically
    Ticket ticket = ticketService.createPending(request);

    // Initiate SMT payment
    String paymentUrl = smtService.createPaymentSession(ticket);

    return BookingResponse.builder()
        .ticketId(ticket.getTicketId())
        .paymentUrl(paymentUrl)
        .expiresAt(ticket.getExpiresAt())
        .build();
}

// 2. SMT payment session creation
@Service
public class SMTService {

    public String createPaymentSession(Ticket ticket) {
        SMTPaymentRequest request = SMTPaymentRequest.builder()
            .merchantId(smtMerchantId)
            .amount(ticket.getAppliedPrice())
            .currency(ticket.getCurrency())
            .orderId(ticket.getTicketId())
            .returnUrl(frontendUrl + "/booking/success")
            .cancelUrl(frontendUrl + "/booking/cancel")
            .callbackUrl(backendUrl + "/api/payments/webhook")
            .build();

        SMTPaymentResponse response = restTemplate.postForObject(
            "https://api.smt.tn/v1/payments",
            request,
            SMTPaymentResponse.class
        );

        // Store session ID
        Payment payment = Payment.builder()
            .ticketId(ticket.getTicketId())
            .amount(ticket.getAppliedPrice())
            .currency(ticket.getCurrency())
            .method(PaymentMethod.ONLINE_CARD)
            .status(PaymentStatus.PENDING)
            .paymentSessionId(response.getSessionId())
            .build();

        paymentRepository.save(payment);

        return response.getPaymentUrl();  // Redirect customer here
    }
}

// 3. Webhook handler (SMT calls this after payment)
@PostMapping("/api/payments/webhook")
public ResponseEntity<Void> handleSMTWebhook(
    @RequestBody SMTWebhookPayload payload,
    @RequestHeader("X-SMT-Signature") String signature
) {
    // 1. Verify signature (CRITICAL for security)
    if (!smtService.verifySignature(payload, signature)) {
        return ResponseEntity.status(403).build();
    }

    // 2. Find ticket
    Ticket ticket = ticketRepository.findById(payload.getOrderId())
        .orElseThrow();

    // 3. Update based on payment status
    if ("SUCCESS".equals(payload.getStatus())) {
        // Payment successful
        ticket.setStatus(TicketStatus.CONFIRMED);
        ticket.setPaymentMethod(PaymentMethod.ONLINE_CARD);
        ticket.setConfirmedAt(LocalDateTime.now());
        ticketRepository.save(ticket);

        // Update payment record
        Payment payment = paymentRepository.findByTicketId(ticket.getTicketId());
        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setTransactionId(payload.getTransactionId());
        payment.setCompletedAt(LocalDateTime.now());
        paymentRepository.save(payment);

        // Confirm seats permanently booked
        seatService.confirmBooking(ticket.getTripId(), ticket.getSegmentIds());

        // Send confirmation email/SMS
        notificationService.sendTicketConfirmation(ticket);

    } else {
        // Payment failed - expire ticket and release seats
        ticketService.expireTicket(ticket.getTicketId());
    }

    return ResponseEntity.ok().build();
}
```

### 6.3 Weekly Settlement Automation

```java
@Component
public class SettlementScheduler {

    @Scheduled(cron = "0 0 9 * * MON")  // Every Monday at 9 AM
    public void processWeeklySettlements() {
        LocalDate lastWeek = LocalDate.now().minusWeeks(1);
        LocalDate weekStart = lastWeek.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        List<Company> companies = companyRepository.findByStatus(CompanyStatus.ACTIVE);

        for (Company company : companies) {
            processCompanySettlement(company, weekStart, weekEnd);
        }
    }

    private void processCompanySettlement(Company company, LocalDate start, LocalDate end) {
        // Calculate online tickets (you owe operator)
        SettlementStats onlineStats = ticketRepository.calculateSettlement(
            company.getCompanyId(),
            start,
            end,
            PaymentMethod.ONLINE_CARD,
            TicketStatus.CONFIRMED
        );

        // Calculate cash tickets (operator owes you)
        SettlementStats cashStats = ticketRepository.calculateSettlement(
            company.getCompanyId(),
            start,
            end,
            PaymentMethod.CASH_AT_POS,
            TicketStatus.CONFIRMED
        );

        // Net settlement
        BigDecimal netAmount = cashStats.platformFees
            .subtract(onlineStats.operatorRevenue);

        // Create settlement record
        Settlement settlement = Settlement.builder()
            .companyId(company.getCompanyId())
            .periodStart(start)
            .periodEnd(end)
            .onlineTicketsCount(onlineStats.count)
            .onlineRevenue(onlineStats.totalRevenue)
            .operatorPayoutOwed(onlineStats.operatorRevenue)
            .cashTicketsCount(cashStats.count)
            .cashRevenue(cashStats.totalRevenue)
            .platformFeesOwed(cashStats.platformFees)
            .netAmount(netAmount)
            .status(SettlementStatus.PENDING)
            .build();

        settlementRepository.save(settlement);

        // Generate invoice PDF
        String invoiceUrl = invoiceService.generateInvoice(settlement);
        settlement.setInvoiceUrl(invoiceUrl);
        settlementRepository.save(settlement);

        // Email operator
        emailService.sendWeeklySettlement(company, settlement);

        // Create task for finance team (manual bank transfer for MVP)
        if (netAmount.compareTo(BigDecimal.ZERO) < 0) {
            // Platform owes operator
            taskService.createPayoutTask(settlement);
        } else if (netAmount.compareTo(BigDecimal.ZERO) > 0) {
            // Operator owes platform
            taskService.createCollectionTask(settlement);
        }
    }
}
```

---

## 7. Real-Time Inventory System

### 7.1 The Critical Challenge

**Problem:** Prevent double booking when:

- Customer A books online at 10:00:00
- Customer B books at POS at 10:00:05
- Both try to book same seat #12

**Solution:** Real-time seat-level inventory with atomic locking

### 7.2 Seat Entity

```java
@Entity
@Table(name = "seats",
       indexes = @Index(name = "idx_trip_seat", columns = {"tripId", "seatNumber"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Seat {

    @Id
    private String seatId;

    @Column(nullable = false)
    private String tripId;

    @Column(nullable = false)
    private Integer seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SeatStatus status = SeatStatus.AVAILABLE;

    private LocalDateTime lockedUntil;  // For RESERVED status

    private String bookedBy;  // Ticket ID for BOOKED status

    @Version  // Optimistic locking
    private Long version;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        seatId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

enum SeatStatus {
    AVAILABLE,  // Open for booking
    RESERVED,   // Temporarily locked during payment (10 min default)
    BOOKED      // Permanently booked
}
```

### 7.3 Atomic Seat Reservation

```java
@Service
public class SeatService {

    @Transactional
    public Seat reserveSeat(String tripId, Integer seatNumber, Integer holdMinutes) {
        // Pessimistic lock ensures only one transaction can reserve at a time
        Seat seat = seatRepository
            .findByTripIdAndSeatNumberForUpdate(tripId, seatNumber)
            .orElseThrow(() -> new SeatNotFoundException());

        // Check availability
        if (seat.getStatus() != SeatStatus.AVAILABLE) {
            throw new SeatUnavailableException(
                "Seat " + seatNumber + " is already " + seat.getStatus()
            );
        }

        // Reserve it
        seat.setStatus(SeatStatus.RESERVED);
        seat.setLockedUntil(LocalDateTime.now().plusMinutes(holdMinutes));

        return seatRepository.save(seat);
    }

    @Transactional
    public void confirmBooking(String tripId, List<Integer> seatNumbers, String ticketId) {
        for (Integer seatNumber : seatNumbers) {
            Seat seat = seatRepository
                .findByTripIdAndSeatNumber(tripId, seatNumber)
                .orElseThrow();

            seat.setStatus(SeatStatus.BOOKED);
            seat.setBookedBy(ticketId);
            seat.setLockedUntil(null);

            seatRepository.save(seat);
        }
    }

    @Transactional
    public void releaseSeat(String tripId, Integer seatNumber) {
        Seat seat = seatRepository
            .findByTripIdAndSeatNumber(tripId, seatNumber)
            .orElseThrow();

        seat.setStatus(SeatStatus.AVAILABLE);
        seat.setLockedUntil(null);
        seat.setBookedBy(null);

        seatRepository.save(seat);
    }
}

// Repository with pessimistic locking
public interface SeatRepository extends JpaRepository<Seat, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Seat s WHERE s.tripId = :tripId AND s.seatNumber = :seatNumber")
    Optional<Seat> findByTripIdAndSeatNumberForUpdate(
        @Param("tripId") String tripId,
        @Param("seatNumber") Integer seatNumber
    );
}
```

### 7.4 Seat Expiry Worker

**CRITICAL:** Releases expired reservations to prevent phantom "sold out"

```java
@Component
public class SeatExpiryWorker {

    @Scheduled(fixedRate = 60000)  // Every 60 seconds
    public void releaseExpiredSeats() {
        List<Seat> expiredSeats = seatRepository
            .findByStatusAndLockedUntilBefore(
                SeatStatus.RESERVED,
                LocalDateTime.now()
            );

        if (!expiredSeats.isEmpty()) {
            log.info("Releasing {} expired seat reservations", expiredSeats.size());

            expiredSeats.forEach(seat -> {
                seat.setStatus(SeatStatus.AVAILABLE);
                seat.setLockedUntil(null);
            });

            seatRepository.saveAll(expiredSeats);
        }
    }

    // Also expire PENDING tickets when seats expire
    @Scheduled(fixedRate = 60000)
    public void expireUnpaidTickets() {
        List<Ticket> expiredTickets = ticketRepository
            .findByStatusAndExpiresAtBefore(
                TicketStatus.PENDING,
                LocalDateTime.now()
            );

        if (!expiredTickets.isEmpty()) {
            log.info("Expiring {} unpaid tickets", expiredTickets.size());

            expiredTickets.forEach(ticket -> {
                ticket.setStatus(TicketStatus.EXPIRED);
                ticketRepository.save(ticket);

                // Release associated seats
                // (Already handled by releaseExpiredSeats if implemented correctly)
            });
        }
    }
}
```

### 7.5 POS Integration Strategy (MVP)

**For MVP:** Dual system with manual sync

```java
@RestController
@RequestMapping("/api/pos")
public class POSSalesController {

    // POS dashboard sees real-time seat availability
    @GetMapping("/trips/{tripId}/seats")
    public SeatMapResponse getSeatMap(@PathVariable String tripId) {
        List<Seat> seats = seatRepository.findByTripId(tripId);

        return SeatMapResponse.builder()
            .tripId(tripId)
            .seats(seats.stream()
                .map(seat -> SeatDTO.builder()
                    .seatNumber(seat.getSeatNumber())
                    .status(seat.getStatus())
                    .availableForPOS(seat.getStatus() == SeatStatus.AVAILABLE)
                    .build())
                .collect(Collectors.toList()))
            .build();
    }

    // POS agent manually marks seat as sold (walk-in customer)
    @PostMapping("/trips/{tripId}/seats/{seatNumber}/mark-sold")
    public Ticket markSeatSoldAtPOS(
        @PathVariable String tripId,
        @PathVariable Integer seatNumber,
        @RequestBody POSSaleRequest request
    ) {
        // 1. Reserve seat
        Seat seat = seatService.reserveSeat(tripId, seatNumber, 0);  // No hold time

        // 2. Create CONFIRMED ticket immediately (cash payment)
        Ticket ticket = Ticket.builder()
            .tripId(tripId)
            .target(Target.builder()
                .company(request.getCompanyId())
                .pos(request.getPosId())
                .build())
            .segmentIds(request.getSegmentIds())
            .pickupPointId(request.getPickupPointId())
            .dropoffPointId(request.getDropoffPointId())
            .passengerId(request.getPassengerId())
            .appliedPrice(request.getPrice())
            .platformFee(request.getPrice().multiply(BigDecimal.valueOf(0.05)))
            .operatorRevenue(request.getPrice().multiply(BigDecimal.valueOf(0.95)))
            .currency("TND")
            .status(TicketStatus.CONFIRMED)  // Immediately confirmed
            .paymentMethod(PaymentMethod.CASH_AT_POS)
            .settlementStatus(SettlementStatus.PENDING)
            .idempotencyKey(UUID.randomUUID().toString())
            .build();

        ticketRepository.save(ticket);

        // 3. Confirm seat booking
        seatService.confirmBooking(tripId, List.of(seatNumber), ticket.getTicketId());

        // 4. Print ticket
        // (Frontend handles printing after receiving response)

        return ticket;
    }
}
```

**Frontend (POS Dashboard):**

```typescript
export class POSDashboardComponent {
  seatMap: Seat[];

  ngOnInit() {
    // Load seat map (real-time)
    this.loadSeatMap();

    // Refresh every 10 seconds
    interval(10000).subscribe(() => this.loadSeatMap());
  }

  markSeatSold(seatNumber: number) {
    // Show modal for passenger details
    const dialogRef = this.dialog.open(POSSaleDialog, {
      data: { seatNumber, tripId: this.tripId },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.posService
          .markSeatSold(this.tripId, seatNumber, result)
          .subscribe((ticket) => {
            this.alertService.success("Ticket created successfully");
            this.printTicket(ticket);
            this.loadSeatMap(); // Refresh map
          });
      }
    });
  }
}
```

---

## 8. Frontend Patterns

### 8.1 Service Pattern (BehaviorSubject State Management)

```typescript
@Injectable({ providedIn: "root" })
export class CompanyService {
  private companies = new BehaviorSubject<Company[]>([]);
  private company = new BehaviorSubject<Company>(null);
  private loading = new BehaviorSubject<boolean>(false);

  get companies$() {
    return this.companies.asObservable();
  }
  get company$() {
    return this.company.asObservable();
  }
  get loading$() {
    return this.loading.asObservable();
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  list(): Observable<Company[]> {
    this.loading.next(true);

    // ALWAYS scope by company (except PLATFORM_ADMIN)
    const user = this.authService.getCurrentUser();
    const params =
      user.role === "PLATFORM_ADMIN" ? {} : { companyId: user.target.company };

    return this.http.get<Company[]>("/api/companies", { params }).pipe(
      tap((companies) => this.companies.next(companies)),
      finalize(() => this.loading.next(false)),
    );
  }

  create(company: CompanyDTO): Observable<Company> {
    return this.http.post<Company>("/api/companies", company).pipe(
      tap((newCompany) => {
        const current = this.companies.value || [];
        this.companies.next([newCompany, ...current]); // Optimistic update
      }),
    );
  }

  // Never re-fetch after mutations - use optimistic updates
}
```

### 8.2 Component Pattern

```typescript
export class CompanyListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  companies$ = this.companyService.companies$;
  loading$ = this.companyService.loading$;

  ngOnInit() {
    this.companyService.list().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### 8.3 Libraries - ALWAYS Use

**Frontend (Angular):**

- ✅ **lodash** - ALL data manipulation
  - `_.isEqual()` for deep comparison
  - `_.isEmpty()` for null/undefined/empty checks
  - `_.groupBy()`, `_.sortBy()`, `_.uniqBy()` for arrays
- ✅ **date-fns** - ALL date operations
  - `format()`, `parse()` for date formatting
  - `addDays()`, `subDays()`, `differenceInDays()`
  - NEVER use `new Date()` arithmetic
- ✅ **RxJS** - ALL async operations

---

## 9. Backend Patterns

### 9.1 Libraries - ALWAYS Use

**Backend (Spring Boot):**

- ✅ **Lombok** - ALL boilerplate
  - `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`
  - `@Slf4j` for logging
  - NEVER write getters/setters manually
- ✅ **MapStruct** - ALL DTO/Entity mapping
  - NEVER manually map fields
  - Use `@Mapper` interfaces
- ✅ **Apache Commons** - ALL utilities
  - `StringUtils.isBlank()` instead of null checks
  - `CollectionUtils.isEmpty()`
- ✅ **Bean Validation** - ALL input validation
  - `@NotNull`, `@NotBlank`, `@Valid`
  - Custom validators with `@Constraint`

### 9.2 Multi-Tenant Query Pattern

```java
@Service
public class TripService {

    // ALWAYS filter by company
    public List<Trip> listTrips(String companyId) {
        return tripRepository.findByTargetCompany(companyId);
    }

    // NEVER allow cross-company access
    public Trip getById(String tripId, String companyId) {
        return tripRepository.findByIdAndTargetCompany(tripId, companyId)
            .orElseThrow(() -> new TripNotFoundException());
    }
}
```

---

## 10. Development Roadmap

### Week 1-2: Multi-Tenant Foundation

**Day 1-3:**

- ✅ Company entity (backend + frontend CRUD)
- ✅ POS entity (backend + frontend CRUD)
- ✅ Update User entity (add target field + validation)
- ✅ Update AuthService (inject company context)
- ✅ Update BusService (filter by target.company)

**Day 4-5:**

- ✅ Company admin dashboard
- ✅ Platform admin dashboard
- ✅ Role-based UI rendering
- ✅ Multi-tenant isolation testing

### Week 3-4: Trip Management

**Day 6-8:**

- ✅ Place entity (cities/stations)
- ✅ Trip entity (all nested objects)
- ✅ Stop, Segment, PickupPoint, DropoffPoint entities
- ✅ ExpressFare entity (computed fields)
- ✅ Segment auto-generation logic
- ✅ Validation rules

**Day 9-12:**

- ✅ Trip creation form (multi-step)
- ✅ Trip list + detail pages
- ✅ Trip editing (with permission logic)
- ✅ Express fare validation

### Week 5-6: Inventory + Booking

**Day 13-14:**

- ✅ Seat entity
- ✅ Atomic seat locking
- ✅ Seat expiry worker
- ✅ Load testing (concurrent bookings)

**Day 15-18:**

- ✅ Ticket entity
- ✅ Booking API (PENDING creation + CAS)
- ✅ Customer booking flow (frontend)
- ✅ Seat selection UI
- ✅ Email/SMS notifications

### Week 7: Payment Integration

**Day 19-22:**

- ✅ SMT API client
- ✅ Payment webhook handler
- ✅ Frontend payment flow
- ✅ Cash payment at POS

### Week 8: Settlement + Reporting

**Day 23-26:**

- ✅ Settlement entity
- ✅ Weekly settlement scheduler
- ✅ Invoice generation
- ✅ Operator/platform dashboards

### Week 9: POS Integration + Testing

**Day 27-30:**

- ✅ POS dashboard (real-time seat map)
- ✅ Manual seat sync ("mark sold" button)
- ✅ Integration testing
- ✅ Performance testing

### Week 10: Launch

**Day 31-35:**

- ✅ UI/UX polish
- ✅ Documentation
- ✅ Deploy to staging
- ✅ Onboard first operator
- ✅ Production deployment

---

## Development Ready Checklist

### ✅ Complete Specs

- [x] Company entity specification
- [x] POS entity specification
- [x] User entity with target validation
- [x] Updated Ticket entity with payment fields
- [x] Payment & Settlement entities
- [x] Trip business model (all updates)
- [x] Real-time inventory system
- [x] SMT payment integration

### ✅ Business Decisions

- [x] Payment model: Merchant-of-record
- [ ] Bank SMT approval (apply this week)
- [ ] Operator contract templates
- [x] Platform fee: 5%
- [x] Settlement: Weekly
- [x] Cash payment: Supported

### ✅ Technical Setup

- [ ] Spring Boot project initialized
- [ ] Angular project initialized
- [ ] PostgreSQL configured
- [ ] Dependencies added (Lombok, MapStruct, etc.)
- [ ] Auth system working
- [ ] Bus management working

---

## Priority Order

1. 🥇 **Real-time inventory system** (prevents double booking)
2. 🥈 **Multi-tenant foundation** (Company/POS/User)
3. 🥉 **Trip management** (core business logic)
4. **Booking engine** (atomic seat locking)
5. **SMT payment** (merchant-of-record)
6. **POS integration** (manual sync)
7. **Settlement automation** (weekly payouts)

---

**END OF SPECIFICATIONS**

This document contains everything needed to start development. Copy sections to Opus 4.6 as needed to generate code.
