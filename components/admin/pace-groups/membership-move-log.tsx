/**
 * Server component. There is no listMembershipMoves(batchId) service yet —
 * the membership_move_audit table exists but isn't queried anywhere. This
 * renders a static preview until that service lands.
 */
export function MembershipMoveLog({ batchName }: { batchName: string }) {
  const entries = [
    {
      when: 'Sep 04',
      text: 'Hanan Ibrahim placed in Nur · 10 pages by Hayat A.',
    },
    { when: 'Sep 02', text: 'Ilhan Mohamed approved into the batch' },
    {
      when: 'Aug 30',
      text: 'Sagal Ahmed moved from Sakina to Nur by Ruwayda M.',
    },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <p className="font-display text-base font-semibold text-foreground">
          Membership move history
        </p>
        <p className="text-xs text-muted-foreground">
          Preview only for {batchName} — not yet backed by a real audit query.
        </p>
      </div>
      <ol className="space-y-3 border-l border-border pl-5">
        {entries.map((entry) => (
          <li
            key={entry.text}
            className="relative text-sm text-muted-foreground"
          >
            <span className="absolute -left-[26px] top-1.5 size-2 rounded-full bg-primary" />
            <span className="tabular-nums text-foreground">{entry.when}</span> —{' '}
            {entry.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
