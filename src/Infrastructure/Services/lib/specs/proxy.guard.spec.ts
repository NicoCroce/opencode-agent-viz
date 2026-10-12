import { describe, expect, it } from 'vitest';
import {
  isAllowedProxyRequest,
  isLoopbackAddress,
  isLoopbackUrl,
  normalizeRemoteAddress,
} from '../proxy.guard';

/**
 * FR-018 · H2/H3 (`contracts/dev-server-hardening-contract.md`): el guard del
 * proxy `/oc` sólo deja pasar peticiones con socket loopback **y** `Origin` o
 * `Referer` de loopback; un origen ausente se rechaza (no hay loopback).
 */

describe('normalizeRemoteAddress', () => {
  it('desmapea la IPv4 mapeada en IPv6', () => {
    expect(normalizeRemoteAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
  });

  it('deja intacta una dirección que no está mapeada', () => {
    expect(normalizeRemoteAddress('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeRemoteAddress('192.168.1.10')).toBe('192.168.1.10');
  });
});

describe('isLoopbackAddress', () => {
  it('acepta loopback IPv4, IPv6, `localhost` y IPv4 mapeada', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('[::1]')).toBe(true);
    expect(isLoopbackAddress('localhost')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('rechaza direcciones ausentes o no loopback', () => {
    expect(isLoopbackAddress(undefined)).toBe(false);
    expect(isLoopbackAddress('192.168.1.10')).toBe(false);
    expect(isLoopbackAddress('10.0.0.5')).toBe(false);
    expect(isLoopbackAddress('0.0.0.0')).toBe(false);
  });
});

describe('isLoopbackUrl', () => {
  it('acepta URLs cuyo hostname es loopback, con cualquier puerto', () => {
    expect(isLoopbackUrl('http://127.0.0.1:5173')).toBe(true);
    expect(isLoopbackUrl('http://localhost:5173/chat')).toBe(true);
    expect(isLoopbackUrl('http://[::1]:5173')).toBe(true);
  });

  it('rechaza URLs externas, ausentes o malformadas', () => {
    expect(isLoopbackUrl(undefined)).toBe(false);
    expect(isLoopbackUrl('')).toBe(false);
    expect(isLoopbackUrl('http://evil.example.com')).toBe(false);
    expect(isLoopbackUrl('http://127.0.0.1.evil.com')).toBe(false);
    expect(isLoopbackUrl('not-a-url')).toBe(false);
  });
});

describe('isAllowedProxyRequest', () => {
  it('H3: acepta socket loopback con Origin loopback', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: '127.0.0.1',
        origin: 'http://localhost:5173',
        referer: undefined,
      }),
    ).toBe(true);
  });

  it('H3: acepta socket loopback con Referer loopback aunque falte Origin', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: '::ffff:127.0.0.1',
        origin: undefined,
        referer: 'http://127.0.0.1:5173/chat',
      }),
    ).toBe(true);
  });

  it('H2: rechaza socket no loopback aunque el Origin sea loopback', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: '192.168.1.10',
        origin: 'http://localhost:5173',
        referer: 'http://localhost:5173/chat',
      }),
    ).toBe(false);
  });

  it('rechaza cuando falta el socket remoto', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: undefined,
        origin: 'http://localhost:5173',
        referer: undefined,
      }),
    ).toBe(false);
  });

  it('rechaza Origin/Referer externos', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: '127.0.0.1',
        origin: 'http://evil.example.com',
        referer: undefined,
      }),
    ).toBe(false);
    expect(
      isAllowedProxyRequest({
        remoteAddress: '127.0.0.1',
        origin: undefined,
        referer: 'http://evil.example.com/attack',
      }),
    ).toBe(false);
  });

  it('rechaza cuando Origin y Referer están ausentes (no son loopback)', () => {
    expect(
      isAllowedProxyRequest({
        remoteAddress: '127.0.0.1',
        origin: undefined,
        referer: undefined,
      }),
    ).toBe(false);
  });
});
