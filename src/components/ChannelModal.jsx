import { useMemo, useState } from 'react';

const SHORTCUTS = [
  ['ARROWS', 'CHANNELS'],
  ['S / /', 'EXPLORE'],
  ['C', 'THEME'],
  ['O', 'OVERLAY'],
  ['F', 'FULLSCREEN'],
];

function themeLabel(theme) {
  return theme ? theme.replace('theme-', '').toUpperCase() : 'CLASSIC';
}

export default function ChannelModal({
  isOpen,
  onClose,
  onSelect,
  channels,
  settings,
  updateSetting,
  themes,
}) {
  const groups = useMemo(() => channels.reduce((acc, channel) => {
    const group = channel.group || 'CHANNELS';
    if (!acc[group]) acc[group] = [];
    acc[group].push(channel);
    return acc;
  }, {}), [channels]);

  const groupNames = Object.keys(groups);
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleGroup = groups[activeGroup] ? activeGroup : groupNames[0];
  const currentThemeIndex = Math.max(0, themes.indexOf(settings.theme));

  const cycleTheme = () => {
    updateSetting('theme', themes[(currentThemeIndex + 1) % themes.length]);
  };

  return (
    <div className={`search-modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="search-panel explore-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <div>
            <div className="search-title">EXPLORE</div>
            <div className="explore-subtitle">{visibleGroup}</div>
          </div>
          <button className="search-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="explore-groups">
          {groupNames.map((group) => (
            <button
              key={group}
              className={`explore-group-btn${group === visibleGroup ? ' active' : ''}`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="explore-channel-grid">
          {(groups[visibleGroup] || []).map((ch, index) => {
            const displayName = ch.name.replace(' (24/7)', '');
            return (
              <button
                key={ch.id}
                className="explore-channel-btn"
                onClick={() => onSelect(ch.id)}
              >
                <span className="explore-channel-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="explore-channel-copy">
                  <span className="explore-channel-name">{displayName}</span>
                  <span className="explore-channel-caption">{ch.caption || ch.group}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="explore-footer">
          <div className="shortcut-strip">
            {SHORTCUTS.map(([key, label]) => (
              <span key={key}><b>{key}</b> {label}</span>
            ))}
          </div>

          <button
            className={`explore-settings-toggle${settingsOpen ? ' active' : ''}`}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            TV SETTINGS
          </button>
        </div>

        {settingsOpen && (
          <div className="explore-settings">
            <label className="setting-row">
              <span>OVERLAY</span>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.02"
                value={settings.overlayOpacity}
                onChange={(event) => updateSetting('overlayOpacity', Number(event.target.value))}
              />
            </label>

            <div className="settings-grid compact">
              <button
                className={`setting-toggle${settings.scanlines ? ' active' : ''}`}
                onClick={() => updateSetting('scanlines', !settings.scanlines)}
              >
                SCANLINES
              </button>
              <button
                className={`setting-toggle${settings.vignette ? ' active' : ''}`}
                onClick={() => updateSetting('vignette', !settings.vignette)}
              >
                VIGNETTE
              </button>
              <button className="setting-toggle active" onClick={cycleTheme}>
                {themeLabel(settings.theme)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
