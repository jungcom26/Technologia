# 🏰 Dungeon Scribe 📜

*“Where stories are written by hand and forged in imagination.”*

**Developed by Team Technologia 💡**

Transform your D&D sessions with AI-powered transcription, intelligent character tracking, and a beautiful medieval interface that makes every game night feel epic.

---

## 🎯 What is DungeonScribe?

DungeonScribe is your ultimate D&D companion that **listens to your game, remembers everything, and organizes it automatically**. No more scrambling to take notes while you're trying to roleplay, you just have to focus on the story, and let DungeonScribe handle all the complex details.

### The Problem We Solve

**As a Dungeon Master, you're juggling:**
- 📝 Taking notes while describing scenes
- 🧙 Tracking multiple characters and inventories
- 📖 Remembering what happened in the last session
- 🎲 Managing quests, NPCs, and plot threads
- ⏰ Keeping the game flowing smoothly

**DungeonScribe handles all of this automatically** so you can focus on what matters and that is telling amazing stories.

---

## ✨ Key Features

### 🎤 **Live Transcription** — Never Miss a Moment

Just **speak naturally** during your game. DungeonScribe:
- Records everything said at the table
- Converts speech to text in real-time using AI (Whisper)
- Creates a searchable archive of your entire campaign
- Remove mundane chats to keep conversations private.

**Example:**
> 🎙️ *"Alex casts Fireball at the orc horde, dealing 48 damage!"*
> 
> 📝 DungeonScribe automatically:
> - Records the action in Alex's character history
> - Tracks that a Fireball was cast
> - Logs the combat outcome
> - Timestamps the event

### 🧙‍♂️ **Smart Character Management** — A editable Character Sheet

Create **full character sheets** with everything you need:

**Combat Stats** ⚔️
- HP, AC, Initiative, Speed
- Hit Dice tracking
- Temporary HP

**Abilities & Skills** 🎯
- All six ability scores (STR, DEX, CON, INT, WIS, CHA)
- Proficiency bonus
- Saving throws and skills
- Languages known

**Spellcasting** ✨
- Spell slots by level
- Known spells list
- Spell DC and attack bonus
- Spellcasting ability

**Equipment & Wealth** 💰
- Complete inventory
- Currency tracking (GP, SP, CP)
- Magical items and features

**Personality** 🎭
- Traits, ideals, bonds, flaws
- Full backstory section
- Session notes

**The best part?** DungeonScribe **auto-detects character actions** from your speech and logs them automatically.

> **Note:** For now, all these things can be manually added, but improvements in the pipeline can automate this process in future updates!

### 📦 **Inventory System** — Track Every Item

Never lose track of loot again:

- 🗡️ **Item Database**: Every weapon, potion, and magical artifact
- 🎒 **Character Inventories**: See who's carrying what
- 🔄 **Transfer History**: "Who gave the healing potions to the rogue?"
- 📊 **Categories**: Weapons, armor, potions, quest items, etc.
- 🔍 **Search**: Find any item instantly

**Example Use Cases:**
- "Wait, who has the key to the tomb?"
- "Did we already find the Staff of Fire?"
- "Let me check what healing items we have"

### 🤖 **AI-Powered Intelligence** — Your Silent Assistant

DungeonScribe uses cutting-edge AI to understand your game:

**Automatic Event Detection** 🎯
- Who did what, when, and where
- Combat actions and outcomes
- Item discoveries and transfers
- Quest progress updates
- Location changes

**Smart Summarization** 📊
- Converts chaotic speech into organized data
- Identifies key story moments
- Tracks quest objectives
- Monitors world state changes

**Character Recognition** 👥
- Automatically identifies character names
- Links actions to the right character
- Builds character timelines

**Rule-Based Fallback** 🛡️
- Works even without AI (uses pattern matching)
- No internet required for basic features
- Privacy-focused: all processing happens locally, even the LLM processing!

💬 Ask Archive — Talk to Your Campaign History

Have a question about your campaign? Just ask in natural language!

How It Works:
- Type questions like "When did we last see the red dragon?"
- The LLM searches your database and understands context
- Get answers in easy-to-understand natural language
- No need to remember exact keywords or dates

### 🎨 **Beautiful Medieval Interface** — Immerse Your Players

Every screen is designed to feel like you're in a medieval library:

**Visual Design** 🖼️
- Dark parchment backgrounds
- Warm candlelight effects
- Gold accents and medieval fonts
- Cursor-tracked lighting (light follows your mouse!)

**Campaign Selection** 📚
- Gorgeous card carousel with pre-made settings
- **Whispers of the Grove**: Druidic forest adventure
- **Sands of the Sunken Crown**: Desert ruins exploration
- **Echoes in the Halls**: Dwarven underground mystery
- **Tideglass Covenant**: Coastal storm saga

