import { useEffect, useState } from 'react';

function UpNextCard({ nextUp }) {
  return (
    <div className="hud-next-up">
      <div className="hud-next-up-copy">
        <span>UP NEXT</span>
        <strong>{nextUp.epTitle?.replace(/^[-]\s*/, '') || nextUp.title}</strong>
      </div>
    </div>
  );
}

function UpNextNotice({ nextUp }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer;
    const reveal = () => {
      setVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), 10_000);
    };
    const revealInterval = window.setInterval(reveal, 10 * 60 * 1000);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearInterval(revealInterval);
    };
  }, []);

  if (!visible) return null;
  return <UpNextCard nextUp={nextUp} />;
}

export default function HUD({
  hudFadeOut,
  showTitle,
  epTitle,
  logoUrl,
  nextUp,
  upNextMode,
  switchToNext,
  switchToPrev,
  toggleFullscreen,
  refreshVideo,
  leftMenuOpen,
  toggleLeftMenu,
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState(null);

  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <>
      <div className={`hud${hudFadeOut ? ' fade-out' : ''}`}>
      {/* LEFT COMPONENT */}
      <div className={`hud-left${leftMenuOpen ? ' shifted' : ''}`}>
        <button
          className={`hud-btn hud-btn-menu-toggle ${leftMenuOpen ? 'active' : ''}`}
          aria-label="Toggle Left Menu"
          onClick={toggleLeftMenu}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: leftMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms ease' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="hud-ch-container">
          <span
            key={showTitle}
            className="channel-name hud-title-fallback"
            style={{ 
              fontWeight: 'bold', 
              color: '#fff', 
              whiteSpace: 'nowrap',
              textOverflow: 'clip',
              overflow: 'visible',
            }}
          >
            {!showLogo && showTitle}
          </span>
          {showLogo && (
            <img 
              key={logoUrl}
              src={logoUrl} 
              alt={showTitle} 
              className="hud-logo"
              fetchPriority="high"
              decoding="async"
              onError={() => setFailedLogoUrl(logoUrl)}
            />
          )}
          {epTitle && (
            <span
              key={epTitle}
              className="channel-name"
              style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)',
                textOverflow: 'clip',
                overflow: 'visible',
                opacity: 0.75,
                fontSize: '0.9em',
                fontWeight: 300,
              }}
            >
              {epTitle.replace(/^-\s*/, '')}
            </span>
          )}
        </div>
      </div>

      {/* RIGHT COMPONENT */}
      <div className="hud-right-stack">
        {nextUp && upNextMode === 'with-hud' && <UpNextCard key={nextUp.id} nextUp={nextUp} />}
        <div className="hud-right">
        <button className="hud-btn" aria-label="Refresh Video" onClick={refreshVideo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>

        <div className="nav-arrows">
          <button
            className="hud-btn"
            aria-label="Previous channel"
            onClick={switchToPrev}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className="hud-btn"
            aria-label="Next channel"
            onClick={switchToNext}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <button
          className="hud-btn"
          aria-label="Fullscreen"
          onClick={toggleFullscreen}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        </div>
      </div>

      </div>
      {nextUp && upNextMode !== 'with-hud' && (
        <div className="hud-next-up-occasional">
          <UpNextNotice key={nextUp.id} nextUp={nextUp} />
        </div>
      )}
    </>
  );
}
