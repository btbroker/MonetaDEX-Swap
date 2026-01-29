# MonetaDEX

Production-grade monorepo for MonetaDEX - Cross-chain DEX aggregator platform.

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose

## Quick Start

### Option 1: Continuum Workflow (Recommended)

Run the standardized Continuum workflow that executes all setup steps:

```bash
make continuum
```

This runs: preflight → install → infrastructure → lint → typecheck → test

**New to the project?** See [docs/runbooks/RUN_CONTINUUM.md](./docs/runbooks/RUN_CONTINUUM.md) for step-by-step instructions.

**Helper scripts:**
- `./scripts/find-repo-root.sh` - Find the repository root directory
- `./scripts/run-continuum.sh` - Verify repo root and run Continuum

See [docs/runbooks/LOCAL_DEVELOPMENT.md](./docs/runbooks/LOCAL_DEVELOPMENT.md) for detailed workflow documentation.

### Option 2: Manual Setup

Follow these steps to get the platform running locally:

### Step 1: Prerequisites

Ensure you have the following installed:
- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0 ([Install](https://pnpm.io/installation))
- **Docker** and **Docker Compose** ([Install](https://docs.docker.com/get-docker/))

**Quick check:** Run `make preflight` to validate your environment.

Verify installations:
```bash
node --version  # Should be >= 18.0.0
pnpm --version  # Should be >= 8.0.0
docker --version
docker compose version
```

### Step 2: Clone and Install

```bash
# Clone the repository
git clone https://github.com/fortuna-tech-labs/MonetaDEX-Swap.git
cd MonetaDEX-Swap

# Install all dependencies
pnpm install
```

This installs dependencies for all packages, apps, and services in the monorepo.

### Step 3: Start Infrastructure Services

Start PostgreSQL and Redis using Docker Compose:

```bash
cd infra/docker
docker compose up -d
```

Verify services are running:
```bash
docker compose ps
```

You should see:
- `fortuna-postgres` running on port 5432
- `fortuna-redis` running on port 6379

### Step 4: Configure Environment Variables

Copy the example environment files:

```bash
# From the root directory
cp apps/swaps-web/.env.example apps/swaps-web/.env
cp services/swaps-api/.env.example services/swaps-api/.env
```

**swaps-web/.env** should contain:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

**swaps-api/.env** should contain:
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/swaps_db
REDIS_URL=redis://localhost:6379
SENTRY_DSN=
```

### Step 5: Start Development Servers

From the root directory, start all services:

```bash
pnpm dev
```

This command uses Turborepo to run:
- `swaps-web` on http://localhost:3000
- `swaps-api` on http://localhost:3001

**Verify everything is running:**

1. Open http://localhost:3000 - You should see the MonetaDEX interface
2. Open http://localhost:3001/docs - You should see the Swagger API documentation
3. Open http://localhost:3001/healthz - You should see `{"status":"ok","timestamp":"..."}`

### Step 6: Test the Application

1. **Connect a wallet** in the swaps-web interface
2. **Select chains and tokens** for a swap
3. **Enter an amount** to see quotes
4. **Review routes** and select one
5. **Execute a swap** (on a test network)

## Troubleshooting

### Port Already in Use

If ports 3000 or 3001 are already in use:

```bash
# For swaps-web, edit apps/swaps-web/.env or use:
PORT=3002 pnpm --filter @fortuna/swaps-web dev

# For swaps-api, edit services/swaps-api/.env
PORT=3002
```

### Docker Services Not Starting

```bash
# Check Docker is running
docker ps

# View logs
cd infra/docker
docker compose logs

# Restart services
docker compose down
docker compose up -d
```

### Dependencies Not Installing

```bash
# Clear cache and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Type Errors

```bash
# Run type checking
pnpm typecheck

# Build packages first
pnpm build
```

## Project Structure

```
monetadex-platform/
├── apps/
│   └── swaps-web/          # Next.js frontend application
├── services/
│   └── swaps-api/          # Fastify API service
├── packages/
│   ├── shared/            # Shared types and utilities
│   └── config/             # Shared environment and chain config
├── infra/
│   └── docker/             # Docker Compose for Postgres and Redis
└── docs/
    └── architecture/       # Architecture documentation
```

## Available Scripts

### Make Targets (Recommended)

- `make preflight` - Run preflight checks to validate environment
- `make continuum` - Run complete Continuum workflow (preflight, install, infra-up, lint, typecheck, test)
- `make install` - Install all dependencies
- `make infra-up` - Start infrastructure services
- `make infra-down` - Stop infrastructure services
- `make lint` - Run linter
- `make typecheck` - Run type checker
- `make test` - Run tests
- `make dev` - Start development servers
- `make clean` - Clean build artifacts
- `make help` - Show all available targets

### Root Level (pnpm)

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps and packages
- `pnpm lint` - Lint all apps and packages
- `pnpm typecheck` - Type check all apps and packages
- `pnpm test` - Run all tests
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm clean` - Clean all build artifacts and node_modules

### App-Specific

Each app and package has its own scripts. See individual `package.json` files for details.

## Architecture

For detailed architecture documentation, see [docs/architecture/](./docs/architecture/).

### swaps-web

- **Framework**: Next.js 14 with App Router
- **Wallet Integration**: wagmi + viem
- **State Management**: React Query
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit), Playwright (E2E)
- **Monitoring**: Sentry (optional)

**Important**: `swaps-web` must never call 0x or LI.FI directly. It will call `swaps-api` only.

### swaps-api

- **Framework**: Fastify
- **Documentation**: OpenAPI/Swagger at `/docs` and `/openapi.json`
- **Testing**: Vitest
- **Monitoring**: Sentry (optional)
- **Policy Engine**: Integrated compliance and risk controls

### Shared Packages

- `@fortuna/shared`: Shared types and utilities
- `@fortuna/config`: Environment and chain configuration
- `@fortuna/compliance`: Policy engine for risk controls

### Key Features

- **Provider Abstraction**: Unified interface for multiple swap/bridge providers
- **Route Aggregation**: Combines quotes from multiple providers
- **Policy Engine**: Filters routes based on risk controls
- **Normalized Schema**: Consistent route format across providers

## Development

### Running Individual Services

```bash
# Run only swaps-web
pnpm --filter @fortuna/swaps-web dev

# Run only swaps-api
pnpm --filter @fortuna/swaps-api dev
```

### Database Access

PostgreSQL connection string:
```
postgresql://postgres:postgres@localhost:5432/swaps_db
```

Redis connection string:
```
redis://localhost:6379
```

### Stopping Infrastructure

```bash
cd infra/docker
docker compose down
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Tests for Specific Package

```bash
pnpm --filter @fortuna/swaps-web test
pnpm --filter @fortuna/swaps-api test
```

### E2E Tests

```bash
pnpm --filter @fortuna/swaps-web test:e2e
```

## CI/CD

GitHub Actions workflow runs on push and pull requests to `main` and `develop` branches:

- **Lint**: ESLint checks across all packages
- **Type Check**: TypeScript compilation check
- **Test**: Unit and integration tests
- **Build**: Production build verification

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for details.

## Versioning

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

### Adding a Changeset

When making changes that affect package versions:

```bash
pnpm changeset
```

This creates a changeset file describing your changes. See [.changeset/README.md](.changeset/README.md) for details.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## Security

See [SECURITY.md](./SECURITY.md) for security policy and reporting vulnerabilities.

## Documentation

- [Architecture Overview](./docs/architecture/swaps-overview.md)
- [Provider Abstraction](./docs/architecture/provider-abstraction.md)
- [Policy Engine](./docs/architecture/policy-engine.md)
- [Data Flow Diagrams](./docs/architecture/data-flow.md)
- [Branch Protection](./docs/branch-protection.md)

## Environment Variables

### swaps-web

- `NEXT_PUBLIC_API_URL` - API base URL (default: http://localhost:3001)
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN (optional)
- `SENTRY_AUTH_TOKEN` - Sentry auth token (optional)
- `SENTRY_ORG` - Sentry organization (optional)
- `SENTRY_PROJECT` - Sentry project (optional)

### swaps-api

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production/test)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SENTRY_DSN` - Sentry DSN (optional)

## License

Private - MonetaDEX
