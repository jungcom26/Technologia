import chromadb
import json
import sys

def add_json_to_chroma(json_data, collection_mapping=None):
    """
    Add JSON data to ChromaDB collections
    
    Args:
        json_data: Dictionary with the data structure
        collection_mapping: Optional mapping of JSON keys to collection names
    """
    client = chromadb.PersistentClient(path="./chroma_storage")
    
    # Default collection mapping
    if collection_mapping is None:
        collection_mapping = {
            "story_progression": "story_progression",
            "player_actions": "player_actions",
            "world_state_updates": "world_state_updates",
            "character_tracking": "character_tracking",
            "unresolved_threads": "unresolved_threads"
        }
    
    # Add data to collections
    for json_key, collection_name in collection_mapping.items():
        if json_key in json_data:
            try:
                collection = client.get_collection(collection_name)
                items = json_data[json_key]
                
                documents = []
                metadatas = []
                ids = []
                
                for i, item in enumerate(items):
                    if json_key == "story_progression":
                        documents.append(f"{item['event']}: {item['details']}")
                        metadatas.append({"type": "story", "event": item["event"]})
                        ids.append(f"story-{i}")
                    
                    elif json_key == "player_actions":
                        documents.append(f"{item['character_name']} action: {item['action']} Outcome: {item['outcome']}")
                        metadatas.append({"type": "action", "player": item["player_placeholder"], "character": item["character_name"]})
                        ids.append(f"action-{i}")
                    
                    elif json_key == "world_state_updates":
                        documents.append(f"{item['aspect']}: {item['change']}")
                        metadatas.append({"type": "world", "aspect": item["aspect"]})
                        ids.append(f"world-{i}")
                    
                    elif json_key == "character_tracking":
                        documents.append(f"{item['character_name']} condition: {item['condition']}")
                        metadatas.append({"type": "character", "name": item["character_name"]})
                        ids.append(f"char-{i}")
                    
                    elif json_key == "unresolved_threads":
                        documents.append(f"{item['mystery_or_quest']} status: {item['status']}")
                        metadatas.append({"type": "thread", "topic": item["mystery_or_quest"]})
                        ids.append(f"thread-{i}")
                
                # Add to collection
                collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                
                print(f"Added {len(items)} items to {collection_name}")
                
            except Exception as e:
                print(f"Error adding to {collection_name}: {e}", file=sys.stderr)
    
    print("Data added to ChromaDB successfully!")

def query_chroma_db(query_text, n_results=5):
    """
    Query all collections in ChromaDB and return relevant results
    
    Args:
        query_text: Search query string
        n_results: Number of results to return per collection
    
    Returns:
        List of results sorted by relevance
    """
    client = chromadb.PersistentClient(path="./chroma_storage")
    
    collections = [
        "story_progression", "player_actions", "world_state_updates", 
        "character_tracking", "unresolved_threads"
    ]
    
    all_results = []
    
    for collection_name in collections:
        try:
            collection = client.get_collection(collection_name)
            results = collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            
            if results['documents'] and len(results['documents'][0]) > 0:
                for i, (doc, meta, score) in enumerate(zip(results['documents'][0], 
                                                         results['metadatas'][0],
                                                         results['distances'][0])):
                    # Convert distance to similarity score (higher is better)
                    similarity_score = 1 - score
                    all_results.append({
                        'collection': collection_name,
                        'document': doc,
                        'metadata': meta,
                        'score': similarity_score
                    })
                    
        except Exception as e:
            print(f"Error querying {collection_name}: {e}", file=sys.stderr)
    
    # Sort results by similarity score (highest first)
    all_results.sort(key=lambda x: x['score'], reverse=True)
    
    return all_results

def display_results(results, query_text):
    """
    Display the query results in a formatted way
    """
    if not results:
        print(f"\n❌ No relevant results found for query: '{query_text}'")
        return
    
    print(f"\n🔍 Search Results for: '{query_text}'")
    print("=" * 60)
    
    for i, result in enumerate(results, 1):
        print(f"\n{i}. [{result['collection'].upper()}]")
        print(f"   📝 {result['document']}")
        print(f"   🏷️  Metadata: {result['metadata']}")
        print(f"   ⭐ Relevance: {result['score']:.3f}")
        print("-" * 50)