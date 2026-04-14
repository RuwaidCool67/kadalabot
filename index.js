const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/"; 
const PROMO_CHANNEL_ID = "1477208051584073799"; 

// ================= STORAGE =================
const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON('./userStats.json', {});
let countLB = loadJSON('./countLB.json', {});
let gameData = loadJSON('./counting.json', { current: 0, lastUser: null });
let afkUsers = loadJSON('./afk.json', {});
let latestMessages = []; 

const saveAll = () => {
    fs.writeFileSync('./userStats.json', JSON.stringify(userStats));
    fs.writeFileSync('./countLB.json', JSON.stringify(countLB));
    fs.writeFileSync('./counting.json', JSON.stringify(gameData));
    fs.writeFileSync('./afk.json', JSON.stringify(afkUsers));
};

const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${totalSeconds % 60}s`;
    return `${totalSeconds % 60}s`;
};

// ================= MASTER CACHE =================
let cachedResponse = null;
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const m = await guild.members.fetch({ withPresences: true });
        const online = m.filter(mem => mem.presence?.status !== 'offline' && !mem.user.bot);
        
        cachedResponse = { 
            totalKadalais: guild.memberCount,
            onlineKadalais: { 
                count: online.size, 
                members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })).slice(0, 15) 
            },
            yappers: Object.values(userStats).sort((a,b) => b.count - a.count).slice(0, 10),
            counters: Object.values(countLB).sort((a,b) => b.points - a.points).slice(0, 5),
            afk: Object.keys(afkUsers).map(id => ({ username: guild.members.cache.get(id)?.user.username || "Kadalai", reason: afkUsers[id].reason })),
            chat: latestMessages,
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Sync error"); }
};

// ================= WEB API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || {}));
app.listen(PORT, () => console.log(`Verkadala Stop API live`));

// ================= DISCORD BOT =================
const client = new Client({ 
    intents: [3276799],
    // GLOBAL FIX: Bot will never trigger a mention when replying/sending text
    allowedMentions: { parse: [], repliedUser: false } 
});

client.on('ready', () => {
    console.log(`Kadala Watchman v24_d (Anti-Exploit) online!`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);
});

// Color Role Setup
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    const colors = { 'red_role': { name: 'Red', color: '#ff4d4d' }, 'blue_role': { name: 'Blue', color: '#33b5e5' }, 'green_role': { name: 'Green', color: '#2ecc71' } };
    const choice = colors[i.customId];
    if (!choice) return;

    await i.deferReply({ ephemeral: true });
    try {
        const role = i.guild.roles.cache.find(r => r.name === choice.name) || await i.guild.roles.create({ name: choice.name, color: choice.color });
        const names = Object.values(colors).map(c => c.name);
        await i.member.roles.remove(i.member.roles.cache.filter(r => names.includes(r.name)));
        await i.member.roles.add(role);
        await i.editReply(`You are now **${choice.name}**! ✨`);
    } catch (e) { await i.editReply("Role error."); }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content;

    // --- HARD SANITIZER (NUKES ALL PINGS & SYMBOLS) ---
    const sanitize = (str, limit = 100) => {
        return str
            .replace(/<@!?&?\d+>|@everyone|@here/g, "") // Removes Discord mention strings
            .replace(/@/g, "") // Removes raw @ symbols to prevent ghost-pings
            .replace(/[\n\r]/g, " ") // Removes line breaks
            .trim()
            .substring(0, limit);
    };

    // Chat capture for site
    latestMessages.unshift({
        author: message.author.username,
        content: sanitize(content, 60),
        avatar: message.author.displayAvatarURL(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (latestMessages.length > 10) latestMessages.pop();

    // 🏆 Stats
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;

    // 😴 AFK SYSTEM (SECURE)
    if (message.mentions.users.size > 0) {
        const firstAFK = message.mentions.users.find(u => afkUsers[u.id]);
        if (firstAFK) {
            const timeAway = formatTime(Date.now() - afkUsers[firstAFK.id].time);
            // Uses Bold Username (Safe)
            message.reply(`Dei mamba, **${firstAFK.username}** afk pointen! Nee **${timeAway}** ah **${afkUsers[firstAFK.id].reason}** nu sollitu poiruntha.`);
        }
    }

    if (content.toLowerCase().startsWith('kadala afk')) {
        const rawReason = content.split(/afk/i)[1]?.trim() || "No reason";
        const cleanReason = sanitize(rawReason, 50); // Mentions stripped here!
        
        afkUsers[userId] = { time: Date.now(), reason: cleanReason };
        saveAll();
        return message.channel.send(`afk pointen: ${cleanReason}`);
    }

    if (afkUsers[userId] && !content.toLowerCase().startsWith('kadala afk')) {
        const dur = formatTime(Date.now() - afkUsers[userId].time);
        delete afkUsers[userId]; saveAll();
        message.reply(`Welcome back mamba! Nee **${dur}** ah AFK-la iruntha.`);
    }

    // 🎨 Admin Role Setup
    if (content.toLowerCase() === 'kadala setup color' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('red_role').setLabel('Red 🔥').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('blue_role').setLabel('Blue 🌊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('green_role').setLabel('Green 🌿').setStyle(ButtonStyle.Success)
        );
        message.channel.send({ content: "🎨 **KADALA COLOR PANEL**", components: [row] });
    }

    updateMasterCache();
});

client.login(process.env.TOKEN);
