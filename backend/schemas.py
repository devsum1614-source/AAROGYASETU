"""
Pydantic v2 Request & Response Schemas for AAROGYASETU (आरोग्यसेतु).
Full Blueprint Implementation:
  - Auth & Profiles (Patient & Doctor)
  - Appointments & Status Transitions
  - Consultation Notes
  - Medicine Schedules & Adherence
  - OCR Report Review & Editing
  - QR Share Tokens & Consented Scopes
  - AI Health Assistant
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=120, description="Phone number or email address")
    password: str = Field(..., min_length=4, max_length=128)
    role: Optional[Literal["patient", "doctor", "examiner"]] = None


class PatientRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: Optional[str] = Field(default=None, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    date_of_birth: Optional[str] = Field(default="", max_length=30)
    gender: Optional[str] = Field(default="", max_length=40)
    village_or_address: str = Field(..., min_length=2, max_length=250)
    blood_group: Optional[str] = Field(default="", max_length=20)
    allergies: Optional[str] = Field(default="", max_length=300)
    chronic_conditions: Optional[str] = Field(default="", max_length=300)
    emergency_contact_name: str = Field(..., min_length=2, max_length=120)
    emergency_contact_phone: str = Field(..., min_length=7, max_length=25)
    manual_location_landmark: Optional[str] = Field(default="", max_length=250)
    sms_consent: bool = Field(default=True)


class DoctorRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    registration_number: Optional[str] = Field(default="", max_length=80)
    specialty: str = Field(..., min_length=2, max_length=120)
    qualifications: Optional[str] = Field(default="MBBS", max_length=120)
    clinic_name: str = Field(..., min_length=2, max_length=150)
    clinic_location: str = Field(..., min_length=2, max_length=200)
    languages_spoken: str = Field(default="English, Hindi, Kannada", max_length=200)
    bio: Optional[str] = Field(default="", max_length=600)
    availability_slots: Optional[List[str]] = Field(default_factory=lambda: ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"])


class PatientProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: Optional[str] = Field(default=None, max_length=120)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    date_of_birth: Optional[str] = Field(default="", max_length=30)
    gender: Optional[str] = Field(default="", max_length=40)
    village_or_address: str = Field(..., min_length=2, max_length=250)
    blood_group: Optional[str] = Field(default="", max_length=20)
    allergies: Optional[str] = Field(default="", max_length=300)
    chronic_conditions: Optional[str] = Field(default="", max_length=300)
    emergency_contact_name: str = Field(..., min_length=2, max_length=120)
    emergency_contact_phone: str = Field(..., min_length=7, max_length=25)
    manual_location_landmark: Optional[str] = Field(default="", max_length=250)
    sms_consent: bool = Field(default=True)


class DoctorProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: str = Field(..., min_length=5, max_length=120)
    registration_number: Optional[str] = Field(default="", max_length=80)
    specialty: str = Field(..., min_length=2, max_length=120)
    qualifications: Optional[str] = Field(default="MBBS", max_length=120)
    clinic_name: str = Field(..., min_length=2, max_length=150)
    clinic_location: str = Field(..., min_length=2, max_length=200)
    languages_spoken: str = Field(..., min_length=2, max_length=200)
    bio: Optional[str] = Field(default="", max_length=600)
    availability_slots: Optional[List[str]] = Field(default=None)
    is_accepting: Optional[bool] = Field(default=True)


class AppointmentCreateRequest(BaseModel):
    doctor_id: int
    scheduled_date: str = Field(..., description="YYYY-MM-DD")
    scheduled_time: str = Field(..., description="e.g. 10:00 AM")
    chief_complaint: str = Field(..., min_length=3, max_length=500)


class AppointmentStatusUpdateRequest(BaseModel):
    status: Literal["confirmed", "rescheduled", "cancelled", "completed"]
    new_date: Optional[str] = None
    new_time: Optional[str] = None
    reason: Optional[str] = Field(default="", max_length=400)


class MessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    client_message_id: Optional[str] = Field(default=None, max_length=80)
    appointment_id: Optional[int] = None


class ConsultationNoteCreateRequest(BaseModel):
    assessment: str = Field(..., min_length=3, max_length=1500)
    care_advice: str = Field(default="", max_length=1500)
    red_flag_warnings: str = Field(default="", max_length=1000)
    follow_up_date: Optional[str] = Field(default="", max_length=40)
    appointment_id: Optional[int] = None


class ReportReviewUpdateRequest(BaseModel):
    doctor_review_note: str = Field(default="", max_length=1000)
    corrected_fields: List[Dict[str, Any]] = Field(default_factory=list)


class MedicineScheduleCreateRequest(BaseModel):
    medicine_name: str = Field(..., min_length=2, max_length=150)
    dosage_strength: str = Field(..., min_length=1, max_length=80)
    schedule_times: List[str] = Field(default_factory=lambda: ["Morning", "Night"])
    meal_instruction: str = Field(default="After meals", max_length=120)
    duration_days: int = Field(default=5, ge=1, le=180)


class AdherenceLogCreateRequest(BaseModel):
    dose_date: str = Field(..., description="YYYY-MM-DD")
    dose_slot: str = Field(..., description="Morning, Afternoon, or Night")
    status: Literal["taken", "skipped"]
    note: Optional[str] = Field(default="", max_length=200)


class QRTokenCreateRequest(BaseModel):
    scopes: List[str] = Field(default_factory=lambda: ["demographics", "allergies", "chronic_conditions", "emergency_contact"])
    expiry_hours: int = Field(default=24, ge=1, le=168)


class AIAssistantQuestionRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
