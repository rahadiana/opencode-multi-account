Learnings from Ollama rate-limit detection task
- Implemented Ollama-specific rate-limit detection patterns by extending RATE_LIMIT_PATTERNS in src/rate-limiter.ts.
- Added 10 patterns: no slot available, connection refused, econnrefused, etimedout, context cancelled, model is loading, queue full, concurrent request limit, max connections, server busy.
- Verified changes by running unit tests for rate limiter module and overall test suite; all tests pass (16/16).
- Next steps: validate in a real Ollama/Qwen integration scenario, monitor false positives, and adjust if Ollama edge-cases appear.
