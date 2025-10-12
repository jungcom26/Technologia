# vector_db.py
import chromadb
import json
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

class VectorDBManager:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="dnd_session_data",
            metadata={"description": "D&D session transcripts and structured data"}
        )
    
    def chunk_to_text(self, chunk_data: Dict[str, Any]) -> str:
        """Convert a chunk's structured data to searchable text"""
        parts = []
        
        # Add transcript
        if chunk_data.get('transcript'):
            parts.append(f"Transcript: {chunk_data['transcript']}")
        
        # Add world state updates
        for update in chunk_data.get('world_state_updates', []):
            parts.append(f"World Update - {update.get('location', 'Unknown')}: {update.get('update', '')}")
        
        # Add character events
        for event in chunk_data.get('character_events', []):
            action_desc = f"{event.get('character', 'Unknown')} {event.get('action', '')}"
            if event.get('outcome'):
                action_desc += f" → {event['outcome']}"
            parts.append(f"Character Event: {action_desc}")
        
        # Add quest updates
        for quest in chunk_data.get('quest_updates', []):
            parts.append(f"Quest Update - {quest.get('quest', 'Unknown')}: {quest.get('update', '')}")
        
        # Add entities
        for entity in chunk_data.get('entities', []):
            alias_part = f" (aka {', '.join(entity.get('aliases', []))})" if entity.get('aliases') else ""
            desc_part = f" — {entity['description']}" if entity.get('description') else ""
            parts.append(f"Entity: {entity.get('name', 'Unknown')}{alias_part}{desc_part}")
        
        return "\n".join(parts)
    
    def store_chunk(self, session_id: str, chunk_index: int, transcript: str, structured_data: Dict[str, Any]):
        """Store a transcript chunk in vector database (STORAGE ONLY)"""
        try:
            chunk_id = f"{session_id}_chunk_{chunk_index}"
            
            # Convert structured data to text for embedding
            document_text = self.chunk_to_text(structured_data)
            
            # Prepare metadata
            metadata = {
                "session_id": session_id,
                "chunk_index": chunk_index,
                "transcript": transcript,
                "created_at": datetime.utcnow().isoformat(),
                "world_updates_count": len(structured_data.get('world_state_updates', [])),
                "character_events_count": len(structured_data.get('character_events', [])),
                "quest_updates_count": len(structured_data.get('quest_updates', [])),
                "entities_count": len(structured_data.get('entities', [])),
            }
            
            # Add to vector database
            self.collection.add(
                documents=[document_text],
                metadatas=[metadata],
                ids=[chunk_id]
            )
            print(f"[vector_db] Stored chunk {chunk_id} in vector database")
            
        except Exception as e:
            print(f"[vector_db] Error storing chunk: {e}")

# Global instance
vector_db = VectorDBManager()