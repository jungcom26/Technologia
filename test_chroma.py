from chroma_operations import add_json_to_chroma, query_chroma_db, display_results

# Sample D&D data (same as before)
dnd_data = {
    "story_progression": [
        {"event": "Introduction to D&D", "details": "The narrator describes Dungeons & Dragons as a game of imagination and storytelling, where anything can happen."},
        {"event": "Formation of a D&D Group", "details": "The narrator connects with Charlie (Slimesicle) and Alfred Ron Boo to form a D&D group. Charlie is the Dungeon Master."},
        {"event": "Entering the Game World", "details": "The group is transported to a lush forest and enters 'Old Oak Inn.'"},
        {"event": "Meeting Quirky Characters", "details": "They encounter various unusual individuals, including a goblin and a depressed wizard named Mark Thompson."},
        {"event": "Time Loop and Sheep", "details": "A series of events and mishaps occur, involving the resurrection of a sheep named Lop and a time loop involving Mark Thompson."},
        {"event": "Confrontation with Mark Thompson", "details": "Mark, fueled by bitterness, curses the group, leading to a final confrontation."},
        {"event": "Resolution and Reunion", "details": "Zoot disguises themself as Mark's ex-wife, leading to a moment of vulnerability. Mark is eventually turned back into a human, and reunites with his son, Paul Jr."},
        {"event": "Conclusion of the Game", "details": "The game ends with the group celebrating their victory and expressing gratitude to the participants."}
    ],
    "player_actions": [
        {"player_placeholder": "Paul", "character_name": "Paul", "action": "Throws the axe and hits Mark but doesn't kill him.", "outcome": "Paul expresses his frustration and desire to move on."},
        {"player_placeholder": "Zoot", "character_name": "Zoot", "action": "Disguises themselves as Mark's ex-wife, leading to an emotional moment.", "outcome": "Mark's bitterness momentarily subsides, creating an opportunity for resolution."},
        {"player_placeholder": "Thalamu", "character_name": "Thalamu", "action": "Attempts to attack Mark but accidentally sends himself flying with the axe.", "outcome": "A clumsy team attack highlights the group's lack of coordination."}
    ],
    "world_state_updates": [
        {"aspect": "Old Oak Inn", "change": "Maintains its quirky and inviting atmosphere."},
        {"aspect": "Mark Thompson", "change": "Regains his humanity after a period of bitterness and magical curses."},
        {"aspect": "Paul Jr.", "change": "Reunites with his father after a long separation."}
    ],
    "character_tracking": [
        {"character_name": "Paul", "condition": "Recovering, slightly frustrated."},
        {"character_name": "Zoot", "condition": "Emotional, possibly exhausted from the disguise."},
        {"character_name": "Mark Thompson", "condition": "Regained humanity, experiencing emotional vulnerability."},
        {"character_name": "Paul Jr", "condition": "Reunited with father, possibly overwhelmed."}
    ],
    "unresolved_threads": [
        {"mystery_or_quest": "Charlie Rambu and Jacob will upload full D&D session", "status": "Uncertain, to be done later."},
        {"mystery_or_quest": "Gobble Gobble and the Peeler's fate", "status": "Confirmed Death"}
    ]
}

def test_add_function():
    """Test adding data to ChromaDB"""
    print("Testing add function...")
    add_json_to_chroma(dnd_data)
    print("Add function test completed!\n")

def test_query_function():
    """Test querying ChromaDB"""
    print("Testing query function...")
    
    # Test queries
    test_queries = ["paul", "mark thompson", "time loop", "zoot"]
    
    for query in test_queries:
        print(f"\nTesting query: '{query}'")
        results = query_chroma_db(query)
        display_results(results, query)
    
    print("Query function test completed!")

if __name__ == "__main__":
    # Run tests
    test_add_function()
    test_query_function()