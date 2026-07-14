
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
    const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
    const geoData = await geoRes.json();
    
    // Mapeamento expandido para suporte universal
    const countryToLang = {
      // Latin America & Spain
      'AR': 'es', 'BO': 'es', 'CL': 'es', 'CO': 'es', 'CR': 'es', 'CU': 'es', 'DO': 'es', 'EC': 'es', 'SV': 'es', 'GT': 'es', 'HN': 'es', 'MX': 'es', 'NI': 'es', 'PA': 'es', 'PY': 'es', 'PE': 'es', 'PR': 'es', 'ES': 'es', 'UY': 'es', 'VE': 'es',
      // Portuguese
      'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt', 'CV': 'pt', 'GW': 'pt', 'ST': 'pt', 'TL': 'pt',
      // Europe
      'FR': 'fr', 'DE': 'de', 'IT': 'it', 'RU': 'ru', 'UA': 'uk', 'PL': 'pl', 'NL': 'nl', 'BE': 'nl', 'TR': 'tr', 'GR': 'el', 'RO': 'ro', 'HU': 'hu', 'CZ': 'cs', 'SE': 'sv', 'NO': 'no', 'DK': 'da', 'FI': 'fi',
      // Asia
      'CN': 'zh-CN', 'TW': 'zh-TW', 'HK': 'zh-TW', 'JP': 'ja', 'KR': 'ko', 'VN': 'vi', 'TH': 'th', 'ID': 'id', 'MY': 'ms', 'PH': 'tl', 'IN': 'hi', 'PK': 'ur', 'BD': 'bn',
      // Middle East
      'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'MA': 'ar', 'DZ': 'ar', 'IQ': 'ar', 'IL': 'he', 'IR': 'fa'
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
