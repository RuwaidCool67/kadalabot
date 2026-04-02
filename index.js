const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
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

client.on('clientReady', () => {
  console.log("Verkadala is running");
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;

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

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-001"
      });

      const result = await model.generateContent(
        `You are Verkadala, Tamil Discord bot. Reply in casual Tamil slang.\nUser: ${prompt}`
      );

      const reply = result.response.text();

      message.reply(reply || "response illa");

    } catch (err) {
      console.error("AI ERROR:", err);
      message.reply("edho problem iruku, apram try pannu");
    }
  }
});

client.login(process.env.TOKEN);
