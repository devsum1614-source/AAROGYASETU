export type UserRole = 'patient' | 'doctor';

export interface PatientProfile {
  user_id: number;
  age: number | null;
  date_of_birth: string;
  gender: string;
  village_or_address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  updated_at: string;
}

export interface DoctorProfile {
  user_id: number;
  specialty: string;
  clinic_name: string;
  clinic_location: string;
  languages_spoken: string;
  bio: string;
  updated_at: string;
}

export interface UserAccount {
  id: number;
  role: UserRole;
  full_name: string;
  phone: string;
  email: string | null;
  approval_status: 'approved' | 'pending';
  is_demo: number;
  created_at: string;
  patient_profile?: PatientProfile | null;
  doctor_profile?: DoctorProfile | null;
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
  // Doctor fields (for patient view & detail view)
  doctor_name?: string;
  doctor_phone?: string;
  doctor_email?: string;
  doctor_specialty?: string;
  doctor_clinic_name?: string;
  doctor_clinic_location?: string;
  doctor_languages?: string;
  doctor_bio?: string;
  // Patient fields (for doctor view & detail view)
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_age?: number | null;
  patient_dob?: string;
  patient_gender?: string;
  patient_village?: string;
  patient_emergency_name?: string;
  patient_emergency_phone?: string;
  // Summary counts
  last_message?: LastMessageSummary | null;
  message_count?: number;
  report_count?: number;
}

export type MessageDeliveryState = 'sending' | 'sent' | 'failed';

export interface MessageItem {
  id: number | string;
  consultation_id: number;
  sender_id: number;
  sender_role: UserRole;
  sender_name: string;
  content: string;
  client_message_id?: string | null;
  delivery_state: MessageDeliveryState;
  created_at: string;
  error_detail?: string;
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
  upload_status: string;
  uploaded_at: string;
  consultation_code?: string;
  consultation_subject?: string;
  doctor_name?: string;
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
