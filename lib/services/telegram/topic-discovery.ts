import { and, eq } from 'drizzle-orm';

import type { DbOrTx } from '@/lib/services/membership';

import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
  telegramTopicDiscoveries,
} from '@/db/schema';
import {
  createPaceGroupInTransaction,
  type PaceGroupRow,
} from '@/lib/services/pace-groups/pace-group';
import type { CreatePaceGroupInput } from '@/lib/validations/pace-group';
import { telegramTopicNameSchema } from '@/lib/validations/telegram';

export class TelegramTopicDiscoveryError extends Error {
  constructor(
    public readonly code:
      | 'CHAT_NOT_CONNECTED'
      | 'NOT_MANUAL_MODE'
      | 'CHAT_NOT_ACTIVE'
      | 'INVALID_THREAD_ID'
      | 'INVALID_TOPIC_NAME'
      | 'PACE_GROUP_NOT_FOUND'
      | 'TOPIC_ALREADY_MAPPED'
      | 'DISCOVERY_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'TelegramTopicDiscoveryError';
  }
}

export async function registerDiscoveredTopic(
  executor: DbOrTx,
  input: {
    chatId: bigint;
    messageThreadId: number;
    topicName: string;
  },
) {
  const parsedTopicName = telegramTopicNameSchema.safeParse(input.topicName);
  if (!parsedTopicName.success) {
    throw new TelegramTopicDiscoveryError(
      'INVALID_TOPIC_NAME',
      parsedTopicName.error.issues[0]?.message ??
        'Invalid Telegram topic name.',
    );
  }
  const topicName = parsedTopicName.data;
  const { chatId, messageThreadId } = input;

  if (!Number.isInteger(messageThreadId) || messageThreadId <= 0) {
    throw new TelegramTopicDiscoveryError(
      'INVALID_THREAD_ID',
      'Invalid Telegram topic ID.',
    );
  }

  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, chatId),
    columns: {
      id: true,
      status: true,
      batchId: true,
    },
  });

  if (!chat) {
    throw new TelegramTopicDiscoveryError(
      'CHAT_NOT_CONNECTED',
      'This Telegram group is not connected to EMFS.',
    );
  }

  if (chat.status !== 'active') {
    throw new TelegramTopicDiscoveryError(
      'CHAT_NOT_ACTIVE',
      'The Telegram connection is not active.',
    );
  }

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, chat.batchId),
    columns: {
      id: true,
      telegramTopicSyncMode: true,
    },
  });
  if (batch?.telegramTopicSyncMode !== 'manual') {
    throw new TelegramTopicDiscoveryError(
      'NOT_MANUAL_MODE',
      'Topic registration is only available for manually managed groups.',
    );
  }

  const [discovery] = await executor
    .insert(telegramTopicDiscoveries)
    .values({
      telegramChatId: chat.id,
      messageThreadId,
      topicName,
    })
    .onConflictDoUpdate({
      target: [
        telegramTopicDiscoveries.telegramChatId,
        telegramTopicDiscoveries.messageThreadId,
      ],
      set: { topicName },
    })
    .returning({
      id: telegramTopicDiscoveries.id,
    });

  if (!discovery) {
    throw new TelegramTopicDiscoveryError(
      'DISCOVERY_NOT_FOUND',
      'Could not save this Telegram topic registration.',
    );
  }

  return {
    registered: true as const,
    discoveryId: discovery.id,
    message: 'Topic registered successfully.',
  };
}

