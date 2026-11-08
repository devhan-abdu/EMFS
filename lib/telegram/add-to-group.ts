export function buildAddToGroupLink(botUsername: string, payload: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(payload)) {
    throw new Error('Invalid payload');
  }

  return `https://t.me/${botUsername}?startgroup=${payload}`;
}

export function buildTelegramStartLink(
  code: string,
  username = process.env.TELEGRAM_BOT_USERNAME || 'emfsc_book_shelf_bot',
) {
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}
