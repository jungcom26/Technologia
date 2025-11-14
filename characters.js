// Characters page JS - provides robust D&D-style helpers including rolls, rests, concentration checks
const CHAR_KEY = 'ds_characters_v1';

// DOM
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

// helper uid
const uid = () => 'c_' + Math.random().toString(36).slice(2,9);
const now = () => new Date().toISOString();

// proficiency progression (5e): 1-4:+2, 5-8:+3,9-12:+4,13-16:+5,17-20:+6
function calcProf(level) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

// seed characters
function loadChars() {
  const raw = localStorage.getItem(CHAR_KEY);
  if (raw) {
    try { characters = JSON.parse(raw); } catch(e) { characters = []; saveChars(); }
  } else {
    characters = [
      { id: uid(), name: 'Kyra', cls: 'Warlock', level: 3, hp: 18, maxHp: 18, ac: 12, speed: 30, hitDie: 8, hitDice: 3, con: 14, str:10,dex:12,int:11,wis:13,cha:16, conditions: [], spells: [{name:'Hex', conc:true},{name:'Eldritch Blast', conc:false}], concentratingOn: null },
      { id: uid(), name: 'Thorne', cls: 'Rogue', level: 2, hp: 14, maxHp: 14, ac: 14, speed: 30, hitDie:8, hitDice:2, con:12, str:10,dex:16,int:12,wis:11,cha:10, conditions: [], spells: [], concentratingOn: null },
      { id: uid(), name: 'Seren', cls: 'Cleric', level: 3, hp: 22, maxHp: 22, ac: 18, speed: 30, hitDie:8, hitDice:3, con:14, str:10,dex:10,int:12,wis:16,cha:13, conditions: [], spells: [{name:'Bless', conc:true}], concentratingOn: null }
    ];
    saveChars();
  }
}

function saveChars() { localStorage.setItem(CHAR_KEY, JSON.stringify(characters)); renderRoster(); }

