const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Kadala Watchman is Online with UI Color Roles! 🔑🔥"));
app.listen(process.env.PORT || 3000);

// ================= AI SETUP =================
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
  const genAI = new GoogleGenerativeAI(keyToUse);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
}

// ================= CLIENT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ================= THE BLACK BOX LOGGER 🕵️‍♂️ =================
const logFile = './kadala-crash.log';
function spitLog(title, error) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const errorDetails = error?.stack || error?.message || JSON.stringify(error) || "Unknown Error";
  const formattedLog = `\n=========================================\n🚨 [CRASH REPORT - ${timestamp}]\n⚠️ TYPE: ${title}\n-----------------------------------------\n${errorDetails}\n=========================================\n`;
  console.error(formattedLog);
  try { fs.appendFileSync(logFile, formattedLog); } catch (e) {}
}

process.on('unhandledRejection', (reason) => spitLog('UNHANDLED PROMISE REJECTION', reason));
process.on('uncaughtException', (err) => spitLog('FATAL UNCAUGHT EXCEPTION', err));
client.on('error', (err) => spitLog('DISCORD CLIENT ERROR', err));

// ================= DATABASES (AFK & STATS) =================
const FILE = './afk.json';
const STATS_FILE = './afkStats.json'; 

let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
let afkStats = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE)) : {};

const saveAFK = () => fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
const saveStats = () => fs.writeFileSync(STATS_FILE, JSON.stringify(afkStats, null, 2));

const formatTime = (ms) => {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return hr > 0 ? `${hr}h ${min}m ${sec}s` : `${min}m ${sec}s`;
};

// ================= RATE LIMITER =================
const aiUsage = {}; 
function checkRateLimit(userId) {
  const now = Date.now();
  if (!aiUsage[userId]) aiUsage[userId] = { history: [], blockedUntil: 0 };
  const user = aiUsage[userId];

  if (user.blockedUntil > now) return { allowed: false, reason: 'timeout', timeLeft: user.blockedUntil - now };
  user.history = user.history.filter(t => now - t < 10 * 60 * 1000);
  if (user.history.length > 0 && (now - user.history[user.history.length - 1] < 10000)) {
    return { allowed: false, reason: 'cooldown', timeLeft: 10000 - (now - user.history[user.history.length - 1]) };
  }
  if (user.history.length >= 5) {
    user.blockedUntil = now + 10 * 60 * 1000; 
    return { allowed: false, reason: 'timeout', timeLeft: 10 * 60 * 1000 };
  }
  user.history.push(now);
  return { allowed: true };
}

// ================= COUNTING GAME VARIABLES =================
let currentCount = 0;
let lastCounterId = null;

// ================= COLOR ROLES CONFIG =================
const COLORS = {
  'color_red': { name: 'Blood Red', hex: '#FF0000', label: 'Red 🔥', style: ButtonStyle.Danger },
  'color_blue': { name: 'Ocean Blue', hex: '#0000FF', label: 'Blue 🌊', style: ButtonStyle.Primary },
  'color_green': { name: 'Toxic Green', hex: '#00FF00', label: 'Green 🌿', style: ButtonStyle.Success },
  'color_yellow': { name: 'Cyber Yellow', hex: '#FFD700', label: 'Yellow ⚡', style: ButtonStyle.Secondary },
  'color_purple': { name: 'Neon Purple', hex: '#8A2BE2', label: 'Purple 👾', style: ButtonStyle.Secondary }
};

// ================= EVENTS =================
client.once('ready', () => {
  console.log(`Verkadala is Fully Operational 🔥 | Loaded ${getAvailableKeys().length} API Keys.`);
  client.user.setPresence({ activities: [{ name: `Server Chat 👀`, type: ActivityType.Watching }], status: "online" });
});

// ================= BUTTON INTERACTION HANDLER (COLOR ROLES) =================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('color_')) {
    await interaction.deferReply({ ephemeral: true }); // Makes the reply only visible to the user who clicked

    const colorData = COLORS[interaction.customId];
    if (!colorData) return interaction.editReply("Dei mamba, ennamo thappu nadanthuruku!");

    const guild = interaction.guild;
    const member = interaction.member;

    try {
      // 1. Remove old colors (so they don't mix and mess up the profile)
      const colorRoleNames = Object.values(COLORS).map(c => c.name);
      const rolesToRemove = member.roles.cache.filter(r => colorRoleNames.includes(r.name));
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
      }

      // 2. Find the role, or create it if it doesn't exist yet!
      let role = guild.roles.cache.find(r => r.name === colorData.name);
      if (!role) {
        role = await guild.roles.create({
          name: colorData.name,
          color: colorData.hex,
          reason: 'Kadala Color Panel Request',
        });
      }

      // 3. Assign the new color role
      await member.roles.add(role);

      // 4. Send the DM! 😎
      try {
        await interaction.user.send("Done! mapla 🤝 Un profile ippo pakka mass ah irukum po!");
      } catch (dmErr) {
        // Just in case their DMs are locked
        console.log(`Couldn't DM ${interaction.user.username}, DMs are closed.`);
      }

      return interaction.editReply(`Unakku **${colorData.label}** assign panniyachu blood! 🔥 Check un peru!`);

    } catch (err) {
      spitLog("ROLE ASSIGN ERROR", err);
      return interaction.editReply("Dei admin mamba! Enaku `Manage Roles` permission kudu, illana en bot role-ah Server Settings la mela thooki podu! Ennala role assign panna mudila 😭");
    }
  }
});

