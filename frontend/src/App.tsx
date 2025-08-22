import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const [txState, setTxState] = useState("idle");
  const [messages, setMessages] = useState([
    { avatar: "DM", meta: "19:01 • Scene", html: "The fog clings to the docks of Greywatch. Lanterns burn low as gulls cry overhead." },
    { avatar: "K", meta: "19:11 • Action", html: "Kyra examines the crates and whispers a quick detection spell." },
    { avatar: "T", meta: "19:18 • Dialogue", html: "Thorne: “If the fishers are missing, someone’s hiding tracks. Let’s split and ask around.”" },
    { avatar: "S", meta: "19:25 • System", html: "<em>Quest added:</em> Missing Fishermen — speak to the harbormaster." }
  ]);
  const logRef = useRef(null);

  const stateLabel = useMemo(() => {
    if (txState === "recording") return "Recording";
    if (txState === "paused") return "Paused";
    return "Idle";
  }, [txState]);

  const addLog = useCallback((meta, html) => {
    setMessages(prev => [
      ...prev,
      { avatar: "S", meta: `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • ${meta}`, html }
    ]);
  }, []);

  const start = useCallback(() => {
    if (txState === "idle" || txState === "paused") {
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

  useEffect(() => {
    const handler = e => {
      const k = e.key.toLowerCase();
      if (k === "s") start();
      if (k === "p") pauseResume();
      if (k === "x") stop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [start, pauseResume, stop]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  return (
    <div>
      <style>{css}</style>
      <header className="topbar" role="banner">
        <div className="topbar-inner">
          <div className="brand" aria-label="App brand">
            <span className="gem">◆</span>
            <span>Dungeon Scribe AI</span>
          </div>
          <nav className="main" aria-label="Primary">
            <button type="button" aria-current="page">Inventory</button>
            <button type="button">Quests</button>
            <button type="button">Characters</button>
          </nav>
          <section className="tx" role="region" aria-label="Transcription controls">
            <div className="status" aria-live="polite">
              <span className="dot" style={{ background: dotColor(txState) }} aria-hidden="true" />
              <span>{stateLabel}</span>
            </div>
            <div className="controls">
              <button title="Start recording (S)" aria-pressed={txState === "recording"} onClick={start}>▶</button>
              <button title="Pause/Resume (P)" disabled={txState === "idle"} onClick={pauseResume}>⏸</button>
              <button title="Stop recording (X)" disabled={txState === "idle"} onClick={stop}>⏹</button>
            </div>
          </section>
        </div>
      </header>

      <main className="viewport">
        <div className="grid">
          <section className="left">
            <aside className="timeline" aria-label="Session timeline">
              <h2>Timeline</h2>
              <div className="t-scroll">
                <article className="t-item"><time>19:02</time><div><span className="badge">Scene</span> Party enters Greywatch</div></article>
                <article className="t-item"><time>19:11</time><div><span className="badge">Event</span> Detect Magic at docks</div></article>
                <article className="t-item"><time>19:25</time><div><span className="badge">Quest</span> Missing Fishermen</div></article>
                <article className="t-item"><time>19:33</time><div><span className="badge">Clue</span> Torn net with black algae</div></article>
                <article className="t-item"><time>19:48</time><div><span className="badge">Consequence</span> Guard suspicion rises</div></article>
              </div>
            </aside>

            <section className="quick" aria-label="Quick stats">
              <h2>Quick Stats</h2>
              <div className="qs">
                <div className="q"><span>Open Threads</span><strong>3</strong></div>
                <div className="q"><span>Last Major Event</span><strong>Duke's Betrayal</strong></div>
                <div className="q"><span>Current Location</span><strong>Greywatch</strong></div>
                <div className="q"><span>Weather</span><strong>Fog</strong></div>
                <div className="q"><span>Time</span><strong>Nightfall</strong></div>
              </div>
            </section>

            <section className="log" aria-label="Conversation log">
              <div className="log-toolbar">
                <input type="search" placeholder="Search actions, rolls, or dialogue…" aria-label="Search log" />
                <button title="Filter">Filter</button>
                <button title="Export">Export</button>
              </div>
              <div className="messages" ref={logRef}>
                {messages.map((m, i) => (
                  <div className="msg" key={i}>
                    <div className="avatar">{m.avatar}</div>
                    <div className="bubble">
                      <div className="meta">{m.meta}</div>
                      <div dangerouslySetInnerHTML={{ __html: m.html }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="map" aria-label="World map">
            <h3 className="map-title">🗺️ Map</h3>
            <div className="map-viewport">
              <svg className="map-svg" viewBox="0 0 800 600" role="img" aria-label="Fantasy map with islands and pins">
                <defs>
                  <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1e1531" /><stop offset="100%" stopColor="#120c21" /></linearGradient>
                  <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b2e55" /><stop offset="100%" stopColor="#2c2243" /></linearGradient>
                </defs>
                <rect x="0" y="0" width="800" height="600" fill="url(#water)" />
                <path d="M130,260 C100,200 190,190 240,210 C290,230 320,270 280,310 C240,350 170,340 130,300 Z" fill="url(#land)" stroke="#6c5fa3" strokeOpacity=".5" />
                <path d="M420,170 C380,130 520,120 560,170 C600,220 590,260 540,280 C490,300 460,230 420,170 Z" fill="url(#land)" stroke="#6c5fa3" strokeOpacity=".5" />
                <path d="M520,360 C480,330 610,330 650,380 C690,430 640,470 590,470 C540,470 560,400 520,360 Z" fill="url(#land)" stroke="#6c5fa3" strokeOpacity=".5" />
                <g><circle cx="250" cy="260" r="6" fill="#7a4df1" /><text x="260" y="255" fill="#eae0ff" fontSize="12">Greywatch</text></g>
                <g><circle cx="560" cy="200" r="6" fill="#7a4df1" /><text x="570" y="195" fill="#eae0ff" fontSize="12">Whisper Reefs</text></g>
                <g><circle cx="600" cy="420" r="6" fill="#7a4df1" /><text x="610" y="415" fill="#eae0ff" fontSize="12">Old Lighthouse</text></g>
              </svg>
            </div>
            <div className="legend"><span className="pin"></span> Points of Interest</div>
          </aside>
        </div>
      </main>

      <footer className="dock" aria-label="Character dock">
        <div className="dock-row">
          {cards.map(c => (
            <Card key={c.id} data={c} />
          ))}
        </div>
      </footer>
    </div>
  );
}

function Card({ data }) {
  return (
    <article className="c-card" tabIndex={0} aria-label={`Character ${data.name}`}>
      <div className="c-head">
        <div className="c-token">{data.token}</div>
        <div className="c-main">
          <div className="c-line"><strong>{data.name}</strong><span className="pill">AC {data.ac}</span><span className="pill">HP {data.hp}</span><span className="pill">Temp {data.temp}</span></div>
        </div>
      </div>
      <div className="c-details">
        <div className="c-grid">
          <div><span className="dt">Race</span><span className="dd">{data.race}</span></div>
          <div><span className="dt">Class</span><span className="dd">{data.class_}</span></div>
          <div><span className="dt">STR</span><span className="dd">{data.attrs.STR}</span></div>
          <div><span className="dt">DEX</span><span className="dd">{data.attrs.DEX}</span></div>
          <div><span className="dt">CON</span><span className="dd">{data.attrs.CON}</span></div>
          <div><span className="dt">INT</span><span className="dd">{data.attrs.INT}</span></div>
          <div><span className="dt">WIS</span><span className="dd">{data.attrs.WIS}</span></div>
          <div><span className="dt">CHA</span><span className="dd">{data.attrs.CHA}</span></div>
        </div>
        <p className="c-desc">{data.desc}</p>
        <div className="c-actions"><button>Action 1</button><button>Action 2</button></div>
      </div>
    </article>
  );
}

const cards = [
  { id: 1, token: "K", name: "Kyra", ac: 12, hp: 10, temp: 2, race: "Half-elf", class_: "Warlock L1", attrs: { STR: 8, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 16 }, desc: "A pact-bound seeker whose whispers pull at unseen threads." },
  { id: 2, token: "T", name: "Thorne", ac: 14, hp: 9, temp: 0, race: "Human", class_: "Rogue L1", attrs: { STR: 10, DEX: 16, CON: 12, INT: 12, WIS: 10, CHA: 10 }, desc: "A streetwise scout with a talent for vanishing." },
  { id: 3, token: "S", name: "Seren", ac: 18, hp: 11, temp: 3, race: "Dwarf", class_: "Cleric L1", attrs: { STR: 14, DEX: 10, CON: 16, INT: 10, WIS: 16, CHA: 12 }, desc: "A steadfast healer bearing a quiet conviction." },
  { id: 4, token: "M", name: "Mira", ac: 13, hp: 8, temp: 0, race: "Gnome", class_: "Wizard L1", attrs: { STR: 8, DEX: 14, CON: 10, INT: 16, WIS: 12, CHA: 12 }, desc: "An inquisitive mage fascinated by hidden mechanisms." }
];

const dotColor = state => {
  const styles = getComputedStyle(document.documentElement);
  if (state === "recording") return styles.getPropertyValue("--success");
  if (state === "paused") return styles.getPropertyValue("--warning");
  return "#6c6c6c";
};

const css = `:root{--bg:#0f0d13;--panel:#17131e;--panel-alt:#1e1828;--text:#f4effa;--muted:#bdb3ce;--accent:#7a4df1;--accent-2:#a071f6;--success:#20c997;--warning:#f59f00;--danger:#ff6b6b;--border:rgba(255,255,255,.08);--shadow:0 6px 24px rgba(0,0,0,.4);--radius:16px;--radius-sm:12px;--gap:16px}*{box-sizing:border-box}html,body{height:100%}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";background:radial-gradient(1200px 800px at 20% -10%,#221a35 0%,#0f0d13 45%) fixed;color:var(--text);overflow:hidden}button{background:var(--panel-alt);border:1px solid var(--border);color:var(--text);padding:.5rem .75rem;border-radius:12px;cursor:pointer;box-shadow:var(--shadow)}button[disabled]{opacity:.6;cursor:not-allowed}button:hover:not([disabled]){transform:translateY(-1px)}header.topbar{position:relative;z-index:5;background:linear-gradient(180deg,rgba(17,15,23,.9),rgba(17,15,23,.7));border-bottom:1px solid var(--border)}.topbar-inner{max-width:1400px;margin:0 auto;padding:.6rem 1rem;display:flex;align-items:center;gap:16px;justify-content:space-between}.brand{display:flex;align-items:center;gap:.6rem;font-weight:700;letter-spacing:.3px}.gem{width:28px;height:28px;display:inline-grid;place-items:center;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 6px 20px rgba(122,77,241,.35),inset 0 0 24px rgba(255,255,255,.18);font-size:.95rem}nav.main{display:flex;align-items:center;gap:10px}nav.main button{padding:.45rem .75rem;border-radius:10px}nav.main button:hover{background:var(--panel-alt)}.tx{display:flex;align-items:center;gap:.75rem;background:var(--panel);padding:.5rem .75rem;border-radius:12px;border:1px solid var(--border);box-shadow:var(--shadow)}.tx .status{display:flex;align-items:center;gap:.5rem;padding:.35rem .6rem;border-radius:999px;border:1px solid var(--border);background:var(--panel-alt);font-size:.9rem;color:var(--muted)}.tx .dot{inline-size:.65rem;block-size:.65rem;border-radius:50%;background:#6c6c6c;box-shadow:0 0 0 2px rgba(255,255,255,.06) inset}.tx .controls{display:flex;gap:.4rem}.tx .controls button{min-width:2.4rem}main.viewport{height:calc(100vh - 64px);display:grid;place-items:stretch}.grid{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:60% 40%;grid-template-rows:1fr;gap:16px;padding:16px;height:100%}.left{display:grid;grid-template-columns:220px 1fr 1.2fr;grid-template-rows:1fr;gap:16px;height:100%}.timeline,.quick,.log,.map{background:linear-gradient(180deg,var(--panel),#120e18);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);display:flex;flex-direction:column;min-height:0}.timeline h2,.quick h2{margin:0;padding:.6rem .8rem;font-size:.95rem;color:var(--muted);border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(122,77,241,.12),transparent)}.timeline{overflow:hidden}.t-scroll{padding:.6rem .6rem 1rem .6rem;overflow:auto}.t-item{display:grid;grid-template-columns:54px 1fr;gap:.4rem;align-items:start;margin:.4rem 0;padding:.45rem;border:1px solid var(--border);border-radius:12px;background:var(--panel-alt)}.t-item time{color:var(--muted);font-size:.8rem}.badge{display:inline-block;padding:.05rem .45rem;border-radius:999px;font-size:.72rem;border:1px solid var(--border);background:rgba(122,77,241,.2);color:#e6dcff}.quick{padding-bottom:.6rem}.qs{display:grid;grid-template-columns:1fr;gap:.6rem;padding:.6rem}.q{display:flex;align-items:center;justify-content:space-between;background:var(--panel-alt);border:1px solid var(--border);border-radius:12px;padding:.5rem .6rem}.q span{color:var(--muted);font-size:.85rem}.q strong{font-size:.95rem}.log .log-toolbar{display:flex;gap:.5rem;align-items:center;padding:.6rem;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(122,77,241,.12),transparent)}.log .log-toolbar input{flex:1;padding:.5rem .7rem;border-radius:10px;background:#0f0b15;color:var(--text);border:1px solid var(--border)}.messages{padding:.6rem;display:grid;gap:.6rem;overflow:auto}.msg{display:grid;grid-template-columns:42px 1fr;gap:.6rem;align-items:start}.avatar{inline-size:42px;block-size:42px;border-radius:12px;display:grid;place-items:center;font-weight:700;background:linear-gradient(135deg,#2c2640,#362c52);border:1px solid var(--border)}.bubble{background:var(--panel-alt);border:1px solid var(--border);border-radius:12px;padding:.5rem .6rem}.meta{font-size:.78rem;color:var(--muted);margin-bottom:.1rem}.map{display:flex;flex-direction:column}.map-title{display:flex;align-items:center;gap:.5rem;margin:0;padding:.6rem .8rem;font-size:1rem;color:var(--muted);border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(122,77,241,.12),transparent)}.map-viewport{flex:1;min-height:0;background:radial-gradient(800px 500px at 60% 30%,#231b37,#151021);border-top:1px solid var(--border);display:flex}.map-svg{width:100%;height:100%}.legend{display:flex;gap:.5rem;padding:.5rem .8rem;align-items:center;border-top:1px solid var(--border);color:var(--muted)}.pin{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px rgba(122,77,241,.35)}footer.dock{position:fixed;left:0;right:0;bottom:0;height:42vh;pointer-events:none;display:flex;align-items:flex-end;justify-content:center}.dock-row{max-width:1400px;width:100%;display:flex;gap:16px;justify-content:center;transform:translateY(28vh);padding:0 16px 16px}.c-card{pointer-events:auto;width:280px;background:linear-gradient(180deg,var(--panel),#120e18);border:1px solid var(--border);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);transform:translateZ(0);transition:transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s, filter .28s;overflow:hidden;backdrop-filter:saturate(1.1)}.c-card:focus,.c-card:hover{transform:translateY(-28vh) scale(1.03);box-shadow:0 30px 80px rgba(0,0,0,.6);z-index:10}.c-head{display:flex;align-items:center;gap:.6rem;padding:.6rem .75rem;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(122,77,241,.14),transparent)}.c-token{inline-size:44px;block-size:44px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:radial-gradient(circle at 30% 25%,#3b2b5f,#201734);border:2px solid rgba(255,255,255,.12)}.pill{display:inline-block;padding:.15rem .45rem;border-radius:999px;border:1px solid var(--border);font-size:.72rem;color:var(--muted);margin-left:.35rem}.c-details{max-height:0;opacity:0;transition:max-height .35s ease, opacity .25s ease .05s;padding:0 .8rem}.c-card:hover .c-details,.c-card:focus .c-details{max-height:320px;opacity:1}.c-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem .6rem;margin:.75rem 0}.dt{display:block;color:var(--muted);font-size:.72rem}.dd{display:block}.c-desc{margin:.25rem 0 .6rem;color:#e5dcffbd}.c-actions{display:flex;gap:.5rem;padding-bottom:.8rem}.c-actions button{padding:.45rem .65rem}`;
