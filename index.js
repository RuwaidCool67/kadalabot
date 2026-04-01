const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');

// 🌐 KEEP-ALIVE SERVER (Railway fix)
const app = express();

app.get("/", (req, res) => {
  res.send("Verkadala bot is alive 🌰");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}...`);
});

// 🤖 DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const FILE = './afk.json';

// Load AFK data
let afkUsers = {};
if (fs.existsSync(FILE)) {
  afkUsers = JSON.parse(fs.readFileSync(FILE));
}

// Save AFK data
function saveData() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

// Time formatter
function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);

  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

// ✅ READY EVENT
client.on('clientReady', () => {
  console.log("🌰 Verkadala is watching kadala...");
});

// 💬 MAIN LOGIC
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const content = message.content.toLowerCase();

  // 🟢 REMOVE AFK
  if (afkUsers[userId]) {
    const time = Date.now() - afkUsers[userId].time;
    const duration = formatTime(time);

    delete afkUsers[userId];
    saveData();

    message.reply(
      `👀 ${message.author.username} AFK la ${duration} irundhaan 😴\nvera level comeback 😎🔥`
    );
  }

  // 🟡 SET AFK
  if (content.startsWith("kadala afk")) {
    const reason = message.content.slice(11).trim() || "no reason 😴";

    afkUsers[userId] = {
      reason: reason,
      time: Date.now()
    };

    saveData();

    return message.reply(
      `🌰 seri po… AFK set panniten 😴\nReason: ${reason} 😎`
    );
  }

  // 🔵 CHECK mentions
  message.mentions.users.forEach(user => {
    if (afkUsers[user.id]) {
      const data = afkUsers[user.id];
      const time = Date.now() - data.time;
      const duration = formatTime(time);

      message.reply(
        `🌰 ${user.username} AFK la irukaan — ${duration}\nReason: ${data.reason} 😎`
      );
    }
  });
});

// 🛡️ ERROR HANDLING
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// 🔐 LOGIN
client.login(process.env.TOKEN);
