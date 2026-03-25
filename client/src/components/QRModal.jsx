import { useState } from 'react';

export default function QRModal({ qrDataUrl, joinUrl, guestCount }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Small trigger */}
      <button className="qr-trigger" onClick={() => setOpen(true)}>
        {qrDataUrl && <img src={qrDataUrl} alt="QR" className="qr-trigger__img" />}
        <span className="qr-trigger__info">
          <span className="qr-trigger__label">Scan to join</span>
          <span className="qr-trigger__guests">{guestCount} guest{guestCount !== 1 ? 's' : ''}</span>
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="qr-overlay" onClick={() => setOpen(false)}>
          <div className="qr-modal card" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal__close" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="qr-modal__content">
              {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="qr-modal__img" />}
              <p className="qr-modal__title">Scan to join</p>
              <p className="qr-modal__url">{joinUrl}</p>
              <p className="qr-modal__guests">{guestCount} guest{guestCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
