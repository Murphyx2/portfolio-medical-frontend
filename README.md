# MedicalConsultations — Frontend

React + Vite + TypeScript single-page application for a role-based clinic
management system. This is a **scoped-down demo branch** of a larger
production system — see [What's not included](#whats-not-included-in-this-demo)
below before judging feature completeness.

## Stack

- React 18 + Vite + TypeScript
- `react-i18next` — Spanish default, English alternate (`src/i18n/{es,en}.json`)
- React context for auth state (`src/store/auth.tsx`); no Redux/MobX —
  everything else is local component/page state
- Single fetch wrapper (`src/services/api.ts`) handling auth headers,
  401→refresh→retry, and error shaping
- A flat role/resource permission table (`src/utils/can.ts`) is the single
  source of truth for nav visibility, route gating, and every page-local
  "can I see this button" check

## What this demo shows

- **Role-based UI** — six roles (Admin/Doctor/Receptionist/IT/Nurse/Center
  Manager), each seeing a different nav, different fields, different actions
  on the same pages.
- **Patients** — encrypted-PII-backed CRUD with role-aware masking, guardian
  management for minors, phone/cédula validation.
- **Clinical charting** (Records) — draft/completed visit entries, vitals,
  personal/family history, image attachments.
- **Scheduling** — appointment lifecycle (scheduled → confirmed → completed),
  a calendar view, automatic no-show handling.
- **Doctors/Centers/Rooms/Services/Medicines** — reference-data management
  pages sharing one consistent list/form/RBAC pattern (`ListPage`, `can()`).

## Setup

```bash
npm install
npm run dev   # dev server on :5173, proxies /api and /media to the backend
```

Or run the full stack via Docker Compose from `../infra` (see that repo's
README). Once the backend is seeded (`manage.py seed_demo_data --confirm`),
log in with any of the demo accounts documented there.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b (type-check) + vite build — this is the CI gate
npm run test      # vitest run
```

Tests are colocated (`*.test.tsx` next to the page/component it covers).

## What's not included in this demo

This branch is deliberately scoped down from the full product:

- **Insurance (ARS) & negotiated pricing** pages
- **Encounters** (visit/admission tracking)
- **Communications** (patient WhatsApp/email, staff messaging)
- **Prescriptions** (dose builder, PDF generation)
- **Reportes** (operational/insurer-settlement reporting)

These are real, working pages on the full product — omitted here to keep
this demo focused on the core clinical/RBAC/security engineering, not to
hide unfinished work.

See `../infra/docs/architecture.md` for the full system design.
