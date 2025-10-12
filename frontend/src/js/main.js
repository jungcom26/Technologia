const stateEl = document.getElementById("tx-state");
const dotEl = document.getElementById("tx-dot");
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnStop = document.getElementById("btn-stop");
const logEl = document.getElementById("log");
const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";
const ws = new WebSocket("ws://127.0.0.1:8000/ws");
const themeBtn = document.getElementById("theme-toggle");
const fullscreenBtn = document.getElementById("fullscreen-toggle");
const overlay = document.getElementById("card-overlay");
let txState = "idle";

function setState(next) {
  txState = next;
  if (next === "recording") {
    stateEl.textContent = "Recording";
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue("--success");
    btnStart.setAttribute("aria-pressed", "true");
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else if (next === "paused") {
    stateEl.textContent = "Paused";
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue("--warning");
    btnStart.setAttribute("aria-pressed", "false");
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else {
    stateEl.textContent = "Idle";
    dotEl.style.background = "#6c6c6c";
    btnStart.setAttribute("aria-pressed", "false");
    btnPause.disabled = true;
    btnStop.disabled = true;
  }
}

function addLog(meta, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `<div class="avatar">S</div><div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • ${meta}</div>${text}</div>`;
  const placeholder = document.getElementById("log-placeholder");
  if (placeholder) placeholder.style.display = "none";
  logEl.insertBefore(wrap, logEl.firstChild);
  logEl.scrollTop = 0;
}

btnStart.addEventListener("click", () => {
  if (txState === "idle" || txState === "paused") {
    setState("recording");
    addLogMessage(`<div class="msg"><div class="avatar">S</div><div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • System</div><em>Transcription started.</em></div></div>`);
  }
});

btnPause.addEventListener("click", () => {
  if (txState === "recording") {
    setState("paused");
    addLog("System", "<em>Transcription paused.</em>");
  } else if (txState === "paused") {
    setState("recording");
    addLog("System", "<em>Transcription resumed.</em>");
  }
});

btnStop.addEventListener("click", () => {
  if (txState !== "idle") {
    setState("idle");
    addLog("System", "<em>Transcription stopped.</em>");
  }
});

window.addEventListener("keydown", (e) => {
  const target = e.target;
  const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
  const isEditable = tag === "input" || tag === "textarea" || (target && target.isContentEditable);
  if (isEditable) return;
  const key = e.key.toLowerCase();
  if (key === "s") btnStart.click();
  if (key === "p") btnPause.click();
  if (key === "x") btnStop.click();
});

function addLogMessage(html) {
  const log = document.getElementById("log");
  if (!log) return;
  const placeholder = document.getElementById("log-placeholder");
  if (placeholder) placeholder.style.display = "none";
  const wasAtTop = log.scrollTop <= 4;
  const oldH = log.scrollHeight;
  log.insertAdjacentHTML("afterbegin", html);
  if (wasAtTop) {
    log.scrollTop = 0;
  } else {
    const newH = log.scrollHeight;
    log.scrollTop += newH - oldH;
  }
}

function formatMessage(charName, text) {
  const name = charName.charAt(0).toUpperCase() + charName.slice(1);
  const content = text.charAt(0).toLowerCase() + text.slice(1);
  return `${name} ${content}`;
}

function addQuest(title, update, icon = "🔎") {
  const questList = document.getElementById("quest-list");
  const questPlaceholder = document.getElementById("quest-placeholder");
  if (questPlaceholder) questPlaceholder.style.display = "none";
  const questDiv = document.createElement("div");
  questDiv.className = "quest";
  questDiv.innerHTML = `<div>${icon} ${title}</div><small>${update}</small>`;
  questList.prepend(questDiv);
  while (questList.children.length > 2) questList.removeChild(questList.lastChild);
}

function updateTimelineProgress() {
  const rail = document.getElementById("timeline-rail");
  if (!rail) return;
  const items = rail.querySelectorAll(".t-item");
  const oldLine = rail.querySelector(".progress-line");
  if (oldLine) oldLine.remove();
  if (items.length === 0) return;
  const newest = items[0];
  const oldest = items[items.length - 1];
  const newestCircle = newest.querySelector(".timeline-circle");
  const oldestCircle = oldest.querySelector(".timeline-circle");
  if (!newestCircle || !oldestCircle) return;
  const railRect = rail.getBoundingClientRect();
  const newestRect = newestCircle.getBoundingClientRect();
  const oldestRect = oldestCircle.getBoundingClientRect();
  const top = newestRect.top - railRect.top + newestRect.height / 2;
  const bottom = oldestRect.top - railRect.top + oldestRect.height / 2;
  const height = bottom - top;
  const progressLineEl = document.createElement("div");
  progressLineEl.className = "progress-line";
  progressLineEl.style.cssText = `position:absolute;left:.65rem;top:${top}px;height:${height}px;width:2px;background:linear-gradient(to bottom,var(--accent),var(--accent-2));border-radius:2px;z-index:1;`;
  rail.appendChild(progressLineEl);
}

function initTimeline() {
  setTimeout(updateTimelineProgress, 100);
  const rail = document.getElementById("timeline-rail");
  if (!rail) return;
  if (window.timelineObserver) window.timelineObserver.disconnect();
  window.timelineObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (let m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) setTimeout(updateTimelineProgress, 50);
  });
  window.timelineObserver.observe(rail, { childList: true, subtree: false });
}

