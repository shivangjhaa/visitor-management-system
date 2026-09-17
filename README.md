# Visitor Management System 

A Node.js + Express + MongoDB backend for managing visitor appointments end-to-end — request, HOD approval, gate check-in/out, and gate pass generation — with a vanilla HTML/CSS/JS frontend (no build step).

## Tech Stack

- **Runtime:** Node.js (>=18) + Express
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (`jsonwebtoken`) + `bcryptjs`
- **Security/ops:** `helmet`, `express-rate-limit`, `morgan`, `cors`
- **File uploads:** `multer` (visitor check-in photos)
- **Email:** `nodemailer` (appointment/approval notifications)
- **PDF generation:** `pdfkit` (gate pass / visitor receipts)
- **Frontend:** static HTML/CSS/JS served from `public/`, no framework or build step

## Prerequisites

- Node.js v18+
- A running MongoDB instance (local or hosted, e.g. MongoDB Atlas)
- SMTP credentials if you want appointment/approval emails to actually send

## Setup

```bash
npm install
cp .env.example .env      # then edit MONGO_URI, JWT_SECRET, SMTP_*
npm run seed               # creates admin/user/security/hod demo logins + sample masters
npm run dev                 # or: npm start
```

Visit `http://localhost:5000`.

## Environment Variables

| Variable          | Description                                              |
|--------------------|-------------------------------------------------------------|
| `NODE_ENV`          | `development` or `production`                              |
| `PORT`              | Port the server listens on                                  |
| `APP_NAME`           | Display name used in server logs / branding                 |
| `COMPANY_NAME`       | Company name used in emails/branding                         |
| `MONGO_URI`          | MongoDB connection string                                    |
| `JWT_SECRET`         | Secret used to sign JWTs — use a long random value           |
| `JWT_EXPIRES_IN`     | Token lifetime (e.g. `8h`)                                    |
| `SMTP_HOST/PORT/USER/PASS` | SMTP credentials used by `services/emailService.js`     |
| `MAIL_FROM`          | From-address used on outgoing emails                          |

## Demo Accounts

There are **4 login roles**, each created via **Master > User Master** by an admin (`npm run seed` creates one of each to start with — printed by the script, and shown on the login page):

| Role       | Login                        | Access                                                              |
|------------|-------------------------------|-----------------------------------------------------------------------|
| Admin      | `admin@alokind.com` / `Admin@123` | Full access to everything                                          |
| User       | `user@alokind.com` / `User@123`   | Request for Visitor only                                            |
| Security   | `security@alokind.com` / `Security@123` | Visitor Entry + Out Pending List only                          |
| HOD        | `hod@alokind.com` / `Hod@123`     | Everything a **User** can do, plus HOD Approval for their department |

There is no self-registration; "user" and "employee" are the same concept — whoever an admin creates in User Master with role **User** gets exactly the rights to request visitor appointments. **HOD** is a superset of **User** — same rights, plus the approval queue for their own department.

> ⚠️ Demo credentials are for local development only — rotate or remove them before any production deployment.

## Sidebar Structure

```
Home
Master (admin only — navigated purely via the sidebar's own dropdown, no secondary in-page tab bar)
  User Master        — inline form (legacy-style): Emp Id, Name, Division, Department,
                        Location, User Role (Admin/User/Security/HOD), Mobile, Email,
                        Password, Active; "Select" in the table loads a row back into
                        the form to edit; Reset Password is a separate action next to Save
  Card Master, Visitor Category, Plant/Division/Location Master
  Department Master   — HOD and Delegate are now real User Master accounts (selected
                          from a dropdown, not free text). Only users with User Role
                          "HOD" can be picked as a department's HOD.
  Delegate Updation    — admin can manage any department's delegate here; a HOD sees
                          only their own department and can set/change their own
                          delegate without needing admin access.
Transaction
  Request for Visitor — user + admin + HOD: create a visitor appointment (Department is
                        required — it routes the request to that department's HOD).
                        The visitor is NOT emailed yet at this point.
  HOD Approval          — admin, or the HOD/Delegate for that specific department: click
                          a request to open it, add a remark, then Approve or Reject.
                            Approve → visitor is emailed their inward number for the first time.
                            Reject  → the requester (not the visitor) is emailed the remark.
  Visitor Entry        — security + admin: fetch by token, capture arrival + photo, check in, receipt auto-generated.
                        Only requests that were HOD-approved can be found here —
                        anything still PendingApproval/Rejected looks like "record not found".
  Out Pending List      — security + admin: everyone onsite, "Out" button to check out
Report (admin only)
  Visitor Report        — Type/Mobile/date-range filters, gate-register style columns (Token No,
                           Card No, In Date, In Time, Reason for Visit, Visitor Name, Representing,
                           Address, Mobile, Contact Person, Department, Category, Status), CSV export
  Visitor Receipt        — every gate pass/receipt issued, downloadable
Password Reset
```

### Roles: how HOD and Delegate actually work

