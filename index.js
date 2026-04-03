const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates // 🔥 for VC
  ]
});

const cooldown = new Map();
const processedMessages = new Set();

// ================= AFK =================
const FILE = './afk.json';
let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};

function saveAFK() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

// ⏱️ FORMAT TIME
function formatTime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return `${hr}h ${min}m ${sec}s`;
}

// ================= FUN FACT LOOP =================
async function sendFunFact() {
  try {
    const res = await axios.get("https://uselessfacts.jsph.pl/random.json?language=en");
    const fact = res.data.text;

    const guilds = client.guilds.cache;

    guilds.forEach(guild => {
      const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
      if (channel) {
        channel.send(`🧠 Fun Fact: ${fact}`);
      }
    });

  } catch (err) {
    console.log("Fun fact error");
  }
}

// every 30 mins
setInterval(sendFunFact, 30 * 60 * 1000);

// ================= READY =================
client.once('clientReady', () => {
  console.log("Verkadala running 🔥");
});

// ================= MESSAGE =================
client.on('messageCreate', async (message) => {
  try {
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 10000);

    if (message.author.bot) return;
    if (!message.content) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

    // ================= AFK REMOVE =================
    if (afkUsers[userId]) {
      const timeAway = Date.now() - afkUsers[userId].time;
      delete afkUsers[userId];
      saveAFK();
      return message.reply(`dei comeback ah 😏 ${formatTime(timeAway)} ah poita`);
    }

    // ================= AFK SET =================
    if (/^(kadala|kadalai) afk/i.test(content)) {
      afkUsers[userId] = { time: Date.now() };
      saveAFK();
      return message.reply("seri da AFK 😴 poi thirumbi vaa");
    }

    // ================= AFK MENTION =================
    message.mentions.users.forEach(user => {
      if (afkUsers[user.id]) {
        const timeAway = Date.now() - afkUsers[user.id].time;
        message.reply(`${user.username} AFK 😴 (${formatTime(timeAway)}) disturb pannadha`);
      }
    });

    // ================= VC JOIN =================
    if (content === "kadala vc join") {
      const vc = message.member.voice.channel;
      if (!vc) return message.reply("dei first VC la po da 😭");

      const { joinVoiceChannel } = require('@discordjs/voice');

      joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
      });

      return message.reply("vanthuruken da chumma 😎🎧");
    }

    // ================= AI TRIGGER =================
    const isKadala = /^(kadala|kadalai)\b/i.test(content);
    if (!isKadala) return;

    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 2500) {
      return message.reply("dei konjam gap kududa 😭");
    }

    cooldown.set(userId, now);

    let prompt = message.content.replace(/^(kadala|kadalai)/i, "").trim();
    if (!prompt) return message.reply("enna da solla pora 😭");

    const tempMsg = await message.reply("oru nimisham...");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "meta-llama/llama-3-8b-instruct",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
          }
        }
      );

      const reply = res.data.choices[0].message.content;
      await tempMsg.edit(reply);

    } catch {
      await tempMsg.edit("dei glitch da 😭");
    }

  } catch (err) {
    console.error(err);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
