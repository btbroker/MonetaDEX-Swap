#!/bin/bash

# Preflight Checker
# Validates local environment before running Continuum workflow

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to repo root
cd "$REPO_ROOT"

# Track failures
FAILURES=0
WARNINGS=0

# Helper functions
print_check() {
    echo -n "Checking $1... "
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    FAILURES=$((FAILURES + 1))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check Node.js
check_node() {
    print_check "Node.js installation"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "  → Install from: https://nodejs.org/"
        return 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    
    if [ "$NODE_MAJOR" -lt 20 ]; then
        print_error "Node.js version $NODE_VERSION is too old (requires >= 20.0.0)"
        echo "  → Current version: $NODE_VERSION"
        echo "  → Required version: >= 20.0.0"
        echo "  → Update from: https://nodejs.org/"
        return 1
    fi
    
    print_success "Node.js $NODE_VERSION"
    return 0
}

# Check pnpm
check_pnpm() {
    print_check "pnpm installation"
    
    if command -v pnpm &> /dev/null; then
        PNPM_VERSION=$(pnpm --version)
        print_success "pnpm $PNPM_VERSION"
        return 0
    fi
    
    # Check if corepack can enable it
    if command -v corepack &> /dev/null; then
        print_warning "pnpm not found, but corepack is available"
        echo "  → Run: corepack enable && corepack prepare pnpm@latest --activate"
        echo "  → Or install globally: npm install -g pnpm"
        return 1
    fi
    
    print_error "pnpm is not installed and corepack is not available"
    echo "  → Install pnpm: npm install -g pnpm"
    echo "  → Or enable corepack: corepack enable"
    return 1
}

# Check Docker
check_docker() {
    print_check "Docker installation"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "  → Install from: https://docs.docker.com/get-docker/"
        return 1
    fi
    
    DOCKER_VERSION=$(docker --version | sed 's/Docker version //' | sed 's/,.*//')
    print_success "Docker $DOCKER_VERSION"
    
    # Check if Docker daemon is running
    print_check "Docker daemon"
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo "  → Start Docker Desktop or your Docker daemon"
        return 1
    fi
    
    print_success "Docker daemon is running"
    return 0
}

# Check Docker Compose
check_docker_compose() {
    print_check "Docker Compose"
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available"
        echo "  → Docker Compose should be included with Docker"
        echo "  → Try: docker compose version"
        return 1
    fi
    
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "available")
    print_success "Docker Compose $COMPOSE_VERSION"
    return 0
}

# Check port availability
check_port() {
    local port=$1
    local service=$2
    
    print_check "Port $port ($service)"
    
    if command -v lsof &> /dev/null; then
        if lsof -i ":$port" &> /dev/null; then
            print_warning "Port $port is in use"
            echo "  → Service: $service"
            echo "  → Check with: lsof -i :$port"
            echo "  → Or change port in configuration"
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
            print_warning "Port $port may be in use"
            echo "  → Service: $service"
            echo "  → Check with: netstat -an | grep :$port"
            return 1
        fi
    else
        print_info "Cannot check port $port (lsof/netstat not available)"
        return 0
    fi
    
    print_success "Port $port is available"
    return 0
}

# Check all ports
check_ports() {
    check_port 3000 "swaps-web"
    check_port 3001 "swaps-api"
    check_port 5432 "PostgreSQL"
    check_port 6379 "Redis"
}

# Check environment files
check_env_file() {
    local env_file=$1
    local service=$2
    
    print_check ".env file for $service"
    
    if [ -f "$env_file" ]; then
        print_success "$env_file exists"
        return 0
    fi
    
    print_warning "$env_file not found"
    echo "  → Create from: ${env_file}.example"
    echo "  → Run: cp ${env_file}.example $env_file"
    return 1
}

# Check all environment files
check_env_files() {
    check_env_file "services/swaps-api/.env" "swaps-api"
    check_env_file "apps/swaps-web/.env" "swaps-web"
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                    MonetaDEX - Preflight Check                        ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Run all checks
    check_node || true
    check_pnpm || true
    check_docker || true
    check_docker_compose || true
    check_ports
    check_env_files
    
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Summary
    if [ $FAILURES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ Preflight check passed${NC}"
        echo ""
        exit 0
    elif [ $FAILURES -eq 0 ]; then
        echo -e "${YELLOW}⚠ Preflight check completed with $WARNINGS warning(s)${NC}"
        echo ""
        echo "Warnings are non-blocking but should be addressed:"
        echo "  → Review warnings above for recommendations"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ Preflight check failed with $FAILURES error(s)${NC}"
        echo ""
        echo "Remediation checklist:"
        echo ""
        
        if ! command -v node &> /dev/null || [ "$(node --version | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
            echo "  [ ] Install/update Node.js to version >= 20.0.0"
            echo "      → Download from: https://nodejs.org/"
        fi
        
        if ! command -v pnpm &> /dev/null; then
            echo "  [ ] Install pnpm"
            echo "      → Run: corepack enable && corepack prepare pnpm@latest --activate"
            echo "      → Or: npm install -g pnpm"
        fi
        
        if ! command -v docker &> /dev/null; then
            echo "  [ ] Install Docker"
            echo "      → Download from: https://docs.docker.com/get-docker/"
        fi
        
        if command -v docker &> /dev/null && ! docker info &> /dev/null; then
            echo "  [ ] Start Docker daemon"
            echo "      → Start Docker Desktop or your Docker service"
        fi
        
        if ! docker compose version &> /dev/null; then
            echo "  [ ] Verify Docker Compose is available"
            echo "      → Should be included with Docker installation"
        fi
        
        echo ""
        echo "After fixing errors, run preflight again:"
        echo "  make preflight"
        echo "  or"
        echo "  ./scripts/preflight.sh"
        echo ""
        exit 1
    fi
}

# Run main function
main
