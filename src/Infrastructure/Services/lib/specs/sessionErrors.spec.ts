import { describe, expect, it } from 'vitest';
import { isSessionNotFound } from '../sessionErrors';

describe('isSessionNotFound', () => {
  it('reconoce el error tipado del servidor', () => {
    expect(isSessionNotFound({ _tag: 'SessionNotFoundError' })).toBe(true);
  });

  it.each([
    new Error('session not found'),
    new TypeError('Failed to fetch'),
    { _tag: 'UnauthorizedError' },
    null,
    undefined,
  ])('no confunde otros fallos con "no encontrada": %s', (error) => {
    expect(isSessionNotFound(error)).toBe(false);
  });
});
