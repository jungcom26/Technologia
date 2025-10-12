// quests.js - UPDATED VERSION (SQLite via API)
const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";

// DOM Elements
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

// Helper functions
const uid = () => 'q_' + Math.random().toString(36).slice(2,9);
const nowTs = () => new Date().toISOString();
function fmtTime(iso) {
    return new Date(iso).toLocaleString([], {hour:'2-digit',minute:'2-digit', month:'short', day:'numeric'});
}

// API helper functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Load quests from SQLite
async function loadQuests() {
    try {
        const data = await apiCall('/api/quests');
        quests = data;
    } catch (error) {
        console.error('Failed to load quests:', error);
        quests = [];
    }
}

// Quest CRUD operations
async function createQuest(questData) {
    try {
        await apiCall('/api/quests', {
            method: 'POST',
            body: JSON.stringify(questData)
        });
        await loadQuests(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to create quest:', error);
        return false;
    }
}

async function updateQuest(questId, questData) {
    try {
        await apiCall(`/api/quests/${questId}`, {
            method: 'PUT',
            body: JSON.stringify(questData)
        });
        await loadQuests(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to update quest:', error);
        return false;
    }
}

async function deleteQuest(questId) {
    try {
        await apiCall(`/api/quests/${questId}`, {
            method: 'DELETE'
        });
        await loadQuests(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to delete quest:', error);
        return false;
    }
}

// Render functions
function renderQuestList() {
    qList.innerHTML = '';
    const visible = quests.filter(q => {
        if (filterMode === 'all') return true;
        return q.status === filterMode;
    });
    if (visible.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.textContent = 'No quests.';
        qList.appendChild(ph);
        return;
    }
    visible.forEach(q => {
        const el = document.createElement('div');
        el.className = 'quest-card';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${q.title}</strong><div class="meta">${q.assigned_character ? 'Assigned: '+q.assigned_character : 'Unassigned'}</div></div>
            <div style="text-align:right"><small>${fmtTime(q.created_at)}</small><div class="badge">${q.status}</div></div>
        </div>`;
        el.addEventListener('click', () => selectQuest(q.id));
        qList.appendChild(el);
    });
}

function selectQuest(id) {
    const q = quests.find(x => x.id === id);
    if (!q) return;
    selectedQuestId = id;
    selectedQuestPlaceholder.style.display = 'none';
    selectedQuestPanel.style.display = 'block';
    qTitle.textContent = q.title;
    qMeta.textContent = `${q.status.toUpperCase()} • Assigned: ${q.assigned_character || '—'}`;
    qDesc.textContent = q.description;
    renderQuestEvents(q);
    assignChar.value = q.assigned_character || '';
}

function renderQuestEvents(q) {
    qEvents.innerHTML = '';
    if (!q.notes || q.notes.length === 0) {
        qEvents.innerHTML = '<div class="placeholder">No events yet — add one.</div>';
        return;
    }
    q.notes.slice().reverse().forEach(note => {
        const d = document.createElement('div');
        d.className = 'event';
        d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>Note</strong> — ${note.text}</div><div class="meta">${note.location || ''} • ${fmtTime(note.created_at)}</div></div>`;
        qEvents.appendChild(d);
    });
}

function renderGlobalTimeline() {
    globalTimeline.innerHTML = '';
    const allEvents = [];
    quests.forEach(q => {
        (q.notes || []).forEach(note => allEvents.push({ ...note, quest: q.title }));
        allEvents.push({ id: 'c_' + q.id, ts: q.created_at, type: 'quest-created', text: 'Quest created', quest: q.title });
    });
    allEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    if (!allEvents.length) {
        globalTimeline.innerHTML = '<div class="placeholder">No timeline events yet.</div>';
        return;
    }
    allEvents.forEach(ev => {
        const d = document.createElement('div');
        d.className = 'event';
        d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${ev.quest}</strong> — ${ev.type}</div><div class="meta">${fmtTime(ev.ts)}</div></div>
            <div style="margin-top:.25rem">${ev.text}</div>`;
        globalTimeline.appendChild(d);
    });
}

// Event Handlers
btnNew.addEventListener('click', async () => {
    const title = prompt('Quest title');
    if (!title) return;
    const description = prompt('Short description') || '';
    const questData = {
        title,
        description,
        status: 'active',
        category: 'Main Quest',
        assigned_character: '',
        session_date: new Date().toISOString().slice(0, 10),
        campaign_date: '',
        objectives: [],
        notes: []
    };
    await createQuest(questData);
    if (quests.length > 0) {
        selectQuest(quests[0].id);
    }
});

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedQuestId) return alert('Select a quest first');
    const q = quests.find(x => x.id === selectedQuestId);
    if (!q) return;
    const text = eventText.value.trim();
    if (!text) return;
    
    const newNotes = [
        ...(q.notes || []),
        {
            id: uid(),
            text,
            location: eventLocation.value || '',
            type: eventType.value,
            created_at: nowTs()
        }
    ];
    
    await updateQuest(q.id, {
        title: q.title,
        description: q.description,
        status: q.status,
        category: q.category,
        assigned_character: q.assigned_character,
        session_date: q.session_date,
        campaign_date: q.campaign_date,
        objectives: q.objectives,
        notes: newNotes
    });
    
    eventForm.reset();
});

assignChar.addEventListener('change', async () => {
    if (!selectedQuestId) return;
    const q = quests.find(x => x.id === selectedQuestId);
    await updateQuest(q.id, {
        title: q.title,
        description: q.description,
        status: q.status,
        category: q.category,
        assigned_character: assignChar.value || '',
        session_date: q.session_date,
        campaign_date: q.campaign_date,
        objectives: q.objectives,
        notes: q.notes
    });
});

btnComplete.addEventListener('click', async () => {
    if (!selectedQuestId) return;
    const q = quests.find(x => x.id === selectedQuestId);
    await updateQuest(q.id, {
        title: q.title,
        description: q.description,
        status: 'completed',
        category: q.category,
        assigned_character: q.assigned_character,
        session_date: q.session_date,
        campaign_date: q.campaign_date,
        objectives: q.objectives,
        notes: q.notes
    });
});

btnAbandon.addEventListener('click', async () => {
    if (!selectedQuestId) return;
    const q = quests.find(x => x.id === selectedQuestId);
    await updateQuest(q.id, {
        title: q.title,
        description: q.description,
        status: 'failed',
        category: q.category,
        assigned_character: q.assigned_character,
        session_date: q.session_date,
        campaign_date: q.campaign_date,
        objectives: q.objectives,
        notes: q.notes
    });
});

// Filters
document.getElementById('q-filter-all').addEventListener('click', () => {
    filterMode = 'all';
    renderQuestList();
});
document.getElementById('q-filter-active').addEventListener('click', () => {
    filterMode = 'active';
    renderQuestList();
});
document.getElementById('q-filter-completed').addEventListener('click', () => {
    filterMode = 'completed';
    renderQuestList();
});
document.getElementById('q-filter-failed').addEventListener('click', () => {
    filterMode = 'failed';
    renderQuestList();
});

// Export
btnExportTimeline.addEventListener('click', () => {
    const all = { exportedAt: nowTs(), quests };
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ds-quests-timeline.json';
    a.click();
    URL.revokeObjectURL(url);
});

btnExport.addEventListener('click', () => {
    const out = JSON.stringify(quests, null, 2);
    const blob = new Blob([out], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ds-quests.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Load characters into assign select
async function populateAssignDropdown() {
    assignChar.innerHTML = '<option value="">— Assign to character —</option>';
    try {
        const characters = await apiCall('/api/characters');
        for (let c of characters) {
            const o = document.createElement('option');
            o.value = c.name;
            o.textContent = `${c.name} • ${c.class || ''} L${c.level || ''}`;
            assignChar.appendChild(o);
        }
    } catch (e) {
        console.error('Failed to load characters for dropdown:', e);
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadQuests();
    await populateAssignDropdown();
    renderQuestList();
    renderGlobalTimeline();
});