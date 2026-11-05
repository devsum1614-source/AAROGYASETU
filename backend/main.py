"""
FastAPI Backend for AAROGYASETU (आरोग्यसेतु) — Milestone 1
Tagline: “Healthcare Beyond Boundaries”
Hackathon: AIORA | Institution: Karavali Institute of Technology

Milestone 1 Scope:
  1. Patient registration and profile
  2. Doctor portal (with consultation-scoped patient access)
  3. Online messaging and consultation
  4. Medical report upload and client-side image compression
"""
from __future__ import annotations

import io
import os
import re
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from PIL import Image

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_doctor,
    require_examiner,
    require_patient,
    revoke_access_token,
    verify_password,
)
from .config import (
    ALLOWED_EMAIL_DOMAINS,
    CORS_ORIGINS,
    LOGIN_LOCKOUT_SECONDS,
    LOGIN_MAX_FAILED_ATTEMPTS,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_MB,
    PRIVATE_REPORTS_DIR,
)
from .database import get_db, init_db, utc_now_iso
from .schemas import (
    DoctorProfileUpdateRequest,
    DoctorRegisterRequest,
    LoginRequest,
    MessageCreateRequest,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
)

# In-memory tracking for failed login attempts (identifier -> list of failed attempt timestamps)
_FAILED_LOGINS: Dict[str, List[float]] = {}
_LOCKOUT_UNTIL: Dict[str, float] = {}

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _check_login_rate_limit(ident: str) -> None:
    now = time.time()
    lockout = _LOCKOUT_UNTIL.get(ident, 0.0)
    if lockout > now:
        remaining = int(lockout - now)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked for {remaining} seconds. Please try again later.",
        )
    # Prune failed attempts older than 5 minutes
    if ident in _FAILED_LOGINS:
        _FAILED_LOGINS[ident] = [t for t in _FAILED_LOGINS[ident] if (now - t) < 300]


def _record_failed_login(ident: str) -> None:
    now = time.time()
    attempts = _FAILED_LOGINS.setdefault(ident, [])
    attempts.append(now)
    if len(attempts) >= LOGIN_MAX_FAILED_ATTEMPTS:
        _LOCKOUT_UNTIL[ident] = now + LOGIN_LOCKOUT_SECONDS
        _FAILED_LOGINS[ident] = []


def _record_successful_login(ident: str) -> None:
    _FAILED_LOGINS.pop(ident, None)
    _LOCKOUT_UNTIL.pop(ident, None)


def _validate_email_domain(email: str) -> None:
    """Enforces administrator-configured email domain allowlist if configured."""
    if not ALLOWED_EMAIL_DOMAINS or "*" in ALLOWED_EMAIL_DOMAINS:
        return
    parts = email.split("@")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    domain = parts[1].lower().strip()
    if domain not in ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"Email domain '@{domain}' is not authorized. Allowed domains: {', '.join(ALLOWED_EMAIL_DOMAINS)}",
        )


app = FastAPI(
    title="AAROGYASETU (आरोग्यसेतु) API — Milestone 1",
    description=(
        "Healthcare Beyond Boundaries — Installable Low-Bandwidth Telemedicine PWA Prototype "
        "(Hackathon | Karavali Institute of Technology). Fictional demo data only."
    ),
    version="1.0.0",
)

app.add_middleware(GZipMiddleware, minimum_size=400)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

init_db()


# ==================== HELPER FUNCTIONS ====================


def _build_user_profile_Response(conn: sqlite3.Connection, user_id: int) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, role, full_name, phone, email, approval_status, is_demo, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    u = cur.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    user_dict = dict(u)

    if user_dict["role"] == "patient":
        cur.execute("SELECT * FROM patient_profiles WHERE user_id = ?", (user_id,))
        prof = cur.fetchone()
        user_dict["patient_profile"] = dict(prof) if prof else None
    elif user_dict["role"] == "doctor":
        cur.execute("SELECT * FROM doctor_profiles WHERE user_id = ?", (user_id,))
        prof = cur.fetchone()
        user_dict["doctor_profile"] = dict(prof) if prof else None

    return user_dict


