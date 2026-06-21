import { useMemo } from 'react';

export default function ChannelModal({
  isOpen,
  onClose,
  onSelect,
  channels
}) {
  return (
    <div className={`search-modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div
        className="search-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="search-header">
          <div className="search-title">CHANNELS</div>
          <button
            className="search-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="search-divider" style={{ marginBottom: '16px' }}></div>

        <div className="history-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {channels.map((ch) => {
            const isStream = ch.type === 'stream';
            // Only remove " (24/7)" if it's NOT a stream, to preserve names if needed, 
            // but per user request earlier: "remove the (24/7)" we can just do it.
            const displayName = isStream ? ch.name : ch.name.replace(' (24/7)', '');

            return (
              <button
                key={ch.id}
                className="history-btn"
                onClick={() => onSelect(ch.id)}
                style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
              >
                <span style={{ color: '#fff', fontSize: '10px' }}>
                  {displayName}
                  {isStream && <span style={{ color: '#0f0', marginLeft: '4px' }}>[LIVE]</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="help-section" style={{ marginTop: '20px' }}>
          <div className="help-text" style={{ fontSize: '10px', lineHeight: '1.6', textAlign: 'center' }}>
            <b>Arrows</b> to switch channels &nbsp;|&nbsp; <b>C</b> for themes &nbsp;|&nbsp; <b>O</b> to toggle scanlines/vignette &nbsp;|&nbsp; <b>F</b> for fullscreen
          </div>
        </div>
      </div>
    </div>
  );
}
