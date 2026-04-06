const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Kadala Watchman is Online, Chatting, and using Cache-Busted Keys! 🔑🔥"));
app.listen(process.env.PORT || 3000);

// ================= AI SETUP (AUTO-FAILOVER ROTATION) =================
const systemInstruction = `
You are 'Kadala Watchman', a peak GenZ Tamil guy in a Discord server.
- Language: Strictly Tanglish (Mix of Tamil and English).
- Style: Use GenZ slang like 'vibe', 'scene-u', 'mamba', 'lit', 'clutch', 'gubeer', 'pangu', 'maams', 'blood', 'share-u'.
- Tone: Be funny, sarcastic (nakkaal), and friendly.
- Address user as: 'da', 'mamba', 'pangu', or 'pulla'.
- Context awareness: You will be provided with the recent chat history. Use it to understand the flow, but only reply to the latest message.
- Rules: Keep it short (1-3 sentences max). Don't be robotic. Use emojis like 💀, 🔥, 😂, 🫡.
`;

let currentKeyIndex = -1;

function getAvailableKeys() {
  return [
    process.env.API_KEY_1,
    process.env.API_KEY_2,
    process.env.API_KEY_3
  ].filter(key => key !== undefined && key.trim() !== '');
}

function getNextChatModel() {
  const geminiKeys = getAvailableKeys();
  if (geminiKeys.length === 0) return null;
  
  currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length; 
  const keyToUse = geminiKeys[currentKeyIndex];
  
  console.log(`[AI Status] Trying Slot: ${currentKeyIndex + 1}`);
  
  const genAI = new GoogleGenerativeAI(keyToUse);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
}

// ================= CLIENT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= THE BLACK BOX LOGGER 🕵️‍♂️ =================
const logFile = './kadala-crash.log';

function spitLog(title, error) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const errorDetails = error?.stack || error?.message || JSON.stringify(error) || "Unknown Error";
  
  const formattedLog = `\n=========================================
🚨 [CRASH REPORT - ${timestamp}]
⚠️ TYPE: ${title}
-----------------------------------------
${errorDetails}
=========================================\n`;

  console.error(formattedLog);
  try { fs.appendFileSync(logFile, formattedLog); } catch (fsErr) { console.error("Bro, couldn't write log!", fsErr); }
}

process.on('unhandledRejection', (reason) => spitLog('UNHANDLED PROMISE REJECTION (Silent Crash)', reason));
process.on('uncaughtException', (err) => spitLog('FATAL UNCAUGHT EXCEPTION (Bot Died)', err));
client.on('error', (err) => spitLog('DISCORD CLIENT ERROR', err));
client.on('disconnect', () => spitLog('DISCORD DISCONNECTED', 'Lost connection to Gateway.'));
client.on('shardError', error => spitLog('WEBSOCKET SHARD ERROR', error));

// ================= UTILITIES, AFK & RATE LIMITER =================
const processedMessages = new Set();
const FILE = './afk.json';
let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
const saveAFK = () => fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));

const formatTime = (ms) => {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return hr > 0 ? `${hr}h ${min}m ${sec}s` : `${min}m ${sec}s`;
};

// Rate Limiter System
const aiUsage = {}; 

function checkRateLimit(userId) {
  const now = Date.now();
  if (!aiUsage[userId]) aiUsage[userId] = { history: [], blockedUntil: 0 };
  const user = aiUsage[userId];

  if (user.blockedUntil > now) return { allowed: false, reason: 'timeout', timeLeft: user.blockedUntil - now };

  user.history = user.history.filter(t => now - t < 10 * 60 * 1000);

  if (user.history.length > 0) {
    const lastTime = user.history[user.history.length - 1];
    if (now - lastTime < 10000) return { allowed: false, reason: 'cooldown', timeLeft: 10000 - (now - lastTime) };
  }

  if (user.history.length >= 5) {
    user.blockedUntil = now + 10 * 60 * 1000; 
    return { allowed: false, reason: 'timeout', timeLeft: 10 * 60 * 1000 };
  }

  user.history.push(now);
  return { allowed: true };
}

const funFacts = ["Octopus has 3 hearts", "Honey never spoils", "Bananas are berries", "Sharks older than trees", "Space smells like metal", "Sun is white actually", "Rats laugh", "Sharks never stop swimming"];

// ================= EVENTS =================
client.once('ready', () => {
  const keysCount = getAvailableKeys().length;
  console.log(`Verkadala is Fully Operational 🔥 | Loaded ${keysCount} API Keys.`);
  
  client.user.setPresence({
    activities: [{ name: `Server Chat 👀`, type: ActivityType.Watching }],
    status: "online"
  });

  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      const channel = guild.channels.cache.find(c => c.isTextBased() && c.name.includes('general')) || guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages'));
      if (channel) {
        const fact = funFacts[Math.floor(Math.random() * funFacts.length)];
        channel.send(`🧠 **Fun Fact:** ${fact}`);
      }
    });
  }, 10 * 60 * 1000); 
});

