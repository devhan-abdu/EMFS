export function getTelegramConfig() {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!username || !token) {
    return null;
  }

  return { username, token };
}
