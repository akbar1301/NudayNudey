// api/sendMessage.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'Method not allowed' });

  const token = process.env.BOT_TOKEN;
  const body = req.body;

  if (!token) return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });
  if (!body || typeof body.text !== 'string') return res.status(400).json({ ok: false, description: 'Missing text' });

  const chat_id = body.chat_id ?? process.env.CHAT_ID;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: body.text })
    });
    const data = await tg.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
