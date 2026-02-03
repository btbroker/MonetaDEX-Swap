"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { 
  mainnet, 
  polygon, 
  arbitrum, 
  optimism, 
  bsc,
  base,
  avalanche,
  scroll,
  mantle,
  blast,
  mode,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const config = createConfig({
  chains: [
    mainnet,
    optimism,
    bsc,
    polygon,
    base,
    arbitrum,
    avalanche,
    scroll,
    mantle,
    blast,
    mode,
  ],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
    [scroll.id]: http(),
    [mantle.id]: http(),
    [blast.id]: http(),
    [mode.id]: http(),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
