# POS_AGENT Logic

**Status:** Product contract for MVP / V1
**Last Updated:** April 2026

## 1. Purpose

This document defines the business role, operational scope, permissions, and daily workflows of the `POS_AGENT` in the platform.

The purpose of this document is to make the POS role explicit and remove the current ambiguity between:

- company-level administration
- POS-level execution
- ticket selling
- ticket payment confirmation
- operational analytics

This document is the reference for future UX design, route scoping, permissions, ticket operations, and POS analytics.

---

## 2. Why POS Exists in the Platform

A POS is not just a child record under a company.

A POS exists for four business reasons:

1. **Execution**
   A ticket is sold by a real operational location.

2. **Attribution**
   The platform must know where a ticket was sold.

3. **Analytics**
   The company must be able to analyze sales performance by POS.

4. **Optimization**
   The business must be able to compare POS performance, ticket flow, payment flow, and staff productivity.

Because of this, POS must be treated as an operational unit, not only as a configuration object.

---

## 3. POS_AGENT Position in the Business Model

A `POS_AGENT` is an operational sales role.

A `POS_AGENT` is **not**:

- a platform administrator
- a company administrator
- a configuration manager
- a role manager
- a POS setup manager

A `POS_AGENT` is the person who works at the counter or the sales terminal and performs operational tasks such as:

- selling tickets
- creating or finding customers at the counter
- confirming or capturing payment
- printing or resending ticket output
- viewing the tickets relevant to operational work

The `POS_AGENT` is the platform persona closest to a cashier, sales operator, or booking clerk.

---

## 4. Relationship to Existing Platform Specifications

The platform documentation has evolved.

Earlier specifications described POS-centered scoping using `target.pos`.

The more recent business model defines a broader multi-tenant structure using `target: { company, pos }`.

For this document, the authoritative operational interpretation is:

- **Company** is the business boundary
- **POS** is the execution and attribution boundary inside the company

This means:

- a trip belongs to a company
- a ticket is operationally attributed to a POS
- a POS agent always acts within a company and a POS context

If older documents mention only `target.pos`, that should be understood as legacy language from before the company + POS model was fully introduced.

---

## 5. Scope Model: Company vs POS

### 5.1 Company Scope

The company is responsible for:

- owning buses
- owning trips
- owning POS locations
- owning staff
- owning policy and configuration
- receiving analytics aggregated across all POS locations

The company is the strategic and administrative scope.

### 5.2 POS Scope

The POS is responsible for:

- ticket-selling execution
- payment capture execution
- local operational reporting
- attribution of ticket origin
- attribution of operational actions

The POS is the runtime and analytics scope for frontline activity.

### 5.3 Final Operational Rule

A `POS_AGENT` works inside:

- one company
- one POS

This rule is mandatory for V1.

---

## 6. V1 Runtime Identity of a POS_AGENT

At runtime, every POS agent session must resolve the following context:

- `userId`
- `role = POS_AGENT`
- `companyId`
- `posId`
- granted operational permissions

### V1 Rule: Single POS Only

For V1, a `POS_AGENT` is strictly tied to **one single POS**.

There is no dynamic switching between POS locations.

There is no runtime POS selector.

There is no "change active POS" behavior for POS agents.

When the POS agent logs in, the system must already know the assigned POS and must place the user directly into that POS context.

### UX Consequence

The POS agent header and dashboard should clearly display:

- company name
- POS name
- current agent identity

This context should be visible but not editable by the POS agent.

---

## 7. Who Manages Roles

A POS agent does not manage roles.

Role management is not a POS agent responsibility.

### Responsibility Split

| Role            | Business Responsibility                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| visibility      |
| `COMPANY_ADMIN` | company setup, POS setup, team management, role assignment, permission governance inside the company |
| `POS_AGENT`     | day-to-day sales and payment execution within one assigned POS                                       |

### Final Rule

- `COMPANY_ADMIN` creates and assigns POS agent permissions
- `POS_AGENT` consumes those permissions
- `POS_AGENT` may view their effective permissions in read-only form if needed
- `POS_AGENT` must not create, edit, assign, or delete roles

