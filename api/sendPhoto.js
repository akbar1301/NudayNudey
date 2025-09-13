import FormData from 'form-data';
import busboy from 'busboy';
import fetch from 'node-fetch'; // Pastikan node-fetch di-import jika belum

export const config = { api: { bodyParser: false } };

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
    const bb = busboy({ headers: req.headers });
    let fields = {};
    let fileBuffer = [];
    let fileName = 'photo.jpg';
    let fileReceived = false;

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file, info) => {
        console.log(`[Busboy] File received: fieldname=${fieldname}, filename=${info.filename}, mimetype=${info.mimeType}`);
        fileReceived = true;
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

    if (!fileReceived || !buffer.length) {
      console.error('[sendPhoto] Missing photo file in request after busboy processing.');
      return res.status(400).json({ ok: false, description: 'Missing photo file' });
    }
    // --- PERUBAHAN DI SINI: Batas ukuran 10MB untuk sendPhoto ---
    if (buffer.length > 10 * 1024 * 1024) {
      console.error(`[sendPhoto] Photo exceeds 10MB limit. Size: ${buffer.length} bytes`);
      return res.status(413).json({ ok: false, description: 'Photo exceeds 10MB limit' });
    }

    console.log(`[sendPhoto] Final file to process: ${fileName}, size: ${buffer.length} bytes, chat_id: ${chat_id}, caption: "${caption}"`);

    const telegramForm = new FormData();
    telegramForm.append('chat_id', chat_id);
    telegramForm.append('caption', caption);
    // --- PERUBAHAN DI SINI: Menggunakan 'photo' untuk sendPhoto ---
    telegramForm.append('photo', buffer, { filename: fileName });

    const telegramFormHeaders = telegramForm.getHeaders();

    // --- PERUBAHAN DI SINI: Menggunakan endpoint 'sendPhoto' ---
    console.log(`[Telegram] Sending photo directly to chat_id: ${chat_id}`);
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: telegramForm,
      headers: {
        ...telegramFormHeaders,
      }
    });

    const data = await tgRes.json();
    if (!data.ok) {
      console.error(`[Telegram] sendPhoto failed: ${data.description || 'Unknown error'}`);
      return res.status(502).json({ ok: false, description: data.description || 'Telegram error' });
    }
    console.log('[Telegram] sendPhoto successful.');
    return res.status(200).json(data);
  } catch (err) {
    console.error('sendPhoto/sendDocument error:', err); // Log masih menggunakan sendPhoto/sendDocument
    return res.status(500).json({ ok: false, description: err.message });
  }
}
