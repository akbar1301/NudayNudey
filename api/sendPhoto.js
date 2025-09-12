import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'Method not allowed' });

  const token = process.env.BOT_TOKEN;
  if (!token) return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });

  try {
    const contentType = req.headers['content-type'] || '';
    let chat_id, caption, filename, buffer;

    if (contentType.includes('application/json')) {
      // Handle JSON base64
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', resolve);
        req.on('error', reject);
      });
      body = JSON.parse(body);

      chat_id = body.chat_id ?? process.env.CHAT_ID;
      filename = body.filename || 'photo.jpg';
      caption = body.caption || '';

      if (!body.photoBase64) return res.status(400).json({ ok: false, description: 'Missing photoBase64' });

      buffer = Buffer.from(body.photoBase64, 'base64');
      if (buffer.length === 0) return res.status(400).json({ ok: false, description: 'Invalid base64 photo data' });

    } else if (contentType.includes('multipart/form-data')) {
      // Handle FormData
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
        bb.on('field', (fieldname, val) => {
          fields[fieldname] = val;
        });
        bb.on('finish', resolve);
        bb.on('error', reject);
        req.pipe(bb);
      });

      chat_id = fields.chat_id ?? process.env.CHAT_ID;
      caption = fields.caption || '';
      filename = fileName;
      buffer = Buffer.concat(fileBuffer);

      if (!buffer.length) return res.status(400).json({ ok: false, description: 'Missing photo file' });
      if (buffer.length > 10 * 1024 * 1024) return res.status(413).json({ ok: false, description: 'Photo exceeds 10MB limit' });

    } else {
      return res.status(400).json({ ok: false, description: 'Unsupported content-type' });
    }

    // Send to Telegram
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
    if (!data.ok) {
      return res.status(502).json({ ok: false, description: data.description || 'Telegram error' });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
