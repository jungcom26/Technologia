# server_live.py — Live STT + AutoGen(Ollama) summarizer → ORIGINAL UI events
# - Endpointing with webrtcvad (~800 ms hangover)
# - STT: faster-whisper (English-only models by default)
# - Summarizer priority: AutoGen(Ollama) → Ollama HTTP → Rule-based fallback
# - Emits: "World State Update" / "Character Action: <Name>" / "Character Outcome: <Name>" / "Quest Update"

from __future__ import annotations
import json, re, os
from collections import deque
from typing import Dict, Any, List, Optional

import numpy as np
import uvicorn
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    from faster_whisper import WhisperModel
    import webrtcvad
except Exception:
    WhisperModel = None
    webrtcvad = None
    print(
        "Install deps first:\n"
        "  pip install fastapi uvicorn faster-whisper webrtcvad numpy requests autogen-agentchat autogen-ext\n"
        "and install ffmpeg via your OS."
    )

# ---------------- FastAPI ----------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------------- /ws broadcast ----------------
ws_clients: "set[WebSocket]" = set()

async def broadcast_event(event: Dict[str, Any]):
    msg = json.dumps(event, ensure_ascii=False)
    dead = []
    for ws in list(ws_clients):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for d in dead:
        try:
            await d.close()
        except Exception:
            pass
        ws_clients.discard(d)

@app.websocket("/ws")
async def ws_ui(websocket: WebSocket):
    await websocket.accept()
    ws_clients.add(websocket)
    print("[/ws] UI client connected")
    try:
        await broadcast_event({"heading": "System", "content": "🧭 New adventure begins"})
        while True:
            await websocket.receive_text()  # keepalive
    except WebSocketDisconnect:
        print("[/ws] UI client disconnected")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        ws_clients.discard(websocket)

# ---------------- Whisper + config ----------------
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small.en")
whisper_model: Optional[WhisperModel] = None

def init_whisper():
    global whisper_model
    if WhisperModel is not None and whisper_model is None:
        print("[whisper] loading:", WHISPER_MODEL_SIZE)
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, compute_type="auto")
        print("[whisper] ready")

def initial_prompt() -> str:
    names = ["Anika (A N I K A)", "Mukul (M U K U L)", "Paul", "Jacob"]
    return (
        "Transcribe literally. This is a Dungeons & Dragons tabletop session. "
        "Use digits for numbers. Prefer these spellings: " + ", ".join(names) + ". "
        "Use 'and' instead of '&'. Avoid filler like 'thank you' or 'okay'."
    )

# ---------------- Normalizers ----------------
NUM_WORDS = {
    "zero":0,"oh":0,"one":1,"two":2,"to":2,"too":2,"three":3,"four":4,"for":4,"five":5,
    "six":6,"seven":7,"eight":8,"ate":8,"nine":9,"ten":10,"eleven":11,"twelve":12,
    "thirteen":13,"fourteen":14,"fifteen":15,"sixteen":16,"seventeen":17,"eighteen":18,"nineteen":19,"twenty":20,
}
NAME_CANON = {
    "anika": "Anika", "annika": "Anika", "anikah": "Anika",
    "mukul": "Mukul", "mukal": "Mukul", "mokal": "Mukul", "mokko": "Mukul",
    "paul": "Paul", "jacob": "Jacob",
}

def number_word_to_int(tok: str) -> Optional[int]:
    tok = tok.lower().strip("-")
    if tok.isdigit(): return int(tok)
    if tok in NUM_WORDS: return NUM_WORDS[tok]
    if "-" in tok:
        a, b = tok.split("-", 1)
        if a in NUM_WORDS and b in NUM_WORDS:
            return NUM_WORDS[a] + NUM_WORDS[b]
    return None

_roll_pat = re.compile(r"\b(roll(?:ed|s|ing)?)\s+(?:a|an|the)?\s*([A-Za-z\-]+|\d+)\b", re.I)

