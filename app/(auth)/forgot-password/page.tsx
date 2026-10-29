import Link from 'next/link';
import type { Metadata } from 'next';

import { Lotus, LotusWatermark } from '@/components/brand/lotus';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password — EMFSC Book Shelf',
  description:
    'Reset your password for the EMFSC Book Shelf reading community.',
  openGraph: {
    title: 'Forgot Password — EMFSC Book Shelf',
    description: 'Reset your password for your EMFSC reading account.',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.ico' },
};

export default function ForgotPasswordPage() {
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
            Account recovery
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Regain access to your reading journey.
          </h2>
          <p className="text-sm leading-relaxed text-primary-foreground/70">
            Enter your email address and we will send you a secure link to reset
            your password and get back to your reading batch.
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
            Forgot password?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email associated with your account.
          </p>

          <ForgotPasswordForm />
        </div>
      </main>
    </div>
  );
}
