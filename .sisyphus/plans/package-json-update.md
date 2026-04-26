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

3. **Update Package Name**:
   - Change the `name` field to a scoped format:
     ```json
     "name": "@rahadiana/opencode-multi-account"
     ```

4. **Verify Build Process**:
   - Ensure that `npm run build` correctly creates the `dist/index.js` file for npm compatibility.

---

### Tasks (For the Agent Executor):

#### Task 1 (Update `main` Field):
- File: `package.json`
- What to Do: Replace the `main` field to point to the `dist/index.js` file instead of `src/index.ts`.

#### Task 2 (Add Script):
- File: `package.json`
- What to Do: Append the `prepublishOnly` script with the value `npm run build`.

#### Task 3 (Validation):
- Verify the file with `npm run build` to check that the `dist/index.js` is generated before publishing.

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