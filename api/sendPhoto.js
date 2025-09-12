import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

async function uploadToCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  const url = await response.text();
  if (!url.startsWith('https://')) throw new Error('Catbox upload failed: ' + url);
  return url.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'Method not allowed' });

  const token = process.env.BOT_TOKEN;
  if (!token) return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });

  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ ok: false, description: 'Content-Type must be multipart/form-data' });
  }

  try {
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers });
    let fields = {};
    let fileBuffer = [];
    let fileName = 'photo.jpg';

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file, info) => {
        fileName = info.filename || 'photo.jpg';
        file.on('data', data => fileBuffer.push(data));
      });
      bb.on('field', (fieldname, val) => { fields[fieldname] = val; });
      bb.on('finish', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    const chat_id = fields.chat_id ?? process.env.CHAT_ID;
    const caption = fields.caption || '';
    const buffer = Buffer.concat(fileBuffer);

    if (!buffer.length) return res.status(400).json({ ok: false, description: 'Missing photo file' });
    if (buffer.length > 10 * 1024 * 1024) return res.status(413).json({ ok: false, description: 'Photo exceeds 10MB limit' });

    // Upload image to Catbox
    const catboxUrl = await uploadToCatbox(buffer, fileName);

    // Send Catbox image URL to Telegram using sendDocument
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        document: catboxUrl,
        caption
      })
    });

    const data = await tgRes.json();
    if (!data.ok) {
      return res.status(502).json({ ok: false, description: data.description || 'Telegram error' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('sendPhoto/sendDocument error:', err);
    return res.status(500).json({ ok: false, description: err.message });
  }
}