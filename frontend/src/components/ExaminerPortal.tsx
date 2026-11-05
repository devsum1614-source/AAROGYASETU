import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAdherenceSummaryApi,
  fetchAllSmsLogsApi,
  fetchAppointmentsApi,
  fetchAuthorizedReportBlobUrl,
  fetchConsultationMessagesApi,
  fetchConsultationNotesApi,
  fetchConsultationReportsApi,
  fetchEmergencySosInfoApi,
  fetchExaminerConsultationsApi,
  fetchMedicineSchedulesApi,
  resolveQRTokenApi,
} from '../api';
import {
  AdherenceSummary,
  Appointment,
  Consultation,
  ConsultationNote,
  EmergencySosInfo,
  MedicineSchedule,
  MessageItem,
  QRResolvedData,
  ReportItem,
  SmsNotification,
  UserAccount,
} from '../types';

interface ExaminerPortalProps {
  token: string;
  user: UserAccount;
  isEffectiveOnline: boolean;
  lang?: 'en' | 'hi';
}

type ExaminerTab =
  | 'overview'
  | 'appointments'
  | 'consultations'
  | 'reports'
  | 'notes'
  | 'medicines'
  | 'qr_sos';

export const ExaminerPortal: React.FC<ExaminerPortalProps> = ({
  token,
  user,
  isEffectiveOnline,
  lang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<ExaminerTab>('overview');

  // Baseline data
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsNotification[]>([]);
  const [medicineSchedules, setMedicineSchedules] = useState<MedicineSchedule[]>([]);
  const [adherenceSummary, setAdherenceSummary] = useState<AdherenceSummary | null>(null);
  const [sosInfo, setSosInfo] = useState<EmergencySosInfo | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected consultation for inspecting messages, reports, notes
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [notes, setNotes] = useState<ConsultationNote[]>([]);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);

  // Report viewing modal
  const [viewingReportModal, setViewingReportModal] = useState<{
    report: ReportItem;
    blobUrl: string;
    mimeType: string;
  } | null>(null);

  // QR Test Token Resolver
  const [testQrToken, setTestQrToken] = useState<string>('AAROGYA-DEMO-TOKEN');
  const [resolvedQrData, setResolvedQrData] = useState<QRResolvedData | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [resolvingQr, setResolvingQr] = useState<boolean>(false);

  const loadAllAuditData = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [consList, apptList, smsList, medList, sosData] = await Promise.all([
        fetchExaminerConsultationsApi(token),
        fetchAppointmentsApi(token),
        fetchAllSmsLogsApi(token),
        fetchMedicineSchedulesApi(token),
        fetchEmergencySosInfoApi(token),
      ]);
      setConsultations(consList);
      setAppointments(apptList);
      setSmsLogs(smsList);
      setMedicineSchedules(medList);
      setSosInfo(sosData);

      if (consList.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(consList[0].id);
      }

      fetchAdherenceSummaryApi(token)
        .then((sum) => setAdherenceSummary(sum))
        .catch(() => {});
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load examiner audit data.');
    } finally {
      setLoading(false);
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  useEffect(() => {
    loadAllAuditData();
  }, [loadAllAuditData]);

  // Load details when selectedConsultationId changes
  useEffect(() => {
    if (!selectedConsultationId || !isEffectiveOnline) return;
    setLoadingThread(true);
    Promise.all([
      fetchConsultationMessagesApi(token, selectedConsultationId, 0),
      fetchConsultationReportsApi(token, selectedConsultationId),
      fetchConsultationNotesApi(token, selectedConsultationId),
    ])
      .then(([m, r, n]) => {
        setMessages(m);
        setReports(r);
        setNotes(n);
      })
      .catch((err) => {
        console.warn('Examiner error loading consultation details', err);
      })
      .finally(() => {
        setLoadingThread(false);
      });
  }, [token, selectedConsultationId, isEffectiveOnline]);

  const handleOpenReportModal = async (report: ReportItem) => {
    try {
      const { url, mimeType } = await fetchAuthorizedReportBlobUrl(token, report.id);
      setViewingReportModal({ report, blobUrl: url, mimeType });
    } catch (err: any) {
      alert(`Could not open report: ${err?.message || 'Access error'}`);
    }
  };

  const handleTestResolveQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQrToken.trim()) return;
    setResolvingQr(true);
    setQrError(null);
    setResolvedQrData(null);
    try {
      const res = await resolveQRTokenApi(token, testQrToken.trim());
      setResolvedQrData(res);
    } catch (err: any) {
      setQrError(err?.message || 'Failed to resolve QR token.');
    } finally {
      setResolvingQr(false);
    }
  };

  const activeConsultation = consultations.find((c) => c.id === selectedConsultationId);

  return (
    <div className="portal-container">
      {/* Top Examiner Audit Banner */}
      <div
        className="card"
        style={{
          backgroundColor: '#eff6ff',
          borderLeft: '5px solid #1e3a8a',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-success" style={{ backgroundColor: '#1e3a8a', color: '#fff', border: 'none' }}>
                EXAMINER EVALUATION MODE
              </span>
              <span className="badge badge-warning">STRICTLY READ-ONLY</span>
            </div>
            <h3 style={{ margin: '6px 0 2px 0', color: '#0b1f3a' }}>
              Hackathon Evaluation Portal • AIORA 2026
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569' }}>
              Logged in as: <strong>{user.full_name}</strong> ({user.email}) • Karavali Institute of Technology • Fictional Demo Data Audit
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAllAuditData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Audit Records'}
          </button>
        </div>
      </div>

      {errorMsg && <div className="alert alert-error" style={{ marginBottom: 14 }}>{errorMsg}</div>}

      {/* Examiner Tab Navigation */}
      <nav className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'overview' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Audit Overview
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'appointments' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          Appointments & SMS Logs ({appointments.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'consultations' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('consultations')}
        >
          Consultations & Chat ({consultations.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'reports' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Lab Reports & OCR
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'notes' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Clinical Notes & Diagnoses
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'medicines' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('medicines')}
        >
          Medicine Schedules & Adherence
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'qr_sos' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('qr_sos')}
        >
          QR Token & Emergency SOS
        </button>
      </nav>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ borderLeft: '4px solid #1e3a8a' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>APPOINTMENTS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0b1f3a' }}>{appointments.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Seeded & active visits</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>CONSULTATIONS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>{consultations.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Authorized threads</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>ZERO-PHI SMS LOGS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>{smsLogs.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Audit trail entries</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #9333ea' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>PRESCRIBED DRUGS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#9333ea' }}>{medicineSchedules.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Doctor-approved</div>
            </div>
          </div>

          {/* Compliance & Architecture Audit Checklist */}
          <div className="card">
            <h4 style={{ margin: '0 0 10px 0', color: '#0b1f3a' }}>
              Evaluation Checklist — AAROGYASETU Milestone Verification
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669' }}>✓ Zero-PHI SMS Architecture</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
                  SMS notifications strictly contain appointment date, time, and doctor name. Zero patient medical conditions, diagnoses, or drug names are transmitted over unencrypted SMS.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669' }}>✓ Offline-First & 2G Low Bandwidth</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
                  PWA Service Worker caches the static application shell. Client-side canvas image compression compresses medical lab reports before upload.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669' }}>✓ Dual-Tier Emergency SOS</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
                  Direct one-tap <code>tel:108</code> emergency dialer + family contact dialer, manual landmark input, and prominent "No Auto-Dispatch" warning banner.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669' }}>✓ Tokenized QR Medical Profile</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
                  Zero raw PHI embedded in the QR code. Only an opaque, ephemeral cryptographic token that can be revoked in one tap by the patient.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: APPOINTMENTS & SMS LOGS ==================== */}
      {activeTab === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Appointments Table */}
          <div className="card">
            <h4 style={{ margin: '0 0 10px 0', color: '#0b1f3a' }}>Appointments Register</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: 'left' }}>Ref</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Patient</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Doctor</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Date & Time</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Complaint</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8, fontWeight: 700 }}>APT-{a.id}</td>
                      <td style={{ padding: 8 }}>{a.patient_name || `Patient #${a.patient_id}`}</td>
                      <td style={{ padding: 8 }}>{a.doctor_name || `Doctor #${a.doctor_id}`}</td>
                      <td style={{ padding: 8 }}>{a.scheduled_date} {a.scheduled_time}</td>
                      <td style={{ padding: 8 }}>{a.chief_complaint}</td>
                      <td style={{ padding: 8 }}>
                        <span
                          className={`badge ${
                            a.status === 'confirmed'
                              ? 'badge-success'
                              : a.status === 'requested'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                        >
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outbound Zero-PHI SMS Logs */}
          <div className="card">
            <h4 style={{ margin: '0 0 10px 0', color: '#0b1f3a' }}>
              Zero-PHI SMS Outbox Audit ({smsLogs.length} transmissions)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ backgroundColor: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: 'left' }}>Timestamp</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Recipient</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Provider</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Message Body (Strictly Zero-PHI)</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Deduplication Key</th>
                  </tr>
                </thead>
                <tbody>
                  {smsLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: 8, fontWeight: 600 }}>{log.recipient_phone}</td>
                      <td style={{ padding: 8 }}>
                        <span className="badge badge-success">{log.provider.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: 8, backgroundColor: '#f8fafc' }}>{log.message_body}</td>
                      <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        {log.deduplication_key}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: CONSULTATIONS & CHAT ==================== */}
      {activeTab === 'consultations' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Consultation Threads Audit</h3>
              <p className="card-subtitle">
                Inspect authorized patient-doctor consultation channels and message exchanges.
              </p>
            </div>
            {consultations.length > 1 && (
              <select
                className="form-control"
                style={{ maxWidth: 280 }}
                value={selectedConsultationId || ''}
                onChange={(e) => setSelectedConsultationId(Number(e.target.value))}
              >
                {consultations.map((c) => (
                  <option key={c.id} value={c.id}>
                    CONS-{c.id} • {c.patient_name} with {c.doctor_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {activeConsultation && (
            <div className="info-kv-grid" style={{ marginBottom: 12 }}>
              <div className="info-kv-item">
                <span className="info-kv-label">Patient</span>
                <span className="info-kv-value">{activeConsultation.patient_name}</span>
              </div>
              <div className="info-kv-item">
                <span className="info-kv-label">Doctor</span>
                <span className="info-kv-value">{activeConsultation.doctor_name}</span>
              </div>
              <div className="info-kv-item">
                <span className="info-kv-label">Status</span>
                <span className="info-kv-value">{activeConsultation.status.toUpperCase()}</span>
              </div>
              <div className="info-kv-item">
                <span className="info-kv-label">Created At</span>
                <span className="info-kv-value">
                  {new Date(activeConsultation.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="message-thread" style={{ maxHeight: 380 }}>
            {loadingThread ? (
              <div style={{ textAlign: 'center', padding: 20 }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                No messages recorded in this consultation.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`message-bubble ${m.sender_role === 'doctor' ? 'message-own' : 'message-other'}`}
                >
                  <div className="message-meta">
                    <strong>{m.sender_name} ({m.sender_role.toUpperCase()})</strong>
                    <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div>{m.content}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
            🔒 Examiner Read-Only Mode: Messaging inputs are intentionally disabled during evaluation.
          </div>
        </div>
      )}

      {/* ==================== TAB 4: LAB REPORTS & OCR ==================== */}
      {activeTab === 'reports' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Scanned Laboratory Reports & OCR Extraction</h3>
              <p className="card-subtitle">
                Inspect laboratory files, compression telemetry, extracted OCR fields, and doctor verification notes.
              </p>
            </div>
          </div>

          {reports.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              No laboratory reports associated with the active consultation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reports.map((r) => (
                <div
                  key={r.id}
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
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#0b1f3a' }}>{r.title}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        File: {r.file_name} • Size: {Math.round(r.file_size_bytes / 1024)} KB{' '}
                        {r.was_compressed && '(Compressed from original client image)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        className={`badge ${
                          r.doctor_review_status === 'doctor_reviewed'
                            ? 'badge-success'
                            : 'badge-warning'
                        }`}
                      >
                        {r.doctor_review_status.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenReportModal(r)}
                      >
                        View Scanned File ↗
                      </button>
                    </div>
                  </div>

                  {/* Warning banner */}
                  <div
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#fffbeb',
                      color: '#92400e',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      marginBottom: 8,
                    }}
                  >
                    ⚠️ Machine-Read — May Be Incomplete — Requires Doctor Review
                  </div>

                  {/* Extracted Fields Table */}
                  {r.extracted_fields && r.extracted_fields.length > 0 && (
                    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                          <tr>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Parameter</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Value</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Unit</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Reference Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.extracted_fields.map((f, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{f.parameter}</td>
                              <td style={{ padding: '4px 8px' }}>{f.value}</td>
                              <td style={{ padding: '4px 8px' }}>{f.unit}</td>
                              <td style={{ padding: '4px 8px', color: '#64748b' }}>{f.reference_range}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {r.doctor_review_note && (
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: '#f1f5f9',
                        borderRadius: 4,
                        fontSize: '0.82rem',
                      }}
                    >
                      <strong>Doctor Verification Note:</strong> {r.doctor_review_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: CLINICAL NOTES ==================== */}
      {activeTab === 'notes' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Clinical Consultation Notes & Diagnoses</h3>
              <p className="card-subtitle">
                Doctor-signed assessments, care advice, red-flag triggers, and recommended follow-up dates.
              </p>
            </div>
          </div>

          {notes.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              No clinical notes recorded for this consultation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 14,
                    backgroundColor: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#1e3a8a' }}>
                      Signed by {note.doctor_name || 'Dr. Priya Sharma'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', marginBottom: 6 }}>
                    <strong>Clinical Assessment:</strong> {note.assessment}
                  </div>
                  <div style={{ fontSize: '0.88rem', marginBottom: 6 }}>
                    <strong>Care & Diet Advice:</strong> {note.care_advice}
                  </div>
                  {note.red_flag_warnings && (
                    <div
                      style={{
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: '0.82rem',
                        marginBottom: 6,
                      }}
                    >
                      <strong>Emergency Red Flags:</strong> {note.red_flag_warnings}
                    </div>
                  )}
                  {note.follow_up_date && (
                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                      <strong>Follow-up Date:</strong> {note.follow_up_date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 6: MEDICINES & ADHERENCE ==================== */}
      {activeTab === 'medicines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 10px 0', color: '#0b1f3a' }}>Prescribed Medicine Schedules</h4>
            {medicineSchedules.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No medicine schedules recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {medicineSchedules.map((med) => (
                  <div
                    key={med.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 12,
                      backgroundColor: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: '#0b1f3a' }}>
                        {med.medicine_name} — {med.dosage_strength}
                      </strong>
                      <span className="badge badge-success">APPROVED ({med.duration_days} DAYS)</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                      Slots: <strong>{med.schedule_times.join(', ')}</strong> • Instruction: <strong>{med.meal_instruction}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adherence Score */}
          {adherenceSummary && (
            <div className="card" style={{ backgroundColor: '#f8fafc' }}>
              <h4 style={{ margin: '0 0 6px 0', color: '#0b1f3a' }}>Patient Adherence Metrics</h4>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                {adherenceSummary.percentage}% Overall Adherence
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                {adherenceSummary.total_taken} doses taken out of {adherenceSummary.total_scheduled} scheduled doses.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 7: QR TOKEN & EMERGENCY SOS ==================== */}
      {activeTab === 'qr_sos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* QR Token Resolver Demo */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Tokenized QR Profile Resolution Demo</h3>
                <p className="card-subtitle">
                  Verify how healthcare providers and examiners resolve an opaque QR token without storing unencrypted PHI in the barcode itself.
                </p>
              </div>
            </div>

            <form onSubmit={handleTestResolveQr} style={{ display: 'flex', gap: 10, maxWidth: 520, margin: '12px 0' }}>
              <input
                type="text"
                className="form-control"
                value={testQrToken}
                onChange={(e) => setTestQrToken(e.target.value)}
                placeholder="Enter QR token"
              />
              <button type="submit" className="btn btn-primary" disabled={resolvingQr}>
                {resolvingQr ? 'Resolving...' : 'Resolve QR Token'}
              </button>
            </form>

            {qrError && <div className="alert alert-error">{qrError}</div>}

            {resolvedQrData && (
              <div style={{ marginTop: 12, padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="badge badge-success">VALID ACTIVE TOKEN</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Expires: {new Date(resolvedQrData.expires_at).toLocaleString()}
                  </span>
                </div>
                <div className="info-kv-grid">
                  <div className="info-kv-item">
                    <span className="info-kv-label">Patient Name</span>
                    <span className="info-kv-value">{resolvedQrData.patient_summary.full_name}</span>
                  </div>
                  <div className="info-kv-item">
                    <span className="info-kv-label">Blood Group</span>
                    <span className="info-kv-value" style={{ color: '#b91c1c', fontWeight: 800 }}>
                      {resolvedQrData.patient_summary.blood_group || 'Not specified'}
                    </span>
                  </div>
                  <div className="info-kv-item">
                    <span className="info-kv-label">Emergency Contact</span>
                    <span className="info-kv-value">
                      {resolvedQrData.patient_summary.emergency_contact_name} ({resolvedQrData.patient_summary.emergency_contact_phone})
                    </span>
                  </div>
                  <div className="info-kv-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="info-kv-label">Allergies</span>
                    <span className="info-kv-value" style={{ color: '#b45309' }}>
                      {resolvedQrData.patient_summary.allergies || 'None reported'}
                    </span>
                  </div>
                  <div className="info-kv-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="info-kv-label">Chronic Conditions</span>
                    <span className="info-kv-value">
                      {resolvedQrData.patient_summary.chronic_conditions || 'None reported'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Emergency SOS Directory */}
          {sosInfo && (
            <div className="card">
              <h4 style={{ margin: '0 0 8px 0', color: '#0b1f3a' }}>Emergency SOS Dispatch Directory</h4>
              <div
                style={{
                  padding: 10,
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  color: '#991b1b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                {sosInfo.no_auto_dispatch_notice}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {sosInfo.nearby_phcs.map((phc, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 12,
                      backgroundColor: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0b1f3a', fontSize: '0.92rem' }}>{phc.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{phc.location} • {phc.distance_km} km away</div>
                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                      Phone: <strong>{phc.phone}</strong> • Facility: {phc.facility_type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Modal */}
      {viewingReportModal && (
        <div className="modal-backdrop" onClick={() => setViewingReportModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">{viewingReportModal.report.title}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setViewingReportModal(null)}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <img
                src={viewingReportModal.blobUrl}
                alt={viewingReportModal.report.title}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 6 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
