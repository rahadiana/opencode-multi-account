import { setLevel, syncFlush, registerUI } from '../src/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';

const logPath = path.join(os.homedir(), '.config', 'opencode', 'multi-account', 'debug.log');

function readLog(): string {
  try { return fs.readFileSync(logPath, 'utf8'); } catch (e) { return ''; }
}

describe('logger integration', () => {
  beforeEach(() => {
    try { fs.unlinkSync(logPath); } catch (e) {}
  });

  test('dev mode produces debug entries', async () => {
    setLevel('debug');
    // simulate UI register
    registerUI({ log: (level:string, msg:string)=>{ /*noop*/ } });
    // produce logs
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const logger = require('../src/logger');
    logger.debug('dev-mode-test', { k: 'v' });
    await syncFlush();
    const content = readLog();
    expect(content).toContain('dev-mode-test');
  });

  test('prod mode suppresses debug', async () => {
    setLevel('error');
    const logger = require('../src/logger');
    logger.debug('should-not-appear', { k: 'v' });
    await syncFlush();
    const content = readLog();
    expect(content).not.toContain('should-not-appear');
  });
});