export async function mapDiscoveredTopic(
  executor: DbOrTx,
  input: {
    batchId: string;
    discoveryId: string;
    paceGroupId: string;
  },
) {
  return executor.transaction(async (tx) => {
    const batch = await tx.query.batches.findFirst({
      where: eq(batches.id, input.batchId),
      columns: {
        id: true,
        telegramTopicSyncMode: true,
      },
    });

    if (batch?.telegramTopicSyncMode !== 'manual') {
      throw new TelegramTopicDiscoveryError(
        'NOT_MANUAL_MODE',
        'Existing topics can only be mapped for a manually connected group.',
      );
    }

    const chat = await tx.query.telegramChats.findFirst({
      where: eq(telegramChats.batchId, input.batchId),
      columns: {
        id: true,
        status: true,
      },
    });

    if (!chat) {
      throw new TelegramTopicDiscoveryError(
        'CHAT_NOT_CONNECTED',
        'This batch has no connected Telegram group.',
      );
    }

    if (chat.status !== 'active') {
      throw new TelegramTopicDiscoveryError(
        'CHAT_NOT_ACTIVE',
        'The Telegram connection is not active.',
      );
    }

    const paceGroup = await tx.query.paceGroups.findFirst({
      where: and(
        eq(paceGroups.id, input.paceGroupId),
        eq(paceGroups.batchId, input.batchId),
        eq(paceGroups.archived, false),
      ),
      columns: { id: true },
    });

    if (!paceGroup) {
      throw new TelegramTopicDiscoveryError(
        'PACE_GROUP_NOT_FOUND',
        'Choose an active pace group from this batch.',
      );
    }

    const discovery = await tx.query.telegramTopicDiscoveries.findFirst({
      where: and(
        eq(telegramTopicDiscoveries.id, input.discoveryId),
        eq(telegramTopicDiscoveries.telegramChatId, chat.id),
      ),
      columns: {
        id: true,
        messageThreadId: true,
        topicName: true,
      },
    });

    if (!discovery) {
      throw new TelegramTopicDiscoveryError(
        'DISCOVERY_NOT_FOUND',
        'This registered topic is no longer available to map.',
      );
    }

    const [existingMapping] = await tx
      .select({ id: telegramChatTopics.id })
      .from(telegramChatTopics)
      .where(
        and(
          eq(telegramChatTopics.telegramChatId, chat.id),
          eq(telegramChatTopics.messageThreadId, discovery.messageThreadId),
        ),
      )
      .limit(1);

    if (existingMapping) {
      throw new TelegramTopicDiscoveryError(
        'TOPIC_ALREADY_MAPPED',
        'This Telegram topic is already mapped.',
      );
    }

    const [existingPaceMapping] = await tx
      .select({ id: telegramChatTopics.id })
      .from(telegramChatTopics)
      .where(eq(telegramChatTopics.paceGroupId, paceGroup.id))
      .limit(1);

    if (existingPaceMapping) {
      throw new TelegramTopicDiscoveryError(
        'TOPIC_ALREADY_MAPPED',
        'This pace group already has a Telegram topic mapping.',
      );
    }

    const [mapping] = await tx
      .insert(telegramChatTopics)
      .values({
        telegramChatId: chat.id,
        messageThreadId: discovery.messageThreadId,
        kind: 'pace_group',
        paceGroupId: paceGroup.id,
        name: discovery.topicName,
      })
      .onConflictDoNothing()
      .returning({ id: telegramChatTopics.id });

    if (!mapping) {
      throw new TelegramTopicDiscoveryError(
        'TOPIC_ALREADY_MAPPED',
        'This Telegram topic or pace group was mapped by another request.',
      );
    }

    await tx
      .delete(telegramTopicDiscoveries)
      .where(eq(telegramTopicDiscoveries.id, discovery.id));

    return {
      message: 'Telegram topic mapped to the pace group.',
      mappingId: mapping.id,
    };
  });
}

export async function createPaceGroupForDiscoveredTopic(
  executor: DbOrTx,
  input: Omit<CreatePaceGroupInput, 'overridePlannedCount'> & {
    discoveryId: string;
  },
): Promise<{ paceGroup: PaceGroupRow; message: string }> {
  return executor.transaction(async (tx) => {
    const batch = await tx.query.batches.findFirst({
      where: eq(batches.id, input.batchId),
      columns: {
        id: true,
        telegramTopicSyncMode: true,
      },
    });

    if (batch?.telegramTopicSyncMode !== 'manual') {
      throw new TelegramTopicDiscoveryError(
        'NOT_MANUAL_MODE',
        'Existing topics can only be connected to manually managed groups.',
      );
    }

    const chat = await tx.query.telegramChats.findFirst({
      where: eq(telegramChats.batchId, input.batchId),
      columns: {
        id: true,
        status: true,
      },
    });

    if (!chat) {
      throw new TelegramTopicDiscoveryError(
        'CHAT_NOT_CONNECTED',
        'This batch has no connected Telegram group.',
      );
    }

    if (chat.status !== 'active') {
      throw new TelegramTopicDiscoveryError(
        'CHAT_NOT_ACTIVE',
        'The Telegram connection is not active.',
      );
    }

    const discovery = await tx.query.telegramTopicDiscoveries.findFirst({
      where: and(
        eq(telegramTopicDiscoveries.id, input.discoveryId),
        eq(telegramTopicDiscoveries.telegramChatId, chat.id),
      ),
      columns: {
        id: true,
        messageThreadId: true,
        topicName: true,
      },
    });

    if (!discovery) {
      throw new TelegramTopicDiscoveryError(
        'DISCOVERY_NOT_FOUND',
        'This registered topic is no longer available.',
      );
    }

    const [existingMapping] = await tx
      .select({ id: telegramChatTopics.id })
      .from(telegramChatTopics)
      .where(
        and(
          eq(telegramChatTopics.telegramChatId, chat.id),
          eq(telegramChatTopics.messageThreadId, discovery.messageThreadId),
        ),
      )
      .limit(1);

    if (existingMapping) {
      throw new TelegramTopicDiscoveryError(
        'TOPIC_ALREADY_MAPPED',
        'This Telegram topic is already mapped.',
      );
    }

    const paceGroup = await createPaceGroupInTransaction(tx, {
      ...input,
      overridePlannedCount: false,
    });

    const [mapping] = await tx
      .insert(telegramChatTopics)
      .values({
        telegramChatId: chat.id,
        messageThreadId: discovery.messageThreadId,
        kind: 'pace_group',
        paceGroupId: paceGroup.id,
        name: discovery.topicName,
      })
      .onConflictDoNothing()
      .returning({ id: telegramChatTopics.id });

    if (!mapping) {
      throw new TelegramTopicDiscoveryError(
        'TOPIC_ALREADY_MAPPED',
        'This Telegram topic or pace group was mapped by another request.',
      );
    }

    await tx
      .delete(telegramTopicDiscoveries)
      .where(eq(telegramTopicDiscoveries.id, discovery.id));

    return {
      paceGroup,
      message: 'Pace group created and Telegram topic connected.',
    };
  });
}
