import { claimFootballAlertSlot, closeDatabase, footballFixturesForAlert } from './database.js';

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const parisTime = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

async function sendSms(config, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_SMS_FROM, ODDS_SMS_TO } = config;
  const credentials = Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ From: TWILIO_SMS_FROM, To: ODDS_SMS_TO, Body: body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Twilio a répondu HTTP ${response.status}${Number.isInteger(error.code) ? ` (code ${error.code})` : ''}.`);
  }
}

async function telegramRequest(method, payload) {
  const token = process.env.ODDS_TELEGRAM_BOT_TOKEN ?? '';
  if (!/^\d+:[\w-]+$/.test(token)) throw new Error('Renseignez ODDS_TELEGRAM_BOT_TOKEN dans le .env d’Odds.');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram a refusé ${method} (HTTP ${response.status}).`);
  return data.result;
}

async function sendTelegram(text) {
  await telegramRequest('sendMessage', { chat_id: process.env.ODDS_TELEGRAM_CHAT_ID, text });
}

async function main() {
  if (process.argv.includes('--telegram-chat')) {
    const updates = await telegramRequest('getUpdates', { allowed_updates: ['message'] });
    const ids = [...new Set(updates.filter(({ message }) =>
      message?.chat.type === 'private' && /^\/start(?:\s|$)/.test(message.text ?? ''),
    ).map(({ message }) => message.chat.id))];
    if (!ids.length) throw new Error('Envoie /start au bot Telegram puis relance la commande.');
    console.log('Identifiants de conversation Telegram :', ids.join(', '));
    return;
  }

  const send = process.argv.includes('--send');
  const testTelegram = process.argv.includes('--test-telegram');
  const config = process.env;
  const channel = config.ODDS_ALERT_CHANNEL ?? 'sms';
  if (send && !['sms', 'telegram'].includes(channel)) throw new Error('Canal d’alerte inconnu.');
  if (testTelegram || (send && channel === 'telegram')) {
    if (!/^\d+$/.test(config.ODDS_TELEGRAM_CHAT_ID ?? '') || !/^\d+:[\w-]+$/.test(config.ODDS_TELEGRAM_BOT_TOKEN ?? '')) {
      throw new Error('Configuration Telegram incomplète dans le .env d’Odds.');
    }
  }
  if (testTelegram) {
    await sendTelegram('Bonjour ! Les alertes de matchs OddsBoost peuvent arriver sur Telegram.');
    console.log('Message de test accepté par Telegram.');
    return;
  }
  const now = Date.now();
  const slot = new Date(Math.floor(now / hourMs) * hourMs);
  if (send && channel === 'sms' && (!/^AC[\da-f]{32}$/i.test(config.TWILIO_ACCOUNT_SID ?? '')
    || !config.TWILIO_API_KEY_SID || !config.TWILIO_API_KEY_SECRET || !config.TWILIO_SMS_FROM
    || !/^\+[1-9]\d{7,14}$/.test(config.ODDS_SMS_TO ?? ''))) {
    throw new Error('Configuration SMS incomplète dans le fichier .env d’Odds.');
  }
  if (send && now - slot.getTime() >= 10 * minuteMs) {
    throw new Error('Le créneau horaire est passé. Lancez l’envoi dans les dix premières minutes de l’heure.');
  }
  const fixtures = await footballFixturesForAlert(
    new Date(slot.getTime() - 15 * minuteMs), new Date(slot.getTime() + 30 * minuteMs),
  );
  if (!fixtures.length) {
    console.log('Aucun match dans le créneau.');
  } else {
    const heading = `OddsBoost · Matchs autour de ${parisTime.format(slot)} (Paris)`;
    const lines = fixtures.map((match) => `${match.matchTime} ${match.homeTeam} – ${match.awayTeam} (${match.competition})`);
    let body = heading;
    let shown = 0;
    const maxLength = channel === 'telegram' ? 4000 : 1500;
    for (const line of lines) {
      if (body.length + line.length + 1 > maxLength) break;
      body += `\n${line}`;
      shown++;
    }
    if (shown < lines.length) body += `\n+${lines.length - shown} dans Matchs du jour.`;
    if (!send) console.log(body);
    else if (await claimFootballAlertSlot(slot.toISOString())) {
      if (channel === 'telegram') await sendTelegram(body);
      else await sendSms(config, body);
      console.log(`Alerte acceptée par le canal ${channel}.`);
    } else console.log('Créneau déjà traité.');
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
