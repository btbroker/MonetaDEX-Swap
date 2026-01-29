import { test, expect } from "@playwright/test";

test.describe("Swap Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route("**/v1/chains", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chains: [
            { chainId: 1, name: "Ethereum Mainnet", rpcUrl: "https://eth.llamarpc.com" },
            { chainId: 137, name: "Polygon", rpcUrl: "https://polygon.llamarpc.com" },
          ],
        }),
      });
    });

    await page.route("**/v1/tokens*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tokens: [
            {
              address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
              symbol: "USDC",
              name: "USD Coin",
              decimals: 6,
              chainId: 1,
            },
            {
              address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
              symbol: "USDT",
              name: "Tether USD",
              decimals: 6,
              chainId: 1,
            },
          ],
        }),
      });
    });

    await page.route("**/v1/quote", async (route) => {
      const request = route.request();
      const body = await request.postDataJSON();
      
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routes: [
            {
              routeId: "test-route-1",
              provider: "0x",
              type: "swap",
              fromChainId: body.fromChainId,
              toChainId: body.toChainId,
              fromToken: body.fromToken,
              toToken: body.toToken,
              amountIn: body.amountIn,
              amountOut: "997000",
              estimatedGas: "150000",
              fees: "3000",
              priceImpactBps: 10,
              steps: [],
            },
          ],
          requestId: "test-request-1",
        }),
      });
    });

    await page.route("**/v1/tx", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routeId: "test-route-1",
          txData: "0x" + "0".repeat(200),
          to: "0x1234567890123456789012345678901234567890",
          value: "0",
          gasLimit: "200000",
          gasPrice: "20000000000",
          chainId: 1,
        }),
      });
    });

    await page.goto("/");
  });

  test("should display swap interface", async ({ page }) => {
    await expect(page.getByText("MONETADEX")).toBeVisible();
    await expect(page.getByText("From")).toBeVisible();
    await expect(page.getByText("To")).toBeVisible();
  });

  test("should load chains and tokens", async ({ page }) => {
    // Select chain for "From"
    const fromChainSelect = page.locator('select').first();
    await fromChainSelect.selectOption("1");
    
    // Wait for tokens to load
    await page.waitForResponse("**/v1/tokens*");
    
    // Token selector should be enabled
    const tokenButton = page.locator('button:has-text("Select token")').first();
    await expect(tokenButton).not.toBeDisabled();
  });

  test("should fetch quote when all fields are filled", async ({ page }) => {
    // Select chains
    const fromChainSelect = page.locator('select').first();
    await fromChainSelect.selectOption("1");
    
    const toChainSelect = page.locator('select').nth(1);
    await toChainSelect.selectOption("1");

    // Wait for tokens
    await page.waitForResponse("**/v1/tokens*");

    // Select tokens (simplified - in real test would click dropdown)
    // For now, we'll just check that quote endpoint is called when amount is entered
    
    // Enter amount
    const amountInput = page.locator('input[placeholder="0.0"]').first();
    await amountInput.fill("1000000");

    // Wait for debounced quote request
    await page.waitForResponse("**/v1/quote", { timeout: 2000 });

    // Should see routes
    await expect(page.getByText("0x")).toBeVisible({ timeout: 3000 });
  });

  test("should show settings modal", async ({ page }) => {
    const settingsButton = page.getByText("⚙️ Settings");
    await settingsButton.click();

    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Slippage Tolerance")).toBeVisible();
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Override quote route to return error
    await page.route("**/v1/quote", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid request" }),
      });
    });

    // Try to trigger quote
    const fromChainSelect = page.locator('select').first();
    await fromChainSelect.selectOption("1");
    
    const amountInput = page.locator('input[placeholder="0.0"]').first();
    await amountInput.fill("1000000");

    // Error should be handled (UI should not crash)
    await page.waitForTimeout(1000);
    await expect(page.getByText("MONETADEX")).toBeVisible();
  });
});
