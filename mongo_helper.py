# mongo_helpers.py
from __future__ import annotations
from typing import List, Dict, Optional
from uuid import uuid4
from datetime import datetime, timezone

# Uses your existing connector
from database_mongo import get_db

db = get_db()

def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"

# ---------- Campaign ----------
def create_campaign(name: str, started_at: Optional[datetime] = None, gm: str | None = None, notes: str | None = None) -> str:
    cid = _id("cmp")
    db.campaigns.insert_one({
        "_id": cid,
        "name": name,
        "started_at": (started_at or datetime.now(timezone.utc)).isoformat(),
        "gm": gm,
        "notes": notes
    })
    return cid

# ---------- Character ----------
def create_character(campaign_id: str, name: str, race_id: str | None = None, class_id: str | None = None,
                     level: int = 1, stats: Dict | None = None, hp: int | None = None, max_hp: int | None = None,
                     picture_url: str | None = None) -> str:
    ch_id = _id("ch")
    db.characters.insert_one({
        "_id": ch_id,
        "campaign_id": campaign_id,
        "name": name,
        "race_id": race_id,
        "class_id": class_id,
        "level": level,
        "stats": stats or {"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10},
        "health": {"hp": hp or 10, "max_hp": max_hp or 10, "temp_hp": 0},
        "picture_url": picture_url
    })
    return ch_id

# ---------- Items & Inventory ----------
def ensure_item(name: str, kind: str | None = None, rarity: str | None = None, props: Dict | None = None) -> str:
    ex = db.items.find_one({"name": name}, {"_id": 1})
    if ex:
        return ex["_id"]
    it_id = _id("it")
    db.items.insert_one({"_id": it_id, "name": name, "kind": kind, "rarity": rarity, "props": props or {}})
    return it_id

def set_inventory(character_id: str, item_id: str, delta_qty: int) -> None:
    # Upsert inventory row, then increment/decrement qty
    row = db.inventories.find_one({"character_id": character_id, "item_id": item_id})
    if not row:
        db.inventories.insert_one({"_id": _id("inv"), "character_id": character_id, "item_id": item_id, "qty": 0})
    db.inventories.update_one({"character_id": character_id, "item_id": item_id}, {"$inc": {"qty": delta_qty}})
    # Optional cleanup if qty <= 0
    db.inventories.delete_one({"character_id": character_id, "item_id": item_id, "qty": {"$lte": 0}})

# ---------- Events & Participants ----------
def create_event(campaign_id: str, kind: str, summary: str, timestamp: Optional[datetime] = None,
                 meta: Dict | None = None, participants: List[Dict] | None = None) -> str:
    """
    participants: list of {"character_id": "...", "role": "pc|npc|monster", "effects": {...}}
    """
    ev_id = _id("ev")
    db.events.insert_one({
        "_id": ev_id,
        "campaign_id": campaign_id,
        "timestamp": (timestamp or datetime.now(timezone.utc)).isoformat(),
        "kind": kind,
        "summary": summary,
        "meta": meta or {}
    })
    if participants:
        db.event_participants.insert_many([{
            "_id": _id("ep"),
            "event_id": ev_id,
            "character_id": p["character_id"],
            "role": p.get("role", "pc"),
            "effects": p.get("effects", {})
        } for p in participants])
    return ev_id

# ---------- World State & Quests ----------
def set_world_state(campaign_id: str, key: str, value, event_id: str) -> None:
    db.world_state.update_one(
        {"campaign_id": campaign_id, "key": key},
        {"$set": {"value": value, "last_event_id": event_id}},
        upsert=True
    )

def ensure_quest(campaign_id: str, title: str) -> str:
    ex = db.quests.find_one({"campaign_id": campaign_id, "title": title}, {"_id": 1})
    if ex:
        return ex["_id"]
    qid = _id("qst")
    db.quests.insert_one({"_id": qid, "campaign_id": campaign_id, "title": title, "status": "open"})
    return qid

def set_quest_status(campaign_id: str, quest_id: str, status: str, event_id: str) -> None:
    db.quests.update_one({"_id": quest_id, "campaign_id": campaign_id},
                         {"$set": {"status": status, "last_event_id": event_id}})