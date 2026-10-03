export const SESSIONS_ROUTE = '/sessions';
export const SESSIONS_LIST_ROUTE = SESSIONS_ROUTE;
export const SESSION_DETAIL_ROUTE = `${SESSIONS_ROUTE}/:id`;

export const sessionDetailPath = (id: string): string =>
  `${SESSIONS_ROUTE}/${id}`;
