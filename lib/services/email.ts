import 'server-only';

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailOptions): Promise<{ success: boolean; id?: string }> {
  // If an external email provider is configured in the future (e.g. Resend), send through it:
  if (process.env.RESEND_API_KEY) {
    try {
      const from =
        process.env.EMAIL_FROM || 'EMFSC Book Shelf <no-reply@emfs.app>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Email] Failed to send via Resend:', errText);
      } else {
        const data = (await res.json()) as { id?: string };
        return { success: true, id: data.id };
      }
    } catch (err) {
      console.error('[Email] Error dispatching email via Resend:', err);
    }
  }

  // Development / fallback logger
  if (process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY) {
    console.info(
      `\n==================== [OUTGOING EMAIL] ====================\n` +
        `To: ${to}\n` +
        `Subject: ${subject}\n\n` +
        `${text}\n` +
        `==========================================================\n`,
    );
  }

  return { success: true };
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  const subject = 'Reset your EMFSC Book Shelf password';
  const text = `Assalamu alaikum,\n\nWe received a request to reset your EMFSC Book Shelf password.\n\nPlease click the link below to set a new password:\n${url}\n\nThis link is single-use and will expire in 1 hour.\n\nIf you did not request this, please ignore this email; your account remains secure.`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #1c1917; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1c1917; margin-bottom: 16px;">Reset your password</h2>
      <p>Assalamu alaikum,</p>
      <p>We received a request to reset your EMFSC Book Shelf account password.</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="background-color: #047857; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Set new password
        </a>
      </p>
      <p style="font-size: 14px; color: #78716c;">
        Or copy and paste this link into your browser:<br />
        <a href="${url}" style="color: #047857; word-break: break-all;">${url}</a>
      </p>
      <p style="font-size: 13px; color: #a8a29e; margin-top: 32px; border-top: 1px solid #e7e5e4; padding-top: 16px;">
        This single-use link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
}
