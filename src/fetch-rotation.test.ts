import test from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { MultiAccountPlugin } from "./index"

test("fetch monkeypatch triggers fetch-log entry on HTTP 429", async () => {
  // Prepare fake global.fetch before plugin init so plugin patches it
  (globalThis as any).fetch = async (...args: any[]) => {
    return {
      status: 429,
      headers: { entries: () => [] },
      url: typeof args[0] === "string" ? args[0] : args[0]?.url,
    }
  }

  // Capture intervals created by plugin so we can clear them and allow process exit
  const intervals: number[] = []
  const originalSetInterval = globalThis.setInterval.bind(globalThis)
  ;(globalThis as any).setInterval = function (handler: any, ms?: number, ...rest: any[]) {
    const id = originalSetInterval(handler, ms, ...rest)
    intervals.push(Number(id))
    return id as any
  }

  // Minimal fake client used by the plugin (no-ops)
  const client: any = {
    _client: { request: async () => ({ response: { status: 200 } }) },
    app: { log: async () => {} },
    session: { abort: async () => {} },
    tui: { showToast: async () => {} },
    // PluginInput has more fields in the real runtime; tests only need the above
  }

  // Ensure plugin global flag reset for test isolation
  try { delete (globalThis as any).__opencode_multi_account_plugin_loaded__ } catch {}

  await MultiAccountPlugin({ client: client as any } as any)

  // Clear plugin intervals to avoid keeping the process alive after test
  for (const id of intervals) {
    try { clearInterval(id) } catch {}
  }
  // restore original
  try { (globalThis as any).setInterval = originalSetInterval } catch {}

  // Call fetch which should be patched by the plugin and produce a fetch-log entry
  await (globalThis as any).fetch("https://example.invalid/test-429")

  // Read the fetch-log file written by the plugin
  const debugDir = path.join(os.homedir(), ".config", "opencode", "multi-account")
  const fetchLogPath = path.join(debugDir, "fetch-log.json")

  assert.ok(fs.existsSync(fetchLogPath), "fetch-log.json should exist after patched fetch call")

  const raw = fs.readFileSync(fetchLogPath, "utf8")
  const entries = JSON.parse(raw)
  assert.ok(Array.isArray(entries) && entries.length > 0, "fetch-log should be a non-empty array")

  const last = entries[entries.length - 1]
  assert.equal(last.status, 429)
  assert.equal(last.kind, "response")
})
