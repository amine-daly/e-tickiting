# 6-Month Roadmap (Revised)

This roadmap covers 10 epics across 6 months for a production-grade e-ticketing app. It refines and sequences your original plan for pragmatic delivery with security, performance, and DevEx baked in.

- Epic 1: Project Setup & Env (W1–W2)
  - Monorepo scaffolding, CI, Docker, envs, lint/format
  - Angular app (SSR, NgRx, Material, Tailwind), Spring Boot service, MongoDB
  - OpenAPI contract baseline + generator configs
- Epic 2: Auth & Users (W2–W4)
  - JWT auth; RBAC (admin, customer, operator); profile mgmt
  - Social login (Google/Facebook) behind feature flags
- Epic 3: Operators & Fleet (W4–W6)
  - Operator onboarding; fleet CRUD; drivers; routes & schedules
- Epic 4: Search & Booking (W6–W9)
  - Trip search; real-time seat selection; booking flow; QR e-ticket
  - Email/SMS notifications
- Epic 5: Payments & Wallet (W9–W11)
  - Stripe/PayPal integration; refunds; wallet; invoices
- Epic 6: Admin & Analytics (W11–W12)
  - Dashboards, KPIs, revenue/booking reports, utilization
- Epic 7: Customer Experience (W12–W14)
  - i18n/multi-currency; loyalty; chat; ratings/reviews
- Epic 8: Security & Compliance (W1–W16 ongoing)
  - SSL, secure headers, rate limiting, GDPR, pen testing
- Epic 9: Deployment & Scaling (W10–W16)
  - Cloud infra, K8s, autoscaling, monitoring/logging
- Epic 10: Testing & Launch (W12–W16)
  - Unit/integration/E2E; UAT; final release

Milestones per epic include acceptance criteria and DOR/DOD; see docs/architecture.md.
