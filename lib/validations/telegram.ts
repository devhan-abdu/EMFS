import { z } from 'zod';

/** Unambiguous alphabet (no 0/O, 1/I/L) so codes are easy to type in a chat. */
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_TTL_MINUTES = 15;
export const MAX_TOPIC_NAME_LENGTH = 128;

const linkCodeRegex = new RegExp(
  `^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`,
);

export const batchIdSchema = z.string().uuid('Invalid batch ID.');

export const linkCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(linkCodeRegex, 'Invalid link code.');

/** Only groups can be linked. Group and supergroup ids are negative. */
export const groupChatIdSchema = z
  .bigint()
  .refine((id) => id < BigInt(0), 'Only group chats can be linked.');

export const threadIdSchema = z.number().int().positive();

/** Telegram topic names are 1-128 characters. */
export const topicNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TOPIC_NAME_LENGTH);

export const batchActionSchema = z.object({ batchId: batchIdSchema });
export type BatchActionInput = z.infer<typeof batchActionSchema>;

export const consumeLinkCodeSchema = z.object({
  code: linkCodeSchema,
  chatId: groupChatIdSchema,
  title: z
    .string()
    .trim()
    .max(255)
    .nullish()
    .transform((v) => v || null),
  isForum: z.boolean(),
  canManageTopics: z.boolean(),
});
export type ConsumeLinkCodeInput = z.input<typeof consumeLinkCodeSchema>;

/** Argument of `/link CODE`. Returns null when malformed. */
export function parseLinkArgument(raw: string): string | null {
  const parsed = linkCodeSchema.safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
}

export type TopicCommand =
  | { kind: 'pace'; name: string | null }
  | { kind: 'announcement' }
  | { kind: 'unmap' };

/**
 * Argument of `/topic ...`:
 *   pace [pace group name] | announcement | unmap
 */
export function parseTopicCommand(raw: string): TopicCommand | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (/^announcement$/i.test(text)) return { kind: 'announcement' };
  if (/^unmap$/i.test(text)) return { kind: 'unmap' };
  // `pace` alone means "use this topic's own name"; `pace <name>` names the group.
  const pace = /^pace(?: (.+))?$/i.exec(text);
  if (pace) {
    const name = pace[1] ?? null;
    if (name === null || name.length <= MAX_TOPIC_NAME_LENGTH) {
      return { kind: 'pace', name };
    }
  }
  return null;
}
