# chroma_helpers.py
from __future__ import annotations
from typing import List, Dict, Optional, Tuple
from uuid import uuid4
from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
from datetime import datetime, timezone

STORE = Path("./chroma_storage")   # keep this consistent project-wide
STORE.mkdir(exist_ok=True)

_client = chromadb.PersistentClient(path=str(STORE))
_embed = embedding_functions.DefaultEmbeddingFunction()

def _col(name: str):
    return _client.get_or_create_collection(name=name, embedding_function=_embed)

# ----- Adders -----
def add_event_note(event_id: str, campaign_id: str, text: str, tags: Optional[List[str]] = None,
                   timestamp: Optional[str] = None) -> str:
    col = _col("event_notes")
    doc_id = f"en_{uuid4().hex[:12]}"
    col.upsert(
        ids=[doc_id],
        documents=[text],
        metadatas=[{
            "event_id": event_id,
            "campaign_id": campaign_id,
            "tags": tags or [],
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat()
        }]
    )
    return doc_id

def add_conversation_turn(event_id: str, campaign_id: str, speaker: str, text: str,
                          character_id: Optional[str] = None,
                          timestamp: Optional[str] = None) -> str:
    col = _col("conversations")
    doc_id = f"ct_{uuid4().hex[:12]}"
    col.upsert(
        ids=[doc_id],
        documents=[text],
        metadatas=[{
            "event_id": event_id, "campaign_id": campaign_id,
            "speaker": speaker, "character_id": character_id,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat()
        }]
    )
    return doc_id

def add_npc_memory(character_id: str, campaign_id: str, text: str, source_event_id: Optional[str] = None) -> str:
    col = _col("npc_memories")
    doc_id = f"nm_{uuid4().hex[:12]}"
    col.upsert(
        ids=[doc_id],
        documents=[text],
        metadatas=[{
            "character_id": character_id,
            "campaign_id": campaign_id,
            "source_event_id": source_event_id
        }]
    )
    return doc_id

# ----- Queries -----
def search_event_notes(campaign_id: str, query: str, n: int = 8, tags: Optional[List[str]] = None):
    col = _col("event_notes")
    where: Dict = {"campaign_id": campaign_id}
    if tags:
        where["tags"] = {"$contains": tags}
    res = col.query(query_texts=[query], n_results=n, where=where)
    return list(zip(res.get("documents", [[]])[0], res.get("metadatas", [[]])[0], res.get("ids", [[]])[0]))

def search_conversation(campaign_id: str, query: str, n: int = 10, character_id: Optional[str] = None):
    col = _col("conversations")
    where: Dict = {"campaign_id": campaign_id}
    if character_id:
        where["character_id"] = character_id
    res = col.query(query_texts=[query], n_results=n, where=where)
    return list(zip(res.get("documents", [[]])[0], res.get("metadatas", [[]])[0], res.get("ids", [[]])[0]))

def search_npc_memories(character_id: str, query: str, n: int = 6):
    col = _col("npc_memories")
    res = col.query(query_texts=[query], n_results=n, where={"character_id": character_id})
    return list(zip(res.get("documents", [[]])[0], res.get("metadatas", [[]])[0], res.get("ids", [[]])[0]))