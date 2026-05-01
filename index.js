const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
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
let pvtChannels = []; // Tracks active private VCs for cleanup

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
            onlineKadalais: { count: online.size, members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL({ extension: 'png', size: 128 }) })) },
            bitchers: Object.values(userStats).sort((a,b) => b.count - a.count).slice(0, 15),
            chat: latestMessages,
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Sync failed mapla."); }
};

app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || { error: "Brewing..." }));
app.listen(PORT, () => console.log(`Dashboard Live on port ${PORT}`));

// ================= DISCORD BOT =================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
    ],
    allowedMentions: { parse: [], repliedUser: false } 
});

client.on('clientReady', () => {
    console.log(`Kadala Watchman ${BOT_VERSION} ready.`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);
});

// --- 🧹 AUTO-CLEANUP VOID VCs ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (oldState.channelId && pvtChannels.includes(oldState.channelId)) {
        const channel = oldState.guild.channels.cache.get(oldState.channelId);
        if (channel && channel.members.size === 0) {
            await channel.delete("Empty PVT VC").catch(() => {});
            pvtChannels = pvtChannels.filter(id => id !== oldState.channelId);
        }
    }
});

// ================= INTERACTION HANDLER =================
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;

    if (i.customId.startsWith('timeout_')) {
        if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return i.reply({ content: "Only actual Admins can approve this, mapla.", flags: [MessageFlags.Ephemeral] });
        }

        const [action, targetId, hours] = i.customId.split('_').slice(1);
        try {
            const targetMember = await i.guild.members.fetch({ user: targetId, force: true });
            if (action === 'approve') {
                if (!targetMember.moderatable) {
                    return i.reply({ content: "Pangu, I can't touch this person! Their role is higher than mine.", flags: [MessageFlags.Ephemeral] });
                }
                await targetMember.timeout(parseInt(hours) * 3600000, `Approved by ${i.user.username}`);
                await i.update({ content: `✅ **Applied:** ${targetMember.user.username} for ${hours} hour(s).`, components: [] });
            } else {
                await i.update({ content: `❌ **Denied:** Request rejected.`, components: [] });
            }
        } catch (e) { await i.reply({ content: "Member error, pangu.", flags: [MessageFlags.Ephemeral] }); }
        return;
    }

    // --- 🎨 COLOR ROLE HANDLER ---
    const colors = { 'red_role': 'Red', 'blue_role': 'Blue', 'green_role': 'Green', 'yellow_role': 'Yellow', 'purple_role': 'Purple', 'pink_role': 'Pink' };
    const colorName = colors[i.customId];
    if (colorName) {
        await i.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
            const role = i.guild.roles.cache.find(r => r.name === colorName) || await i.guild.roles.create({ name: colorName });
            const names = Object.values(colors);
            await i.member.roles.remove(i.member.roles.cache.filter(r => names.includes(r.name)));
            await i.member.roles.add(role);
            await i.editReply(`Role added: **${colorName}** ✨`);
        } catch (e) { await i.editReply("Permissions error."); }
    }
});

// ================= MESSAGE HANDLER =================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- 🔒 PRIVATE VC (kadala pvt vc @p1 @p2...) ---
    if (message.content.toLowerCase().startsWith('kadala pvt vc')) {
        const mentions = message.mentions.members;
        if (mentions.size === 0) return message.reply("Mention the bloods to invite, pangu!");
        if (mentions.size > 5) return message.reply("Max 5 persons only for PVT VC!");

        try {
            const invitees = Array.from(mentions.values());
            const pvtChannel = await message.guild.channels.create({
                name: `🔒 ${message.author.username}'s Kadala`,
                type: ChannelType.GuildVoice,
                permissionOverwrites: [
                    { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                    { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] },
                    ...invitees.map(m => ({ id: m.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] })),
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                ]
            });
            pvtChannels.push(pvtChannel.id);
            return message.reply(`✅ **PVT VC Created:** <#${pvtChannel.id}>. Auto-deletes when empty.`);
        } catch (e) { return message.reply("Permission error! Make sure I have 'Manage Channels'."); }
    }

    // --- (Standard Logic: Dashboard, Timeout, Untimeout, AFK) ---
    const sanitize = (str, limit = 80) => str.replace(/<@!?&?\d+>|@everyone|@here/g, "").replace(/@/g, "").replace(/[\n\r]/g, " ").trim().substring(0, limit);
    latestMessages.unshift({ author: message.author.username, content: sanitize(message.content, 65), avatar: message.author.displayAvatarURL(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (latestMessages.length > 12) latestMessages.pop();

    if (!userStats[message.author.id]) userStats[message.author.id] = { username: message.author.username, count: 0, avatar: message.author.displayAvatarURL() };
    userStats[message.author.id].count++;
    saveAll();

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

    if (message.content.toLowerCase().startsWith('kadala untimeout')) {
        const isStaff = message.member.roles.cache.some(r => STAFF_ROLES.includes(r.name)) || message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isStaff) return message.reply("Only Staff! ✋");
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mention correctly!");
        try { await target.timeout(null); return message.reply(`✅ Free: ${target.user.username}`); } catch (e) { return message.reply("Error."); }
    }

    // --- (AFK & Setup Color Panel) ---
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
