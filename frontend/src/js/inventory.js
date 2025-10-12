// inventory.js - UPDATED VERSION (SQLite via API)
const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";

// DOM Elements
const itemsEl = document.getElementById('items');
const itemsPlaceholder = document.getElementById('items-placeholder');
const invStatsEl = document.getElementById('inv-stats');
const searchInput = document.getElementById('inv-search');

const detailPanel = document.getElementById('detail-panel');
const detailView = document.getElementById('detail-view');
const detailEmpty = document.getElementById('detail-empty');
const detailName = document.getElementById('detail-name');
const detailDesc = document.getElementById('detail-desc');
const detailType = document.getElementById('detail-type');
const detailWeight = document.getElementById('detail-weight');
const detailQty = document.getElementById('detail-qty');

const btnUse = document.getElementById('btn-use');
const btnToggleEquip = document.getElementById('btn-toggle-equip');
const btnEdit = document.getElementById('btn-edit');
const btnDelete = document.getElementById('btn-delete');

const addForm = document.getElementById('add-form');
const btnSeed = document.getElementById('btn-seed');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const btnClear = document.getElementById('btn-clear');

let inventory = [];
let selectedId = null;
let activeFilter = 'all';

// Helper functions
const uid = () => 'i_' + Math.random().toString(36).slice(2,9);

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

// Load inventory from SQLite
async function loadInventory() {
    try {
        const data = await apiCall('/api/inventory');
        inventory = data;
    } catch (error) {
        console.error('Failed to load inventory:', error);
        inventory = [];
    }
}

// Inventory CRUD operations
async function createInventoryItem(itemData) {
    try {
        await apiCall('/api/inventory', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
        await loadInventory(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to create item:', error);
        return false;
    }
}

async function updateInventoryItem(itemId, itemData) {
    try {
        // For update, we'll delete and recreate since we don't have PUT endpoint
        await deleteInventoryItem(itemId);
        await createInventoryItem(itemData);
        return true;
    } catch (error) {
        console.error('Failed to update item:', error);
        return false;
    }
}

async function deleteInventoryItem(itemId) {
    try {
        await apiCall(`/api/inventory/${itemId}`, {
            method: 'DELETE'
        });
        await loadInventory(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to delete item:', error);
        return false;
    }
}

// Render functions
function renderStats() {
    const totalItems = inventory.reduce((s,i) => s + (i.quantity || 1), 0);
    const totalWeight = inventory.reduce((s,i) => s + (i.weight || 0) * (i.quantity || 1), 0);
    invStatsEl.innerHTML = `<div>Total items: <strong>${totalItems}</strong></div>
        <div>Total weight: <strong>${totalWeight.toFixed(1)} lb</strong></div>`;
}

function renderList(filterText = '') {
    itemsEl.innerHTML = '';
    const filtered = inventory.filter(it => {
        if (activeFilter !== 'all' && it.type.toLowerCase() !== activeFilter) return false;
        if (!filterText) return true;
        const t = filterText.toLowerCase();
        return (it.name + ' ' + (it.description || '') + ' ' + (it.type || '')).toLowerCase().includes(t);
    });

    if (filtered.length === 0) {
        itemsPlaceholder.style.display = 'block';
    } else {
        itemsPlaceholder.style.display = 'none';
        for (let it of filtered) {
            const div = document.createElement('div');
            div.className = 'msg';
            div.dataset.id = it.id;
            div.innerHTML = `
                <div class="avatar">${(it.name || '').charAt(0)}</div>
                <div class="bubble">
                    <div class="meta">${it.name} • <span style="color:var(--muted)">${it.type}</span></div>
                    <div style="font-size:.95rem">${it.description || ''}</div>
                    <small style="display:block;margin-top:.4rem;color:var(--muted)">Qty: ${it.quantity} • ${it.weight} lb each</small>
                </div>`;
            div.addEventListener('click', () => selectItem(it.id));
            itemsEl.appendChild(div);
        }
    }
}

function selectItem(id) {
    const it = inventory.find(x => x.id === id);
    if (!it) return;
    selectedId = id;
    detailEmpty.style.display = 'none';
    detailView.style.display = 'block';
    detailName.textContent = it.name;
    detailDesc.textContent = it.description || '';
    detailType.textContent = it.type;
    detailWeight.textContent = `${it.weight} lb`;
    detailQty.textContent = `Qty ${it.quantity}`;
    btnUse.disabled = (it.quantity <= 0 || it.type === 'armor');
    btnToggleEquip.textContent = it.equipped ? 'Unequip' : 'Equip';
}

// Event Handlers
btnUse.addEventListener('click', async () => {
    if (!selectedId) return;
    const it = inventory.find(x => x.id === selectedId);
    if (!it) return;
    if (it.quantity > 0) {
        it.quantity = Math.max(0, it.quantity - 1);
        addLogSystem(`${it.name} used (qty now ${it.quantity})`);
        
        await updateInventoryItem(it.id, {
            name: it.name,
            type: it.type,
            description: it.description,
            weight: it.weight,
            quantity: it.quantity,
            equipped: it.equipped,
            character_id: it.character_id
        });
        
        renderList(searchInput.value);
        selectItem(selectedId);
    }
});

btnToggleEquip.addEventListener('click', async () => {
    if (!selectedId) return;
    const it = inventory.find(x => x.id === selectedId);
    if (!it) return;
    it.equipped = !it.equipped;
    addLogSystem(`${it.name} ${it.equipped ? 'equipped' : 'unequipped'}`);
    
    await updateInventoryItem(it.id, {
        name: it.name,
        type: it.type,
        description: it.description,
        weight: it.weight,
        quantity: it.quantity,
        equipped: it.equipped,
        character_id: it.character_id
    });
    
    renderList(searchInput.value);
    selectItem(selectedId);
});

btnDelete.addEventListener('click', async () => {
    if (!selectedId) return;
    await deleteInventoryItem(selectedId);
    addLogSystem('Item deleted.');
    selectedId = null;
    renderList(searchInput.value);
    detailEmpty.style.display = 'block';
    detailView.style.display = 'none';
});

btnEdit.addEventListener('click', async () => {
    if (!selectedId) return;
    const it = inventory.find(x => x.id === selectedId);
    if (!it) return;
    const newName = prompt('Item name', it.name);
    if (newName === null) return;
    
    const itemData = {
        name: newName,
        type: prompt('Type', it.type) || it.type,
        description: prompt('Description', it.description) || it.description,
        quantity: Number(prompt('Quantity', it.quantity)) || it.quantity,
        weight: Number(prompt('Weight (lb)', it.weight)) || it.weight,
        equipped: it.equipped,
        character_id: it.character_id
    };
    
    await updateInventoryItem(it.id, itemData);
    renderList(searchInput.value);
    selectItem(selectedId);
});

// Add items
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-name').value.trim();
    const type = document.getElementById('new-type').value.trim().toLowerCase() || 'misc';
    const description = document.getElementById('new-desc').value.trim();
    const weight = parseFloat(document.getElementById('new-weight').value) || 0;
    const quantity = parseInt(document.getElementById('new-qty').value) || 1;
    if (!name) return alert('Name required');

    const itemData = {
        name,
        type,
        description,
        weight,
        quantity,
        equipped: false,
        character_id: null
    };
    
    await createInventoryItem(itemData);
    addForm.reset();
});

// Seed sample (optional - can remove if not needed)
btnSeed.addEventListener('click', async () => {
    if (!confirm('Load sample items (will add to your inventory)?')) return;
    
    const sampleItems = [
        { name: "Shortsword", type: "weapon", description: "Versatile + simple", weight: 2, quantity: 1, equipped: true },
        { name: "Leather Armor", type: "armor", description: "Light armor", weight: 10, quantity: 1, equipped: true },
        { name: "Healing Potion", type: "consumable", description: "Heals 2d4+2 HP", weight: 0.5, quantity: 3, equipped: false },
        { name: "Cloak of Elvenkind", type: "magic", description: "Advantage on stealth checks", weight: 1, quantity: 1, equipped: false }
    ];

    for (let item of sampleItems) {
        await createInventoryItem(item);
    }
});

// Import/Export
btnExport.addEventListener('click', () => {
    const out = JSON.stringify(inventory, null, 2);
    const blob = new Blob([out], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ds-inventory.json';
    a.click();
    URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
        const f = input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async () => {
            try {
                const data = JSON.parse(r.result);
                if (!Array.isArray(data)) throw new Error('Invalid format');
                
                for (let item of data) {
                    const itemData = {
                        name: item.name || 'Unknown Item',
                        type: item.type || 'misc',
                        description: item.description || '',
                        weight: item.weight || 0,
                        quantity: item.quantity || 1,
                        equipped: item.equipped || false,
                        character_id: item.character_id || null
                    };
                    await createInventoryItem(itemData);
                }
                alert('Import complete.');
            } catch (e) {
                alert('Import failed: ' + e.message);
            }
        };
        r.readAsText(f);
    });
    input.click();
});

