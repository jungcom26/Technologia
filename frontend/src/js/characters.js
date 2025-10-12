// characters.js - UPDATED VERSION (SQLite via API) - No sample characters
const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";

// DOM Elements
const rosterEl = document.getElementById('roster');
const charEmpty = document.getElementById('char-empty');
const charPanel = document.getElementById('char-panel');

const chToken = document.getElementById('ch-token');
const chName = document.getElementById('ch-name');
const chClass = document.getElementById('ch-class');
const chHp = document.getElementById('ch-hp');
const chAc = document.getElementById('ch-ac');
const chSpeed = document.getElementById('ch-speed');
const chConditions = document.getElementById('ch-conditions');

const btnDamage = document.getElementById('btn-damage');
const btnHeal = document.getElementById('btn-heal');
const btnShortRest = document.getElementById('btn-short-rest');
const btnLongRest = document.getElementById('btn-long-rest');

const rollType = document.getElementById('roll-type');
const abilitySelect = document.getElementById('ability');
const advSelect = document.getElementById('adv');
const btnRoll = document.getElementById('btn-roll');
const rollResult = document.getElementById('roll-result');

const chSpells = document.getElementById('ch-spells');
const chConcentrating = document.getElementById('ch-concentrating');
const btnConCheck = document.getElementById('btn-concentration-check');

const chProfEl = document.getElementById('ch-prof');

const btnNewChar = document.getElementById('btn-new-char');
const btnEditChar = document.getElementById('btn-edit-char');
const btnDeleteChar = document.getElementById('btn-delete-char');
const btnImportChars = document.getElementById('btn-import-chars');
const btnExportChars = document.getElementById('btn-export-chars');

let characters = [];
let selectedCharId = null;

// Helper functions
const uid = () => 'c_' + Math.random().toString(36).slice(2,9);
function calcProf(level) {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
}
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function rollD20() { return rollDie(20); }
function abilityMod(score) { return Math.floor((score - 10) / 2); }

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

// Load characters from SQLite
async function loadChars() {
    try {
        const data = await apiCall('/api/characters');
        characters = data;
    } catch (error) {
        console.error('Failed to load characters:', error);
        characters = [];
    }
}

