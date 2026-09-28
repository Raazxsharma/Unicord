/**
 * Discord Bot Engine & Simulator
 * Provides Discord Slash Commands (/help, /poll, /roll, /flip, /ping, /quote, /avatar, /clear)
 * and dynamic conversation simulation with rich Discord Embeds.
 */

class BotEngine {
  constructor() {
    this.classmateResponses = [
      {
        trigger: /(presentation|rubric|slide|swot|project)/i,
        author: { name: 'Sarah', avatarText: 'SA', avatarBg: '#23a55a', isBot: false, role: 'Moderator' },
        reply: 'Make sure to check the presentation slides pinned in **#announcements**. Prof. Kapoor mentioned the rubric is updated!'
      },
      {
        trigger: /(game|valorant|gaming|squad|steam|play)/i,
        author: { name: 'Ghost', avatarText: 'GH', avatarBg: '#eb459e', isBot: false, role: 'Gamer' },
        reply: 'Who is down for a Valorant competitive 5-stack tonight? Hop into **🔊 Gaming Squad** voice channel!'
      },
      {
        trigger: /(food|canteen|pizza|dinner|coffee|snack)/i,
        author: { name: 'Rohan', avatarText: 'RH', avatarBg: '#f0b232', isBot: false, role: 'Member' },
        reply: 'Heading to the cafe right now for cold coffee and sandwiches! Anyone want anything?'
      },
      {
        trigger: /(code|javascript|python|bug|syntax|react)/i,
        author: { name: 'Alex (Dev)', avatarText: 'AD', avatarBg: '#5865F2', isBot: false, role: 'Developer' },
        reply: 'If you have any questions on the code or repo, check out the `#showcase` channel or use `/help`!'
      }
    ];
  }

  // Handle incoming user messages
  processUserMessage(channelId, text) {
    const trimmed = text.trim();

    // Check for slash commands or bot mentions
    if (trimmed.startsWith('/') || trimmed.toLowerCase().includes('@clyde') || trimmed.toLowerCase().includes('@discordbot') || trimmed.toLowerCase().includes('@unibot')) {
      this.handleBotCommand(channelId, trimmed);
      return;
    }

    // Check for contextual natural conversations
    for (const item of this.classmateResponses) {
      if (item.trigger.test(trimmed)) {
        this.simulateTypingAndReply(channelId, item.author, item.reply, 1400);
        return;
      }
    }

    // Occasional natural reaction from server friends
    if (Math.random() > 0.65) {
      const friends = [
        { name: 'Sarah', avatarText: 'SA', avatarBg: '#23a55a', role: 'Moderator' },
        { name: 'Rohan', avatarText: 'RH', avatarBg: '#f0b232', role: 'Member' },
        { name: 'Alex (Dev)', avatarText: 'AD', avatarBg: '#5865F2', role: 'Developer' }
      ];
      const friend = friends[Math.floor(Math.random() * friends.length)];
      const genericReplies = [
        'Totally agree with that! 👍',
        'Awesome, let\'s jump on voice chat later tonight.',
        'Count me in for this! 🔥',
        'Can someone pin that message in the channel?'
      ];
      const reply = genericReplies[Math.floor(Math.random() * genericReplies.length)];
      this.simulateTypingAndReply(channelId, friend, reply, 2000);
    }
  }