function renderRoster() {
  rosterEl.innerHTML = '';
  if (!characters.length) {
    rosterEl.innerHTML = '<div class="placeholder">No characters yet</div>';
    return;
  }
  for (let c of characters) {
    const el = document.createElement('div'); el.className = 'card';
    el.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem">
      <div class="token">${c.name.charAt(0)}</div>
      <div style="flex:1">
        <strong>${c.name}</strong>
        <div class="meta">${c.cls} L${c.level}</div>
      </div>
      <div style="text-align:right">
        <div class="pill hp">HP ${c.hp}/${c.maxHp}</div>
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
  chClass.textContent = `${c.cls} L${c.level}`;
  chHp.textContent = `HP ${c.hp}/${c.maxHp}`;
  chAc.textContent = `AC ${c.ac}`;
  chSpeed.textContent = `${c.speed} ft`;
  chProfEl.textContent = `+${calcProf(c.level)}`;

  // conditions
  chConditions.innerHTML = '';
  if (!c.conditions || !c.conditions.length) {
    chConditions.innerHTML = '<div class="placeholder">No conditions</div>';
  } else {
    for (let cond of c.conditions) {
      const p = document.createElement('div'); p.className = 'pill'; p.textContent = cond;
      p.addEventListener('click', () => {
        if (!confirm(`Remove condition "${cond}"?`)) return;
        c.conditions = c.conditions.filter(x => x !== cond);
        saveChars();
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
        <div><button data-spell="${s.name}">${c.concentratingOn===s.name ? 'Stop' : 'Cast'}</button></div>
      </div>`;
      const btn = div.querySelector('button');
      btn.addEventListener('click', () => {
        if (c.concentratingOn === s.name) {
          c.concentratingOn = null;
          chConcentrating.checked = false;
          addSystemLog(`${c.name} ended concentration on ${s.name}`);
        } else {
          c.concentratingOn = s.name;
          chConcentrating.checked = true;
          addSystemLog(`${c.name} is now concentrating on ${s.name}`);
        }
        saveChars();
        selectChar(c.id);
      });
      chSpells.appendChild(div);
    }
  } else {
    chSpells.innerHTML = '<div class="placeholder">No spells</div>';
  }
  chConcentrating.checked = !!c.concentratingOn;

  // show saves/roll defaults
  rollResult.innerHTML = '';
}

// damage/heal
btnDamage.addEventListener('click', () => {
  if (!selectedCharId) return;
  const dmg = Number(prompt('Damage amount', '1'));
  if (isNaN(dmg)) return;
  const c = characters.find(x => x.id === selectedCharId);
  c.hp = Math.max(0, c.hp - dmg);
  // if concentrating, perform automatic concentration check (DC = max(10, damage/2))
  if (c.concentratingOn) {
    const dc = Math.max(10, Math.floor(dmg / 2));
    const roll = rollD20() + abilityMod(c.con) + calcProf(c.level); // we approximate using Con + prof for saving
    const success = roll >= dc;
    addSystemLog(`${c.name} took ${dmg} damage. Concentration DC ${dc} -> rolled ${roll} : ${success ? 'SUCCESS' : 'FAILED'}`);
    if (!success) { c.concentratingOn = null; chConcentrating.checked = false; }
  } else {
    addSystemLog(`${c.name} took ${dmg} damage.`);
  }
  saveChars();
  selectChar(selectedCharId);
});

btnHeal.addEventListener('click', () => {
  if (!selectedCharId) return;
  const amt = Number(prompt('Heal amount', '1'));
  if (isNaN(amt)) return;
  const c = characters.find(x => x.id === selectedCharId);
  c.hp = Math.min(c.maxHp, c.hp + amt);
  addSystemLog(`${c.name} healed ${amt} HP.`);
  saveChars();
  selectChar(selectedCharId);
});

// rests
// short rest: player may spend hit dice (at least 1 hour - see rules). We implement spending dice.
btnShortRest.addEventListener('click', () => {
  if (!selectedCharId) return;
  const c = characters.find(x => x.id === selectedCharId);
  const maxPossible = c.hitDice || Math.max(1, Math.floor(c.level/2));
  const spent = Number(prompt(`Spend how many Hit Dice? (0-${maxPossible})`, '1'));
  if (isNaN(spent) || spent <= 0) return;
  const toSpend = Math.min(maxPossible, Math.floor(spent));
  let total = 0;
  for (let i=0;i<toSpend;i++){
    const roll = rollDie(c.hitDie);
    const add = roll + abilityMod(c.con);
    total += Math.max(0, add);
  }
  c.hp = Math.min(c.maxHp, c.hp + total);
  c.hitDice = (c.hitDice || maxPossible) - toSpend;
  addSystemLog(`${c.name} took a short rest, spent ${toSpend} HD and regained ${total} HP.`);
  saveChars();
  selectChar(selectedCharId);
});

// long rest: restore HP to max and recover half of hit dice (rounded up)
btnLongRest.addEventListener('click', () => {
  if (!selectedCharId) return;
  const c = characters.find(x => x.id === selectedCharId);
  c.hp = c.maxHp;
  const recovered = Math.ceil((c.level || 1) / 2);
  c.hitDice = Math.min(c.level, (c.hitDice || 0) + recovered);
  // clear conditions except some persistent ones - for simplicity clear them
  c.conditions = [];
  c.concentratingOn = null;
  chConcentrating.checked = false;
  addSystemLog(`${c.name} finished a long rest. HP fully restored and recovered ${recovered} Hit Dice.`);
  saveChars();
  selectChar(selectedCharId);
});

// rolls
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function rollD20() { return rollDie(20); }
function abilityMod(score) { return Math.floor((score - 10) / 2); }

btnRoll.addEventListener('click', () => {
  if (!selectedCharId) return;
  const c = characters.find(x => x.id === selectedCharId);
  const type = rollType.value;
  const ability = abilitySelect.value;
  const adv = advSelect.value;
  const mod = abilityMod(c[ability] || 10);
  const prof = calcProf(c.level);
  // advantage/disadvantage logic
  let r1 = rollD20(), r2 = rollD20(), used;
  if (adv === 'adv') used = Math.max(r1, r2);
  else if (adv === 'dis') used = Math.min(r1, r2);
  else used = r1;
  let total = used + mod;
  let label = `${ability.toUpperCase()} check`;
  if (type === 'save') { total += prof * 0; label = `${ability.toUpperCase()} save`; /* hook for proficiency if saving throw proficient */ }
  if (type === 'attack') { total += prof; label = 'Attack roll'; }
  rollResult.innerHTML = `<div><strong>${label}</strong> — roll: ${used} ${adv === 'adv' ? '(adv)' : adv==='dis' ? '(dis)' : ''} + mod ${mod}${type==='attack'?(' + prof ('+prof+')'):''} = <strong>${total}</strong></div>`;
});

// concentration helper: when a character is concentrating and receives damage, DC = max(10, damage/2) (per rules)
btnConCheck.addEventListener('click', () => {
  if (!selectedCharId) return;
  const dmg = Number(prompt('Damage received (for concentration check)', '1'));
  if (isNaN(dmg) || dmg <= 0) return;
  const c = characters.find(x => x.id === selectedCharId);
  if (!c.concentratingOn) return alert('Character is not concentrating on a spell.');
  const dc = Math.max(10, Math.floor(dmg / 2));
  const roll = rollD20() + abilityMod(c.con);
  if (roll >= dc) {
    addSystemLog(`${c.name} passed concentration save (rolled ${roll} vs DC ${dc}).`);
  } else {
    addSystemLog(`${c.name} failed concentration save (rolled ${roll} vs DC ${dc}) and lost concentration on ${c.concentratingOn}.`);
    c.concentratingOn = null;
    chConcentrating.checked = false;
  }
  saveChars();
  selectChar(selectedCharId);
});

// small utilities
function addSystemLog(text) {
  // transient toast-like log
  const div = document.createElement('div');
  div.className = 'msg right';
  div.innerHTML = `<div class="avatar">S</div><div class="bubble"><div class="meta">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} • System</div>${text}</div>`;
  // append at top of roster for visibility
  rosterEl.insertBefore(div, rosterEl.firstChild);
  setTimeout(()=> div.remove(), 6000);
}

// new char
btnNewChar.addEventListener('click', () => {
  const name = prompt('Character name');
  if (!name) return;
  const cls = prompt('Class') || 'Adventurer';
  const level = Number(prompt('Level', '1')) || 1;
  const maxHp = Number(prompt('Max HP', '8')) || 8;
  const con = Number(prompt('Constitution score', '12')) || 12;
  const c = { id: uid(), name, cls, level, hp: maxHp, maxHp, ac: 10, speed: 30, hitDie: 8, hitDice: Math.max(1, Math.floor(level/2)), con, str:10,dex:10,int:10,wis:10,cha:10, conditions: [], spells: [], concentratingOn: null };
  characters.push(c);
  saveChars();
  selectChar(c.id);
});

// edit / delete
btnEditChar.addEventListener('click', () => {
  if (!selectedCharId) return;
  const c = characters.find(x => x.id === selectedCharId);
  const name = prompt('Name', c.name); if (!name) return;
  c.name = name;
  c.cls = prompt('Class', c.cls) || c.cls;
  c.level = Number(prompt('Level', c.level)) || c.level;
  c.maxHp = Number(prompt('Max HP', c.maxHp)) || c.maxHp;
  c.hp = Math.min(c.hp, c.maxHp);
  saveChars();
  selectChar(c.id);
});

btnDeleteChar.addEventListener('click', () => {
  if (!selectedCharId) return;
  if (!confirm('Delete character?')) return;
  characters = characters.filter(x => x.id !== selectedCharId);
  selectedCharId = null;
  saveChars();
  charPanel.style.display = 'none';
  charEmpty.style.display = 'block';
});

// import / export
btnExportChars.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ds-characters.json'; a.click();
  URL.revokeObjectURL(url);
});

btnImportChars.addEventListener('click', () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
  input.addEventListener('change', () => {
    const f = input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        for (let c of data) c.id = c.id || uid();
        characters = data.concat(characters);
        saveChars();
        alert('Characters imported.');
      } catch (e) { alert('Import failed: ' + e.message); }
    };
    r.readAsText(f);
  });
  input.click();
});

// initial
loadChars();
renderRoster();