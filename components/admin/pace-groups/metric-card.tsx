import { Card, CardContent } from '@/components/ui/card';
export function MetricCard({
  icon,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="card-soft">
      <CardContent className="space-y-2 p-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
          {icon}
        </span>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {footer}
      </CardContent>
    </Card>
  );
}
