// Inventory page JS
// Persistence key
const STORAGE_KEY = 'ds_inventory_v1';
const CHAR_KEY = 'ds_characters_v1'; // used for quick equip targets

// DOM
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

// helper id
const uid = () => 'i_' + Math.random().toString(36).slice(2,9);

// sample data
const sampleItems = [
  { id: uid(), name: "Shortsword", type: "weapon", desc: "Versatile + simple", weight: 2, qty: 1, equipped: true },
  { id: uid(), name: "Leather Armor", type: "armor", desc: "Light armor", weight: 10, qty: 1, equipped: true },
  { id: uid(), name: "Healing Potion", type: "consumable", desc: "Heals 2d4+2 HP", weight: 0.5, qty: 3, equipped: false },
  { id: uid(), name: "Cloak of Elvenkind", type: "magic", desc: "Advantage on stealth checks", weight: 1, qty: 1, equipped: false }
];

// INIT
function loadInventory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { inventory = JSON.parse(raw); }
    catch(e){ inventory = sampleItems.slice(); saveInventory(); }
  } else {
    inventory = sampleItems.slice();
    saveInventory();
  }
}

function saveInventory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  renderStats();
}

function renderStats() {
  const totalItems = inventory.reduce((s,i)=>s + (i.qty||1),0);
  const totalWeight = inventory.reduce((s,i)=>s + (i.weight || 0) * (i.qty || 1),0);
  invStatsEl.innerHTML = `<div>Total items: <strong>${totalItems}</strong></div>
    <div>Total weight: <strong>${totalWeight.toFixed(1)} lb</strong></div>`;
}

