const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const { OpenAI } = require("openai"); 
const { Player } = require('discord-player');
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Kadala Watchman is Online, Vibing, Cooking, and Painting! 🎨🔥"));
app.listen(process.env.PORT || 3000);

// ================= AI SETUP (Gemini Chat & OpenAI Images) =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const systemInstruction = `
You are 'Kadala Watchman', a peak GenZ Tamil guy in a Discord server.
- Language: Strictly Tanglish (Mix of Tamil and English).
- Style: Use GenZ slang like 'vibe', 'scene-u', 'mamba', 'lit', 'clutch', 'gubeer', 'pangu', 'maams', 'blood', 'share-u'.
- Tone: Be funny, sarcastic (nakkaal), and friendly.
- Address user as: 'da', 'mamba', 'pangu', or 'pulla'.
- Context awareness: You will be provided with the recent chat history. Use it to understand the flow, but only reply to the latest message.
- Rules: Keep it short (1-3 sentences max). Don't be robotic. Use emojis like 💀, 🔥, 😂, 🫡.
`;
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ================= CLIENT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= MUSIC PLAYER SETUP =================
const player = new Player(client);

// THE FIX: Properly load default extractors for version 6
player.extractors.loadDefault().then(() => {
  console.log("Music Extractors loaded successfully! 🎧");
}).catch(err => console.error("Error loading extractors:", err));

player.events.on('playerStart', (queue, track) => {
  queue.metadata.channel.send(`🎧 Ippo idhaan trend-u! Playing: **${track.title}** 🔥 Vibe panlaam mamba!`);
});

player.events.on('emptyQueue', (queue) => {
  queue.metadata.channel.send(`Pattu mudinjichu pangu. Vera ethaachum play pannu, illana na kelamburen! 🚶`);
});

// ================= UTILITIES & AFK =================
const processedMessages = new Set();
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
const funFacts = ["Octopus has 3 hearts", "Honey never spoils", "Bananas are berries", "Sharks older than trees", "Space smells like metal", "Butterflies taste with feet", "Cows have best friends", "Penguins propose with pebbles", "Sun is white actually", "Your brain uses 20% energy", "Hot water freezes faster", "Sloths hold breath longer than dolphins", "Wombat poop is cube shaped", "Humans glow in dark (low level)", "Ants don't sleep", "Koalas have fingerprints", "Jellyfish are immortal (some)", "Venus spins backwards", "Tardigrades survive space", "Snakes can glide", "Octopus escapes jars easily", "Frogs drink through skin", "Cats sleep 70% of life", "Dolphins have names", "Trees can communicate", "Sharks detect electricity", "Babies have more bones", "Fire has no shadow", "Clouds are heavy", "Birds don’t urinate", "Spiders have blue blood", "Earth not perfect sphere", "Metals explode in water", "Sound faster in water", "Nose detects trillion smells", "Moon moving away slowly", "Neptune has fastest winds", "Gold is edible", "Turtles breathe through butt", "Sea otters hold hands", "Glass is slow liquid", "Lightning hotter than sun", "Human DNA 50% banana", "Fish change gender", "Chickens remember faces", "Space is silent", "Stomach gets new lining", "Brain feels no pain", "Rats laugh", "Plants love music", "Water expands when freezing", "Crabs use tools", "Sharks never stop swimming", "Frogs freeze and live", "Earth rotates slower", "Whales sing songs", "Eyes heal fast", "Birds mimic humans", "Ants farm fungi", "Fish walk on land", "Rain smell is Petrichor", "Snakes see heat", "Butterflies remember being caterpillars", "Sun will die", "Bacteria eat radiation", "Owls rotate head 270°", "Lizards run on water", "Magnetic poles shift", "Bees dance", "Some frogs glow", "Animals see UV", "Elephants mourn", "Birds sleep mid-flight", "Spiders fly using silk", "Body has electricity", "Stars twinkle", "Insects live without head", "Time moves slower near gravity", "Black holes bend time", "Fish glow", "Unique tongue prints", "Birds steal food", "Volcano lightning exists", "Some animals never age", "Worms regenerate", "Fish freeze and survive", "Animals fake death", "Invisible in water", "Moon causes tides", "Clouds glow at night", "Polarized light vision", "Navigate via stars", "Plants eat insects", "Bacteria survive vacuum", "Insects hear with legs", "Regrow limbs", "Live without brain", "Wombats poop cubes", "Sloths digest in 2 weeks", "Venus day > year"];

// ================= EVENTS =================
client.once('ready', () => {
  console.log("Verkadala is Fully Operational 🔥");
  
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

// ================= MAIN MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
  if (processedMessages.has(message.id) || message.author.bot) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 5000);

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // 1. AFK Logic
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

  // 2. Simple VC Commands
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

  // ================= 🎨 IMAGE GENERATION COMMAND =================
  if (content.startsWith("kadala imagine ") || content.startsWith("kadalai imagine ")) {
    const prompt = message.content.replace(/^(kadala|kadalai) imagine /i, '').trim();
    if (!prompt) return message.reply("Enna imagine பண்ணனும் nu clear ah sollu da pangu! 🧐");

    await message.channel.sendTyping();
    message.reply(`Hold tightly share-u! Naa peak artist mathiri peak scene-u generate panitu iruken... 🎨✍️ This will take around 30 seconds!`);

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        style: "vivid" 
      });

      const imageUrl = response.data[0].url;
      return message.reply({ content: `Here is your peak creation mamba! 🫡🔥\n**Prompt:** ${prompt}`, files: [imageUrl] });
    } catch (e) {
      console.error(e);
      if (e.status === 400 && e.error?.code === 'content_policy_violation') {
        return message.reply(`Dei mamba, intha prompt nalla illai da. Intha logic ah OpenAI accept pannathu! Safe prompt try pannu. 💀❌`);
      }
      return message.reply(`Image server down pola blood. Naa appuram peak painting try panren! 😵‍💫`);
    }
  }

  // ================= DJ COMMANDS =================
  const isDJCommand = /^(kadala|kadalai) (play|skip|stop|queue|pause|resume)/i.test(content);
  
  if (isDJCommand) {
    const args = content.split(' ');
    const command = args[1]; 
    const query = message.content.split(' ').slice(2).join(' '); 
    const queue = player.nodes.get(message.guild.id);
    const channel = message.member.voice.channel;

    switch (command) {
      case 'play':
        if (!query) return message.reply("Enna paatu venum nu sollu da pangu! 🎵");
        if (!channel) return message.reply("VC la poi okkaru first-u! Appo thaan paatu poduvean 😭");
        
        await message.channel.send(`Told you I'm a DJ! Theditu iruken wait pannu... 🔍`);
        try {
          await player.play(channel, query, {
            nodeOptions: { metadata: message, leaveOnEmpty: true, leaveOnEnd: false }
          });
        } catch (e) {
          console.error(e);
          return message.reply("Paatu kedaikala da mamba! Spelling ah check pannu illa vera paatu kelu. 💀");
        }
        break;

      case 'skip':
        if (!queue || !queue.isPlaying()) return message.reply("Etha da skip panrathu? Paatayum kaanom onnayum kaanom! 💀");
        queue.node.skip();
        return message.reply("Intha paatu vibe aagala pola, OP Skip done! ⏭️");

      case 'stop':
        if (!queue) return message.reply("Naanga already amaithiya thaan irukom! 🤫");
        queue.delete();
        return message.reply("Paatu off panniyachu, naa appidiye kelamburen! 🚶");

      case 'pause':
        if (!queue || !queue.isPlaying()) return message.reply("Onnume odalaye da! 💀");
        queue.node.setPaused(true);
        return message.reply("Paatu konja neram pause la irukattum ⏸️");

      case 'resume':
        if (!queue || queue.isPlaying()) return message.reply("Already oditu thaan da iruku! 🎶");
        queue.node.setPaused(false);
        return message.reply("Vibe thirumba start aagiduchu! ▶️");

      case 'queue':
        if (!queue || !queue.isPlaying()) return message.reply("Queue kaaliya iruku da mamba! Kadala play potu vibe etthu! 💿");
        
        const currentTrack = queue.currentTrack;
        const tracks = queue.tracks.toArray().slice(0, 5); 
        
        let queueString = `**🎧 Ippo Oduthu:** ${currentTrack.title}\n\n**Up Next-u:**\n`;
        if (tracks.length === 0) queueString += "Avlo thaan, queue la vera paatu illai! ❌";
        else {
          tracks.forEach((track, index) => {
            queueString += `**${index + 1}.** ${track.title}\n`;
          });
        }
        return message.reply(queueString);
    }
    return;
  }

  // 4. AI CHAT LOGIC
  const isReplyToBot = message.reference && message.mentions.repliedUser?.id === client.user.id;
  const aiPrefixMatch = message.content.match(/^(kadala|kadalai)\s+(?!afk|play|skip|stop|queue|pause|resume|vc|imagine)(.*)/i);

  if (aiPrefixMatch || isReplyToBot) {
    await message.channel.sendTyping();
    let userPrompt = aiPrefixMatch ? aiPrefixMatch[2].trim() : message.content;
    if (!userPrompt) return message.reply("Enna pangu, blank ah message anupura? Ethachum kelu! 💀");

    try {
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
      return message.reply("AI konjam confuse aayiduchu blood. Konja neram kazhuithu vaa! 😵‍💫");
    }
  }
});

client.login(process.env.TOKEN);
