import React, { useEffect, useState } from 'react';
import { fetchMyProfileApi, logoutApi } from './api';
import { AuthView } from './components/AuthView';
import { DoctorPortal } from './components/DoctorPortal';
import { ExaminerPortal } from './components/ExaminerPortal';
import { PatientPortal } from './components/PatientPortal';
import { UserAccount } from './types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SESSION_TOKEN_KEY = 'aarogyasetu_m1_token';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(SESSION_TOKEN_KEY)
  );
  const [user, setUser] = useState<UserAccount | null>(null);
  const [initializing, setInitializing] = useState<boolean>(Boolean(token));

  // Connectivity state (browser online/offline + optional test simulation toggle)
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const isEffectiveOnline = browserOnline && !simulateOffline;

  // PWA Install Prompt state
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPwaGuide, setShowPwaGuide] = useState<boolean>(false);
  const [routeGuardNotice, setRouteGuardNotice] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    setInitializing(true);
    fetchMyProfileApi(token)
      .then((prof) => {
        if (!cancelled) {
          setUser(prof);
        }
      })
      .catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuthenticated = (newToken: string, newUser: UserAccount) => {
    sessionStorage.setItem(SESSION_TOKEN_KEY, newToken);
    setRouteGuardNotice(null);
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === 'examiner') {
      window.location.hash = '#/examiner';
    } else {
      window.location.hash = newUser.role === 'doctor' ? '#/doctor' : '#/patient';
    }
  };

  const handleSignOut = async () => {
    const activeToken = token;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    setRouteGuardNotice(null);
    setToken(null);
    setUser(null);
    window.location.hash = '#/login';
    if (activeToken) {
      await logoutApi(activeToken);
    }
  };

  // Enforce role-based URL route protection so changing the URL/hash cannot open another role's portal
  useEffect(() => {
    const enforceRouteGuard = () => {
      if (initializing) return;
      const rawHash = (window.location.hash || '').toLowerCase();
      const rawPath = (window.location.pathname || '').toLowerCase();

      if (!token || !user) {
        if (
          rawHash.includes('patient') ||
          rawHash.includes('doctor') ||
          rawHash.includes('examiner') ||
          rawPath.includes('/patient') ||
          rawPath.includes('/doctor') ||
          rawPath.includes('/examiner')
        ) {
          setRouteGuardNotice('Authentication required: Please sign in to access your portal.');
          window.history.replaceState(null, '', '#/login');
        }
        return;
      }

      if (user.role === 'patient') {
        if (rawHash.includes('doctor') || rawHash.includes('examiner') || rawPath.includes('/doctor') || rawPath.includes('/examiner')) {
          setRouteGuardNotice(
            'Role Guard: Patient accounts cannot access Doctor or Examiner portals. Redirected to Patient Portal.'
          );
          window.history.replaceState(null, '', '#/patient');
        } else if (!rawHash.includes('patient')) {
          window.history.replaceState(null, '', '#/patient');
        }
      } else if (user.role === 'doctor') {
        if (rawHash.includes('patient') || rawHash.includes('examiner') || rawPath.includes('/patient') || rawPath.includes('/examiner')) {
          setRouteGuardNotice(
            'Role Guard: Doctor accounts cannot access Patient or Examiner portals. Redirected to Doctor Portal.'
          );
          window.history.replaceState(null, '', '#/doctor');
        } else if (!rawHash.includes('doctor')) {
          window.history.replaceState(null, '', '#/doctor');
        }
      } else if (user.role === 'examiner') {
        if (rawHash.includes('patient') || rawHash.includes('doctor') || rawPath.includes('/patient') || rawPath.includes('/doctor')) {
          setRouteGuardNotice(
            'Role Guard: Examiner accounts operate in the read-only Examiner Portal.'
          );
          window.history.replaceState(null, '', '#/examiner');
        } else if (!rawHash.includes('examiner')) {
          window.history.replaceState(null, '', '#/examiner');
        }
      }
    };

    enforceRouteGuard();
    window.addEventListener('hashchange', enforceRouteGuard);
    window.addEventListener('popstate', enforceRouteGuard);
    return () => {
      window.removeEventListener('hashchange', enforceRouteGuard);
      window.removeEventListener('popstate', enforceRouteGuard);
    };
  }, [initializing, token, user]);

  const handleInstallPwaClick = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
    } else {
      setShowPwaGuide(true);
    }
  };

  return (
    <div>
      {/* Persistent Navy Blue Application Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              +
            </div>
            <div className="brand-titles">
              <h1>AAROGYASETU (आरोग्यसेतु)</h1>
              <div className="brand-tagline">“Healthcare Beyond Boundaries”</div>
              <div className="brand-institution-strip">
                <span className="inst-badge">Hackathon: AIORA</span>
                <span className="inst-badge">
                  Karavali Institute of Technology
                </span>
              </div>
            </div>
          </div>

          <div className="header-controls">
            {/* Online / Offline Status Pill */}
            <div
              className={`status-pill ${
                isEffectiveOnline ? 'status-online' : 'status-offline'
              }`}
              title="Current network connectivity status"
            >
              <span className="status-dot" />
              <span>
                {isEffectiveOnline
                  ? 'Status: Online'
                  : simulateOffline
                  ? 'Status: Offline (Simulated)'
                  : 'Status: Offline'}
              </span>
            </div>

            {/* Offline Simulation Toggle for Testing */}
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => setSimulateOffline((prev) => !prev)}
            >
              {simulateOffline
                ? 'Restore Online Mode'
                : 'Simulate Offline (Test)'}
            </button>

            {/* Installable PWA Button */}
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={handleInstallPwaClick}
            >
              Install App (PWA)
            </button>

            {user && (
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={handleSignOut}
              >
                Sign Out ({user.full_name})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Offline Warning Banner */}
      {!isEffectiveOnline && (
        <div className="offline-banner" role="status">
          Offline Mode Active — Only the static app shell is cached locally;
          sensitive patient profiles, messages, and medical reports are not
          cached offline. Sending messages or uploading reports while offline
          will show a Failed state that you can retry once reconnected.
        </div>
      )}

      {/* Prototype & Fictional Data Notice */}
      <div className="prototype-disclaimer-bar">
        Hackathon Prototype (Milestone 1) • Uses fictional demo data only • Not
        production-ready for real medical records.
      </div>

      {/* Main Content */}
      <main className="main-container">
        {routeGuardNotice && (
          <div
            className="alert alert-error"
            role="alert"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <span>{routeGuardNotice}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRouteGuardNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {initializing ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            Loading AAROGYASETU session...
          </div>
        ) : !token || !user ? (
          <AuthView
            onAuthenticated={handleAuthenticated}
            isEffectiveOnline={isEffectiveOnline}
          />
        ) : user.role === 'patient' ? (
          <PatientPortal
            token={token}
            user={user}
            onUserUpdated={setUser}
            isEffectiveOnline={isEffectiveOnline}
          />
        ) : user.role === 'doctor' ? (
          <DoctorPortal
            token={token}
            user={user}
            onUserUpdated={setUser}
            isEffectiveOnline={isEffectiveOnline}
          />
        ) : (
          <ExaminerPortal
            token={token}
            user={user}
            isEffectiveOnline={isEffectiveOnline}
          />
        )}
      </main>

      {/* PWA Installation Guide Modal */}
      {showPwaGuide && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPwaGuide(false)}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">
                Install AAROGYASETU (आरोग्यसेतु) as a Mobile or Desktop App
              </h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowPwaGuide(false)}
              >
                Close
              </button>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#334155' }}>
              <p>
                <strong>AAROGYASETU</strong> includes a Web App Manifest (
                <code>/manifest.json</code>), app icons, and a privacy-safe
                Service Worker (<code>/sw.js</code>) that caches only the static
                app shell.
              </p>
              <ul>
                <li>
                  <strong>Android (Chrome / Edge):</strong> Tap the browser menu
                  (⋮) and select <strong>“Add to Home screen”</strong> or{' '}
                  <strong>“Install app”</strong>.
                </li>
                <li>
                  <strong>iPhone / iPad (Safari):</strong> Tap the{' '}
                  <strong>Share</strong> button and choose{' '}
                  <strong>“Add to Home Screen”</strong>.
                </li>
                <li>
                  <strong>Desktop (Chrome / Edge):</strong> Click the{' '}
                  <strong>Install AAROGYASETU</strong> icon on the right side of
                  the address bar.
                </li>
              </ul>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Note: PWA installation prompts and capabilities vary by browser,
                operating system, and HTTPS/localhost context.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
