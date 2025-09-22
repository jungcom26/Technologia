# Live D&D session transcription and summarization
# Install dependencies first:
# pip install requirements.txt

from __future__ import annotations

import asyncio
import inspect
import json
import os
import re
import sys
import tempfile
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import requests
import uvicorn
from db_manager import ensure_session, search_chunks, store_chunk
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from faster_whisper import WhisperModel
    import webrtcvad
except Exception:
    WhisperModel = None
    webrtcvad = None
    print(
        "Install deps first:\n"
        "  pip install fastapi uvicorn faster-whisper webrtcvad numpy requests autogen-agentchat autogen-ext \"pydantic>=2,<3\"\n"
        "and install ffmpeg via your OS."
    )

# ---------------- FastAPI ----------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------------- /ws broadcast ----------------
ws_clients: set[WebSocket] = set()


async def broadcast_event(event: Dict[str, Any]) -> None:
    msg = json.dumps(event, ensure_ascii=False)
    dead: List[WebSocket] = []
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
async def ws_ui(websocket: WebSocket) -> None:
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

def init_whisper() -> None:
    global whisper_model
    if WhisperModel is not None and whisper_model is None:
        print("[whisper] loading:", WHISPER_MODEL_SIZE)
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, compute_type="auto")
        print("[whisper] ready")

def initial_prompt() -> str:
    names = ["Anika (A N I K A)", "Mukul (M U K U L)", "Paul", "Jacob"] # Add your players' names here for better recognition
    return (
        "Transcribe literally. This is a Dungeons & Dragons tabletop session. "
        "Use digits for numbers. Prefer these spellings: " + ", ".join(names) + ". "
        "Use 'and' instead of '&'. Avoid filler like 'thank you' or 'okay'."
    )

# ---------------- Normalizers ----------------
NUM_WORDS = {
    "zero": 0,
    "oh": 0,
    "one": 1,
    "two": 2,
    "to": 2,
    "too": 2,
    "three": 3,
    "four": 4,
    "for": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "ate": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
}

NAME_CANON = {
    "anika": "Anika",
    "annika": "Anika",
    "anikah": "Anika",
    "mukul": "Mukul",
    "mukal": "Mukul",
    "mokal": "Mukul",
    "mokko": "Mukul",
    "paul": "Paul",
    "jacob": "Jacob",
}


def number_word_to_int(tok: str) -> Optional[int]:
    tok = tok.lower().strip("-")
    if tok.isdigit():
        return int(tok)
    if tok in NUM_WORDS:
        return NUM_WORDS[tok]
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
        raw = m.group(0)
        key = raw.lower()
        return NAME_CANON.get(key, raw.capitalize())
    if NAME_CANON:
        t = re.sub(r"\b(" + "|".join(map(re.escape, NAME_CANON.keys())) + r")\b", _canon, t, flags=re.I)

    return re.sub(r"\s+", " ", t).strip()

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

# ---------------- Pydantic schema (Divyansh's style from STT.ipynb) ------------------

class WorldStateUpdate(BaseModel):
    """Tracks changes to the environment, locations, factions, and overall world."""
    location: str = Field(..., description="e.g., 'The Blacksmith's Attitude', 'The Weather', 'Town of Greenest', 'The King's Decree'")
    update: str = Field(..., description="e.g., 'is now friendly', 'has turned to a storm', 'is now on high alert', 'has offered a 1000gp reward'")

class CharacterEvent(BaseModel):
    """Merges player actions, character tracking, and their outcomes into a single record."""
    character: str = Field(..., description="The name of the PC or important NPC")
    action: str = Field(..., description="What the character did")
    outcome: str = Field(..., description="Direct result of the action")

class QuestUpdate(BaseModel):
    """Tracks progress, discoveries, and completions related to the party's active goals."""
    quest: str = Field(..., description="Quest name/description")
    update: str = Field(..., description="Progress update")

class EntityRecord(BaseModel):
    """Represents a party member, NPC, or notable creature mentioned in the chunk."""
    name: str = Field(..., description="Primary name for the entity")
    kind: str = Field(default="unknown", description="Entity category such as player, npc, creature, item")
    description: str = Field(default="", description="Short descriptor or identifying details")
    aliases: List[str] = Field(default_factory=list, description="Alternative names or titles")


