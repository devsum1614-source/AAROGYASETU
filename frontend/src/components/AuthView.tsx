import React, { useState } from 'react';
import {
  loginApi,
  registerDoctorApi,
  registerPatientApi,
} from '../api';
import { UserAccount, UserRole } from '../types';

interface AuthViewProps {
  onAuthenticated: (token: string, user: UserAccount) => void;
  isEffectiveOnline: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthenticated,
  isEffectiveOnline,
}) => {
  const [roleTab, setRoleTab] = useState<UserRole>('patient');
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign-in fields
  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('patient123');

  // Patient registration fields
  const [patName, setPatName] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patAge, setPatAge] = useState('');
  const [patDob, setPatDob] = useState('');
  const [patGender, setPatGender] = useState('');
  const [patVillage, setPatVillage] = useState('');
  const [patEmgName, setPatEmgName] = useState('');
  const [patEmgPhone, setPatEmgPhone] = useState('');
  const [patRegPassword, setPatRegPassword] = useState('');

  // Doctor registration fields (marked pending until approved)
  const [docName, setDocName] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('General Medicine');
  const [docClinicName, setDocClinicName] = useState('');
  const [docClinicLoc, setDocClinicLoc] = useState('');
  const [docLanguages, setDocLanguages] = useState('English, Hindi, Kannada');
  const [docBio, setDocBio] = useState('');
  const [docRegPassword, setDocRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const switchRole = (nextRole: UserRole) => {
    setRoleTab(nextRole);
    setMode('signin');
    setErrorMsg(null);
    setPendingNotice(null);
    if (nextRole === 'patient') {
      setIdentifier('9876543210');
      setPassword('patient123');
    } else if (nextRole === 'doctor') {
      setIdentifier('9123456780');
      setPassword('doctor123');
    } else {
      setIdentifier('9900112233');
      setPassword('examiner123');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPendingNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg(
        'Cannot sign in while offline. Please restore network connectivity and try again.'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi(identifier.trim(), password, roleTab);
      onAuthenticated(res.access_token, res.user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign-in failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPendingNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg('Cannot register a new account while offline.');
      return;
    }
    if (!patAge.trim() && !patDob.trim()) {
      setErrorMsg('Please enter either your Age or Date of Birth.');
      return;
    }
    setLoading(true);
    try {
      const res = await registerPatientApi({
        full_name: patName.trim(),
        phone: patPhone.trim(),
        email: patEmail.trim() || undefined,
        password: patRegPassword,
        age: patAge.trim() ? Number(patAge) : null,
        date_of_birth: patDob.trim(),
        gender: patGender.trim(),
        village_or_address: patVillage.trim(),
        emergency_contact_name: patEmgName.trim(),
        emergency_contact_phone: patEmgPhone.trim(),
      });
      onAuthenticated(res.access_token, res.user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Patient registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPendingNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg('Cannot submit doctor registration while offline.');
      return;
    }
    setLoading(true);
    try {
      const res = await registerDoctorApi({
        full_name: docName.trim(),
        phone: docPhone.trim(),
        email: docEmail.trim(),
        password: docRegPassword,
        specialty: docSpecialty.trim(),
        clinic_name: docClinicName.trim(),
        clinic_location: docClinicLoc.trim(),
        languages_spoken: docLanguages.trim(),
        bio: docBio.trim(),
      });
      setPendingNotice(res.message);
      setMode('signin');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Doctor registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Welcome & Branding Hero Card */}
      <div className="hero-welcome-card">
        <h2>AAROGYASETU (आरोग्यसेतु)</h2>
        <div className="tagline">“Healthcare Beyond Boundaries”</div>
        <div style={{ fontSize: '0.84rem', color: '#e2e8f0' }}>
          Lightweight, installable mobile-first telemedicine platform for rural patient consultations and compressed medical report sharing.
        </div>
        <div className="hero-meta-grid">
          <span className="hero-meta-chip">Hackathon: AIORA</span>
          <span className="hero-meta-chip">
            Institution: Karavali Institute of Technology
          </span>
        </div>
      </div>

      {/* Role Selector */}
      <div className="role-tabs" role="tablist" aria-label="Select Portal Role">
        <button
          type="button"
          className={`tab-btn ${roleTab === 'patient' ? 'active' : ''}`}
          onClick={() => switchRole('patient')}
        >
          Patient Portal
        </button>
        <button
          type="button"
          className={`tab-btn ${roleTab === 'doctor' ? 'active' : ''}`}
          onClick={() => switchRole('doctor')}
        >
          Doctor Portal
        </button>
        <button
          type="button"
          className={`tab-btn ${roleTab === 'examiner' ? 'active' : ''}`}
          onClick={() => switchRole('examiner')}
        >
          Examiner Portal
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              {roleTab === 'patient'
                ? mode === 'signin'
                  ? 'Patient Sign-In'
                  : 'New Patient Registration'
                : roleTab === 'doctor'
                ? mode === 'signin'
                  ? 'Doctor Portal Sign-In'
                  : 'Doctor Self-Registration (Pending Approval)'
                : 'AIORA Hackathon Examiner Sign-In'}
            </h3>
            <p className="card-subtitle">
              {roleTab === 'patient'
                ? 'Access your rural profile, assigned doctor consultation, and medical reports.'
                : roleTab === 'doctor'
                ? 'Dedicated clinician portal restricted to assigned patient consultations.'
                : 'Read-only evaluation access to review fictional demo consultations and reports.'}
            </p>
          </div>
          {roleTab !== 'examiner' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setMode(mode === 'signin' ? 'register' : 'signin');
                setErrorMsg(null);
              }}
            >
              {mode === 'signin'
                ? roleTab === 'patient'
                  ? 'Create Patient Account'
                  : 'Doctor Registration'
                : 'Back to Sign-In'}
            </button>
          )}
        </div>

        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
        {pendingNotice && (
          <div className="alert alert-warning">
            <strong>Account Status: PENDING APPROVAL</strong>
            <div style={{ marginTop: 4 }}>{pendingNotice}</div>
          </div>
        )}

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">
                Phone Number or Email
              </label>
              <input
                id="login-identifier"
                type="text"
                className="form-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  roleTab === 'patient'
                    ? 'e.g. 9876543210'
                    : roleTab === 'doctor'
                    ? 'e.g. 9123456780 or dr.priya@aarogyasetu.local'
                    : 'e.g. examiner@aiora.karavali.edu or 9900112233'
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading
                ? 'Signing In...'
                : roleTab === 'patient'
                ? 'Sign In to Patient Portal'
                : roleTab === 'doctor'
                ? 'Sign In to Doctor Portal'
                : 'Sign In to Examiner Portal (Read-Only)'}
            </button>

            {/* Demo Credentials Box */}
            <div
              className="alert alert-info"
              style={{ marginTop: 14, marginBottom: 0 }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  <strong>
                    {roleTab === 'patient'
                      ? 'Demo Patient Account (Fictional):'
                      : roleTab === 'doctor'
                      ? 'Seeded Demo Doctor Account (Fictional):'
                      : 'AIORA Hackathon Examiner Account (Read-Only):'}
                  </strong>
                  <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
                    {roleTab === 'patient'
                      ? 'Ramesh Kumar • Phone: 9876543210 • Password: patient123'
                      : roleTab === 'doctor'
                      ? 'Dr. Priya Sharma • Phone: 9123456780 • Password: doctor123'
                      : 'AIORA Examiner • Phone: 9900112233 / examiner@aiora.karavali.edu • Password: examiner123'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (roleTab === 'patient') {
                      setIdentifier('9876543210');
                      setPassword('patient123');
                    } else if (roleTab === 'doctor') {
                      setIdentifier('9123456780');
                      setPassword('doctor123');
                    } else {
                      setIdentifier('9900112233');
                      setPassword('examiner123');
                    }
                  }}
                >
                  Fill Demo Credentials
                </button>
              </div>
            </div>
          </form>
        ) : roleTab === 'patient' ? (
          <form onSubmit={handlePatientRegister}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={patName}
                  onChange={(e) => setPatName(e.target.value)}
                  placeholder="e.g. Kaveri Shetty"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={patPhone}
                  onChange={(e) => setPatPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={patEmail}
                  onChange={(e) => setPatEmail(e.target.value)}
                  placeholder="optional@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Age (Years)</label>
                <input
                  type="number"
                  min={0}
                  max={125}
                  className="form-input"
                  value={patAge}
                  onChange={(e) => setPatAge(e.target.value)}
                  placeholder="e.g. 38"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-input"
                  value={patDob}
                  onChange={(e) => setPatDob(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender (Optional)</label>
                <select
                  className="form-select"
                  value={patGender}
                  onChange={(e) => setPatGender(e.target.value)}
                >
                  <option value="">Prefer not to state / Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Password (min 6 chars) *</label>
                <input
                  type="password"
                  minLength={6}
                  className="form-input"
                  value={patRegPassword}
                  onChange={(e) => setPatRegPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Village, Town, or Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={patVillage}
                  onChange={(e) => setPatVillage(e.target.value)}
                  placeholder="e.g. Bantwal Village, Dakshina Kannada"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={patEmgName}
                  onChange={(e) => setPatEmgName(e.target.value)}
                  placeholder="Family member name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Phone *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={patEmgPhone}
                  onChange={(e) => setPatEmgPhone(e.target.value)}
                  placeholder="Emergency phone number"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading
                ? 'Creating Patient Account...'
                : 'Register & Open Patient Portal'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleDoctorRegister}>
            <div className="alert alert-warning">
              <strong>Access Control Policy:</strong> Self-registered doctor
              accounts are marked as <strong>PENDING</strong> until verified and
              cannot view any patient records. Use the seeded demo doctor account
              (<code>9123456780</code> / <code>doctor123</code>) to evaluate
              assigned consultations.
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Doctor Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Dr. Full Name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Specialty *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docSpecialty}
                  onChange={(e) => setDocSpecialty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={docPhone}
                  onChange={(e) => setDocPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic / Hospital Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docClinicName}
                  onChange={(e) => setDocClinicName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Location *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docClinicLoc}
                  onChange={(e) => setDocClinicLoc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Languages Spoken *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docLanguages}
                  onChange={(e) => setDocLanguages(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  minLength={6}
                  className="form-input"
                  value={docRegPassword}
                  onChange={(e) => setDocRegPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Short Biography</label>
                <textarea
                  className="form-textarea"
                  value={docBio}
                  onChange={(e) => setDocBio(e.target.value)}
                  placeholder="Qualifications and rural clinical experience..."
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading
                ? 'Submitting...'
                : 'Submit Doctor Registration (Pending Approval)'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