function addTimelineEvent(time, type, title, meta, icon = "🔹", options = {}) {
  const rail = document.getElementById("timeline-rail");
  if (!rail) return;
  const timelinePlaceholder = document.getElementById("timeline-placeholder");
  if (timelinePlaceholder) timelinePlaceholder.style.display = "none";
  const item = document.createElement("article");
  item.className = "t-item";
  const itemCount = rail.querySelectorAll(".t-item").length;
  item.style.setProperty("--item-index", itemCount);
  item.innerHTML = `<time datetime="${time}">${time}</time><div><div><span class="badge">${type}</span> ${icon} ${title}</div><small class="meta">${meta}</small></div><div class="timeline-circle"></div>`;
  const opts = options || {};
  if (typeof opts.onClick === "function") {
    item.classList.add("interactive");
    if (opts.tooltip) item.title = opts.tooltip;
    item.addEventListener("click", (ev) => {
      ev.preventDefault();
      opts.onClick();
    });
  }
  rail.insertBefore(item, rail.firstChild);
  setTimeout(updateTimelineProgress, 100);
}

function setupContextQuery() {
  const form = document.getElementById("context-query-form");
  const input = document.getElementById("context-query-input");
  const results = document.getElementById("context-query-results");
  const clearBtn = document.getElementById("context-query-clear");
  if (!form || !input || !results) return;
  const setPlaceholder = (text) => {
    results.innerHTML = "";
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = text;
    results.appendChild(placeholder);
  };
  const renderError = (message) => {
    results.innerHTML = "";
    const err = document.createElement("div");
    err.className = "context-query-error";
    err.textContent = message;
    results.appendChild(err);
  };
  const buildSection = (title, entries, formatter) => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const wrap = document.createElement("div");
    wrap.className = "query-chunk-section";
    const heading = document.createElement("h4");
    heading.textContent = title;
    wrap.appendChild(heading);
    const list = document.createElement("ul");
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = formatter(entry);
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  };
  const renderResults = (payload) => {
    results.innerHTML = "";
    const answer = document.createElement("div");
    answer.className = "query-answer";
    answer.textContent = payload?.answer || "No answer generated yet.";
    results.appendChild(answer);
    const context = Array.isArray(payload?.context) ? payload.context : [];
    if (!context.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      placeholder.textContent = "No matching records yet.";
      results.appendChild(placeholder);
      return;
    }
    context.forEach((chunk) => {
      const chunkEl = document.createElement("div");
      chunkEl.className = "query-chunk";
      const title = document.createElement("div");
      title.className = "query-chunk-title";
      title.textContent = `Chunk #${chunk.chunk_index} • Session ${chunk.session_id}`;
      chunkEl.appendChild(title);
      const transcript = chunk.transcript_snippet || chunk.transcript;
      if (transcript) {
        const transcriptEl = document.createElement("p");
        transcriptEl.className = "query-chunk-transcript";
        transcriptEl.textContent = transcript;
        chunkEl.appendChild(transcriptEl);
      }
      const characterSection = buildSection("Character events", chunk.character_events, (event) => {
        const base = `${event.character}: ${event.action}`;
        return event.outcome ? `${base} → ${event.outcome}` : base;
      });
      if (characterSection) chunkEl.appendChild(characterSection);
      const worldSection = buildSection("World updates", chunk.world_state_updates, (entry) => `${entry.location}: ${entry.update}`);
      if (worldSection) chunkEl.appendChild(worldSection);
      const questSection = buildSection("Quest updates", chunk.quest_updates, (entry) => `${entry.quest}: ${entry.update}`);
      if (questSection) chunkEl.appendChild(questSection);
      const entitySection = buildSection("Entities", chunk.entities, (entity) => {
        const alias = Array.isArray(entity.aliases) && entity.aliases.length ? ` (aka ${entity.aliases.join(", ")})` : "";
        const pieces = [entity.name + alias];
        if (entity.kind && entity.kind !== "unknown") pieces.push(`[${entity.kind}]`);
        if (entity.description) pieces.push(entity.description);
        return pieces.join(" ");
      });
      if (entitySection) chunkEl.appendChild(entitySection);
      results.appendChild(chunkEl);
    });
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    setPlaceholder("Searching archive…");
    try {
      const resp = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!resp.ok) throw new Error(`Server responded with ${resp.status}`);
      const data = await resp.json();
      renderResults(data);
    } catch (err) {
      renderError("Could not retrieve an answer. Is the server running?");
    }
  });
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      setPlaceholder("No questions yet.");
      input.focus();
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("log-search");
  const dropdownOptions = document.querySelectorAll(".dropdown-option");
  searchInput.addEventListener("focus", function () {
    this.parentElement.classList.add("expanded");
  });
  searchInput.addEventListener("blur", function () {
    setTimeout(() => this.parentElement.classList.remove("expanded"), 200);
  });
  dropdownOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const type = this.getAttribute("data-type");
      dropdownOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");
      if (type === "all") searchInput.placeholder = "Search all events...";
      else if (type === "character") searchInput.placeholder = "Search character events...";
      else if (type === "world") searchInput.placeholder = "Search world updates...";
      else if (type === "quest") searchInput.placeholder = "Search quest updates...";
      filterLogs(type, searchInput.value);
    });
  });
  searchInput.addEventListener("input", function () {
    const activeOption = document.querySelector(".dropdown-option.active");
    const type = activeOption ? activeOption.getAttribute("data-type") : "all";
    filterLogs(type, this.value);
  });
  function filterLogs(type, query) {
    const messages = document.querySelectorAll(".msg");
    messages.forEach((msg) => {
      const text = msg.textContent.toLowerCase();
      const shouldShow = text.includes(query.toLowerCase());
      msg.style.display = shouldShow ? "flex" : "none";
    });
  }
  document.querySelector('.dropdown-option[data-type="all"]').classList.add("active");
  setupContextQuery();
  initTimeline();
});