def normalize_text(text: str) -> str:
    t = text
    t = re.sub(r"\s*&\s*", " and ", t)
    t = re.sub(r"\broll(?:ed|s|ing)?\s+on\b", "rolling a", t, flags=re.I)
    def _fix_roll(m: re.Match) -> str:
        n = number_word_to_int(m.group(2))
        return f"{m.group(1)} a {n}" if n is not None else m.group(0)
    t = _roll_pat.sub(_fix_roll, t)
    def _canon(m: re.Match) -> str:
        raw = m.group(0); key = raw.lower()
        return NAME_CANON.get(key, raw.capitalize())
    if NAME_CANON:
        t = re.sub(r"\b(" + "|".join(map(re.escape, NAME_CANON.keys())) + r")\b", _canon, t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip()
    return t

# ---------------- Endpointing VAD (20 ms frames) ----------------
SR = 16000
FRAME_MS = 20
FRAME_SAMPLES = int(SR * (FRAME_MS/1000.0))  # 320

START_TRIGGER_MS   = int(os.environ.get("START_TRIGGER_MS", 200))
HANGOVER_MS        = int(os.environ.get("HANGOVER_MS", 800))
MIN_UTTER_MS       = int(os.environ.get("MIN_UTTER_MS", 1000))
MAX_UTTER_MS       = int(os.environ.get("MAX_UTTER_MS", 20000))
PREROLL_MS         = int(os.environ.get("PREROLL_MS", 200))

START_TRIGGER_FR   = START_TRIGGER_MS // FRAME_MS
HANGOVER_FR        = HANGOVER_MS // FRAME_MS
MIN_UTTER_FR       = MIN_UTTER_MS // FRAME_MS
MAX_UTTER_FR       = MAX_UTTER_MS // FRAME_MS
PREROLL_FR         = PREROLL_MS // FRAME_MS

class EndpointASR:
    def __init__(self, vad_aggr: int = 2):
        if webrtcvad is None:
            raise RuntimeError("webrtcvad not installed")
        self.vad = webrtcvad.Vad(vad_aggr)
        self.in_speech = False
        self.speech_streak = 0
        self.silence_streak = 0
        self.cur_frames: List[np.ndarray] = []
        self.pre_frames: deque[np.ndarray] = deque(maxlen=PREROLL_FR)

    def process_frame(self, frame_i16: np.ndarray) -> List[np.ndarray]:
        out: List[np.ndarray] = []
        is_speech = self.vad.is_speech(frame_i16.tobytes(), SR)
        if not self.in_speech:
            self.pre_frames.append(frame_i16)
            if is_speech:
                self.speech_streak += 1
                if self.speech_streak >= START_TRIGGER_FR:
                    self.in_speech = True
                    self.cur_frames = list(self.pre_frames)
                    self.silence_streak = 0
            else:
                self.speech_streak = 0
        else:
            if is_speech:
                self.cur_frames.append(frame_i16)
                self.silence_streak = 0
                if len(self.cur_frames) >= MAX_UTTER_FR:
                    out.append(self._finalize())
            else:
                self.silence_streak += 1
                if self.silence_streak >= HANGOVER_FR:
                    if len(self.cur_frames) >= MIN_UTTER_FR:
                        out.append(self._finalize())
                    else:
                        self._reset_utterance()
        return out

    def _finalize(self) -> np.ndarray:
        pcm = np.concatenate(self.cur_frames).astype(np.int16)
        self._reset_utterance()
        return pcm

    def _reset_utterance(self):
        self.in_speech = False
        self.speech_streak = 0
        self.silence_streak = 0
        self.cur_frames = []
        self.pre_frames.clear()

# ---------------- Summarizer: AutoGen → Ollama ----------------
OLLAMA_URL  = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:12b")

SYSTEM_PROMPT = """You are a highly organized Dungeon Master's Assistant. Extract ONLY what is in the transcript into this JSON:

{
  "world_state_updates": [
    { "location": "<where or context>", "update": "<what changed>" }
  ],
  "player_actions": [
    { "player": "<PC/NPC name>", "action": "<what they did>", "outcome": "<direct result (or empty if none)>" }
  ],
  "story_progression": [
    { "quest": "<quest or goal name/desc>", "update": "<progress update>" }
  ]
}

Rules:
- Be concise and factual; no embellishment or opinions.
- If a field is unknown, use a short best label (e.g., "Unknown", "Narrator") or leave outcome empty.
- Keep numbers as digits. Use 'and' not '&'.
- If nothing for a section, return an empty list for it.
Return ONLY the JSON.
"""

# Lazy import + client holder so the server still runs without autogen installed
AUTO_CLIENT = None
AUTO_READY = False

def init_autogen():
    """Init AutoGen Ollama client with Pydantic response format matching the original schema."""
    global AUTO_CLIENT, AUTO_READY
    try:
        from pydantic import BaseModel, Field
        from typing import List, Optional as Opt
        from autogen_ext.models.ollama import OllamaChatCompletionClient

        class WorldStateUpdate(BaseModel):
            location: str = Field(..., description="Location or context")
            update: str = Field(..., description="What changed")

        class PlayerAction(BaseModel):
            player: str = Field(..., description="PC/NPC name")
            action: str = Field(..., description="Action taken")
            outcome: Opt[str] = Field(default="", description="Direct result (optional)")

        class StoryProgress(BaseModel):
            quest: str = Field(..., description="Quest or goal")
            update: str = Field(..., description="Progress update")

        class ChunkSummary(BaseModel):
            world_state_updates: List[WorldStateUpdate] = Field(default_factory=list)
            player_actions: List[PlayerAction] = Field(default_factory=list)
            story_progression: List[StoryProgress] = Field(default_factory=list)

        # Many versions accept these kwargs; model_info covers older signatures.
        AUTO_CLIENT = OllamaChatCompletionClient(
            model=OLLAMA_MODEL,
            response_format=ChunkSummary,
            json_output=True,
            temperature=0.1,
            system_message=SYSTEM_PROMPT,
            model_info={"json_output": True, "temperature": 0.1},
        )
        AUTO_READY = True
        print(f"[autogen] ready with model {OLLAMA_MODEL}")
    except Exception as e:
        AUTO_READY = False
        AUTO_CLIENT = None
        print(f"[autogen] init failed: {type(e).__name__}: {e}. Falling back to HTTP/rule-based.")

def summarize_with_autogen(text: str) -> Optional[Dict[str, Any]]:
    """Use AutoGen to produce the original schema as dict."""
    if not AUTO_READY or AUTO_CLIENT is None:
        return None
    try:
        # Some versions return a Pydantic object; others return a dict; some return a ChatMessage-like.
        resp = AUTO_CLIENT.create(messages=[{"role": "user", "content": text}])
        # Pydantic object
        try:
            return resp.model_dump()  # type: ignore[attr-defined]
        except Exception:
            pass
        # Dict already in shape
        if isinstance(resp, dict) and {"world_state_updates","player_actions","story_progression"} <= set(resp.keys()):
            return resp
        # Some clients put text under "content"
        content = None
        if isinstance(resp, dict):
            content = resp.get("content")
        elif hasattr(resp, "content"):
            content = getattr(resp, "content")
        if isinstance(content, str):
            block = _best_json_block(content)
            if block:
                return json.loads(block)
    except Exception as e:
        print(f"[autogen] summarizer error: {type(e).__name__}: {e}")
    return None

# ---------------- Ollama HTTP JSON mode (backup if AutoGen fails) ----------------
def _best_json_block(text: str) -> Optional[str]:
    start = text.find("{")
    if start == -1: return None
    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    return None

def summarize_with_ollama_http(text: str) -> Optional[Dict[str, Any]]:
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "options": {"temperature": 0.1},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
        }
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=60)
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "") or ""
        block = _best_json_block(content.strip())
        if not block:
            return None
        return json.loads(block)
    except Exception as e:
        print(f"[ollama-http] error: {type(e).__name__}: {e}")
        return None

