(() => {
  "use strict";

  function buildPrompt(card) {
    const name =
      card.dataset.name ||
      card.querySelector(".npc-name")?.textContent?.trim() ||
      "Unnamed NPC";
    const meta =
      card.dataset.meta ||
      card.querySelector(".npc-meta")?.textContent?.trim() ||
      "";
    return [
      `fantasy character portrait of ${name}`,
      meta ? `(${meta})` : "",
      "bust shot, dramatic rim light, clean background, game UI portrait, high detail",
    ]
      .filter(Boolean)
      .join(", ");
  }

  // Try your existing global first; fall back to backend
  async function generateImage(prompt) {
    if (typeof window.generatePortraitURL === "function") {
      return await window.generatePortraitURL({ prompt }); // must return a URL or data URL
    }
    const res = await fetch("/api/generate-portrait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size: "512x512" }),
    });
    if (!res.ok) throw new Error("Generation failed");
    const data = await res.json();
    return (
      data.imageUrl || (data.b64 ? `data:image/png;base64,${data.b64}` : "")
    );
  }

  function bindButton() {
    const btn = document.getElementById("gen-npc");
    const list = document.getElementById("npcs-list");
    if (!btn || !list) return;

    btn.addEventListener("click", async () => {
      const active =
        list.querySelector(".npc.is-active") || list.querySelector(".npc");
      if (!active) return;

      const prompt = buildPrompt(active);
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Generating…";
      try {
        const url = await generateImage(prompt);
        if (url) {
          active.dataset.img = url;
          window.showNPCPreview({
            name:
              active.dataset.name ||
              active.querySelector(".npc-name")?.textContent?.trim(),
            meta:
              active.dataset.meta ||
              active.querySelector(".npc-meta")?.textContent?.trim(),
            img: url,
          });
        }
      } catch (e) {
        console.error(e);
        alert("Failed to generate portrait. See console.");
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  }

  window.addEventListener("DOMContentLoaded", bindButton);
})();