// Character CRUD operations
async function createCharacter(characterData) {
    try {
        await apiCall('/api/characters', {
            method: 'POST',
            body: JSON.stringify(characterData)
        });
        await loadChars(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to create character:', error);
        return false;
    }
}

async function updateCharacter(characterId, characterData) {
    try {
        await apiCall(`/api/characters/${characterId}`, {
            method: 'PUT',
            body: JSON.stringify(characterData)
        });
        await loadChars(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to update character:', error);
        return false;
    }
}

async function deleteCharacter(characterId) {
    try {
        await apiCall(`/api/characters/${characterId}`, {
            method: 'DELETE'
        });
        await loadChars(); // Reload from server
        return true;
    } catch (error) {
        console.error('Failed to delete character:', error);
        return false;
    }
}

// Render functions
function renderRoster() {
    rosterEl.innerHTML = '';
    if (!characters.length) {
        rosterEl.innerHTML = '<div class="placeholder">No characters yet</div>';
        return;
    }
    for (let c of characters) {
        const el = document.createElement('div'); 
        el.className = 'card';
        el.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem">
            <div class="token">${c.name.charAt(0)}</div>
            <div style="flex:1">
                <strong>${c.name}</strong>
                <div class="meta">${c.class} L${c.level}</div>
            </div>
            <div style="text-align:right">
                <div class="pill hp">HP ${c.hp}/${c.max_hp}</div>
            </div>
        </div>`;
        el.addEventListener('click', ()=> selectChar(c.id));
        rosterEl.appendChild(el);
    }
}

function selectChar(id) {
    const c = characters.find(x => x.id === id);
    if (!c) return;
    selectedCharId = id;
    charEmpty.style.display = 'none';
    charPanel.style.display = 'block';

    chToken.textContent = c.name.charAt(0);
    chName.textContent = c.name;
    chClass.textContent = `${c.class} L${c.level}`;
    chHp.textContent = `HP ${c.hp}/${c.max_hp}`;
    chAc.textContent = `AC ${c.ac}`;
    chSpeed.textContent = `${c.speed} ft`;
    chProfEl.textContent = `+${calcProf(c.level)}`;

    // conditions
    chConditions.innerHTML = '';
    if (!c.conditions || !c.conditions.length) {
        chConditions.innerHTML = '<div class="placeholder">No conditions</div>';
    } else {
        for (let cond of c.conditions) {
            const p = document.createElement('div'); 
            p.className = 'pill'; 
            p.textContent = cond;
            p.addEventListener('click', async () => {
                if (!confirm(`Remove condition "${cond}"?`)) return;
                c.conditions = c.conditions.filter(x => x !== cond);
                await updateCharacter(c.id, {
                    name: c.name, class: c.class, level: c.level, 
                    hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
                    hit_die: c.hit_die, hit_dice: c.hit_dice,
                    str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
                    int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
                    conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
                });
                selectChar(c.id);
            });
            chConditions.appendChild(p);
        }
    }

    // spells
    chSpells.innerHTML = '';
    if (c.spells && c.spells.length) {
        for (let s of c.spells) {
            const div = document.createElement('div');
            div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
                <div>${s.name} ${s.conc ? '<small style="color:var(--muted)"> (concentration)</small>' : ''}</div>
                <div><button data-spell="${s.name}">${c.concentrating_on===s.name ? 'Stop' : 'Cast'}</button></div>
            </div>`;
            const btn = div.querySelector('button');
            btn.addEventListener('click', async () => {
                if (c.concentrating_on === s.name) {
                    c.concentrating_on = null;
                    chConcentrating.checked = false;
                    addSystemLog(`${c.name} ended concentration on ${s.name}`);
                } else {
                    c.concentrating_on = s.name;
                    chConcentrating.checked = true;
                    addSystemLog(`${c.name} is now concentrating on ${s.name}`);
                }
                await updateCharacter(c.id, {
                    name: c.name, class: c.class, level: c.level, 
                    hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
                    hit_die: c.hit_die, hit_dice: c.hit_dice,
                    str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
                    int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
                    conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
                });
                selectChar(c.id);
            });
            chSpells.appendChild(div);
        }
    } else {
        chSpells.innerHTML = '<div class="placeholder">No spells</div>';
    }
    chConcentrating.checked = !!c.concentrating_on;

    // show saves/roll defaults
    rollResult.innerHTML = '';
}

// Event Handlers
btnNewChar.addEventListener('click', async () => {
    const name = prompt('Character name');
    if (!name) return;
    const cls = prompt('Class') || 'Adventurer';
    const level = Number(prompt('Level', '1')) || 1;
    const maxHp = Number(prompt('Max HP', '8')) || 8;
    const con = Number(prompt('Constitution score', '12')) || 12;
    
    const characterData = {
        name, 
        class: cls, 
        level, 
        hp: maxHp, 
        max_hp: maxHp,
        ac: 10, 
        speed: 30, 
        hit_die: 8, 
        hit_dice: Math.max(1, Math.floor(level/2)),
        str_score: 10, 
        dex_score: 10, 
        con_score: con, 
        int_score: 10, 
        wis_score: 10, 
        cha_score: 10,
        conditions: [], 
        spells: [], 
        concentrating_on: null
    };
    
    const success = await createCharacter(characterData);
    if (success && characters.length > 0) {
        selectChar(characters[0].id);
    }
});

btnEditChar.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const c = characters.find(x => x.id === selectedCharId);
    const name = prompt('Name', c.name); 
    if (!name) return;
    
    const characterData = {
        name: name,
        class: prompt('Class', c.class) || c.class,
        level: Number(prompt('Level', c.level)) || c.level,
        max_hp: Number(prompt('Max HP', c.max_hp)) || c.max_hp,
        hp: Math.min(c.hp, Number(prompt('Current HP', c.hp)) || c.hp),
        ac: Number(prompt('AC', c.ac)) || c.ac,
        speed: Number(prompt('Speed', c.speed)) || c.speed,
        str_score: Number(prompt('STR', c.str_score)) || c.str_score,
        dex_score: Number(prompt('DEX', c.dex_score)) || c.dex_score,
        con_score: Number(prompt('CON', c.con_score)) || c.con_score,
        int_score: Number(prompt('INT', c.int_score)) || c.int_score,
        wis_score: Number(prompt('WIS', c.wis_score)) || c.wis_score,
        cha_score: Number(prompt('CHA', c.cha_score)) || c.cha_score,
        conditions: c.conditions || [],
        spells: c.spells || [],
        concentrating_on: c.concentrating_on
    };
    
    await updateCharacter(c.id, characterData);
});

