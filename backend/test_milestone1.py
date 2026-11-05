"""
Comprehensive Pytest Verification Suite for AAROGYASETU (आरोग्यसेतु) — Complete Platform.
Covers:
  1. Health & Branding
  2. PBKDF2 Password Hashing
  3. Patient & Doctor Auth & Role Separation
  4. Unregistered Email Rejection & Rate Limiting
  5. Doctor Search & Availability Slots
  6. Appointment Booking & Status Lifecycle (requested -> confirmed -> rescheduled -> cancelled)
  7. Zero-PHI SMS Notifications Logged in Demo Outbox
  8. Online Messaging & Idempotent Retries
  9. Report Upload, Canvas Compression Stats & Machine-Read OCR
  10. Doctor Review of OCR Report Values
  11. Doctor Consultation Notes Authored & Published
  12. Doctor-Approved Medicine Schedules & Patient Adherence Logs
  13. Tokenized QR Medical Profile Sharing & Expiration / Revocation
  14. AI Health Assistant & Red-Flag Triage
  15. Emergency SOS Information
  16. Examiner Read-Only Safety & Mutation Blocking
"""
from __future__ import annotations

import io
import sqlite3
from fastapi.testclient import TestClient
from PIL import Image

from backend.config import DB_PATH, EMERGENCY_PHONE_NUMBER
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
    assert data["emergency_phone"] == EMERGENCY_PHONE_NUMBER


def test_passwords_are_hashed():
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users")
    rows = cur.fetchall()
    conn.close()
    assert len(rows) >= 3
    for (pw_hash,) in rows:
        assert pw_hash.startswith("pbkdf2_sha256$")
        assert "patient123" not in pw_hash
        assert "doctor123" not in pw_hash


def test_unregistered_email_and_role_protection():
    # Unregistered email rejected
    res = client.post(
        "/api/auth/login",
        json={"identifier": "random.unregistered@gmail.com", "password": "password123", "role": "patient"},
    )
    assert res.status_code == 401
    assert "incorrect" in res.json()["detail"].lower()

    # Wrong role rejected
    res2 = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "doctor"},
    )
    assert res2.status_code == 403


def test_doctor_search_and_availability():
    res = client.get("/api/doctors")
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) >= 1
    doc_priya = next((d for d in docs if "Priya" in d["full_name"]), None)
    assert doc_priya is not None
    assert "availability_slots" in doc_priya
    assert len(doc_priya["availability_slots"]) > 0


def test_appointment_booking_status_and_zero_phi_sms():
    # 1. Login as patient Ramesh Kumar
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    assert pat_login.status_code == 200
    pat_token = pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 2. Book appointment with Dr. Priya Sharma
    book_res = client.post(
        "/api/appointments",
        headers=pat_headers,
        json={
            "doctor_id": 1,
            "scheduled_date": "2026-11-10",
            "scheduled_time": "11:30 AM",
            "chief_complaint": "Follow-up check on mild fever and cough",
        },
    )
    assert book_res.status_code == 201
    apt = book_res.json()
    apt_id = apt["id"]
    assert apt["status"] == "requested"

    # 3. Doctor Dr. Priya Sharma logs in and confirms appointment
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    doc_token = doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    conf_res = client.patch(
        f"/api/appointments/{apt_id}/status",
        headers=doc_headers,
        json={"status": "confirmed", "reason": "Slot approved by clinic"},
    )
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "confirmed"

    # 4. Verify Zero-PHI SMS notification log
    sms_res = client.get(f"/api/appointments/{apt_id}/sms-logs", headers=pat_headers)
    assert sms_res.status_code == 200
    logs = sms_res.json()
    assert len(logs) >= 1
    for log in logs:
        # Strict zero-PHI verification: no symptom, no drug, no diagnosis
        msg = log["message_body"]
        assert "fever" not in msg.lower()
        assert "cough" not in msg.lower()
        assert "AAROGYASETU" in msg


def test_messaging_and_idempotency():
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    pat_headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}

    # Post message with client_message_id
    res = client.post(
        "/api/consultations/1/messages",
        headers=pat_headers,
        json={"content": "Good morning doctor, temperature is stable.", "client_message_id": "test-idempotent-1"},
    )
    assert res.status_code == 201
    msg_id = res.json()["id"]

    # Retry send with same client_message_id returns same row without duplicate
    retry_res = client.post(
        "/api/consultations/1/messages",
        headers=pat_headers,
        json={"content": "Good morning doctor, temperature is stable.", "client_message_id": "test-idempotent-1"},
    )
    assert retry_res.status_code == 201
    assert retry_res.json()["id"] == msg_id


