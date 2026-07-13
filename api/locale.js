
/**
 * Vercel Serverless Function: IP-based Locale Detection (Simplified)
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
  
  try {
    // Usando ip-api.com (endpoint gratuito)
    const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
    const geoData = await geoRes.json();
    
    const countryToLang = {
      'BR': 'pt', 'PT': 'pt', 'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es',
      'RU': 'ru', 'FR': 'fr', 'DE': 'de', 'IT': 'it', 'JP': 'ja', 'CN': 'zh', 'KR': 'ko'
    };

    const lang = countryToLang[geoData.countryCode] || 'en';

    return res.status(200).json({
      lang: lang,
      country: geoData.countryCode || 'US',
      status: geoData.status,
      ip: ip
    });
  } catch (error) {
    return res.status(200).json({ lang: 'en', error: error.message });
  }
};