btnDeleteChar.addEventListener('click', async () => {
    if (!selectedCharId) return;
    if (!confirm('Delete character?')) return;
    
    await deleteCharacter(selectedCharId);
    selectedCharId = null;
    charPanel.style.display = 'none';
    charEmpty.style.display = 'block';
});

btnDamage.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const dmg = Number(prompt('Damage amount', '1'));
    if (isNaN(dmg)) return;
    const c = characters.find(x => x.id === selectedCharId);
    c.hp = Math.max(0, c.hp - dmg);
    
    // if concentrating, perform automatic concentration check
    if (c.concentrating_on) {
        const dc = Math.max(10, Math.floor(dmg / 2));
        const roll = rollD20() + abilityMod(c.con_score) + calcProf(c.level);
        const success = roll >= dc;
        addSystemLog(`${c.name} took ${dmg} damage. Concentration DC ${dc} -> rolled ${roll} : ${success ? 'SUCCESS' : 'FAILED'}`);
        if (!success) { 
            c.concentrating_on = null; 
            chConcentrating.checked = false; 
        }
    } else {
        addSystemLog(`${c.name} took ${dmg} damage.`);
    }
    
    await updateCharacter(c.id, {
        name: c.name, class: c.class, level: c.level, 
        hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
        hit_die: c.hit_die, hit_dice: c.hit_dice,
        str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
        int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
        conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
    });
    selectChar(selectedCharId);
});

btnHeal.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const amt = Number(prompt('Heal amount', '1'));
    if (isNaN(amt)) return;
    const c = characters.find(x => x.id === selectedCharId);
    c.hp = Math.min(c.max_hp, c.hp + amt);
    addSystemLog(`${c.name} healed ${amt} HP.`);
    
    await updateCharacter(c.id, {
        name: c.name, class: c.class, level: c.level, 
        hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
        hit_die: c.hit_die, hit_dice: c.hit_dice,
        str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
        int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
        conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
    });
    selectChar(selectedCharId);
});

btnShortRest.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const c = characters.find(x => x.id === selectedCharId);
    const maxPossible = c.hit_dice || Math.max(1, Math.floor(c.level/2));
    const spent = Number(prompt(`Spend how many Hit Dice? (0-${maxPossible})`, '1'));
    if (isNaN(spent) || spent <= 0) return;
    const toSpend = Math.min(maxPossible, Math.floor(spent));
    let total = 0;
    for (let i=0;i<toSpend;i++){
        const roll = rollDie(c.hit_die);
        const add = roll + abilityMod(c.con_score);
        total += Math.max(0, add);
    }
    c.hp = Math.min(c.max_hp, c.hp + total);
    c.hit_dice = (c.hit_dice || maxPossible) - toSpend;
    addSystemLog(`${c.name} took a short rest, spent ${toSpend} HD and regained ${total} HP.`);
    
    await updateCharacter(c.id, {
        name: c.name, class: c.class, level: c.level, 
        hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
        hit_die: c.hit_die, hit_dice: c.hit_dice,
        str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
        int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
        conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
    });
    selectChar(selectedCharId);
});

btnLongRest.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const c = characters.find(x => x.id === selectedCharId);
    c.hp = c.max_hp;
    const recovered = Math.ceil((c.level || 1) / 2);
    c.hit_dice = Math.min(c.level, (c.hit_dice || 0) + recovered);
    c.conditions = [];
    c.concentrating_on = null;
    chConcentrating.checked = false;
    addSystemLog(`${c.name} finished a long rest. HP fully restored and recovered ${recovered} Hit Dice.`);
    
    await updateCharacter(c.id, {
        name: c.name, class: c.class, level: c.level, 
        hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
        hit_die: c.hit_die, hit_dice: c.hit_dice,
        str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
        int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
        conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
    });
    selectChar(selectedCharId);
});

