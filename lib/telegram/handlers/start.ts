import type { Bot } from 'grammy';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { handoffRecords } from '@/db/schema';
import { activateMembership } from '@/lib/services/membership';

/**
 * Private-chat `/start <code>` handoff: links the applicant's chat and activates
 * their membership. Behavior is unchanged from the previous Telegraf bot.
 */
export function registerStartHandler(
  bot: Bot,
  onMembershipActivated: () => void,
) {
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const payload = ctx.match.trim();
    if (!payload) {
      await ctx.reply(
        'Welcome! Please use the link provided after your application was approved.',
      );
      return;
    }

    const handoff = await db.query.handoffRecords.findFirst({
      where: and(
        eq(handoffRecords.code, payload),
        isNull(handoffRecords.usedAt),
      ),
    });
    if (!handoff) {
      await ctx.reply(
        'This code is invalid or has already been used. Please contact your batch admin.',
      );
      return;
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(handoffRecords)
          .set({ telegramChatId: BigInt(ctx.chat.id), usedAt: new Date() })
          .where(
            and(
              eq(handoffRecords.id, handoff.id),
              isNull(handoffRecords.usedAt),
            ),
          );
        await activateMembership(handoff.applicationId, null, tx);
      });

      onMembershipActivated();
      await ctx.reply(
        "You're linked and fully activated! Welcome to the batch 🎉",
      );
    } catch (error) {
      console.error('Bot activation failed:', error);
      await ctx.reply(
        'Something went wrong activating your membership. Please contact your batch admin.',
      );
    }
  });
}
