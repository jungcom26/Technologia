/* Dungeon Scribe — characters.js
   - Fully local: no external AI calls
   - Plain text PDF export (clean readable layout)
   - Local chatbot (rule-based + character-aware)
*/

/* --------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = () => 'c_' + Math.random().toString(36).slice(2,9);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rollDie = s => Math.floor(Math.random()*s)+1;
const abilityMod = s => Math.floor((s-10)/2);

/* --------- State & DOM ---------- */
let characters = [];
let selectedId = null;

const rosterEl = $('#roster');
const searchEl = $('#search');
const placeholder = $('#placeholder');
const charView = $('#char-view');

const btnNew = $('#btn-new');
const modal = $('#modal');
const form = $('#form');
const btnCancel = $('#cancel');
const btnExportPlain = $('#btn-export-plain');
const btnExportCard = $('#btn-export-card');
const btnAoe = $('#btn-aoe');
const diceSound = $('#dice-sound');

/* --------- Persistence ---------- */
const STORAGE_KEY = 'ds_characters_complete_v1';
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(characters)); }
function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ characters = JSON.parse(raw); }
    catch{ characters = []; }
  }
  if(!characters || !characters.length){
    // Seed with a nice example character
    characters = [{
      id: uid(),
      name: 'Kyra Bright',
      race: 'Tiefling',
      background: 'Acolyte',
      cls: 'Warlock',
      subclass: 'The Fiend',
      level: 3, xp: 900,
      alignment: 'Chaotic Neutral',
      maxHp: 18, hp: 18, tempHp: 0, ac: 12, initiative: 1, speed: 30,
      hitDie: 'd8', hitDice: 3,
      str: 10, dex: 12, con: 14, int: 11, wis: 13, cha: 16,
      prof: 2,
      savingThrows: 'CON, CHA',
      skills: 'Arcana, Intimidation',
      languages: 'Common, Infernal',
      spells: 'Eldritch Blast, Hex',
      spellSlots: '1:4,2:2',
      spellcastingAbility: 'CHA', spellDC: 13, spellAttack: 5,
      equipment: 'Quarterstaff, Leather Armor, Component pouch',
      gp: '12 / 3 / 7',
      features: 'Dark One\'s Blessing',
      personality: 'A gentle voice with sharp edges.',
      ideals: 'Freedom',
      bonds: 'Protect her mentor',
      flaws: 'Quick temper',
      backstory: 'Grew up on the streets — made a pact to survive.',
      notes: '',
      conditions: []
    }];
    save();
  }
}

