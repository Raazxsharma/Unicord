/**
 * Discord Clone State Management & Multi-Tab Synchronization
 * Handles persistent state, guilds, channels, real-time messaging, and audio presence.
 */

var STORAGE_KEY = 'unicord_app_state_v1';
const loggedInPhone = localStorage.getItem('unicord_logged_in_phone');
if (loggedInPhone) {
  STORAGE_KEY = 'unicord_app_state_phone_' + loggedInPhone;
}

var DEFAULT_STATE = {
  currentUser: {
    id: 'user-me',
    name: 'Alex',
    discriminator: '0001',
    role: 'Server Owner',
    hostelStatus: 'Online',
    status: 'online', // 'online', 'idle', 'dnd', 'invisible'
    customStatus: 'Coding a Discord clone 🚀',
    avatarText: 'AL',
    avatarBg: '#5865F2',
    bannerColor: '#4752C4',
    bio: 'Software engineer and gamer. Building sleek real-time applications with modern web technologies!'
  },
  activeGuildId: 'guild-discord', // 'home' or guild ID
  activeChannelId: 'chan-general-chat',
  activeVoiceChannelId: null,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,

  // Communities & Guilds
  guilds: [
    {
      id: 'guild-discord',
      name: 'Unicord Central',
      initials: 'DC',
      color: '#5865F2',
      icon: null,
      unread: false,
      categories: [
        {
          id: 'cat-info',
          name: 'WELCOME & INFO',
          channels: [
            { id: 'chan-welcome', name: 'welcome-and-rules', type: 'text', topic: 'Welcome to the server! Read the rules and enjoy your stay.' },
            { id: 'chan-announcements', name: 'announcements', type: 'text', topic: 'Official server updates, feature releases, and community events.' }
          ]
        },
        {
          id: 'cat-chat',
          name: 'TEXT CHANNELS',
          channels: [
            { id: 'chan-general-chat', name: 'general-chat', type: 'text', topic: 'General discussion for all server members.' },
            { id: 'chan-gaming', name: 'gaming', type: 'text', topic: 'Clips, highlights, setup showcases, and game talk.' },
            { id: 'chan-memes', name: 'memes', type: 'text', topic: 'Spicy memes, funny videos, and wholesome content.' },
            { id: 'chan-bot-commands', name: 'bot-commands', type: 'text', topic: 'Test Unicord Bot commands like /help, /poll, /roll, /ping.' }
          ]
        },
        {
          id: 'cat-voice',
          name: 'VOICE CHANNELS',
          channels: [
            { id: 'chan-voice-lounge', name: 'Lounge (General)', type: 'voice', topic: 'Open voice room for casual hanging out.' },
            { id: 'chan-voice-squad', name: 'Gaming Squad', type: 'voice', topic: 'High-comms room for ranked matches.' },
            { id: 'chan-voice-lofi', name: 'Lo-Fi Chill 24/7', type: 'voice', topic: 'Muted vibes, background beats, and quiet work.' }
          ]
        }
      ]
    },
    {
      id: 'guild-apex',
      name: 'Apex University Hub',
      initials: 'AU',
      color: '#23a55a',
      icon: null,
      unread: false,
      categories: [
        {
          id: 'cat-campus-life',
          name: 'CAMPUS LIFE',
          channels: [
            { id: 'chan-campus-buzz', name: 'campus-buzz', type: 'text', topic: 'College news, fest updates, and canteen gossip.' },
            { id: 'chan-bba-dept', name: 'bba-discussions', type: 'text', topic: 'Coursework, presentations, and case studies.' },
            { id: 'chan-notes', name: 'notes-and-pyqs', type: 'text', topic: 'Previous year question papers, slides, and shared notes.' }
          ]
        },
        {
          id: 'cat-campus-voice',
          name: 'CAMPUS VOICE ROOMS',
          channels: [
            { id: 'chan-voice-study', name: '24/7 Study Room', type: 'voice', topic: 'Pomodoro focus and deep study.' },
            { id: 'chan-voice-common', name: 'Hostel Common Room', type: 'voice', topic: 'Late-night chill and banter.' }
          ]
        }
      ]
    },
    {
      id: 'guild-gaming',
      name: 'Esports & Gaming Lounge',
      initials: 'GG',
      color: '#eb459e',
      icon: null,
      unread: false,
      categories: [
        {
          id: 'cat-esports',
          name: 'GAMES',
          channels: [
            { id: 'chan-val-lfg', name: 'valorant-lfg', type: 'text', topic: 'Looking for group: Ascendant / Immortal ranked.' },
            { id: 'chan-steam-deals', name: 'steam-deals', type: 'text', topic: 'Free game alerts and sales.' }
          ]
        },
        {
          id: 'cat-game-vcs',
          name: 'TEAM VOICE CHANNELS',
          channels: [
            { id: 'chan-voice-team-a', name: 'Team Alpha Comms', type: 'voice', topic: 'Competitive match comms.' },
            { id: 'chan-voice-team-b', name: 'Team Bravo Comms', type: 'voice', topic: 'Casual 5-stack.' }
          ]
        }
      ]
    },
    {
      id: 'guild-dev',
      name: 'Developers & Code Lounge',
      initials: 'DEV',
      color: '#f0b232',
      icon: null,
      unread: false,
      categories: [
        {
          id: 'cat-dev-text',
          name: 'PROGRAMMING',
          channels: [
            { id: 'chan-javascript', name: 'javascript-typescript', type: 'text', topic: 'Node, React, Next.js, and TypeScript.' },
            { id: 'chan-python', name: 'python-and-ai', type: 'text', topic: 'Machine learning, scripts, and automation.' },
            { id: 'chan-showcase', name: 'project-showcase', type: 'text', topic: 'Show off what you are building!' }
          ]
        },
        {
          id: 'cat-dev-voice',
          name: 'DEV SESSIONS',
          channels: [
            { id: 'chan-voice-pair', name: 'Pair Programming', type: 'voice', topic: 'Screen share and debug together.' }
          ]
        }
      ]
    }
  ],

  // Sample Messages
  messages: {
    'chan-general-chat': [
      {
        id: 'msg-welcome-bot',
        author: { name: 'Unicord Bot', avatarText: 'DB', avatarBg: '#5865F2', isBot: true, role: 'BOT' },
        timestamp: 'Today at 10:00 AM',
        content: `<div class="discord-embed">
          <div class="embed-title">👋 Welcome to Unicord Central!</div>
          <div class="embed-desc">This is your exact Discord experience with real-time text chat, voice channels, interactive bots, and audio effects!\n\nType **/help** or click one of the channels on the left to get started.</div>
          <div class="embed-footer">Discord System • Verified Community</div>
        </div>`,
        reactions: [
          { emoji: '👋', count: 5, reacted: true },
          { emoji: '🔥', count: 3, reacted: false }
        ]
      },
      {
        id: 'msg-user-1',
        author: { name: 'Sarah', avatarText: 'SA', avatarBg: '#23a55a', isBot: false, role: 'Moderator' },
        timestamp: 'Today at 10:15 AM',
        content: 'Hey everyone! Welcome to the new Discord server. All voice channels now have live audio activity detection and soundboard effects! 🎧',
        reactions: [
          { emoji: '❤️', count: 4, reacted: true }
        ]
      },
      {
        id: 'msg-user-2',
        author: { name: 'Rohan', avatarText: 'RH', avatarBg: '#f0b232', isBot: false, role: 'Member' },
        timestamp: 'Today at 10:20 AM',
        content: 'Check this out — you can use markdown formatting like **bold**, *italics*, \`code\`, and spoiler tags like ||hidden surprise||!',
        reactions: [
          { emoji: '🚀', count: 2, reacted: false }
        ]
      },
      {
        id: 'msg-user-3',
        author: { name: 'Ghost', avatarText: 'GH', avatarBg: '#eb459e', isBot: false, role: 'Gamer' },
        timestamp: 'Today at 10:28 AM',
        content: 'Who wants to test the voice rooms and whiteboard? Jump into **🔊 Lounge (General)**!',
        reactions: [
          { emoji: '🎮', count: 3, reacted: true }
        ]
      }
    ],
    'chan-welcome': [
      {
        id: 'msg-rules',
        author: { name: 'Unicord Bot', avatarText: 'DB', avatarBg: '#5865F2', isBot: true, role: 'BOT' },
        timestamp: 'Yesterday at 8:00 PM',
        content: `<div class="discord-embed" style="border-left-color: #23a55a;">
          <div class="embed-title">📜 Server Rules & Guidelines</div>
          <div class="embed-desc">1. Be respectful to all members.\n2. Keep discussions in the relevant channels.\n3. No spamming or NSFW content.\n4. Use **/help** to see available bot tools.\n\nHave fun and enjoy the community!</div>
          <div class="embed-footer">Discord Moderation Team</div>
        </div>`,
        reactions: [
          { emoji: '✅', count: 12, reacted: true }
        ]
      }
    ],
    'chan-bot-commands': [
      {
        id: 'msg-bot-intro',
        author: { name: 'Unicord Bot', avatarText: 'DB', avatarBg: '#5865F2', isBot: true, role: 'BOT' },
        timestamp: 'Today at 9:30 AM',
        content: '🤖 Type \`/help\` to inspect all available slash commands or try \`/roll\`, \`/flip\`, \`/poll [Question]\`, and \`/ping\`!'
      }
    ]
  },

  // Friends & DM Contacts
  friends: [
    {
      id: 'friend-sarah',
      name: 'Sarah',
      discriminator: '1092',
      status: 'online',
      customStatus: 'Moderating Unicord Central 🛡️',
      role: 'Moderator',
      avatarText: 'SA',
      avatarBg: '#23a55a',
      activity: 'Playing VALORANT',
      activityDetail: 'Competitive (Ascendant 2)',
      bio: 'Server Moderator & Community Lead. Reach out if you need assistance!'
    },
    {
      id: 'friend-rohan',
      name: 'Rohan',
      discriminator: '4192',
      status: 'online',
      customStatus: 'Vibing to Lo-Fi beats 🎧',
      role: 'Member',
      avatarText: 'RH',
      avatarBg: '#f0b232',
      activity: 'Listening to Spotify',
      activityDetail: 'Synthwave Chill Tracks',
      bio: 'Web developer, tech enthusiast, and casual gamer.'
    },
    {
      id: 'friend-ghost',
      name: 'Ghost',
      discriminator: '8814',
      status: 'idle',
      customStatus: 'AFK for a quick snack 🍕',
      role: 'Gamer',
      avatarText: 'GH',
      avatarBg: '#eb459e',
      activity: 'In a Call',
      activityDetail: 'Gaming Squad VC',
      bio: 'FPS enthusiast & graphic designer. GG WP!'
    },
    {
      id: 'friend-bot',
      name: 'Unicord Bot',
      discriminator: '0001',
      status: 'online',
      customStatus: 'Type /help for commands 🤖',
      role: 'Verified Bot',
      avatarText: 'DB',
      avatarBg: '#5865F2',
      activity: 'Serving Unicord Central',
      activityDetail: 'v2.5 High-Speed',
      bio: 'Official interactive server assistant bot. Supports slash commands, polls, dice rolls, and games.'
    }
  ],

  // Active Voice Participants
  voiceParticipants: {
    'chan-voice-lounge': [
      { id: 'p-1', name: 'Rohan', avatarText: 'RH', avatarBg: '#f0b232', isSpeaking: false, isMuted: false },
      { id: 'p-2', name: 'Ghost', avatarText: 'GH', avatarBg: '#eb459e', isSpeaking: false, isMuted: true }
    ],
    'chan-voice-squad': [
      { id: 'p-3', name: 'Sarah', avatarText: 'SA', avatarBg: '#23a55a', isSpeaking: false, isMuted: false }
    ]
  }
};

