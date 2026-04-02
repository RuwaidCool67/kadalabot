const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "google/gemma-7b-it"
];

client.once('clientReady', () => {
  console.log("Verkadala is running");
});

client.on('messageCreate', async (message) => {
  try {
    // 🔥 HARD FILTER (fix double reply)
    if (message.author.bot) return;
    if (!message.content) return;
    if (!message.content.toLowerCase().startsWith("kadala ai")) return;

    const userId = message.author.id;

    // cooldown
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei dei slow down da");
    }

    cooldown.set(userId, now);

    const prompt = message.content.slice(10).trim();
    if (!prompt) return message.reply("enna kekka pora sollu");

    // send once
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
- NO English sentences
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

    // 🔥 SINGLE EDIT ONLY (no double reply)
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