class ChunkStructuredOutput(BaseModel):
    """Structured output for a chunk of D&D session transcript."""
    world_state_updates: List[WorldStateUpdate] = Field(default_factory=list, description="List of world state updates in this chunk")
    character_events: List[CharacterEvent] = Field(default_factory=list, description="List of character events in this chunk")
    quest_updates: List[QuestUpdate] = Field(default_factory=list, description="List of quest updates in this chunk")
    entities: List[EntityRecord] = Field(default_factory=list, description="Entities mentioned in this chunk")

# ---------------- Summarizer: AutoGen → Ollama (await-safe) ----------------
OLLAMA_URL  = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:12b")

SYSTEM_PROMPT = """You are a meticulous Dungeon Master's Assistant. Return ONLY valid JSON that matches:

{
  "world_state_updates": [ { "location": "...", "update": "..." } ],
  "character_events":    [ { "character": "...", "action": "...", "outcome": "..." } ],
  "quest_updates":       [ { "quest": "...", "update": "..." } ],
  "entities":            [ { "name": "...", "kind": "...", "description": "...", "aliases": ["..."] } ]
}

Rules:
- Be concise and factual; do not invent.
- Keep numbers as digits; use 'and' not '&'.
- For entities, choose specific kinds like "player", "npc", "creature", or "item" when the context makes it clear.
- List aliases as strings without duplication; if none, return an empty list.
- If a field is unknown, use a short label like "Unknown" or leave outcome "".
- If no items for a section, return [] for that list.
Return ONLY the JSON object.
"""

AUTO_CLIENT: Optional[Any] = None
AUTO_READY: bool = False


def _best_json_block(text: str) -> Optional[str]:
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
                return text[start : i + 1]
    return None

def init_autogen() -> None:
    global AUTO_CLIENT, AUTO_READY
    try:
        from autogen_ext.models.ollama import OllamaChatCompletionClient
        AUTO_CLIENT = OllamaChatCompletionClient(
            model=OLLAMA_MODEL,
            response_format=ChunkStructuredOutput,  # <- YOUR schema
            json_output=True,
            temperature=0.1,
            system_message=SYSTEM_PROMPT,
            model_info={"json_output": True, "vision": False, "temperature": 0.1},
        )
        AUTO_READY = True
        print(f"[autogen] ready with model {OLLAMA_MODEL}")
    except Exception as e:
        AUTO_READY = False
        AUTO_CLIENT = None
        print(f"[autogen] init failed: {type(e).__name__}: {e}. Falling back to HTTP/rule-based.")

async def summarize_with_autogen(text: str) -> Optional[Dict[str, Any]]:
    if not AUTO_READY or AUTO_CLIENT is None:
        return None
    try:
        maybe = AUTO_CLIENT.create(messages=[{"role": "user", "content": text}])
        resp = await maybe if inspect.isawaitable(maybe) else maybe
        # Pydantic object
        try:
            return _ensure_chunk_keys(resp.model_dump())  # type: ignore[attr-defined]
        except Exception:
            pass
        # Dict already in shape
        if isinstance(resp, dict):
            if EXPECTED_CHUNK_KEYS <= set(resp.keys()):
                return resp
            content = resp.get("content")
            if isinstance(content, str):
                block = _best_json_block(content)
                return _ensure_chunk_keys(json.loads(block)) if block else None
        # Chat-like object
        content = getattr(resp, "content", None)
        if isinstance(content, str):
            block = _best_json_block(content)
            return _ensure_chunk_keys(json.loads(block)) if block else None
    except Exception as e:
        print(f"[autogen] summarizer error: {type(e).__name__}: {e}")
    return None

# ---- Ollama HTTP JSON mode (backup if AutoGen fails)
def summarize_with_ollama_http_sync(text: str) -> Optional[Dict[str, Any]]:
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
        return _ensure_chunk_keys(json.loads(block))
    except Exception as e:
        print(f"[ollama-http] error: {type(e).__name__}: {e}")
        return None

# --------- Rule-based fallback (sync) ----------
SENT_SPLIT = re.compile(r'(?<=[.!?])\s+')
FILLER_RX = re.compile(r"\b(uh|um|like|you know|i mean|sort of|kind of|basically|literally)\b", re.I)

EXPECTED_CHUNK_KEYS = {"world_state_updates", "character_events", "quest_updates", "entities"}


def _ensure_chunk_keys(data: Dict[str, Any]) -> Dict[str, Any]:
    for key in EXPECTED_CHUNK_KEYS:
        if key not in data or data[key] is None:
            data[key] = []
    return data

