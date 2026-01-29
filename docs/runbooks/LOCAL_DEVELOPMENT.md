# Local Development - Continuum Workflow

## Overview

The **Continuum** workflow is a standardized local development setup process that ensures all developers run the same steps in the same order. This guarantees consistency across the team and catches issues early.

## What is Continuum?

Continuum executes these 5 steps in order:

1. **Install dependencies** (`pnpm install`)
2. **Start infrastructure** (`docker compose up -d`)
3. **Run linting** (`pnpm lint`)
4. **Run type checking** (`pnpm typecheck`)
5. **Run tests** (`pnpm test`)

## Quick Start

Run the complete Continuum workflow:

```bash
make continuum
```

This automatically runs preflight checks first, then executes all setup steps.

Or use the scripts directly:

```bash
# Run preflight checks only
./scripts/preflight.sh

# Run complete workflow
./scripts/continuum.sh
```

### Preflight Checks

Before running Continuum, preflight checks validate your environment:

- Node.js version >= 20.0.0
- pnpm installation (or corepack availability)
- Docker installation and daemon status
- Docker Compose availability
- Port availability (3000, 3001, 5432, 6379)
- Environment file existence

Run preflight separately:

```bash
make preflight
```

### Helper Scripts

**Finding the repository root:**

If you're not sure where the repository is located:

```bash
./scripts/find-repo-root.sh
```

This searches your home directory and suggests the correct path.

**Running Continuum with verification:**

Use the helper script that verifies you're in the repo root first:

```bash
./scripts/run-continuum.sh
```

This script:
1. Verifies you're in the repository root
2. Checks that `make` is available
3. Runs `make continuum`

If you're not in the repo root, it provides clear guidance on how to find it.

**For beginners:** See [RUN_CONTINUUM.md](./RUN_CONTINUUM.md) for detailed step-by-step instructions.

## Prerequisites

Before running Continuum, ensure you have:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** and **Docker Compose**

### Installing pnpm

If pnpm is not installed:

```bash
# Option 1: Using npm
npm install -g pnpm

# Option 2: Using corepack (recommended)
corepack enable
corepack prepare pnpm@latest --activate
```

### Installing Docker

Install Docker Desktop from: https://docs.docker.com/get-docker/

Verify installation:

```bash
docker --version
docker compose version
```

## Step-by-Step Guide

### Step 1: Install Dependencies

Installs all dependencies for all packages in the monorepo using pnpm.

```bash
make install
# or
pnpm install
```

**What it does:**
- Reads `pnpm-workspace.yaml` to find all packages
- Installs dependencies for each package
- Creates symlinks between workspace packages

**Expected output:**
```
✓ Dependencies installed
```

### Step 2: Start Infrastructure

Starts PostgreSQL and Redis using Docker Compose.

```bash
make infra-up
# or
cd infra/docker && docker compose up -d
```

**What it does:**
- Detects `docker-compose.yml` location (root or `infra/docker/`)
- Starts containers in detached mode
- Waits for services to be ready
- Shows service status

**Expected output:**
```
✓ Infrastructure services started
NAME                STATUS          PORTS
fortuna-postgres    Up (healthy)    0.0.0.0:5432->5432/tcp
fortuna-redis       Up (healthy)    0.0.0.0:6379->6379/tcp
```

### Step 3: Run Linting

Runs ESLint across all packages.

```bash
make lint
# or
pnpm lint
```

**What it does:**
- Runs ESLint on all TypeScript/JavaScript files
- Checks code style and best practices
- Uses Turborepo to run in parallel where possible

**Expected output:**
```
✓ Linting passed
```

### Step 4: Run Type Checking

Runs TypeScript compiler to check types.

```bash
make typecheck
# or
pnpm typecheck
```

**What it does:**
- Compiles TypeScript without emitting files
- Checks type errors across all packages
- Validates shared types are correct

**Expected output:**
```
✓ Type checking passed
```

### Step 5: Run Tests

Runs all unit and integration tests.

```bash
make test
# or
pnpm test
```

**What it does:**
- Runs Vitest tests in all packages
- Generates coverage reports
- Uses Turborepo for parallel execution

