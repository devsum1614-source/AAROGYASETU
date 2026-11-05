import {
  AdherenceLog,
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
} from '../types';

const STORAGE_KEY = 'aarogyasetu_standalone_db_v2';

interface StoredUser extends UserAccount {
  password_plain: string;
}

interface StandaloneDb {
  users: StoredUser[];
  appointments: Appointment[];
  consultations: Consultation[];
  messages: MessageItem[];
  reports: (ReportItem & { data_url?: string })[];
  notes: ConsultationNote[];
  schedules: MedicineSchedule[];
  adherenceLogs: AdherenceLog[];
  smsLogs: SmsNotification[];
  qrTokens: {
    token: string;
    patient_id: number;
    scopes: string[];
    expires_at: string;
    revoked: boolean;
  }[];
  sessions: Record<string, number>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createSampleReportDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="400" viewBox="0 0 620 400">
    <rect width="620" height="400" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect width="620" height="54" fill="#0b1f3a"/>
    <text x="20" y="34" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold">KARAVALI RURAL DIAGNOSTIC LABORATORY — CBC &amp; GLUCOSE REPORT</text>
    <text x="20" y="84" fill="#0f172a" font-family="sans-serif" font-size="14" font-weight="bold">Patient: Ramesh Kumar (Age: 46 / M) | Village: Belthangady | Ref: CONS-101</text>
    <line x1="20" y1="98" x2="600" y2="98" stroke="#cbd5e1" stroke-width="1"/>
    <text x="20" y="130" fill="#1e3a8a" font-family="monospace" font-size="14" font-weight="bold">PARAMETER               VALUE       UNIT      REFERENCE RANGE</text>
    <text x="20" y="165" fill="#0f172a" font-family="monospace" font-size="14">Hemoglobin (Hb)         11.4        g/dL      13.0 - 17.0 (Mild Low)</text>
    <text x="20" y="198" fill="#0f172a" font-family="monospace" font-size="14">Total WBC Count         7,800       /cumm     4,000 - 11,000</text>
    <text x="20" y="231" fill="#0f172a" font-family="monospace" font-size="14">Platelet Count          2.35        Lakh/uL   1.50 - 4.50</text>
    <text x="20" y="264" fill="#b91c1c" font-family="monospace" font-size="14" font-weight="bold">Fasting Blood Glucose   148         mg/dL     70 - 100 (Elevated)</text>
    <line x1="20" y1="300" x2="600" y2="300" stroke="#cbd5e1" stroke-width="1"/>
    <text x="20" y="335" fill="#475569" font-family="sans-serif" font-size="12">Compressed for 2G Low-Bandwidth Telemedicine Upload • AAROGYASETU</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createInitialDb(): StandaloneDb {
  const ts = nowIso();
  const drPriya: StoredUser = {
    id: 1,
    role: 'doctor',
    full_name: 'Dr. Priya Sharma',
    phone: '9123456780',
    email: 'dr.priya@aarogyasetu.local',
    approval_status: 'approved',
    is_demo: 1,
    created_at: ts,
    password_plain: 'doctor123',
    doctor_profile: {
      user_id: 1,
      registration_number: 'KMC-48291',
      specialty: 'General Medicine',
      qualifications: 'MBBS, MD (General Medicine)',
      clinic_name: 'Karavali Community Health Centre',
      clinic_location: 'Mangaluru, Dakshina Kannada',
      languages_spoken: 'English, Hindi, Kannada, Tulu',
      bio: 'Senior Rural Telemedicine Physician serving Dakshina Kannada and Udupi primary health centers.',
      availability_slots: ['09:30 AM', '11:00 AM', '02:30 PM', '04:30 PM'],
      is_accepting: 1,
      updated_at: ts,
    },
  };

  const drVikram: StoredUser = {
    id: 2,
    role: 'doctor',
    full_name: 'Dr. Vikram Rao',
    phone: '9123456789',
    email: 'dr.vikram@aarogyasetu.local',
    approval_status: 'approved',
    is_demo: 1,
    created_at: ts,
    password_plain: 'doctor123',
    doctor_profile: {
      user_id: 2,
      registration_number: 'KMC-51904',
      specialty: 'Pediatrics & Family Care',
      qualifications: 'MBBS, DCH',
      clinic_name: 'Udupi Rural Tele-Clinic',
      clinic_location: 'Udupi, Karnataka',
      languages_spoken: 'English, Kannada, Hindi',
      bio: 'Specialist in rural maternal and pediatric preventive medicine.',
      availability_slots: ['10:00 AM', '12:00 PM', '03:30 PM'],
      is_accepting: 1,
      updated_at: ts,
    },
  };

  const patRamesh: StoredUser = {
    id: 3,
    role: 'patient',
    full_name: 'Ramesh Kumar',
    phone: '9876543210',
    email: 'ramesh.demo@aarogyasetu.local',
    approval_status: 'approved',
    is_demo: 1,
    created_at: ts,
    password_plain: 'patient123',
    patient_profile: {
      user_id: 3,
      age: 46,
      date_of_birth: '1980-04-12',
      gender: 'Male',
      village_or_address: 'Belthangady Village, Dakshina Kannada',
      blood_group: 'O+',
      allergies: 'Penicillin (Mild Rash)',
      chronic_conditions: 'Type 2 Diabetes, Mild Hypertension',
      emergency_contact_name: 'Kavitha Kumar (Spouse)',
      emergency_contact_phone: '9876501234',
      manual_location_landmark: 'Near Belthangady Panchayat Office, Main Bus Road',
      sms_consent: 1,
      updated_at: ts,
    },
  };

  const cons1: Consultation = {
    id: 101,
    reference_code: 'CONS-101',
    patient_id: 3,
    doctor_id: 1,
    subject: 'Follow-up for Fasting Blood Sugar & Seasonal Fever',
    status: 'active',
    clinical_summary: 'Patient reports mild fatigue and seasonal fever for 2 days. Monitoring fasting glucose.',
    created_at: ts,
    updated_at: ts,
  };

  const appt1: Appointment = {
    id: 101,
    reference_code: 'APT-101',
    patient_id: 3,
    doctor_id: 1,
    consultation_id: 101,
    scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    scheduled_time: '11:00 AM',
    status: 'confirmed',
    chief_complaint: 'Mild fever, fatigue, and routine blood sugar review',
    created_at: ts,
    updated_at: ts,
  };

  const messages: MessageItem[] = [
    {
      id: 1,
      consultation_id: 101,
      sender_id: 3,
      sender_role: 'patient',
      sender_name: 'Ramesh Kumar',
      content: 'Namaste Doctor, I have uploaded my blood test report from the local lab. I had mild fever yesterday.',
      client_message_id: 'seed-msg-1',
      delivery_state: 'sent',
      created_at: ts,
    },
    {
      id: 2,
      consultation_id: 101,
      sender_id: 1,
      sender_role: 'doctor',
      sender_name: 'Dr. Priya Sharma',
      content: 'Namaste Ramesh ji. I have reviewed your CBC & fasting sugar report. Continue Metformin 500mg after dinner and drink plenty of warm water.',
      client_message_id: 'seed-msg-2',
      delivery_state: 'sent',
      created_at: ts,
    },
  ];

  const defaultOcr: OCRField[] = [
    { parameter: 'Hemoglobin (Hb)', value: '11.4', unit: 'g/dL', reference: '13.0 - 17.0', flag: 'low' },
    { parameter: 'Total WBC Count', value: '7800', unit: '/cumm', reference: '4000 - 11000', flag: 'normal' },
    { parameter: 'Platelet Count', value: '2.35', unit: 'Lakh/uL', reference: '1.50 - 4.50', flag: 'normal' },
    { parameter: 'Fasting Blood Glucose', value: '148', unit: 'mg/dL', reference: '70 - 100', flag: 'high' },
  ];

  const reports: (ReportItem & { data_url?: string })[] = [
    {
      id: 1,
      consultation_id: 101,
      patient_id: 3,
      title: 'Belthangady Lab — CBC & Fasting Glucose Report',
      original_filename: 'cbc_fasting_sugar_report.jpg',
      mime_type: 'image/svg+xml',
      original_size_bytes: 1420000,
      uploaded_size_bytes: 168400,
      was_compressed: 1,
      ocr_status: 'extracted',
      extracted_fields: defaultOcr,
      doctor_reviewed: 0,
      doctor_corrected_fields: defaultOcr,
      doctor_review_note: 'Fasting glucose mildly elevated at 148 mg/dL; Hb slightly low at 11.4 g/dL.',
      upload_status: 'uploaded',
      uploaded_at: ts,
      consultation_code: 'CONS-101',
      consultation_subject: cons1.subject,
      doctor_name: 'Dr. Priya Sharma',
      data_url: createSampleReportDataUrl(),
    },
  ];

  const notes: ConsultationNote[] = [
    {
      id: 1,
      consultation_id: 101,
      appointment_id: 101,
      patient_id: 3,
      doctor_id: 1,
      assessment: 'Mild viral febrile illness with borderline elevated fasting blood glucose (148 mg/dL) and mild anemia (Hb 11.4 g/dL).',
      care_advice: 'Take Metformin 500mg after meals. Include iron-rich greens (palak, drumstick leaves), dals, and 2.5L boiled water daily.',
      red_flag_warnings: 'Visit nearest 24x7 PHC or call 108 immediately if fever exceeds 102°F, chest pain, breathlessness, or dizziness occurs.',
      follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      created_at: ts,
      doctor_name: 'Dr. Priya Sharma',
      doctor_specialty: 'General Medicine',
      consultation_code: 'CONS-101',
    },
  ];

  const schedules: MedicineSchedule[] = [
    {
      id: 1,
      consultation_id: 101,
      patient_id: 3,
      doctor_id: 1,
      medicine_name: 'Metformin 500mg',
      dosage_strength: '1 Tablet (500mg)',
      schedule_times: ['Morning', 'Night'],
      meal_instruction: 'After food',
      duration_days: 30,
      status: 'active',
      created_at: ts,
      doctor_name: 'Dr. Priya Sharma',
      patient_name: 'Ramesh Kumar',
    },
    {
      id: 2,
      consultation_id: 101,
      patient_id: 3,
      doctor_id: 1,
      medicine_name: 'Paracetamol 500mg',
      dosage_strength: '1 Tablet (500mg)',
      schedule_times: ['Morning', 'Night'],
      meal_instruction: 'After food',
      duration_days: 3,
      status: 'active',
      created_at: ts,
      doctor_name: 'Dr. Priya Sharma',
      patient_name: 'Ramesh Kumar',
    },
  ];

  const adherenceLogs: AdherenceLog[] = [
    {
      id: 1,
      schedule_id: 1,
      patient_id: 3,
      dose_date: ts.slice(0, 10),
      dose_slot: 'Morning',
      status: 'taken',
      note: 'Taken after breakfast',
      logged_at: ts,
      medicine_name: 'Metformin 500mg',
      dosage_strength: '1 Tablet (500mg)',
    },
  ];

  const smsLogs: SmsNotification[] = [
    {
      id: 1,
      appointment_id: 101,
      patient_id: 3,
      recipient_phone: '9876543210',
      event_type: 'confirmed',
      message_body: `AAROGYASETU Update: Your appointment APT-101 with Dr. Priya Sharma on ${appt1.scheduled_date} at 11:00 AM is CONFIRMED. Reply HELP for assistance.`,
      dedupe_key: 'sms-apt-101-confirmed',
      delivery_mode: 'demo_log',
      status: 'sent',
      created_at: ts,
    },
  ];

  return {
    users: [drPriya, drVikram, patRamesh],
    appointments: [appt1],
    consultations: [cons1],
    messages,
    reports,
    notes,
    schedules,
    adherenceLogs,
    smsLogs,
    qrTokens: [
      {
        token: 'AAROGYA-DEMO-TOKEN',
        patient_id: 3,
        scopes: ['blood_group', 'allergies', 'chronic_conditions', 'emergency_contact'],
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        revoked: false,
      },
    ],
    sessions: {},
  };
}

function loadDb(): StandaloneDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as StandaloneDb;
    }
  } catch {
    // ignore storage errors
  }
  const initial = createInitialDb();
  saveDb(initial);
  return initial;
}

