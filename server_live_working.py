# server_live.py — Live endpointed STT + ORIGINAL-STYLE summarizer integration
# - Waits while the speaker talks; finalizes after ~800 ms of silence (endpointing via WebRTC VAD)
# - Transcribes with faster-whisper (English-only by default)
# - Summarizes EXACTLY like your original notebook schema via local Ollama (gemma3:4b)
# - Broadcasts the same message types your UI expects:
#       "World State Update" / "Character Action: <Name>" / "Character Outcome: <Name>" / "Quest Update"
#
# Setup:
#   pip install fastapi uvicorn faster-whisper webrtcvad numpy requests
#   (and install ffmpeg via your OS: brew/apt/etc)
#   Run an Ollama model locally (e.g., `ollama run gemma3:4b`)
#
# Run:
#   python server_live.py

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
        "  pip install fastapi uvicorn faster-whisper webrtcvad numpy requests\n"
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
            # keepalive; we don't expect inbound UI traffic
            await websocket.receive_text()
    except WebSocketDisconnect:
        print("[/ws] UI client disconnected")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        ws_clients.discard(websocket)

# ---------------- Whisper + config ----------------
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small.en")  # try "medium.en" for more accuracy
whisper_model: Optional[WhisperModel] = None

def init_whisper():
    global whisper_model
    if WhisperModel is not None and whisper_model is None:
        print("[whisper] loading:", WHISPER_MODEL_SIZE)
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, compute_type="auto")
        print("[whisper] ready")

def initial_prompt() -> str:
    # Your names to bias spelling
    names = ["Anika (A N I K A)", "Mukul (M U K U L)", "Paul", "Jacob"]
    return (
        "Transcribe literally. This is a Dungeons & Dragons tabletop session. "
        "Use digits for numbers. Prefer these spellings: " + ", ".join(names) + ". "
        "Use 'and' instead of '&'. Avoid filler like 'thank you' or 'okay'."
    )

# ---------------- Light normalizers ----------------
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
    t = re.sub(r"\s*&\s*", " and ", text)
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

    return t.strip()

# ---------------- Endpointing VAD (20 ms frames) ----------------
SR = 16000
FRAME_MS = 20
FRAME_SAMPLES = int(SR * (FRAME_MS/1000.0))  # 320

# Endpoint tuning (tweak if desired)
START_TRIGGER_MS   = int(os.environ.get("START_TRIGGER_MS", 200))   # speech needed to start
HANGOVER_MS        = int(os.environ.get("HANGOVER_MS", 800))        # silence to finalize
MIN_UTTER_MS       = int(os.environ.get("MIN_UTTER_MS", 1000))      # drop shorter than this
MAX_UTTER_MS       = int(os.environ.get("MAX_UTTER_MS", 20000))     # hard cut monologues
PREROLL_MS         = int(os.environ.get("PREROLL_MS", 200))         # include before start

START_TRIGGER_FR   = START_TRIGGER_MS // FRAME_MS
HANGOVER_FR        = HANGOVER_MS // FRAME_MS
MIN_UTTER_FR       = MIN_UTTER_MS // FRAME_MS
MAX_UTTER_FR       = MAX_UTTER_MS // FRAME_MS
PREROLL_FR         = PREROLL_MS // FRAME_MS

class EndpointASR:
    """Keeps frames until end-of-speech, then yields a full utterance."""
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
        fb = frame_i16.tobytes()
        is_speech = self.vad.is_speech(fb, SR)

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

# ---------------- Ollama summarizer (ORIGINAL schema) ----------------
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
USE_OLLAMA = True  # set False to disable and always use rule-based fallback

