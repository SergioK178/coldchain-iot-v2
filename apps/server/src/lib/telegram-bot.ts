import { eq } from 'drizzle-orm';
import type { Db } from '@sensor/db';
import { users } from '@sensor/db';
import { consumeCode } from './telegram-codes.js';

export function startTelegramBot(db: Db, botToken: string): () => void {
  let stopped = false;
  let offset = 0;
  let timer: NodeJS.Timeout | null = null;

  async function send(chatId: string, text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  async function pollOnce() {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?timeout=25&offset=${offset}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: {
          text?: string;
          chat?: { id: number };
        };
      }>;
    };
    if (!json.ok || !json.result) return;

    for (const upd of json.result) {
      offset = upd.update_id + 1;
      const text = upd.message?.text?.trim();
      const chatId = upd.message?.chat?.id;
      if (!text || chatId === undefined) continue;
      const chat = String(chatId);

      if (text === '/start') {
        await send(chat, 'Отправьте одноразовый код из настроек (Настройки → Telegram), чтобы привязать аккаунт.');
        continue;
      }

      if (!/^\d{6}$/.test(text)) {
        await send(chat, 'Введите 6-значный код из настроек.');
        continue;
      }

      const userId = consumeCode(text);
      if (!userId) {
        await send(chat, 'Код истёк или неверный. Сгенерируйте новый в настройках.');
        continue;
      }

      await db.update(users).set({ telegramChatId: chat }).where(eq(users.id, userId));
      await send(chat, 'Telegram привязан. Вы будете получать уведомления о тревогах.');
    }
  }

  const loop = async () => {
    while (!stopped) {
      try {
        await pollOnce();
      } catch (err) {
        console.error('Telegram bot polling error:', err);
      }
      if (!stopped) await new Promise((r) => { timer = setTimeout(r, 1000); });
    }
  };

  void loop();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
