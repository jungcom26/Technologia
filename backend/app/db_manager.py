"""Persistence and retrieval helpers for live D&D transcription data."""

from __future__ import annotations

import os
import re
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence


DB_PATH = Path(os.environ.get("DUNGEON_ARCHIVE_DB", "dungeon_archive.db"))


_conn: Optional[sqlite3.Connection] = None
_lock = threading.RLock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transcript_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            transcript TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS world_state_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_id INTEGER NOT NULL,
            location TEXT NOT NULL,
            update_text TEXT NOT NULL,
            FOREIGN KEY(chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS character_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_id INTEGER NOT NULL,
            character TEXT NOT NULL,
            action TEXT NOT NULL,
            outcome TEXT NOT NULL,
            FOREIGN KEY(chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS quest_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_id INTEGER NOT NULL,
            quest TEXT NOT NULL,
            update_text TEXT NOT NULL,
            FOREIGN KEY(chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            kind TEXT NOT NULL DEFAULT 'unknown',
            description TEXT NOT NULL DEFAULT '',
            first_chunk_id INTEGER,
            last_chunk_id INTEGER,
            FOREIGN KEY(first_chunk_id) REFERENCES transcript_chunks(id) ON DELETE SET NULL,
            FOREIGN KEY(last_chunk_id) REFERENCES transcript_chunks(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS entity_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            UNIQUE(entity_id, alias COLLATE NOCASE),
            FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entity_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            chunk_id INTEGER NOT NULL,
            mention_text TEXT,
            UNIQUE(entity_id, chunk_id),
            FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS transcript_chunks_fts USING fts5(
            transcript,
            metadata
        );
        """
    )
    conn.commit()


def _get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _connect()
        _ensure_schema(_conn)
    return _conn


def ensure_session(session_id: str, started_at: str) -> None:
    conn = _get_conn()
    with _lock:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)",
            (session_id, started_at),
        )
        conn.commit()


def store_chunk(
    session_id: str,
    transcript: str,
    structured: Dict[str, Any],
) -> int:
    conn = _get_conn()
    world_updates: Sequence[Dict[str, Any]] = structured.get("world_state_updates", []) or []
    char_events: Sequence[Dict[str, Any]] = structured.get("character_events", []) or []
    quest_updates: Sequence[Dict[str, Any]] = structured.get("quest_updates", []) or []
    entities: Sequence[Dict[str, Any]] = structured.get("entities", []) or []

    with _lock:
        next_idx = conn.execute(
            "SELECT COALESCE(MAX(chunk_index) + 1, 0) FROM transcript_chunks WHERE session_id = ?",
            (session_id,),
        ).fetchone()[0]

        cur = conn.execute(
            "INSERT INTO transcript_chunks (session_id, chunk_index, transcript) VALUES (?, ?, ?)",
            (session_id, next_idx, transcript),
        )
        chunk_id = cur.lastrowid

        if world_updates:
            conn.executemany(
                "INSERT INTO world_state_updates (chunk_id, location, update_text) VALUES (?, ?, ?)",
                [
                    (chunk_id, (item.get("location") or "").strip(), (item.get("update") or "").strip())
                    for item in world_updates
                    if item
                ],
            )

        if char_events:
            conn.executemany(
                "INSERT INTO character_events (chunk_id, character, action, outcome) VALUES (?, ?, ?, ?)",
                [
                    (
                        chunk_id,
                        (item.get("character") or "Unknown").strip(),
                        (item.get("action") or "").strip(),
                        (item.get("outcome") or "").strip(),
                    )
                    for item in char_events
                    if item
                ],
            )

        if quest_updates:
            conn.executemany(
                "INSERT INTO quest_updates (chunk_id, quest, update_text) VALUES (?, ?, ?)",
                [
                    (
                        chunk_id,
                        (item.get("quest") or "Quest").strip(),
                        (item.get("update") or "").strip(),
                    )
                    for item in quest_updates
                    if item
                ],
            )

        if entities:
            for item in entities:
                entity_id = _upsert_entity(conn, chunk_id, item)
                if entity_id:
                    _link_entity_aliases(conn, entity_id, item.get("aliases") or [])
                    conn.execute(
                        "INSERT OR IGNORE INTO entity_mentions (entity_id, chunk_id, mention_text) VALUES (?, ?, ?)",
                        (entity_id, chunk_id, (item.get("description") or "").strip()),
                    )

        metadata_blob = _build_metadata_blob(structured)
        conn.execute(
            "INSERT INTO transcript_chunks_fts (rowid, transcript, metadata) VALUES (?, ?, ?)",
            (chunk_id, transcript, metadata_blob),
        )

        conn.commit()

    return int(chunk_id)


def _build_metadata_blob(structured: Dict[str, Any]) -> str:
    parts: List[str] = []

    for item in structured.get("character_events", []) or []:
        if not item:
            continue
        p = " ".join(
            filter(
                None,
                [
                    f"Character {item.get('character', '').strip()}",
                    item.get("action", "").strip(),
                    item.get("outcome", "").strip(),
                ],
            )
        )
        if p:
            parts.append(p)

    for item in structured.get("world_state_updates", []) or []:
        if not item:
            continue
        loc = item.get("location", "").strip()
        upd = item.get("update", "").strip()
        if loc or upd:
            parts.append(f"World {loc}: {upd}".strip())

    for item in structured.get("quest_updates", []) or []:
        if not item:
            continue
        quest = item.get("quest", "").strip()
        upd = item.get("update", "").strip()
        if quest or upd:
            parts.append(f"Quest {quest}: {upd}".strip())

    for item in structured.get("entities", []) or []:
        if not item:
            continue
        name = (item.get("name") or "").strip()
        kind = (item.get("kind") or "").strip()
        desc = (item.get("description") or "").strip()
        alias = ", ".join((item.get("aliases") or []))
        snippet = " ".join(filter(None, [f"Entity {name}", kind, desc, alias]))
        if snippet:
            parts.append(snippet)

    return "\n".join(parts)


def _normalize_kind(kind: Optional[str]) -> str:
    if not kind:
        return "unknown"
    clean = kind.strip().lower()
    mapping = {
        "pc": "player",
        "player": "player",
        "npc": "npc",
        "creature": "creature",
        "monster": "creature",
        "item": "item",
    }
    return mapping.get(clean, clean or "unknown")


def _upsert_entity(conn: sqlite3.Connection, chunk_id: int, record: Dict[str, Any]) -> Optional[int]:
    name = (record.get("name") or "").strip()
    if not name:
        return None
    kind = _normalize_kind(record.get("kind"))
    description = (record.get("description") or "").strip()

    current = conn.execute(
        "SELECT id, kind, description, first_chunk_id FROM entities WHERE name = ?",
        (name,),
    ).fetchone()

    if current:
        entity_id = int(current["id"])
        new_kind = kind if current["kind"] in {"", "unknown"} and kind != "unknown" else current["kind"]
        if not new_kind:
            new_kind = "unknown"
        new_description = description if description and len(description) > len(current["description"] or "") else current["description"]
        conn.execute(
            "UPDATE entities SET kind = ?, description = ?, last_chunk_id = ? WHERE id = ?",
            (new_kind, new_description or "", chunk_id, entity_id),
        )
    else:
        cur = conn.execute(
            "INSERT INTO entities (name, kind, description, first_chunk_id, last_chunk_id) VALUES (?, ?, ?, ?, ?)",
            (name, kind or "unknown", description, chunk_id, chunk_id),
        )
        entity_id = cur.lastrowid

    return int(entity_id)


def _link_entity_aliases(
    conn: sqlite3.Connection,
    entity_id: int,
    aliases: Sequence[str],
) -> None:
    for alias in aliases:
        alias_clean = (alias or "").strip()
        if not alias_clean:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO entity_aliases (entity_id, alias) VALUES (?, ?)",
            (entity_id, alias_clean),
        )


_STOPWORDS = {
    "what",
    "where",
    "who",
    "did",
    "does",
    "have",
    "has",
    "get",
    "got",
    "the",
    "a",
    "an",
    "in",
    "of",
    "and",
    "to",
    "for",
    "is",
    "are",
    "was",
    "were",
    "with",
}


def _question_to_fts(query: str) -> str:
    tokens = re.findall(r"[\w']+", query.lower())
    cleaned = [tok for tok in tokens if tok not in _STOPWORDS and len(tok) > 1]
    if not cleaned:
        cleaned = tokens
    # Deduplicate while preserving order
    seen = set()
    uniq: List[str] = []
    for tok in cleaned:
        if tok not in seen:
            uniq.append(tok)
            seen.add(tok)
    if not uniq:
        return ""
    return " AND ".join(uniq[:6])


def search_chunks(
    question: str,
    session_id: Optional[str] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    conn = _get_conn()
    fts_query = _question_to_fts(question)
    rows: List[sqlite3.Row] = []

    with _lock:
        try:
            if fts_query:
                sql = (
                    "SELECT t.id, t.session_id, t.chunk_index, t.transcript, t.created_at, "
                    "snippet(transcript_chunks_fts, 0, '[', ']', '…', 48) AS transcript_snippet, "
                    "snippet(transcript_chunks_fts, 1, '[', ']', '…', 48) AS metadata_snippet "
                    "FROM transcript_chunks_fts JOIN transcript_chunks t ON t.id = transcript_chunks_fts.rowid "
                    "WHERE transcript_chunks_fts MATCH ? "
                )
                params: List[Any] = [fts_query]
                if session_id:
                    sql += "AND t.session_id = ? "
                    params.append(session_id)
                sql += "ORDER BY t.id DESC LIMIT ?"
                params.append(limit)
                cur = conn.execute(sql, params)
            else:
                sql = (
                    "SELECT id, session_id, chunk_index, transcript, created_at, transcript AS transcript_snippet, '' AS metadata_snippet "
                    "FROM transcript_chunks WHERE 1 = 1 "
                )
                params = []
                if session_id:
                    sql += "AND session_id = ? "
                    params.append(session_id)
                sql += "ORDER BY id DESC LIMIT ?"
                params.append(limit)
                cur = conn.execute(sql, params)
            rows = cur.fetchall()
        except sqlite3.OperationalError:
            # Fallback to LIKE search if MATCH fails (e.g., query contains reserved tokens)
            pattern = f"%{question.strip()}%"
            sql = (
                "SELECT id, session_id, chunk_index, transcript, created_at, transcript AS transcript_snippet, '' AS metadata_snippet "
                "FROM transcript_chunks WHERE transcript LIKE ?"
            )
            params = [pattern]
            if session_id:
                sql += " AND session_id = ?"
                params.append(session_id)
            sql += " ORDER BY id DESC LIMIT ?"
            params.append(limit)
            cur = conn.execute(sql, params)
            rows = cur.fetchall()

    if not rows:
        return []

    chunk_ids = [int(r["id"]) for r in rows]
    world_updates = _rows_by_chunk(
        conn,
        "SELECT chunk_id, location, update_text FROM world_state_updates WHERE chunk_id IN ({})".format(
            _sql_placeholders(chunk_ids)
        ),
        chunk_ids,
    )
    char_events = _rows_by_chunk(
        conn,
        "SELECT chunk_id, character, action, outcome FROM character_events WHERE chunk_id IN ({})".format(
            _sql_placeholders(chunk_ids)
        ),
        chunk_ids,
    )
    quest_updates = _rows_by_chunk(
        conn,
        "SELECT chunk_id, quest, update_text FROM quest_updates WHERE chunk_id IN ({})".format(
            _sql_placeholders(chunk_ids)
        ),
        chunk_ids,
    )
    entities = _entities_by_chunk(conn, chunk_ids)

    results: List[Dict[str, Any]] = []
    for row in rows:
        cid = int(row["id"])
        results.append(
            {
                "chunk_id": cid,
                "session_id": row["session_id"],
                "chunk_index": row["chunk_index"],
                "transcript": row["transcript"],
                "created_at": row["created_at"],
                "transcript_snippet": row["transcript_snippet"],
                "metadata_snippet": row["metadata_snippet"],
                "world_state_updates": world_updates.get(cid, []),
                "character_events": char_events.get(cid, []),
                "quest_updates": quest_updates.get(cid, []),
                "entities": entities.get(cid, []),
            }
        )

    return results


def _sql_placeholders(values: Sequence[Any]) -> str:
    return ",".join(["?"] * len(values)) or "?"


def _rows_by_chunk(conn: sqlite3.Connection, sql: str, chunk_ids: Sequence[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not chunk_ids:
        return {}
    cur = conn.execute(sql, list(chunk_ids))
    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for row in cur.fetchall():
        cid = int(row["chunk_id"])
        data: Dict[str, Any] = {}
        for key in row.keys():
            if key == "chunk_id":
                continue
            if key == "update_text":
                data["update"] = row[key]
            else:
                data[key] = row[key]
        grouped.setdefault(cid, []).append(data)
    return grouped


def fetch_recent_chunks(session_id: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    conn = _get_conn()
    with _lock:
        sql = (
            "SELECT id, session_id, chunk_index, transcript, created_at FROM transcript_chunks "
            "WHERE (? IS NULL OR session_id = ?) ORDER BY id DESC LIMIT ?"
        )
        cur = conn.execute(sql, (session_id, session_id, limit))
        rows = cur.fetchall()
    return [dict(row) for row in rows]


def _entities_by_chunk(conn: sqlite3.Connection, chunk_ids: Sequence[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not chunk_ids:
        return {}
    placeholder = _sql_placeholders(chunk_ids)
    rows = conn.execute(
        f"SELECT em.chunk_id, e.id AS entity_id, e.name, e.kind, e.description "
        f"FROM entity_mentions em JOIN entities e ON e.id = em.entity_id "
        f"WHERE em.chunk_id IN ({placeholder})",
        list(chunk_ids),
    ).fetchall()

    if not rows:
        return {}

    entity_ids = sorted({int(row["entity_id"]) for row in rows})
    aliases: Dict[int, List[str]] = {}
    alias_rows = conn.execute(
        "SELECT entity_id, alias FROM entity_aliases WHERE entity_id IN ({})".format(
            _sql_placeholders(entity_ids)
        ),
        entity_ids,
    ).fetchall()
    for alias_row in alias_rows:
        aliases.setdefault(int(alias_row["entity_id"]), []).append(alias_row["alias"])

    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for row in rows:
        cid = int(row["chunk_id"])
        eid = int(row["entity_id"])
        grouped.setdefault(cid, []).append(
            {
                "name": row["name"],
                "kind": row["kind"],
                "description": row["description"],
                "aliases": aliases.get(eid, []),
            }
        )
    return grouped
