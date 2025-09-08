# character_database.py  (PASTE THIS WHOLE FILE)

from uuid import uuid4
from pathlib import Path
from database_mongo import get_db

import chromadb
from chromadb.utils import embedding_functions

# ---- Chroma client/collection (keep single source here) ----
STORE = Path("chroma_storage"); STORE.mkdir(exist_ok=True)
client = chromadb.PersistentClient(path=str(STORE))
embedder = embedding_functions.DefaultEmbeddingFunction()
mem = client.get_or_create_collection("npc_memories", embedding_function=embedder)

# ---- Mongo helpers ----
def create_character(db, name, cls, level=1):
    cid = f"c_{uuid4().hex[:8]}"
    db.characters.insert_one({
        "_id": cid,
        "name": name,
        "class": cls,
        "level": level,
        "inventory": [],
        "attitudes": {}
    })
    return cid

# ---- Chroma helpers (local, do NOT import same names from elsewhere) ----
def add_memory(npc_id, text, session_id="S-001"):
    mid = f"m_{uuid4().hex[:12]}"
    mem.upsert(
        ids=[mid],
        documents=[text],
        metadatas=[{"kind": "npc_memory", "npc_id": npc_id, "session_id": session_id}],
    )
    return mid

def search_memories(q, n=5):
    res = mem.query(query_texts=[q], n_results=n)
    if not res.get("documents"):
        return []
    # return doc, meta, id  (so the caller can unpack 3 values)
    return list(zip(res["documents"][0], res["metadatas"][0], res["ids"][0]))

# ---- main ----
if __name__ == "__main__":
    db = get_db()

    existing = db.characters.find_one({}, {"_id": 1})
    if existing:
        cid = existing["_id"]
    else:
        cid = "c_demo"
        db.characters.insert_one({
            "_id": cid,
            "name": "Sereth",
            "class": "Rogue",
            "level": 3,
            "inventory": [],
            "attitudes": {}
        })

    mid = add_memory(cid, "Sereth distrusts city guards after the market incident.", session_id="S-001")
    print("memory id:", mid)

    hits = search_memories("guards Sereth")

    for hit in hits:
        if isinstance(hit, (list, tuple)):
            if len(hit) == 3:
                doc, meta, _id = hit
            elif len(hit) == 2:
                doc, meta = hit
                _id = None
            else:
                continue
        else:
            continue
        ch = db.characters.find_one(
            {"_id": meta.get("npc_id")},
            {"name": 1, "class": 1, "level": 1}
        )
        name  = ch.get("name", "unknown") if ch else "unknown"
        cls   = ch.get("class", "?")      if ch else "?"
        level = ch.get("level", "?")      if ch else "?"
        print(f"- {doc} -> {name} ({cls} {level})  meta={meta}  id={_id}")