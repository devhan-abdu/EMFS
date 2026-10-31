import type { Bot } from 'grammy';
import { BOT_ADMIN_RIGHTS } from './constants';

export async function configureBot(bot: Bot) {
  await bot.api.setMyDefaultAdministratorRights({ rights: BOT_ADMIN_RIGHTS });
}