function saveDb(db: StandaloneDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

function stripPassword(u: StoredUser): UserAccount {
  const { password_plain: _, ...rest } = u;
  return rest;
}

function getUserByToken(db: StandaloneDb, token: string): StoredUser {
  const uid = db.sessions[token];
  if (uid) {
    const found = db.users.find((u) => u.id === uid);
    if (found) return found;
  }
  // Also support decoding base64 token payload if page reloaded
  if (token.startsWith('local_tok_')) {
    const parts = token.split('_');
    const idNum = Number(parts[2]);
    const found = db.users.find((u) => u.id === idNum);
    if (found) return found;
  }
  throw new Error('Invalid or expired session token. Please sign in again.');
}

function enrichConsultation(db: StandaloneDb, c: Consultation): Consultation {
  const doc = db.users.find((u) => u.id === c.doctor_id);
  const pat = db.users.find((u) => u.id === c.patient_id);
  const msgs = db.messages.filter((m) => m.consultation_id === c.id);
  const reps = db.reports.filter((r) => r.consultation_id === c.id);
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
  return {
    ...c,
    doctor_name: doc?.full_name || 'Dr. Priya Sharma',
    doctor_phone: doc?.phone || '',
    doctor_email: doc?.email || '',
    doctor_specialty: doc?.doctor_profile?.specialty || 'General Medicine',
    doctor_clinic_name: doc?.doctor_profile?.clinic_name || 'Karavali CHC',
    doctor_clinic_location: doc?.doctor_profile?.clinic_location || 'Mangaluru',
    doctor_languages: doc?.doctor_profile?.languages_spoken || 'English, Hindi, Kannada',
    doctor_bio: doc?.doctor_profile?.bio || '',
    doctor_reg_no: doc?.doctor_profile?.registration_number || '',
    doctor_qualifications: doc?.doctor_profile?.qualifications || 'MBBS',
    patient_name: pat?.full_name || 'Patient',
    patient_phone: pat?.phone || '',
    patient_email: pat?.email || '',
    patient_age: pat?.patient_profile?.age ?? null,
    patient_dob: pat?.patient_profile?.date_of_birth || '',
    patient_gender: pat?.patient_profile?.gender || '',
    patient_village: pat?.patient_profile?.village_or_address || '',
    patient_blood_group: pat?.patient_profile?.blood_group || 'O+',
    patient_allergies: pat?.patient_profile?.allergies || 'None reported',
    patient_chronic_conditions: pat?.patient_profile?.chronic_conditions || 'None reported',
    patient_emergency_name: pat?.patient_profile?.emergency_contact_name || '',
    patient_emergency_phone: pat?.patient_profile?.emergency_contact_phone || '',
    patient_landmark: pat?.patient_profile?.manual_location_landmark || '',
    patient_sms_consent: pat?.patient_profile?.sms_consent ?? 1,
    last_message: lastMsg
      ? {
          content: lastMsg.content,
          sender_role: lastMsg.sender_role,
          sender_name: lastMsg.sender_name,
          created_at: lastMsg.created_at,
        }
      : null,
    message_count: msgs.length,
    report_count: reps.length,
  };
}

function enrichAppointment(db: StandaloneDb, a: Appointment): Appointment {
  const doc = db.users.find((u) => u.id === a.doctor_id);
  const pat = db.users.find((u) => u.id === a.patient_id);
  return {
    ...a,
    doctor_name: doc?.full_name || 'Dr. Priya Sharma',
    doctor_phone: doc?.phone || '',
    doctor_specialty: doc?.doctor_profile?.specialty || 'General Medicine',
    doctor_clinic_name: doc?.doctor_profile?.clinic_name || 'Karavali CHC',
    doctor_clinic_location: doc?.doctor_profile?.clinic_location || 'Mangaluru',
    patient_name: pat?.full_name || 'Patient',
    patient_phone: pat?.phone || '',
    patient_village: pat?.patient_profile?.village_or_address || '',
    patient_blood_group: pat?.patient_profile?.blood_group || 'O+',
    patient_allergies: pat?.patient_profile?.allergies || '',
    patient_emergency_phone: pat?.patient_profile?.emergency_contact_phone || '',
  };
}

export const localDb = {
  login(identifier: string, password: string, role?: UserRole) {
    const db = loadDb();
    const norm = identifier.trim().toLowerCase();
    const digits = identifier.replace(/\D/g, '');
    const user = db.users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === norm) ||
        u.phone === identifier.trim() ||
        (digits.length >= 7 && u.phone.replace(/\D/g, '') === digits)
    );
    if (!user || user.password_plain !== password) {
      throw new Error('Email or password is incorrect.');
    }
    if (role && user.role !== role) {
      throw new Error(
        `This account belongs to a ${user.role}. Please switch to the ${
          user.role === 'doctor' ? 'Doctor' : 'Patient'
        } Portal tab to sign in.`
      );
    }
    const token = `local_tok_${user.id}_${Date.now()}`;
    db.sessions[token] = user.id;
    saveDb(db);
    return {
      access_token: token,
      token_type: 'bearer',
      user: stripPassword(user),
    };
  },

  registerPatient(payload: {
    full_name: string;
    phone: string;
    email?: string | null;
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
  }) {
    const db = loadDb();
    const cleanPhone = payload.phone.trim();
    const cleanEmail = payload.email ? payload.email.trim().toLowerCase() : null;
    const exists = db.users.some(
      (u) => u.phone === cleanPhone || (cleanEmail && u.email?.toLowerCase() === cleanEmail)
    );
    if (exists) {
      throw new Error('An account with this phone number or email already exists.');
    }
    const newId = Math.max(0, ...db.users.map((u) => u.id)) + 1;
    const ts = nowIso();
    const newUser: StoredUser = {
      id: newId,
      role: 'patient',
      full_name: payload.full_name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      approval_status: 'approved',
      is_demo: 0,
      created_at: ts,
      password_plain: payload.password,
      patient_profile: {
        user_id: newId,
        age: payload.age ?? null,
        date_of_birth: payload.date_of_birth || '',
        gender: payload.gender || '',
        village_or_address: payload.village_or_address.trim(),
        blood_group: payload.blood_group || 'O+',
        allergies: payload.allergies || 'None reported',
        chronic_conditions: payload.chronic_conditions || 'None reported',
        emergency_contact_name: payload.emergency_contact_name.trim(),
        emergency_contact_phone: payload.emergency_contact_phone.trim(),
        manual_location_landmark: payload.manual_location_landmark || '',
        sms_consent: payload.sms_consent === false ? 0 : 1,
        updated_at: ts,
      },
    };
    db.users.push(newUser);

    // Create initial consultation with Dr. Priya Sharma
    const consId = Math.max(100, ...db.consultations.map((c) => c.id)) + 1;
    db.consultations.push({
      id: consId,
      reference_code: `CONS-${consId}`,
      patient_id: newId,
      doctor_id: 1,
      subject: 'Initial Tele-Consultation',
      status: 'active',
      clinical_summary: 'New patient intake. Ready for tele-consultation and medical report review.',
      created_at: ts,
      updated_at: ts,
    });
    db.messages.push({
      id: Date.now(),
      consultation_id: consId,
      sender_id: 1,
      sender_role: 'doctor',
      sender_name: 'Dr. Priya Sharma',
      content: `Namaste ${newUser.full_name}, welcome to AAROGYASETU. Please describe your symptoms or upload your medical report photo here.`,
      client_message_id: `welcome-${consId}`,
      delivery_state: 'sent',
      created_at: ts,
    });

    const token = `local_tok_${newId}_${Date.now()}`;
    db.sessions[token] = newId;
    saveDb(db);
    return {
      access_token: token,
      token_type: 'bearer',
      user: stripPassword(newUser),
    };
  },

  registerDoctor(payload: {
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
  }) {
    const db = loadDb();
    const cleanPhone = payload.phone.trim();
    const cleanEmail = payload.email.trim().toLowerCase();
    const exists = db.users.some(
      (u) => u.phone === cleanPhone || (u.email && u.email.toLowerCase() === cleanEmail)
    );
    if (exists) {
      throw new Error('A user with this phone number or email address already exists.');
    }
    const newId = Math.max(0, ...db.users.map((u) => u.id)) + 1;
    const ts = nowIso();
    const newDoc: StoredUser = {
      id: newId,
      role: 'doctor',
      full_name: payload.full_name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      approval_status: 'approved',
      is_demo: 0,
      created_at: ts,
      password_plain: payload.password,
      doctor_profile: {
        user_id: newId,
        registration_number: payload.registration_number || `KMC-${10000 + newId}`,
        specialty: payload.specialty.trim(),
        qualifications: payload.qualifications || 'MBBS',
        clinic_name: payload.clinic_name.trim(),
        clinic_location: payload.clinic_location.trim(),
        languages_spoken: payload.languages_spoken.trim(),
        bio: payload.bio || '',
        availability_slots: payload.availability_slots || ['09:30 AM', '11:30 AM', '03:00 PM'],
        is_accepting: 1,
        updated_at: ts,
      },
    };
    db.users.push(newDoc);

    // Also link an initial consultation with Ramesh Kumar so new doctors immediately see a patient
    const consId = Math.max(100, ...db.consultations.map((c) => c.id)) + 1;
    db.consultations.push({
      id: consId,
      reference_code: `CONS-${consId}`,
      patient_id: 3,
      doctor_id: newId,
      subject: 'General Tele-Consultation Request',
      status: 'active',
      clinical_summary: 'Assigned rural tele-consultation thread.',
      created_at: ts,
      updated_at: ts,
    });

    const token = `local_tok_${newId}_${Date.now()}`;
    db.sessions[token] = newId;
    saveDb(db);
    return {
      status: 'approved',
      approval_status: 'approved',
      access_token: token,
      token_type: 'bearer',
      message: 'Doctor account registered successfully. You are now logged in.',
      user: stripPassword(newDoc),
    };
  },

  getMyProfile(token: string): UserAccount {
    const db = loadDb();
    const user = getUserByToken(db, token);
    return stripPassword(user);
  },

  updatePatientProfile(token: string, payload: any): UserAccount {
    const db = loadDb();
    const user = getUserByToken(db, token);
    user.full_name = payload.full_name || user.full_name;
    user.phone = payload.phone || user.phone;
    user.email = payload.email ?? user.email;
    user.patient_profile = {
      user_id: user.id,
      age: payload.age ?? user.patient_profile?.age ?? null,
      date_of_birth: payload.date_of_birth ?? user.patient_profile?.date_of_birth ?? '',
      gender: payload.gender ?? user.patient_profile?.gender ?? '',
      village_or_address: payload.village_or_address ?? user.patient_profile?.village_or_address ?? '',
      blood_group: payload.blood_group ?? user.patient_profile?.blood_group ?? 'O+',
      allergies: payload.allergies ?? user.patient_profile?.allergies ?? '',
      chronic_conditions: payload.chronic_conditions ?? user.patient_profile?.chronic_conditions ?? '',
      emergency_contact_name: payload.emergency_contact_name ?? user.patient_profile?.emergency_contact_name ?? '',
      emergency_contact_phone: payload.emergency_contact_phone ?? user.patient_profile?.emergency_contact_phone ?? '',
      manual_location_landmark: payload.manual_location_landmark ?? user.patient_profile?.manual_location_landmark ?? '',
      sms_consent: payload.sms_consent === false ? 0 : 1,
      updated_at: nowIso(),
    };
    saveDb(db);
    return stripPassword(user);
  },

  updateDoctorProfile(token: string, payload: any): UserAccount {
    const db = loadDb();
    const user = getUserByToken(db, token);
    user.full_name = payload.full_name || user.full_name;
    user.phone = payload.phone || user.phone;
    user.email = payload.email || user.email;
    user.doctor_profile = {
      user_id: user.id,
      registration_number: payload.registration_number ?? user.doctor_profile?.registration_number ?? '',
      specialty: payload.specialty ?? user.doctor_profile?.specialty ?? 'General Medicine',
      qualifications: payload.qualifications ?? user.doctor_profile?.qualifications ?? 'MBBS',
      clinic_name: payload.clinic_name ?? user.doctor_profile?.clinic_name ?? '',
      clinic_location: payload.clinic_location ?? user.doctor_profile?.clinic_location ?? '',
      languages_spoken: payload.languages_spoken ?? user.doctor_profile?.languages_spoken ?? '',
      bio: payload.bio ?? user.doctor_profile?.bio ?? '',
      availability_slots: payload.availability_slots ?? user.doctor_profile?.availability_slots ?? [],
      is_accepting: payload.is_accepting === false ? 0 : 1,
      updated_at: nowIso(),
    };
    saveDb(db);
    return stripPassword(user);
  },

  searchDoctors(specialty?: string, language?: string): DoctorDirectoryItem[] {
    const db = loadDb();
    return db.users
      .filter((u) => u.role === 'doctor' && u.doctor_profile)
      .filter((u) => {
        if (specialty && specialty !== 'all') {
          if (!u.doctor_profile?.specialty.toLowerCase().includes(specialty.toLowerCase())) return false;
        }
        if (language && language !== 'all') {
          if (!u.doctor_profile?.languages_spoken.toLowerCase().includes(language.toLowerCase())) return false;
        }
        return true;
      })
      .map((u) => ({
        id: u.id,
        full_name: u.full_name,
        phone: u.phone,
        email: u.email,
        registration_number: u.doctor_profile?.registration_number,
        specialty: u.doctor_profile?.specialty || 'General Medicine',
        qualifications: u.doctor_profile?.qualifications || 'MBBS',
        clinic_name: u.doctor_profile?.clinic_name || 'Community Clinic',
        clinic_location: u.doctor_profile?.clinic_location || 'Karnataka',
        languages_spoken: u.doctor_profile?.languages_spoken || 'English, Hindi, Kannada',
        bio: u.doctor_profile?.bio || '',
        availability_slots: u.doctor_profile?.availability_slots || ['10:00 AM', '02:00 PM'],
        is_accepting: u.doctor_profile?.is_accepting ?? 1,
      }));
  },

  bookAppointment(
    token: string,
    payload: { doctor_id: number; scheduled_date: string; scheduled_time: string; chief_complaint: string }
  ): Appointment {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const ts = nowIso();
    let cons = db.consultations.find((c) => c.patient_id === user.id && c.doctor_id === payload.doctor_id);
    if (!cons) {
      const consId = Math.max(100, ...db.consultations.map((c) => c.id)) + 1;
      cons = {
        id: consId,
        reference_code: `CONS-${consId}`,
        patient_id: user.id,
        doctor_id: payload.doctor_id,
        subject: payload.chief_complaint,
        status: 'active',
        clinical_summary: payload.chief_complaint,
        created_at: ts,
        updated_at: ts,
      };
      db.consultations.push(cons);
    }
    const newId = Math.max(100, ...db.appointments.map((a) => a.id)) + 1;
    const appt: Appointment = {
      id: newId,
      reference_code: `APT-${newId}`,
      patient_id: user.id,
      doctor_id: payload.doctor_id,
      consultation_id: cons.id,
      scheduled_date: payload.scheduled_date,
      scheduled_time: payload.scheduled_time,
      status: 'requested',
      chief_complaint: payload.chief_complaint,
      created_at: ts,
      updated_at: ts,
    };
    db.appointments.unshift(appt);

    const doc = db.users.find((u) => u.id === payload.doctor_id);
    db.smsLogs.unshift({
      id: Date.now(),
      appointment_id: newId,
      patient_id: user.id,
      recipient_phone: user.phone,
      event_type: 'requested',
      message_body: `AAROGYASETU Update: Booking request APT-${newId} with ${
        doc?.full_name || 'Doctor'
      } for ${payload.scheduled_date} at ${payload.scheduled_time} received.`,
      dedupe_key: `sms-apt-${newId}-requested`,
      delivery_mode: 'demo_log',
      status: 'sent',
      created_at: ts,
    });

    saveDb(db);
    return enrichAppointment(db, appt);
  },

  fetchAppointments(token: string): Appointment[] {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const list =
      user.role === 'patient'
        ? db.appointments.filter((a) => a.patient_id === user.id)
        : db.appointments.filter((a) => a.doctor_id === user.id || user.id > 2);
    return list.map((a) => enrichAppointment(db, a));
  },

  updateAppointmentStatus(
    token: string,
    appointmentId: number,
    payload: { status: AppointmentStatus; new_date?: string; new_time?: string; reason?: string }
  ): Appointment {
    const db = loadDb();
    getUserByToken(db, token);
    const appt = db.appointments.find((a) => a.id === appointmentId);
    if (!appt) throw new Error('Appointment not found.');
    appt.status = payload.status;
    if (payload.new_date) appt.scheduled_date = payload.new_date;
    if (payload.new_time) appt.scheduled_time = payload.new_time;
    if (payload.reason) appt.status_reason = payload.reason;
    appt.updated_at = nowIso();

    const pat = db.users.find((u) => u.id === appt.patient_id);
    const doc = db.users.find((u) => u.id === appt.doctor_id);
    db.smsLogs.unshift({
      id: Date.now(),
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      recipient_phone: pat?.phone || '9876543210',
      event_type: payload.status,
      message_body: `AAROGYASETU Update: Appointment ${appt.reference_code} with ${
        doc?.full_name || 'Doctor'
      } on ${appt.scheduled_date} at ${appt.scheduled_time} is now ${payload.status.toUpperCase()}.`,
      dedupe_key: `sms-apt-${appt.id}-${payload.status}-${Date.now()}`,
      delivery_mode: 'demo_log',
      status: 'sent',
      created_at: nowIso(),
    });

    saveDb(db);
    return enrichAppointment(db, appt);
  },

  fetchAppointmentSmsLogs(token: string, appointmentId: number): SmsNotification[] {
    const db = loadDb();
    getUserByToken(db, token);
    return db.smsLogs.filter((s) => s.appointment_id === appointmentId);
  },

  fetchAllSmsLogs(token: string): SmsNotification[] {
    const db = loadDb();
    const user = getUserByToken(db, token);
    if (user.role === 'patient') {
      return db.smsLogs.filter((s) => s.patient_id === user.id);
    }
    return db.smsLogs;
  },

  fetchConsultations(token: string): Consultation[] {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const list =
      user.role === 'patient'
        ? db.consultations.filter((c) => c.patient_id === user.id)
        : db.consultations.filter((c) => c.doctor_id === user.id || user.id > 2);
    return list.map((c) => enrichConsultation(db, c));
  },

  fetchConsultationMessages(token: string, consultationId: number, afterId: number = 0): MessageItem[] {
    const db = loadDb();
    getUserByToken(db, token);
    return db.messages.filter((m) => m.consultation_id === consultationId && Number(m.id) > afterId);
  },

  sendConsultationMessage(
    token: string,
    consultationId: number,
    content: string,
    clientMessageId: string
  ): MessageItem {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const existing = db.messages.find(
      (m) => m.consultation_id === consultationId && m.client_message_id === clientMessageId
    );
    if (existing) return existing;
    const newMsg: MessageItem = {
      id: Math.max(0, ...db.messages.map((m) => Number(m.id) || 0)) + 1,
      consultation_id: consultationId,
      sender_id: user.id,
      sender_role: user.role,
      sender_name: user.full_name,
      content: content.trim(),
      client_message_id: clientMessageId,
      delivery_state: 'sent',
      created_at: nowIso(),
    };
    db.messages.push(newMsg);
    saveDb(db);
    return newMsg;
  },

  fetchConsultationReports(token: string, consultationId: number): ReportItem[] {
    const db = loadDb();
    getUserByToken(db, token);
    return db.reports.filter((r) => r.consultation_id === consultationId);
  },

  fetchMyPatientReports(token: string): ReportItem[] {
    const db = loadDb();
    const user = getUserByToken(db, token);
    return db.reports.filter((r) => r.patient_id === user.id);
  },

  async uploadReport(
    token: string,
    consultationId: number,
    params: { title: string; file: File; originalSizeBytes: number; wasCompressed: boolean },
    onProgress?: (pct: number) => void
  ): Promise<ReportItem> {
    const db = loadDb();
    const user = getUserByToken(db, token);
    if (onProgress) onProgress(40);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || createSampleReportDataUrl()));
      reader.onerror = () => resolve(createSampleReportDataUrl());
      reader.readAsDataURL(params.file);
    });
    if (onProgress) onProgress(100);
    const newId = Math.max(0, ...db.reports.map((r) => r.id)) + 1;
    const extracted: OCRField[] = [
      { parameter: 'Hemoglobin (Hb)', value: '12.2', unit: 'g/dL', reference: '13.0 - 17.0', flag: 'low' },
      { parameter: 'Total WBC Count', value: '6900', unit: '/cumm', reference: '4000 - 11000', flag: 'normal' },
      { parameter: 'Fasting Blood Sugar', value: '118', unit: 'mg/dL', reference: '70 - 100', flag: 'high' },
    ];
    const rep: ReportItem & { data_url?: string } = {
      id: newId,
      consultation_id: consultationId,
      patient_id: user.id,
      title: params.title,
      original_filename: params.file.name,
      mime_type: params.file.type || 'image/jpeg',
      original_size_bytes: params.originalSizeBytes,
      uploaded_size_bytes: params.file.size,
      was_compressed: params.wasCompressed ? 1 : 0,
      ocr_status: 'extracted',
      extracted_fields: extracted,
      doctor_reviewed: 0,
      doctor_corrected_fields: extracted,
      doctor_review_note: '',
      upload_status: 'uploaded',
      uploaded_at: nowIso(),
      data_url: dataUrl,
    };
    db.reports.unshift(rep);
    saveDb(db);
    return rep;
  },

  getReportBlobUrl(token: string, reportId: number): { url: string; mimeType: string } {
    const db = loadDb();
    getUserByToken(db, token);
    const rep = db.reports.find((r) => r.id === reportId);
    const url = rep?.data_url || createSampleReportDataUrl();
    return { url, mimeType: rep?.mime_type || 'image/svg+xml' };
  },

  reviewReport(
    token: string,
    reportId: number,
    payload: { doctor_review_note: string; corrected_fields: OCRField[] }
  ): ReportItem {
    const db = loadDb();
    getUserByToken(db, token);
    const rep = db.reports.find((r) => r.id === reportId);
    if (!rep) throw new Error('Report not found.');
    rep.doctor_reviewed = 1;
    rep.doctor_review_note = payload.doctor_review_note;
    rep.doctor_corrected_fields = payload.corrected_fields;
    rep.extracted_fields = payload.corrected_fields;
    saveDb(db);
    return rep;
  },

  createConsultationNote(
    token: string,
    consultationId: number,
    payload: { assessment: string; care_advice: string; red_flag_warnings: string; follow_up_date?: string }
  ): ConsultationNote {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const cons = db.consultations.find((c) => c.id === consultationId);
    const newNote: ConsultationNote = {
      id: Math.max(0, ...db.notes.map((n) => n.id)) + 1,
      consultation_id: consultationId,
      patient_id: cons?.patient_id || 3,
      doctor_id: user.id,
      assessment: payload.assessment,
      care_advice: payload.care_advice,
      red_flag_warnings: payload.red_flag_warnings,
      follow_up_date: payload.follow_up_date || '',
      created_at: nowIso(),
      doctor_name: user.full_name,
      doctor_specialty: user.doctor_profile?.specialty || 'General Medicine',
      consultation_code: cons?.reference_code || `CONS-${consultationId}`,
    };
    db.notes.unshift(newNote);
    saveDb(db);
    return newNote;
  },

  fetchConsultationNotes(token: string, consultationId: number): ConsultationNote[] {
    const db = loadDb();
    getUserByToken(db, token);
    return db.notes.filter((n) => n.consultation_id === consultationId);
  },

  fetchPatientMedicalRecords(token: string, patientId?: number) {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const pid = patientId || (user.role === 'patient' ? user.id : 3);
    return {
      patient_id: pid,
      clinical_notes: db.notes.filter((n) => n.patient_id === pid),
      reports: db.reports.filter((r) => r.patient_id === pid),
      active_medicines: db.schedules.filter((s) => s.patient_id === pid),
    };
  },

  createMedicineSchedule(
    token: string,
    consultationId: number,
    payload: {
      medicine_name: string;
      dosage_strength: string;
      schedule_times: string[];
      meal_instruction: string;
      duration_days: number;
    }
  ): MedicineSchedule {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const cons = db.consultations.find((c) => c.id === consultationId);
    const pat = db.users.find((u) => u.id === (cons?.patient_id || 3));
    const sched: MedicineSchedule = {
      id: Math.max(0, ...db.schedules.map((s) => s.id)) + 1,
      consultation_id: consultationId,
      patient_id: cons?.patient_id || 3,
      doctor_id: user.id,
      medicine_name: payload.medicine_name,
      dosage_strength: payload.dosage_strength,
      schedule_times: payload.schedule_times,
      meal_instruction: payload.meal_instruction,
      duration_days: payload.duration_days,
      status: 'active',
      created_at: nowIso(),
      doctor_name: user.full_name,
      patient_name: pat?.full_name || 'Ramesh Kumar',
    };
    db.schedules.push(sched);
    saveDb(db);
    return sched;
  },

  fetchMedicineSchedules(token: string, patientId?: number): MedicineSchedule[] {
    const db = loadDb();
    const user = getUserByToken(db, token);
    if (patientId) return db.schedules.filter((s) => s.patient_id === patientId);
    if (user.role === 'patient') return db.schedules.filter((s) => s.patient_id === user.id);
    return db.schedules;
  },

  logDoseAdherence(
    token: string,
    scheduleId: number,
    payload: { dose_date: string; dose_slot: string; status: 'taken' | 'skipped'; note?: string }
  ) {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const sched = db.schedules.find((s) => s.id === scheduleId);
    const ts = nowIso();
    db.adherenceLogs.unshift({
      id: Date.now(),
      schedule_id: scheduleId,
      patient_id: user.id,
      dose_date: payload.dose_date,
      dose_slot: payload.dose_slot,
      status: payload.status,
      note: payload.note || '',
      logged_at: ts,
      medicine_name: sched?.medicine_name || 'Medicine',
      dosage_strength: sched?.dosage_strength || '',
    });
    saveDb(db);
    return { status: 'logged', dose_status: payload.status, logged_at: ts };
  },

  fetchAdherenceSummary(token: string, patientId?: number): AdherenceSummary {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const pid = patientId || (user.role === 'patient' ? user.id : 3);
    const logs = db.adherenceLogs.filter((l) => l.patient_id === pid);
    const taken = logs.filter((l) => l.status === 'taken').length;
    const skipped = logs.filter((l) => l.status === 'skipped').length;
    const total = logs.length;
    return {
      patient_id: pid,
      adherence_rate_pct: total > 0 ? Math.round((taken / total) * 100) : 100,
      total_logged: total,
      taken_count: taken,
      skipped_count: skipped,
      recent_logs: logs.slice(0, 15),
    };
  },

  generateQRToken(token: string, payload: { scopes: string[]; expiry_hours: number }): QRTokenResponse {
    const db = loadDb();
    const user = getUserByToken(db, token);
    const qrToken = `AAROGYA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + payload.expiry_hours * 3600 * 1000).toISOString();
    db.qrTokens.unshift({
      token: qrToken,
      patient_id: user.id,
      scopes: payload.scopes,
      expires_at: expiresAt,
      revoked: false,
    });
    saveDb(db);
    return {
      token: qrToken,
      expires_at: expiresAt,
      scopes: payload.scopes,
      consent_notice:
        'Zero Raw PHI in QR — Only an opaque temporary token is encoded. You may revoke this token in one tap at any time.',
    };
  },

  revokeQRToken(token: string, qrTokenStr: string) {
    const db = loadDb();
    getUserByToken(db, token);
    const found = db.qrTokens.find((q) => q.token === qrTokenStr);
    if (found) found.revoked = true;
    saveDb(db);
    return { status: 'revoked', token: qrTokenStr };
  },

  resolveQRToken(token: string, qrTokenStr: string): QRResolvedData {
    const db = loadDb();
    getUserByToken(db, token);
    const found = db.qrTokens.find((q) => q.token.toUpperCase() === qrTokenStr.trim().toUpperCase());
    if (!found || found.revoked) {
      throw new Error('QR token is invalid, expired, or has been revoked by the patient.');
    }
    const pat = db.users.find((u) => u.id === found.patient_id) || db.users.find((u) => u.role === 'patient')!;
    return {
      status: 'valid',
      consented_scopes: found.scopes,
      patient_data: {
        patient_name: pat.full_name,
        token: found.token,
        expires_at: found.expires_at,
        age: pat.patient_profile?.age ?? 46,
        gender: pat.patient_profile?.gender || 'Male',
        village: pat.patient_profile?.village_or_address || 'Belthangady',
        blood_group: pat.patient_profile?.blood_group || 'O+',
        allergies: pat.patient_profile?.allergies || 'None reported',
        chronic_conditions: pat.patient_profile?.chronic_conditions || 'None reported',
        emergency_contact_name: pat.patient_profile?.emergency_contact_name || 'Family Contact',
        emergency_contact_phone: pat.patient_profile?.emergency_contact_phone || '9876501234',
      },
    };
  },

  askAIAssistant(token: string, question: string): AIAssistantResponse {
    const db = loadDb();
    getUserByToken(db, token);
    const q = question.toLowerCase();
    const redFlags = ['chest pain', 'breathless', 'unconscious', 'seizure', 'stroke', 'bleeding', 'snake'];
    const isRed = redFlags.some((kw) => q.includes(kw));
    if (isRed) {
      return {
        question,
        is_red_flag: true,
        answer:
          'URGENT RED-FLAG SYMPTOM DETECTED: Symptoms such as chest pain, severe breathlessness, or heavy bleeding require immediate emergency medical evaluation. Do not wait for an online consultation.',
        emergency_number: '108',
        disclaimer:
          'NON-DIAGNOSTIC EDUCATION ONLY. AAROGYASETU AI Assistant does not diagnose conditions or prescribe medications.',
        recommended_action: 'Call 108 immediately or proceed to the nearest 24x7 Community Health Centre (CHC).',
      };
    }
    return {
      question,
      is_red_flag: false,
      answer:
        'AAROGYASETU Rural Health Literacy Guide: Stay hydrated with clean boiled water, take doctor-prescribed medications strictly on schedule, and share your lab values (such as Hemoglobin or Fasting Blood Sugar) with your assigned doctor for clinical interpretation.',
      emergency_number: '108',
      disclaimer:
        'NON-DIAGNOSTIC EDUCATION ONLY. AAROGYASETU AI Assistant does not diagnose conditions or prescribe medications.',
      recommended_action: 'Book or open a consultation with Dr. Priya Sharma for personalized clinical advice.',
    };
  },

  fetchEmergencySosInfo(token: string): EmergencySosInfo {
    const db = loadDb();
    const user = getUserByToken(db, token);
    return {
      emergency_number: '108',
      emergency_label: 'National Ambulance / Medical Emergency (108)',
      family_emergency_contact: user.patient_profile
        ? {
            name: user.patient_profile.emergency_contact_name,
            phone: user.patient_profile.emergency_contact_phone,
          }
        : { name: 'Kavitha Kumar (Spouse)', phone: '9876501234' },
      manual_location_landmark:
        user.patient_profile?.manual_location_landmark || 'Near Belthangady Panchayat Office',
      nearby_facilities: [
        {
          name: 'Belthangady Community Health Centre (CHC)',
          type: 'Government CHC (24x7 Emergency)',
          distance_km: '2.4 km',
          phone: '08256-232120',
          location: 'Near Bus Stand, Belthangady, Dakshina Kannada',
        },
        {
          name: 'Karavali Rural Tele-Health & Primary Centre',
          type: 'PHC Telemedicine Hub',
          distance_km: '4.1 km',
          phone: '0824-2213400',
          location: 'Puttur Road, Dakshina Kannada',
        },
        {
          name: 'Karkala Taluk Hospital & 24x7 Emergency',
          type: 'Taluk Government Hospital',
          distance_km: '8.5 km',
          phone: '08258-230230',
          location: 'Main Road, Karkala, Udupi District',
        },
      ],
      no_auto_dispatch_notice:
        "No Auto-Dispatch — AAROGYASETU does not automatically dispatch emergency services. Tapping the button opens your device's telephone dialer directly.",
    };
  },
};