**Expected output:**
```
✓ Tests passed
```

## Individual Make Targets

You can run individual steps using Make:

```bash
make install      # Install dependencies
make infra-up     # Start infrastructure
make infra-down   # Stop infrastructure
make lint         # Run linter
make typecheck    # Run type checker
make test         # Run tests
make dev          # Start development servers
make clean        # Clean build artifacts
make help         # Show all available targets
```

## Troubleshooting

### pnpm is not found

**Error:**
```
✗ Error: pnpm is not installed
```

**Solution:**
```bash
# Enable corepack (Node.js 16.10+)
corepack enable
corepack prepare pnpm@latest --activate

# Or install globally
npm install -g pnpm
```

### Docker is not running

**Error:**
```
✗ Error: Docker daemon is not running
```

**Solution:**
1. Start Docker Desktop
2. Wait for Docker to fully start
3. Verify with: `docker info`

### docker-compose.yml not found

**Error:**
```
✗ Error: docker-compose.yml not found
```

**Solution:**
The script automatically detects the compose file location. If this error occurs:
1. Check that `infra/docker/docker-compose.yml` exists
2. Ensure you're running from the repository root

### Port already in use

**Error:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Stop existing containers
make infra-down

# Or change ports in docker-compose.yml
```

### Dependencies fail to install

**Error:**
```
ERR_PNPM_PEER_DEP_ISSUES
```

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Linting fails

**Error:**
```
✗ Linting failed
```

**Solution:**
```bash
# See specific errors
pnpm lint

# Auto-fix where possible
pnpm format

# Or fix manually based on error messages
```

### Type checking fails

**Error:**
```
✗ Type checking failed
```

**Solution:**
```bash
# See specific type errors
pnpm typecheck

# Check if packages need to be built first
pnpm build

# Verify shared types are correct
```

### Tests fail

**Error:**
```
✗ Tests failed
```

**Solution:**
```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose

# Run tests for specific package
pnpm --filter @fortuna/swaps-api test

# Check test coverage
pnpm test -- --coverage
```

## After Continuum

Once Continuum completes successfully, you can:

1. **Start development servers:**
   ```bash
   make dev
   ```

2. **Access services:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - API Docs: http://localhost:3001/docs

3. **Stop infrastructure when done:**
   ```bash
   make infra-down
   ```

## Continuous Integration

The Continuum workflow mirrors what runs in CI:

- GitHub Actions runs: `lint`, `typecheck`, `test`, `build`
- Continuum runs: `install`, `infra-up`, `lint`, `typecheck`, `test`

This ensures local development matches CI behavior.

## Best Practices

1. **Run Continuum after:**
   - Cloning the repository
   - Pulling major changes
   - Switching branches
   - Installing new dependencies

2. **Run Continuum before:**
   - Creating a pull request
   - Pushing code
   - Starting a new feature

3. **Keep infrastructure running:**
   - Don't stop Docker between development sessions
   - Only run `make infra-down` when you're done for the day

4. **Fix issues immediately:**
   - Don't skip failing steps
   - Fix linting/type errors as you go
   - Keep tests passing

## Script Details

The Continuum script (`scripts/continuum.sh`) includes:

- **Strict error handling**: `set -euo pipefail`
- **Automatic path detection**: Finds docker-compose.yml automatically
- **Clear output**: Color-coded success/error messages
- **Prerequisite checks**: Verifies pnpm, Docker, etc.
- **Service health checks**: Waits for Docker services to be ready

## Environment Variables

Continuum respects these environment variables:

- `NODE_ENV` - Node environment (development/production/test)
- `CI` - Set to `true` in CI environments

## Getting Help

If you encounter issues not covered here:

1. Check the [CONTRIBUTING.md](../../CONTRIBUTING.md) guide
2. Review [README.md](../../README.md) for setup instructions
3. Open an issue with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, Node version, etc.)

## Summary

The Continuum workflow ensures:

✅ Consistent setup across all developers  
✅ Early detection of issues  
✅ Alignment with CI/CD pipeline  
✅ Reliable development environment  

Run `make continuum` to get started!