- **HOD is a User Master role**, not a separate field somewhere else. Admin creates a user (e.g. Mathew Oommen Thomas), sets **User Role = HOD** and a **Department**, and that's it — this person is now that department's HOD. A HOD keeps every right a plain **User** has (Request for Visitor) and additionally sees **HOD Approval** in their Transaction menu, scoped to their own department.
- **Delegate is also a real user** (any existing User/HOD account), assigned per-department via **Master > Delegate Updation** — either by an admin, or by the HOD themselves for their own department. If the HOD is away, the registered delegate gets the same approval-request emails and the same Approve/Reject rights for that department, without needing to be an admin or getting their own separate department.
- Department Master's **HOD** and **Delegate** fields are dropdowns of real User Master accounts (not free-text names/emails) — picking someone there is what actually grants them approval rights.

### Request → HOD Approval → Security flow

1. **Request for Visitor** (user, HOD, or admin) — fills the form, picks a Department, generates an inward number. Status: `PendingApproval`. The department's HOD (and their currently-registered Delegate, if any) get an email asking them to review it in-app.
2. **HOD Approval** — the department's HOD, their Delegate, or an admin opens the request, adds a remark, and Approves or Rejects.
   - **Approved** → status becomes `Pending`; the *visitor* is emailed the appointment confirmation + inward number for the first time.
   - **Rejected** → status becomes `Rejected`; the *requester* (whoever raised the request) is emailed the rejection notice with the remark. The visitor is never contacted.
3. **Visitor Entry** (security) — fetches by inward number. Only `Pending` (approved) appointments are found; anything still `PendingApproval` or `Rejected` returns "record not found", exactly as if the number never existed.
4. **Out Pending List** (security) — records the exit once the visitor leaves.

## Project Layout

```
config/db.js                 Mongo connection
middleware/                  authMiddleware (JWT), errorMiddleware, upload (multer, for check-in photo)
models/                      User, Visitor, GatePass, + 6 master-data models (Department Master carries hod/delegate User refs)
controllers/                 auth, user (User Master), master (generic factory),
                              visitor, hod (HOD Approval), delegate (Delegate Updation), security, gatepass
routes/                      one file per resource, mounted in server.js
services/                    emailService (nodemailer), pdfService (PDFKit gate pass/receipt)
utils/                       asyncHandler, ApiError, generateToken, generateInwardNumber
public/                      static frontend (no build step) — see page map below
storage/uploads               visitor photos captured at check-in (camera or upload)
storage/gatepasses             generated gate pass / receipt PDFs
seed/seed.js                  one-off bootstrap data
```

### Frontend Page Map

| Page | Who | Purpose |
|---|---|---|
| `index.html` | anyone | Login |
| `home.html` | all roles | Dashboard stat tiles |
| `master.html?section=…` | admin | Master data, incl. User Master |
| `request-visitor.html` | user, hod, admin | Create appointment + own history |
| `hod-approval.html` | admin, hod (scoped to their department) | Click a request → review modal → remark + Approve/Reject |
| `delegate-updation.html` | admin, hod (scoped to their department) | Assign/clear a department's backup approver |
| `visitor-entry.html` | security, admin | Fetch by token, capture photo (live camera or upload), check in |
| `out-pending.html` | security, admin | Onsite list, "Out" to check out |
| `report-visitor.html` | admin | Date-range report + CSV export |
| `visitor-receipt.html` | admin | All issued gate pass receipts, downloadable |
| `password-reset.html` | all roles | Change own password |

## API Overview

All endpoints are prefixed with `/api`. Most routes require a `Bearer <token>` JWT (obtained via `/api/auth/login`) except `/api/auth/login` itself.

| Route              | Purpose                                             |
|----------------------|--------------------------------------------------------|
| `/api/auth`           | Login, current user, change password, admin-only register |
| `/api/users`          | User Master — update, activate/deactivate, reset password, delete |
| `/api/visitors`        | Visitor requests, approvals list, approve/reject, cancel, stats |
| `/api/security`        | Onsite list, verify by inward number, check-in, check-out |
| `/api/gatepass`         | List, generate, and download gate passes                |
| `/api/master`           | Generic CRUD for master data (cards, categories, plants, divisions, locations, departments) |
| `/api/delegate-updation` | List departments a HOD/admin can manage, list delegate candidates, set delegate |
| `/api/health`           | Health check                                             |

## Scripts

- `npm run dev` – start with nodemon (auto-restart)
- `npm start` – start normally
- `npm run seed` – seed demo departments, masters, and one user per role

## Changelog

- **v8 — HOD dashboard fix:** corrected the HOD dashboard/approvals behavior. *(Add specifics here — what was broken and what changed — so this entry is useful to future you and reviewers.)*

## Notes / Things to Revisit Before Production

- `helmet({ contentSecurityPolicy: false })` — CSP is disabled for the simple static frontend; tighten this once inline `<script>`/styles are removed.
- Email sending is fire-and-forget (won't block appointment creation if SMTP is down) — check server logs if visitors report not receiving mail.
- Gate pass PDFs and uploaded/captured photos are stored on local disk (`storage/`) — swap for S3/Blob storage before scaling beyond one instance.
- Live camera capture (`visitor-entry.html`) uses `getUserMedia` and requires either `localhost` or HTTPS to work in the browser — plan for TLS if the gate PC accesses the app over plain HTTP on the LAN.
- `generateInwardNumber` derives a daily sequence from `countDocuments`, which is fine at current volume but could be replaced with a dedicated MongoDB counter collection if concurrent check-ins ever get very high.