**Journal & Notes** 📖
- Chronicle your campaign story
- Session-by-session organization
- Search across all sessions
- Add images and artwork
- Add important quests and plot points

### 🖼️ **AI Art Generation** — Bring Your World to Life *(Optional)*

Generate campaign artwork on the fly:
- Character portraits
- Scene illustrations
- Location concepts
- Monster designs

Just click on the transcription and AI creates that scene instantly!

### 💾 **Everything is Saved** — Never Lose Progress

**Triple Backup System**:
1. **SQLite Database** — Fast, searchable, relational
2. **JSON Files** — Human-readable session summaries
3. **JSONL Logs** — Raw transcript backups

Your data is safe, secure, and always accessible.

---

## 🚀 How It Works

### For Dungeon Masters

**Before the Session:**
1. Open DungeonScribe in your browser
2. Select your campaign from the carousel
3. Review character sheets and last session notes
4. Check inventory and quest logs
5. You're ready to play!

**During the Session:**
1. Click "Start Recording" button
2. Play D&D normally — just talk naturally
3. DungeonScribe listens and organizes everything automatically
4. All character actions, quests, and story beats are logged in real-time
5. Reference character sheets and notes without breaking immersion

**After the Session:**
1. Review the auto-generated transcript
2. Update any character stats (HP, XP, items) manually if needed
3. Add important quest notes or plot points
4. Export character sheets if needed
5. Your entire session is archived and searchable for future reference

---

## 🎮 Real-World Example

**Session Scenario:**

> **DM**: *"You enter the ancient tomb. Roll for initiative!"*
> 
> **Player 1**: *"Gandalf casts Light on his staff and moves forward cautiously."*
> 
> **Player 2**: *"Legolas readies his bow and keeps watch at the entrance."*
> 
> **DM**: *"You see three skeleton warriors rise from the sarcophagi!"*

**What DungeonScribe Does Automatically:**

✅ **Transcript Recorded:**
```
[14:23:10] DM: You enter the ancient tomb. Roll for initiative!
[14:23:25] Gandalf casts Light on his staff...
[14:23:40] Legolas readies his bow...
[14:23:55] DM: You see three skeleton warriors...
```

✅ **World State UpdateEvents Detected:**
- 📍 Location → Ancient Tomb (new)   
- ⚔️ Combat → Started with skeleton warriors

✅ **Character Stats Updated:**
- Gandalf: Spell slot used (Level 0 cantrip)
- Legolas: Position noted (entrance guard)

✅ **Quest Log:**
- "Explore the ancient tomb" — In Progress

**All of this happens automatically while you play!**

---

## 🌟 Why DungeonScribe is Different

### Compared to Manual Note-Taking

| Manual Notes | DungeonScribe |
|--------------|---------------|
| ❌ Interrupts gameplay | ✅ Silent and automatic |
| ❌ Miss important details | ✅ Captures everything |
| ❌ Hard to search later | ✅ Instant search |
| ❌ Scattered across notebooks | ✅ All in one place |
| ❌ Difficult to share | ✅ Easy exports for Character Sheet|

### Compared to Other Tools

**D&D Beyond / Roll20**
- ✅ Great for character sheets and events
- ❌ Don't record your actual game
- ❌ Don't transcribe conversations
- ❌ Don't track narrative events automatically

**General Note Apps (OneNote, Notion):**
- ✅ Good for manual organization
- ❌ Require constant typing during play
- ❌ No D&D-specific features
- ❌ No automatic detection

**Voice Recorders:**
- ✅ Record audio
- ❌ Just raw audio files — no transcription
- ❌ Not searchable
- ❌ Can't extract events or stats

**DungeonScribe does all of this in one tool.**

---

## 🎯 Who Is This For?

### Perfect For:

✅ **Busy DMs** who want less prep and more play  
✅ **Story-focused groups** who value narrative continuity  
✅ **Long campaigns** that need detailed archives  
✅ **Remote groups** playing over video chat  
✅ **Content creators** who want session records for podcasts/streams  
✅ **New DMs** who need character management help  
✅ **Organized groups** who want professional-grade tools


### Great For These Play Styles:

- 🎭 **Roleplay-Heavy**: Captures dialogue and character moments
- ⚔️ **Combat-Focused**: Tracks actions, damage, and turns
- 🗺️ **Exploration**: Logs locations and discoveries
- 📖 **Story-Driven**: Chronicles plot developments
- 🏰 **Sandbox**: Maintains continuity in open-world games

---

## 🛠️ What You Need

### Minimum Requirements

**To Use DungeonScribe:**
- A computer (Windows, Mac, or Linux)
- Microphone (for transcription)
- Web browser (Chrome, Firefox, Safari, Edge)
- Python 3.8 or higher
- 4GB RAM minimum (8GB recommended)
- 10GB free disk space

