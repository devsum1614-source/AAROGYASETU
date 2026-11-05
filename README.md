# AAROGYASETU (आरोग्यसेतु)
### “Healthcare Beyond Boundaries”
**Hackathon:** AIORA  
**Institution:** Karavali Institute of Technology  
**Deliverable:** Milestone 1 Working Prototype (Installable Mobile-First Telemedicine PWA)

> **Prototype & Fictional Data Disclaimer:** This application is a hackathon prototype built for demonstration and educational evaluation. It uses **fictional demo data only** and is **not production-ready for real medical records or clinical care**.

---

## 1. Implementation Plan & Milestone 1 Scope

This first working milestone implements the core foundation end-to-end across a **React + TypeScript + Vite Progressive Web App (PWA)** frontend, a **Python FastAPI** REST API backend, a local **SQLite** database, and **private local file storage**:

| Stage | Module | What Is Implemented in Milestone 1 |
| :--- | :--- | :--- |
| **Stage 1** | **Database, Auth & RBAC** | SQLite schema (`users`, `patient_profiles`, `doctor_profiles`, `consultations`, `messages`, `reports`), `PBKDF2-HMAC-SHA256` password hashing, signed bearer tokens, and strict consultation-scoped authorization. |
| **Stage 2** | **Patient Portal** | Patient registration, sign-in, profile viewer/editor (full name, phone, optional email, age/DOB, gender, village/town/address, emergency contact name & phone), and consultation list. |
| **Stage 3** | **Doctor Portal** | Separate doctor sign-in, profile editor (full name, phone, email, specialty, clinic name & location, languages spoken, short biography), and assigned patient consultation list (`pending` approval state for self-registered doctors). |
| **Stage 4** | **Online Messaging** | Text-first consultation messaging stored in SQLite, showing sender, timestamp, and delivery state (`sending`, `sent`, `failed`), periodic 4-second incremental polling, and one-tap **Retry Send** (`client_message_id` deduplication). |
| **Stage 5** | **Report Upload & Image Compression** | Browser-side HTML5 `<canvas>` compression for JPEG, PNG, and WebP images; displays actual original & compressed sizes, image preview, live upload progress (`0%–100%`), retry option, private storage (`backend/private_reports/`), and permission-checked viewing. |
| **Stage 6** | **PWA & Low-Bandwidth Shell** | Web App Manifest (`/manifest.json`), app icons, online/offline indicator, and a Service Worker (`/sw.js`) that caches **only the static app shell** and never caches sensitive profiles, messages, or medical reports. |

*Extensibility Note:* Appointment slot booking, SMS updates, AI health assistant, OCR extraction, QR medical sharing, medicine reminders, and Emergency SOS are **not** implemented in Milestone 1. The backend schema and frontend components are modular so those features can be added cleanly in subsequent milestones.

---

## 2. Project Folder Structure

