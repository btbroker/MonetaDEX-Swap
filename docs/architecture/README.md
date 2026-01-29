# Architecture Documentation

This directory contains comprehensive architecture documentation for MonetaDEX.

## Documents

- [Swaps Overview](./swaps-overview.md) - High-level system overview and core principles
- [Provider Abstraction](./provider-abstraction.md) - How providers are integrated and abstracted
- [Policy Engine](./policy-engine.md) - Risk controls and compliance rules
- [Data Flow](./data-flow.md) - Text-based diagrams of system flows

## Quick Links

- [Main README](../../README.md) - Project setup and quick start
- [Contributing Guide](../../CONTRIBUTING.md) - How to contribute
- [Security Policy](../../SECURITY.md) - Security reporting
- [Branch Protection](../../docs/branch-protection.md) - Branch protection recommendations

## System Overview

MonetaDEX is a DEX aggregator that:

1. Aggregates quotes from multiple providers (0x, LI.FI, etc.)
2. Applies risk controls through a policy engine
3. Ranks routes by best output
4. Provides a unified interface for swaps and bridges

## Key Design Decisions

- **API-First**: Frontend never calls providers directly
- **Provider Abstraction**: Easy to add new providers
- **Normalized Schema**: Consistent route format
- **Policy Engine**: Centralized risk controls
- **Type Safety**: Full TypeScript with shared types

## Technology Stack

- **Frontend**: Next.js 14, React, wagmi, viem
- **Backend**: Fastify, TypeScript
- **Monorepo**: pnpm workspaces, Turborepo
- **Testing**: Vitest, Playwright
- **Documentation**: OpenAPI/Swagger
