const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// 🔥 MODELS TO TRY (fail-safe list)
const modelsToTry = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-001",
  "gemini-pro"
];

client.on('clientReady', () => {
  console.log("Verkadala is running");
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // AI COMMAND
  if (content.startsWith("kadala ai")) {

    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei dei slow down da");
    }

    cooldown.set(userId, now);

    const prompt = message.content.slice(10).trim();
    if (!prompt) return message.reply("enna kekka pora sollu");

    // 🔥 SEND WAIT MESSAGE
    const tempMsg = await message.reply("oru nimisham...");

    let reply = null;

    // 🔥 FAIL SAFE LOOP
    for (const modelName of modelsToTry) {
      try {
        console.log("Trying model:", modelName);

        const model = genAI.getGenerativeModel({
          model: modelName
        });

        const result = await model.generateContent(
          `You are Verkadala, Tamil Discord bot. Reply in casual Tamil slang.\nUser: ${prompt}`
        );

        reply = result.response.text();

        if (reply) {
          console.log("SUCCESS with:", modelName);
          break;
        }

      } catch (err) {
        console.log("FAILED model:", modelName);
      }
    }

    // 🔥 FINAL RESPONSE
    if (!reply) {
      await tempMsg.edit("edho problem iruku, apram try pannu");
    } else {
      await tempMsg.edit(reply);
    }
  }
});

client.login(process.env.TOKEN);
