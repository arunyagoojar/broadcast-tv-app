export default function Overlays({
  canvasRef,
  overlayEnabled,
  scanlinesEnabled,
  vignetteEnabled,
  glitchRef,
  glitchActive,
  glitchBg,
  statusVisible,
  statusText,
  networkActive,
  networkFadeOut,
  currentTitle,
  playbackTimeStr,
  toastShow,
  toastMsg,
  togglePower,
  audioUnlocked,
}) {
  return (
    <>
      {/* Noise Canvas */}
      <canvas ref={canvasRef} className="noise-canvas" />

      {/* Overlay layers */}
      {scanlinesEnabled && <div className="scanlines"></div>}
      {vignetteEnabled && <div className="vignette"></div>}
      <div
        ref={glitchRef}
        className={`glitch${glitchActive ? ' active' : ''}`}
        style={{ background: glitchBg }}
      ></div>

      {/* Status */}
      <div className={`status-layer${statusVisible ? ' visible' : ''}`}>
        <span className="status-label">{statusText}</span>
      </div>

      {/* Network Overlay */}
      <div
        className={`network-overlay${overlayEnabled && networkActive ? ' active' : ''}${networkFadeOut ? ' fade-out' : ''}`}
      >
        <div className="network-name" style={{ fontSize: '11px', letterSpacing: '1px' }}>{currentTitle}</div>
        <div className="network-time" style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>
          {playbackTimeStr}
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>

      {!audioUnlocked && (
        <div className="unmute-hint">
          CLICK VIDEO TO UNMUTE
        </div>
      )}

      {/* Landscape enforcer */}
      <div className="landscape-enforcer">
        PLEASE ROTATE DEVICE TO LANDSCAPE
        <br />
        <br />
        TO VIEW TRANSMISSION
      </div>

      {/* Power button */}
      <div className="power-btn-wrap">
        <button className="power-btn" aria-label="Power" onClick={togglePower}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
          </svg>
        </button>
      </div>
    </>
  );
}
