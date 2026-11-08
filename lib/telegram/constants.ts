import type { ChatAdministratorRights, Update } from 'grammy/types';

export const BOT_ADMIN_RIGHTS: ChatAdministratorRights = {
  is_anonymous: false,
  can_manage_chat: true,
  can_delete_messages: true,
  can_manage_video_chats: false,
  can_restrict_members: false,
  can_promote_members: true,
  can_change_info: false,
  can_invite_users: true,
  can_pin_messages: true,
  can_manage_topics: true,
  can_post_stories: false,
  can_edit_stories: false,
  can_delete_stories: false,
  can_send_welcome_messages: false,
};

export const ALLOWED_UPDATES = [
  'message',
  'callback_query',
  'my_chat_member',
] as const;
