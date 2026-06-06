"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { ConvexProvider } from "convex/react";
import "@mysten/dapp-kit/dist/index.css";
import { useState } from "react";

import { convex } from "@/lib/convex";
import { WalletSignupModal } from "@/components/site/wallet-signup-modal";

// MAINNET. All Sui RPC calls go through our own /api/sui-rpc route, which
// forwards to the configured mainnet RPC server-side. Two wins:
//   1. A provider's strict CORS (which can reject @mysten/sui's
//      Client-Sdk-Version header) is bypassed since the request is same-origin.
//   2. Any RPC API key stays in server env, not in the client bundle.
const RPC = "/api/sui-rpc";

const { networkConfig } = createNetworkConfig({
  mainnet: { url: RPC },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Default query behaviour tuned to spare the RPC rate limit: no refetch storm
  // on window focus (every chain read fires at once otherwise), a short
  // staleTime so duplicate reads dedupe, and capped retries.
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 10_000,
            retry: 1,
            retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
          },
        },
      }),
  );
  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={qc}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
          <WalletProvider autoConnect>
            {children}
            <WalletSignupModal />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}
