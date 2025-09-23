/* =========================================================
   TL2 – Interactive Timeline (UI-only)
   - Injects full UI into #timeline-upgraded
   - Chips for kind filter, search box, zoom slider, inspector
   - No backend calls; expose TL2.setData(...) for real data
   ========================================================= */

// ------- Config / Lanes -------
const TL2_LANES = [
  { key: "dialogue", x: 0 },
  { key: "action", x: 1 },
  { key: "roll", x: 2 },
  { key: "quest_update", x: 3 },
  { key: "world_state", x: 4 },
];
const TL2_LANE_WIDTH = 120; // match CSS --tl2-lane-width
const TL2_LANE_GAP = 18;

// ------- State -------
let TL2_ALL = [];
let TL2_KIND = "all";
let TL2_QUERY = "";
let TL2_ZOOM = 1;

// ------- Public API (attach to window) -------
window.TL2 = {
  build: initTL2,
  setData(items) {
    TL2_ALL = Array.isArray(items) ? items.slice() : [];
    renderTL2();
  },
};

// ------- Boot when DOM ready -------
if (document.readyState !== "loading") initTL2();
else document.addEventListener("DOMContentLoaded", initTL2);

// ------- Init: inject UI into container -------
function initTL2() {
  const host = document.getElementById("timeline-upgraded");
  if (!host) {
    console.warn("[TL2] #timeline-upgraded not found");
    return;
  }

  host.innerHTML = `
    <section class="tl2-shell">
      <aside class="tl2-panel">
        <h3 class="tl2-title">Timeline</h3>

        <div class="tl2-controls">
          <input id="tl2-q" class="tl2-search" placeholder="Search text, tags, characters…">
          <div class="tl2-chips">
            ${[
              "all",
              "dialogue",
              "action",
              "roll",
              "quest_update",
              "world_state",
            ]
              .map(
                (k, i) =>
                  `<button class="tl2-chip ${
                    i === 0 ? "is-on" : ""
                  }" data-kind="${k}">${tl2Label(k)}</button>`
              )
              .join("")}
          </div>
          <label class="tl2-zoom">
            <span>Zoom</span>
            <input id="tl2-zoom" type="range" min="0.4" max="2.0" step="0.05" value="1">
          </label>
        </div>

        <div id="tl2-inspector" class="tl2-card tl2-empty">
          Select an event on the timeline.
        </div>
      </aside>

      <main class="tl2-view" aria-label="Interactive timeline">
        <div class="tl2-stripe" aria-hidden="true"></div>
        <div id="tl2-rail" class="tl2-rail"></div>
      </main>
    </section>
  `;

  // Wire controls
  host.querySelectorAll(".tl2-chip").forEach((b) => {
    b.addEventListener("click", () => {
      host
        .querySelectorAll(".tl2-chip")
        .forEach((x) => x.classList.remove("is-on"));
      b.classList.add("is-on");
      TL2_KIND = b.dataset.kind;
      renderTL2();
    });
  });
  host.querySelector("#tl2-q")?.addEventListener("input", (e) => {
    TL2_QUERY = e.target.value;
    renderTL2();
  });
  host.querySelector("#tl2-zoom")?.addEventListener("input", (e) => {
    TL2_ZOOM = parseFloat(e.target.value);
    renderTL2();
  });

  // Wheel zoom with Cmd/Ctrl + scroll
  host.querySelector(".tl2-view")?.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        TL2_ZOOM = tl2Clamp(TL2_ZOOM + (e.deltaY > 0 ? -0.06 : 0.06), 0.4, 2);
        host.querySelector("#tl2-zoom").value = TL2_ZOOM;
        renderTL2();
      }
    },
    { passive: false }
  );

  // Mock data (remove when wiring real data)
  window.TL2.setData([
    {
      id: "e1",
      t: "2025-09-16T17:08:00Z",
      kind: "dialogue",
      title: "Transcription started",
      text: "System initialized",
      session_id: "S-001",
    },
    {
      id: "e2",
      t: "2025-09-16T17:10:00Z",
      kind: "action",
      title: "Sereth dashes",
      text: "Vaults the stall",
      character_ids: ["c_sereth"],
    },
    {
      id: "e3",
      t: "2025-09-16T17:11:00Z",
      kind: "roll",
      title: "Dex (Acrobatics) 17",
      text: "Success",
      tags: ["roll"],
    },
    {
      id: "e4",
      t: "2025-09-16T17:12:30Z",
      kind: "quest_update",
      title: "Ledger: red seal clue",
      quest_ids: ["q_ledger"],
    },
    {
      id: "e5",
      t: "2025-09-16T17:13:10Z",
      kind: "world_state",
      title: "Guards increase patrols",
      location_id: "loc_oak_inn",
    },
  ]);
}

// ------- Render -------
function renderTL2() {
  const rail = document.getElementById("tl2-rail");
  const stripe = document.querySelector(".tl2-stripe");
  const insp = document.getElementById("tl2-inspector");
  if (!rail) return;

  const items = tl2Filter(TL2_ALL).sort(
    (a, b) => new Date(a.t) - new Date(b.t)
  );
  if (items.length === 0) {
    rail.innerHTML = "";
    if (stripe) stripe.style.background = "rgba(255,255,255,.06)";
    if (insp) {
      insp.classList.add("tl2-empty");
      insp.textContent = "No results.";
    }
    return;
  }

  // Compute Y scale
  const railH = Math.max(800, Math.round(1100 * TL2_ZOOM));
  rail.style.height = railH + "px";
  const yScale = tl2ScaleY(tl2Extent(items), railH - 40);

  // Minimap stripe gradient
  if (stripe) {
    const grad = items
      .map((e) => {
        const y = (yScale(e.t) / railH) * 100;
        return `${tl2ColorByKind(e.kind)} ${y}%`;
      })
      .join(", ");
    stripe.style.background = `linear-gradient(${grad})`;
  }

  // Nodes
  rail.innerHTML = "";
  for (const ev of items) {
    const node = document.createElement("article");
    node.className = "tl2-node";
    node.dataset.kind = ev.kind;
    node.dataset.id = ev.id;
    node.style.top = yScale(ev.t) + "px";
    node.style.setProperty("--x", tl2LaneX(ev.kind) + "px");
    node.innerHTML = `
      <div class="ttl">${tl2Escape(ev.title || ev.kind)}</div>
      <div class="meta">${new Date(ev.t).toLocaleString()}</div>
    `;
    node.addEventListener("click", () => tl2Inspect(ev));
    rail.appendChild(node);
  }
}

// ------- Inspector -------
function tl2Inspect(ev) {
  const insp = document.getElementById("tl2-inspector");
  if (!insp) return;
  insp.classList.remove("tl2-empty");
  insp.innerHTML = `
    <div class="tl2-card">
      <div style="font-weight:800">${tl2Escape(ev.title || ev.kind)}</div>
      <div class="meta" style="margin:.25rem 0 .5rem; color:var(--tl2-muted)">
        ${new Date(ev.t).toLocaleString()} • ${ev.kind}
      </div>
      ${
        ev.text
          ? `<p style="margin:.25rem 0 .75rem">${tl2Escape(ev.text)}</p>`
          : ""
      }
      ${tl2ChipRow("Characters", ev.character_ids)}
      ${tl2ChipRow("Quests", ev.quest_ids)}
      ${tl2ChipRow("Tags", ev.tags)}
      <div style="margin-top:.75rem">
        <button class="tl2-btn" disabled title="UI-only">Pin</button>
        <button class="tl2-btn" disabled title="UI-only">Link</button>
      </div>
    </div>
  `;
}

function tl2ChipRow(lbl, arr) {
  if (!arr || !arr.length) return "";
  const chips = arr
    .map(
      (x) =>
        `<span class="tl2-chip" style="pointer-events:none">${tl2Escape(
          x
        )}</span>`
    )
    .join(" ");
  return `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:.25rem 0">
    <span style="color:var(--tl2-muted); font-size:12px; width:72px">${lbl}</span>
    ${chips}
  </div>`;
}

// ------- Helpers -------
function tl2Filter(list) {
  const q = (TL2_QUERY || "").trim().toLowerCase();
  return list.filter((ev) => {
    const kOK = TL2_KIND === "all" || ev.kind === TL2_KIND;
    const qOK =
      !q ||
      (ev.title + " " + (ev.text || "") + " " + (ev.tags || []).join(" "))
        .toLowerCase()
        .includes(q);
    return kOK && qOK;
  });
}
const tl2ParseTime = (iso) => new Date(iso).getTime();
const tl2Extent = (items) => {
  const ts = items.map((e) => tl2ParseTime(e.t));
  return [Math.min(...ts), Math.max(...ts)];
};
function tl2ScaleY([t0, t1], px) {
  const span = Math.max(1, t1 - t0);
  return (t) => ((tl2ParseTime(t) - t0) / span) * px;
}
function tl2LaneX(kind) {
  const lane = TL2_LANES.find((l) => l.key === kind);
  const i = lane ? lane.x : 0;
  return i * TL2_LANE_WIDTH + (i ? TL2_LANE_GAP : 0);
}
function tl2ColorByKind(k) {
  switch (k) {
    case "dialogue":
      return "var(--tl2-dialogue)";
    case "action":
      return "var(--tl2-action)";
    case "roll":
      return "var(--tl2-roll)";
    case "quest_update":
      return "var(--tl2-quest)";
    case "world_state":
      return "var(--tl2-world)";
    default:
      return "rgba(255,255,255,.25)";
  }
}
const tl2Clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tl2Label = (k) =>
  ({
    all: "All",
    dialogue: "Dialogue",
    action: "Action",
    roll: "Roll",
    quest_update: "Quest",
    world_state: "World",
  }[k] || k);
const tl2Escape = (s) =>
  (s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );

// (Optional) How to feed real data later:
// fetch('/api/events?campaign_id=cmp_001&limit=500')
//   .then(r=>r.json())
//   .then(events => window.TL2.setData(events));
