const { Client, GatewayIntentBits } = require('discord.js');
ceonst { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');
const fs = require('fs');

// ================= KEEP ALIVE =================
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const cooldown = new Map();
const processedMessages = new Set();

// ================= AFK =================
const FILE = './afk.json';
let afkUsers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};

function saveAFK() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return `${hr}h ${min}m ${sec}s`;
}

// ================= 100 FUN FACTS =================
const funFacts = [
"Octopus has 3 hearts",
"Honey never spoils",
"Bananas are berries",
"Sharks older than trees",
"Space smells like metal",
"Butterflies taste with feet",
"Cows have best friends",
"Penguins propose with pebbles",
"Sun is white actually",
"Your brain uses 20% energy",
"Hot water freezes faster",
"Sloths can hold breath longer than dolphins",
"Wombat poop is cube shaped",
"Humans glow in dark (low level)",
"Ants don’t sleep",
"Koalas have fingerprints",
"Jellyfish are immortal (some)",
"Venus spins backwards",
"Tardigrades survive space",
"Snakes can fly (glide)",
"Octopus escapes jars easily",
"Frogs drink through skin",
"Cats sleep 70% of life",
"Dolphins have names",
"Trees can communicate",
"Sharks detect electricity",
"Babies have more bones",
"Fire has no shadow",
"Clouds are heavy",
"Birds don’t urinate",
"Spiders have blue blood",
"Earth not perfect sphere",
"Some metals explode in water",
"Sound travels faster in water",
"Human nose detects trillion smells",
"Moon moving away slowly",
"Neptune has fastest winds",
"Gold edible in small amounts",
"Some turtles breathe through butt",
"Sea otters hold hands",
"Glass is slow liquid (sorta)",
"Lightning hotter than sun",
"Humans share DNA with bananas",
"Some fish change gender",
"Chickens remember faces",
"Space is silent",
"Your stomach gets new lining",
"Brain feels no pain",
"Rats laugh",
"Plants grow faster with music",
"Water expands when freezing",
"Some crabs use tools",
"Sharks never stop swimming",
"Some frogs freeze and live",
"Earth rotates slower over time",
"Some whales sing songs",
"Eyes heal fast",
"Some birds mimic humans",
"Ants farm fungi",
"Some fish walk on land",
"Rain has smell called petrichor",
"Some snakes see heat",
"Butterflies remember being caterpillars",
"Sun will die someday",
"Some bacteria eat radiation",
"Owls rotate head 270°",
"Some lizards run on water",
"Earth has magnetic poles shifting",
"Bees dance to communicate",
"Some frogs glow",
"Some animals see UV",
"Elephants mourn death",
"Some birds sleep mid-flight",
"Some spiders fly using silk",
"Your body has electricity",
"Stars twinkle due to atmosphere",
"Some insects survive without head",
"Time moves slower near gravity",
"Black holes bend time",
"Some fish glow in dark",
"Humans have unique tongue print",
"Some birds steal food",
"Volcano lightning exists",
"Some animals never age",
"Some worms cut regenerate",
"Some fish freeze and survive",
"Some animals fake death",
"Some animals invisible in water",
"Moon causes tides",
"Some clouds glow at night",
"Some fish see polarized light",
"Some birds navigate via stars",
"Some plants eat insects",
"Some bacteria survive vacuum",
"Some insects hear with legs",
"Some animals regrow limbs",
"Some animals live without brain"
];

// ================= VC STREAM COMMENTS =================
const streamComments = [
"dei stream smooth ah iruku 👀",
"lag konjam varudhu da 😭",
"mass gameplay 🔥",
"dei careful da",
"nice aim bro",
"dei clutch chance 👀",
"bro focus da",
"dei enemy pakkathula 😭",
"semma play da",
"dei panic pannaadha 😭"
];

// ================= READY =================
client.once('clientReady', () => {
  console.log("Verkadala running 🔥");
});

// ================= STREAM DETECT =================
client.on('voiceStateUpdate', (oldState, newState) => {
  const member = newState.member;

  if (newState.streaming) {
    const vc = newState.channel;
    if (!vc) return;

    let connection = getVoiceConnection(vc.guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
    }

    client.user.setPresence({
      activities: [{
        name: `${member.user.username} stream paakuren 👀`,
        type: 3
      }],
      status: "online"
    });
  }
});

// ================= VC COMMENT LOOP =================
setInterval(() => {
  client.guilds.cache.forEach(guild => {
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    const text = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
    if (!text) return;

    const msg = streamComments[Math.floor(Math.random() * streamComments.length)];
    text.send(`🎧 VC: ${msg}`);
  });
}, 2 * 60 * 1000);

// ================= FUN FACT LOOP =================
setInterval(() => {
  client.guilds.cache.forEach(guild => {
    const text = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
    if (!text) return;

    const fact = funFacts[Math.floor(Math.random() * funFacts.length)];
    text.send(`🧠 Fun Fact: ${fact}`);
  });
}, 5 * 60 * 1000);

// ================= MESSAGE =================
client.on('messageCreate', async (message) => {
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 10000);

  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  // AFK REMOVE
  if (afkUsers[userId]) {
    const timeAway = Date.now() - afkUsers[userId].time;
    delete afkUsers[userId];
    saveAFK();
    return message.reply(`dei comeback ah 😏 ${formatTime(timeAway)}`);
  }

  // AFK SET
  if (/^(kadala|kadalai) afk/i.test(content)) {
    afkUsers[userId] = { time: Date.now() };
    saveAFK();
    return message.reply("seri da AFK 😴");
  }

  // VC JOIN
  if (content === "kadala vc join") {
    const vc = message.member.voice.channel;
    if (!vc) return message.reply("VC la po da 😭");

    joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    return message.reply("vanthuruken da 😎");
  }

  // VC LEAVE
  if (content === "kadala vc leave") {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return message.reply("already veliya 😭");

    connection.destroy();
    return message.reply("poiten da 🚶");
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