def _clean_sentence(s: str) -> str:
    s = FILLER_RX.sub("", s)
    s = re.sub(r"\s+", " ", s).strip(" -")
    return s

def _cap(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    cut = max(s.rfind(", ", 0, n), s.rfind("; ", 0, n), s.rfind(" ", 0, n))
    if cut <= 0:
        cut = n
    return s[:cut].rstrip() + "…"

def summarize_rule_based_sync(text: str) -> Dict[str, Any]:
    low = text.lower()
    out = {"world_state_updates": [], "character_events": [], "quest_updates": [], "entities": []}

    for name, num in re.findall(r"\b([A-Z][a-z]+)\s+rolled\s+a\s+(\d{1,2})\b", text):
        out["character_events"].append({"character": name, "action": f"rolled a {num}", "outcome": ""})

    if re.search(r"\b(attacks?|casts?|shoots?|checks?|sneaks?|stealth|investigat|perception|roll(?:ed|s)?)\b", low):
        out["character_events"].append({"character": "Unknown", "action": _cap(text, 140), "outcome": ""})

    if re.search(r"\b(room|door|hall|corridor|tavern|forest|dungeon|street|camp|party|village|town|map)\b", low):
        out["world_state_updates"].append({"location": "World", "update": _cap(text, 160)})

    if re.search(r"\b(quest|clue|contract|bounty|rumor|lead|goal|objective|mission)\b", low):
        out["quest_updates"].append({"quest": "Quest", "update": _cap(text, 160)})

    if not any(out[key] for key in ("world_state_updates", "character_events", "quest_updates")):
        sents = [x for x in SENT_SPLIT.split(text) if x.strip()]
        top = []
        for s in sents:
            s2 = _clean_sentence(s)
            if not s2: continue
            top.append(_cap(s2, 180))
            if len(top) == 2: break
        if top:
            out["world_state_updates"].append({"location": "Narration", "update": " ".join(top)})

    candidate_names = set()
    for token in re.findall(r"\b([A-Z][a-z]{2,})\b", text):
        if token in {"The", "When", "They", "That", "There"}:
            continue
        candidate_names.add(token)
    if candidate_names:
        out["entities"].extend(
            {"name": name, "kind": "unknown", "description": "", "aliases": []}
            for name in sorted(candidate_names)
        )

    return out

async def summarize_original_style(text: str) -> Dict[str, Any]:
    data = await summarize_with_autogen(text)
    if data:
        return _ensure_chunk_keys(data)
    print("[summarizer] autogen unavailable/invalid; trying Ollama HTTP…")

    data = await asyncio.to_thread(summarize_with_ollama_http_sync, text)
    if data:
        return _ensure_chunk_keys(data)
    print("[summarizer] Ollama HTTP failed; falling back to rule-based.")

    return summarize_rule_based_sync(text)

# ---------------- Real-time JSON persistence ----------------
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
SESSION_ID = time.strftime("%Y%m%d-%H%M%S")
JSONL_PATH = LOG_DIR / f"session-{SESSION_ID}.jsonl"
JSON_PATH  = LOG_DIR / f"session-{SESSION_ID}.json"

SESSION_AGG = {
    "session_id": SESSION_ID,
    "started_at": datetime.utcnow().isoformat() + "Z",
    "chunks": []  # list[ChunkStructuredOutput as dict]
}

try:
    ensure_session(SESSION_ID, SESSION_AGG["started_at"])
except Exception as db_init_err:
    print(f"[db] session init failed: {db_init_err}")

def _append_jsonl_sync(obj: dict):
    with JSONL_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def _write_json_atomic_sync(path: Path, obj: dict):
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as tmp:
        json.dump(obj, tmp, ensure_ascii=False)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp_name = tmp.name
    os.replace(tmp_name, path)

async def persist_chunk_model(chunk_model: ChunkStructuredOutput, transcript: str):
    # 1) Append a line (pure pydantic shape)
    await asyncio.to_thread(_append_jsonl_sync, chunk_model.model_dump())
    # 2) Update aggregate and write atomically
    SESSION_AGG["chunks"].append(chunk_model.model_dump())
    await asyncio.to_thread(_write_json_atomic_sync, JSON_PATH, SESSION_AGG)
    # 3) Persist structured context into SQLite for later retrieval
    try:
        await asyncio.to_thread(
            store_chunk,
            SESSION_ID,
            transcript,
            chunk_model.model_dump(),
        )
    except Exception as db_err:
        print(f"[db] chunk persistence failed: {db_err}")


ANSWER_SYSTEM_PROMPT_QA = (
    "You are a lore keeper for a Dungeons & Dragons table."
    " Answer player questions using only the provided session context."
    " If the context does not contain the answer, say you do not know."
    " When possible, cite the character names, entities, items, and places mentioned in the context."
)


class ContextWorldUpdate(BaseModel):
    location: str
    update: str


class ContextCharacterEvent(BaseModel):
    character: str
    action: str
    outcome: str


class ContextQuestUpdate(BaseModel):
    quest: str
    update: str


class ContextEntity(BaseModel):
    name: str
    kind: str = "unknown"
    description: str = ""
    aliases: List[str] = Field(default_factory=list)


class ContextChunk(BaseModel):
    chunk_id: int
    session_id: str
    chunk_index: int
    transcript: str
    created_at: str
    transcript_snippet: str
    metadata_snippet: str
    world_state_updates: List[ContextWorldUpdate] = Field(default_factory=list)
    character_events: List[ContextCharacterEvent] = Field(default_factory=list)
    quest_updates: List[ContextQuestUpdate] = Field(default_factory=list)
    entities: List[ContextEntity] = Field(default_factory=list)


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3)
    session_id: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)


