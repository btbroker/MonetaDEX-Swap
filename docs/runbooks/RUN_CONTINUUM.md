# How to Run Continuum on macOS

This guide walks you through finding the repository root and running the Continuum workflow step-by-step.

## What is "Repo Root"?

The **repo root** (repository root) is the top-level directory of the MonetaDEX project. It's the folder that contains all the project files and subdirectories.

## How to Identify Repo Root

The repo root directory contains these key files and folders:

- `pnpm-workspace.yaml` - Monorepo workspace configuration
- `package.json` - Root package configuration
- `turbo.json` - Turborepo configuration (optional)
- `Makefile` - Make targets for common tasks
- `apps/` - Directory containing frontend applications
- `services/` - Directory containing backend services

If you see all of these, you're in the repo root!

## Opening a Terminal at Repo Root

### Option 1: Using Cursor (Recommended)

1. Open the MonetaDEX project in Cursor
2. Go to menu: **Terminal → New Terminal**
3. The terminal opens at the repo root automatically

### Option 2: Using Finder

1. Open Finder and navigate to the MonetaDEX folder
2. Right-click on the folder
3. Select **New Terminal at Folder** (if available)
4. Or drag the folder to Terminal app icon in Dock

### Option 3: Using Terminal App

1. Open Terminal app (Applications → Utilities → Terminal)
2. Navigate to the repo root (see "Navigating to Repo Root" below)

## Verifying You're in Repo Root

Once you have a terminal open, verify you're in the correct location:

### Check Current Directory

```bash
pwd
```

This shows your current path. It should end with something like:
- `~/Projects/monetadex-platform`
- `~/Documents/monetadex-platform`
- `/Users/yourname/monetadex-platform`

### List Files

```bash
ls
```

You should see directories like `apps`, `services`, `packages`, and files like `Makefile`, `package.json`.

### List All Files (Including Hidden)

```bash
ls -la
```

