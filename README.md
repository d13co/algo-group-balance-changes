# ts-project

Modern TypeScript project configured for both browsers and Node.js.

## Features

- 📦 Dual ESM/CJS builds
- 🔷 TypeScript with strict mode
- 📝 ESLint with TypeScript support
- 💅 Prettier for code formatting
- 🐶 Husky + lint-staged for pre-commit hooks
- 🌐 Works in browsers and Node.js

## Getting Started

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Type check without emitting
npm run typecheck
```

## Project Structure

```
src/
├── index.ts           # Main entry point
├── greeter.ts         # Example module
├── example.ts         # Example usage file
└── utils/
    └── environment.ts # Environment detection utilities
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build both ESM and CJS outputs |
| `npm run build:esm` | Build ESM output only |
| `npm run build:cjs` | Build CJS output only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | Type-check without building |

## Output

After building, the `dist/` folder contains:

- `dist/esm/` - ES Module build
- `dist/cjs/` - CommonJS build
- `dist/types/` - TypeScript declarations

## License

MIT
