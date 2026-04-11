const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

// ================= STORAGE =================
const STATS_FILE = './userStats.json';
const COUNT_STATS_FILE = './countLB.json';
const GAME_FILE = './counting.json';
const AFK_FILE = './afk.json';

const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON(STATS_FILE, {});
let countLB = loadJSON(COUNT_STATS_FILE, {});
let gameData = loadJSON(GAME_FILE, { current: 0, highscore: 0, lastUser: null });
let afkUsers = loadJSON(AFK_FILE, {});

let cachedResponse = null; 

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_STATS_FILE, JSON.stringify(countLB, null, 2));
    fs.writeFileSync(GAME_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

const formatTime = (ms) => {
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
};

// ================= MASTER SYNC (SILENT) =================
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const yappers = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 5).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const counters = Object.values(countLB).sort((a, b) => b.points - a.points).slice(0, 5).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Mamba", reason: afkUsers[id].reason, since: afkUsers[id].time, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        cachedResponse = { 
            totalMembers: guild.memberCount, yappers, counters, 
            online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })) },
            afk, system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Silent sync failed"); }
};

// ================= API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || {}));

app.listen(PORT, () => console.log(`Engine live on ${PORT}`));

// ================= BOT LOGIC =================
const client = new Client({ intents: [3276799] });

client.on('ready', () => { updateMasterCache(); setInterval(updateMasterCache, 30000); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // Stats
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;

    // AFK RETURN (Time + Reason fix)
    if (afkUsers[userId]) { 
        const duration = formatTime(Date.now() - afkUsers[userId].time);
        const oldReason = afkUsers[userId].reason;
        delete afkUsers[userId]; 
        saveAll(); 
        updateMasterCache();
        return message.reply(`Welcome back mamba! 🤝\nNee **${duration}** ah thoongitu iruntha. \n**Reason:** ${oldReason}\n\n*uk u can also see this and more about tas in this server also in ${SITE_URL}*`); 
    }

    // AFK SET (Silent sync fix)
    if (content.startsWith('kadala afk')) {
        const r = message.content.split(/afk/i)[1]?.trim() || "No reason";
        afkUsers[userId] = { time: Date.now(), reason: r };
        saveAll();
        updateMasterCache();
        return message.reply(`AFK set mamba! 😴\n\n*uk u can also see this and more about tas in this server also in ${SITE_URL}*`);
    }

    // Counting
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                gameData.current = 0; gameData.lastUser = null;
            } else {
                gameData.current = num; gameData.lastUser = userId;
                if (!countLB[userId]) countLB[userId] = { username: message.author.username, points: 0 };
                countLB[userId].points++;
            }
            saveAll();
            updateMasterCache();
        }
    }
});

client.login(process.env.TOKEN);