class QueryAnswer(BaseModel):
    answer: str
    context: List[ContextChunk]


async def answer_question(question: str, session_id: Optional[str], limit: int) -> QueryAnswer:
    raw_chunks = await asyncio.to_thread(search_chunks, question, session_id, limit)
    if not raw_chunks:
        return QueryAnswer(answer="I couldn't find anything about that yet.", context=[])

    prepared: List[ContextChunk] = []
    for chunk in raw_chunks:
        chunk["transcript_snippet"] = chunk.get("transcript_snippet") or chunk.get("transcript", "")[:180]
        chunk["metadata_snippet"] = chunk.get("metadata_snippet") or ""
        prepared.append(ContextChunk(**chunk))

    prompt_text = _context_to_prompt(question, prepared)
    answer = await asyncio.to_thread(_call_ollama_answer, question, prompt_text)
    if not answer:
        answer = _fallback_answer(prepared)

    return QueryAnswer(answer=answer, context=prepared)


def _context_to_prompt(question: str, chunks: List[ContextChunk]) -> str:
    lines = [f"Question: {question}", "Context:"]
    for idx, chunk in enumerate(chunks, start=1):
        lines.append(
            f"{idx}. Session {chunk.session_id} chunk #{chunk.chunk_index} ({chunk.created_at}):"
        )
        lines.append(f"   Transcript: {_trim_text(chunk.transcript)}")
        if chunk.character_events:
            lines.append("   Character events:")
            for event in chunk.character_events:
                outcome = event.outcome or ""
                lines.append(
                    f"    - {event.character}: {event.action}" + (f" → {outcome}" if outcome else "")
                )
        if chunk.world_state_updates:
            lines.append("   World state updates:")
            for upd in chunk.world_state_updates:
                lines.append(f"    - {upd.location}: {upd.update}")
        if chunk.quest_updates:
            lines.append("   Quest updates:")
            for quest in chunk.quest_updates:
                lines.append(f"    - {quest.quest}: {quest.update}")
        if chunk.entities:
            lines.append("   Entities:")
            for ent in chunk.entities:
                alias_part = f" (aka {', '.join(ent.aliases)})" if ent.aliases else ""
                desc_part = f" — {ent.description}" if ent.description else ""
                lines.append(
                    f"    - {ent.name} [{ent.kind}]{alias_part}{desc_part}"
                )
    return "\n".join(lines)


def _trim_text(text: str, limit: int = 480) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _call_ollama_answer(question: str, prompt_text: str) -> str:
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "options": {"temperature": 0.2},
            "messages": [
                {"role": "system", "content": ANSWER_SYSTEM_PROMPT_QA},
                {"role": "user", "content": prompt_text},
            ],
        }
        resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        answer = data.get("message", {}).get("content", "")
        return answer.strip()
    except Exception as exc:
        print(f"[ollama-answer] error: {exc}")
        return ""


