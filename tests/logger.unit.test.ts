import { setLevel, getLevel, debug, info, syncFlush } from '../src/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';

const logPath = path.join(os.homedir(), '.config', 'opencode', 'multi-account', 'debug.log');

function readLog(): string {
  try { return fs.readFileSync(logPath, 'utf8'); } catch (e) { return ''; }
}

describe('logger unit', () => {
  beforeEach(() => {
    try { fs.unlinkSync(logPath); } catch (e) {}
  });

  test('set/get level', () => {
    setLevel('silent');
    expect(getLevel()).toBe('silent');
    setLevel('debug');
    expect(getLevel()).toBe('debug');
  });

  test('silent suppresses logs', async () => {
    setLevel('silent');
    debug('this should not be written', { foo: 'bar' });
    await syncFlush();
    expect(readLog()).toBe('');
  });

  test('debug writes logs and redacts', async () => {
    setLevel('debug');
    info('test', { access: 'supersecret' });
    await syncFlush();
    const content = readLog();
    expect(content).toContain('test');
    expect(content).toContain('<REDACTED>');
  });
});
