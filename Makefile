.PHONY: continuum preflight install infra-up infra-down lint typecheck test dev clean help

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Detect docker-compose.yml location
DOCKER_COMPOSE_FILE := $(shell if [ -f "docker-compose.yml" ]; then echo "docker-compose.yml"; elif [ -f "infra/docker/docker-compose.yml" ]; then echo "infra/docker/docker-compose.yml"; else echo ""; fi)
DOCKER_COMPOSE_DIR := $(shell dirname $(DOCKER_COMPOSE_FILE))

help: ## Show this help message
	@echo "MonetaDEX - Continuum Workflow"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:"
	@echo "  $(GREEN)make continuum$(NC)  - Run the complete Continuum workflow"

preflight: ## Run preflight checks to validate local environment
	@echo "$(YELLOW)Running preflight checks...$(NC)"
	@bash scripts/preflight.sh

continuum: ## Run the complete Continuum workflow (install, infra-up, lint, typecheck, test)
	@echo "$(YELLOW)Starting Continuum workflow...$(NC)"
	@bash scripts/continuum.sh

install: ## Install all dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	@pnpm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

infra-up: ## Start infrastructure services (PostgreSQL, Redis)
	@if [ -z "$(DOCKER_COMPOSE_FILE)" ]; then \
		echo "$(RED)✗ Error: docker-compose.yml not found$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Starting infrastructure services...$(NC)"
	@cd $(DOCKER_COMPOSE_DIR) && docker compose up -d
	@echo "$(GREEN)✓ Infrastructure services started$(NC)"
	@echo "$(YELLOW)Waiting for services to be ready...$(NC)"
	@sleep 3
	@cd $(DOCKER_COMPOSE_DIR) && docker compose ps

infra-down: ## Stop infrastructure services
	@if [ -z "$(DOCKER_COMPOSE_FILE)" ]; then \
		echo "$(RED)✗ Error: docker-compose.yml not found$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Stopping infrastructure services...$(NC)"
	@cd $(DOCKER_COMPOSE_DIR) && docker compose down
	@echo "$(GREEN)✓ Infrastructure services stopped$(NC)"

lint: ## Run linting across all packages
	@echo "$(YELLOW)Running linter...$(NC)"
	@pnpm lint
	@echo "$(GREEN)✓ Linting passed$(NC)"

typecheck: ## Run TypeScript type checking
	@echo "$(YELLOW)Running type checker...$(NC)"
	@pnpm typecheck
	@echo "$(GREEN)✓ Type checking passed$(NC)"

test: ## Run all tests
	@echo "$(YELLOW)Running tests...$(NC)"
	@pnpm test
	@echo "$(GREEN)✓ Tests passed$(NC)"

dev: ## Start development servers
	@echo "$(YELLOW)Starting development servers...$(NC)"
	@pnpm dev

clean: ## Clean build artifacts and node_modules
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@pnpm clean
	@echo "$(GREEN)✓ Clean complete$(NC)"