class StateManager {
  constructor() {
    this.broadcast = null;
    this.listeners = [];
    this.state = this.loadState();
    this.initBroadcastChannel();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.guilds && parsed.guilds.length && parsed.guilds[0].id === 'guild-discord') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Discord State] Failed to load state from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      if (this.broadcast) {
        this.broadcast.postMessage({ type: 'STATE_UPDATED', state: this.state });
      }
    } catch (e) {
      console.warn('[Discord State] Failed to save state', e);
    }
    this.emitChange();
  }

  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.broadcast = new BroadcastChannel('discord_sync_channel');
      this.broadcast.onmessage = (event) => {
        if (event.data && event.data.type === 'STATE_UPDATED') {
          this.state = event.data.state;
          this.emitChange();
        }
      };
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emitChange() {
    this.listeners.forEach(fn => fn(this.state));
  }

  getCurrentGuild() {
    if (this.state.activeGuildId === 'home') return null;
    return this.state.guilds.find(g => g.id === this.state.activeGuildId) || this.state.guilds[0];
  }

  getCurrentChannel() {
    const guild = this.getCurrentGuild();
    if (!guild) return null;
    for (const cat of guild.categories) {
      const found = cat.channels.find(c => c.id === this.state.activeChannelId);
      if (found) return found;
    }
    return guild.categories[0]?.channels[0] || null;
  }

  getChannelMessages(channelId) {
    return this.state.messages[channelId] || [];
  }

  addMessage(channelId, message) {
    if (!this.state.messages[channelId]) {
      this.state.messages[channelId] = [];
    }
    this.state.messages[channelId].push(message);
    this.saveState();
  }

  deleteMessage(channelId, messageId) {
    if (this.state.messages[channelId]) {
      this.state.messages[channelId] = this.state.messages[channelId].filter(m => m.id !== messageId);
      this.saveState();
    }
  }

  
  updateGuild(guildId, updates) {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (guild) {
      Object.assign(guild, updates);
      this.saveState();
      return true;
    }
    return false;
  }

  deleteGuild(guildId) {
    if (this.state.guilds.length <= 1) {
      alert("You cannot delete the only remaining server!");
      return false;
    }
    this.state.guilds = this.state.guilds.filter(g => g.id !== guildId);
    if (this.state.activeGuildId === guildId) {
      this.state.activeGuildId = this.state.guilds[0].id;
      const firstChan = this.state.guilds[0].categories[0]?.channels[0];
      if (firstChan) this.state.activeChannelId = firstChan.id;
    }
    this.saveState();
    return true;
  }

  addGuild(guild) {
    this.state.guilds.push(guild);
    this.saveState();
  }

  addChannel(guildId, categoryId, channel) {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (guild) {
      let cat = guild.categories.find(c => c.id === categoryId);
      if (!cat) cat = guild.categories[0];
      cat.channels.push(channel);
      this.saveState();
    }
  }

  resetDemo() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.saveState();
  }
}

window.stateManager = new StateManager();
