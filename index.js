const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= DATABASES =================
const STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';
const AFK_FILE = './afk.json';

let userStats = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE)) : {};
let countData = fs.existsSync(COUNT_FILE) ? JSON.parse(fs.readFileSync(COUNT_FILE)) : { current: 0, highscore: 0, lastUser: null };
let afkUsers = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(countData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= API ROUTES (WEBSITE) =================
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.get("/api/stats", async (req, res) => {
    const guild = client.guilds.cache.first();
    const sorted = Object.values(userStats)
        .sort((a, b) => b.count - a.count)
        .filter(u => u.username.toLowerCase() !== 'dyno' && !u.isBot); // Clean list
    
    const top10 = sorted.slice(0, 10);
    const dataWithAvatars = top10.map(stats => {
        const member = guild.members.cache.find(m => m.user.username === stats.username);
        return { 
            ...stats, 
            avatar: member ? member.user.displayAvatarURL({ extension: 'png', size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'
        };
    });
    res.json(dataWithAvatars);
});

app.get("/api/afk", async (req, res) => {
    const guild = client.guilds.cache.first();
    const afkList = [];
    for (const id in afkUsers) {
        const member = guild.members.cache.get(id);
        afkList.push({
            username: member ? member.user.username : "Unknown",
            avatar: member ? member.user.displayAvatarURL({ size: 64 }) : 'https://cdn.discordapp.com/embed/avatars/0.png',
            reason: afkUsers[id].reason
        });
    }
    res.json(afkList);
});

app.get("/api/online", async (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.json({ count: 0, members: [] });
    await guild.members.fetch();
    const online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline' && !m.user.bot);
    res.json({
        count: online.size,
        members: online.map(m => ({ 
            username: m.user.username, 
            avatar: m.user.displayAvatarURL({ size: 64 }),
            status: m.presence.status 
        }))
    });
});

app.get("/api/counting", (req, res) => res.json(countData));

app.listen(PORT, () => console.log(`Verkadala Hub live on Port ${PORT} 🔥`));

// ================= BOT INTENTS & CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildMembers
    ]
});

client.on('messageCreate', async (message) => {
    if (message.author.bot && message.author.username.toLowerCase() !== 'dyno') return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // 1. UPDATE STATS
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: "Member", isBot: message.author.bot };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    saveAll();

    // 2. COUNTING
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== countData.current + 1 || userId === countData.lastUser) {
                message.react('❌');
                countData.current = 0; countData.lastUser = null; saveAll();
                return message.reply("GUBEER! Back to 0. Website check panni highscore paaru pangu!");
            }
            countData.current = num; countData.lastUser = userId;
            if (num > countData.highscore) countData.highscore = num;
            saveAll();
            message.react('✅');
            return;
        }
    }

    // 3. AFK LOGIC
    if (afkUsers[userId]) {
        delete afkUsers[userId]; saveAll();
        return message.reply("Welcome back! Website la irunthu unna thookitaen.");
    }
    if (content.startsWith('kadala afk')) {
        afkUsers[userId] = { time: Date.now(), reason: content.split('afk')[1]?.trim() || "No reason" };
        saveAll();
        return message.reply("AFK set! Nee thoonguratha website la live ah kaatren. 😴");
    }
});

client.login(process.env.TOKEN);