```text
d:\PROJECT\
├── .env.example                 # Environment variable template for secrets & paths
├── .gitignore                   # Excludes secrets, SQLite DBs, private uploads, node_modules & build caches
├── README.md                    # Setup guide, demo credentials, env vars, troubleshooting & PWA steps
├── start_backend.bat            # One-click script to start FastAPI backend (port 8000)
├── start_frontend.bat           # One-click script to start Vite PWA dev server (port 5173)
├── start_aarogyasetu.bat        # Launches both backend and frontend servers
├── outputs/
│   ├── AAROGYASETU_Project_Blueprint.pdf  # Visual Project Blueprint PDF
│   ├── AAROGYASETU_Project_Blueprint.md   # Editable Markdown Blueprint source
│   └── assets/                            # Original blueprint diagrams & wireframe assets
├── backend/
│   ├── __init__.py
│   ├── config.py                # Environment variable loader & path configuration
│   ├── auth.py                  # PBKDF2-HMAC-SHA256 password hashing & HMAC bearer tokens
│   ├── database.py              # SQLite schema & fictional demo data seeder
│   ├── schemas.py               # Pydantic v2 request/response schemas
│   ├── main.py                  # FastAPI REST API routes & consultation-scoped RBAC checks
│   ├── requirements.txt         # Python dependencies
│   ├── test_milestone1.py       # Automated pytest verification suite
│   └── private_reports/         # Private report storage (excluded from Git & public static mounts)
└── frontend/
    ├── index.html               # App shell HTML with manifest & theme-color meta tags
    ├── package.json             # React 18, TypeScript & Vite scripts
    ├── tsconfig.json            # Strict TypeScript compiler configuration
    ├── vite.config.ts           # Vite dev server & /api proxy to port 8000
    ├── public/
    │   ├── manifest.json        # PWA Web App Manifest
    │   ├── sw.js                # Service Worker (caches static app shell only; never caches PHI)
    │   ├── icon-192.png         # 192x192 PWA home-screen icon
    │   ├── icon-512.png         # 512x512 PWA splash/install icon
    │   └── icon.svg             # Vector app icon
    └── src/
        ├── main.tsx             # React entry point & Service Worker registration
        ├── App.tsx              # Navy Blue header branding, online/offline status & role router
        ├── api.ts               # Typed REST API client with XMLHttpRequest upload progress
        ├── types.ts             # TypeScript interfaces
        ├── styles.css           # Navy Blue, White & Light Grey mobile-first design system
        ├── components/
        │   ├── AuthView.tsx              # Welcome, Sign-In & Registration screen
        │   ├── PatientPortal.tsx         # Patient dashboard, consultations, reports & profile
        │   ├── DoctorPortal.tsx          # Doctor dashboard, assigned patients & profile
        │   └── ConsultationWorkspace.tsx # Messaging thread & Canvas image compression uploader
        └── utils/
            └── compressImage.ts          # Browser HTML5 Canvas image compression utility
```

---

## 3. Seeded Fictional Demo Credentials

The database seeds ready-to-test consultations (`CONS-101` and `CONS-102`) with sample messages and a sample compressed blood test report:

| Portal Role | Full Name | Phone / Identifier | Email | Password | Access Level & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient** | **Ramesh Kumar** | `9876543210` | `ramesh.demo@aarogyasetu.local` | `patient123` | Patient Portal: `CONS-101` (Assigned to Dr. Priya Sharma) |
| **Doctor** | **Dr. Priya Sharma** | `9123456780` | `dr.priya@aarogyasetu.local` | `doctor123` | Doctor Portal: Assigned patient consultations only (`CONS-101`) |
| **Examiner** | **AIORA Hackathon Examiner** | `9900112233` | `examiner@aiora.karavali.edu` | `examiner123` | **Examiner Portal (Read-Only Audit)**: Platform-wide consultation & report review (mutations blocked) |

> **Examiner Note (Demo-Only):** The Examiner account is seeded strictly for evaluation. There is no public Examiner registration form. All data displayed is fictional demo data. Attempts by the Examiner account to send messages, modify profiles, or upload reports are blocked with HTTP `403 Forbidden`.

*(A second fictional patient `Sunita Devi` assigned to `Dr. Vikram Rao` is also seeded in SQLite so evaluators can verify that `Dr. Priya Sharma` cannot view or access unassigned patients.)*

---

## 4. Authentication, Registration & Domain Validation Rules

- **Database-Connected Login Rule:** Users may sign in only when their normalized email or phone number matches an existing database account, the password matches the PBKDF2 hash, and the account is active/approved for that role.
- **Unregistered Email / Random Gmail Blocking:** Unregistered email addresses (including arbitrary `@gmail.com` addresses) are rejected with a generic `401 Unauthorized` error (`"Email or password is incorrect"`). Accounts are never automatically created upon login.
- **Email Domain Policy (`AAROGYASETU_ALLOWED_EMAIL_DOMAINS`):** By default, `*` is configured so that any valid email domain (including Gmail) can be registered. If the institution restricts registrations to an approved domain (e.g. `kit.edu.in,karavali.edu.in`), the administrator sets `AAROGYASETU_ALLOWED_EMAIL_DOMAINS` in the `.env` configuration.
- **Rate Limiting & Temporary Lockout:** After 5 consecutive failed login attempts on the same identifier within 5 minutes, the account is temporarily locked for 10 minutes (`429 Too Many Requests`).
- **Data Trimming & Format Validation:** Phone numbers (7–15 digits) and emails are strictly validated with regular expressions on both frontend and backend. Rejected submissions are never saved to SQLite.