/* --------- Render Roster ---------- */
function renderRoster(filter=''){
  rosterEl.innerHTML = '';
  const q = (filter || '').toLowerCase().trim();
  const list = characters.filter(c => !q || (c.name&&c.name.toLowerCase().includes(q)) || (c.cls && c.cls.toLowerCase().includes(q)));
  if(!list.length){
    rosterEl.innerHTML = `<div class="placeholder muted">No characters found</div>`;
    return;
  }
  for(const c of list){
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="token">${escapeHtml(c.name ? c.name[0] : '?')}</div>
      <div style="flex:1">
        <div style="display:flex;gap:8px;align-items:center">
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted" style="font-size:12px">${escapeHtml(c.cls)} L${c.level}</div>
        </div>
        <div class="muted small">HP ${c.hp}/${c.maxHp} • AC ${c.ac}</div>
      </div>
    `;
    card.addEventListener('click', (ev) => {
      // Multi-select support (Ctrl/Cmd)
      if(ev.ctrlKey || ev.metaKey){
        card.classList.toggle('selected-multi');
        return;
      }
      // Single select
      $$('.card').forEach(x => x.classList.remove('active'));
      card.classList.add('active');
      selectedId = c.id;
      showCharacter(c.id);
    });
    rosterEl.appendChild(card);
  }
}

/* --------- Show Character ---------- */
function showCharacter(id){
  const c = characters.find(x=>x.id===id);
  if(!c) return;
  placeholder.style.display = 'none';
  charView.style.display = 'block';
  // Build an elegant sheet view (rich UI)
  charView.innerHTML = `
    <div class="char-header">
      <div class="token">${escapeHtml(c.name ? c.name[0] : '?')}</div>
      <div>
        <div class="char-name">${escapeHtml(c.name || 'Unnamed')}</div>
        <div class="char-meta">${escapeHtml(c.race || '')} • ${escapeHtml(c.cls || '')} ${c.subclass ? '— ' + escapeHtml(c.subclass) : ''}</div>
        <div class="char-meta">${escapeHtml(c.background || '')} • ${escapeHtml(c.alignment || '')}</div>
        <div class="char-stats">
          <div class="stat">HP ${c.hp}/${c.maxHp}</div>
          <div class="stat">AC ${c.ac}</div>
          <div class="stat">Init ${c.initiative ?? abilityMod(c.dex || 10)}</div>
          <div class="stat">Speed ${c.speed}</div>
          <div class="stat">Hit Dice ${c.hitDie} × ${c.hitDice}</div>
        </div>
      </div>
    </div>

    <div class="abilities">
      ${['str','dex','con','int','wis','cha'].map(a => `<div class="ability"><strong>${a.toUpperCase()}</strong><span>${c[a] ?? 10}</span><div class="muted">${formatMod(abilityMod(c[a] ?? 10))}</div></div>`).join('')}
    </div>

    <div class="box">
      <h4>Proficiency & Skills</h4>
      <div class="muted">Prof bonus: +${c.prof || 2}</div>
      <div class="muted">Saving Throws: ${escapeHtml(c.savingThrows || '')}</div>
      <div class="muted">Skills: ${escapeHtml(c.skills || '')}</div>
      <div class="muted">Languages: ${escapeHtml(c.languages || '')}</div>
    </div>

    <div class="box">
      <h4>Spellcasting</h4>
      <div class="muted">Ability: ${escapeHtml(c.spellcastingAbility || '')} • DC: ${c.spellDC || ''} • Spell Attack: +${c.spellAttack || ''}</div>
      <div class="muted">Spells: ${escapeHtml(c.spells || '')}</div>
      <div class="muted">Slots: ${escapeHtml(c.spellSlots || '')}</div>
    </div>

    <div class="box">
      <h4>Equipment & Currency</h4>
      <div class="muted">${escapeHtml(c.equipment || '')}</div>
      <div class="muted">Currency: ${escapeHtml(c.gp || '')}</div>
    </div>

    <div class="box">
      <h4>Personality & Backstory</h4>
      <div class="muted">Traits: ${escapeHtml(c.personality || '')}</div>
      <div class="muted">Ideals: ${escapeHtml(c.ideals || '')}</div>
      <div class="muted">Bonds: ${escapeHtml(c.bonds || '')}</div>
      <div class="muted">Flaws: ${escapeHtml(c.flaws || '')}</div>
      <div style="margin-top:8px" class="muted">${escapeHtml(c.backstory || '')}</div>
    </div>

    <div style="display:flex;gap:8px;align-items:center">
      <button id="btn-edit" class="btn primary">Edit</button>
      <button id="btn-export-plain-local" class="btn">Export (Plain PDF)</button>
      <button id="btn-export-png" class="btn">Export PNG</button>
    </div>
  `;

  // attach events for the inner buttons
  $('#btn-edit').addEventListener('click', ()=> openForm('edit', c));
  $('#btn-export-plain-local').addEventListener('click', ()=> exportPlainPDF(c));
  $('#btn-export-png').addEventListener('click', ()=> exportCardPNG(c));

  // small pulse / ambient
  pulse();
}

/* --------- Form (modal) ---------- */
btnNew.addEventListener('click', ()=> openForm('new'));
btnCancel.addEventListener('click', ()=> closeForm());
function openForm(mode='new', charData=null){
  modal.style.display = 'flex';
  form.reset();
  $('#form-title').textContent = mode === 'new' ? 'Create Character' : 'Edit Character';
  form.dataset.mode = mode;
  if(mode === 'edit' && charData){
    // populate
    for(const key in charData){
      const el = form.elements[key];
      if(el) el.value = charData[key];
    }
  }
}
function closeForm(){ modal.style.display = 'none'; delete form.dataset.mode; }

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = {};
  for(const el of form.elements){
    if(!el.name) continue;
    data[el.name] = el.value;
  }
  // coerce numbers for key stats
  ['level','xp','maxHp','hp','tempHp','ac','initiative','speed','hitDice','str','dex','con','int','wis','cha','prof'].forEach(k => {
    if(data[k] !== undefined) data[k] = data[k]==='' ? data[k] : Number(data[k]);
  });
  // defaults
  data.id = form.dataset.mode === 'edit' && selectedId ? selectedId : uid();
  data.hitDie = data.hitDie || data.hitDie === '' ? data.hitDie : 'd8';
  data.spellSlots = data.spellSlots || '';
  data.conditions = data.conditions || [];
  // create or update
  if(form.dataset.mode === 'edit' && selectedId){
    const idx = characters.findIndex(c => c.id === selectedId);
    if(idx >= 0){
      // keep HP current if not explicitly changed
      if(!data.hp) data.hp = characters[idx].hp;
      characters[idx] = {...characters[idx], ...data};
    }
  } else {
    // new
    if(!data.hp) data.hp = data.maxHp || 10;
    characters.unshift(data);
    selectedId = data.id;
  }
  save();
  renderRoster(searchEl.value);
  closeForm();
  showCharacter(selectedId);
});

/* --------- Export Plain PDF (no styling, nice structure) ---------- */
async function exportPlainPDF(character){
  // build clean text page
  const doc = new jspdf.jsPDF({unit:'pt', format:'letter'});
  const left = 40;
  let y = 40;
  const lineHeight = 14;
  doc.setFont('Times','Normal');
  doc.setFontSize(16);
  doc.text(`${character.name || 'Unnamed'} — ${character.cls || ''} L${character.level || ''}`, left, y);
  y += lineHeight*1.6;

  doc.setFontSize(11);
  doc.setFont('Times','Normal');

  function addBlock(title, text){
    doc.setFont(undefined,'Bold'); doc.setFontSize(12);
    doc.text(title, left, y); y += lineHeight;
    doc.setFont(undefined,'Normal'); doc.setFontSize(10);
    const split = doc.splitTextToSize(text || '—', 520);
    doc.text(split, left, y);
    y += split.length * lineHeight + 8;
  }

  addBlock('Race / Background / Alignment', `${character.race || ''} • ${character.background || ''} • ${character.alignment || ''}`);
  addBlock('HP / AC / Speed', `${character.hp || ''} / ${character.maxHp || ''} HP • AC ${character.ac || ''} • Speed ${character.speed || ''}`);
  addBlock('Abilities', ['STR','DEX','CON','INT','WIS','CHA'].map(a => `${a}: ${character[a]||''} (${formatMod(abilityMod(character[a]||10))})`).join(' • '));
  addBlock('Proficiencies & Skills', `Prof: +${character.prof || 2}\nSaving Throws: ${character.savingThrows || ''}\nSkills: ${character.skills || ''}\nLanguages: ${character.languages || ''}`);
  addBlock('Spells & Slots', `Spells: ${character.spells || ''}\nSlots: ${character.spellSlots || ''}`);
  addBlock('Equipment', character.equipment || '');
  addBlock('Currency', character.gp || '');
  addBlock('Personality & Backstory', `Traits: ${character.personality || ''}\nIdeals: ${character.ideals || ''}\nBonds: ${character.bonds || ''}\nFlaws: ${character.flaws || ''}\n\nBackstory: ${character.backstory || ''}`);
  addBlock('Notes', character.notes || '');

  doc.save(`${(character.name || 'character').replace(/\s+/g,'_')}_plain.pdf`);
}

/* --------- Export PNG (card snapshot) ---------- */
async function exportCardPNG(character){
  // Render the current char-view element to canvas; if not visible, render a minimal HTML fragment
  let target = charView;
  if(!charView.innerHTML || charView.style.display === 'none'){
    // create a temporary offscreen element with a minimal card
    target = document.createElement('div');
    target.style.width = '600px';
    target.style.padding = '20px';
    target.style.background = '#1a1722';
    target.innerHTML = `<h2 style="color:white">${escapeHtml(character.name)}</h2><p style="color:#cfcbe0">${escapeHtml(character.cls)} L${character.level}</p>`;
    document.body.appendChild(target);
    const canvas = await html2canvas(target, {scale:2});
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = data; a.download = `${character.name||'character'}.png`; a.click();
    target.remove();
    return;
  }
  const canvas = await html2canvas(target, {scale:2});
  const data = canvas.toDataURL('image/png');
  const a = document.createElement('a'); a.href = data; a.download = `${character.name||'character'}.png`; a.click();
}

/* --------- AoE Damage (apply to selected-multi cards) ---------- */
$('#btn-aoe').addEventListener('click', ()=> {
  // collect selected multi
  const selectedEls = $$('.card.selected-multi');
  if(!selectedEls.length){ alert('Ctrl / ⌘ + click cards in the roster to multi-select them for AoE.'); return; }
  const dmg = prompt('AoE damage amount:');
  if(!dmg) return;
  let changed=false;
  selectedEls.forEach(el => {
    const id = el.dataset.id;
    const c = characters.find(x => x.id === id);
    if(c){
      c.hp = Math.max(0, (c.hp||0) - Number(dmg));
      if(c.hp === 0 && !(c.conditions||[]).includes('Unconscious')) {
        c.conditions = (c.conditions || []).concat(['Unconscious']);
      }
      changed=true;
    }
  });
  if(changed){ save(); renderRoster(searchEl.value); if(selectedId) showCharacter(selectedId); }
});

/* --------- Chatbot (local) ---------- */
const chatWidget = $('#chat');
const chatOpenBtn = $('#btn-chat-open');
const chatCloseBtn = $('#chat-close') || null;
const chatBody = $('#chat-body');
const chatForm = $('#chat-form');
const chatInput = $('#chat-input');

const FAQ = [
  {q:/short rest/i, a:'Short rest is at least 1 hour. You may spend Hit Dice to recover HP. Each Hit Die is rolled individually and you add your Constitution modifier to each die.'},
  {q:/long rest/i, a:'Long rest is 8 hours. You regain all HP and recover spent Hit Dice up to half of your total (rounded up).'},
  {q:/concentration/i, a:'When you take damage while concentrating, make a Constitution saving throw (DC = max(10, damage/2). On a failed save, you lose concentration.'},
  {q:/advantage|disadvantage/i, a:'Advantage: roll two d20s and use the higher result. Disadvantage: roll two and use the lower result.'},
  {q:/hit die/i, a:'Hit Dice are used to recover HP during a short rest. Each class has a Hit Die type (d6,d8,d10,d12).'},
];

function appendChat(role, text){
  const el = document.createElement('div');
  el.className = 'chat-line';
  el.innerHTML = `<div class="${role}"><strong>${role === 'user' ? 'You' : 'Guide'}</strong><div class="chat-text">${escapeHtml(text)}</div></div>`;
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
}

chatOpenBtn.addEventListener('click', ()=>{
  chatWidget.style.display = chatWidget.style.display === 'none' ? 'flex' : 'none';
  chatBody.innerHTML = `<div class="muted small">Ask rules questions or ask about characters (e.g. "What is Kyra's HP?").</div>`;
});

if(chatCloseBtn) chatCloseBtn.addEventListener('click', ()=> chatWidget.style.display='none');

$('#chat-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const q = chatInput.value.trim();
  if(!q) return;
  appendChat('user', q);
  // simple answer pipeline: character-aware, faq, fallback
  const charMatch = characters.find(c => q.toLowerCase().includes((c.name||'').toLowerCase()));
  if(charMatch){
    // attempt to answer common queries about that character
    if(/hp/i.test(q)) appendChat('bot', `${charMatch.name} has ${charMatch.hp || 0}/${charMatch.maxHp || 0} HP.`);
    else if(/level|lvl/i.test(q)) appendChat('bot', `${charMatch.name} is level ${charMatch.level || 1} (${charMatch.cls}).`);
    else if(/spell/i.test(q)) appendChat('bot', `${charMatch.name}'s spells: ${charMatch.spells || 'None listed.'}`);
    else appendChat('bot', `I can tell you about ${charMatch.name}: HP ${charMatch.hp || 0}/${charMatch.maxHp || 0}, Class: ${charMatch.cls}, Level ${charMatch.level}. Ask me about HP, spells, or level.`);
  } else {
    // FAQ match
    const f = FAQ.find(item => item.q.test(q));
    if(f) appendChat('bot', f.a);
    else appendChat('bot', `I don't know that exactly. Try asking about "short rest", "concentration", or a character name.`);
  }
  chatInput.value = '';
});