SYSTEM_PROMPT = """
# ROLE
You are a highly organized and meticulous Dungeon Master's Assistant. Your task is to analyze a raw text transcript from a Dungeons & Dragons gameplay session and extract structured information into a specific JSON format.

# INSTRUCTIONS
1.  **Read the provided transcript chunk carefully.**
2.  **Categorize every relevant event, action, and detail** into the four lists defined below.
3.  **Be concise and factual.** Summarize the events clearly without adding flavor text or your own commentary.
4.  **Only extract information that is explicitly stated or clearly implied in the text.** Do not invent or assume details.
5.  **If a category has no relevant information for the chunk, leave its list empty.**

# OUTPUT FORMAT
You MUST output a valid JSON object that matches this schema:

```json
{
    "world_state_updates": [
    {
      "location": "Name of the location or general setting",
      "update": "A factual statement about a change in the world (e.g., 'The innkeeper is now hostile', 'The bridge is destroyed', 'The king offered a 500gp reward')."
    }
  ],
    "player_actions": [
    {
      "player": "Character Name",
      "action": "The specific action they took (e.g., 'attacked the ogre', 'persuaded the guard', 'searched the desk').",
      "outcome": "The direct result of their action (e.g., 'dealt 12 damage', 'convinced him to lower his weapon', 'found a hidden letter')."
    }
  ],
  
  "quest_updates": [
    {
      "quest": "The name or description of the quest (e.g., 'Find the Lost Mine', 'Stop the Cult Ritual')",
      "update": "The progress made (e.g., 'discovered the cave entrance', 'obtained the Sacred Gem', 'defeated the cult leader')",
    }
  ]
}"""

def _best_json_block(text: str) -> Optional[str]:
    """Extract the first {...} JSON object block from a string."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    return None

def summarize_with_ollama(text: str) -> Optional[Dict[str, Any]]:
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
        print("[ollama] summarizer error:", e)
        return None

# --------- Rule-based fallback (fast; used if Ollama not available) ---------
def summarize_rule_based(text: str) -> Dict[str, Any]:
    low = text.lower()
    out = {"world_state_updates": [], "player_actions": [], "story_progression": []}

    # Dice rolls / "X rolled a N"
    m = re.findall(r"\b([A-Z][a-z]+)\s+rolled\s+a\s+(\d{1,2})\b", text)
    for name, num in m:
        out["player_actions"].append({"player": name, "action": f"rolled a {num}", "outcome": ""})

    # Simple action cues
    if any(k in low for k in ["attacks","attack","casts","shoots","checks","sneaks","stealth","investigate","perception","rolls","rolled"]):
        out["player_actions"].append({"player": "Unknown", "action": text, "outcome": ""})

    # World/location hints
    if any(k in low for k in ["room","door","hall","corridor","tavern","forest","dungeon","street","map","river","camp","party"]):
        out["world_state_updates"].append({"location": "Unknown", "update": text})

    # Story/quest hints
    if any(k in low for k in ["quest","clue","contract","bounty","rumor","lead","goal","objective"]):
        out["story_progression"].append({"quest": "Unknown", "update": text})

    return out

def summarize_original_style(text: str) -> Dict[str, Any]:
    """Try Ollama first (original flow). If it fails, use rule-based."""
    if USE_OLLAMA:
        data = summarize_with_ollama(text)
        if data and all(k in data for k in ["world_state_updates", "player_actions", "story_progression"]):
            return data
        print("[ollama] falling back to rule-based summarizer")
    return summarize_rule_based(text)

# ---------------- /audio WebSocket ----------------
@app.websocket("/audio")
async def ws_audio(websocket: WebSocket):
    await websocket.accept()
    print("[/audio] Audio client connected")
    init_whisper()

    # Endpointing VAD
    if webrtcvad is None:
        raise RuntimeError("webrtcvad not installed")
    vad = webrtcvad.Vad(2)  # 0..3
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

            # feed endpointing
            utterances: List[np.ndarray] = []
            for fr in frames:
                utterances.extend(ep.process_frame(fr))

            # Transcribe finalized utterances, then summarize to original shape and broadcast
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

                # Merge + light quality filtering
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

                # Summarize in the SAME schema as the original notebook
                data = summarize_original_style(transcript)

                # --- Broadcast to match your UI's expectations ---
                # World state
                for item in data.get("world_state_updates", []):
                    upd = item.get("update", "").strip()
                    if upd:
                        await broadcast_event({"heading": "World State Update", "content": upd})

                # Player actions -> Action + Outcome messages (two lines so your UI formats them)
                for item in data.get("player_actions", []):
                    name = item.get("player") or "Unknown"
                    action = (item.get("action") or "").strip()
                    outcome = (item.get("outcome") or "").strip()
                    if action:
                        await broadcast_event({"heading": f"Character Action: {name}", "content": action})
                    if outcome:
                        await broadcast_event({"heading": f"Character Outcome: {name}", "content": outcome})

                # Story / Quest
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
    uvicorn.run(app, host="127.0.0.1", port=8000)
