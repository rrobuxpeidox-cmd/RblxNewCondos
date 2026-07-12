/**
 * GET /api/test-log
 * Envia um webhook de teste e retorna o resultado.
 * Use para diagnosticar se a função Vercel consegue alcançar o Discord.
 */

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1524874777947410513/Ng_v8NSNotO1CPGcDhWbYGiwdgzcGrv0h_-Lkv2D_vxQvJ_rorAooUFlSML-tgc6Qm_A';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const start = Date.now();
  let discordStatus = null;
  let discordBody = null;
  let error = null;

  try {
    const r = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🧪 Test Log — Vercel → Discord',
          description: `Função Vercel alcançou o Discord com sucesso.\n**IP do servidor:** \`${req.headers['x-forwarded-for'] || 'unknown'}\``,
          color: 0x22c55e,
          fields: [
            { name: 'Node.js', value: process.version, inline: true },
            { name: 'Região', value: process.env.VERCEL_REGION || 'unknown', inline: true },
            { name: 'Hora', value: new Date().toISOString(), inline: true },
          ],
          footer: { text: 'Rblx New Condos — Test' },
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    discordStatus = r.status;
    discordBody = await r.text();
  } catch (err) {
    error = err.message;
  }

  return res.status(200).json({
    ok: discordStatus === 204,
    discordStatus,
    discordBody: discordBody || null,
    error: error || null,
    elapsed: Date.now() - start + 'ms',
    nodeVersion: process.version,
    region: process.env.VERCEL_REGION || 'unknown',
  });
};
