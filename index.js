const axios = require("axios");

// AI COMMAND
if (content.startsWith("kadala ai")) {

  const now = Date.now();
  const last = cooldown.get(userId) || 0;

  if (now - last < 3000) {
    return message.reply("dei dei slow down da");
  }

  cooldown.set(userId, now);

  const prompt = message.content.slice(10).trim();
  if (!prompt) return message.reply("enna kekka pora sollu");

  const tempMsg = await message.reply("oru nimisham...");

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "user",
            content: `Reply in Tamil slang.\nUser: ${prompt}`
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = res.data.choices[0].message.content;

    await tempMsg.edit(reply);

  } catch (err) {
    console.error(err.response?.data || err.message);
    await tempMsg.edit("edho problem iruku, apram try pannu");
  }
}
