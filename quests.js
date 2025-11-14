// Quests page JS - full-featured client-side quest manager
const Q_KEY = 'ds_quests_v1';
const CHAR_KEY = 'ds_characters_v1'; // reuse characters

// DOM
const qList = document.getElementById('quest-list');
const selectedQuestPanel = document.getElementById('selected-quest');
const selectedQuestPlaceholder = document.getElementById('selected-quest-placeholder');
const qTitle = document.getElementById('q-title');
const qMeta = document.getElementById('q-meta');
const qDesc = document.getElementById('q-desc');
const qEvents = document.getElementById('q-events');
const globalTimeline = document.getElementById('global-timeline');

const btnNew = document.getElementById('btn-new-quest');
const btnExport = document.getElementById('btn-export-quests');
const eventForm = document.getElementById('event-form');
const eventText = document.getElementById('event-text');
const eventLocation = document.getElementById('event-location');
const eventType = document.getElementById('event-type');
const assignChar = document.getElementById('assign-char');
const btnComplete = document.getElementById('btn-complete');
const btnAbandon = document.getElementById('btn-abandon');
const btnExportTimeline = document.getElementById('btn-export-timeline');

let quests = [];
let selectedQuestId = null;
let filterMode = 'all';

// helpers
const uid = () => 'q_' + Math.random().toString(36).slice(2,9);
const nowTs = () => new Date().toISOString();
function fmtTime(iso) {
  return new Date(iso).toLocaleString([], {hour:'2-digit',minute:'2-digit', month:'short', day:'numeric'});
}

// seed sample quests if none
function loadQuests() {
  const raw = localStorage.getItem(Q_KEY);
  if (raw) {
    try { quests = JSON.parse(raw); } catch(e) { quests = []; saveQuests(); }
  } else {
    quests = [
      { id: uid(), title: 'The Whispering Vault', desc: 'Investigate the sealed vault beneath Greywatch', status: 'active', assigned: 'Kyra', created: nowTs(),
        events: [
          { id: uid(), ts: nowTs(), type: 'milestone', text: 'Party discovered a hidden trapdoor under the shrine', location: 'Greywatch' }
        ]
      },
      { id: uid(), title: 'Old Lighthouse Mystery', desc: 'Strange lights at the lighthouse', status: 'active', assigned:'Thorne', created: nowTs(), events: [] }
    ];
    saveQuests();
  }
}

function saveQuests() { localStorage.setItem(Q_KEY, JSON.stringify(quests)); renderQuestList(); renderGlobalTimeline(); }

// render quest list
function renderQuestList() {
  qList.innerHTML = '';
  const visible = quests.filter(q => {
    if (filterMode === 'all') return true;
    return q.status === filterMode;
  });
  if (visible.length === 0) {
    const ph = document.createElement('div'); ph.className = 'placeholder'; ph.textContent = 'No quests.';
    qList.appendChild(ph);
    return;
  }
  visible.forEach(q => {
    const el = document.createElement('div'); el.className = 'quest-card';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${q.title}</strong><div class="meta">${q.assigned ? 'Assigned: '+q.assigned : 'Unassigned'}</div></div>
      <div style="text-align:right"><small>${fmtTime(q.created)}</small><div class="badge">${q.status}</div></div>
    </div>`;
    el.addEventListener('click', ()=> selectQuest(q.id));
    qList.appendChild(el);
  });
}

// select quest
function selectQuest(id) {
  const q = quests.find(x => x.id === id);
  if (!q) return;
  selectedQuestId = id;
  selectedQuestPlaceholder.style.display = 'none';
  selectedQuestPanel.style.display = 'block';
  qTitle.textContent = q.title;
  qMeta.textContent = `${q.status.toUpperCase()} • Assigned: ${q.assigned || '—'}`;
  qDesc.textContent = q.desc;
  renderQuestEvents(q);
  // set assign dropdown value
  assignChar.value = q.assigned || '';
}

// events
function renderQuestEvents(q) {
  qEvents.innerHTML = '';
  if (!q.events || q.events.length === 0) {
    qEvents.innerHTML = '<div class="placeholder">No events yet — add one.</div>';
    return;
  }
  q.events.slice().reverse().forEach(ev => {
    const d = document.createElement('div'); d.className = 'event';
    d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${ev.type}</strong> — ${ev.text}</div><div class="meta">${ev.location || ''} • ${fmtTime(ev.ts)}</div></div>`;
    qEvents.appendChild(d);
  });
}

