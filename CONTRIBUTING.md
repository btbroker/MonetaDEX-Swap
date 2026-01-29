# Contributing to MonetaDEX

Thank you for your interest in contributing to MonetaDEX! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/MonetaDEX-Swap.git`
3. Install dependencies: `pnpm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Quick Start with Continuum

The easiest way to get started is using the Continuum workflow:

```bash
make continuum
```

This runs all setup steps automatically. See [docs/runbooks/LOCAL_DEVELOPMENT.md](./docs/runbooks/LOCAL_DEVELOPMENT.md) for details.

### Manual Setup

See the [README.md](./README.md) for detailed setup instructions.

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose

### Running Locally

1. Start infrastructure services:
   ```bash
   make infra-up
   # or
   cd infra/docker
   docker compose up -d
   ```

2. Copy environment files:
   ```bash
   cp apps/swaps-web/.env.example apps/swaps-web/.env
   cp services/swaps-api/.env.example services/swaps-api/.env
   ```

3. Start development servers:
   ```bash
   make dev
   # or
   pnpm dev
   ```

## Development Workflow

### Code Style

- We use ESLint and Prettier for code formatting
- Run `pnpm lint` to check for linting errors
- Run `pnpm format` to format code
- TypeScript strict mode is enabled

### Testing

- Write tests for new features
- Run `pnpm test` to execute all tests
- Run `pnpm --filter @fortuna/swaps-web test:e2e` for E2E tests
- Maintain or improve test coverage

### Type Checking

- Run `pnpm typecheck` to verify TypeScript types
- All code must pass type checking before submission

### Commits

- Use clear, descriptive commit messages
- Follow conventional commit format when possible:
  - `feat: add new feature`
  - `fix: fix bug`
  - `docs: update documentation`
  - `refactor: refactor code`
  - `test: add tests`
  - `chore: update dependencies`

## Pull Request Process

1. Run Continuum workflow to ensure everything passes:
   ```bash
   make continuum
   ```
   This runs: install → infra-up → lint → typecheck → test

2. Or run checks individually:
   - `make lint` or `pnpm lint`
   - `make typecheck` or `pnpm typecheck`
   - `make test` or `pnpm test`
   - `pnpm build`

3. Update documentation if needed
4. Create a pull request with a clear description
5. Request review from code owners

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Build succeeds
- [ ] No breaking changes (or documented if intentional)

## Project Structure

```
monetadex-platform/
├── apps/
│   └── swaps-web/          # Next.js frontend
├── services/
│   └── swaps-api/          # Fastify API service
├── packages/
│   ├── shared/            # Shared types and utilities
│   ├── config/             # Shared configuration
│   └── compliance/         # Policy engine
├── infra/
│   └── docker/             # Docker Compose setup
└── docs/
    └── architecture/       # Architecture documentation
```

## Package Guidelines

### Adding a New Package

1. Create directory under `packages/`
2. Add `package.json` with proper workspace configuration
3. Add TypeScript configuration
4. Add ESLint configuration
5. Add tests
6. Update root `turbo.json` if needed

### Adding a New Service

1. Create directory under `services/` or `apps/`
2. Follow existing service structure
3. Add environment configuration
4. Add health check endpoint
5. Update documentation

## Questions?

- Open an issue for bugs or feature requests
- Contact maintainers for questions about the codebase

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
