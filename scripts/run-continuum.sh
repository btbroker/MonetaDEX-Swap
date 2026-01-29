#!/bin/bash

# Run Continuum Script
# Verifies repo root and runs make continuum

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current working directory (where user is running from)
CURRENT_DIR="$(pwd)"

# Helper functions
print_error() {
    echo -e "${RED}✗ Error: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Verify repo root
verify_repo_root() {
    print_info "Verifying repository root..."
    
    # Check for key files
    local missing_files=()
    
    if [ ! -f "Makefile" ]; then
        missing_files+=("Makefile")
    fi
    
    if [ ! -f "pnpm-workspace.yaml" ]; then
        missing_files+=("pnpm-workspace.yaml")
    fi
    
    if [ ! -f "package.json" ]; then
        missing_files+=("package.json")
    fi
    
    # Check for key directories
    local missing_dirs=()
    
    if [ ! -d "apps" ]; then
        missing_dirs+=("apps/")
    fi
    
    if [ ! -d "services" ]; then
        missing_dirs+=("services/")
    fi
    
    # If critical files are missing, we're not in repo root
    if [ ${#missing_files[@]} -gt 0 ] || [ ${#missing_dirs[@]} -gt 0 ]; then
        print_error "Not in repository root"
        echo ""
        echo "Current directory: $(pwd)"
        echo ""
        
        if [ ${#missing_files[@]} -gt 0 ]; then
            echo "Missing files:"
            for file in "${missing_files[@]}"; do
                echo "  - $file"
            done
            echo ""
        fi
        
        if [ ${#missing_dirs[@]} -gt 0 ]; then
            echo "Missing directories:"
            for dir in "${missing_dirs[@]}"; do
                echo "  - $dir"
            done
            echo ""
        fi
        
        echo "How to find repository root:"
        echo ""
        echo "1. Look for these files/directories:"
        echo "   - Makefile"
        echo "   - pnpm-workspace.yaml"
        echo "   - package.json"
        echo "   - apps/ directory"
        echo "   - services/ directory"
        echo ""
        echo "2. Use the find script:"
        echo "   ./scripts/find-repo-root.sh"
        echo ""
        echo "3. Or search manually:"
        echo "   cd ~ && find . -maxdepth 6 -name 'Makefile' -path '*monetadex*' 2>/dev/null"
        echo ""
        echo "4. Navigate to repo root:"
        echo "   cd ~/path/to/monetadex-platform"
        echo ""
        echo "Then run this script again from the repo root."
        echo ""
        exit 1
    fi
    
    print_success "Repository root verified"
    echo "  Location: $CURRENT_DIR"
    echo ""
    return 0
}

# Check if make is available
check_make() {
    if ! command -v make &> /dev/null; then
        print_error "make command not found"
        echo ""
        echo "Install Xcode Command Line Tools:"
        echo "  xcode-select --install"
        echo ""
        exit 1
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              MonetaDEX - Run Continuum Helper Script                  ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    verify_repo_root
    check_make
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "Running Continuum workflow..."
    echo ""
    
    # Run make continuum
    if make continuum; then
        echo ""
        print_success "Continuum workflow completed successfully!"
        echo ""
        exit 0
    else
        echo ""
        print_error "Continuum workflow failed"
        echo ""
        echo "See error messages above for details."
        echo "Common fixes:"
        echo "  - Run: make preflight (to check environment)"
        echo "  - Ensure Docker Desktop is running"
        echo "  - Check that ports 3000, 3001, 5432, 6379 are available"
        echo ""
        exit 1
    fi
}

# Run main function
main
