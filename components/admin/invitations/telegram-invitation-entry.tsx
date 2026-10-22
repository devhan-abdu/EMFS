'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

import { captureTelegramInvitationAction } from '@/actions/invitations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
      };
    };
  }
}

export function TelegramInvitationEntry() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const processedRef = useRef(false);

  const processInitData = useCallback(async () => {
    if (processedRef.current) return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.initData) {
      setLoading(false);
      setError('Open this invitation from Telegram to continue.');
      return;
    }

    processedRef.current = true;
    webApp.ready();
    const result = await captureTelegramInvitationAction(webApp.initData);
    if (result.ok) {
      window.location.assign(result.redirectTo);
      return;
    }
    setLoading(false);
    setError(result.error);
  }, []);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      void Promise.resolve().then(() => processInitData());
    }
  }, [processInitData]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => void processInitData()}
      />
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="card-soft w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              Telegram invitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              role={error ? 'alert' : 'status'}
              className="text-sm text-muted-foreground"
            >
              {error ??
                (loading
                  ? 'Verifying your invitation…'
                  : 'Continue in Telegram.')}
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
