import { Telegraf } from "telegraf";
import { eq, and, isNull } from "drizzle-orm";
import { handoffRecords } from "@/db/schema";
import { activateMembership } from "./membership";

export function buildTelegramStartLink(
  code: string,
  username = process.env.TELEGRAM_BOT_USERNAME ||
    "emfsc_book_shelf_bot",
) {

  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}

export function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }

  return new Telegraf(token);
}

const bot = getBot();

if (bot) {
  bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    const chatId = ctx.chat.id;

    const { db } = await import("@/db");

    if (!payload) {
      await ctx.reply("Welcome! Please use the link provided after your application was approved.");
      return;
    }

    const handoff = await db.query.handoffRecords.findFirst({
      where: and(eq(handoffRecords.code, payload), isNull(handoffRecords.usedAt)),
    });

    if (!handoff) {
      await ctx.reply("This code is invalid or has already been used. Please contact your batch admin.");
      return;
    }

    try {
      await db.transaction(async (tx) => {
        await tx.update(handoffRecords)
          .set({ telegramChatId: chatId, usedAt: new Date() })
          .where(and(eq(handoffRecords.id, handoff.id), isNull(handoffRecords.usedAt)));

        await activateMembership(handoff.applicationId, "system", tx);
      });

      await ctx.reply("You're linked and fully activated! Welcome to the batch 🎉");
    } catch (err) {
      await ctx.reply("Something went wrong activating your membership. Please contact your batch admin.");
    }
  });
}

export default bot;