def _get_authorized_consultation(
    conn: sqlite3.Connection, consultation_id: int, current_user: Dict[str, Any]
) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.specialty AS doctor_specialty,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location,
            dp.languages_spoken AS doctor_languages,
            dp.bio AS doctor_bio
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE c.id = ?
        """,
        (consultation_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    cons = dict(row)
    uid = int(current_user["sub"])
    role = current_user["role"]

    # Examiner has read-only access to all consultations for evaluation purposes
    if role == "examiner":
        return cons

    if role == "patient" and cons["patient_id"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Patients can access only their own consultations.",
        )
    if role == "doctor":
        if current_user.get("approval_status", "approved") != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Doctor account is pending approval.",
            )
        if cons["doctor_id"] != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Doctors can access only patients assigned to their consultations.",
            )

    return cons


def _format_consultation_summary(conn: sqlite3.Connection, row: sqlite3.Row) -> Dict[str, Any]:
    item = dict(row)
    cur = conn.cursor()
    cur.execute(
        "SELECT content, sender_role, sender_name, created_at FROM messages WHERE consultation_id = ? ORDER BY id DESC LIMIT 1",
        (item["id"],),
    )
    last_msg = cur.fetchone()
    item["last_message"] = dict(last_msg) if last_msg else None

    cur.execute("SELECT COUNT(*) AS cnt FROM messages WHERE consultation_id = ?", (item["id"],))
    item["message_count"] = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM reports WHERE consultation_id = ?", (item["id"],))
    item["report_count"] = cur.fetchone()["cnt"]
    return item


# ==================== SYSTEM & HEALTH ROUTES ====================


@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "app_name": "AAROGYASETU (आरोग्यसेतु)",
        "tagline": "Healthcare Beyond Boundaries",
        "hackathon": "AIORA",
        "institution": "Karavali Institute of Technology",
        "milestone": "Milestone 1 (Patient Profile, Doctor Portal, Messaging & Compressed Report Upload)",
        "max_upload_mb": MAX_UPLOAD_MB,
        "prototype_notice": "Fictional demo data only. Not production-ready for real medical records.",
    }


# ==================== AUTHENTICATION ROUTES ====================


@app.post("/api/auth/register/patient", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register_patient(
    payload: PatientRegisterRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    full_name = payload.full_name.strip()
    phone = payload.phone.strip()
    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not PHONE_REGEX.match(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must contain 7-15 digits.")
    if email:
        if not EMAIL_REGEX.match(email):
            raise HTTPException(status_code=400, detail="Invalid email address format.")
        _validate_email_domain(email)

    if payload.age is None and not (payload.date_of_birth and payload.date_of_birth.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either your Age or Date of Birth.",
        )
    if payload.age is not None and (payload.age < 0 or payload.age > 125):
        raise HTTPException(status_code=400, detail="Age must be between 0 and 125 years.")

    emg_phone = payload.emergency_contact_phone.strip()
    if not PHONE_REGEX.match(emg_phone):
        raise HTTPException(status_code=400, detail="Emergency contact phone must contain 7-15 digits.")

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ?", (phone,))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number is already registered.",
        )

    if email:
        cur.execute("SELECT id FROM users WHERE lower(email) = ?", (email,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address is already registered.",
            )

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('patient', ?, ?, ?, ?, 'approved', 0, ?)
        """,
        (
            full_name,
            phone,
            email,
            hash_password(payload.password),
            now,
        ),
    )
    user_id = cur.lastrowid

    cur.execute(
        """
        INSERT INTO patient_profiles (
            user_id, age, date_of_birth, gender, village_or_address,
            emergency_contact_name, emergency_contact_phone, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            payload.age,
            (payload.date_of_birth or "").strip(),
            (payload.gender or "").strip(),
            payload.village_or_address.strip(),
            payload.emergency_contact_name.strip(),
            emg_phone,
            now,
        ),
    )

    # Assign an initial consultation with the primary seeded demo doctor (Dr. Priya Sharma)
    # so the newly registered patient can immediately exchange messages and upload reports.
    cur.execute(
        "SELECT id, full_name FROM users WHERE role = 'doctor' AND approval_status = 'approved' ORDER BY id ASC LIMIT 1"
    )
    demo_doc = cur.fetchone()
    if demo_doc:
        ref_code = f"CONS-{100 + user_id}"
        cur.execute(
            """
            INSERT INTO consultations (
                reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            (
                ref_code,
                user_id,
                demo_doc["id"],
                "Initial General Health Tele-Consultation",
                "Assigned consultation with rural tele-health clinician.",
                now,
                now,
            ),
        )
        cons_id = cur.lastrowid
        cur.execute(
            """
            INSERT INTO messages (
                consultation_id, sender_id, sender_role, sender_name, content, client_message_id, delivery_state, created_at
            )
            VALUES (?, ?, 'doctor', ?, ?, ?, 'sent', ?)
            """,
            (
                cons_id,
                demo_doc["id"],
                demo_doc["full_name"],
                f"Namaste {payload.full_name.strip()}, welcome to AAROGYASETU. Please share your symptoms or upload any medical report images here.",
                f"welcome-{cons_id}",
                now,
            ),
        )

    conn.commit()

    profile_data = _build_user_profile_Response(conn, user_id)
    token = create_access_token(
        user_id=user_id,
        phone=phone,
        role="patient",
        full_name=payload.full_name.strip(),
        approval_status="approved",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile_data,
    }


@app.post("/api/auth/register/doctor", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register_doctor(
    payload: DoctorRegisterRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Doctor self-registration creates a 'pending' account that cannot access any patient
    data until approved by an administrator.
    """
    full_name = payload.full_name.strip()
    phone = payload.phone.strip()
    email = payload.email.strip().lower()

    if not full_name:
        raise HTTPException(status_code=400, detail="Doctor full name is required.")
    if not PHONE_REGEX.match(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must contain 7-15 digits.")
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid doctor email address format.")
    _validate_email_domain(email)

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? OR lower(email) = ?", (phone, email))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number or email address already exists.",
        )

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('doctor', ?, ?, ?, ?, 'pending', 0, ?)
        """,
        (
            full_name,
            phone,
            email,
            hash_password(payload.password),
            now,
        ),
    )
    user_id = cur.lastrowid

    cur.execute(
        """
        INSERT INTO doctor_profiles (
            user_id, specialty, clinic_name, clinic_location, languages_spoken, bio, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            payload.specialty.strip(),
            payload.clinic_name.strip(),
            payload.clinic_location.strip(),
            payload.languages_spoken.strip(),
            (payload.bio or "").strip(),
            now,
        ),
    )
    conn.commit()

    return {
        "status": "pending_approval",
        "approval_status": "pending",
        "message": (
            "Doctor registration submitted. Your account is marked as PENDING until verified "
            "and approved. For the hackathon demo, please sign in with the approved seeded "
            "doctor account (Dr. Priya Sharma: 9123456780 / doctor123)."
        ),
        "user": _build_user_profile_Response(conn, user_id),
    }


@app.post("/api/auth/login", tags=["Auth"])
def login(
    payload: LoginRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    ident = payload.identifier.strip().lower()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone number is required.",
        )

    # Rate limiting & temporary lockout check
    _check_login_rate_limit(ident)

    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, role, full_name, phone, email, password_hash, approval_status
        FROM users
        WHERE phone = ? OR lower(email) = ?
        """,
        (ident, ident),
    )
    row = cur.fetchone()

    # Generic credential failure message so the sign-in page never reveals account existence
    if not row or not verify_password(payload.password, row["password_hash"]):
        _record_failed_login(ident)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    if payload.role and row["role"] != payload.role:
        _record_failed_login(ident)
        portal_labels = {
            "doctor": "Doctor Portal",
            "patient": "Patient Portal",
            "examiner": "Examiner Portal",
        }
        portal_label = portal_labels.get(payload.role, "portal")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account belongs to a {row['role']}. Please switch to the {row['role'].title()} tab to sign in.",
        )

    if row["role"] == "doctor" and row["approval_status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your doctor account is currently PENDING approval and has no patient access. "
                "Please use the seeded demo doctor account (9123456780 / doctor123) for evaluation."
            ),
        )

    _record_successful_login(ident)
    user_id = row["id"]
    token = create_access_token(
        user_id=user_id,
        phone=row["phone"],
        role=row["role"],
        full_name=row["full_name"],
        approval_status=row["approval_status"],
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _build_user_profile_Response(conn, user_id),
    }


