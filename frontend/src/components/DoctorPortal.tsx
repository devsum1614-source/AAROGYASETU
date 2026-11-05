import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchDoctorConsultationsApi,
  updateDoctorProfileApi,
} from '../api';
import { Consultation, UserAccount } from '../types';
import { ConsultationWorkspace } from './ConsultationWorkspace';

interface DoctorPortalProps {
  token: string;
  user: UserAccount;
  onUserUpdated: (updated: UserAccount) => void;
  isEffectiveOnline: boolean;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  token,
  user,
  onUserUpdated,
  isEffectiveOnline,
}) => {
  const [activeTab, setActiveTab] = useState<'consultations' | 'profile'>(
    'consultations'
  );

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    number | null
  >(null);
  const [loadingConsultations, setLoadingConsultations] =
    useState<boolean>(true);
  const [consultationsError, setConsultationsError] = useState<string | null>(
    null
  );

  // Doctor Profile form state
  const dp = user.doctor_profile;
  const [fullName, setFullName] = useState<string>(user.full_name || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [email, setEmail] = useState<string>(user.email || '');
  const [specialty, setSpecialty] = useState<string>(
    dp?.specialty || 'General Medicine'
  );
  const [clinicName, setClinicName] = useState<string>(dp?.clinic_name || '');
  const [clinicLocation, setClinicLocation] = useState<string>(
    dp?.clinic_location || ''
  );
  const [languagesSpoken, setLanguagesSpoken] = useState<string>(
    dp?.languages_spoken || 'English, Hindi, Kannada'
  );
  const [bio, setBio] = useState<string>(dp?.bio || '');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadAssignedConsultations = useCallback(async () => {
    if (!isEffectiveOnline) {
      setLoadingConsultations(false);
      return;
    }
    setLoadingConsultations(true);
    setConsultationsError(null);
    try {
      const list = await fetchDoctorConsultationsApi(token);
      setConsultations(list);
      if (list.length > 0 && selectedConsultationId === null) {
        setSelectedConsultationId(list[0].id);
      }
    } catch (err: any) {
      setConsultationsError(
        err?.message || 'Could not load assigned consultations.'
      );
    } finally {
      setLoadingConsultations(false);
    }
  }, [token, isEffectiveOnline, selectedConsultationId]);

  useEffect(() => {
    loadAssignedConsultations();
  }, [loadAssignedConsultations]);

  const handleSaveDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!isEffectiveOnline) {
      setProfileMessage({
        type: 'error',
        text: 'Cannot update doctor profile while offline.',
      });
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateDoctorProfileApi(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        specialty: specialty.trim(),
        clinic_name: clinicName.trim(),
        clinic_location: clinicLocation.trim(),
        languages_spoken: languagesSpoken.trim(),
        bio: bio.trim(),
      });
      onUserUpdated(updated);
      setProfileMessage({
        type: 'success',
        text: 'Doctor profile updated successfully.',
      });
    } catch (err: any) {
      setProfileMessage({
        type: 'error',
        text: err?.message || 'Could not update doctor profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const selectedConsultation =
    consultations.find((c) => c.id === selectedConsultationId) || null;

  return (
    <div>
      {/* Doctor Portal Summary Bar */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-navy">Doctor Portal</span>
              <span className="badge badge-success">
                Consultation-Scoped Access Enforced
              </span>
            </div>
            <h2
              style={{
                margin: '4px 0 2px',
                fontSize: '1.15rem',
                color: '#0b1f3a',
              }}
            >
              {user.full_name} — {dp?.specialty}
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
              {dp?.clinic_name} ({dp?.clinic_location}) • Languages:{' '}
              {dp?.languages_spoken}
            </div>
          </div>

          <div
            className="nav-tabs"
            style={{ marginBottom: 0, minWidth: 310 }}
            role="tablist"
          >
            <button
              type="button"
              className={`tab-btn ${
                activeTab === 'consultations' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('consultations')}
            >
              Assigned Patients ({consultations.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Doctor Profile
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ASSIGNED PATIENTS & CONSULTATIONS */}
      {activeTab === 'consultations' && (
        <div className="workspace-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Assigned Patient Consultations</h3>
                <p className="card-subtitle">
                  Access is strictly restricted to patients assigned to your
                  consultations.
                </p>
              </div>
            </div>

            {consultationsError && (
              <div className="alert alert-error">{consultationsError}</div>
            )}

            {loadingConsultations ? (
              <div style={{ color: '#64748b', padding: '12px 0' }}>
                Loading assigned consultations...
              </div>
            ) : consultations.length === 0 ? (
              <div style={{ color: '#64748b', padding: '12px 0' }}>
                No patient consultations are currently assigned to your account.
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
                      fontSize: '0.94rem',
                    }}
                  >
                    {c.patient_name}{' '}
                    {c.patient_age ? `(${c.patient_age} yrs)` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                    Village: {c.patient_village || 'N/A'} • Phone:{' '}
                    {c.patient_phone}
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
                      Last ({c.last_message.sender_name}):{' '}
                      {c.last_message.content}
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
                currentUserRole="doctor"
                currentUserName={user.full_name}
                consultation={selectedConsultation}
                isEffectiveOnline={isEffectiveOnline}
                onConsultationActivity={loadAssignedConsultations}
              />
            ) : (
              <div className="card">
                <p style={{ color: '#64748b', margin: 0 }}>
                  Select an assigned patient consultation on the left to review
                  patient details, reply to messages, and inspect uploaded
                  medical reports.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR PROFILE */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Doctor Profile & Clinic Details</h3>
              <p className="card-subtitle">
                Visible to patients assigned to your tele-consultations.
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

          <form onSubmit={handleSaveDoctorProfile}>
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
                <label className="form-label">Specialty *</label>
                <input
                  type="text"
                  className="form-input"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
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
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Location *</label>
                <input
                  type="text"
                  className="form-input"
                  value={clinicLocation}
                  onChange={(e) => setClinicLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Languages Spoken *</label>
                <input
                  type="text"
                  className="form-input"
                  value={languagesSpoken}
                  onChange={(e) => setLanguagesSpoken(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Short Biography</label>
                <textarea
                  className="form-textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Doctor Profile'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