**Optional Enhancements:**
- Ollama AI (for better event detection) — Free
- Stable Diffusion (for art generation) — Free
- GPU (makes transcription and image generation much faster)

---

## 🚦 Getting Started

Follow these steps to install and run DungeonScribe on your computer.

### Step 1: Install Python Dependencies

**1. Clone or download the DungeonScribe repository:**

```bash
# If using Git
git clone https://github.com/jungcom26/Technologia.git

# Or download and extract the ZIP file, then navigate to the folder
```

**2. Navigate to the backend directory:**

```bash
cd DungeonScribe_Integrated_v3
```

**3. Install Python dependencies from requirements.txt:**

```bash
# Install all required Python packages
pip install -r requirements.txt
```

This will install:
- FastAPI (web framework)
- Uvicorn (web server)
- Faster-Whisper (speech recognition)
- WebRTC VAD (voice activity detection)
- Pydantic (data validation)
- And other necessary libraries

**Troubleshooting:**
- If `pip` doesn't work, try `pip3` or `python -m pip`
- On Linux/Mac, you may need `sudo` for system-wide installation
- Consider using a virtual environment for isolation

---

### Step 2: Install Ollama and Gemma 3:12B Model

Ollama is the AI engine that powers intelligent event detection and summarization.

**1. Install Ollama:**

**For Windows:**
```bash
# Download installer from https://ollama.ai
# Run the .exe installer
# Follow the installation wizard
```

**For Mac:**
```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai
```

**For Linux:**
```bash
# Using the official install script
curl -fsSL https://ollama.com/install.sh | sh
```

**2. Start Ollama service:**

```bash
ollama serve
```

Leave this terminal window open — Ollama needs to be running in the background.

**3. Pull the Gemma 3:12B model:**

Open a **new terminal window** and run:

```bash
ollama pull gemma3:12b
```

This will download the Gemma 3 model (approximately 7-8 GB). The download may take a few minutes depending on your internet speed.

**4. Verify the installation:**

```bash
# List installed models
ollama list

# You should see gemma3:12b in the list
```

**Note:** If you want to use a smaller model for faster performance on limited hardware:
```bash
# Alternative: smaller model (faster, less accurate)
ollama pull gemma3:3b
```

---

### Step 3: Install Stable Diffusion (Optional)

Stable Diffusion enables AI-powered artwork generation for your campaigns.

**Option A: AUTOMATIC1111 Web UI (Recommended for most users)**

**1. Install Git (if not already installed):**

**Windows:**
```bash
# Download from https://git-scm.com/download/win
```

**Mac:**
```bash
brew install git
```

**Linux:**
```bash
sudo apt-get install git  # Ubuntu/Debian
```

**2. Clone the Stable Diffusion Web UI repository:**

```bash
# Navigate to where you want to install it
cd ~  # or any directory you prefer

# Clone the repository
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
```

**3. Run the installation script:**

**Windows:**
```bash
# Double-click webui-user.bat
# Or run in Command Prompt:
webui-user.bat
```

**Mac/Linux:**
```bash
# Make the script executable
chmod +x webui.sh

# Run the installer
./webui.sh
```

The first run will:
- Download dependencies
- Download the default Stable Diffusion model (4-7 GB)
- Set up the web interface

This may take 10-30 minutes depending on your internet speed.

**4. Start Stable Diffusion with API enabled:**

**Windows:**
Edit `webui-user.bat` and add:
```batch
set COMMANDLINE_ARGS=--api
```

Then run:
```bash
webui-user.bat
```

**Mac/Linux:**
```bash
./webui.sh --api
```

**5. Verify Stable Diffusion is running:**

Open your browser and go to: `http://127.0.0.1:7860`

You should see the Stable Diffusion interface.

---

### Step 4: Launch DungeonScribe

**1. Start all services in separate terminal windows:**

**Terminal 1: Start Ollama**
```bash
ollama serve
```

**Terminal 2: Start Stable Diffusion (Optional)**
```bash
cd ~/stable-diffusion-webui  # or wherever you installed it
./webui.sh --api              # Mac/Linux
# Or webui-user.bat            # Windows
```

**Terminal 3: Start DungeonScribe**
```bash
cd backend
python main.py
```

**2. Wait for the startup messages:**

You should see:
```
✅ Database tables initialized
[whisper] loading: small.en
[whisper] ready
[ollama] target: http://127.0.0.1:11434  model: gemma3:12b
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**3. Open DungeonScribe in your browser:**

Navigate to: `http://127.0.0.1:8000`

---

### Step 5: First-Time Setup

**1. Allow microphone permissions:**

When prompted, click "Allow" to let DungeonScribe access your microphone.

**2. Select a campaign:**

- Go back to the home page
- Click "Enter the Realm"
- Choose one of the four campaigns
- Or create your own!

