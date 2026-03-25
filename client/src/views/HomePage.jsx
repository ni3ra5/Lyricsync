import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  const [qr, setQr] = useState(null);

  useEffect(() => {
    fetch('/api/homeqr')
      .then((r) => r.json())
      .then(setQr)
      .catch(() => {});
  }, []);

  return (
    <div className="home">
      {/* Animated background orbs */}
      <div className="home__bg">
        <div className="home__orb home__orb--1" />
        <div className="home__orb home__orb--2" />
        <div className="home__orb home__orb--3" />
      </div>

      <div className="home__content">
        <div className="home__logo-block">
          <h1 className="home__title">
            <span className="home__title-accent">Music</span>
            <span className="home__title-text">Sync</span>
          </h1>
          <p className="home__tagline">Synchronized lyrics for everyone in the room</p>
        </div>

        <div className="home__features">
          <div className="home__feature">
            <div className="home__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 19c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2zm12-3c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2z" />
              </svg>
            </div>
            <span className="home__feature-text">Search & play any song</span>
          </div>
          <div className="home__feature">
            <div className="home__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="home__feature-text">Real-time synced lyrics</span>
          </div>
          <div className="home__feature">
            <div className="home__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <span className="home__feature-text">Share via QR code</span>
          </div>
        </div>

        <button className="home__cta" onClick={() => navigate('/host')}>
          <span className="home__cta-glow" />
          <svg className="home__cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
          </svg>
          <span className="home__cta-label">Start a Session</span>
        </button>

        <p className="home__hint">You'll become the host — guests can join by scanning your QR code</p>
      </div>

      {/* Small QR code in corner to open on mobile */}
      {qr && (
        <div className="home__qr">
          <img className="home__qr-img" src={qr.qrDataUrl} alt="Scan to open on mobile" />
          <span className="home__qr-label">Open on mobile</span>
        </div>
      )}

      <footer className="home__footer">
        <span className="home__footer-text">MusicSync</span>
      </footer>
    </div>
  );
}
