- AccountManager now keeps session-to-account assignments in an in-memory Map and never persists session mappings to runtime state or disk.

- T2 moved plugin runtime tracking in src/index.ts to a sessionStates Map so watchdog stalls, event heartbeats, shell.env, chat.headers, and interceptor-prime update only the active session while fetch keeps explicit default fallback state.

- Session isolation tests need a single temp HOME/plugin context per process because src/index.ts dependencies cache home-derived config/state paths on first import; swapping HOME across subtests can silently point later checks at stale temp directories.

- Event-first session creation must pass provider scope into getOrAssignAccountForSession(); otherwise a fresh session can inherit the default account from another provider and later rotate the wrong pool before shell.env/chat.headers ever run.
