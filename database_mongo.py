from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
DB_NAME   = os.getenv("DB_NAME", "dungeon_scribe")

_client = None
_db = None

def get_db():
    """Return a connected db handle; creates indexes on first use."""
    global _client, _db
    if _db is not None:
        return _db
    _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    try:
        _client.admin.command("ping")
    except ServerSelectionTimeoutError as e:
        raise SystemExit(f"Cannot connect to Mongo at {MONGO_URI}: {e}")
    _db = _client[DB_NAME]
    _init_indexes(_db)
    return _db

def _init_indexes(db):
    db.characters.create_index("name")
    db.characters.create_index("class")
    db.items.create_index("name")
    db.items.create_index("kind")
