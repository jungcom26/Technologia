import asyncio
import time
from faster_whisper import WhisperModel
from autogen_ext.models.ollama import OllamaChatCompletionClient
from autogen_agentchat.agents import AssistantAgent
from pydantic import BaseModel
from typing import List, Optional


# ---------------------------
# STEP 1: TRANSCRIPTION
# ---------------------------
def transcribe_audio_with_timestamps(audio_path: str) -> str:
    """
    Transcribes the audio file with timestamps using Whisper.
    Also prints total transcription time.
    """
    start_time = time.time()

    model = WhisperModel("tiny", device="cuda", compute_type="int8")  # tiny/small/medium/large
    sum_text = ""

    segments, info = model.transcribe(audio_path, beam_size=5)
    for segment in segments:
        sum_text += segment.text + " "
        print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))

    end_time = time.time()
    print(f"⏱️ Transcription completed in {end_time - start_time:.2f} seconds")

    return sum_text


# ---------------------------
# STEP 2: Pydantic Models
# ---------------------------
class StoryEvent(BaseModel):
    event: str
    details: str

class PlayerAction(BaseModel):
    player_placeholder: str       # e.g., Player1, Player2
    character_name: str           # actual in-game character name
    action: str
    outcome: str

class WorldStateUpdate(BaseModel):
    aspect: str
    change: str

class CharacterTracking(BaseModel):
    character_name: str
    condition: str
    notes: Optional[str] = ""

class UnresolvedThread(BaseModel):
    mystery_or_quest: str
    status: str

class DungeonSessionSummary(BaseModel):
    story_progression: List[StoryEvent]
    player_actions: List[PlayerAction]
    world_state_updates: List[WorldStateUpdate]
    character_tracking: List[CharacterTracking]
    unresolved_threads: List[UnresolvedThread]


# ---------------------------
# STEP 3: Summarizer Agent
# ---------------------------
async def run_summarizer(audio_path: str, output_file: str = "dnd_summary.csv"):
    # 1. Transcribe
    transcription_text = transcribe_audio_with_timestamps(audio_path)

    # 2. Setup model client
    model_client = OllamaChatCompletionClient(
        model="deepseek-r1:14b",
        name="D&D Summarizer",
        response_format=DungeonSessionSummary,
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
        },
        system_message=(
            """
You are a Dungeon Master session logger.
Your job is to take the raw transcript of a Dungeons & Dragons game 
and output a structured JSON that records all events exactly as they occurred.
Do NOT summarize, condense, or remove any events.

The CSV must contain four sections, each separated by a header row:

1. Story Progression & World Updates
   Columns: Event/Aspect,Details/Change
   - Log every story event and all changes to the world.

2. Player Actions
   Columns: Player,Action,Outcome
   - Log all player actions exactly as they happen, including outcomes.

3. Character Tracking
   Columns: Character,Condition,Notes
   - Log all updates to character status, conditions, or notes.

4. Unresolved Threads / Hooks
   Columns: Mystery/Quest,Status
   - Log all ongoing quests, mysteries, or hooks mentioned in the transcript.

Rules:- No markdown, no explanations, only plain JSON.
- Replace any personal or sensitive information with generic terms.
- Keep all entries factual, chronological, and complete.
"""
        ),
    )

    summarizer = AssistantAgent(
        name="Dungeon_Scribe_Summarizer",
        model_client=model_client,
        description="An AI assistant that summarizes tabletop RPG session transcripts and tracks story developments."
    )

    # 3. Run summarizer (with timing)
    start_summary = time.time()
    result = await summarizer.run(task=f"Summarize this session:\n{transcription_text}")
    end_summary = time.time()
    print(f"⏱️ Summarization completed in {end_summary - start_summary:.2f} seconds")

    csv_output = result.messages[-1].content.strip()

    # 4. Save to CSV file
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(csv_output)

    print(f"✅ Summary saved to {output_file}")


# ---------------------------
# STEP 4: Entry Point
# ---------------------------
if __name__ == "__main__":
    audio_file = r"C:\Users\divya\OneDrive\Desktop\Dungeon\dd.mp3"   # Change this path
    asyncio.run(run_summarizer(audio_file, "dnd_summary.csv"))
