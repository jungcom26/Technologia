(() => {
  const L = (...a) => console.log("[live]", ...a);

  // ---------- DOM and UI helpers to keep UI look ----------
  const $ = (s) => document.querySelector(s);
  const stateEl = $("#tx-state");
  const dotEl = $("#tx-dot");
  const btnStart = $("#btn-start");
  const btnPause = $("#btn-pause");
  const btnStop = $("#btn-stop");

  const setUiState = (m) => {
    if (!stateEl || !dotEl) return;
    if (m === "recording") {
      stateEl.textContent = "Recording";
      dotEl.classList.add("on");
    } else {
      stateEl.textContent = "Idle";
      dotEl.classList.remove("on");
    }
  };

  const add = (html) =>
    typeof addLogMessage === "function"
      ? addLogMessage(html)
      : console.warn("addLogMessage missing");
  const ts = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function showToast(title, text) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const wrap = document.createElement("div");
    wrap.className = "toast quest";
    wrap.innerHTML = `
      <div class="toast-inner">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-text">${escapeHtml(text || "")}</div>
      </div>
    `;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("on"));
    setTimeout(() => {
      wrap.classList.remove("on");
      wrap.addEventListener("transitionend", () => wrap.remove(), {
        once: true,
      });
    }, 4200);
  }
  function escapeHtml(s = "") {
    return s.replace(
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
  }

  const pushSystem = (text) =>
    add(`
    <div class="msg right">
      <div class="avatar">S</div>
      <div class="bubble">
        <div class="meta">${ts()} • System</div>
        <em>${text}</em>
      </div>
    </div>
  `);

  const pushSummary = (text) =>
    add(`
    <div class="msg left">
      <div class="avatar">🧾</div>
      <div class="bubble">
        <div class="meta">${ts()} • Summary</div>
        ${text}
      </div>
    </div>
  `);

  // ---------- UI WebSocket to show summaries ----------
  (function openUiWs() {
    try {
      const uiWs = new WebSocket("ws://127.0.0.1:8000/ws");
      uiWs.onopen = () => L("/ws open");
      uiWs.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);

          // เดิม: โชว์สรุป
          if (m.type === "summary") pushSummary(m.text || "");

          // ใหม่: เด้ง toast เมื่อมี Quest Update
          if (m.heading === "Quest Update") {
            const title = m.quest_name
              ? `Quest Received: ${m.quest_name}`
              : "Quest Update";
            showToast(title, m.content || "");

            // เติมลง Recent Quests panel ด้วย (ตัวเลือก)
            const qlist = document.getElementById("quest-list");
            if (qlist) {
              document.getElementById("quest-placeholder")?.remove();
              const item = document.createElement("div");
              item.className = "quest-list-item";
              item.style.padding = "10px 12px";
              item.style.borderBottom = "1px solid rgba(255,255,255,.08)";
              item.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span class="pill pill-red" style="font-size:11px">Quest</span>
                  <strong>${escapeHtml(m.quest_name || "Quest")}</strong>
                </div>
                <div class="muted" style="opacity:.8">${escapeHtml(
                  m.content || ""
                )}</div>
              `;
              qlist.prepend(item);
              qlist.scrollTop = 0;
            }
          }
        } catch {}
      };
      uiWs.onerror = (e) => L("/ws error", e);
      uiWs.onclose = () => L("/ws closed");
    } catch (e) {
      L("ui ws error", e);
    }
  })();

  // ---------- Mic audio streaming ----------
  let audioWs = null,
    audioContext = null,
    workletNode = null,
    procNode = null,
    isListening = false;

  const openAudioSocket = () =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:8000/audio");
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        L("/audio open");
        resolve(ws);
      };
      ws.onerror = (e) => {
        L("/audio error", e);
        reject(e);
      };
      ws.onclose = () => L("/audio closed");
    });

  // Helpers for fallback path
  const resampleTo16k = (input, inRate) => {
    const ratio = inRate / 16000,
      outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio,
        i0 = Math.floor(idx),
        i1 = Math.min(i0 + 1, input.length - 1),
        f = idx - i0;
      out[i] = input[i0] * (1 - f) + input[i1] * f;
    }
    return out;
  };
  const f32ToI16 = (f32) => {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const x = Math.max(-1, Math.min(1, f32[i])); // no extra gain on the mic input
      i16[i] = x < 0 ? x * 0x8000 : x * 0x7fff;
    }
    return i16;
  };

  async function startLive() {
    if (isListening) return;
    isListening = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      audioWs = await openAudioSocket();
      pushSystem("🎙️ Live mic → transcription started");
      setUiState("recording");

      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });
      const source = audioContext.createMediaStreamSource(stream);

      const secure =
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";
      const canWorklet = !!audioContext.audioWorklet && secure;

      if (canWorklet) {
        const workletCode = `
          class LinResample16kWorklet extends AudioWorkletProcessor {
            constructor(){ super(); this.ratio = sampleRate/16000; this.pos = 0; this.buf = []; }
            process(inputs){
              const ch = inputs[0][0]; if(!ch) return true;
              let pos=this.pos, r=this.ratio;
              while(pos < ch.length){
                const i0=Math.floor(pos), i1=Math.min(i0+1,ch.length-1), f=pos-i0;
                let s = ch[i0]*(1-f) + ch[i1]*f; s = Math.max(-1, Math.min(1, s));
                this.buf.push(s);
                if(this.buf.length >= 1600){
                  const pcm = new Int16Array(this.buf.length);
                  for(let j=0;j<pcm.length;j++){ const x=this.buf[j]; pcm[j]=x<0?x*0x8000:x*0x7FFF; }
                  this.port.postMessage(pcm.buffer,[pcm.buffer]); this.buf=[];
                }
                pos += r;
              }
              this.pos = pos - ch.length; return true;
            }
          }
          registerProcessor('linres-16k', LinResample16kWorklet);
        `;
        const url = URL.createObjectURL(
          new Blob([workletCode], { type: "text/javascript" })
        );
        await audioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        workletNode = new AudioWorkletNode(audioContext, "linres-16k");
        const sink = audioContext.createMediaStreamDestination();
        workletNode.connect(sink);
        source.connect(workletNode);
        workletNode.port.onmessage = (ev) => {
          if (audioWs && audioWs.readyState === WebSocket.OPEN)
            audioWs.send(ev.data);
        };
        return;
      }

      // Fallback
      const proc = audioContext.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const down = resampleTo16k(input, audioContext.sampleRate);
        const i16 = f32ToI16(down);
        const CHUNK = 1600; // ~100ms @16k
        for (let i = 0; i < i16.length; i += CHUNK) {
          const sub = i16.subarray(i, Math.min(i + CHUNK, i16.length));
          const bytes = sub.buffer.slice(
            sub.byteOffset,
            sub.byteOffset + sub.byteLength
          );
          if (audioWs && audioWs.readyState === WebSocket.OPEN)
            audioWs.send(bytes);
        }
      };
      source.connect(proc);
      proc.connect(audioContext.destination);
      procNode = proc;
    } catch (err) {
      console.error("[live] mic/worklet error", err);
      pushSystem("🚫 Microphone access denied or Audio error");
      isListening = false;
      setUiState("idle");
      try {
        audioWs && audioWs.close();
      } catch {}
    }
  }

  function stopLive() {
    try {
      workletNode && workletNode.disconnect();
    } catch {}
    try {
      procNode && procNode.disconnect();
    } catch {}
    try {
      audioContext && audioContext.close();
    } catch {}
    try {
      audioWs && audioWs.close();
    } catch {}
    workletNode = procNode = audioContext = audioWs = null;
    isListening = false;
    setUiState("idle");
    pushSystem("🛑 Transcription stopped");
  }

  window.addEventListener("DOMContentLoaded", () => {
    L("live client ready");
    btnStart && btnStart.addEventListener("click", startLive);
    btnPause && btnPause.addEventListener("click", stopLive);
    btnStop && btnStop.addEventListener("click", stopLive);
  });
})();
