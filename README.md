# AAROGYASETU (आरोग्यसेतु)
### “Healthcare Beyond Boundaries”
**Hackathon:** AIORA  
**Institution:** Karavali Institute of Technology  
**Deliverable:** Full Telemedicine Progressive Web App (PWA) Implementation

> **Prototype & Fictional Data Disclaimer:** This application is a hackathon prototype built for demonstration and educational evaluation. It uses **fictional demo data only** and is **not production-ready for real medical records or clinical care**.

---

## 1. Project Overview & Blueprint Modules

AAROGYASETU is an installable, mobile-first telemedicine Progressive Web App designed for rural and low-connectivity environments (2G/3G networks). Built with **React 18 + TypeScript + Vite** on the frontend, **Python FastAPI** on the backend, **SQLite** for local storage, and **HTML5 Canvas compression**.

### Implemented Modules:
1. **Patient Registration, Login & Detailed Clinical Profile:** Demographics, village/town, blood group, known allergies, chronic conditions, emergency contact, manual landmark, and SMS consent.
2. **Doctor Portal & Records:** Credentials (registration number, specialty, qualifications, clinic location, languages spoken, bio), weekly availability slots manager, and pending medical council review flow with demo quick-approval.
3. **Examiner Access (Read-Only Audit Mode):** Dedicated seeded Examiner account for AIORA hackathon evaluation. Full platform audit across appointments, SMS logs, reports, consultation notes, medicine schedules, and QR tokens with all mutations strictly blocked.
4. **Appointment Management & Zero-PHI SMS Engine:** Slot booking, status state-machine (`requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`), deduplication keys, and zero-PHI SMS notifications (Twilio integration or Demo SMS Outbox) that transmit no symptoms, diagnoses, or drug names.
5. **Consultation Messaging Workspace:** Real-time authorized consultation chat, read/delivered indicators, and low-bandwidth clinical quick-reply chips.
6. **Smart OCR Laboratory Report Review:** Client-side canvas image compression, side-by-side report viewer, machine-read disclaimer banner (*"Machine-Read — May Be Incomplete — Requires Doctor Review"*), editable parameter table, and doctor review sign-off.
7. **Clinical Consultation Notes:** Digitally signed clinical diagnoses, dietary and care advice, emergency red-flag triggers, and recommended follow-up dates.
8. **Doctor-Approved Medicine Schedules & Adherence:** Prescription builder (medicine, dose, morning/afternoon/night slots, meal timing, duration), patient dose check-in, and adherence percentage scoring.
9. **Tokenized QR Emergency Profile:** Ephemeral tokenized QR profile containing zero raw PHI in the barcode, configurable validity, and one-tap instant revocation.
10. **Emergency SOS & PHC Directory:** One-tap `CALL 108` emergency dialer, family emergency contact dialer, GPS/landmark coordinates, local 24x7 PHCs directory, and prominent **"No Auto-Dispatch"** legal warning banner.
11. **Bilingual Navigation & 2G Telemetry:** English (`EN`) and Hindi (`हिंदी`) navigation toggle, 2G Data Saver mode, and static PWA Service Worker caching.

---

## 2. Seeded Fictional Demo Credentials

The local database seeds ready-to-test fictional accounts for evaluation:

| Role | Full Name | Phone / Identifier | Email | Password | Access Level & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient** | **Ramesh Kumar** | `9876543210` | `ramesh.demo@aarogyasetu.local` | `patient123` | Patient Portal: All patient tabs, appointment booking, medicine reminders, QR profile, SOS |
| **Doctor** | **Dr. Priya Sharma** | `9123456780` | `dr.priya@aarogyasetu.local` | `doctor123` | Doctor Portal: Triage dashboard, appointment queue, OCR review, clinical notes, medicine prescribing |
| **Examiner** | **AIORA Hackathon Examiner** | `9900112233` | `examiner@aiora.karavali.edu` | `examiner123` | **Examiner Portal (Read-Only Audit)**: Platform-wide audit across appointments, SMS outbox, OCR reports, clinical notes, and QR tokens (mutations blocked) |

> **Examiner Note (Demo-Only):** The Examiner account is seeded strictly for evaluation. There is no public Examiner registration form. All data displayed is fictional demo data. Attempts by the Examiner account to send messages, modify profiles, or upload reports are blocked with HTTP `403 Forbidden`.

*(A second fictional patient `Sunita Devi` assigned to `Dr. Vikram Rao` is also seeded in SQLite so evaluators can verify that `Dr. Priya Sharma` cannot view or access unassigned patients.)*

---

## 3. Authentication, Registration & Domain Validation Rules

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

### Step 4: Run Automated Pytest Verification Suite
```powershell
cd d:\PROJECT
python -m pytest backend/test_milestone1.py -v
```

---

## 5. Environment Variables Reference

All variables are documented in [`.env.example`](file:///d:/PROJECT/.env.example):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `AAROGYASETU_SECRET_KEY` | *(dev fallback)* | Secret key used to sign HMAC-SHA256 authentication bearer tokens. |
| `AAROGYASETU_DB_PATH` | `backend/aarogyasetu_m1.db` | Path to the local SQLite database file. |
| `AAROGYASETU_PRIVATE_STORAGE_DIR` | `backend/private_reports` | Directory where uploaded medical reports are stored privately outside static web folders. |
| `AAROGYASETU_MAX_UPLOAD_MB` | `5` | Maximum allowed file upload size in megabytes (`5 MB`). |
| `AAROGYASETU_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed frontend origins for CORS. |
| `TWILIO_ACCOUNT_SID` | *(optional)* | Twilio Account SID for live SMS delivery. Leave blank to use the built-in Demo SMS Outbox. |
| `TWILIO_AUTH_TOKEN` | *(optional)* | Twilio Auth Token. |
| `TWILIO_PHONE_NUMBER` | *(optional)* | Twilio sender phone number. |
| `GEMINI_API_KEY` | *(optional)* | Google Gemini API key for dynamic AI assistant queries. Safe offline rule-based triage fallback included. |
| `EMERGENCY_PHONE_NUMBER` | `108` | National ambulance and emergency service dispatch phone number in India. |

---

## 6. How to Install the PWA on Mobile & Desktop

**AAROGYASETU (आरोग्यसेतु)** is an installable Progressive Web App with `/manifest.json`, `/sw.js`, and home-screen icons:

1. **Desktop (Google Chrome / Microsoft Edge):**
   - Open `http://localhost:5173`.
   - Click the **“Install App (PWA)”** button in the header bar or the install icon in the address bar.
2. **Android Phone (Chrome / Edge):**
   - Access the app over `localhost` or HTTPS, tap the browser menu (`⋮`), and choose **“Install app”** or **“Add to Home screen”**.
3. **iPhone / iPad (Safari):**
   - Tap the **Share** button in Safari and select **“Add to Home Screen”**.

> **Privacy Note:** The Service Worker caches **only the static application shell** (`index.html`, CSS, JS, and icons) and **never caches sensitive patient profiles, consultation messages, or medical reports offline**.
