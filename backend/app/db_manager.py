"""Persistence and retrieval helpers for live D&D transcription data."""
from __future__ import annotations
import uuid
""" This is a test of GitHub Sync -- Delete comment later """

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
        -- EXISTING TABLES (keep all existing ones)
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

        -- NEW TABLES FOR APP DATA
        CREATE TABLE IF NOT EXISTS characters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            hp INTEGER DEFAULT 1,
            max_hp INTEGER DEFAULT 1,
            ac INTEGER DEFAULT 10,
            speed INTEGER DEFAULT 30,
            hit_die INTEGER DEFAULT 8,
            hit_dice INTEGER DEFAULT 1,
            str_score INTEGER DEFAULT 10,
            dex_score INTEGER DEFAULT 10,
            con_score INTEGER DEFAULT 10,
            int_score INTEGER DEFAULT 10,
            wis_score INTEGER DEFAULT 10,
            cha_score INTEGER DEFAULT 10,
            conditions TEXT DEFAULT '[]',
            spells TEXT DEFAULT '[]',
            concentrating_on TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            weight REAL DEFAULT 0,
            quantity INTEGER DEFAULT 1,
            equipped INTEGER DEFAULT 0,
            character_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS quests (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            category TEXT,
            assigned_character TEXT,
            session_date TEXT,
            campaign_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(assigned_character) REFERENCES characters(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS quest_objectives (
            id TEXT PRIMARY KEY,
            quest_id TEXT NOT NULL,
            text TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(quest_id) REFERENCES quests(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS quest_notes (
            id TEXT PRIMARY KEY,
            quest_id TEXT NOT NULL,
            text TEXT NOT NULL,
            session_date TEXT,
            campaign_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(quest_id) REFERENCES quests(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'note',
            session_date TEXT,
            campaign_date TEXT,
            related_quest_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(related_quest_id) REFERENCES quests(id) ON DELETE SET NULL
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
        if chunk_id is None:
            raise ValueError("Failed to insert transcript chunk")

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
                if entity_id is not None:  # Add null check
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
        return entity_id  # Explicit return
    else:
        cur = conn.execute(
            "INSERT INTO entities (name, kind, description, first_chunk_id, last_chunk_id) VALUES (?, ?, ?, ?, ?)",
            (name, kind or "unknown", description, chunk_id, chunk_id),
        )
        return cur.lastrowid  # Explicit return


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

# \\\--- App Data management functions ---///

# CHARACTER MANAGEMENT
def save_character(character_data: Dict[str, Any]) -> str:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        
        # Convert lists to JSON strings
        import json
        conditions_json = json.dumps(character_data.get('conditions', []))
        spells_json = json.dumps(character_data.get('spells', []))
        
        cursor.execute('''
            INSERT OR REPLACE INTO characters 
            (id, name, class, level, hp, max_hp, ac, speed, hit_die, hit_dice,
             str_score, dex_score, con_score, int_score, wis_score, cha_score,
             conditions, spells, concentrating_on, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (
            character_data['id'],
            character_data['name'],
            character_data.get('class', 'Adventurer'),
            character_data.get('level', 1),
            character_data.get('hp', 1),
            character_data.get('max_hp', 1),
            character_data.get('ac', 10),
            character_data.get('speed', 30),
            character_data.get('hit_die', 8),
            character_data.get('hit_dice', 1),
            character_data.get('str_score', 10),
            character_data.get('dex_score', 10),
            character_data.get('con_score', 10),
            character_data.get('int_score', 10),
            character_data.get('wis_score', 10),
            character_data.get('cha_score', 10),
            conditions_json,
            spells_json,
            character_data.get('concentrating_on')
        ))
        
        conn.commit()
        return character_data['id']

def get_all_characters() -> List[Dict[str, Any]]:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM characters ORDER BY created_at DESC')
        rows = cursor.fetchall()
        
        characters = []
        for row in rows:
            character = dict(row)
            # Parse JSON fields
            import json
            character['conditions'] = json.loads(character.get('conditions', '[]'))
            character['spells'] = json.loads(character.get('spells', '[]'))
            characters.append(character)
        
        return characters

def delete_character(character_id: str) -> bool:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM characters WHERE id = ?', (character_id,))
        conn.commit()
        return cursor.rowcount > 0

# INVENTORY MANAGEMENT
def save_inventory_item(item_data: Dict[str, Any]) -> str:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO inventory 
            (id, name, type, description, weight, quantity, equipped, character_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            item_data['id'],
            item_data['name'],
            item_data.get('type', 'misc'),
            item_data.get('description', ''),
            item_data.get('weight', 0),
            item_data.get('quantity', 1),
            1 if item_data.get('equipped', False) else 0,
            item_data.get('character_id')
        ))
        
        conn.commit()
        return item_data['id']

def get_all_inventory(character_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        if character_id:
            cursor.execute('SELECT * FROM inventory WHERE character_id = ? ORDER BY created_at DESC', (character_id,))
        else:
            cursor.execute('SELECT * FROM inventory ORDER BY created_at DESC')
        
        return [dict(row) for row in cursor.fetchall()]

def delete_inventory_item(item_id: str) -> bool:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
        conn.commit()
        return cursor.rowcount > 0

# QUEST MANAGEMENT
def save_quest(quest_data: Dict[str, Any]) -> str:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO quests 
            (id, title, description, status, category, assigned_character, session_date, campaign_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (
            quest_data['id'],
            quest_data['title'],
            quest_data.get('description', ''),
            quest_data.get('status', 'active'),
            quest_data.get('category', 'Main Quest'),
            quest_data.get('assigned_character'),
            quest_data.get('session_date'),
            quest_data.get('campaign_date')
        ))
        
        # Save objectives
        if 'objectives' in quest_data:
            cursor.execute('DELETE FROM quest_objectives WHERE quest_id = ?', (quest_data['id'],))
            for objective in quest_data['objectives']:
                cursor.execute('''
                    INSERT INTO quest_objectives (id, quest_id, text, status)
                    VALUES (?, ?, ?, ?)
                ''', (
                    objective.get('id', f"obj_{uuid.uuid4().hex[:8]}"),
                    quest_data['id'],
                    objective['text'],
                    objective.get('status', 'active')
                ))
        
        # Save notes
        if 'notes' in quest_data:
            cursor.execute('DELETE FROM quest_notes WHERE quest_id = ?', (quest_data['id'],))
            for note in quest_data['notes']:
                cursor.execute('''
                    INSERT INTO quest_notes (id, quest_id, text, session_date, campaign_date)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    note.get('id', f"note_{uuid.uuid4().hex[:8]}"),
                    quest_data['id'],
                    note['text'],
                    note.get('session_date'),
                    note.get('campaign_date')
                ))
        
        conn.commit()
        return quest_data['id']

def get_all_quests() -> List[Dict[str, Any]]:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT q.*, 
                   GROUP_CONCAT(DISTINCT o.id) as objective_ids,
                   GROUP_CONCAT(DISTINCT o.text) as objective_texts,
                   GROUP_CONCAT(DISTINCT o.status) as objective_statuses
            FROM quests q
            LEFT JOIN quest_objectives o ON q.id = o.quest_id
            GROUP BY q.id
            ORDER BY q.created_at DESC
        ''')
        
        quests = []
        for row in cursor.fetchall():
            quest = dict(row)
            # Parse objectives
            if quest.get('objective_ids'):
                objective_ids = quest['objective_ids'].split(',')
                objective_texts = quest['objective_texts'].split(',')
                objective_statuses = quest['objective_statuses'].split(',')
                
                quest['objectives'] = [
                    {'id': oid, 'text': otext, 'status': ostatus}
                    for oid, otext, ostatus in zip(objective_ids, objective_texts, objective_statuses)
                ]
            else:
                quest['objectives'] = []
            
            # Get notes
            cursor2 = conn.cursor()
            cursor2.execute('SELECT * FROM quest_notes WHERE quest_id = ? ORDER BY created_at DESC', (quest['id'],))
            quest['notes'] = [dict(note) for note in cursor2.fetchall()]
            
            quests.append(quest)
        
        return quests

def delete_quest(quest_id: str) -> bool:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM quests WHERE id = ?', (quest_id,))
        conn.commit()
        return cursor.rowcount > 0

# JOURNAL MANAGEMENT
def save_journal_entry(entry_data: Dict[str, Any]) -> str:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO journal_entries 
            (id, title, content, type, session_date, campaign_date, related_quest_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            entry_data['id'],
            entry_data['title'],
            entry_data['content'],
            entry_data.get('type', 'note'),
            entry_data.get('session_date'),
            entry_data.get('campaign_date'),
            entry_data.get('related_quest_id')
        ))
        
        conn.commit()
        return entry_data['id']

def get_all_journal_entries(quest_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = _get_conn()
    with _lock:
        cursor = conn.cursor()
        if quest_id:
            cursor.execute('''
                SELECT * FROM journal_entries 
                WHERE related_quest_id = ? 
                ORDER BY created_at DESC
            ''', (quest_id,))
        else:
            cursor.execute('SELECT * FROM journal_entries ORDER BY created_at DESC')
        
        return [dict(row) for row in cursor.fetchall()]