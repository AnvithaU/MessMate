# MessMate – Smart Hostel Mess Management System

**Smarter Mess Management. Better Campus Dining.**

MessMate is a centralized digital hostel mess management platform designed for NMAM Institute of Technology (NMAMIT). It aims to modernize traditional mess operations by bringing student subscriptions, monthly food selections, QR-based redemption, financial tracking and administrative management into one unified system.

Designed with scalability in mind, MessMate aims to support campus environments with 5,000+ students while improving operational efficiency, financial transparency and accountability.

## Overview

Traditional hostel mess management often relies on paper coupons, manual registers and disconnected billing processes. These methods can lead to inaccurate records, administrative overhead, limited transparency and food wastage.

MessMate provides a unified digital alternative.

Students can:
- Select North Indian or South Indian mess plans for the upcoming month.
- Select available food add-ons as part of their monthly subscription.
- Use one permanent QR identity for eligible meal and add-on redemption.
- View their subscription history, redemption records and financial information.

Staff can scan student QR codes and process eligible redemptions.

Wardens can monitor hostel-level mess operations, student subscriptions and relevant reports.

Administrators can manage students, staff, wardens, mess plans, add-ons, pricing, schedules and financial records.

## Key Features

### 1. Monthly Mess Selection

- Students select either North Indian or South Indian mess for an upcoming calendar month.
- The selection window runs from the 25th through the last calendar day of the current month.
- Mess selection and add-on selection are submitted together.
- Historical subscriptions are preserved after the selection window closes.
- Authorized administrative overrides are subject to audit logging.

### 2. Monthly Add-on Selection

Available add-ons include:
- Milk
- Egg
- Chicken
- Fish
- Ice cream

Students select their desired add-ons for the upcoming month.

The system maintains date-based entitlements according to configured add-on schedules. Actual redemption is tracked separately from monthly selection.

### 3. Universal QR Identity

- Each student has one permanent QR identity.
- A single scan retrieves the student's eligible items.
- Staff can process multiple eligible items through a batch redemption workflow.
- Duplicate redemptions are prevented through backend validation and database transaction handling.

### 4. Financial Management

MessMate includes a financial tracking system designed around transparent transaction records.

Key capabilities include:
- Advance payment recording.
- Semester-wise payment allocation.
- Monthly mess and add-on charges.
- Student balance tracking.
- Transaction history and financial ledger.
- Refund and final settlement calculations.
- Administrative financial reports.

Financial records should reflect verified deposits and actual charges. Corrections should be traceable through auditable adjustments rather than silent changes to historical transactions.

### 5. Role-Based Access Control

MessMate supports four distinct roles:

| Role | Responsibilities |
|---|---|
| Student | Monthly selections, QR wallet, history and financial information |
| Staff | QR scanning, student lookup and redemption |
| Warden | Hostel-level monitoring, student records and operational reports |
| Admin | System configuration, user management, pricing, financial oversight and audit logs |

Roles are enforced on the backend. Users cannot grant themselves elevated privileges through frontend controls.

### 6. Administrative Management

Administrative functionality includes:
- Student and staff management.
- Warden and hostel/block assignments.
- Mess plan configuration.
- Add-on pricing and schedule management.
- Selection-window configuration.
- Financial monitoring.
- Audit logs and operational reports.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Backend | Node.js, TypeScript, Express |
| Database | SQLite / LibSQL |
| ORM | Drizzle ORM |
| Communication | REST APIs |
| QR Workflow | Permanent QR identity and backend-validated redemption |

## Project Architecture

```text
MessMate/
│
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── portals/
│       │   ├── admin/
│       │   ├── auth/
│       │   ├── scanner/
│       │   └── student/
│       ├── services/
│       └── utils/
│
├── server/
│   ├── data/
│   ├── scripts/
│   └── src/
│       ├── db/
│       ├── middlewares/
│       ├── routes/
│       ├── services/
│       └── types/
│
├── package.json
├── package-lock.json
├── README.md
└── run_messmate.bat
```

The frontend communicates with the Express backend through REST APIs. The backend manages authentication, role authorization, business rules, database operations and transaction validation.

All portals use the same backend and database as their source of truth.

## Running the Application Locally

### Prerequisites

- Node.js
- npm
- Git

### 1. Install Backend Dependencies

```powershell
cd server
npm install
```

### 2. Start the Backend

```powershell
npm run dev
```

The backend runs on port **5000**.

Health check:

`http://localhost:5000/api/health`

### 3. Install Frontend Dependencies

Open another terminal:

```powershell
cd client
npm install
```

### 4. Start the Frontend

```powershell
npm run dev
```

Open the local URL printed by Vite in the terminal.

## Database and Data Management

MessMate uses SQLite/LibSQL with Drizzle ORM.

The local development database is stored at:

```text
server/data/messmate.db
```

Database files are excluded from Git to prevent accidental publication of local data.

The application uses a shared database for student subscriptions, add-on entitlements, QR redemptions and financial records.

**Important:** Keep regular backups of the local database. Do not delete or recreate it when updating application code.

## Design Philosophy

MessMate uses a premium visual identity inspired by modern glassmorphic SaaS applications.

The design direction includes:
- Deep forest green.
- Champagne gold.
- Sage and emerald accents.
- Warm ivory and neutral surfaces.
- Frosted-glass panels and subtle translucent borders.
- Clean typography and readable data visualizations.
- Responsive layouts and restrained micro-interactions.

The visual experience is designed to feel professional, accessible and consistent across all four portals.

## Project Goals

MessMate aims to:
1. Digitize hostel mess subscription and redemption workflows.
2. Reduce manual administration and record-keeping.
3. Improve financial transparency for students and administrators.
4. Prevent duplicate meal and add-on claims.
5. Improve food preparation estimates using historical consumption data.
6. Reduce food wastage and improve operational planning.
7. Provide a scalable foundation for managing large student populations.

---

**MessMate – Smarter Mess Management. Better Campus Dining.**

Developed for the NMAMIT hostel ecosystem.