/* --------- Misc helpers ---------- */
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatMod(n){ return (n>=0?'+':'') + n; }

function pulse(){
  // small visual pulse on body or char token (subtle)
  document.body.animate([{filter:'brightness(1.02)'},{filter:'brightness(1)'}],{duration:420,fill:'forwards'});
  try { diceSound.currentTime = 0; diceSound.play(); } catch(e){}
}

/* --------- init ---------- */
load();
renderRoster();
if(characters.length) {
  selectedId = characters[0].id;
  // simulate selecting first char
  const firstCard = rosterEl.querySelector('.card');
  if(firstCard){ firstCard.classList.add('active'); }
  showCharacter(selectedId);
}

/* search */
searchEl.addEventListener('input', ()=> renderRoster(searchEl.value));

/* Export plain button (global) — exports currently selected char if any */
btnExportPlain.addEventListener('click', ()=>{
  if(!selectedId){ alert('Select a character first'); return; }
  const c = characters.find(x => x.id === selectedId);
  if(c) exportPlainPDF(c);
});

/* Export PNG: global button */
btnExportCard.addEventListener('click', ()=>{
  if(!selectedId){ alert('Select a character first'); return; }
  const c = characters.find(x => x.id === selectedId);
  if(c) exportCardPNG(c);
});

