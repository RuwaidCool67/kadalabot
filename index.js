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

// AFK
const FILE = './afk.json';
let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};

function saveAFK() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

function isTamil(text) {
  return /[\u0B80-\u0BFF]/.test(text);
}

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
      delete afkUsers[userId];
      saveAFK();
      await message.reply("back ah da 😏");
    }

    // ================= AFK SET =================
    if (content.startsWith("kadala afk") || content.startsWith("kadalai afk")) {
      afkUsers[userId] = { time: Date.now() };
      saveAFK();
      return message.reply("seri AFK 😴");
    }

    // ================= AFK MENTION =================
    message.mentions.users.forEach(user => {
      if (afkUsers[user.id]) {
        message.reply(`${user.username} AFK da 😴 apram vaa`);
      }
    });

    // ================= REPLY DETECT =================
    let isReplyToBot = false;
    if (message.reference) {
      try {
        const replied = await message.channel.messages.fetch(message.reference.messageId);
        if (replied.author.id === client.user.id) isReplyToBot = true;
      } catch {}
    }

    // ================= NATURAL TRIGGER =================
    const isKadala =
      content.startsWith("kadala") ||
      content.startsWith("kadalai");

    if (!isKadala && !isReplyToBot) return;

    // ================= COOLDOWN =================
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei chill bro 😭");
    }

    cooldown.set(userId, now);

    let prompt = message.content.replace(/^(kadala|kadalai)/i, "").trim();
    if (!prompt) return message.reply("enna da solla pora 😭");

    // ================= CONTEXT =================
    const messages = await message.channel.messages.fetch({ limit: 5 });

    let context = "";
    messages.reverse().forEach(msg => {
      if (!msg.author.bot) {
        context += `${msg.author.username}: ${msg.content}\n`;
      }
    });

    const tempMsg = await message.reply("oru nimisham...");

    let finalReply = null;

    const tamil = isTamil(prompt);
    const langHint = tamil ? "Tamil" : "English";

    // 🔥 detect coding
    const isCode = /code|script|function|bug|error|js|python|c\+\+|java/i.test(prompt);

    // 🔥 FAST + SMART MODEL ORDER
    let MODELS = [];

    if (isCode || prompt.length > 80) {
      MODELS = [
        "openai/gpt-oss-20b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "meta-llama/llama-3-8b-instruct"
      ];
    } else {
      MODELS = [
        "openai/gpt-oss-20b:free",
        "meta-llama/llama-3-8b-instruct"
      ];
    }

    for (const model of MODELS) {
      try {
        console.log("Trying:", model);

        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model,
            messages: [
              {
                role: "user",
                content: `
You are Verkadala, chaotic Gen Z Discord bot.

Conversation:
${context}

Language: ${langHint}

RULES:
- VERY SHORT (1–2 lines)
- Funny, unhinged
- Context aware
- No formal tone

CODING:
- Give FULL working code
- Wrap in triple backticks
- No explanation

User: ${prompt}
`
              }
            ],
            max_tokens: 200,
            temperature: 1
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            },
            timeout: 5000
          }
        );

        const reply = res.data?.choices?.[0]?.message?.content;

        if (reply) {
          console.log("SUCCESS:", model);
          finalReply = reply;
          break;
        }

      } catch {
        console.log("FAILED:", model);
      }
    }

    if (!finalReply) {
      await tempMsg.edit("edho glitch da 😭");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
