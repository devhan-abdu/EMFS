import Link from 'next/link';
import type { Metadata } from 'next';

import { Lotus, LotusWatermark } from '@/components/brand/lotus';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password — EMFSC Book Shelf',
  description: 'Set a new password for your EMFSC Book Shelf account.',
  openGraph: {
    title: 'Set New Password — EMFSC Book Shelf',
    description: 'Set a new password for your EMFSC reading account.',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.ico' },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token, error } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-16 text-primary-foreground lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <LotusWatermark className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 text-primary-foreground/10" />
        <Link href="/" className="relative flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-foreground/10">
            <Lotus className="size-10" />
          </span>
          <span className="font-display text-xl font-semibold">
            EMFSC Book Shelf
          </span>
        </Link>
        <div className="relative max-w-md space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">
            Secure your account
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Choose a strong new password.
          </h2>
          <p className="text-sm leading-relaxed text-primary-foreground/70">
            Create a unique password that is at least 8 characters long to keep
            your reading history and account safe.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/50">
          Ethiopian Muslim Female Students Circle
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-14 md:px-10">
        <div className="w-full max-w-sm rise-in">
          <Link href="/" className="mb-8 flex items-center gap-4 lg:hidden">
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
              <Lotus className="size-10" />
            </span>
            <span className="font-display text-xl font-semibold text-foreground">
              EMFSC Book Shelf
            </span>
          </Link>

          <h1 className="font-display text-3xl font-semibold text-foreground">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter and confirm your new password below.
          </p>

          <ResetPasswordForm token={token} error={error} />
        </div>
      </main>
    </div>
  );
}
