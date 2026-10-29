import type { Metadata } from 'next';

import { TelegramInvitationEntry } from '@/components/admin/invitations/telegram-invitation-entry';

export const metadata: Metadata = {
  title: 'Telegram invitation — EMFSC Book Shelf',
  robots: { index: false, follow: false },
};

export default function TelegramInvitationPage() {
  return <TelegramInvitationEntry />;
}
