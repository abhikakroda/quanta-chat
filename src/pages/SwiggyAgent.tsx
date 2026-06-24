import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types for the OpenAI-tool message protocol used by Lovable AI Gateway ──
type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type UiMessage = { id: string; role: "user" | "assistant"; text: string; ts: number };

const SWIGGY_ORANGE = "#FC8019";

export default function SwiggyAgent() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "👋 Hi! I'm your Swiggy ordering assistant. Tell me what you're craving — biryani, pizza, momos, dosa — and I'll handle the rest.",
      ts: Date.now(),
    },
  ]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = ["Order chicken biryani", "I want pizza for two", "Find South Indian breakfast", "Show me available coupons"];

  async function callAgent(nextHistory: ChatMessage[]): Promise<ChatMessage[]> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const resp = await fetch(`${supabaseUrl}/functions/v1/swiggy-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ messages: nextHistory }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(err.error || `Request failed (${resp.status})`);
    }
    const data = await resp.json();
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: data.content || "",
      tool_calls: data.tool_calls?.length ? data.tool_calls : undefined,
    };
    let working = [...nextHistory, assistantMsg];

    // ── Tool-call loop ──
    if (assistantMsg.tool_calls?.length) {
      const toolResults: ChatMessage[] = [];
      for (const call of assistantMsg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        // Forward to the swiggy edge function for tool execution
        const toolResp = await fetch(`${supabaseUrl}/functions/v1/swiggy-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            messages: working,
            tool_call: { name: call.function.name, arguments: args },
          }),
        });
        const toolResult = toolResp.ok ? await toolResp.json() : { error: "Tool failed" };
        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(toolResult),
        });
      }
      working = [...working, ...toolResults];
      // Recurse — Gemini may issue more tool calls before final text.
      return callAgent(working);
    }
    return working;
  }

  async function send(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", text: userText, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const nextHistory: ChatMessage[] = [...history, { role: "user", content: userText }];
      const finalHistory = await callAgent(nextHistory);
      setHistory(finalHistory);
      // Surface every assistant text turn that came back, in order.
      const newAssistantTurns = finalHistory
        .slice(nextHistory.length)
        .filter((m): m is Extract<ChatMessage, { role: "assistant" }> => m.role === "assistant" && !!m.content);
      setMessages((prev) => [
        ...prev,
        ...newAssistantTurns.map((m) => ({
          id: crypto.randomUUID(),
          role: "assistant" as const,
          text: m.content,
          ts: Date.now(),
        })),
      ]);
    } catch (e) {
      const err = (e as Error).message;
      toast({ title: "Couldn't reach the assistant", description: err, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: `⚠️ ${err}`, ts: Date.now() },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[13px]"
              style={{ background: SWIGGY_ORANGE }}
              aria-hidden
            >
              S
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Swiggy AI Agent</div>
              <div className="text-[11px] text-muted-foreground">Order food by chatting</div>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Sparkles className="w-3 h-3" /> Demo mode
          </Badge>
        </div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-4 min-h-0">
        <Card className="flex flex-col h-[calc(100dvh-88px)] overflow-hidden">
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="px-4 sm:px-6 py-5 flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "self-end text-white"
                      : "self-start bg-muted/60 text-foreground",
                  )}
                  style={m.role === "user" ? { background: SWIGGY_ORANGE } : undefined}
                >
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="self-start inline-flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-2.5 text-[13px] text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          </ScrollArea>

          {messages.length <= 1 && (
            <div className="px-4 sm:px-6 pb-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-1.5 rounded-full border border-border/60 text-xs text-foreground/80 hover:bg-muted/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-[color:var(--ring)]/40">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                disabled={busy}
                placeholder='Try: "Order chicken biryani for one"'
                className="flex-1 resize-none bg-transparent outline-none text-[14px] py-1.5 max-h-[140px] min-h-[36px] placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="shrink-0 w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
                style={{ background: SWIGGY_ORANGE }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