btnRoll.addEventListener('click', () => {
    if (!selectedCharId) return;
    const c = characters.find(x => x.id === selectedCharId);
    const type = rollType.value;
    const ability = abilitySelect.value;
    const adv = advSelect.value;
    const mod = abilityMod(c[ability + '_score'] || 10);
    const prof = calcProf(c.level);
    
    let r1 = rollD20(), r2 = rollD20(), used;
    if (adv === 'adv') used = Math.max(r1, r2);
    else if (adv === 'dis') used = Math.min(r1, r2);
    else used = r1;
    
    let total = used + mod;
    let label = `${ability.toUpperCase()} check`;
    if (type === 'save') { 
        total += prof * 0; 
        label = `${ability.toUpperCase()} save`;
    }
    if (type === 'attack') { 
        total += prof; 
        label = 'Attack roll'; 
    }
    
    rollResult.innerHTML = `<div><strong>${label}</strong> — roll: ${used} ${adv === 'adv' ? '(adv)' : adv==='dis' ? '(dis)' : ''} + mod ${mod}${type==='attack'?(' + prof ('+prof+')'):''} = <strong>${total}</strong></div>`;
});

btnConCheck.addEventListener('click', async () => {
    if (!selectedCharId) return;
    const dmg = Number(prompt('Damage received (for concentration check)', '1'));
    if (isNaN(dmg) || dmg <= 0) return;
    const c = characters.find(x => x.id === selectedCharId);
    if (!c.concentrating_on) return alert('Character is not concentrating on a spell.');
    const dc = Math.max(10, Math.floor(dmg / 2));
    const roll = rollD20() + abilityMod(c.con_score);
    if (roll >= dc) {
        addSystemLog(`${c.name} passed concentration save (rolled ${roll} vs DC ${dc}).`);
    } else {
        addSystemLog(`${c.name} failed concentration save (rolled ${roll} vs DC ${dc}) and lost concentration on ${c.concentrating_on}.`);
        c.concentrating_on = null;
        chConcentrating.checked = false;
        
        await updateCharacter(c.id, {
            name: c.name, class: c.class, level: c.level, 
            hp: c.hp, max_hp: c.max_hp, ac: c.ac, speed: c.speed,
            hit_die: c.hit_die, hit_dice: c.hit_dice,
            str_score: c.str_score, dex_score: c.dex_score, con_score: c.con_score,
            int_score: c.int_score, wis_score: c.wis_score, cha_score: c.cha_score,
            conditions: c.conditions, spells: c.spells, concentrating_on: c.concentrating_on
        });
    }
    selectChar(selectedCharId);
});

// Utility functions
function addSystemLog(text) {
    const div = document.createElement('div');
    div.className = 'msg right';
    div.innerHTML = `<div class="avatar">S</div><div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} • System</div>${text}</div>`;
    rosterEl.insertBefore(div, rosterEl.firstChild);
    setTimeout(()=> div.remove(), 6000);
}

// Import/Export
btnExportChars.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'ds-characters.json'; 
    a.click();
    URL.revokeObjectURL(url);
});

btnImportChars.addEventListener('click', async () => {
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
                
                // Import each character
                for (let char of data) {
                    // Ensure all required fields
                    const characterData = {
                        name: char.name || 'Unknown',
                        class: char.class || char.cls || 'Adventurer',
                        level: char.level || 1,
                        hp: char.hp || 1,
                        max_hp: char.max_hp || char.maxHp || 1,
                        ac: char.ac || 10,
                        speed: char.speed || 30,
                        hit_die: char.hit_die || char.hitDie || 8,
                        hit_dice: char.hit_dice || char.hitDice || 1,
                        str_score: char.str_score || char.str || 10,
                        dex_score: char.dex_score || char.dex || 10,
                        con_score: char.con_score || char.con || 10,
                        int_score: char.int_score || char.int || 10,
                        wis_score: char.wis_score || char.wis || 10,
                        cha_score: char.cha_score || char.cha || 10,
                        conditions: char.conditions || [],
                        spells: char.spells || [],
                        concentrating_on: char.concentrating_on || char.concentratingOn || null
                    };
                    
                    await createCharacter(characterData);
                }
                
                alert('Characters imported successfully.');
            } catch (e) { 
                alert('Import failed: ' + e.message); 
            }
        };
        r.readAsText(f);
    });
    input.click();
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadChars();
    renderRoster();
});