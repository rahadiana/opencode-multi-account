# AI Plugin Installation Guide

Follow this guide to install and configure the OpenCode Multi-Account Manager Plugin seamlessly. This guide ensures that both human users and AI agents can correctly set up the plugin for development and testing purposes.

---

## Prerequisite Checklist

Before you begin installation, ensure the following:

- Node.js **v18+** is installed. Run `node -v` to verify.
- npm (Node Package Manager) is installed and up-to-date. Run `npm -v`.
- Git is installed. Run `git --version` to confirm.
- Internet access for downloading dependencies.

---

## Installation Steps

### 1. **Clone the Repository**

Use Git to clone the repository onto your local system:

```bash
git clone https://github.com/<your-repo-path/opencode_plugin.git>
cd opencode_plugin
```

---

### 2. **Install Dependencies**

Run the following command within the cloned folder to install all project dependencies:

```bash
npm ci
```

This ensures all dependencies defined in `package-lock.json` match exactly.

---

### 3. **Check Code Quality (AI Configuration Check)**

AI agents should run the following commands to verify:

- Run TypeScript type checking to ensure there are no type errors:
```bash
npm run typecheck
```

---

### 4. **Build the Project**

Compile all TypeScript files to JavaScript using the following:

```bash
npm run build
```

After the build finishes, confirm that the `dist/` folder contains the compiled output.

---

### 5. **Run Tests**

Before deploying the plugin, verify functionality with the test suite:

```bash
npm test
```

If the tests pass, the plugin is ready for installation.

---

### 6. **Optional: Install OpenCode CLI (Global)**

The OpenCode CLI is recommended for managing and testing plugins. Install it globally:

```bash
npm install -g @opencode-ai/cli
```

Use the CLI to verify the plugin installation:
```bash
opencode verify-plugin dist/index.js
```

---

### 7. **Install Plugin (Global or Project Level)**

#### A) **Install Project-Level (for This Repository Only)**
Add the plugin to your current OpenCode workspace. Run:

```bash
mkdir -p .opencode/plugins
cp -r dist/ .opencode/plugins/multi-account
```

#### B) **Install as a Global Plugin (Usable Everywhere)**

```bash
cp -r dist/ ~/.config/opencode/plugins/multi-account
```

---

### 8. **Verify Plugin Functionality**

Run the following final checks to ensure functionality:

- Confirm `dist/index.js` exists for the plugin entrypoint.
- Check the OpenCode plugin loads without errors:
```bash
opencode plugins list
```
The plugin should appear in the list of installed plugins.

---

## Troubleshooting

### **Common Issues**
- **TypeError on Install**: Double-check your Node.js environment is 18 or later.
- **Tests Failing**: Ensure dependencies were installed correctly. Run:
  ```bash
  npm ci
  ```
  Then rerun the tests.
- **Plugin Not Detected**: Recheck the plugin configuration paths for OpenCode (`.opencode/plugins` or `~/.config/opencode/plugins`).

For unresolved issues, submit a bug report via the GitHub Issues tab.