btnClear.addEventListener('click', async () => {
    if (!confirm('Clear inventory? This cannot be undone.')) return;
    
    // Delete all items one by one
    for (const item of inventory) {
        await deleteInventoryItem(item.id);
    }
    
    detailEmpty.style.display = 'block';
    detailView.style.display = 'none';
});

// Filters & search
document.getElementById('filter-all').addEventListener('click', () => {
    activeFilter = 'all';
    renderList(searchInput.value);
});
document.getElementById('filter-weapons').addEventListener('click', () => {
    activeFilter = 'weapon';
    renderList(searchInput.value);
});
document.getElementById('filter-armor').addEventListener('click', () => {
    activeFilter = 'armor';
    renderList(searchInput.value);
});
document.getElementById('filter-consumables').addEventListener('click', () => {
    activeFilter = 'consumable';
    renderList(searchInput.value);
});
document.getElementById('filter-magic').addEventListener('click', () => {
    activeFilter = 'magic';
    renderList(searchInput.value);
});

searchInput.addEventListener('input', (e) => renderList(e.target.value));

// Utility functions
function addLogSystem(text) {
    const msg = document.createElement('div');
    msg.className = 'msg right';
    msg.innerHTML = `
        <div class="avatar">S</div>
        <div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} • System</div>${text}</div>
    `;
    itemsEl.insertBefore(msg, itemsEl.firstChild);
    const msgs = itemsEl.querySelectorAll('.msg.right');
    if (msgs.length > 6) msgs[msgs.length - 1].remove();
}

// Quick populate character tokens for equip targets
function renderCharMiniRow() {
    const row = document.getElementById('char-mini-row');
    row.innerHTML = '';
    // This would need to load characters from the characters API
    // For now, we'll keep it simple or remove if not essential
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadInventory();
    renderList();
    renderStats();
    renderCharMiniRow();
});