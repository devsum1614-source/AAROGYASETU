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
  const [roleTab, setRoleTab] = useState<'patient' | 'doctor'>('patient');
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign-in fields (default to empty so new users can enter their own credentials)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Patient registration fields
  const [patName, setPatName] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patAge, setPatAge] = useState('');
  const [patDob, setPatDob] = useState('');
  const [patGender, setPatGender] = useState('');
  const [patVillage, setPatVillage] = useState('');
  const [patBloodGroup, setPatBloodGroup] = useState('O+');
  const [patAllergies, setPatAllergies] = useState('');
  const [patChronic, setPatChronic] = useState('');
  const [patEmgName, setPatEmgName] = useState('');
  const [patEmgPhone, setPatEmgPhone] = useState('');
  const [patRegPassword, setPatRegPassword] = useState('');
  const [patSmsConsent, setPatSmsConsent] = useState(true);

  // Doctor registration fields
  const [docName, setDocName] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docRegNumber, setDocRegNumber] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('General Medicine');
  const [docQualifications, setDocQualifications] = useState('MBBS');
  const [docClinicName, setDocClinicName] = useState('');
  const [docClinicLoc, setDocClinicLoc] = useState('');
  const [docLanguages, setDocLanguages] = useState('English, Hindi, Kannada');
  const [docBio, setDocBio] = useState('');
  const [docRegPassword, setDocRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const switchRole = (nextRole: 'patient' | 'doctor') => {
    setRoleTab(nextRole);
    setMode('signin');
    setIdentifier('');
    setPassword('');
    setErrorMsg(null);
    setSuccessNotice(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg('Cannot sign in while offline. Please restore connectivity.');
      return;
    }
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your registered phone number or email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi(identifier.trim(), password, roleTab);
      onAuthenticated(res.access_token, res.user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign-in failed. Please verify your phone/email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg('Cannot register a new account while offline.');
      return;
    }
    if (!patPhone.trim() || !patName.trim() || !patRegPassword) {
      setErrorMsg('Please fill in all required fields (Name, Phone, and Password).');
      return;
    }
    if (!patAge.trim() && !patDob.trim()) {
      setErrorMsg('Please provide your Age or Date of Birth.');
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
        date_of_birth: patDob.trim() || undefined,
        gender: patGender.trim() || undefined,
        village_or_address: patVillage.trim(),
        blood_group: patBloodGroup.trim() || undefined,
        allergies: patAllergies.trim() || undefined,
        chronic_conditions: patChronic.trim() || undefined,
        emergency_contact_name: patEmgName.trim(),
        emergency_contact_phone: patEmgPhone.trim(),
        sms_consent: patSmsConsent,
      });
      onAuthenticated(res.access_token, res.user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Patient registration failed. Phone number may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);
    if (!isEffectiveOnline) {
      setErrorMsg('Cannot register while offline.');
      return;
    }
    if (!docName.trim() || !docPhone.trim() || !docEmail.trim() || !docRegPassword) {
      setErrorMsg('Please fill in doctor Name, Phone, Email, and Password.');
      return;
    }
    setLoading(true);
    try {
      const res = await registerDoctorApi({
        full_name: docName.trim(),
        phone: docPhone.trim(),
        email: docEmail.trim(),
        password: docRegPassword,
        registration_number: docRegNumber.trim() || undefined,
        specialty: docSpecialty.trim(),
        qualifications: docQualifications.trim() || 'MBBS',
        clinic_name: docClinicName.trim() || 'Community Tele-Clinic',
        clinic_location: docClinicLoc.trim() || 'Karnataka',
        languages_spoken: docLanguages.trim(),
        bio: docBio.trim() || undefined,
      });
      if (res.access_token && res.user) {
        onAuthenticated(res.access_token, res.user);
      } else {
        setSuccessNotice('Doctor registered successfully! You can now sign in.');
        setIdentifier(docPhone.trim());
        setMode('signin');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Doctor registration failed. Phone or email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoPatient = () => {
    setRoleTab('patient');
    setMode('signin');
    setIdentifier('9876543210');
    setPassword('patient123');
    setErrorMsg(null);
  };

  const fillDemoDoctor = () => {
    setRoleTab('doctor');
    setMode('signin');
    setIdentifier('9123456780');
    setPassword('doctor123');
    setErrorMsg(null);
  };

  return (
    <div className="auth-wrapper">
      {/* Welcome & Branding Hero Card */}
      <div className="hero-welcome-card">
        <h2>AAROGYASETU (आरोग्यसेतु)</h2>
        <div className="tagline">“Healthcare Beyond Boundaries”</div>
        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: 4 }}>
          Lightweight, mobile-first telemedicine Progressive Web App for rural patient consultations, appointment booking, and medical records.
        </div>
        <div className="hero-meta-grid" style={{ marginTop: 10 }}>
          <span className="hero-meta-chip">Hackathon: AIORA</span>
          <span className="hero-meta-chip">Institution: Karavali Institute of Technology</span>
        </div>
      </div>

      {/* Role Selector Tabs (Patient vs Doctor Only) */}
      <div className="role-tabs" role="tablist" aria-label="Select Portal Role">
        <button
          type="button"
          className={`tab-btn ${roleTab === 'patient' ? 'active' : ''}`}
          onClick={() => switchRole('patient')}
        >
          Patient Portal (मरीज़)
        </button>
        <button
          type="button"
          className={`tab-btn ${roleTab === 'doctor' ? 'active' : ''}`}
          onClick={() => switchRole('doctor')}
        >
          Doctor Portal (डॉक्टर)
        </button>
      </div>

      <div className="card">
        {/* Header with Mode Toggle (Sign In vs Register) */}
        <div className="card-header" style={{ alignItems: 'center' }}>
          <div>
            <h3 className="card-title">
              {roleTab === 'patient'
                ? mode === 'signin'
                  ? 'Patient Sign-In'
                  : 'New Patient Registration'
                : mode === 'signin'
                ? 'Doctor Sign-In'
                : 'New Doctor Registration'}
            </h3>
            <p className="card-subtitle">
              {mode === 'signin'
                ? 'Sign in with your registered phone number or email address.'
                : 'Create a new account. Fill in your details below to get started.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setMode(mode === 'signin' ? 'register' : 'signin');
              setErrorMsg(null);
              setSuccessNotice(null);
            }}
          >
            {mode === 'signin'
              ? roleTab === 'patient'
                ? '+ New Patient? Register Here'
                : '+ New Doctor? Register Here'
              : '← Already have an account? Sign In'}
          </button>
        </div>

        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
        {successNotice && <div className="alert alert-success">{successNotice}</div>}

        {/* ==================== SIGN-IN FORM ==================== */}
        {mode === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">
                Phone Number or Email Address *
              </label>
              <input
                id="login-identifier"
                type="text"
                className="form-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  roleTab === 'patient'
                    ? 'e.g. 9876543210 or your registered email'
                    : 'e.g. 9123456780 or dr.priya@aarogyasetu.local'
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password *
              </label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading
                ? 'Signing In...'
                : roleTab === 'patient'
                ? 'Sign In to Patient Portal'
                : 'Sign In to Doctor Portal'}
            </button>

            {/* Quick Demo Pre-fill Scoped Strictly to Selected Portal */}
            <div
              style={{
                marginTop: 18,
                padding: 12,
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {roleTab === 'patient' ? (
                <>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0b1f3a' }}>
                      Demo Patient (Patient Portal Only)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Ramesh Kumar • Phone: <code>9876543210</code> • Password: <code>patient123</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                    onClick={fillDemoPatient}
                  >
                    Demo Patient
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0b1f3a' }}>
                      Demo Doctor (Doctor Portal Only)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Dr. Priya Sharma • Phone: <code>9123456780</code> • Password: <code>doctor123</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                    onClick={fillDemoDoctor}
                  >
                    Demo Doctor
                  </button>
                </>
              )}
            </div>
          </form>
        ) : roleTab === 'patient' ? (
          /* ==================== PATIENT REGISTRATION FORM ==================== */
          <form onSubmit={handlePatientRegister}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={patName}
                  onChange={(e) => setPatName(e.target.value)}
                  placeholder="e.g. Suresh Gowda"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (10 Digits) *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={patPhone}
                  onChange={(e) => setPatPhone(e.target.value)}
                  placeholder="e.g. 9812345678"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={patEmail}
                  onChange={(e) => setPatEmail(e.target.value)}
                  placeholder="e.g. suresh@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Age (Years) *</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className="form-input"
                  value={patAge}
                  onChange={(e) => setPatAge(e.target.value)}
                  placeholder="e.g. 42"
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
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={patGender}
                  onChange={(e) => setPatGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select
                  className="form-select"
                  value={patBloodGroup}
                  onChange={(e) => setPatBloodGroup(e.target.value)}
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Create Password (min 6 characters) *</label>
                <input
                  type="password"
                  minLength={6}
                  className="form-input"
                  value={patRegPassword}
                  onChange={(e) => setPatRegPassword(e.target.value)}
                  placeholder="Choose a secure password"
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
                  placeholder="e.g. Hebri Village, Udupi District"
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
                  placeholder="Family member or neighbor name"
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

              <div className="form-group full-width">
                <label className="form-label">Known Allergies (if any)</label>
                <input
                  type="text"
                  className="form-input"
                  value={patAllergies}
                  onChange={(e) => setPatAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs, Peanuts (or None)"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Chronic Health Conditions (if any)</label>
                <input
                  type="text"
                  className="form-input"
                  value={patChronic}
                  onChange={(e) => setPatChronic(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma (or None)"
                />
              </div>

              <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="smsConsentCheckbox"
                  checked={patSmsConsent}
                  onChange={(e) => setPatSmsConsent(e.target.checked)}
                />
                <label htmlFor="smsConsentCheckbox" style={{ fontSize: '0.84rem' }}>
                  I consent to receive Zero-PHI appointment reminders via SMS.
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? 'Creating Your Account...' : '✓ Complete Registration & Enter Patient Portal'}
            </button>
          </form>
        ) : (
          /* ==================== DOCTOR REGISTRATION FORM ==================== */
          <form onSubmit={handleDoctorRegister}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Doctor Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Dr. Rajesh Nayak"
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
                  placeholder="e.g. General Medicine, Pediatrics, Orthopedics"
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
                  placeholder="e.g. 9845012345"
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
                  placeholder="dr.rajesh@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Medical Council Reg. Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={docRegNumber}
                  onChange={(e) => setDocRegNumber(e.target.value)}
                  placeholder="e.g. KMC-10482"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualifications</label>
                <input
                  type="text"
                  className="form-input"
                  value={docQualifications}
                  onChange={(e) => setDocQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD (General Medicine)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic / Hospital Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={docClinicName}
                  onChange={(e) => setDocClinicName(e.target.value)}
                  placeholder="e.g. Karavali Community Clinic"
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
                  placeholder="e.g. Udupi / Mangalore"
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
                  placeholder="English, Hindi, Kannada"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Create Password (min 6 characters) *</label>
                <input
                  type="password"
                  minLength={6}
                  className="form-input"
                  value={docRegPassword}
                  onChange={(e) => setDocRegPassword(e.target.value)}
                  placeholder="Choose doctor account password"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Short Professional Bio</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={docBio}
                  onChange={(e) => setDocBio(e.target.value)}
                  placeholder="Brief clinical background, specialties, and experience..."
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? 'Creating Doctor Account...' : '✓ Register & Enter Doctor Portal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
