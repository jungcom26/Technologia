import React from "react";

export default function Topbar({ txState, stateLabel, onStart, onPauseResume, onStop }) {
  const dotColor = txState === "recording" ? "var(--success)"
                 : txState === "paused"    ? "var(--warning)"
                 : "#7e7a99";

  return (
    <header className="topbar">
      <nav className="nav">
        <button type="button" aria-current="page">Inventory</button>
        <button type="button">Quests</button>
        <button type="button">Characters</button>
      </nav>

      <div className="tx" aria-label="Transcription controls">
        <div className="status" aria-live="polite">
          <span className="dot" style={{ background: dotColor }} aria-hidden="true" />
          <span>{stateLabel}</span>
        </div>
        <div className="controls">
          <button title="Start (S)" onClick={onStart}>▶</button>
          <button title="Pause/Resume (P)" onClick={onPauseResume}>⏸</button>
          <button title="Stop (X)" onClick={onStop}>⏹</button>
        </div>
      </div>

      <div className="right">
        <span className="badge">Local Only</span>
      </div>
    </header>
  );
}