  handleBotCommand(channelId, text) {
    let clean = text.replace(/@(clyde|discordbot|unibot)/gi, '').trim();
    if (clean.startsWith('/')) clean = clean.slice(1);
    const [cmd, ...args] = clean.split(' ');
    const command = (cmd || '').toLowerCase();

    const botAuthor = { name: 'Discord Bot', avatarText: 'DB', avatarBg: '#5865F2', isBot: true, role: 'BOT' };

    let reply = '';
    let autoReactions = [];

    switch (command) {
      case 'help':
        reply = `<div class="discord-embed">
          <div class="embed-title">🤖 Discord Bot — Command Center</div>
          <div class="embed-desc">Here are the interactive commands available in this server:</div>
          <div class="embed-fields">
            <div class="embed-field"><div class="embed-field-name">/help</div><div class="embed-field-val">Displays this command menu</div></div>
            <div class="embed-field"><div class="embed-field-name">/poll [question]</div><div class="embed-field-val">Creates a live interactive poll</div></div>
            <div class="embed-field"><div class="embed-field-name">/roll [dice]</div><div class="embed-field-val">Rolls a 6-sided or 20-sided dice</div></div>
            <div class="embed-field"><div class="embed-field-name">/flip</div><div class="embed-field-val">Flips a coin (Heads or Tails)</div></div>
            <div class="embed-field"><div class="embed-field-name">/ping</div><div class="embed-field-val">Tests WebSocket & voice latency</div></div>
            <div class="embed-field"><div class="embed-field-name">/quote</div><div class="embed-field-val">Inspiring tech and gaming quote</div></div>
            <div class="embed-field"><div class="embed-field-name">/whiteboard</div><div class="embed-field-val">Opens collaborative Study Canvas</div></div>
            <div class="embed-field"><div class="embed-field-name">/clear</div><div class="embed-field-val">Cleans test messages in channel</div></div>
          </div>
          <div class="embed-footer">Discord Bot • Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>`;
        break;

      case 'poll': {
        const question = args.join(' ') || 'Should we host a community Valorant & Minecraft tournament this weekend?';
        reply = `<div class="discord-embed" style="border-left-color: #23a55a;">
          <div class="embed-title">📊 Community Server Poll</div>
          <div class="embed-desc">**${question}**\n\n*React below to cast your vote!*</div>
          <div class="embed-footer">Created by ${window.stateManager.state.currentUser.name} • Live Poll</div>
        </div>`;
        autoReactions = ['👍', '👎'];
        break;
      }

      case 'roll': {
        const sides = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        reply = `🎲 **Dice Roll**: You rolled a **${result}** on a d${sides}!`;
        break;
      }

      case 'flip': {
        const coin = Math.random() > 0.5 ? 'Heads' : 'Tails';
        reply = `🪙 **Coin Flip**: Result is **${coin}**!`;
        break;
      }

      case 'ping': {
        const lat = Math.floor(Math.random() * 15) + 18;
        reply = `🏓 **Pong!** WebSocket Latency: **${lat}ms** • Voice RTC: **Stable (0% loss)**`;
        break;
      }

      case 'whiteboard':
      case 'draw':
        reply = `🎨 **Opening Collaborative Whiteboard Activity!**\nSketch flowcharts, diagrams, or share ideas with everyone. Click **Post to Chat** when done.`;
        if (window.whiteboardEngine) {
          setTimeout(() => window.whiteboardEngine.open(), 300);
        }
        break;

      case 'quote': {
        const quotes = [
          '"Simplicity is prerequisite for reliability." — Edsger W. Dijkstra',
          '"Talk is cheap. Show me the code." — Linus Torvalds',
          '"Stay hungry, stay foolish." — Steve Jobs',
          '"The only way to do great work is to love what you do." — Steve Jobs'
        ];
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        reply = `💡 *${q}*`;
        break;
      }

      case 'clear': {
        const ch = window.stateManager.getCurrentChannel();
        if (ch) {
          window.stateManager.state.messages[ch.id] = [];
          window.stateManager.saveState();
          window.uiController.renderMessages();
          reply = `🧹 **Cleared message history for #${ch.name}.**`;
        }
        break;
      }

      case 'canteen':
        reply = `🍔 **Campus Canteen Specials Today**:\n• Central Cafe: *Paneer Butter Masala Combo, Chole Bhature, Cold Coffee*\n• Nescafe: *Hazelnut Frappe, Maggi, Grilled Sandwiches*\n• Night Mess: *Open until 1:00 AM!*`;
        break;

      case 'notes':
        reply = `📚 **Study & Notes Repository**:\n• *Computer Science*: [Algorithms & Data Structures](https://github.com)\n• *Business Management*: [Case Studies & Marketing Rubric](https://example.com)\n• *Calculus & Stats*: [Formulas & Past Exam Papers](https://example.com)`;
        break;

      default:
        reply = `👋 Hey there! I didn't recognize that command. Type \`/help\` to see all commands!`;
    }

    this.simulateTypingAndReply(channelId, botAuthor, reply, 600, autoReactions);
  }

  simulateTypingAndReply(channelId, author, text, delayMs = 1200, autoReactions = []) {
    const typingBar = document.getElementById('typing-bar');
    const typingText = document.getElementById('typing-text');

    if (typingBar && typingText) {
      typingText.textContent = `${author.name} is typing...`;
      typingBar.style.visibility = 'visible';
    }

    setTimeout(() => {
      if (typingBar) {
        typingBar.style.visibility = 'hidden';
      }

      const msg = {
        id: 'msg-' + Date.now(),
        author,
        timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: text,
        reactions: autoReactions.map(emoji => ({ emoji, count: 1, reacted: false }))
      };

      window.stateManager.addMessage(channelId, msg);

      // Play authentic Discord message ping sound
      if (window.audioEngine) {
        window.audioEngine.playMessagePing();
      }
      window.uiController.renderMessages();
    }, delayMs);
  }
}

window.botEngine = new BotEngine();
