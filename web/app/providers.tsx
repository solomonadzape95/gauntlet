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
  const [qc] = useState(() => new QueryClient());
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
