# IRIS — Institutional Physical Asset Registry & Verification System
**NIT Tiruchirappalli** | v1.0

A full-stack departmental physical asset registration, bulk import, QR-code based physical verification, and inventory audit system built for academic departments and central administration.

---

## 🛠️ Technology Stacks

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + Python 3.12 + SQLAlchemy 2.0 (async pg)
- **Database**: PostgreSQL 16
- **Authentication**: JWT stored in secure `HttpOnly`, `SameSite=Lax` cookies
- **Containerization**: Docker & Docker Compose

---

## 🚀 Quick Start

Ensure you have Docker and Docker Compose installed, then run:

```bash
cd nitinventory
docker compose up --build
```

The system initializes automatically:
1. **`nitinventory-db`** — PostgreSQL database (port `5432`)
2. **`nitinventory-backend`** — FastAPI backend (port `8000`), automatically runs migrations and seeds demo data on start
3. **`nitinventory-frontend`** — React SPA dev server (port `5173`)

Access the application at: **[http://localhost:5173](http://localhost:5173)**

---

## 👤 User Roles & Demo Logins (Password: `password`)

The system features granular role-based access control (RBAC) to separate duties between global admins, department heads, and faculty custodians:

| Email | Role | Scope & Permissions |
|-------|------|-------|
| `admin@nitt.edu` | Administrator | Global access to all departments, confirm asset disposals, bulk-import assets across all departments, and manage users. |
| `hod.cse@nitt.edu` | Head of Department | CSE department manager. Can register assets, bulk-import department assets, log movements, flag disposals, and perform physical verifications. |
| `faculty.cse@nitt.edu` | Faculty Custodian | CSE department viewer/custodian. Can view assets assigned to their care and view department registers. |

---

## 🔑 Core Features & Inventory Modules

### 1. Manual Asset Registration & Detail Logging
- Capture comprehensive metadata for each physical asset:
  - **Identities**: Asset Name, Serial Number, Manufacturer details, Category (Computer Hardware, Lab Equipment, Furniture, Other).
  - **Finances & Procurement**: Unit Cost, Funding Source (Plan Fund, Research Project, Development Fund, etc.), Supplier Name, Supplier Address.
  - **References**: Bill Number, Bill Date, Delivery Date, Departmental Stock Register Volume & Page.
  - **Location & Custody**: Building, Room, and Custodian In-Charge.

### 2. Transactional Bulk Asset CSV Import
- Allows Department Heads (HODs) and Administrators to upload CSV files to bulk-register thousands of assets at once.
- **Strict Verification & Atomicity**: The entire import is fully transactional. If a single row contains invalid data (e.g. malformed date, duplicate tags, or missing fields), the database operation is rolled back completely to prevent state corruption.
- **Security Scoping**: HOD imports are automatically locked to their respective department, while Administrators can import assets across different departments via the `department_code` column.

### 3. QR-Code Generation & Public Scanning Profiles
- Registered assets automatically receive a unique, database-tracked asset tag and a corresponding QR code.
- **Public Profile Access**: Scanning the QR code takes any auditor or student to a public, authentication-free profile page that displays the asset's name, tag, current location, custodian, and department.

### 4. Physical Audit & Verification
- HODs and Admins can perform and log physical inventory audits.
- Clicking **Verify Asset** updates the asset's record with a timestamp of physical verification and logs the audit action.

### 5. Movement Tracking & Audit Logs
- **Asset Movements**: Log the relocation of an asset from one building/room to another, specifying a reason for relocation.
- **Asset History Logs**: Every modification, relocation, verification, and condition change is logged automatically in the `AssetLog` database table, keeping a tamper-resistant history of who performed the action and what values were changed.

### 6. Disposal Registry
- HODs can flag damaged, broken, or obsolete assets for disposal.
- Global Administrators review flagged items and confirm final disposal, updating the asset registry status.

### 7. Departmental Register Exports (Excel & PDF)
- Generate professional departmental registers in two formats:
  - **Excel Export**: Generates a custom styled, auto-width-adjusted sheet using `openpyxl` with custom zebra fills and table headers.
  - **PDF Export**: Generates printable landscape A3 register reports via `weasyprint` featuring institutional branding and headers.

---

## 📁 Directory Structure

```
nitinventory/
├── backend/                  FastAPI + SQLAlchemy backend
│   ├── app/
│   │   ├── core/             DB configuration, auth, dependencies
│   │   ├── models/           SQLAlchemy models (Asset, AssetMovement, AssetLog, User, etc.)
│   │   ├── routers/          REST endpoints (Auth, Assets, Admin, Inventory)
│   │   └── services/         Core asset management and CSV parsing services
│   ├── alembic/              Database migrations
│   └── seed.py               Data seed script
├── frontend/                 React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/       Shared assets and layout subcomponents
│   │   │   └── assets/       CSV Upload, Form, & Listing tables
│   │   ├── pages/            Views (Login, Dashboard, Assets, AssetDetail, AssetImport, ProfilePage)
│   │   ├── context/          Auth & Context providers
│   │   └── services/         Axios setup and endpoints integration
│   └── vite.config.ts        Vite build configuration
└── docker-compose.yml        Local development docker setup
```