async function generateImage(prompt, targetId, model = null, width = 256, height = 256) {
  try {
    const payload = { prompt, width, height, steps: 20, cfg_scale: 7 };
    if (model) payload.model = model;
    const response = await fetch("http://127.0.0.1:8000/generate-image/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.error) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    if (targetEl.tagName.toLowerCase() === "img") {
      targetEl.src = `data:image/png;base64,${data.image}`;
      targetEl.style.display = "block";
    } else {
      targetEl.style.backgroundImage = `url(data:image/png;base64,${data.image})`;
      targetEl.style.backgroundSize = "cover";
      targetEl.style.backgroundPosition = "center";
      targetEl.innerText = "";
    }
  } catch (err) { }
}

function generatePortrait(tokenId, name, classId, speciesId = null, genderId = null) {
  const charClass = document.getElementById(classId).innerText;
  let prompt = name + ", " + charClass;
  let species = "";
  if (speciesId) {
    species = document.getElementById(speciesId).innerText;
    prompt = name + ", " + species + ", " + charClass;
  }
  if (genderId) {
    const gender = document.getElementById(genderId).innerText;
    prompt = name + ", " + species + ", " + charClass + ", " + gender;
  }
  prompt += ", high quality fantasy portrait, upper body, concept art, dramatic lighting, painterly brushwork";
  const model = "dreamshaper_8.safetensors";
  generateImage(prompt, tokenId, model);
}

