import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for accounts.json and accounts.example.json
const accountsPath = path.resolve(__dirname, '../accounts.json');
const examplePath = path.resolve(__dirname, '../accounts.example.json');

// Function to sanitize accounts.json and write accounts.example.json
function generateExample() {
  try {
    if (fs.existsSync(accountsPath)) {
      const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));

      // Sanitize tokens
      const sanitizedAccounts = accountsData.accounts.map(account => ({
        provider: account.provider,
        token: 'REDACTED'
      }));

      const exampleData = {
        accounts: sanitizedAccounts,
        default_provider: accountsData.default_provider || ''
      };

      fs.writeFileSync(examplePath, JSON.stringify(exampleData, null, 2));
      console.log('accounts.example.json has been updated successfully.');
    } else {
      // Default template if accounts.json does not exist
      const defaultExample = {
        accounts: [
          { provider: 'PROVIDER_NAME', token: 'YOUR_API_KEY' }
        ],
        default_provider: 'PROVIDER_NAME'
      };

      fs.writeFileSync(examplePath, JSON.stringify(defaultExample, null, 2));
      console.log('accounts.example.json has been created with default template.');
    }
  } catch (error) {
    console.error('Error generating accounts.example.json:', error.message);
  }
}

// Run the generator
generateExample();