import React, { useMemo } from "react";

/** Generate a bunch of demo rows so the panel definitely scrolls */
function makeDummyMessages() {
  const names = ["K", "T", "DM", "S", "M", "R"];
  const lines = [
    "The fog clings to the docks of Greywatch.",
    "Thorne: “If the fishers are missing, someone’s hiding tracks. Let’s split and ask around.”",
    "Kyra examines the crates and whispers a quick detection spell.",
    "System: <em>Quest added</em> — Missing Fishermen.",
    "Mira: “I’ll check the lighthouse records.”",
    "DM: The harbormaster shuffles papers, avoiding eye contact.",
    "Seren prays softly; a faint glow answers.",
    "A gull shrieks, then… silence.",
    "Long line test: The net is torn—frayed threads, brine-soaked hemp, barnacles clinging—evidence piled atop rumor until truth bends.",
    // brutal long-token test to prove wrapping works:
    "UnbrokenStringTest: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  ];
  const arr = [];
  for (let i = 0; i < 120; i++) {
    const avatar = names[i % names.length];
    const text = lines[i % lines.length];
    const mm = String(1 + (i % 59)).padStart(2, "0");
    arr.push({
      avatar,
      meta: `19:${mm} • ${avatar === "DM" ? "Scene" : avatar === "S" ? "System" : "Dialogue"}`,
      html: text,
    });
  }
  return arr;
}

export default function LogPanel({ messages, logRef }) {
  const roleOf = (avatar) => {
    if (avatar === "DM") return "right";   // DM bubbles on the right
    if (avatar === "S")  return "system";  // system centered
    return "left";                          // players left
  };

  // Combine real messages with dummy ones so you get a scrollbar
  const rows = useMemo(() => {
    const dummies = makeDummyMessages();
    return [...messages, ...dummies];
  }, [messages]);

  return (
    <section className="panel log" aria-label="Conversation log">
      <h2>Session Log</h2>

      <div className="toolbar">
        <input type="search" placeholder="Search actions, rolls, or dialogue…" aria-label="Search log" />
        <button title="Filter">Filter</button>
        <button title="Export">Export</button>
      </div>

      {/* SCROLL CONTAINER */}
      <div className="panel-body messages" ref={logRef}>
        {rows.map((m, i) => {
          const role = roleOf(m.avatar);

          if (role === "system") {
            return (
              <div className="msg system" key={i} role="note" aria-label="system message">
                <div className="sys-bubble">
                  <div className="meta">{m.meta}</div>
                  <div className="sys-body" dangerouslySetInnerHTML={{ __html: m.html }} />
                </div>
              </div>
            );
          }

          return (
            <div className={`msg ${role}`} key={i}>
              {/* Avatar */}
              <div className="avatar">{m.avatar}</div>

              {/* Bubble */}
              <div className={`bubble ${role}`}>
                <div className={`meta ${role}`}>{m.meta}</div>
                <div className="bubble-text" dangerouslySetInnerHTML={{ __html: m.html }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
