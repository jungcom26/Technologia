// Simple Start/Pause/Stop state machine for transcription controls
const stateEl = document.getElementById('tx-state');
const dotEl = document.getElementById('tx-dot');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const logEl = document.getElementById('log');

let txState = 'idle'; // 'idle' | 'recording' | 'paused'

const setState = (next) => {
  txState = next;
  if (next === 'recording'){
    stateEl.textContent = 'Recording';
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--success');
    btnStart.setAttribute('aria-pressed','true');
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else if (next === 'paused'){
    stateEl.textContent = 'Paused';
    dotEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--warning');
    btnStart.setAttribute('aria-pressed','false');
    btnPause.disabled = false;
    btnStop.disabled = false;
  } else {
    stateEl.textContent = 'Idle';
    dotEl.style.background = '#6c6c6c';
    btnStart.setAttribute('aria-pressed','false');
    btnPause.disabled = true;
    btnStop.disabled = true;
  }
};

const addLog = (meta, text) => {
  const wrap = document.createElement('div');
  wrap.className = 'msg';
  wrap.innerHTML = `
    <div class="avatar">S</div>
    <div class="bubble">
      <div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • ${meta}</div>
      ${text}
    </div>`;
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
};

btnStart.addEventListener('click', () => {
  if (txState === 'idle' || txState === 'paused'){
    setState('recording');
    addLogMessage(`
<div class="msg">
  <div class="avatar">S</div>
  <div class="bubble">
    <div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • System</div>
    <em>Transcription started.</em>
  </div>
</div>
`);

  }
});

btnPause.addEventListener('click', () => {
  if (txState === 'recording'){ setState('paused'); addLog('System', '<em>Transcription paused.</em>'); }
  else if (txState === 'paused'){ setState('recording'); addLog('System', '<em>Transcription resumed.</em>'); }
});

btnStop.addEventListener('click', () => {
  if (txState !== 'idle'){ setState('idle'); addLog('System', '<em>Transcription stopped.</em>'); }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if (e.key.toLowerCase() === 's') btnStart.click();
  if (e.key.toLowerCase() === 'p') btnPause.click();
  if (e.key.toLowerCase() === 'x') btnStop.click();
});

function addLogMessage(messageHtml) {
  const log = document.getElementById("log");
  const placeholder = document.getElementById("log-placeholder");

  if (placeholder) placeholder.style.display = "none";

  // Prepend new log messages at the top
  log.insertAdjacentHTML("afterbegin", messageHtml);

  // Keep scroll at the very top for newest-first layout
  log.scrollTop = 0;
}

function formatMessage(charName, text) {
  // Capitalize first letter of name
  const name = charName.charAt(0).toUpperCase() + charName.slice(1);
  
  // Lowercase first letter of message content
  const content = text.charAt(0).toLowerCase() + text.slice(1);

  return `${name} ${content}`;
}

function addQuest(title, update, icon="🔎") {
  const questList = document.getElementById("quest-list");

  // Hide placeholder if it's still visible
  const questPlaceholder = document.getElementById('quest-placeholder');
  if (questPlaceholder) questPlaceholder.style.display = 'none';

  const questDiv = document.createElement("div");
  questDiv.className = "quest";
  questDiv.innerHTML = `
    <div>${icon} ${title}</div>
    <small>${update}</small>
  `;

  questList.prepend(questDiv);

  // Keep only the 2 most recent quests
  while (questList.children.length > 2) {
    questList.removeChild(questList.lastChild);
  }
}


// ---------------- Timeline Functions ----------------
function updateTimelineProgress() {
  const rail = document.getElementById('timeline-rail');
  if (!rail) return;

  const items = rail.querySelectorAll('.t-item');
  const oldLine = rail.querySelector('.progress-line');
  if (oldLine) oldLine.remove();
  if (items.length === 0) return;

  // Newest item at the top, oldest at the bottom
  const newest = items[0];
  const oldest = items[items.length - 1];

  const newestCircle = newest.querySelector('.timeline-circle');
  const oldestCircle = oldest.querySelector('.timeline-circle');
  if (!newestCircle || !oldestCircle) return;

  const railRect = rail.getBoundingClientRect();
  const newestRect = newestCircle.getBoundingClientRect();
  const oldestRect = oldestCircle.getBoundingClientRect();

  // Progress line from newest circle center to oldest circle center
  const top = newestRect.top - railRect.top + newestRect.height / 2;
  const bottom = oldestRect.top - railRect.top + oldestRect.height / 2;
  const height = bottom - top;

  const progressLineEl = document.createElement('div');
  progressLineEl.className = 'progress-line';
  progressLineEl.style.cssText = `
    position: absolute;
    left: 0.65rem;
    top: ${top}px;
    height: ${height}px;
    width: 2px;
    background: linear-gradient(to bottom, var(--accent), var(--accent-2));
    border-radius: 2px;
    z-index: 1;
  `;
  rail.appendChild(progressLineEl);
}

function initTimeline() {
  setTimeout(updateTimelineProgress, 100);

  const rail = document.getElementById('timeline-rail');
  if (!rail) return;

  if (window.timelineObserver) window.timelineObserver.disconnect();

  window.timelineObserver = new MutationObserver(mutations => {
    let shouldUpdate = false;
    for (let m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) setTimeout(updateTimelineProgress, 50);
  });

  window.timelineObserver.observe(rail, { childList: true, subtree: false });
}

function addTimelineEvent(time, type, title, meta, icon="🔹") {
  const rail = document.getElementById('timeline-rail');
  if (!rail) return;

  // Hide placeholder if it's still visible
  const timelinePlaceholder = document.getElementById('timeline-placeholder');
  if (timelinePlaceholder) timelinePlaceholder.style.display = 'none';

  const item = document.createElement("article");
  item.className = "t-item";
  const itemCount = rail.querySelectorAll('.t-item').length;
  item.style.setProperty('--item-index', itemCount);

  item.innerHTML = `
    <time datetime="${time}">${time}</time>
    <div>
      <div>
        <span class="badge">${type}</span> ${icon} ${title}
      </div>
      <small class="meta">${meta}</small>
    </div>
    <div class="timeline-circle"></div>
  `;

  rail.insertBefore(item, rail.firstChild);
  setTimeout(updateTimelineProgress, 100);
}

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('log-search');
  const dropdown = document.getElementById('search-dropdown');
  const dropdownOptions = document.querySelectorAll('.dropdown-option');
  
  // Expand search on focus
  searchInput.addEventListener('focus', function() {
    this.parentElement.classList.add('expanded');
  });
  
  searchInput.addEventListener('blur', function() {
    // Delay hiding to allow click on dropdown
    setTimeout(() => {
      this.parentElement.classList.remove('expanded');
    }, 200);
  });
  
  // Handle dropdown selection
  dropdownOptions.forEach(option => {
    option.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      
      // Update active state
      dropdownOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      // Update search placeholder based on selection
      if (type === 'all') {
        searchInput.placeholder = 'Search all events...';
      } else if (type === 'character') {
        searchInput.placeholder = 'Search character events...';
      } else if (type === 'world') {
        searchInput.placeholder = 'Search world updates...';
      } else if (type === 'quest') {
        searchInput.placeholder = 'Search quest updates...';
      }
      
      // Implement your actual filtering logic here
      filterLogs(type, searchInput.value);
    });
  });
  
  // Handle search input
  searchInput.addEventListener('input', function() {
    const activeOption = document.querySelector('.dropdown-option.active');
    const type = activeOption ? activeOption.getAttribute('data-type') : 'all';
    
    filterLogs(type, this.value);
  });
  
  // Filter function (pseudo-implementation)
  async function filterLogs(type, query) {
    if (!query) return;

    const typeMapping = {
      all: "all",
      character: "player",    // maps to player_actions collection
      world: "world",
      quest: "quest"
    };

    const mappedType = typeMapping[type] || "all";

    try {
      const res = await fetch(`http://127.0.0.1:8000/search/?query=${encodeURIComponent(query)}&event_type=${type}`);
      const data = await res.json();

      console.log("🔍 Search results:", data);

      // Clear old log
      logEl.innerHTML = "";

      // Render results
      for (const [col, docs] of Object.entries(data)) {
        docs.forEach(doc => {
          const wrap = document.createElement("div");
          wrap.className = "msg";
          wrap.innerHTML = `
            <div class="avatar">${col.charAt(0).toUpperCase()}</div>
            <div class="bubble">
              <div class="meta">From ${col}</div>
              ${doc}
            </div>`;
          logEl.appendChild(wrap);
        });
      }
    } catch (err) {
      console.error("Search error", err);
    }
  }
  
  // Initialize with 'all' selected
  document.querySelector('.dropdown-option[data-type="all"]').classList.add('active');
});

