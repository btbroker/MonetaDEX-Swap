# Staged Development Plan - MonetaDEX

**Objective:** Safely expand DEX coverage with minimal risk and clear acceptance criteria.

**Principle:** Each stage must be green before proceeding to the next.

---

## Stage 0: Baseline is Green

**Goal:** Ensure all checks pass and dev environment boots successfully.

### Scope

- Fix any failing tests
- Fix any type errors
- Verify linting passes
- Ensure dev servers start
- Confirm endpoints are accessible

### Files/Modules to Touch

- Fix any TypeScript errors in:
  - `services/swaps-api/src/**/*.ts`
  - `apps/swaps-web/src/**/*.ts`
  - `packages/**/src/**/*.ts`
- Update test files if needed:
  - `**/*.test.ts`

### Tests to Add

- Integration test for dev server startup
- Smoke test for all endpoints
- Verify Continuum workflow completes

### Acceptance Criteria

- [ ] `pnpm install` completes without errors
- [ ] `docker compose up -d` starts all services
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test` passes with all tests green
- [ ] `pnpm dev` starts both swaps-web and swaps-api
- [ ] `GET /healthz` returns `{"status":"ok"}`
- [ ] `GET /docs` loads Swagger UI
- [ ] `GET /v1/chains` returns chain list
- [ ] `GET /v1/tokens?chainId=1` returns tokens
- [ ] `POST /v1/quote` returns at least one route
- [ ] swaps-web home page loads
- [ ] Continuum workflow (`make continuum`) completes successfully

### Rollback Plan

- Revert any fixes if they break existing functionality
- Keep fixes minimal and isolated
- Document all changes in commit messages

### Estimated Effort

- 2-4 hours (depending on existing issues)

---

## Stage 1: Tool Registry + Route Transparency

**Goal:** Add tool/exchange discovery and expose which tools are used in each route.

### Scope

- Create tool registry to discover available exchanges/bridges
- Add `toolsUsed` field to Route schema
- Populate `toolsUsed` from adapter responses
- Expose tool information in API responses

### Files/Modules to Touch

**New Files:**
- `packages/shared/src/tools.ts` - Tool type definitions
- `services/swaps-api/src/registry/tool-registry.ts` - Tool registry implementation

**Modified Files:**
- `packages/shared/src/index.ts` - Add Tool types and update Route schema
- `services/swaps-api/src/adapters/base.ts` - Add `getToolsUsed()` method
- `services/swaps-api/src/adapters/zeroX.ts` - Implement tool reporting
- `services/swaps-api/src/adapters/lifi.ts` - Implement tool reporting
- `services/swaps-api/src/routes/v1/quote.ts` - Include toolsUsed in response

### Tests to Add

- Unit tests for tool registry
- Unit tests for toolsUsed population
- Integration test for toolsUsed in quote response
- Test that toolsUsed is included in route schema

### Acceptance Criteria

- [ ] Tool registry can discover available tools from adapters
- [ ] Route schema includes `toolsUsed: string[]` field
- [ ] ZeroX adapter reports tools used (e.g., ["Uniswap V3", "Curve"])
- [ ] LiFi adapter reports tools used (e.g., ["Stargate", "Hop"])
- [ ] `/v1/quote` response includes `toolsUsed` for each route
- [ ] OpenAPI spec documents `toolsUsed` field
- [ ] All existing tests pass
- [ ] New tests pass

### Rollback Plan

- Revert Route schema changes if breaking
- Keep tool registry optional (adapters can return empty array)
- Feature flag for toolsUsed if needed

### Estimated Effort

- 4-6 hours

---

## Stage 2: Tool Filtering + Deterministic Ranking

**Goal:** Allow filtering routes by tools and ensure deterministic ranking.

### Scope

- Add tool allowlist/denylist to policy engine
- Implement deterministic ranking (tie-breaking)
- Add tool filtering to quote endpoint
- Ensure ranking is consistent across requests

### Files/Modules to Touch

**Modified Files:**
- `packages/compliance/src/types.ts` - Add tool allowlist/denylist
- `packages/compliance/src/policy.ts` - Add tool filtering logic
- `services/swaps-api/src/utils/ranking.ts` - Add deterministic tie-breaking
- `services/swaps-api/src/routes/v1/quote.ts` - Add tool filter query param

**New Files:**
- `services/swaps-api/src/utils/ranking.test.ts` - Tests for deterministic ranking

### Tests to Add

- Policy engine tests for tool filtering
- Ranking tests for deterministic behavior
- Integration tests for tool filtering in quotes
- Test that same routes rank consistently

### Acceptance Criteria

- [ ] Policy engine filters routes by tool allowlist
- [ ] Policy engine filters routes by tool denylist
- [ ] Ranking is deterministic (same routes, same order)
- [ ] `/v1/quote?allowedTools=UniswapV3,Curve` filters correctly
- [ ] `/v1/quote?deniedTools=Hop` filters correctly
- [ ] Ranking uses consistent tie-breaker (e.g., routeId lexicographic)
- [ ] All existing tests pass
- [ ] New tests pass

### Rollback Plan

- Remove tool filtering query params
- Keep tool filtering in policy engine but don't expose via API
- Revert ranking changes if breaking

### Estimated Effort

- 6-8 hours

---

## Stage 3: Expand DEX Coverage Safely

**Goal:** Add real provider integrations and measure outcomes.

### Scope

- Integrate real 0x API (replace mock)
- Integrate real LI.FI API (replace mock)
- Add provider API key management
- Implement rate limiting per provider
- Add provider health checks
- Measure quote quality and success rates

### Files/Modules to Touch

**Modified Files:**
- `services/swaps-api/src/adapters/zeroX.ts` - Replace mock with real API
- `services/swaps-api/src/adapters/lifi.ts` - Replace mock with real API
- `services/swaps-api/src/index.ts` - Add provider health checks
- `services/swaps-api/.env.example` - Add API keys

**New Files:**
- `services/swaps-api/src/utils/rate-limiter.ts` - Rate limiting per provider
- `services/swaps-api/src/utils/provider-health.ts` - Health check utilities
- `services/swaps-api/src/metrics/quote-metrics.ts` - Quote quality metrics

### Tests to Add

- Integration tests with real provider APIs (mocked responses)
- Rate limiting tests
- Provider health check tests
- Quote quality measurement tests
- Error handling tests for provider failures

### Acceptance Criteria

- [ ] 0x adapter calls real 0x API (with API key)
- [ ] LI.FI adapter calls real LI.FI API (with API key)
- [ ] Rate limiting prevents provider abuse
- [ ] Provider health checks detect failures
- [ ] Metrics track quote success rates
- [ ] Fallback to mock if providers unavailable (optional)
- [ ] All existing tests pass
- [ ] Integration tests with mocked provider responses pass
- [ ] Error handling works for provider failures

### Rollback Plan

- Revert to mock adapters
- Feature flag for real vs mock providers
- Keep API keys in environment variables only

### Estimated Effort

- 16-24 hours

---

## Stage 4: Optional Direct DEX Connectors

**Goal:** Add direct DEX connectors only if metrics prove need.

### Scope

- Add direct Uniswap V3 connector (if metrics show need)
- Add direct Curve connector (if metrics show need)
- Add direct 1inch connector (if metrics show need)
- Compare direct vs aggregated routes

### Prerequisites

- Stage 3 complete and metrics collected
- Evidence that direct connectors improve outcomes
- Clear business case for additional complexity

### Files/Modules to Touch

**New Files:**
- `services/swaps-api/src/adapters/uniswap-v3.ts`
- `services/swaps-api/src/adapters/curve.ts`
- `services/swaps-api/src/adapters/oneinch.ts`

### Tests to Add

- Integration tests for each direct connector
- Comparison tests (direct vs aggregated)
- Performance tests

### Acceptance Criteria

- [ ] Metrics show direct connectors improve outcomes
- [ ] Direct connectors integrated and tested
- [ ] Comparison metrics collected
- [ ] All existing tests pass

### Rollback Plan

- Remove direct connectors
- Keep aggregated routes as primary
- Feature flag for direct connectors

### Estimated Effort

- 24-40 hours (per connector)

---

## Critical Fixes Required Before Stage 1

### Fix 1: Route Snapshot Integrity

**Priority:** 🔴 **CRITICAL**

**Issue:** `/v1/tx` doesn't validate routeId matches route parameters.

**Fix:**
1. Create route snapshot storage (in-memory Map or Redis)
2. Store route snapshot when quote is generated
3. Validate routeId + parameters in `/v1/tx`
4. Add tests for routeId validation

**Files:**
- `services/swaps-api/src/utils/route-snapshot.ts` (new)
- `services/swaps-api/src/routes/v1/quote.ts` (modify)
- `services/swaps-api/src/routes/v1/tx.ts` (modify)

**Tests:**
- Route snapshot storage tests
- RouteId validation tests
- Integration test for quote → tx flow

### Fix 2: Quote Caching

**Priority:** 🟡 **IMPORTANT**

**Issue:** No caching, every request hits providers.

**Fix:**
1. Add Redis client to swaps-api
2. Cache quotes with TTL (30-60 seconds)
3. Cache key: hash of quote request
4. Invalidate on policy changes

**Files:**
- `services/swaps-api/src/utils/cache.ts` (new)
- `services/swaps-api/src/routes/v1/quote.ts` (modify)

**Tests:**
- Cache hit/miss tests
- TTL expiration tests
- Cache invalidation tests

---

## Stage Gate Checklist

Before proceeding to next stage:

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] No new linting errors
- [ ] No new type errors
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Rollback plan tested

---

## Risk Mitigation

### For Each Stage

1. **Feature Flags:** Use environment variables to enable/disable features
2. **Gradual Rollout:** Deploy to staging first
3. **Monitoring:** Add metrics before enabling features
4. **Rollback Ready:** Keep previous implementation until new one is proven

### Testing Strategy

- Unit tests for all new code
- Integration tests for API changes
- E2E tests for critical flows
- Load tests for performance-sensitive changes

---

## Timeline Estimate

- **Stage 0:** 2-4 hours
- **Stage 1:** 4-6 hours
- **Stage 2:** 6-8 hours
- **Stage 3:** 16-24 hours
- **Stage 4:** 24-40 hours (if needed)

**Total:** 52-82 hours (6.5-10 days)

---

## Success Metrics

### Stage 0
- Zero failing tests
- Zero type errors
- All endpoints accessible

### Stage 1
- ToolsUsed populated in 100% of routes
- Tool registry discovers all available tools

### Stage 2
- Tool filtering works correctly
- Ranking is 100% deterministic

### Stage 3
- Real provider integration working
- Quote success rate > 95%
- Provider error rate < 5%

### Stage 4
- Direct connectors improve outcomes by > 10%
- Performance improvement measurable

---

## Notes

- Do not proceed to next stage until current stage is fully green
- Keep changes minimal and focused
- Test thoroughly before moving forward
- Document all decisions and changes
