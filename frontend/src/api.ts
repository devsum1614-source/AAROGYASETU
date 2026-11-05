import {
  AdherenceSummary,
  AIAssistantResponse,
  Appointment,
  AppointmentStatus,
  Consultation,
  ConsultationNote,
  DoctorDirectoryItem,
  EmergencySosInfo,
  MedicineSchedule,
  MessageItem,
  OCRField,
  QRResolvedData,
  QRTokenResponse,
  ReportItem,
  SmsNotification,
  UserAccount,
  UserRole,
} from './types';

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL || '';

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body?.detail ||
      body?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return body as T;
}

// ==================== AUTH & PROFILES ====================

export async function loginApi(
  identifier: string,
  password: string,
  role: UserRole
): Promise<{ access_token: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, role }),
  });
  return handleJsonResponse(res);
}

export async function logoutApi(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
  } catch {
    // Proceed with client cleanup
  }
}

export async function registerPatientApi(payload: {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
  age?: number | null;
  date_of_birth?: string;
  gender?: string;
  village_or_address: string;
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  manual_location_landmark?: string;
  sms_consent?: boolean;
}): Promise<{ access_token: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/register/patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function registerDoctorApi(payload: {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  registration_number?: string;
  specialty: string;
  qualifications?: string;
  clinic_name: string;
  clinic_location: string;
  languages_spoken: string;
  bio?: string;
  availability_slots?: string[];
}): Promise<{ status: string; approval_status: string; message: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/register/doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchMyProfileApi(token: string): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/me`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function updatePatientProfileApi(
  token: string,
  payload: {
    full_name: string;
    phone: string;
    email?: string | null;
    age?: number | null;
    date_of_birth?: string;
    gender?: string;
    village_or_address: string;
    blood_group?: string;
    allergies?: string;
    chronic_conditions?: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    manual_location_landmark?: string;
    sms_consent?: boolean;
  }
): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/patient`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function updateDoctorProfileApi(
  token: string,
  payload: {
    full_name: string;
    phone: string;
    email: string;
    registration_number?: string;
    specialty: string;
    qualifications?: string;
    clinic_name: string;
    clinic_location: string;
    languages_spoken: string;
    bio?: string;
    availability_slots?: string[];
    is_accepting?: boolean;
  }
): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/doctor`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchPendingDoctorsApi(token: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/admin/pending-doctors`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function approveDoctorApi(token: string, doctorId: number): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/admin/approve-doctor/${doctorId}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

// ==================== DOCTORS DIRECTORY ====================

export async function searchDoctorsApi(
  specialty?: string,
  language?: string
): Promise<DoctorDirectoryItem[]> {
  const params = new URLSearchParams();
  if (specialty && specialty !== 'all') params.append('specialty', specialty);
  if (language && language !== 'all') params.append('language', language);
  const res = await fetch(`${API_BASE}/api/doctors?${params.toString()}`);
  return handleJsonResponse(res);
}

// ==================== APPOINTMENTS & SMS ====================

export async function bookAppointmentApi(
  token: string,
  payload: {
    doctor_id: number;
    scheduled_date: string;
    scheduled_time: string;
    chief_complaint: string;
  }
): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchAppointmentsApi(token: string): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function updateAppointmentStatusApi(
  token: string,
  appointmentId: number,
  payload: {
    status: AppointmentStatus;
    new_date?: string;
    new_time?: string;
    reason?: string;
  }
): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchAppointmentSmsLogsApi(
  token: string,
  appointmentId: number
): Promise<SmsNotification[]> {
  const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/sms-logs`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchAllSmsLogsApi(token: string): Promise<SmsNotification[]> {
  const res = await fetch(`${API_BASE}/api/sms/logs`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

// ==================== CONSULTATIONS & MESSAGING ====================

export async function fetchPatientConsultationsApi(token: string): Promise<Consultation[]> {
  const res = await fetch(`${API_BASE}/api/consultations/patient`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchDoctorConsultationsApi(token: string): Promise<Consultation[]> {
  const res = await fetch(`${API_BASE}/api/consultations/doctor`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchExaminerConsultationsApi(token: string): Promise<Consultation[]> {
  const res = await fetch(`${API_BASE}/api/consultations/examiner`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchConsultationDetailApi(token: string, id: number): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/api/consultations/${id}`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchConsultationMessagesApi(
  token: string,
  consultationId: number,
  afterId: number = 0
): Promise<MessageItem[]> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/messages?after_id=${afterId}`,
    {
      headers: getAuthHeaders(token),
    }
  );
  return handleJsonResponse(res);
}

export async function sendConsultationMessageApi(
  token: string,
  consultationId: number,
  content: string,
  clientMessageId: string,
  appointmentId?: number | null
): Promise<MessageItem> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/messages`,
    {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        content,
        client_message_id: clientMessageId,
        appointment_id: appointmentId,
      }),
    }
  );
  return handleJsonResponse(res);
}

// ==================== REPORTS & OCR ====================

