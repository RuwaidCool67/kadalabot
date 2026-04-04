const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenAI } = require("@google/genai"); 
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Kadala is Online 🔥"));
app.listen(process.env.PORT || 3000);

// ================= AI SETUP (GenZ Tamil Personality) =================
const genAI = new GoogleGenAI(process.env.GEMINI_KEY);
const systemInstruction = `
You are 'Kadala Watchman', a peak GenZ Tamil guy.
- Language: Strictly Tanglish (Mix of Tamil and English).
- Style: Use GenZ slang like 'vibe', 'scene-u', 'mamba', 'lit', 'clutch', 'gubeer', 'pangu', 'maams', 'blood', 'share-u'.
- Tone: Be funny, sarcastic (nakkaal), and friendly.
- Address user as: 'da', 'mamba', 'pangu', or 'pulla'.
- Rules: Keep it short. If they ask something boring, tell them 'Enna mamba scene-u panra?'. Use emojis like 💀, 🔥, 😂, 🫡.
`;

const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash", 
  systemInstruction 
});

// ================= CLIENT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const processedMessages = new Set();

// ================= AFK SYSTEM =================
const FILE = './afk.json';
let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
const saveAFK = () => fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));

const formatTime = (ms) => {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return `${hr}h ${min}m ${sec}s`;
};

// ================= 100 FUN FACTS =================
const funFacts = [
  "Octopus has 3 hearts", "Honey never spoils", "Bananas are berries", "Sharks older than trees",
  "Space smells like metal", "Butterflies taste with feet", "Cows have best friends", "Penguins propose with pebbles",
  "Sun is white actually", "Your brain uses 20% energy", "Hot water freezes faster", "Sloths hold breath longer than dolphins",
  "Wombat poop is cube shaped", "Humans glow in dark (low level)", "Ants don't sleep", "Koalas have fingerprints",
  "Jellyfish are immortal (some)", "Venus spins backwards", "Tardigrades survive space", "Snakes can glide",
  "Octopus escapes jars easily", "Frogs drink through skin", "Cats sleep 70% of life", "Dolphins have names",
  "Trees can communicate", "Sharks detect electricity", "Babies have more bones", "Fire has no shadow",
  "Clouds are heavy", "Birds don’t urinate", "Spiders have blue blood", "Earth not perfect sphere",
  "Metals explode in water", "Sound faster in water", "Nose detects trillion smells", "Moon moving away slowly",
  "Neptune has fastest winds", "Gold is edible", "Turtles breathe through butt", "Sea otters hold hands",
  "Glass is slow liquid", "Lightning hotter than sun", "Human DNA 50% banana", "Fish change gender",
  "Chickens remember faces", "Space is silent", "Stomach gets new lining", "Brain feels no pain",
  "Rats laugh", "Plants love music", "Water expands when freezing", "Crabs use tools",
  "Sharks never stop swimming", "Frogs freeze and live", "Earth rotates slower", "Whales sing songs",
  "Eyes heal fast", "Birds mimic humans", "Ants farm fungi", "Fish walk on land",
  "Rain smell is Petrichor", "Snakes see heat", "Butterflies remember being caterpillars", "Sun will die",
  "Bacteria eat radiation", "Owls rotate head 270°", "Lizards run on water", "Magnetic poles shift",
  "Bees dance", "Some frogs glow", "Animals see UV", "Elephants mourn",
  "Birds sleep mid-flight", "Spiders fly using silk", "Body has electricity", "Stars twinkle",
  "Insects live without head", "Time moves slower near gravity", "Black holes bend time", "Fish glow",
  "Unique tongue prints", "Birds steal food", "Volcano lightning exists", "Some animals never age",
  "Worms regenerate", "Fish freeze and survive", "Animals fake death", "Invisible in water",
  "Moon causes tides", "Clouds glow at night", "Polarized light vision", "Navigate via stars",
  "Plants eat insects", "Bacteria survive vacuum", "Insects hear with legs", "Regrow limbs",
  "Live without brain", "Wombats poop cubes", "Sloths digest in 2 weeks", "Venus day > year"
];

// ================= EVENTS =================
client.once('ready', () => {
  console.log("Verkadala running 🔥");
  
  // Fun Fact Loop (10 mins)
  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      const channel = guild.channels.cache.find(c => c.isTextBased() && c.name.includes('general')) 
        || guild.systemChannel 
        || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages'));
      
      if (channel) {
        const fact = funFacts[Math.floor(Math.random() * funFacts.length)];
        channel.send(`🧠 **Fun Fact:** ${fact}`);
      }
    });
  }, 10 * 60 * 1000);
});

// Stream Presence Logic
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.streaming && newState.channel) {
    if (!getVoiceConnection(newState.guild.id)) {
      joinVoiceChannel({
        channelId: newState.channel.id,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator,
        selfDeaf: false, selfMute: false
      });
    }
    client.user.setPresence({
      activities: [{ name: `${newState.member.user.username} stream paakuren 👀`, type: ActivityType.Watching }],
      status: "online"
    });
  }
});

// Main Message Handler
client.on('messageCreate', async (message) => {
  if (processedMessages.has(message.id) || message.author.bot) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 5000);

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // AFK Logic
  if (afkUsers[userId]) {
    const timeAway = Date.now() - afkUsers[userId].time;
    delete afkUsers[userId];
    saveAFK();
    return message.reply(`dei comeback ah 😏 **${formatTime(timeAway)}** wait panna vachitiye mamba!`);
  }

  if (/^(kadala|kadalai) afk/i.test(content)) {
    afkUsers[userId] = { time: Date.now() };
    saveAFK();
    return message.reply("seri da AFK 😴 safe ah poitu vaa mamba!");
  }

  // AI Command
  if (content.startsWith("kadala ai") || content.startsWith("kadalai ai")) {
    const prompt = message.content.split(' ').slice(2).join(' ');
    if (!prompt) return message.reply("Enna pangu, blank ah message anupura? Ethachum kelu! 💀");

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text();
      return message.reply(text.length > 2000 ? text.substring(0, 1990) + "..." : text);
    } catch (e) {
      return message.reply("AI konjam confuse aayiduchu blood. Konja neram kazhuithu vaa! 😵‍💫");
    }
  }

  // VC Commands
  if (/^(kadala|kadalai) (vc join|join vc)/i.test(content)) {
    const vc = message.member.voice.channel;
    if (!vc) return message.reply("VC la po da first-u! 😭");
    joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
    return message.reply("vanthuruken mamba 😎 vibe panlaam!");
  }

  if (/^(kadala|kadalai) (vc leave|leave vc)/i.test(content)) {
    const conn = getVoiceConnection(message.guild.id);
    if (!conn) return message.reply("already veliya thaan mamba iruken! 💀");
    conn.destroy();
    return message.reply("poiten da 🚶 meet you later share-u!");
  }
});

client.login(process.env.TOKEN);
