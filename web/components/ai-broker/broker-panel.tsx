"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";

import type { Player } from "@/lib/types";
import type { PoolState } from "@/lib/hooks/use-pool-state";
import { formatSui } from "@/lib/sui";
import { cn } from "@/lib/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BrokerPanelProps {
  open: boolean;
  onClose: () => void;
  roster: Player[];
  pool: PoolState | null | undefined;
  counts: Record<number, number>;
  myPlayerIds: number[];
}

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: "Safest bet", prompt: "Who's the safest pick on the board right now? Quote the target and explain why." },
  { label: "Contrarian play", prompt: "Who's the best contrarian play — someone underpicked but realistic to hit their target?" },
  { label: "Compare my picks", prompt: "Look at the players I already own and tell me how to balance my next pick around them." },
  { label: "Explain a target", prompt: "Pick the toughest target on the board and walk me through whether it's actually achievable." },
];

export function BrokerPanel({
  open,
  onClose,
  roster,
  pool,
  counts,
  myPlayerIds,
}: BrokerPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on every message tick.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Abort any in-flight request when the panel closes.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const ctx = {
        poolPhase: pool?.phase ?? 0,
        potSui: pool ? formatSui(pool.pot_mist) : "0",
        totalMints: pool?.total_passes ?? 0,
        alive: pool?.alive_count ?? 0,
        myPlayerIds,
        pickCounts: counts,
        roster: roster.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          club: p.club,
          position: p.position,
          difficulty: p.difficulty,
          target: p.target,
          ai_rationale: p.ai_rationale,
        })),
      };

      const res = await fetch("/api/ai-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: ctx }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Broker error (${res.status}) ${detail.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const out = [...prev];
          out[out.length - 1] = { role: "assistant", content: acc };
          return out;
        });
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) => {
        const out = [...prev];
        if (out[out.length - 1]?.role === "assistant" && !out[out.length - 1].content) {
          out.pop();
        }
        return out;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed top-0 right-0 z-50 h-full w-full md:w-[460px] lg:w-[520px] bg-ink-surface border-l border-zinc-800 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900 shrink-0">
              <div>
                <div className="text-utility text-zinc-500 inline-flex items-center gap-2">
                  <Sparkles className="size-3.5 text-hazard" />
                  AI Game Master
                </div>
                <h2 className="font-serif text-2xl font-semibold tracking-tight mt-1">
                  Ask the Broker.
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close broker"
                className="text-zinc-500 hover:text-hazard transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-5">
                  <p className="text-base text-zinc-300 leading-relaxed">
                    I set every target on this board. Ask me who to back, who to fade, or why a target reads the way it does.
                  </p>

                  <div className="text-utility text-zinc-500">Quick prompts</div>
                  <div className="grid grid-cols-1 gap-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="text-left px-4 py-3 border border-zinc-800 hover:border-hazard hover:bg-zinc-900/40 transition-colors"
                      >
                        <div className="text-utility text-hazard">{q.label}</div>
                        <div className="mt-1 text-sm text-zinc-300 leading-snug">
                          {q.prompt}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    content={m.content}
                    streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
                  />
                ))
              )}

              {error && (
                <div className="border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-zinc-900 px-4 py-4 shrink-0 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={streaming ? "Streaming…" : "Ask anything — picks, targets, odds…"}
                disabled={streaming}
                className="flex-1 bg-ink border border-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hazard transition-colors"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send"
                className={cn(
                  "inline-flex items-center justify-center size-12 rounded-full transition-all",
                  streaming || !input.trim()
                    ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                    : "bg-hazard text-ink hover:scale-105 active:scale-95",
                )}
              >
                {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-zinc-900 px-4 py-2.5 rounded-2xl rounded-br-sm text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <div className="text-utility text-hazard inline-flex items-center gap-1.5 mb-1.5">
          <Sparkles className="size-3" />
          Broker
        </div>
        <div className="text-base text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {content}
          {streaming && (
            <span className="inline-block w-[2px] h-4 align-middle bg-hazard ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
