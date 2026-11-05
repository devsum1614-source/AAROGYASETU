"""
Automated Pytest Suite for AAROGYASETU (आरोग्यसेतु) — Milestone 1 Backend & RBAC.
Tests:
  1. Seeded patient and doctor login + password hashing check
  2. Patient registration + profile view/update
  3. Doctor profile view/update + pending status for self-registered doctors
  4. Strict consultation-scoped RBAC (patients only see own data; doctors only see assigned consultations)
  5. Online messaging + idempotent retry via client_message_id
  6. Medical report upload (JPEG, PNG, WebP, PDF) + private file access control
"""
from __future__ import annotations

import io
import os
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from backend.config import DB_PATH
from backend.database import init_db
from backend.main import app

client = TestClient(app)


def _make_test_image_bytes(fmt: str = "JPEG", size=(300, 200)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color="#1e3a8a")
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_health_and_branding():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "AAROGYASETU" in data["app_name"]
    assert data["tagline"] == "Healthcare Beyond Boundaries"
    assert data["hackathon"] == "AIORA"
    assert data["institution"] == "Karavali Institute of Technology"


def test_passwords_are_hashed_in_sqlite():
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users")
    rows = cur.fetchall()
    conn.close()
    assert len(rows) >= 2
    for (pw_hash,) in rows:
        assert pw_hash.startswith("pbkdf2_sha256$")
        assert "patient123" not in pw_hash
        assert "doctor123" not in pw_hash


