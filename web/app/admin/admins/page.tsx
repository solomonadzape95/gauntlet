"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2, Trash2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { ADMIN_ADDRESS } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

export default function AdminAdminsPage() {
  const account = useCurrentAccount();
  const admins = useQuery(api.admin.list, convexConfigured ? {} : "skip");
  const myRole = useQuery(
    api.admin.role,
    convexConfigured && account?.address
      ? { address: account.address }
      : "skip",
  );
  const addAdmin = useMutation(api.admin.add);
  const removeAdmin = useMutation(api.admin.remove);

  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"admin" | "super">("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuper =
    myRole === "super" ||
    (ADMIN_ADDRESS !== "0x0" &&
      account?.address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase());

  const handleAdd = async () => {
    setError(null);
    if (!address.trim() || !address.startsWith("0x")) {
      setError("Address must start with 0x.");
      return;
    }
    try {
      setBusy(true);
      await addAdmin({
        address: address.trim(),
        role,
        addedBy: account?.address,
      });
      setAddress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (addr: string) => {
    if (
      !confirm(`Remove admin role from ${addr.slice(0, 10)}…?`)
    )
      return;
    try {
      await removeAdmin({ address: addr });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Admins</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Admin roles
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Super admins can add or remove other admins. Regular admins can use
            the console but cannot manage roles.
          </p>
        </section>
      </CornerFrame>

      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10">
          {admins === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {admins && admins.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No admins yet. Seed the bootstrap super-admin with{" "}
              <code className="font-mono">pnpm dlx convex run seed:default</code>.
            </div>
          )}
          {admins && admins.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {(admins as Array<{
                _id: string;
                address: string;
                role: string;
                addedAt: number;
              }>).map((a) => (
                <li
                  key={a._id}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-zinc-100 truncate">
                      {a.address}
                    </div>
                    <div className="text-utility text-zinc-500 mt-1">
                      {a.role.toUpperCase()} · added{" "}
                      {new Date(a.addedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  {isSuper && a.role !== "super" && (
                    <button
                      onClick={() => handleRemove(a.address)}
                      className="text-zinc-500 hover:text-red-400 inline-flex items-center gap-1.5 text-utility"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isSuper && (
        <section>
          <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
            <div className="border border-zinc-900 p-6 md:p-8 max-w-2xl">
              <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
                Add admin
              </h2>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="text-utility text-zinc-500 block mb-2">
                    Sui address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x…"
                    className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
                  />
                </div>
                <div>
                  <label className="text-utility text-zinc-500 block mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "admin" | "super")
                    }
                    className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
                  >
                    <option value="admin">Admin</option>
                    <option value="super">Super</option>
                  </select>
                </div>
              </div>
              <div className="mt-5">
                <Button
                  variant="hazard"
                  onClick={handleAdd}
                  disabled={busy}
                  bullet
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Adding…
                    </>
                  ) : (
                    "Add admin"
                  )}
                </Button>
              </div>
              {error && (
                <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3">
                  <p className="text-base text-red-300 break-words">{error}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
