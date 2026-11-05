import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAuthorizedReportBlobUrl,
  fetchMyPatientReportsApi,
  fetchPatientConsultationsApi,
  updatePatientProfileApi,
} from '../api';
import { Consultation, ReportItem, UserAccount } from '../types';
import { formatFileSize } from '../utils/compressImage';
import { ConsultationWorkspace } from './ConsultationWorkspace';

interface PatientPortalProps {
  token: string;
  user: UserAccount;
  onUserUpdated: (updated: UserAccount) => void;
  isEffectiveOnline: boolean;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  token,
  user,
  onUserUpdated,
  isEffectiveOnline,
}) => {
  const [activeTab, setActiveTab] = useState<
    'consultations' | 'reports' | 'profile'
  >('consultations');

  // Consultations state
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    number | null
  >(null);
  const [loadingConsultations, setLoadingConsultations] =
    useState<boolean>(true);
  const [consultationsError, setConsultationsError] = useState<string | null>(
    null
  );

  // All uploaded reports state
  const [allReports, setAllReports] = useState<ReportItem[]>([]);
  const [loadingAllReports, setLoadingAllReports] = useState<boolean>(false);
  const [viewingReportModal, setViewingReportModal] = useState<{
    report: ReportItem;
    blobUrl: string;
    mimeType: string;
  } | null>(null);

  // Patient profile edit form state
  const pp = user.patient_profile;
  const [fullName, setFullName] = useState<string>(user.full_name || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [email, setEmail] = useState<string>(user.email || '');
  const [age, setAge] = useState<string>(
    pp?.age !== null && pp?.age !== undefined ? String(pp.age) : ''
  );
  const [dob, setDob] = useState<string>(pp?.date_of_birth || '');
  const [gender, setGender] = useState<string>(pp?.gender || '');
  const [village, setVillage] = useState<string>(pp?.village_or_address || '');
  const [emgName, setEmgName] = useState<string>(
    pp?.emergency_contact_name || ''
  );
  const [emgPhone, setEmgPhone] = useState<string>(
    pp?.emergency_contact_phone || ''
  );
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadConsultations = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoadingConsultations(false);
      return;
    }
    setLoadingConsultations(true);
    setConsultationsError(null);
    try {
      const list = await fetchPatientConsultationsApi(token);
      setConsultations(list);
      if (list.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(list[0].id);
      }
    } catch (err: any) {
      setConsultationsError(
        err?.message || 'Could not load your consultations.'
      );
    } finally {
      setLoadingConsultations(false);
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  const loadAllMyReports = useCallback(async () => {
    if (!isEffectiveOnline) return;
    setLoadingAllReports(true);
    try {
      const list = await fetchMyPatientReportsApi(token);
      setAllReports(list);
    } catch {
      // handled in UI
    } finally {
      setLoadingAllReports(false);
    }
  }, [token, isEffectiveOnline]);

  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadAllMyReports();
    }
  }, [activeTab, loadAllMyReports]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!isEffectiveOnline) {
      setProfileMessage({
        type: 'error',
        text: 'Cannot save profile updates while offline.',
      });
      return;
    }
    if (!age.trim() && !dob.trim()) {
      setProfileMessage({
        type: 'error',
        text: 'Please provide either your Age or Date of Birth.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updatePatientProfileApi(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        age: age.trim() ? Number(age) : null,
        date_of_birth: dob.trim(),
        gender: gender.trim(),
        village_or_address: village.trim(),
        emergency_contact_name: emgName.trim(),
        emergency_contact_phone: emgPhone.trim(),
      });
      onUserUpdated(updated);
      setProfileMessage({
        type: 'success',
        text: 'Patient profile saved and updated in database.',
      });
    } catch (err: any) {
      setProfileMessage({
        type: 'error',
        text: err?.message || 'Failed to update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenReportFromArchive = async (rep: ReportItem) => {
    if (!isEffectiveOnline) {
      alert('Viewing private medical reports requires an active connection.');
      return;
    }
    try {
      const { url, mimeType } = await fetchAuthorizedReportBlobUrl(
        token,
        rep.id
      );
      setViewingReportModal({ report: rep, blobUrl: url, mimeType });
    } catch (err: any) {
      alert(err?.message || 'Could not open report.');
    }
  };

  const selectedConsultation =
    consultations.find((c) => c.id === selectedConsultationId) || null;

  return (
    <div>
      {/* Patient Welcome Summary Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <span className="badge badge-navy">Patient Portal</span>
            <h2
              style={{
                margin: '4px 0 2px',
                fontSize: '1.15rem',
                color: '#0b1f3a',
              }}
            >
              Welcome, {user.full_name}
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
              Village/Address: {pp?.village_or_address || 'Not set'} • Emergency
              Contact: {pp?.emergency_contact_name || 'Not set'} (
              {pp?.emergency_contact_phone || 'N/A'})
            </div>
          </div>

          <div
            className="nav-tabs"
            style={{ marginBottom: 0, minWidth: 320 }}
            role="tablist"
          >
            <button
              type="button"
              className={`tab-btn ${
                activeTab === 'consultations' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('consultations')}
            >
              Consultations ({consultations.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              My Reports
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              My Profile
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: CONSULTATIONS & MESSAGING WORKSPACE */}
      {activeTab === 'consultations' && (
        <div className="workspace-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">My Consultations</h3>
                <p className="card-subtitle">
                  Select an assigned doctor consultation to chat or upload
                  reports.
                </p>
              </div>
            </div>

            {consultationsError && (
              <div className="alert alert-error">{consultationsError}</div>
            )}

            {loadingConsultations ? (
              <div style={{ color: '#64748b', padding: '12px 0' }}>
                Loading consultations...
              </div>
            ) : consultations.length === 0 ? (
              <div style={{ color: '#64748b', padding: '12px 0' }}>
                No consultations assigned yet.
              </div>
            ) : (
              consultations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`consultation-list-item ${
                    selectedConsultationId === c.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedConsultationId(c.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span className="badge badge-navy">{c.reference_code}</span>
                    <span className="badge badge-grey">
                      {c.message_count || 0} msgs • {c.report_count || 0}{' '}
                      reports
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#0b1f3a',
                      fontSize: '0.92rem',
                    }}
                  >
                    {c.doctor_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                    {c.doctor_specialty} • {c.doctor_clinic_name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: '#1e3a8a',
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    {c.subject}
                  </div>
                  {c.last_message && (
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: '#64748b',
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Last: {c.last_message.content}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          <div>
            {selectedConsultation ? (
              <ConsultationWorkspace
                token={token}
                currentUserId={user.id}
                currentUserRole="patient"
                currentUserName={user.full_name}
                consultation={selectedConsultation}
                isEffectiveOnline={isEffectiveOnline}
                onConsultationActivity={loadConsultations}
              />
            ) : (
              <div className="card">
                <p style={{ color: '#64748b', margin: 0 }}>
                  Select a consultation from the list to view messages and
                  upload medical reports.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALL PREVIOUSLY UPLOADED REPORTS */}
      {activeTab === 'reports' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Previously Uploaded Medical Reports</h3>
              <p className="card-subtitle">
                All reports uploaded across your consultations, stored in
                private access-controlled storage.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadAllMyReports}
            >
              Refresh List
            </button>
          </div>

          {loadingAllReports ? (
            <div style={{ color: '#64748b', padding: '14px 0' }}>
              Loading your uploaded reports...
            </div>
          ) : allReports.length === 0 ? (
            <div style={{ color: '#64748b', padding: '14px 0' }}>
              You have not uploaded any medical reports yet. Open a consultation
              to upload a compressed report image.
            </div>
          ) : (
            allReports.map((rep) => (
              <div key={rep.id} className="report-card">
                <div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span className="badge badge-navy">
                      {rep.consultation_code || `CONS-${rep.consultation_id}`}
                    </span>
                    <strong style={{ color: '#0b1f3a' }}>{rep.title}</strong>
                    <span className="badge badge-success">
                      {rep.upload_status.toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#475569',
                      marginTop: 4,
                    }}
                  >
                    Doctor: <strong>{rep.doctor_name || 'Assigned Doctor'}</strong>{' '}
                    • Filename: <code>{rep.original_filename}</code> • Original
                    Size: <strong>{formatFileSize(rep.original_size_bytes)}</strong>{' '}
                    •{' '}
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
                    • Upload Time: {new Date(rep.uploaded_at).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenReportFromArchive(rep)}
                >
                  View Report Securely
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: PATIENT PROFILE VIEW & EDIT */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Patient Profile & Rural Contact Details</h3>
              <p className="card-subtitle">
                Keep your demographic, village, and emergency contact details
                up to date for your assigned clinician.
              </p>
            </div>
          </div>

          {profileMessage && (
            <div
              className={`alert ${
                profileMessage.type === 'success'
                  ? 'alert-success'
                  : 'alert-error'
              }`}
            >
              {profileMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="form-group">
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
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender (If Provided)</label>
                <select
                  className="form-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Prefer not to state</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Age (Years)</label>
                <input
                  type="number"
                  min={0}
                  max={125}
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

              <div className="form-group full-width">
                <label className="form-label">Village, Town, or Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  required
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
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {viewingReportModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            URL.revokeObjectURL(viewingReportModal.blobUrl);
            setViewingReportModal(null);
          }}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
            {viewingReportModal.mimeType === 'application/pdf' ? (
              <iframe
                src={viewingReportModal.blobUrl}
                title={viewingReportModal.report.title}
                style={{ width: '100%', height: '65vh', border: 'none' }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={viewingReportModal.blobUrl}
                  alt={viewingReportModal.report.title}
                  style={{ maxWidth: '100%', maxHeight: '68vh' }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
