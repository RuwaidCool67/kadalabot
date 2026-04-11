const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= STORAGE & CACHE =================
const STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';
const AFK_FILE = './afk.json';

let cachedResponse = null; // THIS IS THE MASTER MEMORY

const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON(STATS_FILE, {});
let gameData = loadJSON(COUNT_FILE, { current: 0, highscore: 0 });
let afkUsers = loadJSON(AFK_FILE, {});

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= THE REFRESHER (RUNS EVERY 30S) =================
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const stats = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Mamba", reason: afkUsers[id].reason, since: afkUsers[id].time, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        cachedResponse = { 
            totalMembers: guild.memberCount,
            stats, online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })) },
            afk, system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
        console.log("Master Cache Updated! ✅");
    } catch (e) { console.error("Cache Update Error:", e); }
};

// ================= API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/all", (req, res) => {
    // If we have data in memory, send it instantly!
    if (cachedResponse) return res.json(cachedResponse);
    // Otherwise, send a dummy object so the site doesn't break
    res.json({ totalMembers: 0, stats: [], online: { count: 0, members: [] }, afk: [] });
});

app.listen(PORT, () => console.log(`Engine live on ${PORT}`));

// ================= BOT =================
const client = new Client({ intents: [3276799] });

client.on('ready', () => {
    console.log("Bot Ready! Starting background cache...");
    updateMasterCache(); 
    setInterval(updateMasterCache, 30000); // REFRESH EVERY 30 SECONDS
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;
    saveAll();
    
    if (message.content.toLowerCase().startsWith('kadala afk')) {
        const r = message.content.split('afk')[1]?.trim() || "Ethuko poirukan";
        afkUsers[userId] = { time: Date.now(), reason: r };
        saveAll();
        updateMasterCache(); // Force update on action
    }
    if (afkUsers[userId] && !message.content.toLowerCase().includes('kadala afk')) {
        delete afkUsers[userId]; saveAll(); updateMasterCache();
    }
});

client.login(process.env.TOKEN);
