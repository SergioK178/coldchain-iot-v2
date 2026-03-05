/** Send a text message via Telegram Bot API. */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API: ${res.status} ${err}`);
  }
}

export function formatAlertMessage(payload: {
  device?: { serial?: string; displayName?: string | null };
  rule?: { metric: string; operator: string; threshold: number };
  reading?: { value: number };
}): string {
  const d = payload.device;
  const r = payload.rule;
  const v = payload.reading?.value;
  const name = d?.displayName || d?.serial || '—';
  const metric = r?.metric === 'temperature_c' ? 'Температура' : r?.metric === 'humidity_pct' ? 'Влажность' : r?.metric || '—';
  return `\u26A0 <b>Тревога</b>\nУстройство: ${escapeHtml(String(name))}\n${metric}: ${v ?? '—'} (порог: ${r?.threshold ?? '—'})`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
