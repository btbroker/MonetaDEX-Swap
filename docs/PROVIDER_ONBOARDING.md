# Provider Onboarding Guide

This document outlines the new structure for integrating and managing aggregator API keys in the `swaps-api` service. The goal is to make the process safe, explicit, and non-breaking for regulated provider onboarding.

## Key Changes

1.  **ProviderConfig Interface**: A new `ProviderConfig` interface (defined in `services/swaps-api/src/config/provider-config.ts`) standardizes provider configuration. It includes:
    *   `name`: The name of the provider.
    *   `requiresKey`: A boolean indicating if the provider requires an API key.
    *   `envVar`: The name of the environment variable where the API key is expected (if `requiresKey` is true).
    *   `supportedChains`: An array of chain IDs supported by the provider.

2.  **Explicit API Key Checks**: Each provider adapter (`services/swaps-api/src/adapters/*.ts`) now explicitly checks for the presence of its required API key. If a provider `requiresKey: true` but the key is missing (`this.useMock` is true), the `getQuote` method will return an empty array `[]` instead of generating fake or placeholder quotes. This ensures no silent fallbacks to inaccurate data.

3.  **Standardized Provider Status (`/v1/providers` Endpoint)**: The `/v1/providers` endpoint (`services/swaps-api/src/routes/v1/providers.ts`) has been updated to reflect the status of all configured providers. It now returns three categories:
    *   `withKeys`: Providers that require an API key and for which the key is successfully loaded.
    *   `disabled`: Providers that require an API key, but the key is currently missing or not loaded. These providers will not be used for route attempts.
    *   `public`: Providers that do not require an API key to function.

4.  **Prioritized Route Attempts**: The quote generation logic in `services/swaps-api/src/routes/v1/quote.ts` now uses `orderAdaptersForQuote` to prioritize and filter providers:
    *   Providers in the `disabled` category are **excluded** from route attempts.
    *   Providers in the `withKeys` category are attempted first.
    *   Providers in the `public` category are attempted next.

## How to Onboard a New Aggregator

1.  **Add to `PROVIDER_CONFIGS`**: In `services/swaps-api/src/config/provider-config.ts`, add a new entry to the `PROVIDER_CONFIGS` array for your new aggregator.
    *   Set `name` to the adapter's internal name.
    *   Set `requiresKey` to `true` if an API key is necessary for real quotes, `false` otherwise.
    *   If `requiresKey` is `true`, set `envVar` to the name of the environment variable that will hold the API key (e.g., `ZEROX_API_KEY`).
    *   List all `supportedChains` for the provider.

2.  **Implement or Update Adapter**: Create a new adapter file (e.g., `services/swaps-api/src/adapters/newAggregator.ts`) or update an existing one.
    *   Ensure the adapter's `getQuote` method checks `this.useMock`. If `requiresKey` is `true` for this provider and `this.useMock` is `true`, return `[]` (an empty array) immediately.
    *   If the provider is `public` (`requiresKey: false`), its `getQuote` method should handle potential real API failures by returning `[]` rather than falling back to mock quotes.

3.  **Configure API Key (if `requiresKey: true`)**: Add your API key to the `.env` file at the root of the `services/swaps-api` directory. The environment variable name must match the `envVar` specified in `PROVIDER_CONFIGS`.

    ```env
    NEW_AGGREGATOR_API_KEY=your_actual_api_key_here
    ```

4.  **Restart API**: Restart the `swaps-api` service to load the new configuration and API keys.

5.  **Verify Status**: Check the `/v1/providers` endpoint:

    ```bash
    curl -s http://localhost:3001/v1/providers
    ```

    Your new aggregator should appear under `withKeys` if the key is loaded, or `disabled` if it requires a key but it's missing. Public providers will be under `public`.

This structured approach ensures that API keys are explicitly managed, providers without keys gracefully indicate their disabled status, and the system prioritizes live, real-quote providers.