This shows all files including hidden ones (starting with `.`). You should see:
- `Makefile`
- `package.json`
- `pnpm-workspace.yaml`
- `.git/` (if it's a git repository)

## Navigating to Repo Root

### If You Know the Folder Location

```bash
cd ~/Projects/monetadex-platform
```

Replace `~/Projects/fortuna-platform` with your actual path.

### If You Don't Know the Location

Search for the repository:

```bash
cd ~ && find . -maxdepth 5 -name "pnpm-workspace.yaml" 2>/dev/null
```

This searches your home directory (up to 5 levels deep) for the workspace file.

### One-Liner to Find and Navigate

```bash
cd ~ && find . -maxdepth 6 -name "Makefile" -path "*fortuna*" 2>/dev/null
```

This finds Makefiles in folders with "fortuna" in the name.

### Using the Helper Script

We provide a helper script to find the repo root:

```bash
./scripts/find-repo-root.sh
```

This will search and suggest the correct path.

## Running the Continuum Workflow

Once you're in the repo root, run:

```bash
make continuum
```

### What Continuum Does

The Continuum workflow runs these steps in order:

1. **Preflight checks** - Validates your environment (Node.js, pnpm, Docker, ports, env files)
2. **Install dependencies** - `pnpm install` (installs all packages)
3. **Start infrastructure** - `docker compose up -d` (starts PostgreSQL and Redis)
4. **Run linting** - `pnpm lint` (checks code style)
5. **Run type checking** - `pnpm typecheck` (validates TypeScript types)
6. **Run tests** - `pnpm test` (executes all tests)

### Expected Output

You should see output like:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    MonetaDEX - Continuum Workflow                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝

ℹ Running preflight checks...
✓ Preflight check passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1/5: Installing dependencies with pnpm
✓ Dependencies installed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2/5: Starting infrastructure services
✓ Infrastructure services started

... (continues with lint, typecheck, test)
```

### Using the Helper Script

You can also use the helper script that verifies repo root first:

```bash
./scripts/run-continuum.sh
```

This script:
1. Checks if you're in repo root
2. If yes, runs `make continuum`
3. If no, shows helpful guidance

## Common Issues and Fixes

### Issue: "make: command not found"

**Error:**
```
make: command not found
```

**Solution:**
Install Xcode Command Line Tools:

```bash
xcode-select --install
```

This installs `make` and other development tools. After installation, try again.

### Issue: "Makefile: No such file or directory"

**Error:**
```
make: *** No rule to make target 'continuum'.  Stop.
```

or

```
Makefile: No such file or directory
```

**Solution:**
You're not in the repo root. Verify your location:

```bash
pwd
ls -la | grep Makefile
```

If `Makefile` is not listed, navigate to repo root:

```bash
cd ~/Projects/monetadex-platform  # Replace with your actual path
```

Or use the find command:

```bash
cd ~ && find . -maxdepth 6 -name "Makefile" -path "*fortuna*" 2>/dev/null
```

### Issue: Docker Errors

**Error:**
```
Cannot connect to the Docker daemon
```

or

```
Docker daemon is not running
```

**Solution:**
1. Open Docker Desktop application
2. Wait for Docker to fully start (whale icon in menu bar should be steady)
3. Verify Docker is running:

```bash
docker info
```

4. Run Continuum again:

```bash
make continuum
```

### Issue: pnpm Not Found

**Error:**
```
pnpm: command not found
```

**Solution:**
Enable corepack and activate pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify installation:

```bash
pnpm --version
```

Then run Continuum again.

### Issue: Node.js Version Too Old

**Error:**
```
Node.js version X.X.X is too old (requires >= 20.0.0)
```

**Solution:**
1. Download Node.js 20+ from: https://nodejs.org/
2. Install the LTS version
3. Verify installation:

```bash
node --version  # Should show v20.x.x or higher
```

4. Run Continuum again.

### Issue: Port Already in Use

**Error:**
```
Port 5432 is already in use
```

**Solution:**
Check what's using the port:

```bash
lsof -i :5432
```

Options:
1. Stop the conflicting service
2. Change the port in `infra/docker/docker-compose.yml`
3. Stop existing containers:

```bash
cd infra/docker
docker compose down
```

Then run Continuum again.

### Issue: Environment Files Missing

**Warning:**
```
⚠ services/swaps-api/.env not found
```

**Solution:**
Create the environment files:

```bash
cp apps/swaps-web/.env.example apps/swaps-web/.env
cp services/swaps-api/.env.example services/swaps-api/.env
```

Then run Continuum again.

## Quick Reference

### Find Repo Root
```bash
cd ~ && find . -maxdepth 6 -name "Makefile" -path "*fortuna*" 2>/dev/null
```

### Verify Repo Root
```bash
ls -la | grep -E "Makefile|pnpm-workspace.yaml|package.json"
```

### Run Continuum
```bash
make continuum
```

### Run with Helper Script
```bash
./scripts/run-continuum.sh
```

### Check Preflight Only
```bash
make preflight
```

## Next Steps

After Continuum completes successfully:

1. **Start development servers:**
   ```bash
   make dev
   ```

2. **Access the applications:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - API Docs: http://localhost:3001/docs

3. **Stop infrastructure when done:**
   ```bash
   make infra-down
   ```

## Getting Help

If you encounter issues not covered here:

1. Check [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for detailed troubleshooting
2. Review [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines
3. Run preflight checks: `make preflight`
4. Open an issue with:
   - Error message
   - Your macOS version
   - Node.js version (`node --version`)
   - Output of `pwd` and `ls -la`

## Summary

1. **Find repo root** - Look for `Makefile`, `pnpm-workspace.yaml`, `apps/`, `services/`
2. **Open terminal** - Use Cursor's terminal or Finder's "New Terminal at Folder"
3. **Verify location** - Run `pwd` and `ls -la` to confirm
4. **Run Continuum** - Execute `make continuum`
5. **Fix issues** - Use the troubleshooting guide above

That's it! You're ready to develop. 🚀