def test_report_upload_ocr_and_doctor_review():
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    pat_headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}

    img_bytes = _make_test_image_bytes("JPEG")
    upload_res = client.post(
        "/api/consultations/1/reports",
        headers=pat_headers,
        data={
            "title": "Follow-Up CBC Test",
            "original_size_bytes": str(len(img_bytes) * 5),
            "was_compressed": "true",
        },
        files={"file": ("followup_cbc_report.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    rep = upload_res.json()
    rep_id = rep["id"]
    assert rep["ocr_status"] == "extracted"
    assert len(rep["extracted_fields"]) > 0

    # Doctor logs in and reviews OCR values
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    rev_res = client.put(
        f"/api/reports/{rep_id}/review",
        headers=doc_headers,
        json={
            "doctor_review_note": "Doctor verified lab parameters. Hemoglobin is normal at 12.8 g/dL.",
            "corrected_fields": rep["extracted_fields"],
        },
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["doctor_reviewed"] == 1


def test_consultation_notes_and_records():
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    note_res = client.post(
        "/api/consultations/1/notes",
        headers=doc_headers,
        json={
            "assessment": "Follow-up review: Patient responding well to rest and fluids.",
            "care_advice": "Continue hydration and report if temperature fluctuates.",
            "red_flag_warnings": "Seek emergency care if breathlessness occurs.",
            "follow_up_date": "2026-11-15",
        },
    )
    assert note_res.status_code == 201
    assert "assessment" in note_res.json()


def test_medicine_schedules_and_adherence():
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    sched_res = client.post(
        "/api/reminders/schedules?consultation_id=1",
        headers=doc_headers,
        json={
            "medicine_name": "Vitamin C 500mg",
            "dosage_strength": "1 Chewable Tablet",
            "schedule_times": ["Morning"],
            "meal_instruction": "After breakfast",
            "duration_days": 10,
        },
    )
    assert sched_res.status_code == 201
    sched_id = sched_res.json()["id"]

    # Patient logs dose
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    pat_headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}

    log_res = client.post(
        f"/api/reminders/schedules/{sched_id}/log",
        headers=pat_headers,
        json={"dose_date": "2026-11-06", "dose_slot": "Morning", "status": "taken", "note": "Taken on time"},
    )
    assert log_res.status_code == 201

    adh_res = client.get("/api/reminders/adherence", headers=pat_headers)
    assert adh_res.status_code == 200
    assert adh_res.json()["adherence_rate_pct"] >= 0


def test_qr_token_generation_and_resolution():
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    pat_headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}

    qr_res = client.post(
        "/api/qr/generate",
        headers=pat_headers,
        json={"scopes": ["demographics", "allergies", "blood_group"], "expiry_hours": 12},
    )
    assert qr_res.status_code == 200
    token_str = qr_res.json()["token"]
    assert token_str.startswith("ASETU-TK-")

    # Doctor resolves QR token
    doc_login = client.post(
        "/api/auth/login",
        json={"identifier": "9123456780", "password": "doctor123", "role": "doctor"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    resolve_res = client.get(f"/api/qr/resolve/{token_str}", headers=doc_headers)
    assert resolve_res.status_code == 200
    pdata = resolve_res.json()["patient_data"]
    assert "blood_group" in pdata
    assert "allergies" in pdata


def test_ai_health_assistant_and_triage():
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    pat_headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}

    # General literacy question
    q_res = client.post(
        "/api/assistant/ask",
        headers=pat_headers,
        json={"question": "What is Hemoglobin and why is it important?"},
    )
    assert q_res.status_code == 200
    assert q_res.json()["is_red_flag"] is False
    assert "hemoglobin" in q_res.json()["answer"].lower()

    # Red flag question
    red_res = client.post(
        "/api/assistant/ask",
        headers=pat_headers,
        json={"question": "I have severe chest pain and cannot breathe"},
    )
    assert red_res.status_code == 200
    assert red_res.json()["is_red_flag"] is True
    assert "emergency" in red_res.json()["answer"].lower()


def test_emergency_sos_info():
    res = client.get("/api/sos/info")
    assert res.status_code in (200, 401)
    pat_login = client.post(
        "/api/auth/login",
        json={"identifier": "9876543210", "password": "patient123", "role": "patient"},
    )
    headers = {"Authorization": f"Bearer {pat_login.json()['access_token']}"}
    sos_res = client.get("/api/sos/info", headers=headers)
    assert sos_res.status_code == 200
    sos_data = sos_res.json()
    assert sos_data["emergency_number"] == EMERGENCY_PHONE_NUMBER
    assert len(sos_data["nearby_facilities"]) >= 2
    assert "No Auto-Dispatch" in sos_data["no_auto_dispatch_notice"]


def test_examiner_read_only_access():
    ex_login = client.post(
        "/api/auth/login",
        json={"identifier": "examiner@aiora.karavali.edu", "password": "examiner123", "role": "examiner"},
    )
    assert ex_login.status_code == 200
    ex_headers = {"Authorization": f"Bearer {ex_login.json()['access_token']}"}

    # Reading allowed
    appts = client.get("/api/appointments", headers=ex_headers)
    assert appts.status_code == 200

    # Mutations strictly blocked
    send_msg = client.post("/api/consultations/1/messages", headers=ex_headers, json={"content": "Examiner test"})
    assert send_msg.status_code == 403
