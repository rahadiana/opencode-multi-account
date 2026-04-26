# 🔌 OpenCode Multi-Account Manager Plugin

A plugin for [OpenCode](https://opencode.ai) that automatically manages multiple API accounts. When one account hits its rate limit, the plugin will **automatically switch to the next account** based on priority.

## ✨ Features

- **Priority Rotation** — Accounts are sorted by priority (P1 → P2 → P3, etc.)
- **Provider-Level Auto-Switch** — When a rate limit is detected for Provider X, rotation occurs only within Provider X's account pool.
- **All Providers Supported** — Compatible with 35+ providers supported by OpenCode (Anthropic, OpenAI, Google, Groq, DeepSeek, OpenRouter, xAI, etc.)
- **Provider Exhausted Notifications** — Alerts you when **all accounts for a provider are exhausted**.
- **Custom Tools** — Manage accounts directly from the OpenCode TUI.
- **Cooldown Tracking** — Rate-limited accounts automatically reactivate after the cooldown period.

## 🛠️ Installation

### Method 1: Via NPM (Recommended)

This plugin is officially published on npm. You can easily install it into OpenCode by adding it to your `opencode.json` configuration file:

```json
{
  "plugin": ["@rahadiana/opencode-multi-account"]
}
```

### Method 2: Automatic AI Installation 🤖

You can instruct your AI assistant (like OpenCode, Claude, or Cursor) to install and configure this plugin for you automatically. Just provide them with this prompt:

> "Please install the OpenCode Multi-Account Manager plugin for me. You can read the instructions at `AI_PLUGIN_GUIDE.md` from this repository: https://github.com/rahadiana/opencode-multi-account"

### Method 3: Manual Installation from Source (For Developers)

If you are a developer wanting to test, modify, or contribute to this plugin, you can install it manually from the GitHub repository.

#### Prerequisites
- Node.js 18+ (latest LTS recommended)
- npm & Git

#### Developer Install (Linux/macOS)
```bash
# Clone the repository
git clone https://github.com/rahadiana/opencode-multi-account.git
cd opencode-multi-account

# Install dependencies and build
npm ci
npm run build

# Copy to global plugins directory
mkdir -p ~/.config/opencode/plugins
cp -r . ~/.config/opencode/plugins/multi-account
```

#### Developer Install (Windows PowerShell)
```powershell
# Clone the repository
git clone https://github.com/rahadiana/opencode-multi-account.git
cd opencode-multi-account

# Install dependencies and build
npm ci
npm run build

# Copy to global plugins directory
New-Item -Path "$env:USERPROFILE\.config\opencode\plugins" -ItemType Directory -Force
Copy-Item . "$env:USERPROFILE\.config\opencode\plugins\multi-account" -Recurse -Force
```

### Multi-Account Configuration Location

After installation, the plugin requires an `accounts.json` configuration file. Place it in the appropriate directory for your OS:

| OS | Config Directory |
|----|------------------|
| Linux / macOS | `~/.config/opencode/multi-account/` |
| Windows | `$env:USERPROFILE\.config\opencode\multi-account\` |

### Troubleshooting
- **Plugin not detected in OpenCode**: Ensure you've added it to `opencode.json` properly (if using npm) or that the folder is copied correctly (if installing from source).
- **Build failed (Source Install)**: Run `npm ci` again, check for TypeScript errors, and ensure Node 18+ is installed.
- **Account configuration not read**: Ensure `accounts.json` exists in the exact config directory mentioned above and contains valid JSON.

### Generator accounts.example.json
Use the following script to create or update `accounts.example.json`:

```bash
node scripts/generate_accounts_example.mjs
```

This script will:
- Read `accounts.json` (if it exists) and generate `accounts.example.json` with sanitized tokens.
- Create a default template if `accounts.json` is not found.

Make sure to run this script whenever the structure of `accounts.json` changes.