@app.post("/api/auth/logout", tags=["Auth"])
def logout(
    authorization: Optional[str] = Header(default=None),
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    """Revokes the active bearer token on the server and terminates the session."""
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
        revoke_access_token(raw_token)
    return {
        "status": "logged_out",
        "message": "Signed out successfully.",
    }


@app.get("/api/auth/me", tags=["Auth"])
def get_authenticated_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Returns the currently signed-in user account and role profile."""
    return _build_user_profile_Response(conn, int(current_user["sub"]))


# ==================== PROFILE ROUTES ====================


@app.get("/api/profile/me", tags=["Profile"])
def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_Response(conn, int(current_user["sub"]))


@app.get("/api/profile/patient", tags=["Profile"])
def get_patient_profile(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_Response(conn, int(current_user["sub"]))


@app.get("/api/profile/doctor", tags=["Profile"])
def get_doctor_profile(
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_Response(conn, int(current_user["sub"]))


@app.put("/api/profile/patient", tags=["Profile"])
def update_patient_profile(
    payload: PatientProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    user_id = int(current_user["sub"])
    phone = payload.phone.strip()
    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    if payload.age is None and not (payload.date_of_birth and payload.date_of_birth.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either Age or Date of Birth.",
        )

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (phone, user_id))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number is already in use by another account.",
        )

    if email:
        cur.execute("SELECT id FROM users WHERE lower(email) = ? AND id != ?", (email, user_id))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already in use by another account.",
            )

    now = utc_now_iso()
    cur.execute(
        "UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?",
        (payload.full_name.strip(), phone, email, user_id),
    )
    cur.execute(
        """
        UPDATE patient_profiles
        SET age = ?,
            date_of_birth = ?,
            gender = ?,
            village_or_address = ?,
            emergency_contact_name = ?,
            emergency_contact_phone = ?,
            updated_at = ?
        WHERE user_id = ?
        """,
        (
            payload.age,
            (payload.date_of_birth or "").strip(),
            (payload.gender or "").strip(),
            payload.village_or_address.strip(),
            payload.emergency_contact_name.strip(),
            payload.emergency_contact_phone.strip(),
            now,
            user_id,
        ),
    )
    conn.commit()
    return _build_user_profile_Response(conn, user_id)


@app.put("/api/profile/doctor", tags=["Profile"])
def update_doctor_profile(
    payload: DoctorProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    user_id = int(current_user["sub"])
    phone = payload.phone.strip()
    email = payload.email.strip().lower()

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (phone, user_id))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Phone number is already in use.")

    cur.execute("SELECT id FROM users WHERE lower(email) = ? AND id != ?", (email, user_id))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Email address is already in use.")

    now = utc_now_iso()
    cur.execute(
        "UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?",
        (payload.full_name.strip(), phone, email, user_id),
    )
    cur.execute(
        """
        UPDATE doctor_profiles
        SET specialty = ?,
            clinic_name = ?,
            clinic_location = ?,
            languages_spoken = ?,
            bio = ?,
            updated_at = ?
        WHERE user_id = ?
        """,
        (
            payload.specialty.strip(),
            payload.clinic_name.strip(),
            payload.clinic_location.strip(),
            payload.languages_spoken.strip(),
            (payload.bio or "").strip(),
            now,
            user_id,
        ),
    )
    conn.commit()
    return _build_user_profile_Response(conn, user_id)


# ==================== CONSULTATION ROUTES ====================


@app.get("/api/consultations", tags=["Consultations"])
def list_my_authorized_consultations(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Lists authorized consultations for the signed-in user based on role."""
    if current_user.get("role") == "patient":
        return list_patient_consultations(current_user=current_user, conn=conn)
    if current_user.get("role") == "doctor":
        return list_doctor_consultations(current_user=require_doctor(current_user), conn=conn)
    if current_user.get("role") == "examiner":
        return list_examiner_consultations(current_user=require_examiner(current_user), conn=conn)
    raise HTTPException(status_code=403, detail="Unauthorized role.")


@app.get("/api/consultations/examiner", tags=["Consultations"])
def list_examiner_consultations(
    current_user: Dict[str, Any] = Depends(require_examiner),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Read-only examiner view of all consultations across the platform for hackathon review.
    Fictional demo data only.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.specialty AS doctor_specialty,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        ORDER BY c.id ASC
        """
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/patient", tags=["Consultations"])
def list_patient_consultations(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Lists only the signed-in patient's own consultations."""
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.specialty AS doctor_specialty,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location,
            dp.languages_spoken AS doctor_languages,
            dp.bio AS doctor_bio
        FROM consultations c
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE c.patient_id = ?
        ORDER BY c.updated_at DESC, c.id DESC
        """,
        (uid,),
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/doctor", tags=["Consultations"])
def list_doctor_consultations(
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Lists ONLY consultations assigned to the signed-in doctor.
    Doctors cannot view unassigned patients.
    """
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        WHERE c.doctor_id = ?
        ORDER BY c.updated_at DESC, c.id DESC
        """,
        (uid,),
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/{consultation_id}", tags=["Consultations"])
def get_consultation_detail(
    consultation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _get_authorized_consultation(conn, consultation_id, current_user)


# ==================== ONLINE MESSAGING ROUTES ====================


@app.get("/api/consultations/{consultation_id}/messages", tags=["Messages"])
def list_consultation_messages(
    consultation_id: int,
    after_id: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    _get_authorized_consultation(conn, consultation_id, current_user)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, consultation_id, sender_id, sender_role, sender_name,
               content, client_message_id, delivery_state, created_at
        FROM messages
        WHERE consultation_id = ? AND id > ?
        ORDER BY id ASC
        """,
        (consultation_id, after_id),
    )
    return [dict(r) for r in cur.fetchall()]


@app.post(
    "/api/consultations/{consultation_id}/messages",
    status_code=status.HTTP_201_CREATED,
    tags=["Messages"],
)
def send_consultation_message(
    consultation_id: int,
    payload: MessageCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    if current_user.get("role") == "examiner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only access: Examiner account cannot send messages or modify consultation data.",
        )
    _get_authorized_consultation(conn, consultation_id, current_user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    uid = int(current_user["sub"])
    role = current_user["role"]
    client_msg_id = (payload.client_message_id or "").strip() or None

    cur = conn.cursor()
    # Fetch latest sender name from DB in case profile name was updated
    cur.execute("SELECT full_name FROM users WHERE id = ?", (uid,))
    u_row = cur.fetchone()
    sender_name = u_row["full_name"] if u_row else current_user.get("name", "User")

    # Idempotency check so retrying a failed message does not duplicate rows
    if client_msg_id:
        cur.execute(
            """
            SELECT id, consultation_id, sender_id, sender_role, sender_name,
                   content, client_message_id, delivery_state, created_at
            FROM messages
            WHERE consultation_id = ? AND sender_id = ? AND client_message_id = ?
            """,
            (consultation_id, uid, client_msg_id),
        )
        existing = cur.fetchone()
        if existing:
            return dict(existing)

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO messages (
            consultation_id, sender_id, sender_role, sender_name,
            content, client_message_id, delivery_state, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)
        """,
        (consultation_id, uid, role, sender_name, content, client_msg_id, now),
    )
    msg_id = cur.lastrowid
    cur.execute("UPDATE consultations SET updated_at = ? WHERE id = ?", (now, consultation_id))
    conn.commit()

    cur.execute(
        """
        SELECT id, consultation_id, sender_id, sender_role, sender_name,
               content, client_message_id, delivery_state, created_at
        FROM messages WHERE id = ?
        """,
        (msg_id,),
    )
    return dict(cur.fetchone())


# ==================== MEDICAL REPORT UPLOAD & PRIVATE STORAGE ROUTES ====================


@app.get("/api/consultations/{consultation_id}/reports", tags=["Reports"])
def list_consultation_reports(
    consultation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    _get_authorized_consultation(conn, consultation_id, current_user)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, consultation_id, patient_id, title, original_filename,
               mime_type, original_size_bytes, uploaded_size_bytes,
               was_compressed, upload_status, uploaded_at
        FROM reports
        WHERE consultation_id = ?
        ORDER BY id DESC
        """,
        (consultation_id,),
    )
    return [dict(r) for r in cur.fetchall()]


@app.get("/api/reports/my", tags=["Reports"])
def list_my_patient_reports(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Allows the signed-in patient to view all reports they previously uploaded."""
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            r.id, r.consultation_id, r.patient_id, r.title, r.original_filename,
            r.mime_type, r.original_size_bytes, r.uploaded_size_bytes,
            r.was_compressed, r.upload_status, r.uploaded_at,
            c.reference_code AS consultation_code,
            c.subject AS consultation_subject,
            d.full_name AS doctor_name
        FROM reports r
        JOIN consultations c ON r.consultation_id = c.id
        JOIN users d ON c.doctor_id = d.id
        WHERE r.patient_id = ?
        ORDER BY r.id DESC
        """,
        (uid,),
    )
    return [dict(r) for r in cur.fetchall()]


@app.post(
    "/api/consultations/{consultation_id}/reports",
    status_code=status.HTTP_201_CREATED,
    tags=["Reports"],
)
async def upload_consultation_report(
    consultation_id: int,
    title: str = Form(..., min_length=2, max_length=150),
    original_size_bytes: Optional[int] = Form(default=None),
    was_compressed: Optional[bool] = Form(default=False),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Validates and stores a medical report image (JPEG, PNG, WebP) or PDF in private local storage.
    Records actual original and uploaded sizes without claiming fixed compression ratios or PDF compression.
    """
    cons = _get_authorized_consultation(conn, consultation_id, current_user)
    uid = int(current_user["sub"])

    orig_filename = os.path.basename(file.filename or "report.jpg").strip()
    ext = Path(orig_filename).suffix.lower()
    content_type = (file.content_type or "").lower().strip()

    if ext not in ALLOWED_EXTENSIONS or content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed formats: JPEG, PNG, WebP, or PDF.",
        )

    raw_bytes = await file.read()
    uploaded_size = len(raw_bytes)
    if uploaded_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if uploaded_size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_MB} MB maximum upload limit.",
        )

    is_pdf = ext == ".pdf" or content_type == "application/pdf"
    if is_pdf:
        if not raw_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Invalid or corrupted PDF file.")
        # Never claim a PDF was image-compressed
        effective_was_compressed = 0
        effective_orig_size = uploaded_size
        normalized_mime = "application/pdf"
    else:
        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                img.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="Uploaded image file is corrupted or invalid.")
        effective_orig_size = (
            int(original_size_bytes)
            if (original_size_bytes and int(original_size_bytes) >= uploaded_size)
            else uploaded_size
        )
        effective_was_compressed = 1 if (was_compressed and effective_orig_size > uploaded_size) else 0
        normalized_mime = "image/jpeg" if content_type in ("image/jpeg", "image/jpg") else content_type

    PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"rep_c{consultation_id}_u{uid}_{secrets.token_hex(8)}{ext}"
    stored_path = PRIVATE_REPORTS_DIR / stored_filename
    stored_path.write_bytes(raw_bytes)

    now = utc_now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO reports (
            consultation_id, patient_id, title, original_filename, stored_filename,
            mime_type, original_size_bytes, uploaded_size_bytes, was_compressed, upload_status, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?)
        """,
        (
            cons["id"],
            uid,
            title.strip(),
            orig_filename,
            stored_filename,
            normalized_mime,
            effective_orig_size,
            uploaded_size,
            effective_was_compressed,
            now,
        ),
    )
    report_id = cur.lastrowid
    cur.execute("UPDATE consultations SET updated_at = ? WHERE id = ?", (now, cons["id"]))
    conn.commit()

    cur.execute(
        """
        SELECT id, consultation_id, patient_id, title, original_filename,
               mime_type, original_size_bytes, uploaded_size_bytes,
               was_compressed, upload_status, uploaded_at
        FROM reports WHERE id = ?
        """,
        (report_id,),
    )
    return dict(cur.fetchone())


@app.get("/api/reports/{report_id}/file", tags=["Reports"])
def download_authorized_report_file(
    report_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    """
    Streams a report file from private storage ONLY after verifying that the requester
    is the patient who owns the report or the doctor assigned to that consultation.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT r.*, c.doctor_id, c.patient_id AS cons_patient_id
        FROM reports r
        JOIN consultations c ON r.consultation_id = c.id
        WHERE r.id = ?
        """,
        (report_id,),
    )
    rep = cur.fetchone()
    if not rep:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    uid = int(current_user["sub"])
    role = current_user["role"]

    if role == "patient" and rep["patient_id"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Patients can view only their own medical reports.",
        )
    if role == "doctor":
        if current_user.get("approval_status", "approved") != "approved" or rep["doctor_id"] != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Doctors can view reports only for their assigned consultations.",
            )
    if role not in ("patient", "doctor", "examiner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    file_path = PRIVATE_REPORTS_DIR / rep["stored_filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file missing from private storage.")

    return FileResponse(
        path=str(file_path),
        media_type=rep["mime_type"],
        filename=rep["original_filename"],
        headers={"Cache-Control": "no-store, private, max-age=0"},
    )


# Optional single-port convenience: if frontend/dist has been built, serve the static PWA shell.
# Note: PRIVATE_REPORTS_DIR is never mounted as a static directory; reports are served ONLY via /api/reports/{id}/file.
from fastapi.staticfiles import StaticFiles
from .config import PROJECT_ROOT

_FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="pwa_frontend")

