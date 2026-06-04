import type { ReactNode } from "react";

import { AdminTopBar } from "@/components/site/admin-top-bar";
import { AdminGate } from "./admin-gate";

/**
 * Wraps every /admin/** route with the admin-only top bar and a wallet-based
 * gate. Non-admins see a denied screen instead of the page content.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AdminTopBar />
      <AdminGate>{children}</AdminGate>
    </div>
  );
}
