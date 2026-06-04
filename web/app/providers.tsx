"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { ConvexProvider } from "convex/react";
import "@mysten/dapp-kit/dist/index.css";
import { useState } from "react";

import { convex } from "@/lib/convex";
import { WalletSignupModal } from "@/components/site/wallet-signup-modal";

// All Sui RPC calls go through our own /api/sui-rpc route, which forwards
// to Tatum server-side. Two wins:
//   1. Tatum's strict CORS (which rejects @mysten/sui's Client-Sdk-Version
//      header) is bypassed since the browser request is same-origin.
//   2. The Tatum API key stays in server env, not in the client bundle.
const TESTNET_RPC = "/api/sui-rpc";

const { networkConfig } = createNetworkConfig({
  testnet: { url: TESTNET_RPC },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={qc}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
          <WalletProvider autoConnect>
            {children}
            <WalletSignupModal />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}