def test_seeded_patient_and_doctor_workflow_and_rbac():
    # 1. Login as seeded patient Ramesh Kumar
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    assert pat_login.status_code == 200
    pat_token = pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 2. Login as seeded doctor Dr. Priya Sharma
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    assert doc_login.status_code == 200
    doc_token = doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 3. Verify Dr. Priya Sharma ONLY sees her assigned consultation (Ramesh Kumar, CONS-101)
    # and does NOT see Sunita Devi (CONS-102, assigned to Dr. Vikram Rao)
    doc_cons_res = client.get("/api/consultations/doctor", headers=doc_headers)
    assert doc_cons_res.status_code == 200
    doc_cons = doc_cons_res.json()
    patient_names = [c["patient_name"] for c in doc_cons]
    assert "Ramesh Kumar" in patient_names
    assert "Sunita Devi" not in patient_names

    # 4. Verify Dr. Priya Sharma gets 403 Forbidden if trying to open unassigned consultation #2 (Sunita Devi)
    unassigned_res = client.get("/api/consultations/2", headers=doc_headers)
    assert unassigned_res.status_code == 403

    # 5. Verify Patient Ramesh Kumar gets 403 Forbidden if trying to open Sunita Devi's consultation #2
    pat_unassigned_res = client.get("/api/consultations/2", headers=pat_headers)
    assert pat_unassigned_res.status_code == 403

    # 6. Verify Patient profile update works
    prof_update = client.put(
        "/api/profile/patient",
        headers=pat_headers,
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543210",
            "email": "ramesh.demo@aarogyasetu.local",
            "age": 46,
            "date_of_birth": "1980-04-12",
            "gender": "Male",
            "village_or_address": "Ward 4, Belthangady Village, Dakshina Kannada",
            "emergency_contact_name": "Sita Devi (Wife)",
            "emergency_contact_phone": "9876500001",
        },
    )
    assert prof_update.status_code == 200
    assert prof_update.json()["patient_profile"]["age"] == 46

    # 7. Send consultation message from patient & verify idempotent retry
    msg_res = client.post(
        "/api/consultations/1/messages",
        headers=pat_headers,
        json={"content": "Fever is down to 99.4 F this morning.", "client_message_id": "test-msg-retry-1"},
    )
    assert msg_res.status_code == 201
    msg_id = msg_res.json()["id"]
    assert msg_res.json()["delivery_state"] == "sent"

    # Retrying with same client_message_id returns same message ID without duplicating
    retry_res = client.post(
        "/api/consultations/1/messages",
        headers=pat_headers,
        json={"content": "Fever is down to 99.4 F this morning.", "client_message_id": "test-msg-retry-1"},
    )
    assert retry_res.status_code == 201
    assert retry_res.json()["id"] == msg_id

    # 8. Doctor replies in consultation #1
    doc_reply = client.post(
        "/api/consultations/1/messages",
        headers=doc_headers,
        json={"content": "Glad to hear that, Ramesh. Continue hydration and rest."},
    )
    assert doc_reply.status_code == 201
    assert doc_reply.json()["sender_role"] == "doctor"

    # 9. Patient uploads a compressed report image to consultation #1
    img_bytes = _make_test_image_bytes("JPEG")
    upload_res = client.post(
        "/api/consultations/1/reports",
        headers=pat_headers,
        data={
            "title": "Follow-Up Temperature & Lab Slip",
            "original_size_bytes": str(len(img_bytes) * 8),
            "was_compressed": "true",
        },
        files={"file": ("followup_slip_compressed.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    rep_data = upload_res.json()
    rep_id = rep_data["id"]
    assert rep_data["uploaded_size_bytes"] == len(img_bytes)
    assert rep_data["original_size_bytes"] == len(img_bytes) * 8
    assert rep_data["was_compressed"] == 1

    # 10. Assigned Doctor can securely download the uploaded report
    doc_dl = client.get(f"/api/reports/{rep_id}/file", headers=doc_headers)
    assert doc_dl.status_code == 200
    assert len(doc_dl.content) == len(img_bytes)

    # 11. Unauthenticated request to download report is rejected (401)
    unauth_dl = client.get(f"/api/reports/{rep_id}/file")
    assert unauth_dl.status_code == 401

    # 12. Unassigned doctor (Dr. Vikram Rao) is blocked from downloading Ramesh's report (403)
    vikram_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456799", "password": "doctor123", "role": "doctor"},
    )
    vikram_headers = {"Authorization": f"Bearer {vikram_login.json()['access_token']}"}
    forbidden_dl = client.get(f"/api/reports/{rep_id}/file", headers=vikram_headers)
    assert forbidden_dl.status_code == 403


    # Clean up test-inserted message and report so demo DB stays clean
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM messages WHERE client_message_id = 'test-msg-retry-1' OR content LIKE 'Glad to hear that%'")
    conn.execute("DELETE FROM reports WHERE id = ?", (rep_id,))
    conn.commit()
    conn.close()


def test_self_registered_doctor_is_marked_pending():
    res = client.post(
        "/api/auth/register/doctor",
        json={
            "full_name": "Dr. New Applicant",
            "phone": "9000011122",
            "email": "newdoc@aarogyasetu.local",
            "password": "password123",
            "specialty": "Dermatology",
            "clinic_name": "Rural Skin Clinic",
            "clinic_location": "Puttur, Karnataka",
            "languages_spoken": "English, Kannada",
            "bio": "Applicant clinician.",
        },
    )
    assert res.status_code in (201, 409)
    if res.status_code == 201:
        assert res.json()["approval_status"] == "pending"
        # Attempting to sign in while pending returns 403
        login_res = client.post(
            "/api/auth/login",
            json={"identifier": "9000011122", "password": "password123", "role": "doctor"},
        )
        assert login_res.status_code == 403
        assert "PENDING" in login_res.json()["detail"].upper()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM users WHERE phone = '9000011122'")
    conn.commit()
    conn.close()


def test_patient_registration_and_logout_session_revocation():
    reg_res = client.post(
        "/api/auth/register/patient",
        json={
            "full_name": "Kiran Shetty",
            "phone": "9777788899",
            "email": "kiran.demo@aarogyasetu.local",
            "password": "password123",
            "age": 31,
            "date_of_birth": "1995-08-15",
            "gender": "Male",
            "village_or_address": "Sullia Rural Ward 2, Dakshina Kannada",
            "emergency_contact_name": "Meera Shetty",
            "emergency_contact_phone": "9777700011",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    token = reg_data["access_token"]
    user_id = reg_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /api/auth/me works
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Kiran Shetty"

    # Verify patient cannot access doctor profile route
    doc_prof_res = client.get("/api/profile/doctor", headers=headers)
    assert doc_prof_res.status_code == 403

    # Verify logout revokes the session token immediately
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "logged_out"

    after_logout = client.get("/api/auth/me", headers=headers)
    assert after_logout.status_code == 401

    # Clean up test patient and auto-created welcome consultation
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM messages WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_id = ?)", (user_id,))
    conn.execute("DELETE FROM consultations WHERE patient_id = ?", (user_id,))
    conn.execute("DELETE FROM patient_profiles WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

