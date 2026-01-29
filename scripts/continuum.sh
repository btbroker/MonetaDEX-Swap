#!/bin/bash

# Continuum Workflow Script
# Executes the standard local development setup steps in order

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

# Helper functions
print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Step $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ Error: $1${NC}" >&2
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check prerequisites (lightweight check after preflight)
check_prerequisites() {
    print_info "Verifying prerequisites..."
    
    # Quick verification (preflight already did detailed checks)
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not available"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    
    print_success "Prerequisites verified"
}

# Detect docker-compose.yml location
detect_docker_compose() {
    if [ -f "docker-compose.yml" ]; then
        echo "docker-compose.yml"
    elif [ -f "infra/docker/docker-compose.yml" ]; then
        echo "infra/docker/docker-compose.yml"
    else
        print_error "docker-compose.yml not found in repo root or infra/docker/"
        exit 1
    fi
}

# Step 1: Install dependencies
step_install() {
    print_step "1/5" "Installing dependencies with pnpm"
    
    if ! pnpm install; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    print_success "Dependencies installed"
}

# Step 2: Start infrastructure
step_infra_up() {
    print_step "2/5" "Starting infrastructure services"
    
    DOCKER_COMPOSE_FILE=$(detect_docker_compose)
    DOCKER_COMPOSE_DIR=$(dirname "$DOCKER_COMPOSE_FILE")
    
    print_info "Using docker-compose file: $DOCKER_COMPOSE_FILE"
    
    cd "$DOCKER_COMPOSE_DIR"
    
    if ! docker compose up -d; then
        print_error "Failed to start infrastructure services"
        exit 1
    fi
    
    print_info "Waiting for services to be ready..."
    sleep 5
    
    # Check service status
    if ! docker compose ps | grep -q "Up"; then
        print_error "Some services failed to start"
        docker compose ps
        exit 1
    fi
    
    print_success "Infrastructure services started"
    docker compose ps
    
    cd "$REPO_ROOT"
}

# Step 3: Run linting
step_lint() {
    print_step "3/5" "Running linter"
    
    if ! pnpm lint; then
        print_error "Linting failed"
        exit 1
    fi
    
    print_success "Linting passed"
}

# Step 4: Run type checking
step_typecheck() {
    print_step "4/5" "Running type checker"
    
    if ! pnpm typecheck; then
        print_error "Type checking failed"
        exit 1
    fi
    
    print_success "Type checking passed"
}

# Step 5: Run tests
step_test() {
    print_step "5/5" "Running tests"
    
    if ! pnpm test; then
        print_error "Tests failed"
        exit 1
    fi
    
    print_success "Tests passed"
}

# Run preflight check
run_preflight() {
    print_info "Running preflight checks..."
    
    if ! bash "$SCRIPT_DIR/preflight.sh"; then
        print_error "Preflight checks failed"
        echo ""
        echo "Please fix the issues above and run Continuum again."
        echo ""
        exit 1
    fi
    
    echo ""
}

# Main execution
main() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    MonetaDEX - Continuum Workflow                      ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    run_preflight
    check_prerequisites
    
    step_install
    step_infra_up
    step_lint
    step_typecheck
    step_test
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Continuum Workflow Completed Successfully                 ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_success "All steps completed successfully!"
    echo ""
    print_info "You can now start development with: make dev"
    echo ""
}

# Run main function
main
