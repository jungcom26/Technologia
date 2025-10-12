// js/journal.js - UPDATED VERSION (SQLite via API)
(() => {
  const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";

  /** @typedef {{id:string,title:string,category?:string,status:'active'|'ongoing'|'completed'|'failed', created:number, updated:number, objectives:{id:string,text:string,status:'active'|'completed'|'failed'}[], notes:{id:string,text:string,ts:number}[]}} Quest */

  const CATS_KEY = "ds-journal-cats";
  let categories = JSON.parse(
    localStorage.getItem(CATS_KEY) ||
      '["Main Quest","Side Quest","Personal Quest","Session"]'
  );
  const saveCats = () =>
    localStorage.setItem(CATS_KEY, JSON.stringify(categories));
  
  // ---------- State ----------
  const state = {
    filter: "all",
    catFilter: "all",
    hideCompleted: false,
    selectedId: null,
    quests: [],
  };

  // Quick id
  const uid = () => Math.random().toString(36).slice(2, 10);

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
      // Transform API data to match existing format
      state.quests = data.map(q => ({
        id: q.id,
        title: q.title,
        category: q.category || 'Main Quest',
        status: q.status || 'active',
        created: new Date(q.created_at).getTime(),
        updated: new Date(q.updated_at).getTime(),
        sessionDateISO: q.session_date,
        campaignDate: q.campaign_date,
        objectives: q.objectives || [],
        notes: q.notes || [],
        description: q.description || ''
      }));
    } catch (error) {
      console.error('Failed to load quests:', error);
      state.quests = [];
    }
  }

  // ---------- Elements ----------
  const treeEl = document.getElementById("jl-tree");
  const searchEl = document.getElementById("jl-search");
  const chips = document.querySelectorAll(".jl-filters .chip");
  const hideCompletedEl = document.getElementById("jl-hide-completed");
  const newBtn = document.getElementById("jl-new");

  const emptyEl = document.getElementById("jd-empty");
  const bodyEl = document.getElementById("jd-body");
  const titleEl = document.getElementById("jd-title");
  const metaEl = document.getElementById("jd-meta");
  const statusSel = document.getElementById("jd-status");
  const completeBtn = document.getElementById("jd-complete");
  const deleteBtn = document.getElementById("jd-delete");

  const objListEl = document.getElementById("jd-objectives");
  const objInput = document.getElementById("jd-new-obj");
  const objAdd = document.getElementById("jd-add-obj");

  const notesEl = document.getElementById("jd-notes");
  const noteInput = document.getElementById("jd-new-note");
  const noteAdd = document.getElementById("jd-add-note");
  const aiBtn = document.getElementById("jd-ai-sum");
  const catChipsWrap = document.getElementById("jl-cat-chips");
  const catSelect = document.getElementById("jd-category");
  const catAddBtn = document.getElementById("jd-cat-add");
  const dateEl = document.getElementById("jd-date");
  const campEl = document.getElementById("jd-camp");
  const weekEl = document.getElementById("jd-week");

  function renderCatChips() {
    if (!catChipsWrap) return;
    const chips = [
      `<button class="chip ${
        state.catFilter === "all" ? "is-on" : ""
      }" data-cat="all">All</button>`,
    ].concat(
      categories.map(
        (c) =>
          `<button class="chip ${
            state.catFilter === c ? "is-on" : ""
          }" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`
      )
    );
    catChipsWrap.innerHTML = chips.join("");
    catChipsWrap.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        catChipsWrap
          .querySelectorAll(".chip")
          .forEach((x) => x.classList.remove("is-on"));
        btn.classList.add("is-on");
        state.catFilter = btn.dataset.cat;
        renderTree();
      });
    });
  }

  function populateCategorySelect(value) {
    if (!catSelect) return;
    catSelect.innerHTML = categories
      .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
      .join("");
    if (value) catSelect.value = value;
  }

  function fmtShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function weekday(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(+d)) return "";
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }

  // ---------- CRUD helpers ----------
  async function upsertQuest(partial) {
    let q = state.quests.find((x) => x.id === partial.id);
    
    if (!q) {
      // Create new quest
      const questData = {
        title: partial.title || "Untitled Quest",
        description: "",
        status: partial.status || "active",
        category: partial.category || (state.catFilter !== "all" ? state.catFilter : categories[0]),
        assigned_character: "",
        session_date: partial.sessionDateISO || new Date().toISOString().slice(0, 10),
        campaign_date: partial.campaignDate || "",
        objectives: [],
        notes: []
      };
      
      try {
        const result = await apiCall('/api/quests', {
          method: 'POST',
          body: JSON.stringify(questData)
        });
        await loadQuests(); // Reload from server
        state.selectedId = result.id;
      } catch (error) {
        console.error('Failed to create quest:', error);
      }
    } else {
      // Update existing quest
      const questData = {
        title: partial.title || q.title,
        description: q.description || "",
        status: partial.status || q.status,
        category: partial.category || q.category,
        assigned_character: "",
        session_date: partial.sessionDateISO || q.sessionDateISO,
        campaign_date: partial.campaignDate || q.campaignDate,
        objectives: q.objectives,
        notes: q.notes
      };
      
      try {
        await apiCall(`/api/quests/${q.id}`, {
          method: 'PUT',
          body: JSON.stringify(questData)
        });
        await loadQuests(); // Reload from server
      } catch (error) {
        console.error('Failed to update quest:', error);
      }
    }
    
    render();
    return q;
  }

  async function addObjective(qid, text) {
    const q = byId(qid);
    if (!q) return;
    
    const newObjectives = [
      ...q.objectives,
      { id: uid(), text, status: "active" }
    ];
    
    await updateQuestWithObjectives(q.id, newObjectives);
  }

  async function updateQuestWithObjectives(questId, objectives) {
    const q = byId(questId);
    if (!q) return;
    
    const questData = {
      title: q.title,
      description: q.description,
      status: q.status,
      category: q.category,
      assigned_character: "",
      session_date: q.sessionDateISO,
      campaign_date: q.campaignDate,
      objectives: objectives,
      notes: q.notes
    };
    
    try {
      await apiCall(`/api/quests/${questId}`, {
        method: 'PUT',
        body: JSON.stringify(questData)
      });
      await loadQuests(); // Reload from server
    } catch (error) {
      console.error('Failed to update objectives:', error);
    }
  }

  async function setObjectiveStatus(qid, oid, status) {
    const q = byId(qid);
    if (!q) return;
    
    const newObjectives = q.objectives.map(obj => 
      obj.id === oid ? { ...obj, status } : obj
    );
    
    await updateQuestWithObjectives(q.id, newObjectives);
  }

  async function addNote(qid, text) {
    const q = byId(qid);
    if (!q) return;
    
    const newNotes = [
      {
        id: uid(),
        text: text,
        session_date: q.sessionDateISO,
        campaign_date: q.campaignDate,
        created_at: new Date().toISOString()
      },
      ...q.notes
    ];
    
    const questData = {
      title: q.title,
      description: q.description,
      status: q.status,
      category: q.category,
      assigned_character: "",
      session_date: q.sessionDateISO,
      campaign_date: q.campaignDate,
      objectives: q.objectives,
      notes: newNotes
    };
    
    try {
      await apiCall(`/api/quests/${q.id}`, {
        method: 'PUT',
        body: JSON.stringify(questData)
      });
      await loadQuests(); // Reload from server
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  }

  async function removeQuest(qid) {
    try {
      await apiCall(`/api/quests/${qid}`, {
        method: 'DELETE'
      });
      await loadQuests(); // Reload from server
      if (state.selectedId === qid) state.selectedId = null;
      render();
    } catch (error) {
      console.error('Failed to delete quest:', error);
    }
  }

  const byId = (id) => state.quests.find((x) => x.id === id) || null;

  // ---------- Render: Tree ----------
  function renderTree() {
    if (!treeEl) return;
    const qtext = searchEl.value.trim().toLowerCase();
    const hideDone = hideCompletedEl.checked;

    const filtered = state.quests.filter((qu) => {
      const text = (
        qu.title +
        " " +
        qu.category +
        " " +
        qu.objectives.map((o) => o.text).join(" ")
      ).toLowerCase();
      const qmatch = !qtext || text.includes(qtext);
      const fmatch = state.filter === "all" ? true : qu.status === state.filter;
      const cmatch = state.catFilter === "all" ? true : qu.category === state.catFilter;
      const hmatch = hideDone ? qu.status !== "completed" : true;
      return qmatch && fmatch && cmatch && hmatch;
    });
    
    filtered.sort((a, b) => {
      const aa = a.sessionDateISO || "";
      const bb = b.sessionDateISO || "";
      return bb.localeCompare(aa);
    });
    
    if (!filtered.length) {
      treeEl.innerHTML = `<div class="placeholder">No quests match.</div>`;
      return;
    }

    // group by category
    const groups = groupPoly(filtered, (x) => x.category || "Misc");

    // render categories
    const order = [
      ...categories,
      ...Object.keys(groups).filter((k) => !categories.includes(k)),
    ];
    
    treeEl.innerHTML = order
      .filter((cat) => groups[cat]?.length)
      .map(
        (cat) => `
    <div class="jl-group">
      <button class="jl-cat" data-cat="${escapeHTML(cat)}">${escapeHTML(cat)}</button>
      <ul class="jl-items">
        ${groups[cat]
          .map(
            (item) => `
          <li class="jl-item ${
            state.selectedId === item.id ? "is-active" : ""
          }" data-id="${item.id}">
            <span class="dot status-${item.status}"></span>
            <span class="title">${escapeHTML(item.title)}</span>
            <small class="muted">${progressText(item)}</small>
            <small class="muted">${fmtShort(item.sessionDateISO)}</small>
          </li>`
          )
          .join("")}
      </ul>
    </div>
  `
      )
      .join("");

    treeEl.querySelectorAll(".jl-item").forEach((li) => {
      li.addEventListener("click", () => {
        state.selectedId = li.dataset.id;
        render();
      });
    });
    
    treeEl.querySelectorAll(".jl-cat").forEach((btn) => {
      btn.addEventListener("click", () =>
        btn.parentElement.classList.toggle("is-collapsed")
      );
    });
  }

  function progressText(q) {
    const total = q.objectives.length;
    const done = q.objectives.filter((o) => o.status === "completed").length;
    return total ? `${done}/${total}` : "no objectives";
  }

  function groupPoly(arr, keyfn) {
    const map = {};
    for (const x of arr) {
      const k = keyfn(x);
      (map[k] ||= []).push(x);
    }
    return map;
  }

  const escapeHTML = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );

  // ---------- Render: Detail ----------
  function renderDetail(q) {
    if (!q) {
      emptyEl.hidden = false;
      bodyEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    bodyEl.hidden = false;

    titleEl.textContent = q.title;
    metaEl.textContent = `${q.category} • ${new Date(q.created).toLocaleString()} • ${q.status}`;
    statusSel.value = q.status;

    populateCategorySelect(q.category);
    catSelect.onchange = async () => {
      q.category = catSelect.value;
      await upsertQuest({
        id: q.id,
        category: q.category
      });
    };
    
    catAddBtn.onclick = () => {
      const name = prompt("New category name:");
      if (!name) return;
      if (!categories.includes(name)) {
        categories.push(name);
        saveCats();
      }
      populateCategorySelect(q.category);
      renderCatChips();
    };

    // Session date (IRL)
    if (dateEl) {
      dateEl.value =
        q.sessionDateISO && /^\d{4}-\d{2}-\d{2}$/.test(q.sessionDateISO)
          ? q.sessionDateISO
          : new Date().toISOString().slice(0, 10);
      dateEl.onchange = async () => {
        q.sessionDateISO = dateEl.value;
        await upsertQuest({
          id: q.id,
          sessionDateISO: q.sessionDateISO
        });
        if (weekEl) weekEl.textContent = weekday(q.sessionDateISO);
        renderTree();
      };
    }
    
    // Campaign date (free text)
    if (campEl) {
      campEl.value = q.campaignDate || "";
      campEl.onchange = async () => {
        q.campaignDate = campEl.value.trim();
        await upsertQuest({
          id: q.id,
          campaignDate: q.campaignDate
        });
      };
    }
    
    // day-of-week badge
    if (weekEl) {
      weekEl.textContent = weekday(q.sessionDateISO);
    }

    // objectives
    objListEl.innerHTML =
      q.objectives
        .map(
          (o) => `
      <li class="obj">
        <label class="obj-row">
          <input type="checkbox" ${
            o.status === "completed" ? "checked" : ""
          } data-oid="${o.id}" />
          <span class="obj-text ${o.status}">${escapeHTML(o.text)}</span>
        </label>
        <div class="obj-actions">
          <button class="mini" data-act="fail" data-oid="${o.id}">Fail</button>
          <button class="mini ghost" data-act="del" data-oid="${o.id}">Delete</button>
        </div>
      </li>
    `
        )
        .join("") || `<div class="muted">No objectives yet.</div>`;

    objListEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        setObjectiveStatus(
          q.id,
          cb.dataset.oid,
          cb.checked ? "completed" : "active"
        );
      });
    });
    
    objListEl.querySelectorAll('button[data-act="fail"]').forEach((btn) => {
      btn.addEventListener("click", () =>
        setObjectiveStatus(q.id, btn.dataset.oid, "failed")
      );
    });
    
    objListEl.querySelectorAll('button[data-act="del"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const newObjectives = q.objectives.filter(o => o.id !== btn.dataset.oid);
        await updateQuestWithObjectives(q.id, newObjectives);
      });
    });

    // notes
    notesEl.innerHTML =
      q.notes
        .map(
          (n) => `
      <article class="note">
        <time>${new Date(n.created_at || n.ts).toLocaleString()}</time>
        <p>${escapeHTML(n.text)}</p>
      </article>
    `
        )
        .join("") || `<div class="muted">No notes yet.</div>`;

    // Event handlers for detail actions
    statusSel.onchange = async () => {
      await upsertQuest({
        id: q.id,
        status: statusSel.value
      });
      renderTree();
    };
    
    completeBtn.onclick = async () => {
      await upsertQuest({
        id: q.id,
        status: "completed"
      });
      render();
    };
    
    deleteBtn.onclick = async () => {
      if (confirm("Delete this quest?")) await removeQuest(q.id);
    };

    objAdd.onclick = async () => {
      const t = objInput.value.trim();
      if (!t) return;
      await addObjective(q.id, t);
      objInput.value = "";
      objInput.focus();
    };

    noteAdd.onclick = async () => {
      const t = noteInput.value.trim();
      if (!t) return;
      await addNote(q.id, t);
      noteInput.value = "";
      noteInput.focus();
    };

    aiBtn.onclick = () => summarizeWithAI(q);
  }

  // ---------- AI summary ----------
  async function summarizeWithAI(q) {
    try {
      const prompt = [
        "You are a quest journal summarizer.",
        "Given a quest and its notes/objectives, return a concise summary + classify objectives into active/ongoing/completed/failed.",
        "Respond as markdown. Use short bullet points.",
      ].join(" ");
      
      const payload = {
        question: `${prompt}\n\nQUEST JSON:\n${JSON.stringify(q, null, 2)}`,
      };
      
      const r = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const txt = data?.answer || "No summary.";
      await addNote(q.id, `AI Summary:\n${txt}`);
      toast("AI summary added to notes.");
    } catch (err) {
      console.error(err);
      toast("Could not summarize (server?).");
    }
  }

  // ---------- Toast ----------
  function toast(text) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = escapeHTML(text);
    root.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  // ---------- Render root ----------
  function render() {
    renderTree();
    renderDetail(byId(state.selectedId));
  }

  // ---------- Events: filters & search ----------
  chips.forEach((ch) =>
    ch.addEventListener("click", () => {
      chips.forEach((x) => x.classList.remove("is-on"));
      ch.classList.add("is-on");
      state.filter = ch.dataset.filter;
      renderTree();
    })
  );
  
  hideCompletedEl.addEventListener("change", renderTree);
  searchEl.addEventListener("input", renderTree);
  
  newBtn.addEventListener("click", async () => {
    const q = await upsertQuest({
      id: uid(),
      title: "New Quest",
      category: "Personal Quest",
      status: "active",
    });
    await addObjective(q.id, "First objective");
  });

  // ---------- OPTIONAL: ingest from game events ----------
  window.Journal = {
    async addFromEvent(evt) {
      const q = await upsertQuest({
        id: `q_${slug(evt.quest)}`,
        title: evt.quest,
        category: evt.category || "Main Quest",
      });
      
      if (evt.note) await addNote(q.id, evt.note);
      
      if (evt.objective) {
        const text = evt.objective.replace(/^\+\s*/, "");
        if (!q.objectives.some((o) => o.text === text))
          await addObjective(q.id, text);
      }
      
      if (evt.complete) {
        await upsertQuest({
          id: q.id,
          status: "completed"
        });
      }
    },
  };
  
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    await loadQuests();
    
    if (state.quests.length === 0) {
      const q = await upsertQuest({
        id: "q_new-adventure",
        title: "New adventure begins",
        category: "Session",
        status: "ongoing",
      });
      await addObjective(q.id, "Meet the party at the tavern");
      await addObjective(q.id, "Find a way to Moonrise Towers");
      await addNote(q.id, "The game session started.");
    }
    
    renderCatChips();
    render();
  });
})();