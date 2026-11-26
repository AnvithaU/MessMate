# MessMate — Premium Digital Mess Management Platform

MessMate is a production-quality, enterprise-grade digital mess management platform designed for college and university campuses (supporting 5,000+ students).

It replaces paper coupon systems, warden registers, and manual billing with an interactive, glassmorphic SaaS platform featuring **Universal QR identities**, **single-scan multi-item batch redemptions**, **add-on date calendar scheduling**, and an **append-only immutable financial ledger**.

---

## 🎨 Visual Identity & Design System

Inspired by the luxury aesthetics of EzeVisas, MessMate features **Premium Glassmorphism**:
- **Palette**: Deep forest green (`#0C3B2E`), Sage green (`#6D9773`), Burnt amber (`#B46617`), Warm cream (`#F5F1E8`), and Soft neutral (`#E9E6DD`).
- **Surfaces**: Frosted glass panels (`backdrop-filter: blur(16px)`), fine translucent borders, and ambient radial gradients.
- **Typography**: `DM Sans` for tabular numbers and readable data tables + `Cormorant Garamond` for headings and display cards.

---

## 🚀 Running the Application

### 1. Backend Server (Port 5000)
```bash
cd server
npm install
npm run dev
```
*Health Check: http://localhost:5000/api/health*

### 2. Frontend Client (Port 3000)
```bash
cd client
npm install
npm run dev
```
*Open in Browser: http://localhost:3000/*

---

## 🎭 Interactive Role Switcher & Demo Accounts

MessMate includes an interactive persona switcher in the top navigation bar to test all three roles:

| Role | Demo User | Email | Password | Key Capabilities |
|---|---|---|---|---|
| **🎓 Student** | Aarav Sharma (`2026CSE001`) | `aarav.sharma@messmate.edu` | `password123` | South vs North mess duel, Add-ons calendar, Universal QR wallet, Advance balance & Ledger |
| **🛡️ Warden / Admin** | Dr. K. Ramanathan | `warden@messmate.edu` | `admin123` | Real-time analytics, Student directory with bulk import & overrides, Mess/Addon rules, Final settlement |
| **⚡ Staff Scanner** | Rajesh Kumar | `staff@messmate.edu` | `staff123` | High-velocity camera QR scanner + quick simulation buttons, Today's entitlement deck, Atomic batch redemption |

---

## 🏛️ Architecture & Core Innovations

### 1. Database-Defined Role-Based Access Control (RBAC)
- User role (`student`, `admin`, `staff`) is stored as an authoritative column in the `users` table.
- Self-registration strictly defaults to `student` (ignoring any requested role).
- Role changes are restricted to authorized administrators and recorded in the audit log.
- Students cannot access other students' records; staff cannot access financial records.

### 2. Universal QR Coupon System
- Every student has **ONE permanent cryptographic QR identity**.
- Scanning the QR resolves all today's eligible entitlements together:
  - *South Mess Lunch* — Available
  - *Farm Fresh Milk* — Available
  - *Boiled Farm Eggs* — Available
  - *Coastal Fish Fry* — Not available today
  - *Tandoori Chicken* — Not available today
- Staff can check all available items and confirm redemption with **one single atomic batch click**.
- Concurrency-safe: Database transactions prevent duplicate redemptions across multiple counters.

### 3. Monthly Mess Selection (South Mess vs North Mess)
- Students independently select either South Mess or North Mess for each calendar month.
- Deadlines, prices, and locking dates are configured by the admin.
- Administrative overrides are audited with mandatory reasons.

### 4. Interactive Add-on Scheduling Calendar
- Add-ons are booked date-by-date (Milk daily, Egg Mon/Wed/Fri, Fish Tue, Ice Cream Thu, Chicken Sun).
- Unavailable dates are visibly disabled on the calendar with live cart calculation.

### 5. Append-Only Financial Ledger & Final Settlement Engine
- Every transaction (advance payments, monthly mess debits, add-on debits) is appended immutably to `financial_ledger`.
- Student balance is 100% mathematically reconstructable.
- Final settlement reconciles Total Advance Paid vs Total Charges:
  - If Advance > Charges: Calculates exact refund due to student.
  - If Charges > Advance: Calculates outstanding amount owed.
  - Issues official final settlement certificates.
