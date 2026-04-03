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
const processedMessages = new Set(); // 🔥 dedupe fix

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
    // 🔥 PREVENT DUPLICATES
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 10000);

    if (message.author.bot) return;
    if (!message.content) return;
    if (message.system) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

    // ================= AFK REMOVE =================
    if (afkUsers[userId]) {
      delete afkUsers[userId];
      saveAFK();
      await message.reply("dei comeback ah 😏 evlo neram poita");
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
        message.reply(`${user.username} AFK la irukaan da 😴 disturb pannadha`);
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

    // ================= TRIGGER =================
    const isKadala = /^(kadala|kadalai)\b/i.test(content);

    if (!isKadala && !isReplyToBot) return;

    // ================= COOLDOWN =================
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 2500) {
      return message.reply("dei konjam gap kududa 😭 spam pannadha");
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

    // ================= SMART DETECTION =================
    const isCode =
      /write code|give code|make a|create a|fix|bug|error|debug/i.test(prompt) ||
      prompt.includes("```") ||
      (prompt.length > 40 &&
        /function|class|import|def|console\.log|print\(/i.test(prompt));

    const isHeavy = prompt.length > 60;

    // ================= MODEL ROUTING =================
    let MODELS = [];

    if (isCode || isHeavy) {
      MODELS = [
        "openai/gpt-oss-20b:free",
        "meta-llama/llama-3-8b-instruct"
      ];
    } else {
      MODELS = [
        "meta-llama/llama-3-8b-instruct",
        "openai/gpt-oss-20b:free"
      ];
    }

    // ================= AI LOOP =================
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
You are Verkadala.

PERSONALITY:
- Chennai Gen Z paiyan vibe
- Slightly savage but fun
- Talks like real Discord user

LANGUAGE:
- Tamil → Tanglish slang
- English → Gen Z tone

CONTEXT:
${context}

RULES:
- VERY SHORT (1–2 lines)
- Funny, chaotic
- No formal tone
- No AI-like answers

CODING:
- ONLY give code if explicitly asked
- Wrap in triple backticks
- No explanation

User: ${prompt}
`
              }
            ],
            max_tokens: 120,
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

    // ================= FINAL OUTPUT =================
    if (!finalReply) {
      await tempMsg.edit("dei edho glitch da 😭 apram try pannalaam");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
