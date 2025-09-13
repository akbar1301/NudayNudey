import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

async function uploadToCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });

  console.log(`[Catbox] Attempting to upload file: ${filename}, size: ${buffer.length} bytes`);

  try {
    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const url = await response.text();
    console.log(`[Catbox] Raw response: ${url}`);

    if (!url.startsWith('https://')) {
      throw new Error('Catbox upload failed: ' + url);
    }
    console.log(`[Catbox] Upload successful, URL: ${url.trim()}`);
    return url.trim();
  } catch (error) {
    console.error(`[Catbox] Error during upload: ${error.message}`);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.warn(`[sendPhoto] Method not allowed: ${req.method}`);
    return res.status(405).json({ ok: false, description: 'Method not allowed' });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('[sendPhoto] BOT_TOKEN not configured');
    return res.status(500).json({ ok: false, description: 'BOT_TOKEN not configured' });
  }

  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    console.error(`[sendPhoto] Invalid Content-Type: ${req.headers['content-type']}. Expected multipart/form-data`);
    return res.status(400).json({ ok: false, description: 'Content-Type must be multipart/form-data' });
  }

  try {
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers });
    let fields = {};
    let fileBuffer = [];
    let fileName = 'photo.jpg';
    let fileReceived = false; // Flag untuk menandakan apakah file diterima

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file, info) => {
        console.log(`[Busboy] File received: fieldname=${fieldname}, filename=${info.filename}, mimetype=${info.mimeType}`);
        fileReceived = true; // Set flag
        fileName = info.filename || 'photo.jpg';
        file.on('data', data => fileBuffer.push(data));
        file.on('end', () => console.log(`[Busboy] File ${fileName} finished. Total chunks: ${fileBuffer.length}`));
      });
      bb.on('field', (fieldname, val) => {
        console.log(`[Busboy] Field received: ${fieldname}=${val}`);
        fields[fieldname] = val;
      });
      bb.on('finish', () => {
        console.log('[Busboy] Parsing finished.');
        resolve();
      });
      bb.on('error', (err) => {
        console.error(`[Busboy] Parsing error: ${err.message}`);
        reject(err);
      });
      req.pipe(bb);
    });

    console.log(`[sendPhoto] Busboy fields: ${JSON.stringify(fields)}`);
    console.log(`[sendPhoto] File received flag: ${fileReceived}`);
    console.log(`[sendPhoto] fileBuffer length: ${fileBuffer.length}`);


    const chat_id = fields.chat_id ?? process.env.CHAT_ID;
    const caption = fields.caption || '';
    const buffer = Buffer.concat(fileBuffer);

    if (!fileReceived || !buffer.length) { // Cek juga flag fileReceived
      console.error('[sendPhoto] Missing photo file in request after busboy processing.');
      return res.status(400).json({ ok: false, description: 'Missing photo file' });
    }
    if (buffer.length > 10 * 1024 * 1024) {
      console.error(`[sendPhoto] Photo exceeds 10MB limit. Size: ${buffer.length} bytes`);
      return res.status(413).json({ ok: false, description: 'Photo exceeds 10MB limit' });
    }

    console.log(`[sendPhoto] Final file to process: ${fileName}, size: ${buffer.length} bytes, chat_id: ${chat_id}, caption: "${caption}"`);

    // Upload image to Catbox
    const catboxUrl = await uploadToCatbox(buffer, fileName);

    // Send Catbox image URL to Telegram using sendDocument
    console.log(`[Telegram] Sending document to chat_id: ${chat_id} with URL: ${catboxUrl}`);
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
      console.error(`[Telegram] sendDocument failed: ${data.description || 'Unknown error'}`);
      return res.status(502).json({ ok: false, description: data.description || 'Telegram error' });
    }
    console.log('[Telegram] sendDocument successful.');
    return res.status(200).json(data);
  } catch (err) {
    console.error('sendPhoto/sendDocument error:', err);
    return res.status(500).json({ ok: false, description: err.message });
  }
}
