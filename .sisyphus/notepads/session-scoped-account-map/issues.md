
- Repeating `chat.headers` for the same provider/account inside a deterministic test can intentionally trigger `trackRequestAndFix()` and mark that account rate-limited, so unaffected-session assertions should prefer `shell.env` unless the retry-loop heuristic is the behavior under test.
