def format_updates(data):
    output = []

    # Quest Updates
    if "quest_updates" in data and data["quest_updates"]:
        output.append("**Quest Updates**")
        for quest in data["quest_updates"]:
            output.append(f"- {quest['update']}")

    # World State Updates
    if "world_state_updates" in data and data["world_state_updates"]:
        output.append("\n**World State Updates**")
        for world in data["world_state_updates"]:
            output.append(f"- {world['update']}")

    # Character Events
    if "character_events" in data and data["character_events"]:
        output.append("\n**Character Events**")
        for char in data["character_events"]:
            output.append(f"- **{char['character']}**")
            if "action" in char:
                output.append(f"  - Action: {char['action']}")
            if "outcome" in char:
                output.append(f"  - Outcome: {char['outcome']}")

    return "\n".join(output)


# Example usage
data = {
  "quest_updates": [
    {
      "quest": "time_loop_investigation",
      "update": "Paul suspects Thomas is responsible for his temporal imprisonment and seeks a way to escape.",
      "status": "ongoing"
    }
  ],
  "world_state_updates": [
    {
      "location": "Old Oak Inn",
      "update": "The inn experiences escalating chaos with a waiter tripping, a sheep crashing through windows, and a subsequent shockwave emanating from a scroll. The environment is significantly disrupted by these events."
    }
  ],
  "character_events": [
    {
      "character": "waiter",
      "action": "Trips and drops glasses, contributing to the initial chaos.",
      "outcome": "Illustrates the unpredictable nature of the environment."
    }
  ]
}

print(format_updates(data))
