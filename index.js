const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

// 🔥 MODELS (auto fallback)
const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "meta-llama/llama-3-70b-instruct",
  "mistralai/mistral-7b-instruct",
  "google/gemma-7b-it"
];

client.once('clientReady', () => {
  console.log("Verkadala is running");
});

// MAIN
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content) return;

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
      if (!prompt) return message.reply("enna kekka pora sollu");

      // wait message
      const tempMsg = await message.reply("oru nimisham...");

      let finalReply = null;

      // 🔥 TRY ALL MODELS
      for (let i = 0; i < MODELS.length; i++) {
        const modelName = MODELS[i];

        try {
          console.log("Trying:", modelName);

          const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              model: modelName,
              messages: [
                {
                  role: "user",
                  content: `Reply in Tamil slang (Tanglish), short and natural.\nUser: ${prompt}`
                }
              ]
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

          const reply = res.data.choices?.[0]?.message?.content;

          if (reply) {
            finalReply = reply;
            console.log("SUCCESS:", modelName);
            break;
          }

        } catch (err) {
          console.log("FAILED:", modelName);
        }
      }

      // RESULT
      if (!finalReply) {
        await tempMsg.edit("edho problem iruku, apram try pannu");
      } else {
        await tempMsg.edit(finalReply);
      }
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