---

## 4. Beginner-Friendly Setup & Run Commands

### Step 1: Configure Environment Variables (Optional)
The app works out-of-the-box with safe local defaults. To customize settings, copy `.env.example` to `.env`:
```powershell
cd d:\PROJECT
Copy-Item .env.example .env
```

### Step 2: Start the Python FastAPI Backend (Terminal 1)
```powershell
cd d:\PROJECT
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- Backend API Health Check: `http://localhost:8000/api/health`
- Interactive Swagger / OpenAPI Docs: `http://localhost:8000/docs`

### Step 3: Start the React + TypeScript + Vite Frontend (Terminal 2)
```powershell
cd d:\PROJECT\frontend
npm.cmd install
npm.cmd run dev
```
- Open **`http://localhost:5173`** in your browser.
- *(Tip: On Windows, you can also double-click `start_aarogyasetu.bat` in `d:\PROJECT` to launch both servers automatically.)*

### Step 4: Run Automated Pytest Verification
```powershell
cd d:\PROJECT
python -m pytest backend/test_milestone1.py -v
```

---

## 5. Environment Variables Reference

All variables are documented in [`.env.example`](file:///d:/PROJECT/.env.example):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `AAROGYASETU_SECRET_KEY` | *(dev fallback)* | Secret key used to sign HMAC-SHA256 authentication bearer tokens. Set a strong secret in `.env`. |
| `AAROGYASETU_DB_PATH` | `backend/aarogyasetu_m1.db` | Path to the local SQLite database file. |
| `AAROGYASETU_PRIVATE_STORAGE_DIR` | `backend/private_reports` | Directory where uploaded medical reports are stored privately outside static web folders. |
| `AAROGYASETU_MAX_UPLOAD_MB` | `5` | Maximum allowed file upload size in megabytes (`5 MB`). |
| `AAROGYASETU_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed frontend origins for CORS. |
| `VITE_API_BASE_URL` | *(empty — uses `/api` proxy)* | Optional base URL if the frontend is hosted on a separate origin from the backend. |

---

## 6. How to Install the PWA on a Phone or Desktop Browser

**AAROGYASETU (आरोग्यसेतु)** is an installable Progressive Web App with `/manifest.json`, `/sw.js`, and home-screen icons:

1. **Desktop (Google Chrome / Microsoft Edge):**
   - Open `http://localhost:5173` (or `http://localhost:8000`).
   - Click the **“Install App (PWA)”** button in the top header bar or the install icon on the right side of the browser address bar.
2. **Android Phone (Chrome / Edge):**
   - Access the app over `localhost` (via USB port-forwarding `chrome://inspect`) or HTTPS, tap the browser menu (`⋮`), and choose **“Install app”** or **“Add to Home screen”**.
3. **iPhone / iPad (Safari):**
   - Tap the **Share** button in Safari and select **“Add to Home Screen”**.

> **Browser & Device Differences:** PWA installation prompts, standalone launch behavior, and capabilities vary by browser and operating system (for example, mobile browsers require `localhost` or `HTTPS` to activate Service Workers). For privacy, the Service Worker caches **only the static application shell** (`index.html`, CSS, JS, and icons) and **never caches sensitive patient profiles, consultation messages, or medical reports offline**.

---

## 7. Troubleshooting

- **PowerShell `npm.ps1 cannot be loaded because running scripts is disabled`:**
  Use `npm.cmd install` and `npm.cmd run dev` instead of `npm`, or use the provided `start_frontend.bat` script.
- **`node` or `npm` is not recognized in a new terminal:**
  If Node.js is not in your global Windows `PATH`, run `start_frontend.bat` (which automatically adds the portable Node.js binary if present) or install Node.js LTS from `https://nodejs.org`.
- **Port `8000` or `5173` is already in use:**
  Stop any previous terminal running `uvicorn` or `vite`, or change the port with `--port 8001`.
- **Resetting the local demo database:**
  Stop the backend, delete `backend/aarogyasetu_m1.db`, and restart the backend—it will automatically recreate all tables and re-seed the fictional demo accounts (`Ramesh Kumar` and `Dr. Priya Sharma`).
