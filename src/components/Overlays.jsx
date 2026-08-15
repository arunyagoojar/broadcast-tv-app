export default function Overlays({
  canvasRef,
  scanlinesEnabled,
  vignetteEnabled,
  glitchRef,
  glitchActive,
  glitchBg,
  statusVisible,
  statusText,
  toastShow,
  toastMsg,
  audioUnlocked,
  updateAvailable,
  onApplyUpdate,
}) {
  return (
    <>
      <div className="crt-overlays">
        {/* Noise Canvas */}
        <canvas ref={canvasRef} className="noise-canvas" aria-hidden="true" />

        {/* Overlay layers */}
        {scanlinesEnabled && <div className="scanlines"></div>}
        {vignetteEnabled && <div className="vignette"></div>}
        <div
          ref={glitchRef}
          className={`glitch${glitchActive ? ' active' : ''}`}
          style={{ background: glitchBg }}
        ></div>

        {/* Status */}
        <div className={`status-layer${statusVisible ? ' visible' : ''}`} role="status" aria-live="polite">
          <span className="status-label">{statusText}</span>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastShow ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>

      {updateAvailable && (
        <div className="update-ready" role="status">
          <span>UPDATE READY</span>
          <button type="button" onClick={onApplyUpdate}>RESTART</button>
        </div>
      )}

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

    </>
  );
}
