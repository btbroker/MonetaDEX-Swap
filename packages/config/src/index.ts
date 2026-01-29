import { z } from "zod";
import type { ChainConfig, Token } from "@fortuna/shared";

// Environment configuration schema
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Chain configurations
export const CHAINS: ChainConfig[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth.llamarpc.com",
  },
  {
    chainId: 10,
    name: "Optimism",
    rpcUrl: "https://optimism.llamarpc.com",
  },
  {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl: "https://bsc.llamarpc.com",
  },
  {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon.llamarpc.com",
  },
  {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://base.llamarpc.com",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: "https://arbitrum.llamarpc.com",
  },
  {
    chainId: 43114,
    name: "Avalanche",
    rpcUrl: "https://avalanche.llamarpc.com",
  },
  {
    chainId: 534352,
    name: "Scroll",
    rpcUrl: "https://scroll.llamarpc.com",
  },
  {
    chainId: 5000,
    name: "Mantle",
    rpcUrl: "https://mantle.llamarpc.com",
  },
  {
    chainId: 81457,
    name: "Blast",
    rpcUrl: "https://blast.llamarpc.com",
  },
  {
    chainId: 34443,
    name: "Mode",
    rpcUrl: "https://mode.llamarpc.com",
  },
];

// Token configurations by chain
export const TOKENS_BY_CHAIN: Record<number, Token[]> = {
  1: [
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chainId: 1,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      chainId: 1,
      logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    },
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 1,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  137: [
    {
      address: "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
      symbol: "BRLA",
      name: "BRLA Digital",
      decimals: 18,
      chainId: 137,
      logoURI: "https://cdn.coinranking.com/eSBgf0j3M/BRLA.png",
    },
    {
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      symbol: "USDC",
      name: "USD Coin (PoS)",
      decimals: 6,
      chainId: 137,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      chainId: 137,
      logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    },
    {
      address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 137,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  42161: [
    {
      address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
      symbol: "USDC",
      name: "USD Coin (Arb1)",
      decimals: 6,
      chainId: 42161,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      chainId: 42161,
      logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    },
    {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 42161,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  10: [
    {
      address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chainId: 10,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      chainId: 10,
      logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    },
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 10,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  56: [
    {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 18,
      chainId: 56,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0x55d398326f99059fF775485246999027B3197955",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 18,
      chainId: 56,
      logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    },
    {
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      symbol: "ETH",
      name: "Ethereum Token",
      decimals: 18,
      chainId: 56,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  534352: [
    {
      address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chainId: 534352,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0x5300000000000000000000000000000000000004",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 534352,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
  5000: [
    {
      address: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chainId: 5000,
      logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    },
    {
      address: "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: 5000,
      logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    },
  ],
};

export const getChainConfig = (chainId: number): ChainConfig | null => {
  return CHAINS.find((chain) => chain.chainId === chainId) || null;
};

export const getTokensForChain = (chainId: number): Token[] => {
  return TOKENS_BY_CHAIN[chainId] || [];
};
