export type UserRole = 'patient' | 'doctor' | 'examiner';

export interface PatientProfile {
  user_id: number;
  age: number | null;
  date_of_birth: string;
  gender: string;
  village_or_address: string;
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  manual_location_landmark?: string;
  sms_consent: number;
  updated_at: string;
}

export interface DoctorProfile {
  user_id: number;
  registration_number?: string;
  specialty: string;
  qualifications?: string;
  clinic_name: string;
  clinic_location: string;
  languages_spoken: string;
  bio: string;
  availability_slots?: string[];
  is_accepting?: number;
  updated_at: string;
}

export interface UserAccount {
  id: number;
  role: UserRole;
  full_name: string;
  phone: string;
  email: string | null;
  approval_status: 'approved' | 'pending' | 'rejected';
  is_demo: number;
  created_at: string;
  patient_profile?: PatientProfile | null;
  doctor_profile?: DoctorProfile | null;
}

export interface DoctorDirectoryItem {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  registration_number?: string;
  specialty: string;
  qualifications?: string;
  clinic_name: string;
  clinic_location: string;
  languages_spoken: string;
  bio: string;
  availability_slots: string[];
  is_accepting: number;
}

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'completed';

export interface Appointment {
  id: number;
  reference_code: string;
  patient_id: number;
  doctor_id: number;
  consultation_id?: number | null;
  scheduled_date: string;
  scheduled_time: string;
  status: AppointmentStatus;
  chief_complaint: string;
  status_reason?: string;
  created_at: string;
  updated_at: string;
  doctor_name?: string;
  doctor_phone?: string;
  doctor_specialty?: string;
  doctor_clinic_name?: string;
  doctor_clinic_location?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_village?: string;
  patient_blood_group?: string;
  patient_allergies?: string;
  patient_emergency_phone?: string;
}

export interface SmsNotification {
  id: number;
  appointment_id?: number | null;
  patient_id: number;
  recipient_phone: string;
  event_type: string;
  message_body: string;
  dedupe_key: string;
  delivery_mode: 'live_twilio' | 'demo_log';
  status: 'queued' | 'sent' | 'failed';
  created_at: string;
}

export interface LastMessageSummary {
  content: string;
  sender_role: UserRole;
  sender_name: string;
  created_at: string;
}

export interface Consultation {
  id: number;
  reference_code: string;
  patient_id: number;
  doctor_id: number;
  subject: string;
  status: 'active' | 'closed';
  clinical_summary: string;
  created_at: string;
  updated_at: string;
  doctor_name?: string;
  doctor_phone?: string;
  doctor_email?: string;
  doctor_specialty?: string;
  doctor_clinic_name?: string;
  doctor_clinic_location?: string;
  doctor_languages?: string;
  doctor_bio?: string;
  doctor_reg_no?: string;
  doctor_qualifications?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_age?: number | null;
  patient_dob?: string;
  patient_gender?: string;
  patient_village?: string;
  patient_blood_group?: string;
  patient_allergies?: string;
  patient_chronic_conditions?: string;
  patient_emergency_name?: string;
  patient_emergency_phone?: string;
  patient_landmark?: string;
  patient_sms_consent?: number;
  last_message?: LastMessageSummary | null;
  message_count?: number;
  report_count?: number;
}

export type MessageDeliveryState = 'sending' | 'sent' | 'failed';

export interface MessageItem {
  id: number | string;
  consultation_id: number;
  appointment_id?: number | null;
  sender_id: number;
  sender_role: UserRole;
  sender_name: string;
  content: string;
  client_message_id?: string | null;
  delivery_state: MessageDeliveryState;
  created_at: string;
  error_detail?: string;
}

export interface OCRField {
  parameter: string;
  value: string;
  unit: string;
  reference: string;
  flag: string;
}

export interface ReportItem {
  id: number;
  consultation_id: number;
  patient_id: number;
  title: string;
  original_filename: string;
  mime_type: string;
  original_size_bytes: number;
  uploaded_size_bytes: number;
  was_compressed: number;
  ocr_status: 'pending' | 'extracted' | 'failed' | 'not_applicable';
  extracted_fields?: OCRField[];
  doctor_reviewed: number;
  doctor_corrected_fields?: OCRField[];
  doctor_review_note?: string;
  upload_status: string;
  uploaded_at: string;
  consultation_code?: string;
  consultation_subject?: string;
  doctor_name?: string;
}

export interface ConsultationNote {
  id: number;
  consultation_id: number;
  appointment_id?: number | null;
  patient_id: number;
  doctor_id: number;
  assessment: string;
  care_advice: string;
  red_flag_warnings: string;
  follow_up_date: string;
  created_at: string;
  doctor_name?: string;
  doctor_specialty?: string;
  consultation_code?: string;
}

export interface MedicineSchedule {
  id: number;
  consultation_id?: number;
  patient_id: number;
  doctor_id: number;
  medicine_name: string;
  dosage_strength: string;
  schedule_times: string[];
  meal_instruction: string;
  duration_days: number;
  status: 'active' | 'completed' | 'discontinued';
  created_at: string;
  doctor_name?: string;
  patient_name?: string;
}

export interface AdherenceLog {
  id: number;
  schedule_id: number;
  patient_id: number;
  dose_date: string;
  dose_slot: string;
  status: 'taken' | 'skipped';
  note: string;
  logged_at: string;
  medicine_name?: string;
  dosage_strength?: string;
}

export interface AdherenceSummary {
  patient_id: number;
  adherence_rate_pct: number;
  total_logged: number;
  taken_count: number;
  skipped_count: number;
  recent_logs: AdherenceLog[];
}

export interface QRTokenResponse {
  token: string;
  expires_at: string;
  scopes: string[];
  consent_notice: string;
}

export interface QRResolvedData {
  status: string;
  consented_scopes: string[];
  patient_data: {
    patient_name: string;
    token: string;
    expires_at: string;
    age?: number;
    gender?: string;
    village?: string;
    blood_group?: string;
    allergies?: string;
    chronic_conditions?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
  };
}

export interface AIAssistantResponse {
  question: string;
  is_red_flag: boolean;
  answer: string;
  emergency_number: string;
  disclaimer: string;
  recommended_action: string;
}

export interface NearbyFacility {
  name: string;
  type: string;
  distance_km: string;
  phone: string;
  location: string;
}

export interface EmergencySosInfo {
  emergency_number: string;
  emergency_label: string;
  family_emergency_contact?: {
    name: string;
    phone: string;
  } | null;
  manual_location_landmark?: string | null;
  nearby_facilities: NearbyFacility[];
  no_auto_dispatch_notice: string;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  isPdf: boolean;
  previewUrl: string | null;
  width?: number;
  height?: number;
  note: string;
}