export async function fetchConsultationReportsApi(
  token: string,
  consultationId: number
): Promise<ReportItem[]> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/reports`,
    {
      headers: getAuthHeaders(token),
    }
  );
  return handleJsonResponse(res);
}

export async function fetchMyPatientReportsApi(token: string): Promise<ReportItem[]> {
  const res = await fetch(`${API_BASE}/api/reports/my`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export function uploadConsultationReportWithProgress(
  token: string,
  consultationId: number,
  params: {
    title: string;
    file: File;
    originalSizeBytes: number;
    wasCompressed: boolean;
  },
  onProgress?: (percent: number) => void
): Promise<ReportItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/consultations/${consultationId}/reports`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as ReportItem);
        } else {
          reject(new Error(body.detail || `Upload failed with status ${xhr.status}`));
        }
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during report upload. Please retry.'));
    };

    const formData = new FormData();
    formData.append('title', params.title);
    formData.append('original_size_bytes', String(params.originalSizeBytes));
    formData.append('was_compressed', params.wasCompressed ? 'true' : 'false');
    formData.append('file', params.file);

    xhr.send(formData);
  });
}

export async function fetchAuthorizedReportBlobUrl(
  token: string,
  reportId: number
): Promise<{ url: string; mimeType: string }> {
  const res = await fetch(`${API_BASE}/api/reports/${reportId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = `Access denied (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, mimeType: blob.type || 'image/jpeg' };
}

export async function reviewReportApi(
  token: string,
  reportId: number,
  payload: {
    doctor_review_note: string;
    corrected_fields: OCRField[];
  }
): Promise<ReportItem> {
  const res = await fetch(`${API_BASE}/api/reports/${reportId}/review`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

// ==================== CLINICAL NOTES & RECORDS ====================

export async function createConsultationNoteApi(
  token: string,
  consultationId: number,
  payload: {
    assessment: string;
    care_advice: string;
    red_flag_warnings: string;
    follow_up_date?: string;
    appointment_id?: number | null;
  }
): Promise<ConsultationNote> {
  const res = await fetch(`${API_BASE}/api/consultations/${consultationId}/notes`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchConsultationNotesApi(
  token: string,
  consultationId: number
): Promise<ConsultationNote[]> {
  const res = await fetch(`${API_BASE}/api/consultations/${consultationId}/notes`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchPatientMedicalRecordsApi(
  token: string,
  patientId?: number
): Promise<{
  patient_id: number;
  clinical_notes: ConsultationNote[];
  reports: ReportItem[];
  active_medicines: MedicineSchedule[];
}> {
  const url = patientId
    ? `${API_BASE}/api/records/patient?patient_id=${patientId}`
    : `${API_BASE}/api/records/patient`;
  const res = await fetch(url, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

// ==================== MEDICINE REMINDERS ====================

export async function createMedicineScheduleApi(
  token: string,
  consultationId: number,
  payload: {
    medicine_name: string;
    dosage_strength: string;
    schedule_times: string[];
    meal_instruction: string;
    duration_days: number;
  }
): Promise<MedicineSchedule> {
  const res = await fetch(`${API_BASE}/api/reminders/schedules?consultation_id=${consultationId}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchMedicineSchedulesApi(
  token: string,
  patientId?: number
): Promise<MedicineSchedule[]> {
  const url = patientId
    ? `${API_BASE}/api/reminders/schedules?patient_id=${patientId}`
    : `${API_BASE}/api/reminders/schedules`;
  const res = await fetch(url, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function logDoseAdherenceApi(
  token: string,
  scheduleId: number,
  payload: {
    dose_date: string;
    dose_slot: string;
    status: 'taken' | 'skipped';
    note?: string;
  }
): Promise<{ status: string; dose_status: string; logged_at: string }> {
  const res = await fetch(`${API_BASE}/api/reminders/schedules/${scheduleId}/log`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchAdherenceSummaryApi(
  token: string,
  patientId?: number
): Promise<AdherenceSummary> {
  const url = patientId
    ? `${API_BASE}/api/reminders/adherence?patient_id=${patientId}`
    : `${API_BASE}/api/reminders/adherence`;
  const res = await fetch(url, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

// ==================== QR MEDICAL PROFILE ====================

export async function generateQRTokenApi(
  token: string,
  payload: {
    scopes: string[];
    expiry_hours: number;
  }
): Promise<QRTokenResponse> {
  const res = await fetch(`${API_BASE}/api/qr/generate`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function revokeQRTokenApi(
  token: string,
  qrTokenStr: string
): Promise<{ status: string; token: string }> {
  const res = await fetch(`${API_BASE}/api/qr/${encodeURIComponent(qrTokenStr)}/revoke`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function resolveQRTokenApi(
  token: string,
  qrTokenStr: string
): Promise<QRResolvedData> {
  const res = await fetch(`${API_BASE}/api/qr/resolve/${encodeURIComponent(qrTokenStr)}`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

// ==================== AI HEALTH ASSISTANT & SOS ====================

export async function askAIAssistantApi(
  token: string,
  question: string
): Promise<AIAssistantResponse> {
  const res = await fetch(`${API_BASE}/api/assistant/ask`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ question }),
  });
  return handleJsonResponse(res);
}

export async function fetchEmergencySosInfoApi(token: string): Promise<EmergencySosInfo> {
  const res = await fetch(`${API_BASE}/api/sos/info`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}