---

## 8. POS_AGENT Access Control

## 8.1 What a POS_AGENT Can Do

A POS agent can perform operational actions such as:

- search trips available for sale
- sell tickets
- reserve tickets if the business flow allows unpaid reservations
- find an existing customer
- create a quick customer profile at the counter
- print ticket details
- resend ticket details
- mark a ticket as paid
- view POS-level operational ticket lists
- request cancellation or refund if company policy allows that request flow

## 8.2 What a POS_AGENT Cannot Do

A POS agent cannot:

- create or edit companies
- create or edit POS definitions
- create or edit team permissions
- assign roles to other users
- manage buses
- manage trip setup
- edit company-wide settings
- view global platform analytics
- view cross-company data
- access strategic or administrative modules

## 8.3 Example Permission Keys

The final technical naming may evolve, but the business permission model for a POS agent should look like this:

| Permission Key          | Meaning                                                   | V1          |
| ----------------------- | --------------------------------------------------------- | ----------- |
| `ticket.sell`           | create a new counter sale                                 | required    |
| `ticket.reserve`        | create an unpaid or not-yet-paid booking if policy allows | optional    |
| `ticket.mark_paid`      | confirm payment on an unpaid ticket                       | required    |
| `ticket.reprint`        | print or re-open ticket output                            | recommended |
| `ticket.resend`         | resend ticket by email or other channel                   | recommended |
| `ticket.cancel_request` | submit cancellation request                               | optional    |
| `ticket.refund_request` | submit refund request                                     | optional    |
| `customer.read`         | search for customer records                               | required    |
| `customer.create_quick` | create lightweight customer profile during sale           | recommended |

---

## 9. V1 POS_AGENT Dashboard

The POS agent dashboard should be operational-first.

It should not feel like a company admin dashboard.

### 9.1 Core V1 Dashboard Goals

The POS dashboard should help the agent do three things quickly:

1. start selling immediately
2. find unpaid or active tickets quickly
3. complete payment or issue a ticket with minimal friction

### 9.2 Recommended V1 Dashboard Sections

- **Quick Sell**
  Entry point to trip search and ticket creation

- **Today’s Tickets**
  Tickets handled in the agent’s operational scope

- **Unpaid / Reserved Tickets**
  Tickets that may still need payment confirmation

- **Paid Tickets**
  Completed payment view for operational verification

- **Quick Lookup**
  Search by ticket reference, customer phone, or customer name

### 9.3 Modules That Should Not Appear for POS_AGENT

The POS agent should not see navigation items for:

- Companies
- POS Management
- Team
- Permissions
- Business Profile
- Company Configuration
- Global Analytics
- Trip Administration
- Bus Administration

### 9.4 Important V1 UX Rule

The POS agent should land on a **POS dashboard**, not on a generic company admin home page.

---

## 10. POS_AGENT Login and Landing Flow

The login flow for a POS agent should be operationally deterministic.

### 10.1 Login Flow

1. The user authenticates.
2. The system resolves the user role.
3. The system resolves the assigned company.
4. The system resolves the assigned POS.
5. The user is redirected to the POS dashboard.
6. The POS context becomes active and fixed for the session.

### 10.2 Landing Behavior

After login, the POS agent should not need to choose:

- a company
- a POS
- a role context

That choice must already be resolved by assignment.

### 10.3 V1 Session Rule

The active POS is fixed and read-only during the session.

If the user belongs to another POS in the future, that belongs to a later product phase, not V1.

---

## 11. Ticket Selling Workflow

The POS agent’s primary task is selling a ticket.

The selling workflow should be short, operational, and optimized for counter use.

### 11.1 V1 Sell Ticket Flow

1. Search for a trip.
2. Choose the departure instance.
3. Choose seat or seats.
4. Find an existing customer or capture a quick customer inline with phone or email.
5. Choose payment path.
6. Confirm the sale.
7. Generate ticket output.
8. Print or resend if needed.

