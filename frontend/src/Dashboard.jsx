import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import "./Dashboard.css";
import Topbar from "./components/Topbar";
import TimelinePanel from "./components/TimelinePanel";
import StatsPanel from "./components/StatsPanel";
import LogPanel from "./components/LogPanel";
import MapPanel from "./components/MapPanel";
import CharacterDock from "./components/CharacterDock";

export default function Dashboard() {
  const [txState, setTxState] = useState("idle");
  const [messages, setMessages] = useState([
    { avatar: "DM", meta: "19:01 • Scene", html: "The fog clings to the docks of Greywatch." },
    { avatar: "K", meta: "19:11 • Action", html: "Kyra examines the crates and whispers a quick detection spell." },
    { avatar: "T", meta: "19:18 • Dialogue", html: "Thorne: “If the fishers are missing, someone’s hiding tracks.”" },
    { avatar: "S", meta: "19:25 • System", html: "<em>Quest added:</em> Missing Fishermen — speak to the harbormaster." }
  ]);

  const logRef = useRef(null);
  const stateLabel = useMemo(() => (
    txState === "recording" ? "Recording" : txState === "paused" ? "Paused" : "Idle"
  ), [txState]);

  const addLog = useCallback((meta, html) => {
    setMessages(prev => [
      ...prev,
      {
        avatar: "S",
        meta: `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • ${meta}`,
        html,
      }
    ]);
  }, []);

  const start = useCallback(() => {
    if (txState !== "recording") {
      setTxState("recording");
      addLog("System", "<em>Transcription started.</em>");
    }
  }, [txState, addLog]);

  const pauseResume = useCallback(() => {
    if (txState === "recording") {
      setTxState("paused");
      addLog("System", "<em>Transcription paused.</em>");
    } else if (txState === "paused") {
      setTxState("recording");
      addLog("System", "<em>Transcription resumed.</em>");
    }
  }, [txState, addLog]);

  const stop = useCallback(() => {
    if (txState !== "idle") {
      setTxState("idle");
      addLog("System", "<em>Transcription stopped.</em>");
    }
  }, [txState, addLog]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const k = e.key.toLowerCase();
      if (k === "s") start();
      if (k === "p") pauseResume();
      if (k === "x") stop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [start, pauseResume, stop]);

  // autoscroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="dashboard">
      <Topbar
        txState={txState}
        stateLabel={stateLabel}
        onStart={start}
        onPauseResume={pauseResume}
        onStop={stop}
      />

      <main className="main">
        {/* LEFT 60%: 3 columns */}
        <aside className="left">
          <TimelinePanel />
          <StatsPanel />
          <LogPanel messages={messages} logRef={logRef} />
        </aside>

        {/* RIGHT 40% */}
        <MapPanel />
      </main>

      <CharacterDock />
    </div>
  );
}
