import { AlertCircle } from "lucide-react";

type FormErrorBannerProps = {
  title: string;
  message?: string;
};

export function FormErrorBanner({ title, message }: FormErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div>
        <h4 className="text-sm font-semibold text-destructive">{title}</h4>
        <p className="text-sm text-destructive/80">{message}</p>
      </div>
    </div>
  );
}
