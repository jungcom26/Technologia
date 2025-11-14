import chromadb

def initialize_chroma_db():
    """
    Initialize ChromaDB with the required collections
    """
    # Set up ChromaDB client with persistent storage
    client = chromadb.PersistentClient(path="./chroma_storage")
    
    # Create collections for each data type
    collections = [
        "story_progression",
        "player_actions", 
        "world_state_updates",
        "character_tracking",
        "unresolved_threads"
    ]
    
    for collection_name in collections:
        client.get_or_create_collection(collection_name)
    
    print("ChromaDB initialized successfully!")
    print("Collections created:", collections)
    return client

if __name__ == "__main__":
    initialize_chroma_db()