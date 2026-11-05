import React, { useCallback, useEffect, useState } from 'react';
import {
  approveDoctorApi,
  createConsultationNoteApi,
  createMedicineScheduleApi,
  fetchAdherenceSummaryApi,
  fetchAllSmsLogsApi,
  fetchAppointmentSmsLogsApi,
  fetchAppointmentsApi,
  fetchAuthorizedReportBlobUrl,
  fetchConsultationMessagesApi,
  fetchConsultationNotesApi,
  fetchConsultationReportsApi,
  fetchDoctorConsultationsApi,
  fetchMedicineSchedulesApi,
  resolveQRTokenApi,
  reviewReportApi,
  sendConsultationMessageApi,
  updateAppointmentStatusApi,
  updateDoctorProfileApi,
} from '../api';
import {
  AdherenceSummary,
  Appointment,
  AppointmentStatus,
  Consultation,
  ConsultationNote,
  MedicineSchedule,
  MessageItem,
  OCRField,
  QRResolvedData,
  ReportItem,
  SmsNotification,
  UserAccount,
} from '../types';

interface DoctorPortalProps {
  token: string;
  user: UserAccount;
  onUserUpdated: (updated: UserAccount) => void;
  isEffectiveOnline: boolean;
  lang?: 'en' | 'hi';
}

