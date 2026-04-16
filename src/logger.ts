import fs from 'fs';
import os from 'os';
import path from 'path';

export type LogLevel = 'trace'|'debug'|'info'|'warn'|'error'|'silent';
const LEVELS: Record<LogLevel, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, silent: 100 };

let currentLevel: LogLevel = resolveDefaultLevel();
let uiLogger: { log: (level: string, msg: string, meta?: unknown) => void } | null = null;
let pendingWrites: Promise<void>[] = [];

function resolveDefaultLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env && ['trace','debug','info','warn','error','silent'].includes(env)) return env as LogLevel;
  if (process.env.NODE_ENV === 'production') return 'error';
  return 'debug';
}

export function setLevel(l: LogLevel) {
  if (!l) return;
  currentLevel = l;
}
export function getLevel() { return currentLevel; }

export function registerUI(client: { app?: { log?: (msg: string) => void }, log?: (level:string, msg:string, meta?: unknown)=>void }) {
  if (!client) return;
  if ((client as any).app && typeof (client as any).app.log === 'function') {
    uiLogger = { log: (level, msg, meta) => (client as any).app.log(`${level.toUpperCase()}: ${msg}`, meta) };
  } else if (typeof (client as any).log === 'function') {
    uiLogger = { log: (level, msg, meta) => (client as any).log(level, msg, meta) };
  }
}

function levelNum(l: LogLevel) { return LEVELS[l] ?? 30; }

function shouldLog(level: LogLevel) {
  if (currentLevel === 'silent') return false;
  return levelNum(level) >= levelNum(currentLevel);
}

function redact(obj: any): any {
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    if (obj.split('.').length === 3 && obj.length > 20) return '<REDACTED>';
    return obj;
  }
  if (typeof obj !== 'object') return obj;
  const copy: any = Array.isArray(obj) ? [] : {};
  const sensitive = ['access','refresh','token','api_key','apikey','apiKey','secret','password'];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (sensitive.includes(k.toLowerCase())) copy[k] = '<REDACTED>';
    else copy[k] = redact(v);
  }
  return copy;
}

function getLogPath(): string {
  try {
    const dir = path.join(os.homedir(), '.config', 'opencode', 'multi-account');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'debug.log');
  } catch (e) {
    return path.join(os.tmpdir(), 'opencode-debug.log');
  }
}

function writeLine(obj: object) {
  const line = JSON.stringify(obj) + '\n';
  const p = new Promise<void>((res) => {
    fs.appendFile(getLogPath(), line, (err) => {
      res();
    });
  });
  pendingWrites.push(p);
  p.then(() => { pendingWrites = pendingWrites.filter(x => x !== p); });
}

export function syncFlush(): Promise<void> {
  return Promise.all(pendingWrites).then(() => undefined);
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const entry = { ts: new Date().toISOString(), level, msg, meta: meta ? redact(meta) : null };
  try { writeLine(entry); } catch (e) { }
  if (uiLogger && (level === 'info' || level === 'warn' || level === 'error')) {
    try { uiLogger.log(level, msg, meta ? redact(meta) : undefined); } catch (e) { }
  }
}

export function debug(msg: string, meta?: Record<string, unknown>) { emit('debug', msg, meta); }
export function info(msg: string, meta?: Record<string, unknown>) { emit('info', msg, meta); }
export function warn(msg: string, meta?: Record<string, unknown>) { emit('warn', msg, meta); }
export function error(msg: string, meta?: Record<string, unknown>) { emit('error', msg, meta); }

setLevel(resolveDefaultLevel());
