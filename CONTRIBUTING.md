# Contributing to the OpenCode Multi-Account Manager Plugin

Thank you for considering contributing to this project! By contributing, you help improve the functionality and usability of this plugin for the whole OpenCode community.

## Ways to Contribute

You can contribute in many ways:

1. **Report Bugs**: Create an issue for any unexpected behaviors or errors. Use the `Bug Report` template to ensure all relevant information is included.
2. **Request Features**: Suggest new features or improvements through a `Feature Request` issue.
3. **Fix Issues**: Check the `Issues` section for bugs or enhancements that need attention. Look out for `help wanted` or `good first issue` labels.
4. **Improve Documentation**: Suggest edits or new content for the documentation (e.g., README.md).
5. **Add Test Coverage**: Contribute tests to ensure better code coverage.

## Setting Up the Environment
Follow these steps to set up your development environment:

1. Fork the repository and clone your fork locally.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Run the TypeScript compiler to ensure everything works:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## Code Style Guidelines
Please ensure your code adheres to the following styles:
  - Use TypeScript.
  - Follow the existing code formatting and linting rules.
  - Add meaningful commit messages.

## Commit Message Convention
We adopt the following structure for commits:
```
[TYPE]: Short description of changes
```
`TYPE` can be one of:
  - `feat`: New feature added
  - `fix`: Bug fix
  - `docs`: Documentation update
  - `style`: Code formatting changes
  - `refactor`: Code refactored for readability or performance
  - `test`: Added or modified tests
  - `chore`: Dependencies or configuration changes

Examples:
- `feat: Add auto-update check for new plugin versions`
- `fix: Resolve CI pipeline path issue for actions runner`

## Pull Request Process

1. Create a fork of the repository.
2. Make a branch from `main` for your feature or fix. For example:
   ```bash
   git checkout -b feat/auto-update
   ```
3. Add tests for your changes.
4. Ensure the CI pipeline passes before submitting the PR.
5. Submit a pull request (PR) and include relevant details. Link any related issues.
6. Wait for reviews.

We appreciate your contributions and review contributions thoughtfully to uphold project quality!