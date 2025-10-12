// js/npc.js
(() => {
  "use strict";

  const PLACEHOLDER_SRC = "./public/assets/npc-placeholder.jpg";

  /** ---------------------------
   *  Preview panel
   *  --------------------------- */
  function showNPCPreview({ name, meta, img }) {
    const imgEl = document.getElementById("npc-portrait");
    const nameEl = document.getElementById("npc-preview-name");
    const roleEl = document.getElementById("npc-preview-role");
    if (!imgEl || !nameEl || !roleEl) return;

    nameEl.textContent = name || "Unknown";
    roleEl.textContent = meta || "—";

    if (img) {
      imgEl.src = img;
      imgEl.onload = () => (imgEl.style.opacity = "1");
      imgEl.onerror = () => {
        imgEl.removeAttribute("src");
        imgEl.style.opacity = "0";
      };
    } else {
      imgEl.removeAttribute("src");
      imgEl.style.opacity = "0";
    }

    document.dispatchEvent(
      new CustomEvent("npc:selected", { detail: { name, meta, img } })
    );
  }
  window.showNPCPreview = showNPCPreview;

  function resolveImageGenerator() {
    if (window.imageGen && typeof window.imageGen.generate === "function") {
      return async (prompt) => {
        const r = await window.imageGen.generate({ prompt });
        return r?.url || r?.dataUrl || null;
      };
    }
    return async (prompt) => {
      try {
        const resp = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data?.url || data?.dataUrl || null;
      } catch {
        return null;
      }
    };
  }
  const generateWith = resolveImageGenerator();

  /** ---------------------------
   *  keep image as square (object-fit: cover)
   *  --------------------------- */
  async function fileToSquareDataURL(
    file,
    size = 384,
    mime = "image/webp",
    quality = 0.92
  ) {
    const data = await file.arrayBuffer();
    const blob = new Blob([data]);
    const imgEl = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = URL.createObjectURL(blob);
    });

    const scale = Math.max(
      size / imgEl.naturalWidth,
      size / imgEl.naturalHeight
    );
    const sw = Math.round(size / scale);
    const sh = Math.round(size / scale);
    const sx = Math.max(0, Math.floor((imgEl.naturalWidth - sw) / 2));
    const sy = Math.max(0, Math.floor((imgEl.naturalHeight - sh) / 2));

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, size, size);

    URL.revokeObjectURL(imgEl.src);

    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(URL.createObjectURL(b)), mime, quality);
    });
  }

  /** ---------------------------
   *  Generate NPC image
   *  --------------------------- */
  async function generateNPCPortrait(card) {
    const thumb = card.querySelector(".npc-thumb");
    const img = card.querySelector(".npc-img");
    if (!thumb || !img) return;

    const overlay = document.createElement("div");
    overlay.className = "busy";
    overlay.textContent = "Generating…";
    thumb.appendChild(overlay);

    const name = (
      card.dataset.name ||
      card.querySelector(".npc-name")?.textContent ||
      "NPC"
    ).trim();
    const meta = (card.dataset.meta || "RPG character").trim();

    const prompt = `RPG portrait, ${name} (${meta}), bust shot, dramatic rim light, sharp focus, dark navy UI, high contrast, game concept art`;

    try {
      const url = generateWith ? await generateWith(prompt) : null;
      if (url) {
        img.src = url;
        card.dataset.img = url;
        if (card.classList.contains("is-active")) {
          showNPCPreview({ name, meta, img: url });
        }
      } else {
        console.warn("No image generator available / generation failed.");
      }
    } finally {
      overlay.remove();
    }
  }

  /** ---------------------------
   *  interaction NPC list
   *  --------------------------- */
  function bindListInteractions() {
    const npcsList = document.getElementById("npcs-list");
    if (!npcsList) return;

    // change name inline (contenteditable)
    npcsList.addEventListener("input", (e) => {
      if (!e.target.matches(".npc-name[contenteditable]")) return;
      const card = e.target.closest(".npc");
      const newName = e.target.textContent.trim() || "Unnamed";
      card.dataset.name = newName;
      if (card.classList.contains("is-active")) {
        const nameEl = document.getElementById("npc-preview-name");
        if (nameEl) nameEl.textContent = newName;
      }
    });

    // Enter = commit rename
    npcsList.addEventListener("keydown", (e) => {
      if (e.target.matches(".npc-name[contenteditable]") && e.key === "Enter") {
        e.preventDefault();
        e.target.blur();
      }
    });

    // upload or generate
    npcsList.addEventListener("click", (e) => {
      const card = e.target.closest(".npc");
      if (!card || !npcsList.contains(card)) return;

      if (e.target.closest(".btn-upload")) {
        card.querySelector(".upload-input")?.click();
        return;
      }
      if (e.target.closest(".btn-generate")) {
        generateNPCPortrait(card);
        return;
      }

      // select card
      npcsList
        .querySelectorAll(".npc.is-active")
        .forEach((n) => n.classList.remove("is-active"));
      card.classList.add("is-active");

      showNPCPreview({
        name:
          card.dataset.name ||
          card.querySelector(".npc-name")?.textContent?.trim(),
        meta:
          card.dataset.meta ||
          card.querySelector(".npc-meta")?.textContent?.trim(),
        img: card.dataset.img || "",
      });
    });

    // update image(upload)
    npcsList.addEventListener("change", async (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      const card = input.closest(".npc");
      const file = input.files?.[0];
      if (!card || !file) return;

      const imgEl = card.querySelector(".npc-img");
      const url = await fileToSquareDataURL(file, 384);
      if (imgEl) imgEl.src = url;
      card.dataset.img = url;

      if (card.classList.contains("is-active")) {
        showNPCPreview({
          name:
            card.dataset.name ||
            card.querySelector(".npc-name")?.textContent?.trim() ||
            "NPC",
          meta:
            card.dataset.meta ||
            card.querySelector(".npc-meta")?.textContent?.trim() ||
            "—",
          img: url,
        });
      }
    });
  }

  /** ---------------------------
   *  Add button NPC
   *  --------------------------- */
  function bindAddButton() {
    const addNpcBtn = document.getElementById("add-npc");
    const npcsList = document.getElementById("npcs-list");
    if (!addNpcBtn || !npcsList) return;

    addNpcBtn.addEventListener("click", () => {
      const name = "New NPC";
      const meta = "Unknown"; // "Race"
      const hp = 10,
        hpMax = 10;
      const hpPct = Math.max(0, Math.min(1, hp / hpMax));

      const card = document.createElement("div");
      card.className = "npc";
      card.dataset.name = name;
      card.dataset.meta = meta; // เก็บ race ใน meta
      card.dataset.img = PLACEHOLDER_SRC;

      // name/race -> image -> HP
      card.innerHTML = `
        <div class="npc-info">
          <div class="npc-name" contenteditable="true" spellcheck="false">${name}</div>
          <div class="npc-meta">${meta}</div>
        </div>

        <div class="npc-thumb">
          <img class="npc-img" src="${PLACEHOLDER_SRC}" alt="">
          <div class="thumb-actions">
            <input class="upload-input" type="file" accept="image/*">
            <button type="button" class="btn-upload"   title="Upload">⬆</button>
            <button type="button" class="btn-generate" title="Generate">🎨</button>
          </div>
        </div>

        <div class="npc-hp">
          <div class="npc-hp-bar" style="--hpPct:${hpPct}">
            <div class="npc-hp-fill"></div>
          </div>
          <div class="npc-hp-text">HP ${hp}/${hpMax}</div>
        </div>
      `;

      npcsList.prepend(card);

      // select new card + update preview
      npcsList
        .querySelectorAll(".npc.is-active")
        .forEach((n) => n.classList.remove("is-active"));
      card.classList.add("is-active");
      showNPCPreview({ name, meta, img: PLACEHOLDER_SRC });
    });
  }

  /** ---------------------------
   *  select first card as default
   *  --------------------------- */
  function initDefaultPreview() {
    const first = document.querySelector("#npcs-list .npc");
    if (first) {
      first.classList.add("is-active");
      showNPCPreview({
        name:
          first.dataset.name ||
          first.querySelector(".npc-name")?.textContent?.trim(),
        meta:
          first.dataset.meta ||
          first.querySelector(".npc-meta")?.textContent?.trim() ||
          "—",
        img: first.dataset.img || "",
      });
    } else {
      // ไม่มีการ์ด – เคลียร์ preview
      showNPCPreview({ name: "Select an NPC", meta: "HP —", img: "" });
    }
  }

  // Boot
  window.addEventListener("DOMContentLoaded", () => {
    bindListInteractions();
    bindAddButton();
    initDefaultPreview();
  });
})();
