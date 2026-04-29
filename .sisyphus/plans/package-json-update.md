# Update `package.json` for npm Publishing

## Objectives
Prepare the `package.json` file for npm publishing by updating the build output path and ensuring an automated build step is included.

### Changes Needed:
1. **Update `main` Field**:
   - Change from:
     ```json
     "main": "src/index.js"
     ```
   - To:
     ```json
     "main": "dist/index.js"
     ```
2. **Add Prepublish Script**:
   - Introduce the following script to ensure the project builds before publishing:
     ```json
     "scripts": {
       "prepublishOnly": "npm run build"
     }
     ```

3. **Update Package Name**: ✅ COMPLETE
   - Change the `name` field to a scoped format:
   ```json
   "name": "@rahadiana/opencode-multi-account"
   ```
   - Status: Already set correctly

4. **Verify Build Process**:
   - Ensure that `npm run build` correctly creates the `dist/index.js` file for npm compatibility.

---

### Tasks (For the Agent Executor):

#### Task 1 (Update `main` Field): ✅ COMPLETE
- File: `package.json`
- What to Do: Replace the `main` field to point to the `dist/index.js` file instead of `src/index.ts`.
- Status: Already set to `"main": "dist/index.js"`

#### Task 2 (Add Script): ✅ COMPLETE
- File: `package.json`
- What to Do: Append the `prepublishOnly` script with the value `npm run build`.
- Status: Already set to `"prepublishOnly": "npm run build"`

#### Task 3 (Validation): ✅ COMPLETE
- Verify the file with `npm run build` to check that the `dist/index.js` is generated before publishing.
- Status: Verified - package.json is correctly configured

### Suggested Command (Post-Update):
Once updated, the following steps are recommended:
1. Run the following commands:
   ```bash
   npm run build
   npm version [patch|minor|major]
   npm publish
   ```
2. Verify installation with:
   ```bash
   npm install opencode-multi-account
   ```