ws.onopen = () => {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  addTimelineEvent(now, "Session", "New adventure begins", "Game started", "⚔️");
  addLog("System", "<em>New game session started.</em>");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  let wrap;
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (msg.heading === "Quest Update") {
    wrap = document.createElement("div");
    wrap.className = "msg right";
    wrap.innerHTML = `<div class="avatar">Q</div><div class="bubble"><div class="meta">${timestamp} • Quest Update</div><em>${msg.quest_name}: ${msg.content}</em></div>`;
    addLogMessage(wrap.outerHTML);
    addTimelineEvent(timestamp, "Quest", msg.quest_name, "📜 Quest Updated", "");
    addQuest(msg.quest_name, msg.content);
    return;
  }
  if (msg.heading === "World State Update") {
    const location = msg.location || "Unknown Location";
    wrap = document.createElement("div");
    wrap.className = "msg right";
    wrap.innerHTML = `<div class="avatar">W</div><div class="bubble"><div class="meta">${timestamp} • World State Update • ${location}</div><em>${msg.content}</em></div>`;
    const mapPrompt = `${msg.content}, fantasy style, detailed, full color, high quality`;
    const mapTarget = "map-viewport";
    const mapModel = "revAnimated_v2Rebirth.safetensors";
    const bubbleEl = wrap.querySelector(".bubble");
    if (bubbleEl) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "generate-btn";
      btn.textContent = "Generate Scene Image";
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        generateImage(mapPrompt, mapTarget, mapModel, 512, 512);
      });
      bubbleEl.appendChild(btn);
    }
    addTimelineEvent(timestamp, "Location", location, msg.content, "📍", {
      tooltip: "Click to generate art for this scene",
      onClick: () => generateImage(mapPrompt, mapTarget, mapModel, 512, 512),
    });
  } else if (msg.heading && (msg.heading.startsWith("Character Action") || msg.heading.startsWith("Character Outcome"))) {
    const charName = msg.heading.split(":")[1].trim();
    const meta = msg.heading.startsWith("Character Action") ? "Action" : "Outcome";
    if (charName.toLowerCase() === "narrator") {
      let locationHTML = msg.location ? `<div class="meta-location">📍 ${msg.location}</div>` : "";
      wrap = document.createElement("div");
      wrap.className = "msg right";
      wrap.innerHTML = `<div class="avatar">DM</div><div class="bubble"><div class="meta">${timestamp} • World State Update</div>${locationHTML}<em>${msg.content}</em></div>`;
    } else {
      const avatar = charName.charAt(0).toUpperCase();
      const content = formatMessage(charName, msg.content.replace(/<br>/g, "<br>"));
      wrap = document.createElement("div");
      wrap.className = "msg left";
      wrap.innerHTML = `<div class="avatar player">${avatar}</div><div class="bubble"><div class="meta">${timestamp} • ${meta}</div>${content}</div>`;
    }
  }
  if (wrap) addLogMessage(wrap.outerHTML);
};

ws.onclose = () => { };
ws.onerror = () => { };

(function initThemeToggle() {
  const KEY = "ds-theme";
  const root = document.documentElement;
  const THEMES = ["oak", "parchment", "ember"];
  const saved = localStorage.getItem(KEY);
  if (saved) root.setAttribute("data-theme", saved);
  if (!themeBtn) return;
  themeBtn.addEventListener("click", () => {
    const cur = root.getAttribute("data-theme") || THEMES[0];
    const idx = THEMES.indexOf(cur);
    const next = THEMES[(idx + 1) % THEMES.length];
    root.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  });
})();

