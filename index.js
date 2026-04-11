const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= DATABASE HELPERS =================
const STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';
const AFK_FILE = './afk.json';

const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON(STATS_FILE, {});
let gameData = loadJSON(COUNT_FILE, { current: 0, highscore: 0, lastUser: null });
let afkUsers = loadJSON(AFK_FILE, {});

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= AI CONFIG =================
const systemInstruction = "You are 'Kadala Watchman', a peak GenZ Tamil guy. Use Tanglish, slang like 'mamba', 'gubeer', 'blood'. Keep it short.";
let currentKeyIndex = -1;
const getAIModel = () => {
    const keys = [process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3].filter(k => k);
    if (!keys.length) return null;
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    return new GoogleGenerativeAI(keys[currentKeyIndex]).getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction });
};

// ================= EXPRESS API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/all", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.status(503).json({ error: "Bot warming up..." });

        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);

        const stats = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Mamba", reason: afkUsers[id].reason, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        res.json({
            stats, counting: gameData, afk,
            online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL(), status: mem.presence.status })) },
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        });
    } catch (e) { res.status(500).json({ error: "Internal Error" }); }
});

app.listen(PORT, () => console.log(`Verkadala Hub live on ${PORT}`));

// ================= DISCORD BOT =================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

client.on('ready', () => client.user.setActivity('kadalabot.up.railway.app', { type: ActivityType.Watching }));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // Track Stats
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: userId === message.guild.ownerId ? "Verified Owner" : "Member", isBot: false };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    saveAll();

    // Counting Game
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                message.react('❌'); gameData.current = 0; gameData.lastUser = null;
            } else {
                message.react('✅'); gameData.current = num; gameData.lastUser = userId;
                if (num > gameData.highscore) gameData.highscore = num;
            }
            saveAll();
            return;
        }
    }

    // AFK logic
    if (afkUsers[userId]) { delete afkUsers[userId]; saveAll(); message.reply("Welcome back!"); }
    if (content.startsWith('kadala afk')) {
        afkUsers[userId] = { time: Date.now(), reason: content.split('afk')[1]?.trim() || "No reason" };
        saveAll();
        return message.reply("AFK set!");
    }

    // AI Chat
    if (content.startsWith('kadala ') || (message.reference && message.mentions.has(client.user))) {
        await message.channel.sendTyping();
        const model = getAIModel();
        if (!model) return;
        const result = await model.generateContent(content.replace('kadala ', ''));
        return message.reply(result.response.text());
    }
});

client.login(process.env.TOKEN);
