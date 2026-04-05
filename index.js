const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Kadala Watchman is Online, Chatting, and Rotating Keys! 🔑🔥"));
app.listen(process.env.PORT || 3000);

// ================= AI SETUP (BULLETPROOF ROTATION) =================
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
  // Pulls keys fresh and filters out completely empty or undefined ones
  return [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3
  ].filter(key => key !== undefined && key.trim() !== '');
}

function getNextChatModel() {
  const geminiKeys = getAvailableKeys();
  
  if (geminiKeys.length === 0) {
    console.error("No GEMINI_KEYs found in Railway Variables! 💀");
    return null;
  }
  
  // Strict rotation logic
  currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length; 
  const keyToUse = geminiKeys[currentKeyIndex];
  
  console.log(`[AI Status] Total Keys: ${geminiKeys.length} | Currently Using Slot: ${currentKeyIndex + 1}`);
  
  const genAI = new GoogleGenerativeAI(keyToUse);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
}

// ================= CLIENT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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

// 🛑 Rate Limiter System for AI
const aiUsage = {}; 

function checkRateLimit(userId) {
  const now = Date.now();
  if (!aiUsage[userId]) aiUsage[userId] = { history: [], blockedUntil: 0 };
  const user = aiUsage[userId];

  // 1. Check if user is in 10-min timeout jail
  if (user.blockedUntil > now) {
    return { allowed: false, reason: 'timeout', timeLeft: user.blockedUntil - now };
  }

  // Clear old history (older than 10 mins)
  user.history = user.history.filter(t => now - t < 10 * 60 * 1000);

  if (user.history.length > 0) {
    const lastTime = user.history[user.history.length - 1];
    // 2. Check 10-second cooldown
    if (now - lastTime < 10000) {
      return { allowed: false, reason: 'cooldown', timeLeft: 10000 - (now - lastTime) };
    }
  }

  // 3. Check 5 messages limit
  if (user.history.length >= 5) {
    user.blockedUntil = now + 10 * 60 * 1000; // Block for 10 mins
    return { allowed: false, reason: 'timeout', timeLeft: 10 * 60 * 1000 };
  }

  user.history.push(now);
  return { allowed: true };
}

// ================= FUN FACTS =================
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

  // 1. AFK Logic (Comeback)
  if (afkUsers[userId]) {
    const timeAway = Date.now() - afkUsers[userId].time;
    const reasonText = afkUsers[userId].reason ? `(Reason: ${afkUsers[userId].reason})` : "";
    delete afkUsers[userId];
    saveAFK();
    return message.reply(`dei comeback ah 😏 **${formatTime(timeAway)}** wait panna vachitiye mamba! ${reasonText}`);
  }

  // 2. Set AFK (With Reason)
  const afkMatch = content.match(/^(kadala|kadalai) afk\s*(.*)/i);
  if (afkMatch) {
    const reason = afkMatch[2].trim() || "Therila da, ethuko poirukan!";
    afkUsers[userId] = { time: Date.now(), reason: reason };
    saveAFK();
    return message.reply(`seri da AFK 😴 **Reason:** ${reason} | safe ah poitu vaa mamba!`);
  }

  // ================= AI CHAT LOGIC =================
  const isReplyToBot = message.reference && message.mentions.repliedUser?.id === client.user.id;
  // Simplified regex since music commands are gone
  const aiPrefixMatch = message.content.match(/^(kadala|kadalai)\s+(?!afk)(.*)/i);

  if (aiPrefixMatch || isReplyToBot) {
    let userPrompt = aiPrefixMatch ? aiPrefixMatch[2].trim() : message.content;
    if (!userPrompt) return message.reply("Enna pangu, blank ah message anupura? Ethachum kelu! 💀");

    // 🛑 RATE LIMITER 🛑
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      if (rl.reason === 'cooldown') {
        const secs = Math.ceil(rl.timeLeft / 1000);
        return message.reply(`Dei mamba, moochu vaanga time kudu da! 🛑 Wait for **${secs} seconds** before you talk to me again.`);
      } else if (rl.reason === 'timeout') {
        const mins = Math.ceil(rl.timeLeft / 60000);
        return message.reply(`Dei 5 times mela pesi over-ah usura vangita! 💀 API limit save pannanum. Nee oru **${mins} minutes** jail la iru (AI chat mattum). Adhuku apram vaa!`);
      }
    }

    await message.channel.sendTyping();

    try {
      const chatModel = getNextChatModel(); 
      if (!chatModel) return message.reply("Admin mamba, API keys add panave illa pola! Check the Railway Variables da! 😭");

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

      const result = await chatModel.generateContent(finalPrompt);
      let text = result.response.text();
      return message.reply(text.length > 2000 ? text.substring(0, 1990) + "..." : text);
    } catch (e) {
      console.error(e);
      return message.reply("AI konjam confuse aayiduchu blood (Oruvela indha key um limit aayiduchoo?). Konja neram kazhuithu vaa! 😵‍💫");
    }
  }
});

client.login(process.env.TOKEN);
