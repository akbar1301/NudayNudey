// api/sendPhoto.js
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'Method not allowed' });

  const token = process.env.BOT_TOKEN;
  if (!token) return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });

  try {
    const body = req.body; // expecting JSON { chat_id, filename, photoBase64, caption }
    const chat_id = body.chat_id ?? process.env.CHAT_ID;
    const filename = body.filename || 'photo.jpg';
    const caption = body.caption || '';

    if (!body.photoBase64) return res.status(400).json({ ok: false, description: 'Missing photoBase64' });

    const buffer = Buffer.from(body.photoBase64, 'base64');

    const form = new FormData();
    form.append('chat_id', chat_id);
    form.append('caption', caption);
    form.append('photo', buffer, { filename });

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders ? form.getHeaders() : {}
    });

    const data = await tgRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
