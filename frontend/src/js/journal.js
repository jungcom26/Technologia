// js/journal.js
(() => {
  const API_BASE_URL = window.__API_BASE__ || "http://127.0.0.1:8000";
  const STORE_KEY = "ds-journal-v1";

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
    catFilter: "all", // ✨ กรองตามหมวด
    hideCompleted: false,
    selectedId: null,
    quests: load() || [],
  };

  // Quick id
  const uid = () => Math.random().toString(36).slice(2, 10);

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.quests));
  }
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    } catch {
      return [];
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
    // 'YYYY-MM-DD' -> 'Tue, 5 Oct 2025'
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
  function upsertQuest(partial) {
    let q = state.quests.find((x) => x.id === partial.id);
    if (!q) {
      q = {
        id: partial.id || uid(),
        title: partial.title || "Untitled Quest",
        category:
          partial.category ||
          (state.catFilter !== "all" ? state.catFilter : categories[0]),
        status: partial.status || "active",
        created: Date.now(),
        updated: Date.now(),
        // ✨ new
        sessionDateISO:
          partial.sessionDateISO || new Date().toISOString().slice(0, 10), // 'YYYY-MM-DD'
        campaignDate: partial.campaignDate || "",
        objectives: [],
        notes: [],
      };
      state.quests.unshift(q);
      state.selectedId = q.id;
    } else {
      Object.assign(q, partial);
      q.updated = Date.now();
    }
    save();
    render();
    return q;
  }

  function addObjective(qid, text) {
    const q = byId(qid);
    if (!q) return;
    q.objectives.push({ id: uid(), text, status: "active" });
    q.updated = Date.now();
    save();
    renderDetail(q);
  }

  function setObjectiveStatus(qid, oid, status) {
    const q = byId(qid);
    if (!q) return;
    const o = q.objectives.find((x) => x.id === oid);
    if (!o) return;
    o.status = status;
    q.updated = Date.now();
    save();
    renderDetail(q);
    renderTree();
  }

  function addNote(qid, text) {
    const q = byId(qid);
    if (!q) return;
    q.notes.unshift({
      id: uid(),
      ts: Date.now(),
      text: noteText,
      sessionDateISO: q.sessionDateISO,
      campaignDate: q.campaignDate,
    });
    q.updated = Date.now();
    save();
    renderDetail(q);
  }

  function removeQuest(qid) {
    const i = state.quests.findIndex((x) => x.id === qid);
    if (i >= 0) state.quests.splice(i, 1);
    if (state.selectedId === qid) state.selectedId = null;
    save();
    render();
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
      const cmatch =
        state.catFilter === "all" ? true : qu.category === state.catFilter; // ✨
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
      <button class="jl-cat" data-cat="${escapeHTML(cat)}">${escapeHTML(
          cat
        )}</button>
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
    metaEl.textContent = `${q.category} • ${new Date(
      q.created
    ).toLocaleString()} • ${q.status}`;
    statusSel.value = q.status;

    populateCategorySelect(q.category); // ✨
    catSelect.onchange = () => {
      // ✨
      q.category = catSelect.value;
      q.updated = Date.now();
      save();
      render();
    };
    catAddBtn.onclick = () => {
      // ✨
      const name = prompt("New category name:");
      if (!name) return;
      if (!categories.includes(name)) {
        categories.push(name);
        saveCats();
      }
      populateCategorySelect(q.category);
      renderCatChips();
    };

    // ✨ Session date (IRL)
    if (dateEl) {
      dateEl.value =
        q.sessionDateISO && /^\d{4}-\d{2}-\d{2}$/.test(q.sessionDateISO)
          ? q.sessionDateISO
          : new Date().toISOString().slice(0, 10);
      dateEl.onchange = () => {
        q.sessionDateISO = dateEl.value;
        q.updated = Date.now();
        save();
        // show the date same as badge
        if (weekEl) weekEl.textContent = weekday(q.sessionDateISO);
        renderTree();
      };
    }
    // ✨ Campaign date (free text)
    if (campEl) {
      campEl.value = q.campaignDate || "";
      campEl.onchange = () => {
        q.campaignDate = campEl.value.trim();
        q.updated = Date.now();
        save();
      };
    }
    // ✨ day-of-week badge
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
          <button class="mini ghost" data-act="del" data-oid="${
            o.id
          }">Delete</button>
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
      btn.addEventListener("click", () => {
        const i = q.objectives.findIndex((o) => o.id === btn.dataset.oid);
        if (i >= 0) {
          q.objectives.splice(i, 1);
          q.updated = Date.now();
          save();
          renderDetail(q);
          renderTree();
        }
      });
    });

    // notes
    notesEl.innerHTML =
      q.notes
        .map(
          (n) => `
      <article class="note"><time>${new Date(
        n.ts
      ).toLocaleString()}</time><p>${escapeHTML(n.text)}</p></article>
    `
        )
        .join("") || `<div class="muted">No notes yet.</div>`;

    // actions

    newBtn.addEventListener("click", () => {
      const q = upsertQuest({
        id: uid(),
        title: "New Quest",
        status: "active",
      });
      addObjective(q.id, "First objective");
    });

    statusSel.onchange = () => {
      q.status = statusSel.value;
      q.updated = Date.now();
      save();
      renderTree();
    };
    completeBtn.onclick = () => {
      q.status = "completed";
      q.updated = Date.now();
      save();
      render();
    };
    deleteBtn.onclick = () => {
      if (confirm("Delete this quest?")) removeQuest(q.id);
    };

    objAdd.onclick = () => {
      const t = objInput.value.trim();
      if (!t) return;
      addObjective(q.id, t);
      objInput.value = "";
      objInput.focus();
    };

    noteAdd.onclick = () => {
      const t = noteInput.value.trim();
      if (!t) return;
      addNote(q.id, t);
      noteInput.value = "";
      noteInput.focus();
    };

    aiBtn.onclick = () => summarizeWithAI(q);
  }

  // ---------- AI summary ----------
  async function summarizeWithAI(q) {
    try {
      // summarize objective
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
      addNote(q.id, `AI Summary:\n${txt}`);
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
  newBtn.addEventListener("click", () => {
    const q = upsertQuest({
      id: uid(),
      title: "New Quest",
      category: "Personal Quest",
      status: "active",
    });
    addObjective(q.id, "First objective");
  });

  // ---------- OPTIONAL: ingest from game events ----------
  // window.Journal.addFromEvent({ quest:"Find a Cure", category:"Main Quest", note:"Met a friendly mind flayer.", objective:"+ Ask for help" });
  window.Journal = {
    addFromEvent(evt) {
      const q = upsertQuest({
        id: `q_${slug(evt.quest)}`,
        title: evt.quest,
        category: evt.category || "Main Quest",
      });
      if (evt.note) addNote(q.id, evt.note);
      if (evt.objective) {
        const text = evt.objective.replace(/^\+\s*/, "");
        if (!q.objectives.some((o) => o.text === text))
          addObjective(q.id, text);
      }
      if (evt.complete) {
        q.status = "completed";
        q.updated = Date.now();
        save();
        render();
      }
    },
  };
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (state.quests.length === 0) {
      const q = upsertQuest({
        id: "q_new-adventure",
        title: "New adventure begins",
        category: "Session",
        status: "ongoing",
      });
      addObjective(q.id, "Meet the party at the tavern");
      addObjective(q.id, "Find a way to Moonrise Towers");
      addNote(q.id, "The game session started.");
    }
    renderCatChips();
    render();
  });
})();