// ================= MAIN MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // --- 1. NEW: THE COLOR PANEL UI 🎨 ---
  if (/^(kadala|kadalai)\s+colourpanel/i.test(content)) {
    const row = new ActionRowBuilder();

    // Dynamically build buttons from our config
    for (const [id, data] of Object.entries(COLORS)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(id)
          .setLabel(data.label)
          .setStyle(data.style)
      );
    }

    return message.channel.send({ 
      content: "🎨 **KADALA COLOR PANEL** 🎨\nDei mapla, unakku pudicha color-ah select pannu! Un Peru and Profile color apdiye maarum:", 
      components: [row] 
    });
  }

  // --- 2. THE COUNTING GAME 🔢 ---
  if (message.channel.name.includes('counting') || message.channel.name.includes('count')) {
    if (/^\d+$/.test(content)) { 
      const parsedNum = parseInt(content);
      if (userId === lastCounterId) {
        currentCount = 0; lastCounterId = null; message.react('❌');
        return message.reply(`Dei gubeer! Oruvane thodarndhu 2 thadava count panna koodathu! 💀 \n**Game Reset to 0!** Start from 1 da pangu.`);
      } else if (parsedNum !== currentCount + 1) {
        const expected = currentCount + 1;
        currentCount = 0; lastCounterId = null; message.react('❌');
        return message.reply(`Dei mamba, math theriyaatha da unaku? The next number was **${expected}**! 💀 \n**Game Reset to 0!** Start from 1.`);
      } else {
        currentCount = parsedNum; lastCounterId = userId; message.react('✅');
        if (currentCount === 50) { message.react('🥉'); message.channel.send(`🎉 Yovv! **50 reached!** 🥉 Bronze tier unlocked da pasangala!`); } 
        else if (currentCount === 100) { message.react('🥇'); message.channel.send(`🔥 THALAIVAA! **100 CENTURY!** 🥇 Gold tier reached! Pakka clutch!`); } 
        else if (currentCount === 150) { message.react('💎'); message.channel.send(`💎 VERA LEVEL MAMBA! **150 reached!** Diamond bloods! Enna speed uh!`); }
        return; 
      }
    }
  }

  // --- 3. THE AFK PING DEFENDER 🛡️ ---
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers[user.id]) {
        const reason = afkUsers[user.id].reason || "Therila da, ethuko poirukan!";
        const timeAway = Date.now() - afkUsers[user.id].time;
        message.reply(`Dei mamba, **${user.username}** ippo AFK la irukkan! 😴\n**Reason:** ${reason}\n*(Avan poyi ${formatTime(timeAway)} aaguthu, avan varumbothu thaan reply pannuvan. Wait pannu!)*`);
      }
    });
  }

  // --- 4. CREDITS COMMAND ---
  if (/^(kadala|kadalai)\s+(credits|who made you|creator)/i.test(content)) {
    return message.reply("😎 Naan oru masterpiece da!\n\n👑 **Created by:** `@ruwaid`\n🔥 **Hardware MVP:** `@hislaptop` (Paavam antha machine)\n🧠 **AI Partner:** `@Gemini`");
  }

  // --- 5. THE BUNKER (Can I Bunk?) ---
  const bunkMatch = content.match(/^(kadala|kadalai)\s+bunk\s+(\d+)\s+(\d+)/i);
  if (bunkMatch) {
    const totalClasses = parseInt(bunkMatch[2]);
    const attendedClasses = parseInt(bunkMatch[3]);
    if (attendedClasses > totalClasses) return message.reply("Dei gubeer! Total classes vida nee eppadi da adhigama attend panna mudiyum? 💀 Check the numbers.");
    const percentage = (attendedClasses / totalClasses) * 100;
    let replyText = `📊 **Bunk Math:** Un percentage ippo **${percentage.toFixed(2)}%**.\n\n`;
    if (percentage >= 75) {
      const bunksAllowed = Math.floor((attendedClasses / 0.75) - totalClasses);
      if (bunksAllowed > 0) replyText += `😎 Thalaivaa! Nee safe zone la irukka. Innum **${bunksAllowed} classes** thairiyama bunk adikkalam!`;
      else replyText += `⚠️ Border la thongitu irukka mamba! Inimey bunk adicha maattikuva. College ku kelaambu!`;
    } else {
      const needed = Math.ceil(((0.75 * totalClasses) - attendedClasses) / 0.25);
      replyText += `💀 Danger Zone da mamba! 75% thoda innum **${needed} classes** continuously poganum. Padi!`;
    }
    return message.reply(replyText);
  }

  // --- 6. AFK LEADERBOARD ---
  if (/^(kadala|kadalai)\s+(afk leaderboard|leaderboard)/i.test(content)) {
    const sortedStats = Object.entries(afkStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedStats.length === 0) return message.reply("Innum evanum AFK pogala da mamba! Server active ah thaan iruku. 💀");
    let lbString = "🏆 **THOONGU MOONJI LEADERBOARD (Top 5 AFKers)** 🏆\n\n";
    for (let i = 0; i < sortedStats.length; i++) {
      try {
        const userObj = await client.users.fetch(sortedStats[i][0]);
        lbString += `**${i + 1}. ${userObj.username}** ➔ ⏱️ ${formatTime(sortedStats[i][1])}\n`;
      } catch (e) {
        lbString += `**${i + 1}. Unknown Mamba** ➔ ⏱️ ${formatTime(sortedStats[i][1])}\n`;
      }
    }
    return message.reply(lbString);
  }

  // --- 7. AFK LOGIC (Set & Return) ---
  if (afkUsers[userId]) {
    const timeAway = Date.now() - afkUsers[userId].time;
    const reasonText = afkUsers[userId].reason ? `(Reason: ${afkUsers[userId].reason})` : "";
    delete afkUsers[userId];
    saveAFK();
    afkStats[userId] = (afkStats[userId] || 0) + timeAway;
    saveStats();
    return message.reply(`dei comeback ah 😏 **${formatTime(timeAway)}** wait panna vachitiye mamba! ${reasonText}`);
  }

  const afkMatch = content.match(/^(kadala|kadalai) afk\s*(.*)/i);
  if (afkMatch) {
    const reason = afkMatch[2].trim() || "Therila da, ethuko poirukan!";
    afkUsers[userId] = { time: Date.now(), reason: reason };
    saveAFK();
    return message.reply(`seri da AFK 😴 **Reason:** ${reason} | safe ah poitu vaa mamba!`);
  }

  // --- 8. VC JOIN / LEAVE ---
  if (/^(kadala|kadalai)\s+(vc join|join vc)/i.test(content)) {
    const vc = message.member.voice.channel;
    if (!vc) return message.reply("Bro, you need to join a Voice Channel first! 😭");
    joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
    return message.reply("Joined the VC, bro! 😎");
  }

  if (/^(kadala|kadalai)\s+(vc leave|leave vc)/i.test(content)) {
    const conn = getVoiceConnection(message.guild.id);
    if (!conn) return message.reply("I'm not even in a VC, bro! 💀");
    conn.destroy();
    return message.reply("Left the VC! 🚶‍♂️");
  }

  // --- 9. AI CHAT LOGIC ---
  const isReplyToBot = message.reference && message.mentions.repliedUser?.id === client.user.id;
  const aiPrefixMatch = message.content.match(/^(kadala|kadalai)\s+(?!afk|vc join|join vc|vc leave|leave vc|bunk|leaderboard|debug|credits|colourpanel)(.*)/i);

  if (aiPrefixMatch || isReplyToBot) {
    let userPrompt = aiPrefixMatch ? aiPrefixMatch[2].trim() : message.content;
    if (!userPrompt) return message.reply("Bro, why are you sending a blank message? Ask something! 💀");

    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      if (rl.reason === 'cooldown') return message.reply(`Bro, chill for a sec! 🛑 Wait **${Math.ceil(rl.timeLeft / 1000)} seconds** before you talk to me again.`);
      if (rl.reason === 'timeout') return message.reply(`You hit the 5-message limit, bro! 💀 You're in timeout for **${Math.ceil(rl.timeLeft / 60000)} minutes**.`);
    }

    await message.channel.sendTyping();

    const totalKeys = getAvailableKeys().length;
    let attempts = 0, success = false, finalResponseText = "";

    const fetchedMessages = await message.channel.messages.fetch({ limit: 6 });
    let historyText = "--- RECENT CHAT HISTORY ---\n";
    fetchedMessages.reverse().forEach(msg => {
      if (msg.content) historyText += `${msg.author.id === client.user.id ? "Kadala Watchman" : msg.author.username}: ${msg.content}\n`;
    });
    const finalPrompt = `${historyText}\nNow, reply to ${message.author.username}'s latest message.`;

    while (attempts < totalKeys && !success) {
      try {
        const chatModel = getNextChatModel(); 
        if (!chatModel) return message.reply("Admin, no API keys found in Railway variables! 😭");
        const result = await chatModel.generateContent(finalPrompt);
        finalResponseText = result.response.text();
        success = true; 
      } catch (e) {
        if (e.status === 429 || (e.message && e.message.includes('429'))) attempts++;
        else { spitLog("AI ERROR", e); return message.reply("AI is confused right now! 😵‍💫"); }
      }
    }

    if (!success) return message.reply("Bro, all the API keys are exhausted! 💀 They reset tomorrow.");
    return message.reply(finalResponseText.length > 2000 ? finalResponseText.substring(0, 1990) + "..." : finalResponseText);
  }
});

client.login(process.env.TOKEN);