// -------------------- Generate Image -----------------------------------

async function generateImage(prompt, tokenDivId) {
  try {
    const response = await fetch("http://127.0.0.1:8000/generate-image/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt })
    });

    const data = await response.json();
    if(data.error){
        console.error("API Error:", data.error);
        return;
    }

    const imgEl = document.createElement("img");
    imgEl.src = "data:image/png;base64," + data.image;
    imgEl.alt = prompt;

    const tokenDiv = document.getElementById(tokenDivId);
    tokenDiv.innerHTML = "";
    tokenDiv.appendChild(imgEl);

  } catch (err) {
    console.error("Image generation error:", err);
  }
}

function generatePortrait(tokenId, name, classId, speciesId = null, genderId = null) {
  const charClass = document.getElementById(classId).innerText;
  let prompt = name + ', ' + charClass;

  let species = '';
  if (speciesId) {
    species = document.getElementById(speciesId).innerText;
    prompt = name + ', ' + species + ', ' + charClass;
  }
  if (genderId) {
    const gender = document.getElementById(genderId).innerText;
    prompt = name + ', ' + species + ', ' + charClass + ', ' + gender;
  }

  prompt += ', high quality fantasy portrait, upper body, concept art, dramatic lighting';
  generateImage(prompt, tokenId);
}


