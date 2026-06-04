"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Loader2, Search } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { shortAddress } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

export default function AdminUsersPage() {
  const users = useQuery(api.users.list, convexConfigured ? {} : "skip");
  const [filter, setFilter] = useState("");

  type UserRow = {
    _id: string;
    address: string;
    displayName?: string;
    firstSeenAt: number;
    passCount: number;
  };
  const visible = (users as UserRow[] | undefined)?.filter((u) =>
    filter ? u.address.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Users</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Wallets we&apos;ve seen
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Derived from the on-chain event log. Counts update as the events
            ingestion cron runs.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="mb-5 flex items-center gap-2 border border-zinc-900 bg-ink px-3 py-2 max-w-md">
            <Search className="size-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by address"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent flex-1 font-mono text-sm outline-none"
            />
          </div>

          {users === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading users…
            </div>
          )}
          {users && visible && visible.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No users yet.
            </div>
          )}
          {visible && visible.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {(visible as UserRow[]).map((u) => (
                <li
                  key={u._id}
                  className="px-5 py-4 grid grid-cols-12 items-center gap-3"
                >
                  <div className="col-span-12 md:col-span-6 min-w-0">
                    <div className="font-mono text-sm text-zinc-100 truncate">
                      {u.address}
                    </div>
                    {u.displayName && (
                      <div className="text-utility text-zinc-500 truncate mt-1">
                        {u.displayName}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-2 text-utility text-zinc-500">
                    {u.passCount} pass{u.passCount === 1 ? "" : "es"}
                  </div>
                  <div className="col-span-4 md:col-span-2 text-utility text-zinc-600">
                    first {formatDate(u.firstSeenAt)}
                  </div>
                  <div className="col-span-4 md:col-span-2 text-utility text-zinc-600 truncate">
                    {shortAddress(u.address)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
