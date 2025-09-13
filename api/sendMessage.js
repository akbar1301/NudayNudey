// api/sendMessage.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.warn(`[sendMessage] Method not allowed: ${req.method}`);
    return res.status(405).json({ ok: false, description: 'Method not allowed' });
  }

  const token = process.env.BOT_TOKEN;
  const body = req.body;

  if (!token) {
    console.error('[sendMessage] BOT_TOKEN not configured');
    return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });
  }
  if (!body || typeof body.text !== 'string') {
    console.error('[sendMessage] Missing or invalid text in request body.');
    return res.status(400).json({ ok: false, description: 'Missing text' });
  }

  const chat_id = body.chat_id ?? process.env.CHAT_ID;
  if (!chat_id) {
    console.error('[sendMessage] chat_id not provided in body and CHAT_ID env var not configured.');
    return res.status(500).json({ ok: false, description: 'chat_id not configured' });
  }

  console.log(`[sendMessage] Sending message to chat_id: ${chat_id}, text: "${body.text.substring(0, 100)}..."`); // Log 100 karakter pertama

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: body.text })
    });
    const data = await tgRes.json();

    if (!data.ok) {
      console.error(`[Telegram] sendMessage failed: ${data.description || 'Unknown error'}`);
      return res.status(502).json({ ok: false, description: data.description || 'Telegram error' });
    }
    console.log('[Telegram] sendMessage successful.');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[sendMessage] Error during Telegram API call:', err);
    return res.status(500).json({ ok: false, description: err.message });
  }
}