/* Open form for editing selected by double-click roster (optional) */
rosterEl.addEventListener('dblclick', (e)=>{
  const card = e.target.closest('.card');
  if(!card) return;
  const id = card.dataset.id;
  const c = characters.find(x => x.id === id);
  if(c) openForm('edit', c);
});

/* close modal when clicking outside */
modal.addEventListener('click', e => { if(e.target === modal) closeForm(); });

/* helper export functions reused (using jspdf/html2canvas loaded via CDN) */
async function exportPlainPDF(character){
  // call local plain-export function (same as earlier but included here)
  const doc = new jspdf.jsPDF({unit:'pt',format:'letter'});
  let y = 40;
  const left = 40;
  const lh = 14;
  doc.setFontSize(16);
  doc.text(`${character.name || 'Unnamed'} — ${character.cls || ''} L${character.level || ''}`, left, y);
  y += 22;
  doc.setFontSize(10);
  function add(title, text){
    doc.setFontSize(12); doc.text(title, left, y); y += lh;
    doc.setFontSize(10); const lines = doc.splitTextToSize(text || '—', 520); doc.text(lines, left, y); y += lines.length*lh + 6;
  }
  add('Race / Background / Alignment', `${character.race || ''} • ${character.background || ''} • ${character.alignment || ''}`);
  add('HP / AC / Speed', `${character.hp || ''}/${character.maxHp || ''} HP • AC ${character.ac || ''} • Speed ${character.speed || ''}`);
  add('Abilities', ['STR','DEX','CON','INT','WIS','CHA'].map(a=>`${a}: ${character[a]||''} (${formatMod(abilityMod(character[a]||10))})`).join(' • '));
  add('Proficiencies & Skills', `Prof +${character.prof || 2}\nSaving Throws: ${character.savingThrows || ''}\nSkills: ${character.skills || ''}`);
  add('Spells', `Spells: ${character.spells||''}\nSlots: ${character.spellSlots||''}`);
  add('Equipment', character.equipment || '');
  add('Backstory & Notes', (character.backstory || '') + '\n\n' + (character.notes || ''));
  doc.save(`${(character.name||'character').replace(/\s+/g,'_')}_plain.pdf`);
}
async function exportCardPNG(character){
  // if char view visible, use html2canvas; else produce simple card
  if(charView.style.display !== 'none' && charView.innerHTML.trim().length > 0){
    const canvas = await html2canvas(charView, {scale:2});
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = data; a.download = `${character.name||'character'}.png`; a.click();
  } else {
    // simple render
    const off = document.createElement('div'); off.style.padding='20px'; off.style.background='#111'; off.style.color='white'; off.innerHTML=`<h2>${escapeHtml(character.name)}</h2><p>${escapeHtml(character.cls)} L${character.level}</p>`;
    document.body.appendChild(off);
    const canvas = await html2canvas(off, {scale:2});
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = data; a.download = `${character.name||'character'}.png`; a.click();
    off.remove();
  }
}

/* End */
