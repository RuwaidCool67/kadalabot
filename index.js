const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_VERSION = "v24.f.2026"; 
const ADMIN_CHANNEL_ID = "1477206978895020065";
const STAFF_ROLES = ["Staff", "Admin", "Moderator"]; 

// ================= STORAGE =================
const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON('./userStats.json', {});
let afkUsers = loadJSON('./afk.json', {});
let latestMessages = []; 

const saveAll = () => {
    fs.writeFileSync('./userStats.json', JSON.stringify(userStats));
    fs.writeFileSync('./afk.json', JSON.stringify(afkUsers));
};

const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${totalSeconds % 60}s`;
};

// ================= DATA SYNC =================
let cachedResponse = null;
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        
        const m = await guild.members.fetch({ withPresences: true });
        const online = m.filter(mem => mem.presence?.status && mem.presence?.status !== 'offline' && !mem.user.bot);
        
        cachedResponse = { 
            version: BOT_VERSION,
            totalKadalais: guild.memberCount,
            onlineKadalais: { 
                count: online.size, 
                members: online.map(mem => ({ 
                    username: mem.user.username, 
                    avatar: mem.user.displayAvatarURL({ extension: 'png', size: 128 }) 
                }))
            },
            bitchers: Object.values(userStats).sort((a,b) => b.count - a.count).slice(0, 15),
            afk: Object.keys(afkUsers).map(id => ({ 
                username: guild.members.cache.get(id)?.user.username || "Ghost", 
                reason: afkUsers[id].reason 
            })),
            chat: latestMessages,
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Sync failed."); }
};

app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || { error: "Brewing..." }));

app.listen(PORT, () => console.log(`Dashboard Live on port ${PORT}`));

// ================= DISCORD BOT =================
const client = new Client({ 
    intents: [3276799],
    allowedMentions: { parse: [], repliedUser: false } 
});

client.on('ready', () => {
    console.log(`Kadala Watchman ${BOT_VERSION} ready.`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);
});

client.on('interactionCreate', async i => {
    if (!i.isButton()) return;

    // --- TIMEOUT APPROVAL HANDLER ---
    if (i.customId.startsWith('timeout_')) {
        if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return i.reply({ content: "Only Admins can approve this, mapla.", ephemeral: true });
        }

        const [action, targetId, hours] = i.customId.split('_').slice(1);
        try {
            const targetMember = await i.guild.members.fetch(targetId);

            if (action === 'approve') {
                const ms = parseInt(hours) * 3600000;
                await targetMember.timeout(ms, `Approved by ${i.user.username}`);
                await i.update({ content: `✅ **Timeout Applied:** ${targetMember.user.username} for ${hours} hour(s).`, components: [] });
            } else {
                await i.update({ content: `❌ **Timeout Denied:** Request for ${targetMember.user.username} was rejected.`, components: [] });
            }
        } catch (e) {
            await i.reply({ content: "Member error, pangu.", ephemeral: true });
        }
        return;
    }
    
    // --- COLOR ROLE HANDLER ---
    const colors = { 
        'red_role': { name: 'Red', color: '#ff4d4d' }, 'blue_role': { name: 'Blue', color: '#33b5e5' }, 
        'green_role': { name: 'Green', color: '#2ecc71' }, 'yellow_role': { name: 'Yellow', color: '#f1c40f' },
        'purple_role': { name: 'Purple', color: '#9b59b6' }, 'pink_role': { name: 'Pink', color: '#e91e63' }
    };
    const choice = colors[i.customId];
    if (!choice) return;
    await i.deferReply({ ephemeral: true });
    try {
        const role = i.guild.roles.cache.find(r => r.name === choice.name) || await i.guild.roles.create({ name: choice.name, color: choice.color });
        const names = Object.values(colors).map(c => c.name);
        await i.member.roles.remove(i.member.roles.cache.filter(r => names.includes(r.name)));
        await i.member.roles.add(role);
        await i.editReply(`Role added: **${choice.name}** ✨`);
    } catch (e) { await i.editReply("Permissions error."); }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const sanitize = (str, limit = 80) => str.replace(/<@!?&?\d+>|@everyone|@here/g, "").replace(/@/g, "").replace(/[\n\r]/g, " ").trim().substring(0, limit);

    // --- LOG MESSAGES ---
    latestMessages.unshift({ author: message.author.username, content: sanitize(message.content, 65), avatar: message.author.displayAvatarURL(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (latestMessages.length > 12) latestMessages.pop();

    if (!userStats[message.author.id]) userStats[message.author.id] = { username: message.author.username, count: 0, avatar: message.author.displayAvatarURL() };
    userStats[message.author.id].count++;
    userStats[message.author.id].avatar = message.author.displayAvatarURL();
    saveAll();

    // --- TIMEOUT REQUEST ---
    if (message.content.toLowerCase().startsWith('kadala timeout')) {
        const isStaff = message.member.roles.cache.some(r => STAFF_ROLES.includes(r.name)) || message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isStaff) return message.reply("Only Staff can request timeouts! ✋");

        const args = message.content.split(' ');
        const target = message.mentions.members.first();
        const hours = args[args.length - 1];
        const reason = args.slice(3, -1).join(' ');

        if (!target || isNaN(hours)) return message.reply("Syntax: `kadala timeout @person reason 2` (2 = hours)");

        const adminChannel = client.channels.cache.get(ADMIN_CHANNEL_ID);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`timeout_approve_${target.id}_${hours}`).setLabel('Approve ✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`timeout_deny_${target.id}_${hours}`).setLabel('Deny ❌').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder().setTitle("⏳ Timeout Request").setColor("#38bdf8")
            .addFields({ name: "Staff", value: message.author.username, inline: true }, { name: "Target", value: target.user.username, inline: true }, { name: "Duration", value: `${hours} Hour(s)`, inline: true }, { name: "Reason", value: reason || "No reason provided" })
            .setTimestamp();

        adminChannel.send({ embeds: [embed], components: [row] });
        return message.reply(`Request for **${hours}hr** timeout sent for approval. 📨`);
    }

    // --- UNTIMEOUT (kadala untimeout @person) ---
    if (message.content.toLowerCase().startsWith('kadala untimeout')) {
        const isStaff = message.member.roles.cache.some(r => STAFF_ROLES.includes(r.name)) || message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isStaff) return message.reply("Only Staff can remove timeouts! ✋");

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mention correctly, pangu!");

        try {
            await target.timeout(null, `Removed by ${message.author.username}`);
            return message.reply(`✅ **Timeout Removed:** ${target.user.username} is free!`);
        } catch (e) { return message.reply("Permissions error, pangu."); }
    }

    // --- AFK SYSTEM ---
    if (message.mentions.users.size > 0) {
        const firstAFK = message.mentions.users.find(u => afkUsers[u.id]);
        if (firstAFK) {
            const timeAway = formatTime(Date.now() - afkUsers[firstAFK.id].time);
            message.reply(`Dei mamba, **${firstAFK.username}** afk pointen! Nee **${timeAway}** ah **${afkUsers[firstAFK.id].reason}** nu sollitu poiruntha.`);
        }
    }

    if (message.content.toLowerCase().startsWith('kadala afk')) {
        const r = sanitize(message.content.split(/afk/i)[1]?.trim() || "Chilling", 50);
        afkUsers[message.author.id] = { time: Date.now(), reason: r };
        saveAll();
        return message.channel.send(`afk pointen: ${r}`);
    }

    if (afkUsers[message.author.id] && !message.content.toLowerCase().startsWith('kadala afk')) {
        delete afkUsers[message.author.id]; saveAll();
        message.reply("Welcome back!");
    }

    // --- COLOR PANEL ---
    if (message.content.toLowerCase() === 'kadala setup color' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('red_role').setLabel('Red 🔥').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('blue_role').setLabel('Blue 🌊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('green_role').setLabel('Green 🌿').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('yellow_role').setLabel('Yellow ⚡').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('purple_role').setLabel('Purple 😈').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pink_role').setLabel('Pink 🌸').setStyle(ButtonStyle.Secondary));
        message.channel.send({ content: "🎨 **KADALA COLOR PANEL**", components: [row1, row2] });
    }
});

client.login(process.env.TOKEN);