// add new quest dialog (prompt-based for simplicity)
btnNew.addEventListener('click', () => {
  const title = prompt('Quest title');
  if (!title) return;
  const desc = prompt('Short description') || '';
  const q = { id: uid(), title, desc, status: 'active', assigned: '', created: nowTs(), events: [] };
  quests.unshift(q);
  saveQuests();
  selectQuest(q.id);
});

// event form
eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedQuestId) return alert('Select a quest first');
  const q = quests.find(x => x.id === selectedQuestId);
  if (!q) return;
  const text = eventText.value.trim(); if (!text) return;
  const ev = { id: uid(), ts: nowTs(), type: eventType.value, text, location: eventLocation.value || '' };
  q.events.push(ev);
  // push to global timeline as well
  saveQuests();
  eventForm.reset();
  renderQuestEvents(q);
  renderGlobalTimeline();
});

// assign
assignChar.addEventListener('change', () => {
  if (!selectedQuestId) return;
  const q = quests.find(x => x.id === selectedQuestId);
  q.assigned = assignChar.value || '';
  saveQuests();
  selectQuest(q.id);
});

// complete/abandon
btnComplete.addEventListener('click', () => {
  if (!selectedQuestId) return;
  const q = quests.find(x => x.id === selectedQuestId);
  if (!q) return;
  q.status = 'completed';
  saveQuests();
  selectQuest(q.id);
});

btnAbandon.addEventListener('click', () => {
  if (!selectedQuestId) return;
  const q = quests.find(x => x.id === selectedQuestId);
  if (!q) return;
  q.status = 'failed';
  saveQuests();
  selectQuest(q.id);
});

// filters
document.getElementById('q-filter-all').addEventListener('click', ()=> { filterMode='all'; renderQuestList(); });
document.getElementById('q-filter-active').addEventListener('click', ()=> { filterMode='active'; renderQuestList(); });
document.getElementById('q-filter-completed').addEventListener('click', ()=> { filterMode='completed'; renderQuestList(); });
document.getElementById('q-filter-failed').addEventListener('click', ()=> { filterMode='failed'; renderQuestList(); });

// global timeline (aggregated events)
function renderGlobalTimeline() {
  globalTimeline.innerHTML = '';
  const allEvents = [];
  quests.forEach(q => {
    (q.events || []).forEach(ev => allEvents.push({ ...ev, quest: q.title }));
    // include quest creation as event
    allEvents.push({ id: 'c_' + q.id, ts: q.created, type: 'quest-created', text: 'Quest created', quest: q.title });
  });
  allEvents.sort((a,b) => new Date(b.ts) - new Date(a.ts));
  if (!allEvents.length) {
    globalTimeline.innerHTML = '<div class="placeholder">No timeline events yet.</div>';
    return;
  }
  allEvents.forEach(ev => {
    const d = document.createElement('div'); d.className = 'event';
    d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${ev.quest}</strong> — ${ev.type}</div><div class="meta">${fmtTime(ev.ts)}</div></div>
      <div style="margin-top:.25rem">${ev.text}</div>`;
    globalTimeline.appendChild(d);
  });
}

// export timeline
btnExportTimeline.addEventListener('click', () => {
  const all = { exportedAt: nowTs(), quests };
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ds-quests-timeline.json'; a.click();
  URL.revokeObjectURL(url);
});

// export quests
btnExport.addEventListener('click', () => {
  const out = JSON.stringify(quests, null, 2);
  const blob = new Blob([out], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ds-quests.json'; a.click();
  URL.revokeObjectURL(url);
});

// load characters into assign select
function populateAssignDropdown() {
  assignChar.innerHTML = '<option value="">— Assign to character —</option>';
  const raw = localStorage.getItem(CHAR_KEY);
  if (raw) {
    try {
      const chars = JSON.parse(raw);
      for (let c of chars) {
        const o = document.createElement('option');
        o.value = c.name; o.textContent = `${c.name} • ${c.cls || ''} L${c.level || ''}`;
        assignChar.appendChild(o);
      }
    } catch(e){}
  }
}

// initial
loadQuests();
renderQuestList();
renderGlobalTimeline();
populateAssignDropdown();