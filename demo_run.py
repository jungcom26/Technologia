# demo_run.py
from mongo_helper import create_campaign, create_character, ensure_item, set_inventory, create_event, set_world_state, ensure_quest, set_quest_status
from chroma_helper import add_event_note, add_conversation_turn, add_npc_memory, search_event_notes, search_conversation, search_npc_memories

# 1) Campaign + character
cmp_id = create_campaign("Shadows of the Vale")
ch_id  = create_character(cmp_id, "Sereth", class_id="class_rogue", level=3)

# 2) Inventory
dagger = ensure_item("Dagger", kind="weapon", rarity="common", props={"damage":"1d4","finesse":True})
set_inventory(ch_id, dagger, +2)

# 3) Event + participants
ev_id = create_event(
    cmp_id, "conversation", "Market incident with city guards; Sereth threatened a guard.",
    participants=[{"character_id": ch_id, "role": "pc"}]
)

# 4) Canonical world/quest updates
set_world_state(cmp_id, "city.guard_mood", "tense", ev_id)
qst_id = ensure_quest(cmp_id, "Find the smuggler")
set_quest_status(cmp_id, qst_id, "open", ev_id)

# 5) Chroma notes (vector)
add_event_note(ev_id, cmp_id, "Tension rose at the market; guard captain promised stricter patrols.", tags=["world_state_update","conversation"])
add_conversation_turn(ev_id, cmp_id, "NPC:Guard", "Back off, rogue. This is your last warning.", character_id=None)
add_conversation_turn(ev_id, cmp_id, "PC:Sereth", "You don't scare me.", character_id=ch_id)
add_npc_memory(ch_id, cmp_id, "Sereth distrusts city guards after the market incident.", source_event_id=ev_id)

# 6) Queries
print("\n== search_event_notes('guards patrol') ==")
for doc, meta, _id in search_event_notes(cmp_id, "guards patrol"):
    print("-", doc, meta)

print("\n== search_conversation('warning') ==")
for doc, meta, _id in search_conversation(cmp_id, "warning"):
    print("-", meta["speaker"], ":", doc)

print("\n== search_npc_memories('guards') ==")
for doc, meta, _id in search_npc_memories(ch_id, "guards"):
    print("-", doc, meta)