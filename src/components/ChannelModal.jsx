import { useMemo } from 'react';

export default function ChannelModal({
  isOpen,
  onClose,
  onSelect,
  channels
}) {
  // Group channels by category
  const groupedChannels = useMemo(() => {
    return channels.reduce((acc, ch) => {
      if (!acc[ch.group]) acc[ch.group] = [];
      acc[ch.group].push(ch);
      return acc;
    }, {});
  }, [channels]);

  if (!isOpen) return null;

  return (
    <div className={`search-modal open`} onClick={onClose}>
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

        {Object.entries(groupedChannels).map(([groupName, groupChannels]) => (
          <div key={groupName} style={{ marginBottom: '24px' }}>
            <div className="section-label">{groupName}</div>
            <div className="history-row">
              {groupChannels.map((ch) => (
                <button
                  key={ch.id}
                  className="history-btn"
                  onClick={() => onSelect(ch.id)}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                  <span style={{ color: '#fff', fontSize: '10px' }}>{ch.name.replace(' (24/7)', '')}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="help-section" style={{ marginTop: '20px' }}>
          <div className="help-text">
            Use <b>Arrow Keys</b> to flip through channels. <br />
            Press <b>Space</b> to mute/unmute. <br />
            Press <b>C</b> to cycle color themes. <br />
            Press <b>O</b> to toggle screen overlays. <br />
            Press <b>F</b> or the corner icon for fullscreen.
          </div>
        </div>
      </div>
    </div>
  );
}