// ------------------- WebSocket Chat Integration -------------------
const ws = new WebSocket("ws://127.0.0.1:8000/ws");

ws.onopen = () => {
  console.log("✅ Connected to WebSocket");

  // Start new game session automatically ONCE
  const now = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  addTimelineEvent(now, "Session", "New adventure begins", "Game started", "⚔️");
  addLog('System', '<em>New game session started.</em>');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log("📩 Received:", msg);

  let wrap; // will hold the final message element
  const timestamp = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  // ---------------- Quest Updates ----------------
  if (msg.heading === "Quest Update") {    
    wrap = document.createElement("div");
    wrap.className = "msg right"; // right-aligned like world updates
    wrap.innerHTML = `
      <div class="avatar"><img src="quest.png" alt="Quest" /></div>
      <div class="bubble">
        <div class="meta">${timestamp} • Quest Update</div>
        <em>${msg.quest_name}: ${msg.content}</em>
      </div>
    `;
    addLogMessage(wrap.outerHTML);

    // Also add to timeline & quest list
    addTimelineEvent(timestamp, "Quest", msg.quest_name, "📜 Quest Updated", "");
    addQuest(msg.quest_name, msg.content);

    return; // stop further processing for this message
  }

  // ---------------- World State Update ----------------
  if (msg.heading === "World State Update") {

    wrap = document.createElement("div");
    wrap.className = "msg right";
    wrap.innerHTML = `
      <div class="avatar crown"><img src="crown.png" alt="Quest" /></div>
      <div class="bubble">
        <div class="meta">${timestamp} • World State Update</div>
        <em>${msg.content}</em>
      </div>
    `;

    addTimelineEvent(timestamp, "Event", msg.location, "📍Location Changed", "", msg.location || "");
  }

  // ---------------- Character Messages ----------------
  else if (msg.heading.startsWith("Character Action") || msg.heading.startsWith("Character Outcome")) {
    const charName = msg.heading.split(":")[1].trim();
    const meta = msg.heading.startsWith("Character Action") ? "Action" : "Outcome";

    if (charName.toLowerCase() === "narrator") {
      // Narrator / DM messages with location
      let locationHTML = msg.location ? `<div class="meta-location">📍 ${msg.location}</div>` : "";

      wrap = document.createElement("div");
      wrap.className = "msg right";
      wrap.innerHTML = `
        <div class="avatar player">DM</div>
        <div class="bubble">
          <div class="meta">${timestamp} • World State Update</div>
          ${locationHTML}
          <em>${msg.content}</em>
        </div>
      `;
    } else {
      // Player / Character message
      const avatar = charName.charAt(0).toUpperCase();
      const content = formatMessage(charName, msg.content.replace(/<br>/g, "<br>"));

      wrap = document.createElement("div");
      wrap.className = "msg left"; // left-aligned
      wrap.innerHTML = `
        <div class="avatar player">${avatar}</div>
        <div class="bubble">
          <div class="meta">${timestamp} • ${meta}</div>
          ${content}
        </div>
      `;
    }
  }

  // ---------------- Append message to log ----------------
  if (wrap) addLogMessage(wrap.outerHTML);
};



ws.onclose = () => console.log("❌ WebSocket disconnected");
ws.onerror = (err) => console.error("WebSocket error", err);
