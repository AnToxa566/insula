import { __resetWebAuthConfigForTests, configureWebAuth } from '../config';
import { ApiClientError } from './api-client-error';
import { rawRequest } from './raw-request';

function fakeResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('rawRequest', () => {
  afterEach(() => {
    __resetWebAuthConfigForTests();
  });

  it('parses a successful JSON response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(200, { hello: 'world' }));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(rawRequest('GET', '/ping')).resolves.toEqual({ hello: 'world' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/ping', expect.objectContaining({ method: 'GET' }));
  });

  it('returns undefined for a 204 response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(204));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(rawRequest('POST', '/logout')).resolves.toBeUndefined();
  });

  it('preserves caller-supplied headers, including Authorization', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(200, {}));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    const headers = new Headers({ Authorization: 'Bearer token-123' });
    await rawRequest('GET', '/me', { headers });

    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('throws an http-kind ApiClientError carrying the status and body on a non-2xx response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(500, { message: 'nope' }));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(rawRequest('GET', '/boom')).rejects.toMatchObject({
      kind: 'http',
      status: 500,
      body: { message: 'nope' },
    });
  });

  it('throws a network-kind ApiClientError when fetch rejects', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    const error = await rawRequest('GET', '/offline').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).kind).toBe('network');
  });

  it('throws a timeout-kind ApiClientError when the abort signal fires', async () => {
    const timeoutError = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    const fetchImpl = jest.fn().mockRejectedValue(timeoutError);
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    const error = await rawRequest('GET', '/slow').catch((e: unknown) => e);
    expect((error as ApiClientError).kind).toBe('timeout');
  });
});
