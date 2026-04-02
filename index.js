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

// AFK STORAGE
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

// MODELS
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

      await message.reply(
        `${message.author.username} ${duration} neram AFK la irundhaan, welcome back`
      );
    }

    // ================= AFK SET =================
    if (content.startsWith("kadala afk")) {
      const reason = message.content.slice(11).trim() || "reason illa";

      afkUsers[userId] = {
        reason,
        time: Date.now()
      };

      saveAFK();

      return message.reply(`seri, ippo AFK la iruken\nReason: ${reason}`);
    }

    // ================= AI =================
    if (!content.startsWith("kadala ai")) return;

    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei dei slow down da");
    }

    cooldown.set(userId, now);

    const prompt = message.content.slice(10).trim();
    if (!prompt) return message.reply("enna kekka pora sollu");

    const tempMsg = await message.reply("oru nimisham...");

    let finalReply = null;

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
You are Verkadala, a Tamil Discord bot.

STRICT RULES:
- ONLY Tamil slang (Tanglish)
- No full English replies
- Natural Chennai style
- Funny + slight attitude
- No cringe or broken words

Examples:
User: hi
Reply: dei ippo dhaan online ah?

User: saptiya
Reply: sapten da, nee enna panra ippo?

User: dei
Reply: dei nu koopdura alavukku close ah? 😏

Now reply properly.

User: ${prompt}
`
              }
            ],
            max_tokens: 150,
            temperature: 0.9
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

      } catch (err) {
        console.log("Model failed:", model);
      }
    }

    if (!finalReply) {
      await tempMsg.edit("edho problem iruku, apram try pannu");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
