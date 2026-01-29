# Swaps Overview

## Introduction

MonetaDEX is a decentralized exchange (DEX) aggregator that provides users with the best swap and bridge routes across multiple providers. The platform consists of a frontend web application (`swaps-web`) and a backend API service (`swaps-api`) that aggregates quotes from various providers.

## Core Principles

1. **API-First Architecture**: The frontend never directly calls external providers (0x, LI.FI). All external calls go through `swaps-api`.
2. **Provider Abstraction**: Providers are abstracted through adapters, allowing easy addition of new providers.
3. **Risk Controls**: All routes are filtered through a policy engine before being presented to users.
4. **Normalized Schema**: Routes from different providers are normalized into a common schema for consistent handling.

## System Components

### Frontend (swaps-web)

- **Technology**: Next.js 14 with App Router, React, TypeScript
- **Wallet Integration**: wagmi + viem for wallet connection and transaction signing
- **State Management**: React Query for server state, React hooks for local state
- **Styling**: Tailwind CSS

**Key Features**:
- Wallet connection and chain switching
- Token and chain selection
- Real-time quote fetching with debouncing
- Route comparison and selection
- Transaction execution
- Transaction status tracking

### Backend (swaps-api)

- **Technology**: Fastify, TypeScript
- **Database**: PostgreSQL (for future features)
- **Cache**: Redis (for future features)
- **Documentation**: OpenAPI/Swagger at `/docs`

**Key Features**:
- Provider adapter system
- Route aggregation and ranking
- Policy engine integration
- Transaction payload generation
- Health checks and monitoring

### Shared Packages

- **@fortuna/shared**: Common TypeScript types and Zod schemas
- **@fortuna/config**: Chain and token configurations
- **@fortuna/compliance**: Policy engine for risk controls

## Data Flow

```
User → swaps-web → swaps-api → Provider Adapters → External APIs (0x, LI.FI)
                ↓
         Policy Engine
                ↓
         Route Ranking
                ↓
         Response to User
```

## Request Flow

1. User selects tokens, chains, and amount in `swaps-web`
2. `swaps-web` sends quote request to `swaps-api` `/v1/quote`
3. `swaps-api` queries all provider adapters in parallel
4. Adapters return normalized routes
5. Policy engine filters routes based on risk controls
6. Remaining routes are ranked by best output (amountOut - fees)
7. Ranked routes are returned to `swaps-web`
8. User selects a route and initiates transaction
9. `swaps-web` requests transaction payload from `swaps-api` `/v1/tx`
10. User signs and submits transaction via wallet
11. Transaction status is polled via `swaps-api` `/v1/status`

## Route Normalization

All routes from different providers are normalized into a common schema:

- `routeId`: Unique identifier (hash of provider + key fields)
- `provider`: Provider name (e.g., "0x", "lifi")
- `type`: Route type ("swap" or "bridge")
- `fromChainId` / `toChainId`: Chain identifiers
- `fromToken` / `toToken`: Token addresses
- `amountIn` / `amountOut`: Input and output amounts
- `estimatedGas`: Estimated gas cost
- `fees`: Total fees
- `priceImpactBps`: Price impact in basis points
- `steps`: Array of route steps
- `warnings`: Optional warnings array

## Security Considerations

- All user inputs are validated using Zod schemas
- Policy engine enforces risk controls (price impact, slippage, minimum amounts)
- Sanctions screening interface (ready for TRM/Chainalysis integration)
- Environment-based configuration for different risk profiles
- No sensitive data exposed in error messages
