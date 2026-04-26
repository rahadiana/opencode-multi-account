# Installation Guide: OpenCode Multi-Account Plugin

This is the repository-level installation guide. It is a copy of the decision-complete plan preserved in .sisyphus/plans/installation-guide.md and is suitable for inclusion in the repository root so other contributors can find and follow it.

Follow the exact commands below for your OS. These steps are non-destructive and intended for local development and verification. If you are running CI or packaging this plugin for distribution, adapt commands for your environment.

---

Prerequisites
- Node.js LTS (recommended 18.x or 20.x). Verify: node --version
- npm (bundled with Node). Verify: npm --version
- Git: git --version
- Shell: PowerShell on Windows; Bash on macOS/Linux

Quick install (macOS / Linux)
1) cd /path/to/opencode_plugin
2) npm ci
3) npm run build
4) mkdir -p ~/.config/opencode/plugins
5) cp -r . ~/.config/opencode/plugins/multi-account
6) mkdir -p ~/.config/opencode/multi-account
7) cp accounts.example.json ~/.config/opencode/multi-account/accounts.json
8) npm test

Quick install (Windows PowerShell)
1) cd C:\path\to\opencode_plugin
2) npm ci
3) npm run build
4) mkdir "$env:USERPROFILE\.config\opencode\plugins" -Force -ErrorAction SilentlyContinue
5) xcopy . "${env:USERPROFILE}\.config\opencode\plugins\multi-account" /E /I
6) New-Item -Path "$env:USERPROFILE\.config\opencode\multi-account" -ItemType Directory -Force
7) Copy-Item accounts.example.json "$env:USERPROFILE\.config\opencode\multi-account\accounts.json"
8) npm test

Build & test commands (explicit)
- Install deps: npm ci
- Typecheck: npm run typecheck
- Build: npm run build
- Tests: npm test

Post-install verification (exact checks)
- Build success: npm run build  (evidence: .sisyphus/evidence/install/build.log)
- Tests success: npm test (evidence: .sisyphus/evidence/install/test.log)
- Plugin presence: check host path exists (evidence: .sisyphus/evidence/install/installed.txt)
- accounts.json validity: jq empty ~/.config/opencode/multi-account/accounts.json or PowerShell ConvertFrom-Json

Troubleshooting
- If npm ci fails due to native modules, install platform build tools (Windows: Visual Studio C++ Build Tools; macOS: xcode-select --install; Debian/Ubuntu: sudo apt-get install build-essential python3)
- If plugin not loaded, verify correct plugin path and permissions. Restart the host app after installation.
- If accounts.json invalid, copy accounts.example.json again and validate JSON.

Cleanup / rollback
- Remove plugin: rm -rf ~/.config/opencode/plugins/multi-account (macOS/Linux) or Remove-Item -Recurse -Force "$env:USERPROFILE\.config\opencode\plugins\multi-account" (PowerShell)
- Revert local code: git checkout main; git reset --hard origin/main

If you want me to create a PR that adds this file to the repository, I will do so after creating a branch and pushing — confirm and I will proceed.
