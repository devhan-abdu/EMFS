import { ADMIN_LINK_RIGHTS } from './constants';

export function buildAddToGroupLink(botUsername: string, payload: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(payload))
    throw new Error('Invalid payload');
  return (
    `https://t.me/${botUsername}?startgroup=${payload}` +
    `&admin=${ADMIN_LINK_RIGHTS.join('+')}`
  );
}