The POS sell-ticket screen should not force the agent into a separate customer-creation page. If the typed contact does not match an existing customer, the sale flow collects the minimum contact details inline and the backend resolves or creates the customer during the booking create request.

### 11.2 Ticket Creation Rules

When the POS agent creates a ticket, the platform must attribute the sale to:

- the company
- the POS
- the acting POS agent

The most important business outcome is that the platform can answer:

- which company sold the ticket
- which POS sold the ticket
- which user handled the action

### 11.3 Payment Path During Sale

The actual UX can vary, but the business logic must support at least these counter scenarios:

- immediate cash sale
- immediate card sale if terminal/card support exists
- reservation or unpaid booking if company policy allows it

The critical business distinction is not the exact button text, but whether the ticket is:

- still waiting for payment
- already paid

---

## 12. Mark Paid Workflow

This is one of the most important POS agent operations.

A POS agent must be able to take an existing unpaid or reserved ticket and convert it into a paid ticket after the customer completes payment.

### 12.1 Business Rule for V1

A `POS_AGENT` **can mark a ticket as paid even if it was reserved at a different POS**, as long as the ticket belongs to the **same company**.

This is an approved V1 rule.

### 12.2 Why This Rule Exists

This rule supports real operational behavior such as:

- a ticket reserved online or at POS A
- the customer walks into POS B of the same company
- the agent at POS B receives payment
- the ticket is finalized at POS B

This is valid business behavior.

### 12.3 Constraints

A POS agent may mark a ticket as paid only if:

- the ticket belongs to the same company
- the ticket is still eligible for payment capture
- the user has `ticket.mark_paid` permission

A POS agent must not mark as paid:

- tickets from another company
- tickets already finalized if the status does not allow it
- tickets blocked by cancellation or refund state

### 12.4 Attribution Rule

If a ticket is created or reserved at one POS and later paid at another POS in the same company:

- the original selling POS attribution remains valid
- the original `target.pos` must not be overwritten just because payment happened elsewhere
- the payment action must still be attributable to the acting POS agent

### 12.5 V1 MVP Simplification

Shift management is deferred to V2.

For V1, the minimum operational attribution on the ticket is the acting `userId`.

Because a POS agent is strictly tied to one POS in V1, the platform can infer the operational POS of the user from the user assignment.

This keeps the MVP simple while still supporting same-company, cross-POS payment completion.

### 12.6 V1 Limitation

V1 prioritizes MVP speed.

That means richer event attribution such as:

- explicit `shiftId`
- separate `soldByUserId`
- separate `paidByUserId`
- explicit `paidAtPosId`

is deferred until later phases if needed.

---

## 13. Ticket Lifecycle from the POS Perspective

From a POS agent perspective, the important operational stages are:

1. ticket created or reserved
2. ticket still unpaid
3. ticket marked as paid
4. ticket cancelled or expired if not completed

The exact internal technical status names may evolve over time, but the business logic must preserve this operational distinction:

- **not yet paid**
- **paid**
- **cancelled or no longer valid**

### 13.1 POS Agent View of Lifecycle

| Operational Stage          | Meaning for POS_AGENT                               |
| -------------------------- | --------------------------------------------------- |
| Reserved / Booked / Unpaid | customer has not fully completed payment yet        |
| Paid                       | ticket is completed and can be treated as finalized |
| Cancelled                  | ticket is no longer valid                           |
| Expired                    | unpaid reservation is no longer valid               |

### 13.2 Important Business Note

For POS_AGENT UX, the most important action is not abstract status management.

The most important action is:

- collect payment
- confirm payment
- issue the final ticket

So the POS UX should talk in operational language such as:

- unpaid
- paid
- cancelled
- reprint
- resend

instead of exposing an admin-style generic status editor.

---

## 14. Data Attribution and Analytics

The entire point of introducing POS into the company model is to improve attribution and analytics.

### 14.1 Minimum V1 Attribution

For V1, every counter-handled ticket must allow the business to determine:

- company
- selling POS
- acting user
- creation timestamp
- paid timestamp if paid
- payment method if available

### 14.2 What POS Attribution Must Answer