# --------- Rule-based fallback ----------
SENT_SPLIT = re.compile(r'(?<=[.!?])\s+')
FILLER_RX = re.compile(r"\b(uh|um|like|you know|i mean|sort of|kind of|basically|literally)\b", re.I)

def _clean_sentence(s: str) -> str:
    s = FILLER_RX.sub("", s)
    s = re.sub(r"\s+", " ", s).strip(" -")
    return s

def _cap(s: str, n: int) -> str:
    if len(s) <= n: return s
    cut = max(s.rfind(", ", 0, n), s.rfind("; ", 0, n), s.rfind(" ", 0, n))
    if cut <= 0: cut = n
    return s[:cut].rstrip() + "…"

def summarize_rule_based(text: str) -> Dict[str, Any]:
    low = text.lower()
    out = {"world_state_updates": [], "player_actions": [], "story_progression": []}

    for name, num in re.findall(r"\b([A-Z][a-z]+)\s+rolled\s+a\s+(\d{1,2})\b", text):
        out["player_actions"].append({"player": name, "action": f"rolled a {num}", "outcome": ""})

    if re.search(r"\b(attacks?|casts?|shoots?|checks?|sneaks?|stealth|investigat|perception|roll(?:ed|s)?)\b", low):
        out["player_actions"].append({"player": "Unknown", "action": _cap(text, 140), "outcome": ""})

    if re.search(r"\b(room|door|hall|corridor|tavern|forest|dungeon|street|camp|party|village|town|map)\b", low):
        out["world_state_updates"].append({"location": "World", "update": _cap(text, 160)})

    if re.search(r"\b(quest|clue|contract|bounty|rumor|lead|goal|objective|mission)\b", low):
        out["story_progression"].append({"quest": "Quest", "update": _cap(text, 160)})

    if not any(out.values()):
        sents = [x for x in SENT_SPLIT.split(text) if x.strip()]
        top = []
        for s in sents:
            s2 = _clean_sentence(s)
            if not s2: continue
            top.append(_cap(s2, 180))
            if len(top) == 2: break
        if top:
            out["world_state_updates"].append({"location": "Narration", "update": " ".join(top)})

    return out

