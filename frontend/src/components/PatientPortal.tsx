import React, { useCallback, useEffect, useState } from 'react';
import {
  askAIAssistantApi,
  bookAppointmentApi,
  fetchAdherenceSummaryApi,
  fetchAppointmentsApi,
  fetchAppointmentSmsLogsApi,
  fetchAuthorizedReportBlobUrl,
  fetchEmergencySosInfoApi,
  fetchMedicineSchedulesApi,
  fetchMyPatientReportsApi,
  fetchPatientConsultationsApi,
  fetchPatientMedicalRecordsApi,
  generateQRTokenApi,
  logDoseAdherenceApi,
  revokeQRTokenApi,
  searchDoctorsApi,
  updatePatientProfileApi,
} from '../api';
import {
  AdherenceSummary,
  AIAssistantResponse,
  Appointment,
  Consultation,
  ConsultationNote,
  DoctorDirectoryItem,
  EmergencySosInfo,
  MedicineSchedule,
  QRTokenResponse,
  ReportItem,
  SmsNotification,
  UserAccount,
} from '../types';
import { formatFileSize } from '../utils/compressImage';
import { ConsultationWorkspace } from './ConsultationWorkspace';

interface PatientPortalProps {
  token: string;
  user: UserAccount;
  onUserUpdated: (updated: UserAccount) => void;
  isEffectiveOnline: boolean;
  lang?: 'en' | 'hi';
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  token,
  user,
  onUserUpdated,
  isEffectiveOnline,
  lang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'appointments' | 'consultation' | 'records' | 'reminders' | 'assistant' | 'qr' | 'sos' | 'profile'
  >('dashboard');

