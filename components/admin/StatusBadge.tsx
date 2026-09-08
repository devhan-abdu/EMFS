export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-teal/15 text-teal-foreground border-teal/30",
    running: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-gold/20 text-gold-foreground border-gold/30",
    draft: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? map["draft"]}`}
    >
      {status}
    </span>
  );
}
