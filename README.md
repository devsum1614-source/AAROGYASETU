# AAROGYASETU (आरोग्यसेतु)
### “Healthcare Beyond Boundaries”
**Hackathon:** AIORA  
**Institution:** Karavali Institute of Technology  
**Deliverable:** Full Telemedicine Progressive Web App (PWA) Implementation

## 🌐 Live Website Link (Open on Any Mobile or Desktop from Any Network)
👉 **[Click Here to Open Live AAROGYASETU Website: https://devsum1614-source.github.io/AAROGYASETU/](https://devsum1614-source.github.io/AAROGYASETU/)**

- **Patient Portal Demo:** `9876543210` / `patient123` *(or click `+ New Patient? Register Here` to create your own account)*
- **Doctor Portal Demo:** `9123456780` / `doctor123` *(or click `+ New Doctor? Register Here` to create your own account)*

---

## 1. Project Overview & Blueprint Modules

AAROGYASETU is an installable, mobile-first telemedicine Progressive Web App designed for rural and low-connectivity environments (2G/3G networks). Built with **React 18 + TypeScript + Vite** on the frontend, **Python FastAPI** on the backend, **SQLite** for local storage, and **HTML5 Canvas compression**.

### Implemented Modules:
1. **Patient Registration, Login & Detailed Clinical Profile:** Any new user can register and sign in immediately with their phone number or email. Collects demographics, village/town, blood group, known allergies, chronic conditions, emergency contact, manual landmark, and SMS consent.
2. **Doctor Portal & Records:** Instant registration and sign-in for doctors with credentials (registration number, specialty, qualifications, clinic location, languages spoken, bio) and weekly availability slots manager.
3. **Appointment Management & Zero-PHI SMS Engine:** Slot booking, status state-machine (`requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`), deduplication keys, and zero-PHI SMS notifications (Twilio integration or Demo SMS Outbox) that transmit no symptoms, diagnoses, or drug names.
4. **Consultation Messaging Workspace:** Real-time authorized consultation chat, read/delivered indicators, and low-bandwidth clinical quick-reply chips.
5. **Smart OCR Laboratory Report Review:** Client-side canvas image compression, side-by-side report viewer, machine-read disclaimer banner (*"Machine-Read — May Be Incomplete — Requires Doctor Review"*), editable parameter table, and doctor review sign-off.
6. **Clinical Consultation Notes:** Digitally signed clinical diagnoses, dietary and care advice, emergency red-flag triggers, and recommended follow-up dates.
7. **Doctor-Approved Medicine Schedules & Adherence:** Prescription builder (medicine, dose, morning/afternoon/night slots, meal timing, duration), patient dose check-in, and adherence percentage scoring.
8. **Tokenized QR Emergency Profile:** Ephemeral tokenized QR profile containing zero raw PHI in the barcode, configurable validity, and one-tap instant revocation.
9. **Emergency SOS & PHC Directory:** One-tap `CALL 108` emergency dialer, family emergency contact dialer, GPS/landmark coordinates, local 24x7 PHCs directory, and prominent **"No Auto-Dispatch"** legal warning banner.
10. **Bilingual Navigation & 2G Telemetry:** English (`EN`) and Hindi (`हिंदी`) navigation toggle, 2G Data Saver mode, and static PWA Service Worker caching.

---

## 2. User Registration & Sample Credentials

Any new user can register a **Patient** or **Doctor** account directly from the login page (`+ New Patient? Register Here` / `+ New Doctor? Register Here`) and sign in immediately.

In addition, two sample accounts are pre-seeded for quick testing:

| Role | Full Name | Phone / Identifier | Email | Password | Access Level & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient** | **Ramesh Kumar** | `9876543210` | `ramesh.demo@aarogyasetu.local` | `patient123` | Patient Portal: All patient tabs, appointment booking, medicine reminders, QR profile, SOS |
| **Doctor** | **Dr. Priya Sharma** | `9123456780` | `dr.priya@aarogyasetu.local` | `doctor123` | Doctor Portal: Triage dashboard, appointment queue, OCR review, clinical notes, medicine prescribing |

---

## 3. Authentication, Registration & Domain Validation Rules

- **Database-Connected Login Rule:** Users may sign in only when their normalized email or phone number matches an existing database account and the password matches the PBKDF2 hash.
- **Instant New User Registration:** Both new patients and new doctors can register their accounts and sign in immediately with their registered phone number or email and password.
- **Unregistered Email / Random Gmail Blocking:** Unregistered email addresses (including arbitrary `@gmail.com` addresses) are rejected with a generic `401 Unauthorized` error (`"Email or password is incorrect"`). Accounts are never automatically created upon login.
- **Email Domain Policy (`AAROGYASETU_ALLOWED_EMAIL_DOMAINS`):** By default, `*` is configured so that any valid email domain (including Gmail) can be registered. If an institution restricts registrations to an approved domain (e.g. `kit.edu.in,karavali.edu.in`), the administrator sets `AAROGYASETU_ALLOWED_EMAIL_DOMAINS` in `.env`.
- **Rate Limiting & Temporary Lockout:** After 5 consecutive failed login attempts on the same identifier within 5 minutes, the account is temporarily locked for 10 minutes (`429 Too Many Requests`).
- **Data Trimming & Format Validation:** Phone numbers (7–15 digits) and emails are strictly validated with regular expressions on both frontend and backend.

---

## 4. Setup & Run Commands

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
