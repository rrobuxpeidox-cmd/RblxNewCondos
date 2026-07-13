
/**
 * Vercel Serverless Function: IP-based Locale Detection (CommonJS)
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

  // Vercel fornece o IP real no cabeçalho 'x-real-ip' ou no primeiro valor de 'x-forwarded-for'
  const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  
  try {
    // Usando ipapi.co para obter informações de geolocalização
    const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const geoData = await geoRes.json();
    
    // Mapeamento simples de país para idioma
    const countryToLang = {
      'BR': 'pt', 'PT': 'pt', 'ES': 'es', 'MX': 'es', 'AR': 'es',
      'RU': 'ru', 'FR': 'fr', 'DE': 'de', 'IT': 'it', 'JP': 'ja',
      'CN': 'zh', 'KR': 'ko'
    };

    const lang = countryToLang[geoData.country_code] || 'en';

    return res.status(200).json({
      lang: lang,
      country: geoData.country_code || 'US',
      ip: ip
    });
  } catch (error) {
    return res.status(200).json({ lang: 'en', error: error.message, ip: ip });
  }
};
