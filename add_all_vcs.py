import re
import os

DIR = os.path.dirname(os.path.abspath(__file__))
state_path = os.path.join(DIR, 'js', 'state.js')

with open(state_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace STORAGE_KEY to v2 so all browsers get the new voice channels immediately
code = code.replace("const STORAGE_KEY = 'unicord_app_state_v1';", "const STORAGE_KEY = 'unicord_app_state_v2';")

# Replace categories of guild-apex with full comprehensive VCs
old_apex_categories_marker = "name: 'Apex University Hub',"
# Define all rich VCs
new_apex_categories = """      id: 'guild-apex',
      name: 'Apex University Hub',
      initials: 'AU',
      color: '#5865F2',
      icon: null,
      unread: false,
      categories: [
        {
          id: 'cat-welcome',
          name: 'CAMPUS LIFE',
          channels: [
            { id: 'chan-announcements', name: 'announcements', type: 'text', topic: 'Official university notices, fest dates, and exam schedules' },
            { id: 'chan-general', name: 'campus-buzz', type: 'text', topic: 'General college chit-chat, memes, and hangout' },
            { id: 'chan-canteen', name: 'canteen-hangout', type: 'text', topic: 'Is Maggi available at Nescafe right now?' }
          ]
        },
        {
          id: 'cat-hostel',
          name: 'HOSTELLERS & DAY SCHOLARS',
          channels: [
            { id: 'chan-hostel', name: 'hostellers-block', type: 'text', topic: 'Hostel night mess, laundry, and block gossip' },
            { id: 'chan-carpool', name: 'day-scholars-carpool', type: 'text', topic: 'Metro & carpool coordination for day commuters' }
          ]
        },
        {
          id: 'cat-bba',
          name: 'BBA & MANAGEMENT DEPT',
          channels: [
            { id: 'chan-bba', name: 'bba-discussions', type: 'text', topic: 'Assignments, semester presentations, and case study debates' },
            { id: 'chan-notes', name: 'notes-and-pyqs', type: 'text', topic: 'Shared lecture PDFs, slides, and previous year papers' }
          ]
        },
        {
          id: 'cat-voice-study',
          name: 'ACADEMIC & STUDY VCs',
          channels: [
            { id: 'chan-voice-study', name: '24/7 Study Room (Lo-Fi)', type: 'voice', topic: 'Silent study and Pomodoro sessions' },
            { id: 'chan-voice-library', name: 'Silent Library (Mute On Entry)', type: 'voice', topic: 'Deep work & focused reading' },
            { id: 'chan-voice-bba', name: 'BBA Group Discussion', type: 'voice', topic: 'Case study debates & presentations prep' },
            { id: 'chan-voice-doubts', name: 'Exam Prep & Doubts VC', type: 'voice', topic: 'Peer problem solving & past papers' }
          ]
        },
        {
          id: 'cat-voice-chill',
          name: 'CAMPUS & HOSTEL LOUNGES',
          channels: [
            { id: 'chan-voice-gen1', name: 'General Voice 1', type: 'voice', topic: 'Open talk for anyone' },
            { id: 'chan-voice-gen2', name: 'General Voice 2', type: 'voice', topic: 'Secondary lounge' },
            { id: 'chan-voice-chill', name: 'Hostel Common Room Chill', type: 'voice', topic: 'Late night banter & chai talks' },
            { id: 'chan-voice-nightmess', name: 'Night Mess Hangout', type: 'voice', topic: 'Midnight food ordering' },
            { id: 'chan-voice-canteen', name: 'Canteen Banter', type: 'voice', topic: 'After-class hangout' }
          ]
        },
        {
          id: 'cat-voice-music',
          name: 'MUSIC & ENTERTAINMENT',
          channels: [
            { id: 'chan-voice-music1', name: 'Music Lounge #1', type: 'voice', topic: 'Listen together' },
            { id: 'chan-voice-music2', name: 'Music Lounge #2', type: 'voice', topic: 'Chilled beats & acoustic' },
            { id: 'chan-voice-jam', name: 'Guitar & Jamming Room', type: 'voice', topic: 'Campus music club practice' }
          ]
        },
        {
          id: 'cat-voice-gaming',
          name: 'GAMING COMMS',
          channels: [
            { id: 'chan-voice-val1', name: 'Valorant Squad #1', type: 'voice', topic: 'Competitive ranked squad' },
            { id: 'chan-voice-val2', name: 'Valorant Squad #2', type: 'voice', topic: 'Casual 5-stack' },
            { id: 'chan-voice-bgmi', name: 'BGMI & Mobile Gaming', type: 'voice', topic: 'Hostel mobile squads' },
            { id: 'chan-voice-duo', name: 'Duo Comms (2-Player)', type: 'voice', topic: 'Private 2-person squad' }
          ]
        },
        {
          id: 'cat-voice-special',
          name: 'STAGE & SPECIAL VCs',
          channels: [
            { id: 'chan-voice-auditorium', name: 'Campus Auditorium (Stage)', type: 'voice', topic: 'Guest speakers & batch webinars' },
            { id: 'chan-voice-cr', name: 'CR & Council Meeting VC', type: 'voice', topic: 'Class reps & council sync' },
            { id: 'chan-voice-afk', name: 'AFK (Away From Keyboard)', type: 'voice', topic: 'Muted automatically' }
          ]
        }
      ]"""

# Regex replacement for guild-apex categories
code = re.sub(
    r"id:\s*'guild-apex'[\s\S]*?categories:\s*\[[\s\S]*?\n\s*\]\n\s*\},",
    new_apex_categories + "\n    },",
    code
)

with open(state_path, 'w', encoding='utf-8') as f:
    f.write(code)

print('[SUCCESS] Successfully updated js/state.js with full suite of Voice Channels across Study, Chill, Music, Gaming, and Stage!')