The business must be able to answer questions such as:

- Which POS sold the most tickets today?
- Which POS creates the most unpaid reservations?
- Which company POS closes the most paid tickets?
- Which users are the most active sellers?
- Which POS converts reservations to paid tickets most effectively?

### 14.3 Analytics Interpretation in V1

Because V1 keeps POS agents tied to one fixed POS, the platform can infer POS-level operational behavior from the assigned user.

This allows MVP reporting without introducing a full shift management model.

### 14.4 V1 Analytics Strength

V1 can give strong answers to:

- where the ticket was sold
- which POS agent handled the action
- how many tickets each POS originates
- how many tickets are finalized by company-level frontline staff

### 14.5 V1 Analytics Limitation

If richer, event-by-event attribution is needed later, the platform should add separate operational event fields in V2.

That is not required for MVP.

---

## 15. Boundaries Between POS_AGENT, COMPANY_ADMIN

The platform must keep these roles clearly separated.

| Capability                       | COMPANY_ADMIN              | POS_AGENT                 |
| -------------------------------- | -------------------------- | ------------------------- |
| Manage platform settings         | no                         | no                        |
| Manage company profile           | yes                        | no                        |
| Create and manage POS            | yes                        | no                        |
| Create and assign staff roles    | yes                        | no                        |
| Sell tickets                     | optional if business wants | yes                       |
| Mark tickets as paid             | optional if business wants | yes                       |
| Reprint or resend ticket         | yes                        | yes                       |
| View admin analytics             | yes within company         | no                        |
| View operational POS ticket work | yes within company         | yes within assigned scope |

### Final Governance Rule

- Configuration belongs to admins
- Execution belongs to POS agents

This boundary should remain explicit in UX, routes, and permissions.

---

## 16. What the POS_AGENT Should See in V1

### 16.1 V1 Navigation for POS_AGENT

Recommended operational navigation:

- Dashboard
- Sell Ticket
- Tickets
- Customer Lookup

Optional if implemented:

- Payments
- Reprint / Resend
- Cancellation Requests

### 16.2 What the POS_AGENT Should Not See

The POS agent should not see:

- company setup screens
- POS CRUD screens
- team screens
- permission screens
- business profile screens
- company-wide strategic analytics
- trip administration and planning modules

If a POS agent sees those modules, the UX is mixing admin and cashier personas.

---

## 17. Current Product Interpretation

Based on the current business direction, the correct interpretation of the product is:

- company management is an admin concern
- POS management is an admin concern
- POS execution is the POS agent concern

The POS agent does not "manage POS".

The POS agent works **inside** a POS.

That is the core image of the role.

---

## 18. V1 Product Rules

These rules are approved for V1 and should be treated as fixed business rules for MVP.

### Rule 1

A POS agent is strictly tied to **one single POS**.

No dynamic POS switching is allowed in V1.

### Rule 2

A POS agent **can mark a ticket as paid** even if the ticket was reserved or created at another POS, as long as both POS values belong to the **same company**.

### Rule 3

Shift management is **deferred to V2**.

That means V1 does **not** include:

- open shift
- close shift
- reconciliation
- cash drawer balancing
- variance reports
- shift-based audit structure

### Rule 4

For V1, operational attribution should stay lightweight.

The minimum approved rule is to track the acting `userId` on ticket operations.

---

## 19. Deferred to V2

The following items are explicitly out of V1 scope:

- open shift
- close shift
- shift reconciliation
- cash drawer management
- variance reporting
- dynamic POS switching
- advanced multi-actor ticket event attribution
- full shift-based analytics
- supervisor approval workflow for cash exceptions

These features may be added later, but they must not slow the MVP.

---

## 20. Final Product Definition

The final product image of the `POS_AGENT` is:

- a fixed-POS operational user
- a ticket-selling and payment-handling actor
- a frontline execution persona
- not an admin user
- not a role manager
- not a POS configuration owner

The POS exists to make ticket operations attributable, measurable, and optimizable.

The POS agent exists to execute those operations inside one controlled POS context.

That is the correct business interpretation of the role for V1.