// rendering list
function renderList(filterText='') {
  itemsEl.innerHTML = '';
  const filtered = inventory.filter(it => {
    if (activeFilter !== 'all' && it.type.toLowerCase() !== activeFilter) return false;
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return (it.name + ' ' + (it.desc||'') + ' ' + (it.type||'')).toLowerCase().includes(t);
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
        <div class="avatar">${(it.name||'').charAt(0)}</div>
        <div class="bubble">
          <div class="meta">${it.name} • <span style="color:var(--muted)">${it.type}</span></div>
          <div style="font-size:.95rem">${it.desc || ''}</div>
          <small style="display:block;margin-top:.4rem;color:var(--muted)">Qty: ${it.qty} • ${it.weight} lb each</small>
        </div>`;
      div.addEventListener('click', () => selectItem(it.id));
      itemsEl.appendChild(div);
    }
  }
}

// select & detail
function selectItem(id) {
  const it = inventory.find(x => x.id === id);
  if (!it) return;
  selectedId = id;
  detailEmpty.style.display = 'none';
  detailView.style.display = 'block';
  detailName.textContent = it.name;
  detailDesc.textContent = it.desc || '';
  detailType.textContent = it.type;
  detailWeight.textContent = `${it.weight} lb`;
  detailQty.textContent = `Qty ${it.qty}`;
  btnUse.disabled = (it.qty <= 0 || it.type === 'armor' );
  btnToggleEquip.textContent = it.equipped ? 'Unequip' : 'Equip';
}

// actions
btnUse.addEventListener('click', () => {
  if (!selectedId) return;
  const it = inventory.find(x => x.id === selectedId);
  if (!it) return;
  if (it.qty > 0) {
    it.qty = Math.max(0, it.qty - 1);
    addLogSystem(`${it.name} used (qty now ${it.qty})`);
    if (it.qty === 0) {
      // autoprompt delete? for now keep with qty 0
    }
    saveInventory();
    renderList(searchInput.value);
    selectItem(selectedId);
  }
});

btnToggleEquip.addEventListener('click', () => {
  if (!selectedId) return;
  const it = inventory.find(x => x.id === selectedId);
  if (!it) return;
  it.equipped = !it.equipped;
  addLogSystem(`${it.name} ${it.equipped ? 'equipped' : 'unequipped'}`);
  saveInventory();
  renderList(searchInput.value);
  selectItem(selectedId);
});

btnDelete.addEventListener('click', () => {
  if (!selectedId) return;
  inventory = inventory.filter(i => i.id !== selectedId);
  addLogSystem('Item deleted.');
  selectedId = null;
  saveInventory();
  renderList(searchInput.value);
  detailEmpty.style.display = 'block';
  detailView.style.display = 'none';
});

btnEdit.addEventListener('click', () => {
  if (!selectedId) return;
  const it = inventory.find(x => x.id === selectedId);
  if (!it) return;
  const newName = prompt('Item name', it.name);
  if (newName === null) return;
  it.name = newName;
  it.desc = prompt('Description', it.desc) || it.desc;
  it.type = prompt('Type', it.type) || it.type;
  it.qty = Number(prompt('Quantity', it.qty)) || it.qty;
  it.weight = Number(prompt('Weight (lb)', it.weight)) || it.weight;
  saveInventory();
  renderList(searchInput.value);
  selectItem(selectedId);
});

// add items
addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('new-name').value.trim();
  const type = document.getElementById('new-type').value.trim().toLowerCase() || 'misc';
  const desc = document.getElementById('new-desc').value.trim();
  const weight = parseFloat(document.getElementById('new-weight').value) || 0;
  const qty = parseInt(document.getElementById('new-qty').value) || 1;
  if (!name) return alert('Name required');

  const it = { id: uid(), name, type, desc, weight, qty, equipped: false };
  inventory.unshift(it);
  saveInventory();
  renderList(searchInput.value);
  addForm.reset();
});

// seed sample
btnSeed.addEventListener('click', () => {
  if (!confirm('Load sample items (will add to your inventory)?')) return;
  for (let s of sampleItems) inventory.unshift({...s, id: uid()});
  saveInventory();
  renderList('');
});

// import/export
btnExport.addEventListener('click', () => {
  const out = JSON.stringify(inventory, null, 2);
  const blob = new Blob([out], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ds-inventory.json'; a.click();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json';
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        // merge imported items
        for (let it of data) it.id = it.id || uid();
        inventory = data.concat(inventory);
        saveInventory();
        renderList('');
        alert('Import complete.');
      } catch (e) { alert('Import failed: ' + e.message); }
    };
    r.readAsText(f);
  });
  input.click();
});

btnClear.addEventListener('click', () => {
  if (!confirm('Clear inventory? This cannot be undone.')) return;
  inventory = [];
  saveInventory();
  renderList('');
  detailEmpty.style.display = 'block';
  detailView.style.display = 'none';
});

// filters & search
document.getElementById('filter-all').addEventListener('click', ()=> { activeFilter = 'all'; renderList(searchInput.value); });
document.getElementById('filter-weapons').addEventListener('click', ()=> { activeFilter = 'weapon'; renderList(searchInput.value); });
document.getElementById('filter-armor').addEventListener('click', ()=> { activeFilter = 'armor'; renderList(searchInput.value); });
document.getElementById('filter-consumables').addEventListener('click', ()=> { activeFilter = 'consumable'; renderList(searchInput.value); });
document.getElementById('filter-magic').addEventListener('click', ()=> { activeFilter = 'magic'; renderList(searchInput.value); });

searchInput.addEventListener('input', (e) => renderList(e.target.value));

// small system log (adds ephemeral messages to top of the items area)
function addLogSystem(text) {
  const msg = document.createElement('div');
  msg.className = 'msg right';
  msg.innerHTML = `
    <div class="avatar">S</div>
    <div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} • System</div>${text}</div>
  `;
  itemsEl.insertBefore(msg, itemsEl.firstChild);
  // remove after a few messages
  const msgs = itemsEl.querySelectorAll('.msg.right');
  if (msgs.length > 6) msgs[msgs.length - 1].remove();
}

// quick populate character tokens for equip targets
function renderCharMiniRow() {
  const row = document.getElementById('char-mini-row');
  row.innerHTML = '';
  const raw = localStorage.getItem(CHAR_KEY);
  let chars = [];
  if (raw) {
    try { chars = JSON.parse(raw); } catch(e){}
  } else {
    // create demo characters if none exist
    chars = [
      { id: 'c1', name: 'Kyra', cls: 'Warlock', level: 1 },
      { id: 'c2', name: 'Thorne', cls: 'Rogue', level: 1 },
      { id: 'c3', name: 'Seren', cls: 'Cleric', level: 1 }
    ];
    localStorage.setItem(CHAR_KEY, JSON.stringify(chars));
  }
  for (let c of chars) {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.minWidth = '160px';
    card.style.padding = '.5rem';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem">
        <div class="token">${c.name.charAt(0)}</div>
        <div><strong>${c.name}</strong><div class="meta">${c.cls} L${c.level}</div></div>
      </div>
    `;
    row.appendChild(card);
  }
}

// initial load
loadInventory();
renderList();
renderStats();
renderCharMiniRow();