const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/"; 
const PROMO_CHANNEL_ID = "1477208051584073799"; 

// ================= SECURITY & STORAGE =================
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

// --- VULN 3 FIX: Basic Rate Limiting ---
let apiHits = 0;
setInterval(() => { apiHits = 0; }, 60000); // Reset every minute

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
    } catch (e) { console.log("Cache sync failed."); }
};

// ================= WEB API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/all", (req, res) => {
    // Rate limit check
    apiHits++;
    if (apiHits > 100) return res.status(429).json({ error: "Too many requests mamba, take a break." });
    res.json(cachedResponse || { error: "Syncing..." });
});

app.listen(PORT, () => console.log(`[SECURE] Verkadala Stop API live on ${PORT}`));

// ================= DISCORD BOT =================
const client = new Client({ intents: [3276799] });

client.on('ready', () => {
    console.log(`Kadala Watchman v24_a active!`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);
});

// --- VULN 5 FIX: Secure Role Assignment ---
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    
    const allowedColors = { 
        'red_role': { name: 'Red', color: '#ff4d4d' }, 
        'blue_role': { name: 'Blue', color: '#33b5e5' }, 
        'green_role': { name: 'Green', color: '#2ecc71' } 
    };

    const choice = allowedColors[i.customId];
    if (!choice) return; // Prevent unauthorized role button creation

    await i.deferReply({ ephemeral: true });
    
    try {
        let role = i.guild.roles.cache.find(r => r.name === choice.name);
        if (!role) {
            role = await i.guild.roles.create({ name: choice.name, color: choice.color, reason: 'Verkadala Color Setup' });
        }
        
        // Remove existing color roles from the list to prevent stacking
        const names = Object.values(allowedColors).map(c => c.name);
        const toRemove = i.member.roles.cache.filter(r => names.includes(r.name));
        if (toRemove.size > 0) await i.member.roles.remove(toRemove);

        await i.member.roles.add(role);
        await i.editReply(`Vaazhthukkal mapla! You are now **${choice.name}**.`);
    } catch (e) {
        await i.editReply("Bot lacks 'Manage Roles' permission or hierarchy is wrong.");
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content;

    // --- VULN 6 FIX: Chat & AFK Sanitization ---
    const sanitize = (str, limit = 100) => str.replace(/[\n\r]/g, " ").substring(0, limit);

    // Capture Chat for Web
    latestMessages.unshift({
        author: message.author.username,
        content: sanitize(content, 60),
        avatar: message.author.displayAvatarURL(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (latestMessages.length > 8) latestMessages.pop();

    // Stats
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;

    // AFK System (Snitch & Set)
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(u => {
            if (afkUsers[u.id]) {
                message.reply(`Dei mamba, **${u.username}** afk pointen! Reason: ${afkUsers[u.id].reason}`);
            }
        });
    }

    if (content.toLowerCase().startsWith('kadala afk')) {
        const rawReason = content.split(/afk/i)[1]?.trim() || "No reason";
        const cleanReason = sanitize(rawReason, 50); // Hard limit on length
        afkUsers[userId] = { time: Date.now(), reason: cleanReason };
        saveAll();
        return message.channel.send(`afk pointen: ${cleanReason}`);
    }

    if (afkUsers[userId] && !content.toLowerCase().startsWith('kadala afk')) {
        delete afkUsers[userId]; saveAll();
        message.reply("Welcome back mamba!");
    }

    // --- VULN 5 FIX: Admin Only Setup ---
    if (content.toLowerCase() === 'kadala setup color') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Gubeer move! Only Admins can setup the color panel.");
        }

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