**3. Create your first character:**

- Click "Characters" in the navigation
- Click "New Character"
- Fill in the character details
- Click "Save Character"

**4. Start your first session:**

- Click "Home"
- Click "Start Recording"
- Speak naturally during your game
- All transcription happens automatically
- Review the journal after your session

---

### Included Features (100% Free)

✅ Unlimited transcription  
✅ Unlimited characters  
✅ Unlimited campaigns  
✅ Full D&D 5e based character sheets  
✅ Inventory system  
✅ Auto-save and backup  
✅ Export to PDF/PNG  
✅ Local storage (your data stays on your computer)  
✅ No account required  
✅ No internet needed (except for optional AI features)  
✅ Regular updates


---

## 💡 Pro Tips

### For Getting the Best Transcription

**Microphone Setup** 🎤
- Use a good quality microphone (USB mic recommended)
- Position mic 6-12 inches from speakers
- Reduce background noise when possible
- Test audio levels before starting

**Speaking Tips** 🗣️
- Speak clearly and at a moderate pace
- Pause briefly between major actions
- Say character names clearly
- State dice results explicitly

**Environment** 🏠
- Choose a quiet room if possible
- Turn off fans or AC during important moments
- Use push-to-talk for Discord if playing online
- Close windows to reduce street noise

### For Organizing Your Campaign

**Session Preparation** 📝
- Review last session's journal before playing
- Update character HP/resources at session start
- Add quest notes as you remember them
- Export important NPCs to character sheets

**During Sessions** 🎲
- Let DungeonScribe run continuously
- Manually add critical quest updates in real-time
- Tag important moments in the journal
- Update character inventories after loot distribution

**Post-Session Workflow** ✅
- Review transcript for missed details
- Update experience points and levels
- Export updated character sheets
- Archive important session notes

---

## 🔧 Troubleshooting

### Common Issues

**Ollama not connecting:**
```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/generate

# Restart Ollama
# Close existing ollama serve
ollama serve
```

**Whisper transcription not working:**
- Check microphone permissions in browser
- Verify audio input device in system settings
- Try a smaller model: `WHISPER_MODEL_SIZE=tiny.en`
- Check Python dependencies are installed

**Stable Diffusion not generating images:**
- Verify SD WebUI is running on port 7860
- Check that `--api` flag is enabled
- Try accessing http://127.0.0.1:7860 directly
- Restart SD WebUI with API enabled

**Database errors:**
- Delete `dungeon_sessions.db` to reset
- Check file permissions in backend directory
- Ensure SQLite is installed (comes with Python)

**High CPU/Memory usage:**
```bash
# Use smaller models
export WHISPER_MODEL_SIZE=tiny.en
export OLLAMA_MODEL=gemma3:3b

# Limit workers
export WHISPER_NUM_WORKERS=1
```

---

## 🤝 Join the Community

**DungeonScribe is open source and community-driven!**

- 🌟 Star us on GitHub
- 🐛 Report bugs or request features
- 🎨 Share your campaign stories
- 📝 Contribute to add more feautres and ideas to make this more diverse

---

## 👥 Credits

### 🧠 Developed by **Team Technologia** team members:

- Mukul — Audio Processing, Transcription Pipeline & Inventory System
- Divyansh — Backend Architecture, Full-Stack Development & AI Integration
- Akshat — Database Design & Schema Architecture
- Eddie — Frontend Design, User Experience & Interface
- Com — Frontend Development & Documentation
- Adil — Character Sheet Management                                

**Special Thanks:**
- Ella (Our Tutor) — For guiding us throughout the semester with invaluable feedback and support
- Professor Mashhuda Glencross & Jason Weigel — For giving us a chace to build this project
- Whisper AI Team at OpenAI — For making speech recognition accessible to everyone
- Ollama Project & Community — For enabling local AI inference with privacy in mind
- FastAPI Framework Developers — For creating an incredible web framework
- Stable Diffusion Community — For democratizing AI art generation
- D&D 5e & TTRPG Community — For inspiration and creativity
- All Our Beta Testers & DMs We Interviewed — For honest feedback that shaped DungeonScribe into what it is built
---

## 🎲 Final Words

**Every great campaign deserves to be remembered.**

DungeonScribe is our love letter to tabletop gaming, which is a tool that respects the chaos and creativity of D&D while making it easier to preserve your stories.

Whether you're running a weekly game with friends, streaming to thousands, or just trying to remember what happened last month, DungeonScribe has your back.

**Download now and never forget another epic moment.** 🏰✨

---

*DungeonScribe — Where every session becomes legend.*

**[View on GitHub](https://github.com/jungcom26/Technologia) • [Documentation](https://github.com/jungcom26/Technologia/blob/main/README.md) • [Report Issue](https://github.com/jungcom26/Technologia/issues)**
