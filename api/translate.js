
/**
 * Vercel Serverless Function: Google Translate Integration (CommonJS)
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, target } = req.body;

  if (!text || !target) {
    return res.status(400).json({ error: 'Missing text or target language' });
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation API error');

    const data = await response.json();
    const translatedText = data[0].map(item => item[0]).join('');

    return res.status(200).json({ translated: translatedText });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