def _fallback_answer(chunks: List[ContextChunk]) -> str:
    lines = [
        "I couldn't reach the language model, but here's what the log shows:",
    ]
    for chunk in chunks:
        summary_bits: List[str] = []
        for event in chunk.character_events:
            desc = f"{event.character} {event.action}"
            if event.outcome:
                desc += f" (Outcome: {event.outcome})"
            summary_bits.append(desc)
        for upd in chunk.world_state_updates:
            summary_bits.append(f"World - {upd.location}: {upd.update}")
        for quest in chunk.quest_updates:
            summary_bits.append(f"Quest - {quest.quest}: {quest.update}")
        for ent in chunk.entities:
            parts = [ent.name]
            if ent.kind and ent.kind != "unknown":
                parts.append(f"type={ent.kind}")
            if ent.aliases:
                parts.append(f"aliases={', '.join(ent.aliases)}")
            if ent.description:
                parts.append(ent.description)
            summary_bits.append("Entity - " + " | ".join(parts))
        if summary_bits:
            lines.append(f"• Chunk #{chunk.chunk_index}: " + "; ".join(summary_bits))
    if len(lines) == 1:
        lines.append("No structured entries were captured yet.")
    return "\n".join(lines)

@app.get("/session.json")
async def session_json():
    return SESSION_AGG


@app.post("/ask", response_model=QueryAnswer)
async def ask_question(req: QueryRequest):
    return await answer_question(req.question, req.session_id, req.limit)

# ---------------- /audio WebSocket ----------------
@app.websocket("/audio")
async def ws_audio(websocket: WebSocket) -> None:
    await websocket.accept()
    print("[/audio] Audio client connected")
    init_whisper()
    init_autogen()

    try:
        import webrtcvad
    except ImportError as e:
        print(f"Import error details: {e}")
        print(f"Python path: {sys.path}")
        raise RuntimeError("webrtcvad not installed - check virtual environment")
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

                data = await summarize_original_style(transcript)

                # Validate into Pydantic model (ensures exact schema and persist)
                try:
                    chunk_model = ChunkStructuredOutput.model_validate(data)
                except Exception:
                    # Fallback: try constructing directly from dict
                    chunk_model = ChunkStructuredOutput(**data)

                await persist_chunk_model(chunk_model, transcript)

                # --- Broadcast mapped to UI ---
                for item in chunk_model.world_state_updates:
                    upd = (item.update or "").strip()
                    loc = (item.location or "").strip()
                    if upd:
                        await broadcast_event(
                            {
                                "heading": "World State Update",
                                "content": upd,
                                "location": loc,  # expose location for UI display
                            }
                        )

                for item in chunk_model.character_events:
                    who = item.character or "Unknown"
                    action = (item.action or "").strip()
                    outcome = (item.outcome or "").strip()
                    if action:
                        await broadcast_event({"heading": f"Character Action: {who}", "content": action})
                    if outcome:
                        await broadcast_event({"heading": f"Character Outcome: {who}", "content": outcome})

                for item in chunk_model.quest_updates:
                    quest = item.quest or "Quest"
                    update = (item.update or "").strip()
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

# ==================== STABLE DIFFUSION PART ====================
SD_API_URL = "http://127.0.0.1:7860"

class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = None  # optional: user can specify which model to use
    steps: int = 20
    width: int = 256
    height: int = 256
    cfg_scale: float = 7.0


@app.get("/models")
async def list_models():
    """Fetch list of available SD models dynamically."""
    try:
        response = requests.get(f"{SD_API_URL}/sdapi/v1/sd-models")
        return response.json()
    except Exception as e:
        return {"error": str(e)}


@app.post("/generate-image/")
async def generate_image(req: GenerateRequest):
    payload = req.dict()

    if req.model:
        try:
            await asyncio.to_thread(
                requests.post,
                f"{SD_API_URL}/sdapi/v1/options",
                json={"sd_model_checkpoint": req.model}
            )
        except Exception as e:
            return {"error": f"Failed to set model: {str(e)}"}

    try:
        response = await asyncio.to_thread(
            requests.post,
            f"{SD_API_URL}/sdapi/v1/txt2img",
            json=payload
        )
        data = response.json()
        # return image as base64 (UI can render it with <img src="data:image/png;base64,..."/>)
        return {"image": data["images"][0]}
    except Exception as e:
        return {"error": str(e)}

# ---------------- main ----------------
if __name__ == "__main__":
    print(f"[ollama] target: {os.environ.get('OLLAMA_URL','http://127.0.0.1:11434')}  model: {OLLAMA_MODEL}")
    uvicorn.run(app, host="127.0.0.1", port=8000)
