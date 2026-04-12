const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${totalSeconds % 60}s`;
    return `${totalSeconds % 60}s`;
};

// ================= MASTER CACHE SYNC =================
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const yappers = Object.values(userStats).sort((a, b) => b.count - a.count).slice(0, 10).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const counters = Object.values(countLB).sort((a, b) => b.points - a.points).slice(0, 5).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Kadalai", reason: afkUsers[id].reason, since: afkUsers[id].time };
        });

        // Branding Update: Total Members -> Total Kadalais
        cachedResponse = { 
            totalKadalais: guild.memberCount, 
            yappers, 
            counters, 
            onlineKadalais: { 
                count: onlineMem.size, 
                members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })) 
            },
            afk, 
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Cache error"); }
};

// ================= WEB API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || {}));
app.listen(PORT, () => console.log(`Verkadala Stop API live on ${PORT}`));

// ================= DISCORD BOT =================
const client = new Client({ 
    intents: [3276799],
    presence: { activities: [{ name: 'Verkadala Stop', type: ActivityType.Watching }] }
});

client.on('ready', () => {
    console.log(`Kadala Watchman online as ${client.user.tag}`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);

    // 📢 30-MIN AUTO PROMOTER
    setInterval(() => {
        const channel = client.channels.cache.find(c => c.name.includes('general') || c.name.includes('chat'));
        if (channel) channel.send(`📢 Dei mapla, check the Verkadala Stop stats here: ${SITE_URL}`);
    }, 1800000);
});

// 🎨 COLOR PANEL HANDLER
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const colors = { 
        'red_role': { name: 'Red', color: '#ff4d4d' }, 
        'blue_role': { name: 'Blue', color: '#33b5e5' }, 
        'green_role': { name: 'Green', color: '#2ecc71' }, 
        'yellow_role': { name: 'Yellow', color: '#f1c40f' }, 
        'purple_role': { name: 'Purple', color: '#9b59b6' } 
    };
    const selection = colors[interaction.customId];
    if (!selection) return;

    await interaction.deferReply({ ephemeral: true });
    try {
        const role = interaction.guild.roles.cache.find(r => r.name === selection.name) || await interaction.guild.roles.create({ name: selection.name, color: selection.color });
        const allColorNames = Object.values(colors).map(c => c.name);
        const rolesToRemove = interaction.member.roles.cache.filter(r => allColorNames.includes(r.name));
        if (rolesToRemove.size > 0) await interaction.member.roles.remove(rolesToRemove);
        await interaction.member.roles.add(role);
        await interaction.editReply(`Vaazhthukkal mapla! Unaku ippo **${selection.name}** color vandhachu! ✨`);
    } catch (e) { await interaction.editReply("Manage Roles permission illaiya mamba?"); }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // 🏆 YAPPER STATS
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;

    // 🔢 COUNTING BOT
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                message.react('❌');
                gameData.current = 0; gameData.lastUser = null;
                message.reply("Gubeer mistake! Number wrong. Resetting to 0.");
            } else {
                message.react('✅');
                gameData.current = num; gameData.lastUser = userId;
                if (!countLB[userId]) countLB[userId] = { username: message.author.username, points: 0 };
                countLB[userId].points++;
            }
            saveAll(); updateMasterCache();
        }
    }

    // 😴 AFK LOGIC
    // 1. If someone PINGS an AFK user
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkUsers[user.id]) {
                const timeAway = formatTime(Date.now() - afkUsers[user.id].time);
                message.reply(`Dei mamba, **${user.username}** AFK-la irukan! He's been away for **${timeAway}** for: **${afkUsers[user.id].reason}**.`);
            }
        });
    }

    // 2. Welcome Back
    if (afkUsers[userId] && !content.startsWith('kadala afk')) {
        const duration = formatTime(Date.now() - afkUsers[userId].time);
        const reason = afkUsers[userId].reason;
        delete afkUsers[userId];
        saveAll(); updateMasterCache();
        return message.reply(`Welcome back! Nee **${duration}** ah **${reason}** nu sollitu poiruntha.`);
    }

    // 3. Set AFK
    if (content.startsWith('kadala afk')) {
        const r = message.content.split(/afk/i)[1]?.trim() || "No reason";
        afkUsers[userId] = { time: Date.now(), reason: r };
        saveAll(); updateMasterCache();
        return message.channel.send(`afk pointen: ${r}`);
    }

    // 🎨 COLOR PANEL SETUP
    if (content === 'kadala setup color') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('red_role').setLabel('Red 🔥').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('blue_role').setLabel('Blue 🌊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('green_role').setLabel('Green 🌿').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('yellow_role').setLabel('Yellow ⚡').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('purple_role').setLabel('Purple 👾').setStyle(ButtonStyle.Secondary)
        );
        return message.channel.send({ content: "🎨 **KADALA COLOR PANEL**", components: [row] });
    }

    saveAll();
});

client.login(process.env.TOKEN);
