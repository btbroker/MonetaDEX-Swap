#!/bin/bash

# Find Repo Root Script
# Searches for the MonetaDEX repository root directory

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Search patterns
WORKSPACE_FILE="pnpm-workspace.yaml"
MAKEFILE="Makefile"
MAX_DEPTH=6

echo ""
echo -e "${BLUE}Searching for MonetaDEX repository root...${NC}"
echo ""

# Search for pnpm-workspace.yaml
echo -e "${BLUE}Searching for $WORKSPACE_FILE...${NC}"
WORKSPACE_PATHS=$(cd ~ && find . -maxdepth $MAX_DEPTH -name "$WORKSPACE_FILE" 2>/dev/null | head -5)

# Search for Makefile in fortuna-related directories
echo -e "${BLUE}Searching for $MAKEFILE in fortuna directories...${NC}"
MAKEFILE_PATHS=$(cd ~ && find . -maxdepth $MAX_DEPTH -name "$MAKEFILE" -path "*fortuna*" 2>/dev/null | head -5)

# Combine and deduplicate paths
ALL_PATHS=$(echo -e "$WORKSPACE_PATHS\n$MAKEFILE_PATHS" | sed 's|^\./||' | sort -u)

if [ -z "$ALL_PATHS" ]; then
    echo -e "${YELLOW}No repository found in home directory (searched up to $MAX_DEPTH levels deep)${NC}"
    echo ""
    echo "Try:"
    echo "  1. Check if the repository is in a different location"
    echo "  2. Clone the repository if you haven't already"
    echo "  3. Search manually: cd ~ && find . -name 'pnpm-workspace.yaml'"
    echo ""
    exit 1
fi

# Display candidates
echo -e "${GREEN}Found candidate repository locations:${NC}"
echo ""

CANDIDATE_COUNT=0
declare -a CANDIDATE_DIRS

while IFS= read -r path; do
    if [ -n "$path" ]; then
        CANDIDATE_COUNT=$((CANDIDATE_COUNT + 1))
        FULL_PATH="$HOME/$path"
        DIR_PATH=$(dirname "$FULL_PATH")
        
        # Verify it's actually the repo root
        if [ -f "$DIR_PATH/$WORKSPACE_FILE" ] || [ -f "$DIR_PATH/$MAKEFILE" ]; then
            CANDIDATE_DIRS+=("$DIR_PATH")
            echo "  [$CANDIDATE_COUNT] $DIR_PATH"
            
            # Show key files to confirm
            if [ -f "$DIR_PATH/$WORKSPACE_FILE" ]; then
                echo "      ✓ Contains $WORKSPACE_FILE"
            fi
            if [ -f "$DIR_PATH/$MAKEFILE" ]; then
                echo "      ✓ Contains $MAKEFILE"
            fi
            if [ -d "$DIR_PATH/apps" ]; then
                echo "      ✓ Contains apps/ directory"
            fi
            if [ -d "$DIR_PATH/services" ]; then
                echo "      ✓ Contains services/ directory"
            fi
            echo ""
        fi
    fi
done <<< "$ALL_PATHS"

if [ ${#CANDIDATE_DIRS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No valid repository root found${NC}"
    echo ""
    exit 1
fi

# If only one candidate, suggest it
if [ ${#CANDIDATE_DIRS[@]} -eq 1 ]; then
    REPO_ROOT="${CANDIDATE_DIRS[0]}"
    echo -e "${GREEN}Repository root found:${NC}"
    echo "  $REPO_ROOT"
    echo ""
    echo -e "${GREEN}To navigate there, run:${NC}"
    echo "  cd $REPO_ROOT"
    echo ""
    echo -e "${GREEN}Or use the full path:${NC}"
    echo "  cd \"$REPO_ROOT\""
    echo ""
else
    # Multiple candidates - let user choose
    echo -e "${YELLOW}Multiple candidates found. Please verify which is correct:${NC}"
    echo ""
    for i in "${!CANDIDATE_DIRS[@]}"; do
        idx=$((i + 1))
        echo "  [$idx] ${CANDIDATE_DIRS[$i]}"
    done
    echo ""
    echo -e "${BLUE}To navigate to a candidate, run:${NC}"
    echo "  cd ${CANDIDATE_DIRS[0]}"
    echo ""
    echo -e "${BLUE}Or check manually:${NC}"
    echo "  ls -la ${CANDIDATE_DIRS[0]} | grep -E 'Makefile|pnpm-workspace.yaml'"
    echo ""
fi

exit 0
