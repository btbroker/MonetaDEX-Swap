# Policy Engine

## Overview

The policy engine (`@fortuna/compliance`) enforces risk controls and compliance rules on all swap routes before they are presented to users. It filters out risky routes and adds warnings to routes that meet criteria but may have concerns.

## Architecture

### Components

1. **PolicyEngine**: Main engine that evaluates routes
2. **PolicyConfig**: Configuration for risk thresholds
3. **Allowlists/Denylists**: Chain and token filtering
4. **SanctionsHook**: Interface for sanctions screening

### Location

- Package: `packages/compliance`
- Main file: `packages/compliance/src/policy.ts`

## Policy Rules

### Price Impact

- **Config**: `maxPriceImpactBps` (basis points, e.g., 500 = 5%)
- **Behavior**:
  - Routes with price impact above threshold are rejected
  - Routes with unknown price impact can be filtered or warned based on config
  - Routes near threshold (80%+) get warnings

### Slippage Tolerance

- **Config**: `maxSlippageBps` (basis points)
- **Behavior**:
  - User's requested slippage is checked against maximum
  - Requests exceeding maximum are rejected

### Minimum Amount

- **Config**: `minAmountUsd` (USD value)
- **Behavior**:
  - Routes below minimum amount are rejected
  - Requires token price lookup (stub implementation)

### Allowlists

- **Chains**: Only routes on allowed chains pass
- **Tokens**: Only routes with allowed tokens pass
- **Empty lists**: Allow all (opt-in behavior)

### Denylists

- **Chains**: Routes on denied chains are rejected
- **Tokens**: Routes with denied tokens are rejected

### Sanctions Screening

- **Interface**: `SanctionsHook`
- **Current**: Stub implementation (always returns false)
- **Future**: Integration with TRM, Chainalysis, or similar
- **Behavior**: Routes with sanctioned tokens are rejected

## Environment Configuration

Policies vary by environment:

### Development

- More lenient thresholds
- Lower minimum amounts
- Focus on testing functionality

### Staging

- Production-like thresholds
- Full policy enforcement
- Testing risk controls

### Production

- Strictest thresholds
- Highest minimum amounts
- All policies enforced

## Route Evaluation Flow

```
Route → PolicyEngine.evaluateRoute()
  ↓
Check Allowlist
  ↓ (if fails: reject)
Check Denylist
  ↓ (if fails: reject)
Check Sanctions
  ↓ (if fails: reject)
Check Price Impact
  ↓ (if fails: reject, if high: warn)
Check Slippage
  ↓ (if fails: reject)
Check Minimum Amount
  ↓ (if fails: reject)
Add Warnings
  ↓
Return: { allowed: true, warnings: [...] }
```

## Warnings

Warnings are added to routes but don't prevent execution:

- High price impact (near threshold)
- Unknown price impact
- Cross-chain transactions
- Low liquidity indicators
- Unable to verify minimum amount

## Rejection Reasons

Rejected routes return non-sensitive reasons:

- "Chain not supported"
- "Token not supported"
- "Route not available"
- "Price impact too high"
- "Price impact unknown"
- "Slippage tolerance too high"
- "Amount below minimum"

## Integration

The policy engine is integrated into the quote endpoint:

```typescript
const { allowed, rejected } = await policyEngine.applyPolicies(routes, request);
```

Rejected routes are logged (count only) and included in response metadata without exposing sensitive internal logic.

## Testing

- Unit tests for each policy rule
- Boundary condition tests
- Integration tests with mock routes
- Configuration tests for all environments

## Future Enhancements

- Dynamic policy updates
- Per-user policy customization
- Machine learning for risk scoring
- Real-time sanctions data
- Historical route analysis