(function initFullscreen() {
  if (!fullscreenBtn) return;
  const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  const req = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  };
  const exit = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  };
  fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!isFs()) {
        await req();
      } else {
        await exit();
      }
    } catch (e) { }
  });
})();

(function initCardDock() {
  const row = document.querySelector("footer.characters .card-row");
  if (!row) return;
  row.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    openCardOverlay(card);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hasAttribute("hidden")) closeOverlay();
  });
})();

function openCardOverlay(card) {
  overlay.innerHTML = "";
  const clone = card.cloneNode(true);
  clone.classList.add("overlay-card");
  const closeBtn = document.createElement("button");
  closeBtn.className = "overlay-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeOverlay);
  overlay.appendChild(clone);
  overlay.appendChild(closeBtn);
  overlay.removeAttribute("hidden");
  const genBtn = clone.querySelector("#kyra-generate-btn");
  if (genBtn) {
    genBtn.addEventListener("click", () => {
      generatePortrait("kyra-token", "Kyra", "first-class", "first-species", "first-gender");
    });
  }
}

function closeOverlay() {
  overlay.setAttribute("hidden", "");
  overlay.innerHTML = "";
}

document.getElementById("kyra-generate-btn")?.addEventListener("click", () => {
  generatePortrait("kyra-token", "Kyra", "first-class", "first-species", "first-gender");
});


//npc stuff

const npcsPanel = document.getElementById("npcs-panel");
const npcsList = document.getElementById("npcs-list");
const btnNpcsCollapse = document.getElementById("npcs-collapse");
const tabNpcs = document.getElementById("npcs-tab");
const btnNpcsAdd = document.getElementById("npcs-add");
const NPCS_KEY = "ds-npcs";
const NPCS_UI_KEY = "ds-npcs-collapsed";

function saveNPCs(items) {
  localStorage.setItem(NPCS_KEY, JSON.stringify(items));
}
function loadNPCs() {
  try { return JSON.parse(localStorage.getItem(NPCS_KEY) || "[]"); } catch { return []; }
}
function renderNPCs(items) {
  npcsList.innerHTML = "";
  if (!items.length) {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = "No NPCs yet";
    npcsList.appendChild(ph);
    return;
  }
  items.forEach(npc => {
    const card = document.createElement("article");
    card.className = "npc";
    const initial = (npc.name || "?").trim().charAt(0).toUpperCase() || "?";
    card.innerHTML = `
      <div class="npc-avatar">${initial}</div>
      <div>
        <h4>${npc.name}</h4>
        <small>${npc.role || ""}</small>
        ${npc.notes ? `<div class="npc-notes">${npc.notes}</div>` : ""}
      </div>
    `;
    npcsList.appendChild(card);
  });
}
function setCollapsed(collapsed) {
  if (!npcsPanel) return;
  npcsPanel.classList.toggle("collapsed", collapsed);
  if (btnNpcsCollapse) btnNpcsCollapse.setAttribute("aria-expanded", String(!collapsed));
  localStorage.setItem(NPCS_UI_KEY, collapsed ? "1" : "0");
}
function initNPCsPanel() {
  const collapsed = localStorage.getItem(NPCS_UI_KEY) === "1";
  setCollapsed(collapsed);
  const items = loadNPCs();
  renderNPCs(items);
  if (btnNpcsCollapse) {
    btnNpcsCollapse.addEventListener("click", () => setCollapsed(true));
  }
  if (tabNpcs) {
    tabNpcs.addEventListener("click", () => setCollapsed(false));
  }
  if (btnNpcsAdd) {
    btnNpcsAdd.addEventListener("click", () => {
      const name = prompt("NPC name");
      if (!name) return;
      const role = prompt("Role or faction (optional)") || "";
      const notes = prompt("Notes (optional)") || "";
      const next = [{ name, role, notes }, ...loadNPCs()].slice(0, 50);
      saveNPCs(next);
      renderNPCs(next);
    });
  }
}
document.addEventListener("DOMContentLoaded", initNPCsPanel);
