import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Register the privacy-preserving Service Worker (caches static app shell only)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker registration is optional in unsupported environments
    });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
