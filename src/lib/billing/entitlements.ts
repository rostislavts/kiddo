export type SubscriptionState = {
  status: string;
  periodEnd: Date | null;
  paddlePriceId: string;
};
export function canAccessPremium(
  subscriptions: SubscriptionState[],
  priceId: string | undefined,
  now = new Date(),
): boolean {
  return (
    !!priceId &&
    subscriptions.some(
      (s) =>
        s.paddlePriceId === priceId &&
        ["active", "trialing"].includes(s.status) &&
        !!s.periodEnd &&
        s.periodEnd > now,
    )
  );
}
export function isNewerEvent(incoming: Date, previous: Date): boolean {
  return incoming > previous;
}
export function shouldApplySubscriptionEvent(
  incoming: Date,
  previous: Date,
  status: string,
  previousStatus: string,
) {
  if (isNewerEvent(incoming, previous)) return true;
  // Millisecond-equal events may arrive in either order. Revoke conservatively
  // rather than allowing an older activation to undo a cancellation.
  const priority: Record<string, number> = {
    trialing: 0,
    active: 1,
    past_due: 2,
    paused: 3,
    canceled: 4,
  };
  return (
    incoming.getTime() === previous.getTime() &&
    (priority[status] ?? -1) > (priority[previousStatus] ?? -1)
  );
}
