const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running...");
});

// DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const FILE = './afk.json';
let afkUsers = {};
if (fs.existsSync(FILE)) {
  afkUsers = JSON.parse(fs.readFileSync(FILE));
}

function saveData() {
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

const cooldown = new Map();

// READY
client.on('clientReady', () => {
  console.log("Verkadala is running");
});

// MAIN
client.on('messageCreate', async (message) => {
  try {
    // 🔥 IMPORTANT: prevent double reply
    if (message.author.bot) return;
    if (!message.content) return;

    const userId = message.author.id;
    const content = message.content.toLowerCase();

    console.log("Message:", message.content);

    // 🟢 AFK REMOVE
    if (afkUsers[userId]) {
      const time = Date.now() - afkUsers[userId].time;
      const duration = formatTime(time);

      delete afkUsers[userId];
      saveData();

      await message.reply(
        `${message.author.username} ${duration} neram AFK la irundhaan, welcome back`
      );
    }

    // 🟡 AFK SET
    if (content.startsWith("kadala afk")) {
      const reason = message.content.slice(11).trim() || "reason illa";

      afkUsers[userId] = {
        reason,
        time: Date.now()
      };

      saveData();

      return message.reply(
        `seri, ippo AFK la iruken\nReason: ${reason}`
      );
    }

    // 🤖 AI
    if (content.startsWith("kadala ai")) {

      const now = Date.now();
      const last = cooldown.get(userId) || 0;

      if (now - last < 3000) {
        return message.reply("dei dei slow down da");
      }

      cooldown.set(userId, now);

      const prompt = message.content.slice(10).trim();

      if (!prompt) {
        return message.reply("enna kekka pora sollu");
      }

      console.log("AI PROMPT:", prompt);

      try {
        // 🔥 SAFE MODEL (WORKS FOR ALL KEYS)
        const model = genAI.getGenerativeModel({
          model: "gemini-1.0-pro"
        });

        console.log("Using model: gemini-1.0-pro");

        const result = await model.generateContent(
          `You are Verkadala, Tamil Discord bot. Reply in casual Tamil slang.\nUser: ${prompt}`
        );

        const reply = result.response.text();

        console.log("AI RESPONSE:", reply);

        return message.reply(reply || "response illa");

      } catch (err) {
        console.error("AI ERROR FULL:", err);
        return message.reply("edho problem iruku, apram try pannu");
      }
    }

    // 🔵 AFK MENTION
    message.mentions.users.forEach(user => {
      if (afkUsers[user.id]) {
        const data = afkUsers[user.id];
        const time = Date.now() - data.time;
        const duration = formatTime(time);

        message.reply(
          `${user.username} AFK la iruken ${duration}\nReason: ${data.reason}`
        );
      }
    });

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

// LOGIN
client.login(process.env.TOKEN);
