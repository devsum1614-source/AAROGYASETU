import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAuthorizedReportBlobUrl,
  fetchConsultationMessagesApi,
  fetchConsultationReportsApi,
  fetchExaminerConsultationsApi,
} from '../api';
import { Consultation, MessageItem, ReportItem, UserAccount } from '../types';
import { formatFileSize } from '../utils/compressImage';

interface ExaminerPortalProps {
  token: string;
  user: UserAccount;
  isEffectiveOnline: boolean;
}

export const ExaminerPortal: React.FC<ExaminerPortalProps> = ({
  token,
  user,
  isEffectiveOnline,
}) => {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected consultation messages & reports
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Report viewing modal
  const [viewingReportModal, setViewingReportModal] = useState<{
    report: ReportItem;
    blobUrl: string;
    mimeType: string;
  } | null>(null);

  const loadAllConsultations = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchExaminerConsultationsApi(token);
      setConsultations(list);
      if (list.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(list[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load consultations for evaluation.');
    } finally {
      setLoading(false);
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  useEffect(() => {
    loadAllConsultations();
  }, [loadAllConsultations]);

  useEffect(() => {
    if (!selectedConsultationId || !isEffectiveOnline) return;
    setLoadingDetails(true);
    Promise.all([
      fetchConsultationMessagesApi(token, selectedConsultationId, 0),
      fetchConsultationReportsApi(token, selectedConsultationId),
    ])
      .then(([msgs, reps]) => {
        setMessages(msgs);
        setReports(reps);
      })
      .catch((err) => {
        setErrorMsg(err?.message || 'Could not load consultation thread.');
      })
      .finally(() => {
        setLoadingDetails(false);
      });
  }, [token, selectedConsultationId, isEffectiveOnline]);

  const activeConsultation = consultations.find(
    (c) => c.id === selectedConsultationId
  );

  const handleOpenReportModal = async (report: ReportItem) => {
    try {
      const { url, mimeType } = await fetchAuthorizedReportBlobUrl(token, report.id);
      setViewingReportModal({ report, blobUrl: url, mimeType });
    } catch (err: any) {
      alert(`Could not open report: ${err?.message || 'Access error'}`);
    }
  };

  return (
    <div className="portal-container">
      {/* Examiner Top Badge */}
      <div
        className="card"
        style={{
          background: '#f8fafc',
          borderLeft: '4px solid #1e3a8a',
          marginBottom: 16,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#0b1f3a', margin: 0 }}>
              AIORA Hackathon Examiner Portal (Read-Only Review)
            </h2>
            <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: 4 }}>
              Logged in as: <strong>{user.full_name}</strong> ({user.email}) • Mode: <strong>Read-Only Inspection</strong>
            </div>
          </div>
          <span
            style={{
              background: '#e0e7ff',
              color: '#3730a3',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            Read-Only Audit Mode
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>
          All data displayed is strictly fictional demo data. As an Examiner, you can audit consultations, messages, and compressed report uploads across all demo participants without modification permissions.
        </div>
      </div>

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

      <div className="portal-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Left: Consultation List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Consultations ({consultations.length})</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadAllConsultations}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
              Loading platform consultations...
            </div>
          ) : consultations.length === 0 ? (
            <div style={{ padding: 16, color: '#64748b' }}>No consultations found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {consultations.map((c) => {
                const isSelected = c.id === selectedConsultationId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConsultationId(c.id)}
                    style={{
                      border: isSelected ? '2px solid #1e3a8a' : '1px solid #cbd5e1',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      borderRadius: 6,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0b1f3a' }}>
                        {c.reference_code}: {c.subject}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: c.status === 'active' ? '#dcfce7' : '#f1f5f9',
                          color: c.status === 'active' ? '#15803d' : '#475569',
                          fontWeight: 600,
                        }}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: 4 }}>
                      Patient: <strong>{c.patient_name}</strong> ({c.patient_village || 'Village'})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                      Doctor: <strong>{c.doctor_name}</strong> ({c.doctor_specialty || 'General Medicine'})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6 }}>
                      Messages: {c.message_count || 0} • Reports: {c.report_count || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Consultation Detail */}
        <div className="card">
          {activeConsultation ? (
            <div>
              <div className="card-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <div>
                  <h3 className="card-title">
                    {activeConsultation.reference_code} — {activeConsultation.subject}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Patient: {activeConsultation.patient_name} ({activeConsultation.patient_phone}) • Assigned Doctor: {activeConsultation.doctor_name} ({activeConsultation.doctor_phone})
                  </div>
                </div>
              </div>

              {loadingDetails ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                  Loading thread details...
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  {/* Summary Box */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 14 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0b1f3a' }}>
                      Clinical Intake Summary:
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 2 }}>
                      {activeConsultation.clinical_summary || 'No summary recorded.'}
                    </div>
                  </div>

                  {/* Messages Section */}
                  <h4 style={{ fontSize: '0.95rem', color: '#0b1f3a', marginBottom: 8 }}>
                    Consultation Messages ({messages.length})
                  </h4>
                  <div
                    style={{
                      maxHeight: 240,
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 10,
                      background: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginBottom: 16,
                    }}
                  >
                    {messages.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                        No messages in this consultation yet.
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: m.sender_role === 'doctor' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: m.sender_role === 'doctor' ? '#e0e7ff' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '6px 10px',
                          }}
                        >
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e3a8a' }}>
                            {m.sender_name} ({m.sender_role.toUpperCase()})
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#0f172a', marginTop: 2 }}>
                            {m.content}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'right', marginTop: 2 }}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.delivery_state}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reports Section */}
                  <h4 style={{ fontSize: '0.95rem', color: '#0b1f3a', marginBottom: 8 }}>
                    Uploaded Reports ({reports.length})
                  </h4>
                  {reports.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      No reports uploaded in this consultation.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {reports.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '8px 12px',
                            background: '#ffffff',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '0.85rem', color: '#0b1f3a' }}>{r.title}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                              Original: {formatFileSize(r.original_size_bytes)} • Stored: {formatFileSize(r.uploaded_size_bytes)} {r.was_compressed ? '• (Compressed)' : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenReportModal(r)}
                          >
                            View Report
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
              Select a consultation from the left to inspect its messages and reports.
            </div>
          )}
        </div>
      </div>

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