// ================= MAIN MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
  if (processedMessages.has(message.id) || message.author.bot) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 5000);

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // --- 1. DEBUG COMMAND ---
  if (content === 'kadala debug keys') {
    const keys = getAvailableKeys();
    if (keys.length === 0) return message.reply("Bro, I see ZERO keys. Railway variables `API_KEY_1`, `API_KEY_2`, etc. are empty. 💀");
    
    let debugMsg = `**Debug Info:**\nI found **${keys.length}** API keys loaded in my system.\n`;
    keys.forEach((k, i) => {
      debugMsg += `Slot ${i + 1}: Starts with \`${k.substring(0, 6)}...\`\n`; 
    });
    return message.reply(debugMsg);
  }

  // --- 2. AFK LOGIC ---
  if (afkUsers[userId]) {
    const timeAway = Date.now() - afkUsers[userId].time;
    const reasonText = afkUsers[userId].reason ? `(Reason: ${afkUsers[userId].reason})` : "";
    delete afkUsers[userId];
    saveAFK();
    return message.reply(`dei comeback ah 😏 **${formatTime(timeAway)}** wait panna vachitiye mamba! ${reasonText}`);
  }

  const afkMatch = content.match(/^(kadala|kadalai) afk\s*(.*)/i);
  if (afkMatch) {
    const reason = afkMatch[2].trim() || "Therila da, ethuko poirukan!";
    afkUsers[userId] = { time: Date.now(), reason: reason };
    saveAFK();
    return message.reply(`seri da AFK 😴 **Reason:** ${reason} | safe ah poitu vaa mamba!`);
  }

  // --- 3. VOICE CHANNEL COMMANDS ---
  if (/^(kadala|kadalai)\s+(vc join|join vc)/i.test(content)) {
    const vc = message.member.voice.channel;
    if (!vc) return message.reply("Bro, you need to join a Voice Channel first! 😭");
    try {
      joinVoiceChannel({ 
          channelId: vc.id, 
          guildId: vc.guild.id, 
          adapterCreator: vc.guild.voiceAdapterCreator, 
          selfDeaf: false, 
          selfMute: false 
      });
      return message.reply("Joined the VC, bro! 😎");
    } catch (e) {
      spitLog("VC JOIN FAILED", e);
      return message.reply("Bro, I couldn't join the VC. Check the logs! 💀");
    }
  }

  if (/^(kadala|kadalai)\s+(vc leave|leave vc)/i.test(content)) {
    const conn = getVoiceConnection(message.guild.id);
    if (!conn) return message.reply("I'm not even in a VC, bro! 💀");
    conn.destroy();
    return message.reply("Left the VC! 🚶‍♂️");
  }

  // --- 4. AI CHAT LOGIC ---
  const isReplyToBot = message.reference && message.mentions.repliedUser?.id === client.user.id;
  const aiPrefixMatch = message.content.match(/^(kadala|kadalai)\s+(?!afk|vc join|join vc|vc leave|leave vc|debug)(.*)/i);

  if (aiPrefixMatch || isReplyToBot) {
    let userPrompt = aiPrefixMatch ? aiPrefixMatch[2].trim() : message.content;
    if (!userPrompt) return message.reply("Bro, why are you sending a blank message? Ask something! 💀");

    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      if (rl.reason === 'cooldown') {
        const secs = Math.ceil(rl.timeLeft / 1000);
        return message.reply(`Bro, chill for a sec! 🛑 Wait **${secs} seconds** before you talk to me again.`);
      } else if (rl.reason === 'timeout') {
        const mins = Math.ceil(rl.timeLeft / 60000);
        return message.reply(`You hit the 5-message limit, bro! 💀 To save API quota, you're in timeout for **${mins} minutes**.`);
      }
    }

    await message.channel.sendTyping();

    // AUTO-FAILOVER LOGIC
    const totalKeys = getAvailableKeys().length;
    let attempts = 0;
    let success = false;
    let finalResponseText = "";

    const fetchedMessages = await message.channel.messages.fetch({ limit: 6 });
    let historyText = "--- RECENT CHAT HISTORY ---\n";
    fetchedMessages.reverse().forEach(msg => {
      if (msg.content) {
        const authorName = msg.author.id === client.user.id ? "Kadala Watchman" : msg.author.username;
        historyText += `${authorName}: ${msg.content}\n`;
      }
    });
    historyText += "--- END HISTORY ---\n\n";
    const finalPrompt = `${historyText}Now, reply to ${message.author.username}'s latest message.`;

    while (attempts < totalKeys && !success) {
      try {
        const chatModel = getNextChatModel(); 
        if (!chatModel) return message.reply("Admin, you haven't added `API_KEY_1` to Railway properly! 😭");

        const result = await chatModel.generateContent(finalPrompt);
        finalResponseText = result.response.text();
        success = true; 
      } catch (e) {
        if (e.status === 429 || (e.message && e.message.includes('429'))) {
          console.log(`[AI Error] Slot ${currentKeyIndex + 1} is out of limit. Auto-switching to next slot...`);
          attempts++;
        } else {
          spitLog("AI GENERATION ERROR", e);
          return message.reply("AI is a bit confused right now. Check the crash log! 😵‍💫");
        }
      }
    }

    if (!success) {
      return message.reply("Bro, all the API keys are completely exhausted! 💀 SAAVU SETHA PAYALE PING @ruwaidcool for fix if it still happens :lol:");
    }

    return message.reply(finalResponseText.length > 2000 ? finalResponseText.substring(0, 1990) + "..." : finalResponseText);
  }
});

client.login(process.env.TOKEN);