def summarize_original_style(text: str) -> Dict[str, Any]:
    # 1) AutoGen/Ollama
    data = summarize_with_autogen(text)
    if data and all(k in data for k in ["world_state_updates","player_actions","story_progression"]):
        return data
    print("[summarizer] autogen unavailable or returned invalid JSON; trying Ollama HTTP…")

    # 2) Ollama HTTP
    data = summarize_with_ollama_http(text)
    if data and all(k in data for k in ["world_state_updates","player_actions","story_progression"]):
        return data
    print("[summarizer] Ollama HTTP failed; falling back to rule-based.")

    # 3) Rule-based
    return summarize_rule_based(text)

# ---------------- /audio WebSocket ----------------
@app.websocket("/audio")
async def ws_audio(websocket: WebSocket):
    await websocket.accept()
    print("[/audio] Audio client connected")
    init_whisper()
    init_autogen()

    if webrtcvad is None:
        raise RuntimeError("webrtcvad not installed")
    ep = EndpointASR(vad_aggr=2)
    remainder = np.zeros(0, dtype=np.int16)

    try:
        while True:
            raw = await websocket.receive_bytes()
            if not raw:
                continue
            buf = np.frombuffer(raw, dtype=np.int16)
            if buf.size == 0:
                continue

            if remainder.size:
                buf = np.concatenate([remainder, buf])
                remainder = np.zeros(0, dtype=np.int16)

            total = (buf.size // FRAME_SAMPLES) * FRAME_SAMPLES
            frames = buf[:total].reshape(-1, FRAME_SAMPLES)
            if buf.size > total:
                remainder = buf[total:]

            utterances: List[np.ndarray] = []
            for fr in frames:
                utterances.extend(ep.process_frame(fr))

            for utt in utterances:
                audio_f32 = utt.astype(np.float32) / 32768.0
                segments, info = whisper_model.transcribe(
                    audio_f32,
                    language="en",
                    beam_size=5,
                    best_of=5,
                    temperature=0.0,
                    vad_filter=False,
                    condition_on_previous_text=False,
                    initial_prompt=initial_prompt(),
                )

                parts = []
                for seg in segments:
                    txt = (getattr(seg, "text", "") or "").strip()
                    if not txt:
                        continue
                    avg_lp = float(getattr(seg, "avg_logprob", 0.0))
                    comp   = float(getattr(seg, "compression_ratio", 0.0))
                    if avg_lp < -1.1 or comp > 2.4:
                        continue
                    if txt.lower() in {"thank you.", "okay.", "ok.", "you.", "bye."}:
                        continue
                    parts.append(txt)

                if not parts:
                    continue

                transcript = normalize_text(" ".join(parts))
                print(f"[/audio] transcript: {transcript}")

                data = summarize_original_style(transcript)

                # --- Broadcast in your UI's shapes ---
                for item in data.get("world_state_updates", []):
                    upd = (item.get("update") or "").strip()
                    if upd:
                        await broadcast_event({"heading": "World State Update", "content": upd})

                for item in data.get("player_actions", []):
                    name = item.get("player") or "Unknown"
                    action = (item.get("action") or "").strip()
                    outcome = (item.get("outcome") or "").strip()
                    if action:
                        await broadcast_event({"heading": f"Character Action: {name}", "content": action})
                    if outcome:
                        await broadcast_event({"heading": f"Character Outcome: {name}", "content": outcome})

                for item in data.get("story_progression", []):
                    quest = item.get("quest") or "Quest"
                    update = (item.get("update") or "").strip()
                    if update:
                        await broadcast_event({"heading": "Quest Update", "quest_name": quest, "content": update})

    except WebSocketDisconnect:
        print("[/audio] Audio client disconnected")
    except Exception as e:
        print("[/audio] error:", e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# ---------------- main ----------------
if __name__ == "__main__":
    print(f"[ollama] target: {OLLAMA_URL}  model: {OLLAMA_MODEL}")
    uvicorn.run(app, host="127.0.0.1", port=8000)
