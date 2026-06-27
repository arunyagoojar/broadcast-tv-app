import { useEffect, useRef, useState } from 'react';

export default function HUD({
  hudFadeOut,
  channelLabel,
  openChannelModal,
  switchToNext,
  switchToPrev,
  toggleFullscreen,
  refreshVideo,
}) {
  const channelWrapRef = useRef(null);
  const channelTextRef = useRef(null);
  const [marquee, setMarquee] = useState({
    active: false,
    exit: '0px',
    enter: '0px',
  });

  useEffect(() => {
    const wrap = channelWrapRef.current;
    const text = channelTextRef.current;
    if (!wrap || !text) return undefined;

    const measure = () => {
      const wrapWidth = wrap.clientWidth;
      const textWidth = text.scrollWidth;
      const active = textWidth > wrapWidth + 2;
      setMarquee({
        active,
        exit: `${textWidth}px`,
        enter: `${wrapWidth}px`,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    observer.observe(text);
    return () => observer.disconnect();
  }, [channelLabel]);

  return (
    <div className={`hud${hudFadeOut ? ' fade-out' : ''}`}>
      <button
        className="hud-btn"
        aria-label="Channel List"
        onClick={openChannelModal}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </button>

      <div className="hud-spacer"></div>
      <div className="hud-ch-container" ref={channelWrapRef}>
        <span
          ref={channelTextRef}
          className={`hud-ch${marquee.active ? ' marquee' : ''}`}
          style={{
            '--marquee-exit': marquee.exit,
            '--marquee-enter': marquee.enter,
          }}
        >
          {channelLabel}
        </span>
      </div>
      <div className="hud-spacer"></div>
      <button className="hud-btn" style={{ marginLeft: '12px' }} aria-label="Refresh Video" onClick={refreshVideo}>
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
  );
}
