const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

// AFK SYSTEM
const FILE = './afk.json';
let afkUsers = {};

if (fs.existsSync(FILE)) {
  afkUsers = JSON.parse(fs.readFileSync(FILE));
}

function saveAFK() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

// 🔥 LANGUAGE DETECT
function isTamil(text) {
  return /[\u0B80-\u0BFF]/.test(text);
}

// 🔥 MODELS (fallback)
const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "google/gemma-7b-it"
];

client.once('clientReady', () => {
  console.log("Verkadala is running");
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

    // ================= AFK REMOVE =================
    if (afkUsers[userId]) {
      const time = Date.now() - afkUsers[userId].time;
      const duration = formatTime(time);

      delete afkUsers[userId];
      saveAFK();

      await message.reply(`${message.author.username} back ah 😏 ${duration} AFK la irundha`);
    }

    // ================= AFK SET =================
    if (content.startsWith("kadala afk")) {
      const reason = message.content.slice(11).trim() || "reason illa";

      afkUsers[userId] = {
        reason,
        time: Date.now()
      };

      saveAFK();
      return message.reply(`seri da AFK 😴\nReason: ${reason}`);
    }

    // ================= AFK MENTION =================
    message.mentions.users.forEach(user => {
      if (afkUsers[user.id]) {
        const data = afkUsers[user.id];
        const duration = formatTime(Date.now() - data.time);

        message.reply(`${user.username} AFK da 😴 ${duration}\nReason: ${data.reason}`);
      }
    });

    // ================= REPLY DETECT =================
    let isReplyToBot = false;

    if (message.reference) {
      try {
        const replied = await message.channel.messages.fetch(message.reference.messageId);
        if (replied.author.id === client.user.id) {
          isReplyToBot = true;
        }
      } catch {}
    }

    // ================= AI TRIGGER =================
    if (!content.startsWith("kadala ai") && !isReplyToBot) return;

    // cooldown
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 2000) {
      return message.reply("dei chill bro 😭 spam pannadha");
    }

    cooldown.set(userId, now);

    let prompt = content.startsWith("kadala ai")
      ? message.content.slice(10).trim()
      : message.content;

    if (!prompt) return message.reply("enna da solla pora 😭");

    const tempMsg = await message.reply("oru nimisham...");

    let finalReply = null;

    const tamil = isTamil(prompt);
    const langHint = tamil ? "User is speaking Tamil" : "User is speaking English";

    for (const model of MODELS) {
      try {
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model,
            messages: [
              {
                role: "user",
                content: `
You are Verkadala, chaotic Gen Z bot.

${langHint}

RULES:
- VERY SHORT (1–2 lines)
- No explanation
- No formal tone
- Meme style replies

IF TAMIL:
- Tanglish only
- Use: dei, da, bro, macha, loosu
- Example: sapten da 😂 nee enna starving ah

IF ENGLISH:
- Gen Z slang
- Use: bro, nah, fr, ain't no way 💀
- Example: bro just spawned 💀 what’s up

Be funny, chaotic, slightly savage.

User: ${prompt}
`
              }
            ],
            max_tokens: 80,
            temperature: 1
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://kadalabot.onrender.com",
              "X-Title": "Verkadala Bot"
            }
          }
        );

        const reply = res.data?.choices?.[0]?.message?.content;

        if (reply) {
          finalReply = reply;
          break;
        }

      } catch {
        console.log("model failed:", model);
      }
    }

    if (!finalReply) {
      await tempMsg.edit("edho glitch da 😭 try later");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
