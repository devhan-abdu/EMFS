export function buildTelegramStartLink(
  code: string,
  username = process.env.TELEGRAM_BOT_USERNAME || 'emfsc_book_shelf_bot',
) {
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}