  // Consultations state
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selectedAptForSms, setSelectedAptForSms] = useState<Appointment | null>(null);
  const [aptSmsLogs, setAptSmsLogs] = useState<SmsNotification[]>([]);

  // Doctor search & Booking state
  const [doctors, setDoctors] = useState<DoctorDirectoryItem[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<DoctorDirectoryItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bookingNotice, setBookingNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Records & Notes state
  const [allReports, setAllReports] = useState<ReportItem[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ConsultationNote[]>([]);
  const [viewingReportModal, setViewingReportModal] = useState<{
    report: ReportItem;
    blobUrl: string;
    mimeType: string;
  } | null>(null);

  // Medicine Reminders state
  const [schedules, setSchedules] = useState<MedicineSchedule[]>([]);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [doseLoggingNotice, setDoseLoggingNotice] = useState<string | null>(null);

  // AI Health Assistant state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIAssistantResponse | null>(null);

  // Tokenized QR Medical Profile state
  const [qrScopes, setQrScopes] = useState<string[]>([
    'demographics',
    'blood_group',
    'allergies',
    'emergency_contact',
  ]);
  const [qrConsent, setQrConsent] = useState(true);
  const [qrExpiryHours, setQrExpiryHours] = useState(24);
  const [activeQr, setActiveQr] = useState<QRTokenResponse | null>(null);
  const [qrNotice, setQrNotice] = useState<string | null>(null);

  // Emergency SOS state
  const [sosInfo, setSosInfo] = useState<EmergencySosInfo | null>(null);
  const [sosGpsCoords, setSosGpsCoords] = useState<string | null>(null);

  // Patient Profile form state
  const pp = user.patient_profile;
  const [fullName, setFullName] = useState(user.full_name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [age, setAge] = useState(pp?.age ? String(pp.age) : '');
  const [dob, setDob] = useState(pp?.date_of_birth || '');
  const [gender, setGender] = useState(pp?.gender || '');
  const [village, setVillage] = useState(pp?.village_or_address || '');
  const [bloodGroup, setBloodGroup] = useState(pp?.blood_group || 'O+');
  const [allergies, setAllergies] = useState(pp?.allergies || '');
  const [chronicConditions, setChronicConditions] = useState(pp?.chronic_conditions || '');
  const [emgName, setEmgName] = useState(pp?.emergency_contact_name || '');
  const [emgPhone, setEmgPhone] = useState(pp?.emergency_contact_phone || '');
  const [landmark, setLandmark] = useState(pp?.manual_location_landmark || '');
  const [smsConsent, setSmsConsent] = useState(pp?.sms_consent !== 0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load consultations
  const loadConsultations = useCallback(async () => {
    if (!isEffectiveOnline) return;
    try {
      const list = await fetchPatientConsultationsApi(token);
      setConsultations(list);
      if (list.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(list[0].id);
      }
    } catch {
      // ignore
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  // Load appointments
  const loadAppointments = useCallback(async () => {
    if (!isEffectiveOnline) return;
    setLoadingAppointments(true);
    try {
      const list = await fetchAppointmentsApi(token);
      setAppointments(list);
    } catch {
      // ignore
    } finally {
      setLoadingAppointments(false);
    }
  }, [token, isEffectiveOnline]);

  // Load doctor directory
  const loadDoctors = useCallback(async () => {
    try {
      const list = await searchDoctorsApi(specialtyFilter);
      setDoctors(list);
    } catch {
      // ignore
    }
  }, [specialtyFilter]);

  // Load medical records & notes
  const loadRecords = useCallback(async () => {
    if (!isEffectiveOnline) return;
    try {
      const [reps, recs] = await Promise.all([
        fetchMyPatientReportsApi(token),
        fetchPatientMedicalRecordsApi(token),
      ]);
      setAllReports(reps);
      setClinicalNotes(recs.clinical_notes || []);
    } catch {
      // ignore
    }
  }, [token, isEffectiveOnline]);

  // Load medicine schedules & adherence
  const loadMedications = useCallback(async () => {
    if (!isEffectiveOnline) return;
    try {
      const [scheds, adh] = await Promise.all([
        fetchMedicineSchedulesApi(token),
        fetchAdherenceSummaryApi(token),
      ]);
      setSchedules(scheds);
      setAdherence(adh);
    } catch {
      // ignore
    }
  }, [token, isEffectiveOnline]);

  // Load SOS info
  const loadSos = useCallback(async () => {
    try {
      const info = await fetchEmergencySosInfoApi(token);
      setSosInfo(info);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    loadConsultations();
    loadAppointments();
    loadDoctors();
    loadRecords();
    loadMedications();
    loadSos();
  }, [loadConsultations, loadAppointments, loadDoctors, loadRecords, loadMedications, loadSos]);

  // Handle appointment booking
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorForBooking) return;
    setBookingNotice(null);
    try {
      const apt = await bookAppointmentApi(token, {
        doctor_id: selectedDoctorForBooking.id,
        scheduled_date: bookingDate,
        scheduled_time: bookingTime,
        chief_complaint: chiefComplaint.trim() || 'General tele-consultation',
      });
      setBookingNotice({
        type: 'success',
        text: `Appointment #${apt.reference_code} booked successfully (${apt.status.toUpperCase()})! Zero-PHI SMS notification has been queued.`,
      });
      setChiefComplaint('');
      loadAppointments();
      loadConsultations();
    } catch (err: any) {
      setBookingNotice({ type: 'error', text: err?.message || 'Booking failed.' });
    }
  };

  // View SMS logs for an appointment
  const handleViewSmsLogs = async (apt: Appointment) => {
    setSelectedAptForSms(apt);
    try {
      const logs = await fetchAppointmentSmsLogsApi(token, apt.id);
      setAptSmsLogs(logs);
    } catch {
      setAptSmsLogs([]);
    }
  };

  // Mark medicine dose taken or skipped
  const handleLogDose = async (scheduleId: number, slot: string, status: 'taken' | 'skipped') => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await logDoseAdherenceApi(token, scheduleId, {
        dose_date: today,
        dose_slot: slot,
        status,
        note: `Marked ${status} by patient on mobile PWA`,
      });
      setDoseLoggingNotice(`Dose marked as ${status.toUpperCase()}!`);
      loadMedications();
      setTimeout(() => setDoseLoggingNotice(null), 3000);
    } catch (err: any) {
      alert(`Could not log dose: ${err?.message || 'Error'}`);
    }
  };

  // Ask AI Assistant
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const resp = await askAIAssistantApi(token, aiQuestion.trim());
      setAiResponse(resp);
    } catch (err: any) {
      alert(`AI Assistant Error: ${err?.message || 'Could not answer.'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Generate QR Token
  const handleGenerateQR = async () => {
    if (!qrConsent) {
      alert('Please check the explicit consent box to generate a temporary QR token.');
      return;
    }
    try {
      const res = await generateQRTokenApi(token, {
        scopes: qrScopes,
        expiry_hours: qrExpiryHours,
      });
      setActiveQr(res);
      setQrNotice('New temporary QR Token generated. Zero raw medical data is stored inside this code.');
    } catch (err: any) {
      alert(`Error generating QR: ${err?.message}`);
    }
  };

  // Revoke QR Token
  const handleRevokeQR = async () => {
    if (!activeQr) return;
    try {
      await revokeQRTokenApi(token, activeQr.token);
      setActiveQr(null);
      setQrNotice('QR Token was revoked. It can no longer be scanned or resolved by clinics.');
    } catch (err: any) {
      alert(`Error revoking QR: ${err?.message}`);
    }
  };

  // Save patient profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const updated = await updatePatientProfileApi(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        age: age.trim() ? Number(age) : null,
        date_of_birth: dob.trim(),
        gender: gender.trim(),
        village_or_address: village.trim(),
        blood_group: bloodGroup.trim(),
        allergies: allergies.trim(),
        chronic_conditions: chronicConditions.trim(),
        emergency_contact_name: emgName.trim(),
        emergency_contact_phone: emgPhone.trim(),
        manual_location_landmark: landmark.trim(),
        sms_consent: smsConsent,
      });
      onUserUpdated(updated);
      setProfileMsg({ type: 'success', text: 'Patient profile and consent settings saved successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err?.message || 'Could not update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenReportModal = async (report: ReportItem) => {
    try {
      const { url, mimeType } = await fetchAuthorizedReportBlobUrl(token, report.id);
      setViewingReportModal({ report, blobUrl: url, mimeType });
    } catch (err: any) {
      alert(`Cannot open report: ${err?.message}`);
    }
  };

  const selectedConsultation = consultations.find((c) => c.id === selectedConsultationId) || consultations[0];
  const nextAppointment = appointments.find((a) => a.status === 'confirmed' || a.status === 'requested');

  return (
    <div className="portal-container">
      {/* 2G Low-Bandwidth Telemetry Bar */}
      <div className="telemetry-bar">
        <span>⚡ 2G Data Saver: <strong>ACTIVE</strong></span>
        <span>•</span>
        <span>Original Photos: <strong>~3.2 MB</strong> → Compressed: <strong>~38 KB (98% Saved)</strong></span>
        <span>•</span>
        <span>Network Status: <strong style={{ color: isEffectiveOnline ? '#166534' : '#991b1b' }}>{isEffectiveOnline ? '2G / ONLINE' : 'OFFLINE (CACHE MODE)'}</strong></span>
      </div>

      {/* Patient Navigation Tabs (Bilingual) */}
      <div className="nav-tabs" role="tablist">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          {lang === 'hi' ? '📊 डैशबोर्ड' : '📊 Dashboard'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          {lang === 'hi' ? '🩺 अपॉइंटमेंट बुक करें' : '🩺 Book Appointment'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'consultation' ? 'active' : ''}`}
          onClick={() => setActiveTab('consultation')}
        >
          {lang === 'hi' ? '💬 परामर्श और चैट' : '💬 Consultation Chat'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          {lang === 'hi' ? '📋 रिपोर्ट और मेडिकल रिकॉर्ड' : '📋 Reports & Records'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminders')}
        >
          {lang === 'hi' ? '💊 दवा अनुस्मारक' : '💊 Medicine Reminders'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
          onClick={() => setActiveTab('assistant')}
        >
          {lang === 'hi' ? '🤖 AI स्वास्थ्य सहायक' : '🤖 AI Health Assistant'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          {lang === 'hi' ? '📱 QR मेडिकल प्रोफाइल' : '📱 QR Medical Profile'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'sos' ? 'active' : ''}`}
          onClick={() => setActiveTab('sos')}
        >
          {lang === 'hi' ? '🚨 आपातकालीन SOS' : '🚨 Emergency SOS'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          {lang === 'hi' ? '👤 मेरी प्रोफाइल' : '👤 My Profile & Consent'}
        </button>
      </div>

      {/* ==================== TAB 1: DASHBOARD (P-03) ==================== */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="card-title">
                {lang === 'hi' ? `नमस्ते, ${user.full_name}` : `Welcome back, ${user.full_name}`}
              </h2>
              <p className="card-subtitle">
                Village: {user.patient_profile?.village_or_address || 'Belthangady Village'} • Phone: {user.phone} • Blood Group: {user.patient_profile?.blood_group || 'O+'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
            {/* Upcoming Appointment Card */}
            <div className="card" style={{ borderLeft: '4px solid #1e3a8a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#0b1f3a', fontSize: '0.95rem' }}>Upcoming Tele-Consultation</strong>
                {nextAppointment && (
                  <span className="badge badge-success">{nextAppointment.status.toUpperCase()}</span>
                )}
              </div>
              {nextAppointment ? (
                <div style={{ marginTop: 8, fontSize: '0.84rem', color: '#334155' }}>
                  <div>Doctor: <strong>{nextAppointment.doctor_name || 'Dr. Priya Sharma'}</strong></div>
                  <div>Date: <strong>{nextAppointment.scheduled_date} at {nextAppointment.scheduled_time}</strong></div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                    Complaint: {nextAppointment.chief_complaint}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => setActiveTab('appointments')}
                  >
                    View Appointment Details
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: '0.84rem', color: '#64748b' }}>
                  No upcoming appointments booked.
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('appointments')}>
                      Book Appointment Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Today's Medication Reminder Card */}
            <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
              <strong style={{ color: '#0b1f3a', fontSize: '0.95rem' }}>Today's Due Medication</strong>
              {schedules.length > 0 ? (
                <div style={{ marginTop: 8, fontSize: '0.84rem', color: '#334155' }}>
                  <div>Medicine: <strong>{schedules[0].medicine_name}</strong> ({schedules[0].dosage_strength})</div>
                  <div>Slot: <strong>Morning / Night</strong> ({schedules[0].meal_instruction})</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleLogDose(schedules[0].id, 'Morning', 'taken')}
                    >
                      ✓ Mark Taken
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLogDose(schedules[0].id, 'Morning', 'skipped')}
                    >
                      Skip
                    </button>
                  </div>
                  {doseLoggingNotice && (
                    <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: 6, fontWeight: 600 }}>
                      {doseLoggingNotice}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: '0.84rem', color: '#64748b' }}>
                  No active medicine schedules recorded by doctor.
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', color: '#0b1f3a', marginBottom: 12 }}>
              Quick Tele-Health Services (कम डेटा और तेज पहुंच)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('appointments')}>
                🩺 Book Doctor Slot
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('consultation')}>
                💬 Open Chat & Reports
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('records')}>
                📋 Medical Records & OCR
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('reminders')}>
                💊 Medicine Reminders
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('assistant')}>
                🤖 Ask AI Assistant
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('qr')}>
                📱 QR Medical Token
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setActiveTab('sos')}>
                🚨 1-Tap Emergency SOS
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('profile')}>
                👤 Edit Profile & Consent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: APPOINTMENTS & BOOKING (P-04, P-05) ==================== */}
      {activeTab === 'appointments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Book New Appointment Form */}
          <div className="card">
            <h3 className="card-title">Book Tele-Doctor Consultation</h3>
            <p className="card-subtitle">
              Select verified clinician, pick an open 15-minute time slot, and submit complaint.
            </p>

            {bookingNotice && (
              <div className={`alert ${bookingNotice.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {bookingNotice.text}
              </div>
            )}

            {/* Specialty Filter */}
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">Filter Doctors by Specialty</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'General Medicine', 'Pediatrics', 'Family Care'].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`btn btn-sm ${specialtyFilter === sp ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSpecialtyFilter(sp)}
                  >
                    {sp === 'all' ? 'All Specialties' : sp}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Selection */}
            <div className="form-group">
              <label className="form-label">Select Verified Clinician *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {doctors.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedDoctorForBooking(d);
                      if (d.availability_slots.length > 0) setBookingTime(d.availability_slots[0]);
                    }}
                    style={{
                      border: selectedDoctorForBooking?.id === d.id ? '2px solid #1e3a8a' : '1px solid #cbd5e1',
                      background: selectedDoctorForBooking?.id === d.id ? '#f0f9ff' : '#ffffff',
                      borderRadius: 6,
                      padding: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{d.full_name}</strong> ({d.qualifications || 'MBBS'})
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      {d.specialty} • {d.clinic_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Languages: {d.languages_spoken}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDoctorForBooking && (
              <form onSubmit={handleBookAppointment}>
                <div className="form-group">
                  <label className="form-label">Consultation Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Available Time Slots *</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedDoctorForBooking.availability_slots.map((sl) => (
                      <button
                        key={sl}
                        type="button"
                        className={`btn btn-sm ${bookingTime === sl ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setBookingTime(sl)}
                      >
                        {sl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chief Health Complaint / Symptoms *</label>
                  <textarea
                    className="form-textarea"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="e.g. Fever since 3 days, cough and weakness in Belthangady village..."
                    required
                  />
                </div>

                <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
                  ℹ️ <strong>Zero-PHI SMS Notice:</strong> An automated SMS alert will be dispatched to your phone ({user.phone}) confirming your slot date & doctor name without sensitive medical details.
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={!isEffectiveOnline}>
                  Confirm & Submit Appointment Request
                </button>
              </form>
            )}
          </div>

          {/* Appointment History List */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">My Appointments ({appointments.length})</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadAppointments}>
                Refresh
              </button>
            </div>

            {loadingAppointments ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Loading appointments...</div>
            ) : appointments.length === 0 ? (
              <div style={{ padding: 16, color: '#64748b' }}>No appointments booked yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {appointments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: 12,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0b1f3a' }}>
                        #{a.reference_code}: {a.doctor_name || 'Dr. Priya Sharma'}
                      </strong>
                      <span
                        className={`badge ${
                          a.status === 'confirmed'
                            ? 'badge-success'
                            : a.status === 'requested'
                            ? 'badge-warning'
                            : a.status === 'rescheduled'
                            ? 'badge-info'
                            : 'badge-secondary'
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: 4 }}>
                      Scheduled: <strong>{a.scheduled_date} at {a.scheduled_time}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                      Complaint: {a.chief_complaint}
                    </div>
                    {a.status_reason && (
                      <div style={{ fontSize: '0.74rem', color: '#1e3a8a', marginTop: 4 }}>
                        Note: {a.status_reason}
                      </div>
                    )}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewSmsLogs(a)}
                      >
                        📱 View SMS Alerts
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (a.consultation_id) setSelectedConsultationId(a.consultation_id);
                          setActiveTab('consultation');
                        }}
                      >
                        💬 Chat with Doctor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMS Logs Modal */}
      {selectedAptForSms && (
        <div className="modal-backdrop" onClick={() => setSelectedAptForSms(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">SMS Notifications for #{selectedAptForSms.reference_code}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAptForSms(null)}>
                Close
              </button>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 12 }}>
              Consent-gated audit trail. All SMS alerts are strictly zero-PHI (no symptoms, diagnoses, or drug names).
            </div>
            {aptSmsLogs.length === 0 ? (
              <div style={{ color: '#64748b' }}>No SMS alerts logged yet for this appointment.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aptSmsLogs.map((s) => (
                  <div key={s.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#1e3a8a' }}>
                      <strong>{s.event_type.toUpperCase()} ({s.delivery_mode})</strong>
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a', marginTop: 4 }}>
                      "{s.message_body}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: CONSULTATION & CHAT (P-06) ==================== */}
      {activeTab === 'consultation' && (
        <div>
          {selectedConsultation ? (
            <ConsultationWorkspace
              token={token}
              currentUserId={user.id}
              currentUserRole="patient"
              currentUserName={user.full_name}
              consultation={selectedConsultation}
              isEffectiveOnline={isEffectiveOnline}
              onConsultationActivity={loadRecords}
            />
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
              No consultation found. Please book an appointment first.
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: REPORTS, OCR & CLINICAL NOTES (P-07) ==================== */}
      {activeTab === 'records' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Uploaded Reports & Machine-Read OCR */}
          <div className="card">
            <h3 className="card-title">Uploaded Medical Reports & Machine-Read OCR</h3>
            <p className="card-subtitle">
              Reports compressed in browser via HTML5 Canvas before upload. OCR lab values must be verified by a doctor.
            </p>

            {allReports.length === 0 ? (
              <div style={{ padding: 16, color: '#64748b' }}>No medical reports uploaded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {allReports.map((r) => (
                  <div key={r.id} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 12, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0b1f3a' }}>{r.title}</strong>
                      <span className={`badge ${r.doctor_reviewed ? 'badge-success' : 'badge-warning'}`}>
                        {r.doctor_reviewed ? 'Verified by Doctor' : 'Pending Doctor Review'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4 }}>
                      Original: {formatFileSize(r.original_size_bytes)} → Stored: {formatFileSize(r.uploaded_size_bytes)} {r.was_compressed ? '(Compressed ~98%)' : ''}
                    </div>

                    {/* OCR Parameter Table */}
                    {r.extracted_fields && r.extracted_fields.length > 0 && (
                      <div style={{ marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                        <div style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 600, marginBottom: 4 }}>
                          ⚠️ Machine-Read — May Be Incomplete — Requires Doctor Review
                        </div>
                        <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                              <th>Parameter</th>
                              <th>Result</th>
                              <th>Unit</th>
                              <th>Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.extracted_fields.map((f, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td>{f.parameter}</td>
                                <td><strong>{f.value}</strong></td>
                                <td>{f.unit}</td>
                                <td>{f.reference}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {r.doctor_review_note && (
                      <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#166534', background: '#f0fdf4', padding: 6, borderRadius: 4 }}>
                        👨‍⚕️ <strong>Doctor Note:</strong> {r.doctor_review_note}
                      </div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenReportModal(r)}>
                        🔍 View Private Report Image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signed Consultation Notes */}
          <div className="card">
            <h3 className="card-title">Signed Doctor Consultation Notes</h3>
            <p className="card-subtitle">
              Official clinical assessments, dietary advice, and red-flag warnings authored by your doctor.
            </p>

            {clinicalNotes.length === 0 ? (
              <div style={{ padding: 16, color: '#64748b' }}>No consultation notes signed yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {clinicalNotes.map((cn) => (
                  <div key={cn.id} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 12, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0b1f3a' }}>
                        {cn.doctor_name || 'Dr. Priya Sharma'} ({cn.doctor_specialty || 'General Medicine'})
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {new Date(cn.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ marginTop: 6, fontSize: '0.84rem', color: '#0f172a' }}>
                      <strong>Assessment / Diagnosis:</strong>
                      <div style={{ marginTop: 2 }}>{cn.assessment}</div>
                    </div>

                    {cn.care_advice && (
                      <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#334155' }}>
                        <strong>Care & Dietary Advice:</strong>
                        <div style={{ marginTop: 2 }}>{cn.care_advice}</div>
                      </div>
                    )}

                    {cn.red_flag_warnings && (
                      <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#991b1b', background: '#fef2f2', padding: 6, borderRadius: 4 }}>
                        ⚠️ <strong>Red-Flag Warning:</strong> {cn.red_flag_warnings}
                      </div>
                    )}

                    {cn.follow_up_date && (
                      <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#1e3a8a' }}>
                        📅 <strong>Follow-Up Date:</strong> {cn.follow_up_date}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 5: MEDICINE REMINDERS (P-09) ==================== */}
      {activeTab === 'reminders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="card">
            <h3 className="card-title">Doctor-Approved Medicine Schedules</h3>
            <p className="card-subtitle">
              Only authenticated doctors can prescribe schedules. Mark doses as taken or skipped daily.
            </p>

            {schedules.length === 0 ? (
              <div style={{ padding: 16, color: '#64748b' }}>No active medicine schedules found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {schedules.map((s) => (
                  <div key={s.id} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 12, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#0b1f3a' }}>{s.medicine_name}</strong>
                      <span className="badge badge-success">{s.dosage_strength}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 4 }}>
                      Instructions: <strong>{s.meal_instruction}</strong> • Duration: {s.duration_days} days
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#1e3a8a', marginTop: 4 }}>
                      Prescribing Clinician: {s.doctor_name || 'Dr. Priya Sharma'}
                    </div>

                    {/* Dose Slots */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0b1f3a', marginBottom: 6 }}>
                        Today's Dose Check-in:
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.schedule_times.map((slot) => (
                          <div key={slot} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: 4 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{slot}</span>
                            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleLogDose(s.id, slot, 'taken')}
                              >
                                ✓ Taken
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleLogDose(s.id, slot, 'skipped')}
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adherence Summary & History */}
          <div className="card">
            <h3 className="card-title">Adherence Log & Statistics</h3>
            <p className="card-subtitle">
              Your adherence history helps doctors adjust your prescription during follow-up visits.
            </p>

            {adherence ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: adherence.adherence_rate_pct >= 80 ? '#166534' : '#b45309' }}>
                    {adherence.adherence_rate_pct}%
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>7-Day Medication Adherence</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Taken: {adherence.taken_count} doses • Skipped: {adherence.skipped_count} doses
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: '0.85rem', color: '#0b1f3a', marginTop: 12, marginBottom: 8 }}>Recent Dose Log</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {adherence.recent_logs.map((l) => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 8px', background: '#f8fafc', borderRadius: 4 }}>
                      <div>
                        <strong>{l.medicine_name || 'Prescription'}</strong> ({l.dose_slot})
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{l.dose_date}</div>
                      </div>
                      <span className={`badge ${l.status === 'taken' ? 'badge-success' : 'badge-warning'}`}>
                        {l.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b' }}>Loading adherence stats...</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 6: AI HEALTH ASSISTANT (P-08) ==================== */}
      {activeTab === 'assistant' && (
        <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">AAROGYASETU AI Health Assistant (स्वास्थ्य सहायक)</h3>
              <p className="card-subtitle">
                Plain-language rural health literacy, medical term explanations & triage guidance.
              </p>
            </div>
          </div>

          <div className="alert alert-warning" style={{ fontSize: '0.82rem' }}>
            ⚠️ <strong>NON-DIAGNOSTIC EDUCATION ONLY:</strong> This AI assistant explains lab terms and general health tips. It <strong>never diagnoses conditions, prescribes medicines, or replaces a qualified doctor</strong>.
          </div>

          {/* Question Form */}
          <form onSubmit={handleAskAI}>
            <div className="form-group">
              <label className="form-label">Ask a Question / Term</label>
              <input
                type="text"
                className="form-input"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="e.g. What does Hemoglobin mean? Or what is ORS?"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>Popular Topics:</span>
              {['Hemoglobin', 'WBC', 'Platelets', 'Fasting Sugar', 'CRP', 'ORS', 'Fever', 'Cough'].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAiQuestion(`What is ${topic} and why is it important in lab tests?`)}
                >
                  {topic}
                </button>
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={aiLoading}>
              {aiLoading ? 'Consulting Health Guide...' : 'Ask AI Health Assistant'}
            </button>
          </form>

          {/* AI Response Box */}
          {aiResponse && (
            <div style={{ marginTop: 16 }}>
              {aiResponse.is_red_flag ? (
                <div className="alert alert-error">
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>🚨 CRITICAL TRIAGE ALERT</h4>
                  <p style={{ marginTop: 4, fontSize: '0.85rem' }}>{aiResponse.answer}</p>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => setActiveTab('sos')}
                  >
                    Open Emergency SOS (Call 108)
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e3a8a' }}>
                    Q: {aiResponse.question}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#0f172a', marginTop: 8, lineHeight: 1.5 }}>
                    {aiResponse.answer}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                    Recommendation: {aiResponse.recommended_action}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 7: TOKENIZED QR MEDICAL PROFILE (P-10) ==================== */}
      {activeTab === 'qr' && (
        <div className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
          <h3 className="card-title">Tokenized QR Medical Profile (सुरक्षित QR कोड)</h3>
          <p className="card-subtitle">
            Share patient-consented medical details with rural clinics using temporary revocable tokens. Zero raw PHI in QR.
          </p>

          {qrNotice && <div className="alert alert-info">{qrNotice}</div>}

          {/* Field Category Checkboxes */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, margin: '12px 0' }}>
            <strong style={{ fontSize: '0.85rem', color: '#0b1f3a' }}>Select Information to Share:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {[
                { id: 'demographics', label: 'Basic Demographics (Name, Age, Village)' },
                { id: 'blood_group', label: `Blood Group (${user.patient_profile?.blood_group || 'O+'})` },
                { id: 'allergies', label: 'Known Allergies' },
                { id: 'chronic_conditions', label: 'Chronic Conditions' },
                { id: 'emergency_contact', label: 'Emergency Contact' },
              ].map((item) => (
                <label key={item.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={qrScopes.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) setQrScopes((prev) => [...prev, item.id]);
                      else setQrScopes((prev) => prev.filter((s) => s !== item.id));
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Token Expiry:</label>
              {[1, 24, 168].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  className={`btn btn-sm ${qrExpiryHours === hrs ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setQrExpiryHours(hrs)}
                >
                  {hrs === 1 ? '1 Hour' : hrs === 24 ? '24 Hours' : '7 Days'}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={qrConsent}
                  onChange={(e) => setQrConsent(e.target.checked)}
                />
                I give explicit consent to share the selected medical fields via this token.
              </label>
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-block" onClick={handleGenerateQR}>
            Generate Temporary QR Token
          </button>

          {/* Active QR Display */}
          {activeQr && (
            <div style={{ textAlign: 'center', marginTop: 18, background: '#ffffff', padding: 16, border: '2px solid #1e3a8a', borderRadius: 8 }}>
              {/* Synthetic Vector QR Code Representation */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  margin: '0 auto',
                  background: '#f1f5f9',
                  border: '8px solid #0b1f3a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#0b1f3a',
                  fontSize: '0.75rem',
                  letterSpacing: '1px',
                }}
              >
                [QR CODE]<br />
                {activeQr.token.slice(-8)}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0b1f3a', marginTop: 10 }}>
                {activeQr.token}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Expires: {new Date(activeQr.expires_at).toLocaleString()}
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ marginTop: 12 }}
                onClick={handleRevokeQR}
              >
                Revoke Token Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 8: EMERGENCY SOS (P-11) ==================== */}
      {activeTab === 'sos' && (
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">🚨 Emergency SOS (आपातकालीन सहायता)</h3>
              <p className="card-subtitle">
                1-tap phone dialer for medical emergencies and nearby Primary Health Centre directory.
              </p>
            </div>
          </div>

          {/* Hard Guardrail Rose Banner */}
          <div className="alert alert-error" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {sosInfo?.no_auto_dispatch_notice || 'No Auto-Dispatch — Tapping dialer buttons initiates phone calls directly through your device.'}
          </div>

          {/* Primary 108 Calling Button */}
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <a
              href={`tel:${sosInfo?.emergency_number || '108'}`}
              className="btn btn-danger"
              style={{ fontSize: '1.2rem', padding: '16px 32px', borderRadius: 8, textDecoration: 'none' }}
            >
              📞 CALL {sosInfo?.emergency_number || '108'} (AMBULANCE)
            </a>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
              Configured Emergency Number: <strong>{sosInfo?.emergency_number || '108'}</strong>
            </div>
          </div>

          {/* Family Contact Dialer */}
          {sosInfo?.family_emergency_contact && (
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12, borderRadius: 6, marginBottom: 14 }}>
              <strong>Family Emergency Contact:</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div>
                  {sosInfo.family_emergency_contact.name}: <strong>{sosInfo.family_emergency_contact.phone}</strong>
                </div>
                <a
                  href={`tel:${sosInfo.family_emergency_contact.phone}`}
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  Call Family Member
                </a>
              </div>
            </div>
          )}

          {/* Location & Landmark */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12, borderRadius: 6, marginBottom: 14 }}>
            <strong>Village Landmark & Location:</strong>
            <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 4 }}>
              {user.patient_profile?.manual_location_landmark || user.patient_profile?.village_or_address || 'Belthangady Village, Dakshina Kannada'}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setSosGpsCoords(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
                    () => alert('GPS unavailable. Using manual village landmark.')
                  );
                }
              }}
            >
              📍 Attach GPS Coordinates
            </button>
            {sosGpsCoords && (
              <span style={{ fontSize: '0.78rem', color: '#166534', marginLeft: 10, fontWeight: 600 }}>
                Coords: {sosGpsCoords}
              </span>
            )}
          </div>

          {/* Nearby PHC Directory */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: '#0b1f3a', marginBottom: 8 }}>
              Nearby 24x7 Government Primary Health Centres (PHCs)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sosInfo?.nearby_facilities.map((fac, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    padding: '8px 12px',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#0b1f3a' }}>{fac.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {fac.type} • Distance: <strong>{fac.distance_km}</strong>
                    </div>
                  </div>
                  <a
                    href={`tel:${fac.phone}`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Call {fac.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 9: PATIENT PROFILE & CONSENT (P-02) ==================== */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h3 className="card-title">Patient Profile & Consent Settings</h3>
          <p className="card-subtitle">
            Update your rural demographic details, blood group, allergies, and SMS notification preferences.
          </p>

          {profileMsg && (
            <div className={`alert ${profileMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Age (Years)</label>
                <input
                  type="number"
                  className="form-input"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-input"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="form-select" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label className="form-label">Village / Town / Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Allergies (e.g. Penicillin)</label>
                <input
                  type="text"
                  className="form-input"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Chronic Conditions (e.g. BP, Diabetes)</label>
                <input
                  type="text"
                  className="form-input"
                  value={chronicConditions}
                  onChange={(e) => setChronicConditions(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={emgName}
                  onChange={(e) => setEmgName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Phone *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={emgPhone}
                  onChange={(e) => setEmgPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Manual Location Landmark (Near Temple, School, Panchayat)</label>
                <input
                  type="text"
                  className="form-input"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
              </div>

              <div className="form-group full-width">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                  />
                  <strong>Enable SMS Appointment Alerts (Zero-PHI)</strong> — Receive slot confirmations and reminders on your mobile phone without sensitive health information.
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={savingProfile}>
              {savingProfile ? 'Saving Profile...' : 'Save Profile & Preferences'}
            </button>
          </form>
        </div>
      )}

      {/* Modal for viewing report */}
      {viewingReportModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            URL.revokeObjectURL(viewingReportModal.blobUrl);
            setViewingReportModal(null);
          }}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="card-header">
              <h3 className="card-title">{viewingReportModal.report.title}</h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  URL.revokeObjectURL(viewingReportModal.blobUrl);
                  setViewingReportModal(null);
                }}
              >
                Close
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              {viewingReportModal.mimeType.startsWith('image/') ? (
                <img
                  src={viewingReportModal.blobUrl}
                  alt={viewingReportModal.report.title}
                  style={{ maxWidth: '100%', maxHeight: 450, borderRadius: 4, border: '1px solid #cbd5e1' }}
                />
              ) : (
                <iframe
                  src={viewingReportModal.blobUrl}
                  title={viewingReportModal.report.title}
                  style={{ width: '100%', height: 400, border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
