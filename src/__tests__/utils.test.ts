// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { _spawnPromise } from '../modules/utils.js';

describe('_spawnPromise proxy env support', () => {
  const originalHttpProxy = process.env.http_proxy;
  const originalHttpsProxy = process.env.https_proxy;
  const originalHTTPProxy = process.env.HTTP_PROXY;
  const originalHTTPSProxy = process.env.HTTPS_PROXY;

  beforeEach(() => {
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
  });

  afterEach(() => {
    if (originalHttpProxy === undefined) delete process.env.http_proxy;
    else process.env.http_proxy = originalHttpProxy;
    if (originalHttpsProxy === undefined) delete process.env.https_proxy;
    else process.env.https_proxy = originalHttpsProxy;
    if (originalHTTPProxy === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = originalHTTPProxy;
    if (originalHTTPSProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = originalHTTPSProxy;
  });

  test('propagates http_proxy to HTTP_PROXY', async () => {
    process.env.http_proxy = 'http://127.0.0.1:7890';

    const output = await _spawnPromise(process.execPath, [
      '-e',
      'process.stdout.write(`${process.env.http_proxy}|${process.env.HTTP_PROXY}`)'
    ]);

    expect(output).toBe('http://127.0.0.1:7890|http://127.0.0.1:7890');
  });

  test('propagates https_proxy to HTTPS_PROXY', async () => {
    process.env.https_proxy = 'http://127.0.0.1:7890';

    const output = await _spawnPromise(process.execPath, [
      '-e',
      'process.stdout.write(`${process.env.https_proxy}|${process.env.HTTPS_PROXY}`)'
    ]);

    expect(output).toBe('http://127.0.0.1:7890|http://127.0.0.1:7890');
  });
});