type DoctorTab =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'chat'
  | 'ocr_review'
  | 'clinical_notes'
  | 'medicine_schedules'
  | 'profile';

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  token,
  user,
  onUserUpdated,
  isEffectiveOnline,
  lang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<DoctorTab>('dashboard');

  // Core Data States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Appointment Filter
  const [appointmentFilter, setAppointmentFilter] = useState<string>('all');
  const [rescheduleModal, setRescheduleModal] = useState<{
    appointment: Appointment;
    newDate: string;
    newTime: string;
  } | null>(null);
  const [cancelModal, setCancelModal] = useState<{
    appointment: Appointment;
    reason: string;
  } | null>(null);

  // SMS Logs Modal
  const [smsLogsModal, setSmsLogsModal] = useState<{
    appointmentId: number;
    logs: SmsNotification[];
    loading: boolean;
  } | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<MessageItem[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [sendingChat, setSendingChat] = useState<boolean>(false);

  // OCR Review State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportBlobUrl, setReportBlobUrl] = useState<string | null>(null);
  const [editableOcrFields, setEditableOcrFields] = useState<OCRField[]>([]);
  const [doctorReviewNote, setDoctorReviewNote] = useState<string>('');
  const [reviewingReport, setReviewingReport] = useState<boolean>(false);

  // Clinical Notes State
  const [notesHistory, setNotesHistory] = useState<ConsultationNote[]>([]);
  const [noteAssessment, setNoteAssessment] = useState<string>('');
  const [noteCareAdvice, setNoteCareAdvice] = useState<string>('');
  const [noteRedFlags, setNoteRedFlags] = useState<string>('');
  const [noteFollowUpDate, setNoteFollowUpDate] = useState<string>('');
  const [publishingNote, setPublishingNote] = useState<boolean>(false);

  // Medicine Schedules State
  const [medicineSchedules, setMedicineSchedules] = useState<MedicineSchedule[]>([]);
  const [adherenceSummary, setAdherenceSummary] = useState<AdherenceSummary | null>(null);
  const [medName, setMedName] = useState<string>('');
  const [medDose, setMedDose] = useState<string>('');
  const [medMorning, setMedMorning] = useState<boolean>(true);
  const [medAfternoon, setMedAfternoon] = useState<boolean>(false);
  const [medNight, setMedNight] = useState<boolean>(true);
  const [medMeal, setMedMeal] = useState<string>('After food');
  const [medDuration, setMedDuration] = useState<number>(7);
  const [creatingMed, setCreatingMed] = useState<boolean>(false);

  // QR Token Lookup State
  const [qrTokenInput, setQrTokenInput] = useState<string>('');
  const [qrLookupResult, setQrLookupResult] = useState<QRResolvedData | null>(null);
  const [qrLookupError, setQrLookupError] = useState<string | null>(null);
  const [qrLookingUp, setQrLookingUp] = useState<boolean>(false);

  // Doctor Profile Form State
  const dp = user.doctor_profile;
  const [fullName, setFullName] = useState<string>(user.full_name || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [email, setEmail] = useState<string>(user.email || '');
  const [regNumber, setRegNumber] = useState<string>(dp?.registration_number || '');
  const [specialty, setSpecialty] = useState<string>(dp?.specialty || 'General Medicine');
  const [qualifications, setQualifications] = useState<string>(dp?.qualifications || 'MBBS');
  const [clinicName, setClinicName] = useState<string>(dp?.clinic_name || 'Community Health Clinic');
  const [clinicLocation, setClinicLocation] = useState<string>(dp?.clinic_location || 'Udupi / Mangalore');
  const [languagesSpoken, setLanguagesSpoken] = useState<string>(dp?.languages_spoken || 'English, Hindi, Kannada');
  const [bio, setBio] = useState<string>(dp?.bio || '');
  const [slotsString, setSlotsString] = useState<string>(
    dp?.availability_slots && dp.availability_slots.length > 0
      ? dp.availability_slots.join(', ')
      : 'Mon-Fri 09:00-13:00, Mon-Fri 16:00-19:00, Sat 10:00-14:00'
  );
  const [isAccepting, setIsAccepting] = useState<boolean>(dp?.is_accepting ?? true);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // Load baseline doctor data
  const loadDoctorData = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [appts, consList] = await Promise.all([
        fetchAppointmentsApi(token),
        fetchDoctorConsultationsApi(token),
      ]);
      setAppointments(appts);
      setConsultations(consList);
      if (consList.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(consList[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load doctor dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  useEffect(() => {
    loadDoctorData();
  }, [loadDoctorData]);

  // Load consultation-specific thread, reports, notes, medicine schedules
  const loadActiveConsultationDetails = useCallback(async () => {
    if (!selectedConsultationId || !isEffectiveOnline) return;
    try {
      const [msgs, reps, notes, meds] = await Promise.all([
        fetchConsultationMessagesApi(token, selectedConsultationId, 0),
        fetchConsultationReportsApi(token, selectedConsultationId),
        fetchConsultationNotesApi(token, selectedConsultationId),
        fetchMedicineSchedulesApi(token),
      ]);
      setChatMessages(msgs);
      setReports(reps);
      setNotesHistory(notes);
      setMedicineSchedules(meds);

      // Select first report if none selected
      if (reps.length > 0 && !selectedReportId) {
        setSelectedReportId(reps[0].id);
        setEditableOcrFields(reps[0].extracted_fields || []);
        setDoctorReviewNote(reps[0].doctor_review_note || '');
      }

      // Adherence summary
      const activeCons = consultations.find((c) => c.id === selectedConsultationId);
      if (activeCons) {
        fetchAdherenceSummaryApi(token, activeCons.patient_id)
          .then((sum) => setAdherenceSummary(sum))
          .catch(() => {});
      }
    } catch (err: any) {
      console.warn('Error loading consultation details', err);
    }
  }, [token, selectedConsultationId, isEffectiveOnline, selectedReportId, consultations]);

  useEffect(() => {
    loadActiveConsultationDetails();
  }, [loadActiveConsultationDetails]);

  // Load report blob when selectedReportId changes
  useEffect(() => {
    if (!selectedReportId || !token) {
      setReportBlobUrl(null);
      return;
    }
    const currentRep = reports.find((r) => r.id === selectedReportId);
    if (currentRep) {
      setEditableOcrFields(currentRep.extracted_fields || []);
      setDoctorReviewNote(currentRep.doctor_review_note || '');
    }
    fetchAuthorizedReportBlobUrl(token, selectedReportId)
      .then((res) => setReportBlobUrl(res.url))
      .catch((err) => console.warn('Could not load report image blob', err));
  }, [token, selectedReportId, reports]);

  // Appointment Actions
  const handleConfirmAppointment = async (appt: Appointment) => {
    try {
      const updated = await updateAppointmentStatusApi(token, appt.id, {
        status: 'confirmed',
      });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionSuccess(`Appointment #${appt.id} confirmed. Patient notified via Zero-PHI SMS.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not confirm appointment: ${err?.message || 'Error'}`);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleModal) return;
    try {
      const updated = await updateAppointmentStatusApi(token, rescheduleModal.appointment.id, {
        status: 'rescheduled',
        new_date: rescheduleModal.newDate,
        new_time: rescheduleModal.newTime,
        reason: 'Doctor reschedule request',
      });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setRescheduleModal(null);
      setActionSuccess(`Appointment #${updated.id} rescheduled to ${updated.scheduled_date} ${updated.scheduled_time}. Zero-PHI SMS sent.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not reschedule: ${err?.message || 'Error'}`);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelModal) return;
    try {
      const updated = await updateAppointmentStatusApi(token, cancelModal.appointment.id, {
        status: 'cancelled',
        reason: cancelModal.reason || 'Doctor unavailable',
      });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setCancelModal(null);
      setActionSuccess(`Appointment #${updated.id} cancelled. Zero-PHI SMS cancellation notice sent.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not cancel appointment: ${err?.message || 'Error'}`);
    }
  };

  const handleCompleteAppointment = async (appt: Appointment) => {
    try {
      const updated = await updateAppointmentStatusApi(token, appt.id, {
        status: 'completed',
      });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionSuccess(`Appointment #${appt.id} marked as completed.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not complete appointment: ${err?.message || 'Error'}`);
    }
  };

  const handleOpenSmsLogs = async (apptId: number) => {
    setSmsLogsModal({ appointmentId: apptId, logs: [], loading: true });
    try {
      const logs = await fetchAppointmentSmsLogsApi(token, apptId);
      setSmsLogsModal({ appointmentId: apptId, logs, loading: false });
    } catch (err: any) {
      alert(`Could not load SMS audit logs: ${err?.message || 'Error'}`);
      setSmsLogsModal(null);
    }
  };

  // Chat Actions
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput.trim();
    if (!textToSend || !selectedConsultationId) return;
    setSendingChat(true);
    const clientMsgId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      const savedMsg = await sendConsultationMessageApi(
        token,
        selectedConsultationId,
        textToSend,
        clientMsgId
      );
      setChatMessages((prev) => [...prev, savedMsg]);
      if (!customText) setChatInput('');
    } catch (err: any) {
      alert(`Could not send message: ${err?.message || 'Error'}`);
    } finally {
      setSendingChat(false);
    }
  };

  // OCR Review Action
  const handleOcrFieldChange = (idx: number, key: keyof OCRField, val: any) => {
    setEditableOcrFields((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  const handleAddOcrField = () => {
    setEditableOcrFields((prev) => [
      ...prev,
      { parameter: 'New Parameter', value: '0', unit: '-', reference_range: 'Normal' },
    ]);
  };

  const handleApproveReportReview = async () => {
    if (!selectedReportId) return;
    setReviewingReport(true);
    try {
      const reviewed = await reviewReportApi(token, selectedReportId, {
        doctor_review_note: doctorReviewNote,
        corrected_fields: editableOcrFields,
      });
      setReports((prev) => prev.map((r) => (r.id === reviewed.id ? reviewed : r)));
      setActionSuccess(`Report #${reviewed.id} verified and approved. Doctor review status recorded.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not save OCR review: ${err?.message || 'Error'}`);
    } finally {
      setReviewingReport(false);
    }
  };

  // Clinical Notes Action
  const handlePublishClinicalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsultationId) return;
    if (!noteAssessment.trim() || !noteCareAdvice.trim()) {
      alert('Assessment and Care Advice are required fields.');
      return;
    }
    setPublishingNote(true);
    try {
      const newNote = await createConsultationNoteApi(token, selectedConsultationId, {
        assessment: noteAssessment.trim(),
        care_advice: noteCareAdvice.trim(),
        red_flag_warnings: noteRedFlags.trim(),
        follow_up_date: noteFollowUpDate || undefined,
      });
      setNotesHistory((prev) => [newNote, ...prev]);
      setNoteAssessment('');
      setNoteCareAdvice('');
      setNoteRedFlags('');
      setNoteFollowUpDate('');
      setActionSuccess('Clinical Consultation Note published and signed successfully.');
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not publish note: ${err?.message || 'Error'}`);
    } finally {
      setPublishingNote(false);
    }
  };

  // Medicine Schedule Prescribing Action
  const handleCreateMedicineSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsultationId) return;
    if (!medName.trim() || !medDose.trim()) {
      alert('Medicine name and dosage are required.');
      return;
    }
    const times: string[] = [];
    if (medMorning) times.push('Morning');
    if (medAfternoon) times.push('Afternoon');
    if (medNight) times.push('Night');
    if (times.length === 0) {
      alert('Select at least one timing slot (Morning, Afternoon, or Night).');
      return;
    }
    setCreatingMed(true);
    try {
      const newSched = await createMedicineScheduleApi(token, selectedConsultationId, {
        medicine_name: medName.trim(),
        dosage_strength: medDose.trim(),
        schedule_times: times,
        meal_instruction: medMeal,
        duration_days: Number(medDuration) || 7,
      });
      setMedicineSchedules((prev) => [...prev, newSched]);
      setMedName('');
      setMedDose('');
      setActionSuccess(`Medicine schedule for "${newSched.medicine_name}" approved and active.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not prescribe medicine: ${err?.message || 'Error'}`);
    } finally {
      setCreatingMed(false);
    }
  };

  // QR Token Lookup Action
  const handleLookupQrToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrTokenInput.trim()) return;
    setQrLookingUp(true);
    setQrLookupError(null);
    setQrLookupResult(null);
    try {
      const res = await resolveQRTokenApi(token, qrTokenInput.trim().toUpperCase());
      setQrLookupResult(res);
    } catch (err: any) {
      setQrLookupError(err?.message || 'Invalid, expired, or revoked QR medical token.');
    } finally {
      setQrLookingUp(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const parsedSlots = slotsString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await updateDoctorProfileApi(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        registration_number: regNumber.trim(),
        specialty: specialty.trim(),
        qualifications: qualifications.trim(),
        clinic_name: clinicName.trim(),
        clinic_location: clinicLocation.trim(),
        languages_spoken: languagesSpoken.trim(),
        bio: bio.trim(),
        availability_slots: parsedSlots,
        is_accepting: isAccepting,
      });
      onUserUpdated(updated);
      setActionSuccess('Doctor profile and availability updated successfully.');
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Could not save doctor profile: ${err?.message || 'Error'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // Derived metrics
  const requestedCount = appointments.filter((a) => a.status === 'requested').length;
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const unreviewedOcrReports = reports.filter((r) => r.doctor_review_status === 'pending');

  const filteredAppointments = appointments.filter((a) => {
    if (appointmentFilter === 'all') return true;
    return a.status === appointmentFilter;
  });

  const activeConsultation = consultations.find((c) => c.id === selectedConsultationId);
  const selectedReport = reports.find((r) => r.id === selectedReportId);

  // Quick reply chips
  const clinicalQuickChips = [
    'Take prescribed medicine strictly after food.',
    'Report immediately to nearest PHC if fever > 102°F or breathlessness occurs.',
    'Continue current dosage for 5 full days and report for follow-up.',
    'Avoid heavy physical work, stay hydrated with boiled water.',
    'Complete fasting blood sugar and CBC lab tests before next consultation.',
  ];

  return (
    <div className="portal-container">
      {/* Top Banner for Pending Doctor Approval */}
      {user.approval_status === 'pending' && (
        <div
          className="alert alert-warning"
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Account Status: Pending Medical Council Verification.</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Your doctor account is awaiting administrative review. Clinical records and consultations will become active once verified.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await approveDoctorApi(token, user.id);
                alert('Doctor profile auto-approved for evaluation!');
                window.location.reload();
              } catch (e: any) {
                alert(e?.message || 'Approval failed');
              }
            }}
          >
            Quick Approve (Demo)
          </button>
        </div>
      )}

      {/* Global Success Banner */}
      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {actionSuccess}
        </div>
      )}

      {/* Doctor Navigation Tabs */}
      <nav className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'dashboard' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          {lang === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
          {unreviewedOcrReports.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 99,
                backgroundColor: '#dc2626',
                color: '#fff',
                fontSize: '0.72rem',
              }}
            >
              {unreviewedOcrReports.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'appointments' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          {lang === 'hi' ? 'अपॉइंटमेंट्स' : 'Appointments'}
          {requestedCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 99,
                backgroundColor: '#d97706',
                color: '#fff',
                fontSize: '0.72rem',
              }}
            >
              {requestedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'patients' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          {lang === 'hi' ? 'मरीज़ सूची' : 'Assigned Patients'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'chat' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          {lang === 'hi' ? 'परामर्श चैट' : 'Consultation Chat'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ocr_review' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('ocr_review')}
        >
          {lang === 'hi' ? 'लैब रिपोर्ट समीक्षा' : 'Smart OCR Review'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'clinical_notes' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('clinical_notes')}
        >
          {lang === 'hi' ? 'क्लिनिकल नोट्स' : 'Clinical Notes'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'medicine_schedules' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('medicine_schedules')}
        >
          {lang === 'hi' ? 'दवा अनुसूची' : 'Medicine Schedules'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'profile' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          {lang === 'hi' ? 'डॉक्टर प्रोफ़ाइल' : 'Doctor Profile & Hours'}
        </button>
      </nav>

      {/* ==================== TAB 1: DASHBOARD ==================== */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Triage Metrics Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                REQUESTED APPOINTMENTS
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
                {requestedCount}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Awaiting doctor action</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #1e3a8a' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                CONFIRMED QUEUE
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e3a8a' }}>
                {confirmedCount}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Scheduled for consultation</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                COMPLETED
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>
                {completedCount}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Fully closed visits</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                UNREVIEWED OCR REPORTS
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626' }}>
                {unreviewedOcrReports.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Require clinical approval</div>
            </div>
          </div>

          {/* Quick Emergency QR Token Lookup */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Quick Emergency QR Medical Profile Lookup</h3>
                <p className="card-subtitle">
                  Enter an 8-character token presented by a patient to view verified clinical summary without storing raw PHI.
                </p>
              </div>
            </div>

            <form onSubmit={handleLookupQrToken} style={{ display: 'flex', gap: 10, maxWidth: 520, margin: '12px 0' }}>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. AAROGYA-DEMO-TOKEN or ABCD1234"
                value={qrTokenInput}
                onChange={(e) => setQrTokenInput(e.target.value)}
                maxLength={32}
              />
              <button type="submit" className="btn btn-primary" disabled={qrLookingUp}>
                {qrLookingUp ? 'Verifying...' : 'Verify Token'}
              </button>
            </form>

            {qrLookupError && <div className="alert alert-error">{qrLookupError}</div>}

            {qrLookupResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="badge badge-success">TOKEN VERIFIED ACTIVE</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Expires: {new Date(qrLookupResult.expires_at).toLocaleString()}
                  </span>
                </div>
                <div className="info-kv-grid">
                  <div className="info-kv-item">
                    <span className="info-kv-label">Patient Name</span>
                    <span className="info-kv-value">{qrLookupResult.patient_summary.full_name}</span>
                  </div>
                  <div className="info-kv-item">
                    <span className="info-kv-label">Age / Gender</span>
                    <span className="info-kv-value">
                      {qrLookupResult.patient_summary.age || 'N/A'} yrs • {qrLookupResult.patient_summary.gender || 'N/A'}
                    </span>
                  </div>
                  <div className="info-kv-item">
                    <span className="info-kv-label">Blood Group</span>
                    <span className="info-kv-value" style={{ color: '#b91c1c', fontWeight: 800 }}>
                      {qrLookupResult.patient_summary.blood_group || 'Not specified'}
                    </span>
                  </div>
                  <div className="info-kv-item">
                    <span className="info-kv-label">Emergency Contact</span>
                    <span className="info-kv-value">
                      {qrLookupResult.patient_summary.emergency_contact_name} ({qrLookupResult.patient_summary.emergency_contact_phone})
                    </span>
                  </div>
                  <div className="info-kv-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="info-kv-label">Known Allergies</span>
                    <span className="info-kv-value" style={{ color: '#b45309' }}>
                      {qrLookupResult.patient_summary.allergies || 'None reported'}
                    </span>
                  </div>
                  <div className="info-kv-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="info-kv-label">Chronic Conditions</span>
                    <span className="info-kv-value">
                      {qrLookupResult.patient_summary.chronic_conditions || 'None reported'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Navigation Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div className="card">
              <h4 style={{ margin: '0 0 8px 0', color: '#0b1f3a' }}>Pending Appointments ({requestedCount})</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>
                Review and approve slot requests submitted by rural patients.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAppointmentFilter('requested');
                  setActiveTab('appointments');
                }}
              >
                Go to Appointment Queue →
              </button>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 8px 0', color: '#0b1f3a' }}>Smart OCR Verification ({unreviewedOcrReports.length})</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>
                Review machine-extracted lab parameters before committing to clinical record.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab('ocr_review')}
              >
                Open OCR Reviewer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: APPOINTMENTS QUEUE ==================== */}
      {activeTab === 'appointments' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Appointment Management Queue</h3>
              <p className="card-subtitle">
                Accept, reschedule, or cancel patient appointments. Confirming or rescheduling automatically dispatches Zero-PHI SMS notifications.
              </p>
            </div>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'requested', 'confirmed', 'rescheduled', 'cancelled', 'completed'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn btn-sm ${appointmentFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAppointmentFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              No appointments found matching "{appointmentFilter}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {filteredAppointments.map((appt) => (
                <div
                  key={appt.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                    backgroundColor: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0b1f3a' }}>
                        Patient: {appt.patient_name || `Patient #${appt.patient_id}`}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Appointment Ref: <strong>APT-{appt.id}</strong> • Slot: <strong>{appt.scheduled_date} at {appt.scheduled_time}</strong>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`badge ${
                          appt.status === 'confirmed'
                            ? 'badge-success'
                            : appt.status === 'requested'
                            ? 'badge-warning'
                            : appt.status === 'completed'
                            ? 'badge-neutral'
                            : 'badge-danger'
                        }`}
                      >
                        {appt.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: 10,
                      borderRadius: 6,
                      fontSize: '0.85rem',
                      marginBottom: 10,
                    }}
                  >
                    <strong>Chief Complaint:</strong> {appt.chief_complaint || 'General consultation request'}
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {appt.status === 'requested' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConfirmAppointment(appt)}
                        >
                          ✓ Confirm & Notify SMS
                        </button>
                      )}
                      {(appt.status === 'requested' || appt.status === 'confirmed') && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setRescheduleModal({
                                appointment: appt,
                                newDate: appt.scheduled_date,
                                newTime: appt.scheduled_time,
                              })
                            }
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#b91c1c' }}
                            onClick={() =>
                              setCancelModal({
                                appointment: appt,
                                reason: '',
                              })
                            }
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {appt.status === 'confirmed' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCompleteAppointment(appt)}
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenSmsLogs(appt.id)}
                      >
                        Audit Zero-PHI SMS Logs
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: ASSIGNED PATIENTS ==================== */}
      {activeTab === 'patients' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Assigned Patients Clinical Directory</h3>
              <p className="card-subtitle">
                Access clinical background, chronic history, emergency contacts, and active consultation threads.
              </p>
            </div>
          </div>

          {consultations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              No patients currently assigned.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              {consultations.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 16,
                    backgroundColor: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#0b1f3a', fontSize: '1.05rem' }}>
                        {c.patient_name || `Patient #${c.patient_id}`}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Consultation ID: CONS-{c.id} • Status: {c.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedConsultationId(c.id);
                          setActiveTab('chat');
                        }}
                      >
                        Open Chat →
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedConsultationId(c.id);
                          setActiveTab('clinical_notes');
                        }}
                      >
                        Clinical Notes →
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedConsultationId(c.id);
                          setActiveTab('medicine_schedules');
                        }}
                      >
                        Medicine Schedules →
                      </button>
                    </div>
                  </div>

                  <div className="info-kv-grid">
                    <div className="info-kv-item">
                      <span className="info-kv-label">Village / Location</span>
                      <span className="info-kv-value">{c.patient_village || 'Rural Karnataka'}</span>
                    </div>
                    <div className="info-kv-item">
                      <span className="info-kv-label">Blood Group</span>
                      <span className="info-kv-value" style={{ color: '#b91c1c' }}>
                        {c.patient_blood_group || 'O+'}
                      </span>
                    </div>
                    <div className="info-kv-item">
                      <span className="info-kv-label">Allergies</span>
                      <span className="info-kv-value" style={{ color: '#b45309' }}>
                        {c.patient_allergies || 'None reported'}
                      </span>
                    </div>
                    <div className="info-kv-item">
                      <span className="info-kv-label">Chronic Conditions</span>
                      <span className="info-kv-value">{c.patient_chronic_conditions || 'None reported'}</span>
                    </div>
                    <div className="info-kv-item">
                      <span className="info-kv-label">Emergency Contact</span>
                      <span className="info-kv-value">{c.patient_emergency_contact || 'Available on file'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: CONSULTATION CHAT ==================== */}
      {activeTab === 'chat' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Consultation Messaging Workspace</h3>
              <p className="card-subtitle">
                Two-way secure communication with the patient. Tap clinical quick-replies to save typing over low bandwidth.
              </p>
            </div>
            {/* Consultation Selector */}
            {consultations.length > 1 && (
              <select
                className="form-control"
                style={{ maxWidth: 260 }}
                value={selectedConsultationId || ''}
                onChange={(e) => setSelectedConsultationId(Number(e.target.value))}
              >
                {consultations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.patient_name || `Patient #${c.patient_id}`} (CONS-{c.id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick-Reply Clinical Phrase Chips */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              CLINICAL QUICK-REPLY CHIPS:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {clinicalQuickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                  onClick={() => handleSendMessage(chip)}
                  disabled={sendingChat || !selectedConsultationId}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="message-thread" style={{ minHeight: 280, maxHeight: 420 }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', margin: 'auto' }}>
                No messages yet. Send an instruction or answer the patient's questions.
              </div>
            ) : (
              chatMessages.map((m) => {
                const isDoctor = m.sender_role === 'doctor';
                return (
                  <div
                    key={m.id}
                    className={`message-bubble ${isDoctor ? 'message-own' : 'message-other'}`}
                  >
                    <div className="message-meta">
                      <strong>{isDoctor ? 'Dr. Priya Sharma (You)' : m.sender_name || 'Patient'}</strong>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div>{m.content}</div>
                    <div className="message-footer">
                      <span>✓ Delivered</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: 10 }}
          >
            <input
              type="text"
              className="form-control"
              placeholder="Type clinical advice or guidance..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={sendingChat || !selectedConsultationId}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sendingChat || !chatInput.trim() || !selectedConsultationId}
            >
              {sendingChat ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      )}

      {/* ==================== TAB 5: SMART OCR REPORT REVIEW ==================== */}
      {activeTab === 'ocr_review' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Smart OCR Laboratory Report Review</h3>
              <p className="card-subtitle">
                Side-by-side verification of scanned lab reports. Doctor must verify and approve extracted values.
              </p>
            </div>
            {/* Report Selector */}
            {reports.length > 1 && (
              <select
                className="form-control"
                style={{ maxWidth: 280 }}
                value={selectedReportId || ''}
                onChange={(e) => setSelectedReportId(Number(e.target.value))}
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.doctor_review_status.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Required Machine-Read Warning Banner */}
          <div
            className="alert alert-warning"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            <span>⚠️</span>
            <span>Machine-Read — May Be Incomplete — Requires Doctor Review</span>
          </div>

          {reports.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              No laboratory reports uploaded for this consultation.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
              {/* Left Column: Scanned Document Preview */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0b1f3a' }}>
                  Uploaded Document / Image
                </h4>
                <div
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#0f172a',
                    minHeight: 260,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {reportBlobUrl ? (
                    <img
                      src={reportBlobUrl}
                      alt="Scanned Report"
                      style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading report image...</div>
                  )}
                </div>
                {selectedReport && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                    Title: <strong>{selectedReport.title}</strong> • File: {selectedReport.file_name} •{' '}
                    Status: <span className="badge badge-warning">{selectedReport.doctor_review_status.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Extracted OCR Parameters & Doctor Correction */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0b1f3a' }}>
                    Extracted Parameters (Editable)
                  </h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddOcrField}>
                    + Add Row
                  </button>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Parameter</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: 90 }}>Value</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: 70 }}>Unit</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: 100 }}>Ref Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableOcrFields.map((field, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: 4 }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '4px 6px', fontSize: '0.82rem' }}
                              value={field.parameter}
                              onChange={(e) => handleOcrFieldChange(idx, 'parameter', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '4px 6px', fontSize: '0.82rem' }}
                              value={field.value}
                              onChange={(e) => handleOcrFieldChange(idx, 'value', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '4px 6px', fontSize: '0.82rem' }}
                              value={field.unit}
                              onChange={(e) => handleOcrFieldChange(idx, 'unit', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '4px 6px', fontSize: '0.82rem' }}
                              value={field.reference_range}
                              onChange={(e) => handleOcrFieldChange(idx, 'reference_range', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Doctor Clinical Review Note */}
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Doctor Review Clinical Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="e.g. Verified CBC values. Hemoglobin normal. Platelets within acceptable range."
                    value={doctorReviewNote}
                    onChange={(e) => setDoctorReviewNote(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleApproveReportReview}
                  disabled={reviewingReport || !selectedReportId}
                >
                  {reviewingReport ? 'Saving Review...' : '✓ Approve & Mark Doctor Reviewed'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 6: CLINICAL NOTES ==================== */}
      {activeTab === 'clinical_notes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Clinical Note Authoring Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Author & Sign Clinical Consultation Note</h3>
                <p className="card-subtitle">
                  Document clinical diagnosis, advice, emergency red flags, and follow-up date. Digitally signed under your doctor credentials.
                </p>
              </div>
            </div>

            <form onSubmit={handlePublishClinicalNote}>
              <div className="form-group">
                <label className="form-label">Assessment / Clinical Diagnosis *</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="e.g. Acute upper respiratory infection; mild dehydration; stable vitals."
                  value={noteAssessment}
                  onChange={(e) => setNoteAssessment(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Care & Dietary Advice *</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="e.g. Rest, oral rehydration salts (ORS), light warm khichdi, avoid cold beverages."
                  value={noteCareAdvice}
                  onChange={(e) => setNoteCareAdvice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Red-Flag Warnings (Emergency Triggers)</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="e.g. If high fever persists > 48h, severe breathing difficulty, or chest pain occurs, proceed to emergency PHC immediately."
                  value={noteRedFlags}
                  onChange={(e) => setNoteRedFlags(e.target.value)}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Recommended Follow-Up Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={noteFollowUpDate}
                    onChange={(e) => setNoteFollowUpDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={publishingNote || !selectedConsultationId}
              >
                {publishingNote ? 'Signing & Publishing...' : 'Sign & Publish Clinical Note'}
              </button>
            </form>
          </div>

          {/* Past Clinical Notes History */}
          <div className="card">
            <h4 style={{ margin: '0 0 12px 0', color: '#0b1f3a' }}>Published Clinical Notes History</h4>
            {notesHistory.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                No published consultation notes for this consultation yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {notesHistory.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: 14,
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#1e3a8a' }}>
                        Note Signed by {note.doctor_name || 'Dr. Priya Sharma'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                      <strong>Assessment:</strong> {note.assessment}
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                      <strong>Care Advice:</strong> {note.care_advice}
                    </div>
                    {note.red_flag_warnings && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          backgroundColor: '#fef2f2',
                          color: '#991b1b',
                          padding: 6,
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      >
                        <strong>Red Flags:</strong> {note.red_flag_warnings}
                      </div>
                    )}
                    {note.follow_up_date && (
                      <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                        <strong>Follow-up Date:</strong> {note.follow_up_date}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 7: MEDICINE SCHEDULES ==================== */}
      {activeTab === 'medicine_schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Medicine Prescribing Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Prescribe Doctor-Approved Medicine Schedule</h3>
                <p className="card-subtitle">
                  Configure daily doses and meal instructions. The patient can check off doses in their Medicine Reminders tab.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateMedicineSchedule}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Medicine Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Paracetamol, Metformin 500mg, Amoxicillin"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dosage & Strength *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 500mg (1 Tablet), 5ml Syrup"
                    value={medDose}
                    onChange={(e) => setMedDose(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Timing Slots Checkboxes */}
              <div className="form-group">
                <label className="form-label">Daily Timing Slots *</label>
                <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={medMorning}
                      onChange={(e) => setMedMorning(e.target.checked)}
                    />
                    Morning (सुबह)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={medAfternoon}
                      onChange={(e) => setMedAfternoon(e.target.checked)}
                    />
                    Afternoon (दोपहर)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={medNight}
                      onChange={(e) => setMedNight(e.target.checked)}
                    />
                    Night (रात)
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Meal Instruction</label>
                  <select
                    className="form-control"
                    value={medMeal}
                    onChange={(e) => setMedMeal(e.target.value)}
                  >
                    <option value="After food">After food (भोजन के बाद)</option>
                    <option value="Before food">Before food (भोजन से पहले)</option>
                    <option value="With food">With food (भोजन के साथ)</option>
                    <option value="Empty stomach">Empty stomach (खाली पेट)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    className="form-control"
                    value={medDuration}
                    onChange={(e) => setMedDuration(Number(e.target.value))}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingMed || !selectedConsultationId}
              >
                {creatingMed ? 'Saving Prescription...' : '✓ Add Approved Medicine Schedule'}
              </button>
            </form>
          </div>

          {/* Active Prescribed Schedules */}
          <div className="card">
            <h4 style={{ margin: '0 0 12px 0', color: '#0b1f3a' }}>Active Prescriptions & Patient Adherence</h4>

            {medicineSchedules.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                No medicine schedules active for this patient yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {medicineSchedules.map((med) => (
                  <div
                    key={med.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: 14,
                      backgroundColor: '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0b1f3a' }}>
                        {med.medicine_name} — {med.dosage_strength}
                      </span>
                      <span className="badge badge-success">ACTIVE ({med.duration_days} DAYS)</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: 4 }}>
                      Timing Slots: <strong>{med.schedule_times.join(', ')}</strong> • Instruction: <strong>{med.meal_instruction}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Adherence Summary Metric */}
            {adherenceSummary && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  backgroundColor: '#f1f5f9',
                  borderRadius: 6,
                  fontSize: '0.82rem',
                }}
              >
                <strong>Patient Adherence Score:</strong> {adherenceSummary.percentage}% ({adherenceSummary.total_taken} of {adherenceSummary.total_scheduled} doses logged taken)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 8: DOCTOR PROFILE & HOURS ==================== */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Doctor Credentials & Availability Configuration</h3>
              <p className="card-subtitle">
                Update your public profile, qualifications, clinic location, and weekly tele-consultation slots.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Specialty</label>
                <input
                  type="text"
                  className="form-control"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Medical Registration Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualifications</label>
                <input
                  type="text"
                  className="form-control"
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={clinicLocation}
                  onChange={(e) => setClinicLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Languages Spoken</label>
                <input
                  type="text"
                  className="form-control"
                  value={languagesSpoken}
                  onChange={(e) => setLanguagesSpoken(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <input
                  type="checkbox"
                  id="acceptingToggle"
                  checked={isAccepting}
                  onChange={(e) => setIsAccepting(e.target.checked)}
                />
                <label htmlFor="acceptingToggle" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Currently Accepting New Appointments
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Weekly Availability Slots (Comma-separated)</label>
              <input
                type="text"
                className="form-control"
                value={slotsString}
                onChange={(e) => setSlotsString(e.target.value)}
                placeholder="Mon-Fri 09:00-13:00, Mon-Fri 16:00-19:00, Sat 10:00-14:00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Professional Bio</label>
              <textarea
                rows={3}
                className="form-control"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief summary of clinical background, areas of interest..."
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Doctor Profile & Availability'}
            </button>
          </form>
        </div>
      )}

      {/* ==================== RESCHEDULE MODAL ==================== */}
      {rescheduleModal && (
        <div className="modal-backdrop" onClick={() => setRescheduleModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-header">
              <h3 className="card-title">Reschedule Appointment #{rescheduleModal.appointment.id}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRescheduleModal(null)}>
                ✕
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">New Scheduled Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={rescheduleModal.newDate}
                  onChange={(e) =>
                    setRescheduleModal({ ...rescheduleModal, newDate: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Time Slot</label>
                <input
                  type="text"
                  className="form-control"
                  value={rescheduleModal.newTime}
                  onChange={(e) =>
                    setRescheduleModal({ ...rescheduleModal, newTime: e.target.value })
                  }
                  placeholder="e.g. 11:30 AM"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRescheduleModal(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleRescheduleSubmit}>
                  Confirm Reschedule & Send SMS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CANCEL MODAL ==================== */}
      {cancelModal && (
        <div className="modal-backdrop" onClick={() => setCancelModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-header">
              <h3 className="card-title">Cancel Appointment #{cancelModal.appointment.id}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCancelModal(null)}>
                ✕
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Reason for Cancellation</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Doctor emergency leave, clinic power outage"
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCancelModal(null)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" style={{ backgroundColor: '#dc2626' }} onClick={handleCancelSubmit}>
                  Confirm Cancellation & Send SMS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SMS AUDIT LOGS MODAL ==================== */}
      {smsLogsModal && (
        <div className="modal-backdrop" onClick={() => setSmsLogsModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Zero-PHI SMS Audit Log (Appointment #{smsLogsModal.appointmentId})</h3>
                <p className="card-subtitle">
                  Inspect outbound messages to ensure no PHI, medicine names, or diagnostic terms were transmitted.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSmsLogsModal(null)}>
                ✕
              </button>
            </div>

            {smsLogsModal.loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>Loading SMS audit records...</div>
            ) : smsLogsModal.logs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                No SMS logs recorded for this appointment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {smsLogsModal.logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 10,
                      backgroundColor: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge badge-success">PROVIDER: {log.provider.toUpperCase()}</span>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ margin: '4px 0' }}>
                      <strong>Recipient:</strong> {log.recipient_phone}
                    </div>
                    <div style={{ backgroundColor: '#fff', padding: 8, borderRadius: 4, border: '1px solid #cbd5e1' }}>
                      {log.message_body}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                      Deduplication Key: <code>{log.deduplication_key}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
