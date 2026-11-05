import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthorizedReportBlobUrl,
  fetchConsultationMessagesApi,
  fetchConsultationReportsApi,
  sendConsultationMessageApi,
  uploadConsultationReportWithProgress,
} from '../api';
import {
  CompressionResult,
  Consultation,
  MessageItem,
  ReportItem,
  UserRole,
} from '../types';
import {
  compressReportImage,
  formatFileSize,
  validateReportFile,
} from '../utils/compressImage';

interface ConsultationWorkspaceProps {
  token: string;
  currentUserId: number;
  currentUserRole: UserRole;
  currentUserName: string;
  consultation: Consultation;
  isEffectiveOnline: boolean;
  onConsultationActivity?: () => void;
}

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  token,
  currentUserId,
  currentUserRole,
  currentUserName,
  consultation,
  isEffectiveOnline,
  onConsultationActivity,
}) => {
  // Messaging state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Report state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  // Report Upload & Compression state (for patient)
  const [reportTitle, setReportTitle] = useState<string>('');
  const [compressionInfo, setCompressionInfo] =
    useState<CompressionResult | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'failed'
  >('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal state for viewing private report securely
  const [viewingReport, setViewingReport] = useState<{
    report: ReportItem;
    blobUrl: string;
    mimeType: string;
  } | null>(null);
  const [loadingReportModalId, setLoadingReportModalId] = useState<
    number | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // Load initial messages & reports when consultation changes
  const loadWorkspaceData = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoadingMessages(false);
      setLoadingReports(false);
      return;
    }
    setLoadingMessages(true);
    setLoadingReports(true);
    setMessagesError(null);
    setReportsError(null);

    try {
      const [msgList, repList] = await Promise.all([
        fetchConsultationMessagesApi(token, consultation.id, 0),
        fetchConsultationReportsApi(token, consultation.id),
      ]);
      setMessages(msgList);
      setReports(repList);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      const msg = err?.message || 'Could not load consultation data.';
      setMessagesError(msg);
      setReportsError(msg);
    } finally {
      setLoadingMessages(false);
      setLoadingReports(false);
    }
  }, [token, consultation.id, isEffectiveOnline]);

  useEffect(() => {
    setMessages([]);
    setReports([]);
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Lightweight periodic polling for new messages every 4 seconds when online
  useEffect(() => {
    if (!isEffectiveOnline) return;

    const timer = window.setInterval(async () => {
      try {
        const highestServerId = messages.reduce((maxId, m) => {
          return typeof m.id === 'number' && m.id > maxId ? m.id : maxId;
        }, 0);

        const newerMessages = await fetchConsultationMessagesApi(
          token,
          consultation.id,
          highestServerId
        );
        if (newerMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const existingClientIds = new Set(
              prev.map((p) => p.client_message_id).filter(Boolean)
            );
            const filtered = newerMessages.filter(
              (nm) =>
                !existingIds.has(nm.id) &&
                (!nm.client_message_id ||
                  !existingClientIds.has(nm.client_message_id))
            );
            return filtered.length > 0 ? [...prev, ...filtered] : prev;
          });
          setLastRefreshedAt(new Date().toLocaleTimeString());
        }
      } catch {
        // Silent background refresh
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [token, consultation.id, isEffectiveOnline, messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const performSendMessage = async (
    textToSend: string,
    clientMsgId: string
  ) => {
    if (!isEffectiveOnline) {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_message_id === clientMsgId
            ? {
                ...m,
                delivery_state: 'failed',
                error_detail:
                  'Offline: Message was NOT saved to server. Tap Retry when online.',
              }
            : m
        )
      );
      return;
    }

    try {
      const saved = await sendConsultationMessageApi(
        token,
        consultation.id,
        textToSend,
        clientMsgId
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.client_message_id === clientMsgId
            ? { ...saved, delivery_state: 'sent', error_detail: undefined }
            : m
        )
      );
      setLastRefreshedAt(new Date().toLocaleTimeString());
      onConsultationActivity?.();
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_message_id === clientMsgId
            ? {
                ...m,
                delivery_state: 'failed',
                error_detail:
                  err?.message ||
                  'Failed to send. Server did not save this message.',
              }
            : m
        )
      );
    }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed) return;

    const clientMsgId = `cmsg-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const optimisticMsg: MessageItem = {
      id: clientMsgId,
      consultation_id: consultation.id,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      sender_name: currentUserName,
      content: trimmed,
      client_message_id: clientMsgId,
      delivery_state: 'sending',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setDraftText('');
    await performSendMessage(trimmed, clientMsgId);
  };

  const handleRetryMessage = async (msg: MessageItem) => {
    const cid = msg.client_message_id || String(msg.id);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id || m.client_message_id === cid
          ? { ...m, delivery_state: 'sending', error_detail: undefined }
          : m
      )
    );
    await performSendMessage(msg.content, cid);
  };

  // Report file selection & browser compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    setUploadStatus('idle');
    setUploadProgress(0);

    if (!file) {
      setCompressionInfo(null);
      return;
    }

    const validationErr = validateReportFile(file);
    if (validationErr) {
      setUploadError(validationErr);
      setCompressionInfo(null);
      return;
    }

    if (!reportTitle.trim()) {
      const cleanDefault = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setReportTitle(cleanDefault || 'Medical Lab Report');
    }

    setCompressing(true);
    try {
      const result = await compressReportImage(file, 1280, 0.72);
      setCompressionInfo(result);
    } catch (err: any) {
      setUploadError(err?.message || 'Error preparing file for upload.');
    } finally {
      setCompressing(false);
    }
  };

  const executeReportUpload = async () => {
    if (!compressionInfo) {
      setUploadError('Please select a report image or PDF first.');
      return;
    }
    if (!reportTitle.trim()) {
      setUploadError('Please enter a short title for this medical report.');
      return;
    }
    if (!isEffectiveOnline) {
      setUploadStatus('failed');
      setUploadError(
        'Cannot upload while offline. Your compressed file is ready—tap Retry Upload once connected.'
      );
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(5);
    setUploadError(null);

    try {
      const savedReport = await uploadConsultationReportWithProgress(
        token,
        consultation.id,
        {
          title: reportTitle.trim(),
          file: compressionInfo.file,
          originalSizeBytes: compressionInfo.originalSize,
          wasCompressed: compressionInfo.wasCompressed,
        },
        (pct) => setUploadProgress(pct)
      );
      setUploadProgress(100);
      setUploadStatus('success');
      setReports((prev) => [savedReport, ...prev]);
      onConsultationActivity?.();
    } catch (err: any) {
      setUploadStatus('failed');
      setUploadError(
        err?.message || 'Report upload failed. Tap Retry Upload to try again.'
      );
    }
  };

  const resetUploadForm = () => {
    setCompressionInfo(null);
    setReportTitle('');
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenPrivateReport = async (rep: ReportItem) => {
    if (!isEffectiveOnline) {
      alert(
        'Viewing private medical reports requires an active connection (reports are never stored in browser public cache for privacy).'
      );
      return;
    }
    setLoadingReportModalId(rep.id);
    try {
      const { url, mimeType } = await fetchAuthorizedReportBlobUrl(
        token,
        rep.id
      );
      setViewingReport({ report: rep, blobUrl: url, mimeType });
    } catch (err: any) {
      alert(err?.message || 'Could not load report file.');
    } finally {
      setLoadingReportModalId(null);
    }
  };

  const closeReportModal = () => {
    if (viewingReport?.blobUrl) {
      URL.revokeObjectURL(viewingReport.blobUrl);
    }
    setViewingReport(null);
  };

  return (
    <div>
      {/* Consultation Header & Assigned Participant Details */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-navy">
                {consultation.reference_code}
              </span>
              <span className="badge badge-success">
                Status: {consultation.status.toUpperCase()}
              </span>
            </div>
            <h3 className="card-title" style={{ marginTop: 6 }}>
              {consultation.subject}
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadWorkspaceData}
            disabled={!isEffectiveOnline}
          >
            Refresh Consultation
          </button>
        </div>

        {currentUserRole === 'patient' ? (
          <div className="info-kv-grid">
            <div className="info-kv-item">
              <div className="info-kv-label">Assigned Doctor</div>
              <div className="info-kv-value">{consultation.doctor_name}</div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Specialty</div>
              <div className="info-kv-value">
                {consultation.doctor_specialty || 'General Medicine'}
              </div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Clinic & Location</div>
              <div className="info-kv-value">
                {consultation.doctor_clinic_name} ({consultation.doctor_clinic_location})
              </div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Languages Spoken</div>
              <div className="info-kv-value">
                {consultation.doctor_languages || 'English, Hindi, Kannada'}
              </div>
            </div>
          </div>
        ) : (
          <div className="info-kv-grid">
            <div className="info-kv-item">
              <div className="info-kv-label">Assigned Patient</div>
              <div className="info-kv-value">
                {consultation.patient_name}{' '}
                {consultation.patient_age
                  ? `(${consultation.patient_age} yrs)`
                  : consultation.patient_dob
                  ? `(DOB: ${consultation.patient_dob})`
                  : ''}
                {consultation.patient_gender
                  ? ` • ${consultation.patient_gender}`
                  : ''}
              </div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Patient Phone & Email</div>
              <div className="info-kv-value">
                {consultation.patient_phone}
                {consultation.patient_email
                  ? ` • ${consultation.patient_email}`
                  : ''}
              </div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Village / Town / Address</div>
              <div className="info-kv-value">
                {consultation.patient_village || 'Not specified'}
              </div>
            </div>
            <div className="info-kv-item">
              <div className="info-kv-label">Emergency Contact</div>
              <div className="info-kv-value">
                {consultation.patient_emergency_name || 'N/A'} (
                {consultation.patient_emergency_phone || 'N/A'})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Online Consultation Messaging Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Online Consultation Messaging</h3>
            <p className="card-subtitle">
              Lightweight text-first consultation thread. Messages are saved in
              SQLite and refreshed periodically.
            </p>
          </div>
          <span className="badge badge-grey">
            {isEffectiveOnline
              ? `Auto-refreshing${lastRefreshedAt ? ` • ${lastRefreshedAt}` : ''}`
              : 'Offline Mode'}
          </span>
        </div>

        {!isEffectiveOnline && (
          <div className="alert alert-warning">
            <strong>Offline State:</strong> You are currently offline. Viewing
            loaded messages; any message sent while offline will show as{' '}
            <strong>Failed</strong> and can be retried once back online.
          </div>
        )}

        {messagesError && (
          <div className="alert alert-error">
            {messagesError}{' '}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 8 }}
              onClick={loadWorkspaceData}
            >
              Retry Load
            </button>
          </div>
        )}

        <div className="message-thread" aria-live="polite">
          {loadingMessages ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 12px',
                color: '#64748b',
              }}
            >
              Loading consultation messages...
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 12px',
                color: '#64748b',
              }}
            >
              No messages in this consultation yet. Send a message below to
              begin.
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.sender_role === currentUserRole;
              return (
                <div
                  key={m.id}
                  className={`message-bubble ${
                    isOwn ? 'message-own' : 'message-other'
                  }`}
                >
                  <div className="message-meta">
                    <strong>
                      {m.sender_name} ({m.sender_role === 'doctor' ? 'Doctor' : 'Patient'})
                    </strong>
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  <div className="message-footer">
                    {m.delivery_state === 'sending' && (
                      <span className="badge badge-warning">Sending...</span>
                    )}
                    {m.delivery_state === 'sent' && (
                      <span
                        className="badge badge-success"
                        style={{ fontSize: '0.68rem' }}
                      >
                        Sent & Saved
                      </span>
                    )}
                    {m.delivery_state === 'failed' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span className="badge badge-danger">
                          Failed (Not Saved)
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRetryMessage(m)}
                        >
                          Retry Send
                        </button>
                      </div>
                    )}
                  </div>
                  {m.error_detail && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: '0.74rem',
                        color: isOwn ? '#fecaca' : '#991b1b',
                      }}
                    >
                      {m.error_detail}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        <form onSubmit={handleSendSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={
              currentUserRole === 'patient'
                ? 'Type your message or symptom update for the doctor...'
                : 'Type your clinical response to the patient...'
            }
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
            disabled={!draftText.trim()}
          >
            Send Message
          </button>
        </form>
      </div>

      {/* Medical Reports & Client-Side Image Compression Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              {currentUserRole === 'patient'
                ? 'Upload Medical Report (With Browser Image Compression)'
                : 'Patient Medical Reports (Private Consultation Storage)'}
            </h3>
            <p className="card-subtitle">
              {currentUserRole === 'patient'
                ? 'Supports JPEG, PNG, WebP (compressed in browser via HTML5 Canvas) and PDF (uploaded at original size).'
                : 'View report metadata and securely inspect files uploaded by this consultation’s patient.'}
            </p>
          </div>
          <span className="badge badge-navy">
            {reports.length} Report{reports.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Patient Report Upload & Compression Form */}
        {currentUserRole === 'patient' && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #d8e0ea',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Report Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. CBC Blood Test / Chest X-Ray Photo"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Select Report File (JPEG, PNG, WebP, or PDF — max 5 MB) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="form-input"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {compressing && (
              <div className="alert alert-info">
                Measuring and compressing image in browser via HTML5 Canvas...
              </div>
            )}

            {uploadError && (
              <div className="alert alert-error">{uploadError}</div>
            )}

            {compressionInfo && (
              <div className="compression-stats-box">
                <div
                  style={{
                    fontWeight: 700,
                    color: '#0b1f3a',
                    marginBottom: 6,
                    fontSize: '0.88rem',
                  }}
                >
                  File Inspection & Browser Compression Summary
                </div>
                <div className="stats-row">
                  <div>
                    <strong>Original Size:</strong>{' '}
                    {formatFileSize(compressionInfo.originalSize)} (
                    {compressionInfo.originalSize.toLocaleString()} bytes)
                  </div>
                  <div>
                    <strong>Size to Upload:</strong>{' '}
                    {formatFileSize(compressionInfo.compressedSize)} (
                    {compressionInfo.compressedSize.toLocaleString()} bytes)
                  </div>
                  <div>
                    <strong>Compression Applied:</strong>{' '}
                    {compressionInfo.isPdf ? (
                      <span className="badge badge-grey">
                        Not Applicable (PDF)
                      </span>
                    ) : compressionInfo.wasCompressed ? (
                      <span className="badge badge-success">
                        Yes — Saved{' '}
                        {formatFileSize(
                          compressionInfo.originalSize -
                            compressionInfo.compressedSize
                        )}
                      </span>
                    ) : (
                      <span className="badge badge-grey">
                        Kept Original (Already Compact)
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.79rem',
                    color: '#475569',
                    marginTop: 6,
                  }}
                >
                  {compressionInfo.note}
                </div>

                {compressionInfo.previewUrl && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: 4,
                      }}
                    >
                      Compressed Image Preview:
                    </div>
                    <img
                      src={compressionInfo.previewUrl}
                      alt="Compressed report preview"
                      style={{
                        maxHeight: 170,
                        maxWidth: '100%',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  </div>
                )}

                {uploadStatus === 'uploading' && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Uploading Report... {uploadProgress}%
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadStatus === 'success' && (
                  <div className="alert alert-success" style={{ marginTop: 10 }}>
                    Report uploaded and stored privately for this consultation!
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {uploadStatus !== 'success' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={executeReportUpload}
                      disabled={uploadStatus === 'uploading'}
                    >
                      {uploadStatus === 'uploading'
                        ? `Uploading (${uploadProgress}%)...`
                        : uploadStatus === 'failed'
                        ? 'Retry Upload'
                        : `Upload Report (${formatFileSize(
                            compressionInfo.compressedSize
                          )})`}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetUploadForm}
                  >
                    {uploadStatus === 'success'
                      ? 'Upload Another Report'
                      : 'Clear Selection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uploaded Reports List */}
        {reportsError && <div className="alert alert-error">{reportsError}</div>}

        {loadingReports ? (
          <div style={{ color: '#64748b', padding: '12px 0' }}>
            Loading consultation reports...
          </div>
        ) : reports.length === 0 ? (
          <div style={{ color: '#64748b', padding: '12px 0' }}>
            No medical reports have been uploaded to this consultation yet.
          </div>
        ) : (
          reports.map((rep) => (
            <div key={rep.id} className="report-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#0b1f3a' }}>{rep.title}</strong>
                  <span className="badge badge-success">
                    Status: {rep.upload_status.toUpperCase()}
                  </span>
                  {rep.was_compressed === 1 ? (
                    <span className="badge badge-navy">Compressed Image</span>
                  ) : rep.mime_type === 'application/pdf' ? (
                    <span className="badge badge-grey">PDF (Uncompressed)</span>
                  ) : (
                    <span className="badge badge-grey">Original Image</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#475569',
                    marginTop: 4,
                  }}
                >
                  Filename: <code>{rep.original_filename}</code> • Original Size:{' '}
                  <strong>{formatFileSize(rep.original_size_bytes)}</strong> •{' '}
                  {rep.mime_type === 'application/pdf' ? (
                    <>
                      Uploaded Size:{' '}
                      <strong>{formatFileSize(rep.uploaded_size_bytes)}</strong>{' '}
                      (PDF not compressed)
                    </>
                  ) : (
                    <>
                      Compressed Size:{' '}
                      <strong>{formatFileSize(rep.uploaded_size_bytes)}</strong>
                    </>
                  )}{' '}
                  • Upload Time:{' '}
                  {new Date(rep.uploaded_at).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  • Upload Status: <strong>{rep.upload_status}</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenPrivateReport(rep)}
                disabled={loadingReportModalId === rep.id}
              >
                {loadingReportModalId === rep.id
                  ? 'Verifying Access...'
                  : 'View Report Securely'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Secure Private Report Preview Modal */}
      {viewingReport && (
        <div className="modal-backdrop" onClick={closeReportModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div>
                <h3 className="card-title">{viewingReport.report.title}</h3>
                <p className="card-subtitle">
                  File: {viewingReport.report.original_filename} • Size:{' '}
                  {formatFileSize(viewingReport.report.uploaded_size_bytes)} •
                  Private Authenticated Stream
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={viewingReport.blobUrl}
                  download={viewingReport.report.original_filename}
                  className="btn btn-secondary btn-sm"
                >
                  Download Copy
                </a>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={closeReportModal}
                >
                  Close
                </button>
              </div>
            </div>

            {viewingReport.mimeType === 'application/pdf' ? (
              <iframe
                src={viewingReport.blobUrl}
                title={viewingReport.report.title}
                style={{ width: '100%', height: '65vh', border: 'none' }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={viewingReport.blobUrl}
                  alt={viewingReport.report.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '68vh',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
