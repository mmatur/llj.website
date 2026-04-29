const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TO = 'leslonguesjournees@gmail.com';
const FROM = 'Site LLJ <contact@leslonguesjournees.fr>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const honeypot = String(body.website || '').trim();

  // Honeypot: silently accept to mislead bots.
  if (honeypot) return res.status(200).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Nom trop long (100 caractères max).' });
  }
  if (!EMAIL_REGEX.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: 'Le message doit contenir entre 10 et 5000 caractères.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Configuration serveur incomplète.' });
  }

  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `[Site LLJ] Nouveau message de ${name}`,
        text: `De : ${name} <${email}>\n\n${message}\n`,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Resend HTTP', resp.status, detail);
      return res.status(502).json({ error: "L'envoi a échoué. Réessayez plus tard." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ error: "Erreur lors de l'envoi du message." });
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
