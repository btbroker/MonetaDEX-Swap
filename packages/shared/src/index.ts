import { z } from "zod";

// Chain Configuration
export type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
};

// Chain and Token Types
export const ChainIdSchema = z.number().int().positive();
export type ChainId = z.infer<typeof ChainIdSchema>;

export const TokenAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export type TokenAddress = z.infer<typeof TokenAddressSchema>;

export const TokenSchema = z.object({
  address: TokenAddressSchema,
  symbol: z.string(),
  name: z.string(),
  decimals: z.number().int().min(0).max(18),
  chainId: ChainIdSchema,
  logoURI: z.string().url().optional(),
});

export type Token = z.infer<typeof TokenSchema>;

// Route Types
export const RouteTypeSchema = z.enum(["swap", "bridge"]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

/** Step amounts: PREFERRED = amountInHuman/amountOutHuman; amountIn/amountOut are deprecated (compat only). */
export const RouteStepSchema = z.object({
  type: RouteTypeSchema,
  provider: z.string(),
  fromChainId: ChainIdSchema,
  toChainId: ChainIdSchema,
  fromToken: TokenAddressSchema,
  toToken: TokenAddressSchema,
  amountIn: z.string(), // deprecated (compat only): use amountInHuman for display
  amountOut: z.string(), // deprecated (compat only): use amountOutHuman for display
  amountInWei: z.string().optional(),
  amountOutWei: z.string().optional(),
  amountInHuman: z.string().optional(), // PREFERRED for display
  amountOutHuman: z.string().optional(), // PREFERRED for display
});

export type RouteStep = z.infer<typeof RouteStepSchema>;

/** Route amounts: PREFERRED = amountInHuman/amountOutHuman; amountIn/amountOut are deprecated (compat only). */
export const RouteSchema = z.object({
  routeId: z.string(),
  provider: z.string(),
  type: RouteTypeSchema,
  fromChainId: ChainIdSchema,
  toChainId: ChainIdSchema,
  fromToken: TokenAddressSchema,
  toToken: TokenAddressSchema,
  amountIn: z.string(), // deprecated (compat only): use amountInHuman for display
  amountOut: z.string(), // deprecated (compat only): use amountOutHuman for display
  estimatedGas: z.string(),
  fees: z.string(),
  priceImpactBps: z.number().int().min(0).max(10000).optional(),
  steps: z.array(RouteStepSchema),
  warnings: z.array(z.string()).optional(),
  toolsUsed: z.array(z.string()).optional(),
  amountInWei: z.string().optional(),
  amountOutWei: z.string().optional(),
  fromDecimals: z.number().int().min(0).max(18).optional(),
  toDecimals: z.number().int().min(0).max(18).optional(),
  amountInHuman: z.string().optional(), // PREFERRED for display
  amountOutHuman: z.string().optional(), // PREFERRED for display
  fromSymbol: z.string().optional(),
  toSymbol: z.string().optional(),
});

export type Route = z.infer<typeof RouteSchema>;

// Quote Request/Response
export const QuoteRequestSchema = z.object({
  fromChainId: ChainIdSchema,
  toChainId: ChainIdSchema,
  fromToken: TokenAddressSchema,
  toToken: TokenAddressSchema,
  amountIn: z.string(),
  slippageTolerance: z.number().min(0).max(100).optional().default(0.5),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const QuoteResponseSchema = z.object({
  routes: z.array(RouteSchema),
  requestId: z.string(),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

// Transaction Request/Response
export const TxRequestSchema = z.object({
  routeId: z.string(),
  fromChainId: ChainIdSchema,
  toChainId: ChainIdSchema,
  fromToken: TokenAddressSchema,
  toToken: TokenAddressSchema,
  amountIn: z.string(),
  recipient: TokenAddressSchema,
  slippageTolerance: z.number().min(0).max(100).optional().default(0.5),
});

export type TxRequest = z.infer<typeof TxRequestSchema>;

export const TxResponseSchema = z.object({
  routeId: z.string(),
  txHash: z.string().optional(),
  txData: z.string(),
  to: TokenAddressSchema,
  value: z.string(),
  gasLimit: z.string(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  chainId: ChainIdSchema,
});

export type TxResponse = z.infer<typeof TxResponseSchema>;

// Status Response
export const TxStatusSchema = z.enum(["pending", "completed", "failed", "unknown"]);
export type TxStatus = z.infer<typeof TxStatusSchema>;

export const StatusResponseSchema = z.object({
  txHash: z.string(),
  status: TxStatusSchema,
  confirmations: z.number().int().min(0).optional(),
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// Provider Adapter Interface
export interface ProviderAdapter {
  getQuote(request: QuoteRequest): Promise<Route[]>;
  getTx(routeId: string, request: TxRequest): Promise<TxResponse>;
}
