# Provider Abstraction

## Overview

The provider abstraction layer allows the platform to integrate with multiple swap and bridge providers (0x, LI.FI, etc.) through a unified interface. This design enables easy addition of new providers and consistent handling of routes from different sources.

## Architecture

### Adapter Interface

All providers implement the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  getQuote(request: QuoteRequest): Promise<Route[]>;
  getTx(routeId: string, request: TxRequest): Promise<TxResponse>;
}
```

### Base Adapter

The `BaseAdapter` abstract class provides a foundation for all adapters:

```typescript
abstract class BaseAdapter implements ProviderAdapter {
  abstract name: string;
  abstract getQuote(request: QuoteRequest): Promise<Route[]>;
  abstract getTx(routeId: string, request: TxRequest): Promise<TxResponse>;
}
```

## Current Adapters

### ZeroX Adapter

- **Type**: Same-chain swaps
- **Location**: `services/swaps-api/src/adapters/zeroX.ts`
- **Features**:
  - Handles swaps on the same chain
  - Calculates 0.3% fee
  - Provides price impact estimation

### LI.FI Adapter

- **Type**: Cross-chain bridges
- **Location**: `services/swaps-api/src/adapters/lifi.ts`
- **Features**:
  - Handles cross-chain swaps/bridges
  - Calculates 0.5% fee
  - Includes cross-chain warnings

## Adding a New Provider

To add a new provider:

1. Create a new adapter class extending `BaseAdapter`:
   ```typescript
   export class NewProviderAdapter extends BaseAdapter {
     name = "new-provider";
     
     async getQuote(request: QuoteRequest): Promise<Route[]> {
       // Implement quote fetching logic
       // Return normalized routes
     }
     
     async getTx(routeId: string, request: TxRequest): Promise<TxResponse> {
       // Implement transaction payload generation
     }
   }
   ```

2. Register the adapter in the quote route:
   ```typescript
   const adapters = [
     new ZeroXAdapter(),
     new LiFiAdapter(),
     new NewProviderAdapter(), // Add here
   ];
   ```

3. Ensure routes are normalized to the common schema
4. Add tests for the new adapter
5. Update documentation

## Route Normalization

All adapters must return routes in the normalized schema:

- Convert provider-specific formats to common `Route` type
- Calculate or estimate price impact
- Include all required fields
- Add warnings for risky routes
- Generate stable `routeId` using `generateRouteId()`

## Error Handling

Adapters should:

- Handle provider API errors gracefully
- Return empty array if provider cannot handle the request
- Log errors for debugging
- Never throw unhandled errors that could crash the API

## Testing

Each adapter should have:

- Unit tests for quote generation
- Unit tests for transaction payload generation
- Mock provider responses
- Error handling tests

## Future Enhancements

- Provider health checks
- Automatic failover
- Provider performance metrics
- Rate limiting per provider
- Caching of provider responses
