"""
Pydantic v2 Request & Response Schemas for AAROGYASETU (आरोग्यसेतु) — Milestone 1.
"""
from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=120, description="Phone number or email address")
    password: str = Field(..., min_length=4, max_length=128)
    role: Optional[Literal["patient", "doctor"]] = None


class PatientRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: Optional[str] = Field(default=None, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    date_of_birth: Optional[str] = Field(default="", max_length=30)
    gender: Optional[str] = Field(default="", max_length=40)
    village_or_address: str = Field(..., min_length=2, max_length=250)
    emergency_contact_name: str = Field(..., min_length=2, max_length=120)
    emergency_contact_phone: str = Field(..., min_length=7, max_length=25)


class DoctorRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    specialty: str = Field(..., min_length=2, max_length=120)
    clinic_name: str = Field(..., min_length=2, max_length=150)
    clinic_location: str = Field(..., min_length=2, max_length=200)
    languages_spoken: str = Field(default="English, Hindi, Kannada", max_length=200)
    bio: Optional[str] = Field(default="", max_length=600)


class PatientProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: Optional[str] = Field(default=None, max_length=120)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    date_of_birth: Optional[str] = Field(default="", max_length=30)
    gender: Optional[str] = Field(default="", max_length=40)
    village_or_address: str = Field(..., min_length=2, max_length=250)
    emergency_contact_name: str = Field(..., min_length=2, max_length=120)
    emergency_contact_phone: str = Field(..., min_length=7, max_length=25)


class DoctorProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=25)
    email: str = Field(..., min_length=5, max_length=120)
    specialty: str = Field(..., min_length=2, max_length=120)
    clinic_name: str = Field(..., min_length=2, max_length=150)
    clinic_location: str = Field(..., min_length=2, max_length=200)
    languages_spoken: str = Field(..., min_length=2, max_length=200)
    bio: Optional[str] = Field(default="", max_length=600)


class MessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    client_message_id: Optional[str] = Field(default=None, max_length=80)
