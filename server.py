import asyncio
import json
from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import hashlib
import chromadb
from chroma_operations import get_collection, add_json_to_chroma
import requests
from pydantic import BaseModel

app = FastAPI()
client = chromadb.PersistentClient(path="./chroma_storage")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JSON_FILE = "dnd_log20.csv"

def parse_ai_json(raw_text):
    """Parse multiple AI JSON objects, return a list of event dicts with type keys."""
    events = []
    buffer = ""
    open_braces = 0

    for char in raw_text:
        if char == "{":
            open_braces += 1
        if open_braces > 0:
            buffer += char
        if char == "}":
            open_braces -= 1
            if open_braces == 0:
                try:
                    obj = json.loads(buffer)
                    for key in ["world_state_updates", "character_events", "quest_updates"]:
                        if key in obj:
                            for item in obj[key]:
                                events.append({key: item})
                except json.JSONDecodeError:
                    pass
                buffer = ""
    return events

def get_obj_hash(obj):
    """Return a hash string for an object to avoid sending duplicates."""
    obj_str = json.dumps(obj, sort_keys=True)
    return hashlib.sha256(obj_str.encode("utf-8")).hexdigest()

def format_event(event: dict) -> list:
    """Format event into structured {heading, content} dict(s) for UI."""
    formatted = []
    if "quest_updates" in event:
        q = event["quest_updates"]
        formatted.append({
            "heading": "Quest Update",
            "quest_name": q["quest"],
            "content": q["update"]
        })

    elif "world_state_updates" in event:
        w = event["world_state_updates"]
        formatted.append({
            "heading": "World State Update",
            "location": w["location"],
            "content": w["update"]
        })

    elif "character_events" in event:
        c = event["character_events"]
        # Separate Action and Outcome
        if "action" in c:
            formatted.append({
                "heading": f"Character Action: {c['character']}",
                "content": c["action"]
            })
        if "outcome" in c:
            formatted.append({
                "heading": f"Character Outcome: {c['character']}",
                "content": c["outcome"]
            })

    return formatted


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")
    
    sent_hashes = set()  # keep track of all sent event hashes globally
    try:
        while True:
            if os.path.exists(JSON_FILE):
                with open(JSON_FILE, "r", encoding="utf-8") as f:
                    raw_text = f.read().strip()
                    all_events = parse_ai_json(raw_text)

                    structured_json = {
                        "world_state_updates": [],
                        "player_actions": [],
                        "quest_updates": []
                    }

                    for e in all_events:
                        if e["type"] == "world_state_updates":
                            structured_json["world_state_updates"].append(e)
                        elif e["type"] == "player_actions":
                            structured_json["player_actions"].append(e)
                        elif e["type"] == "quest_updates":
                            structured_json["quest_updates"].append(e)

                    add_json_to_chroma(structured_json)

                    for event in all_events:
                        h = get_obj_hash(event)
                        if h not in sent_hashes:
                            formatted_list = format_event(event)
                            for formatted in formatted_list:
                                await websocket.send_text(json.dumps(formatted))
                                print("Sent:", formatted)
                                await asyncio.sleep(2)  # 2s delay between events
                            sent_hashes.add(h)
            await asyncio.sleep(1)  # wait a bit before checking the file again
    except Exception as e:
        print("WebSocket error:", e)
    finally:
        print("Client disconnected")

SD_API_URL = "http://127.0.0.1:7860/sdapi/v1/txt2img"

class GenerateRequest(BaseModel):
    prompt: str
    steps: int = 20
    width: int = 256
    height: int = 256
    cfg_scale: float = 7.0

@app.post("/generate-image/")
async def generate_image(req: GenerateRequest):
    payload = req.dict()
    try:
        response = requests.post(SD_API_URL, json=payload)
        data = response.json()
        return {"image": data["images"][0]}  # Base64 image string
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/search/")
def search_events(query: str, event_type: str = "all", n_results: int = 5):
    collections = {
        "world": client.get_collection("world_state_updates"),
        "quest": client.get_collection("quest_updates"),
        "player": client.get_collection("player_actions"),
    }

    results = {}

    if event_type == "all":
        for name, col in collections.items():
            res = col.query(query_texts=[query], n_results=n_results)
            results[name] = res["documents"]
    else:
        col = collections.get(event_type)
        if col:
            res = col.query(query_texts=[query], n_results=n_results)
            results[event_type] = res["documents"]

    return results

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
