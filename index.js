const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

// ================= STORAGE =================
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

const formatDuration = (ms) => {
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
};

// ================= API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/all", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.status(503).json({ error: "Warming up..." });
        
        // Force fetch for accurate presence, but use guild.memberCount for total
        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const stats = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { 
                username: mem ? mem.user.username : "Mamba", 
                reason: afkUsers[id].reason, 
                since: afkUsers[id].time,
                avatar: mem ? mem.user.displayAvatarURL() : '' 
            };
        });

        res.json({ 
            totalMembers: guild.memberCount, // THE FIX: Live Total Count
            stats, 
            counting: gameData, 
            afk, 
            online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL(), status: mem.presence.status })) }, 
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" } 
        });
    } catch (e) { res.status(500).json({ error: "Internal Error" }); }
});

app.listen(PORT, () => console.log(`Census Engine live on ${PORT}`));

// ================= BOT =================
const client = new Client({ intents: [3276799] });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: "Member" };
    userStats[userId].count++;
    saveAll();

    // AFK logic remains same...
    if (afkUsers[userId]) { 
        const duration = formatDuration(Date.now() - afkUsers[userId].time);
        delete afkUsers[userId]; saveAll(); 
        message.reply(`Welcome back da Kumbakarna! 😂 Nee **${duration}** ah thoongitu iruntha.`); 
    }

    if (content.startsWith('kadala afk')) {
        const reason = message.content.split('afk')[1]?.trim() || "Ethuko poirukan";
        afkUsers[userId] = { time: Date.now(), reason: reason };
        saveAll();
        return message.reply(`Seri mamba, orama poyi thoongu! 😴 Reason: ${reason}`);
    }

    // Counting Game logic stays active in backend
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                gameData.current = 0; gameData.lastUser = null;
            } else {
                gameData.current = num; gameData.lastUser = userId;
                if (num > gameData.highscore) gameData.highscore = num;
            }
            saveAll();
        }
    }
});

client.login(process.env.TOKEN);
