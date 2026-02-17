import { useState, useRef, useEffect } from "react";
import { Code2, Loader2, Send, Eye, CodeXml, Copy, Check, RotateCcw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  html?: string; // extracted HTML for preview
};

export default function CodeAssistantTool() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeHtml, setActiveHtml] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const extractHtml = (text: string): string => {
    const match = text.match(/```html\n([\s\S]*?)```/);
    return match ? match[1] : "";
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError("");
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: history,
          model: "qwen-coder",
          enableThinking: false,
          skillPrompt: `You are an expert website builder and coding assistant. 
When the user asks to build or create a website/page/app, generate a COMPLETE single-file HTML page with embedded CSS and JavaScript inside a \`\`\`html code block.
Make it modern, responsive, visually appealing with gradients, animations, and clean typography.
When the user asks to modify the existing website, update the full HTML code and return it in a \`\`\`html code block.
For non-website coding questions, provide clear code with explanations.
Always return the FULL updated HTML — never partial snippets.`,
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResult += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResult };
                return updated;
              });
            }
          } catch { /* partial */ }
        }
      }

      // Extract HTML and set preview
      const html = extractHtml(fullResult);
      if (html) {
        setActiveHtml(html);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResult, html };
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setMessages([]);
    setActiveHtml("");
    setShowCode(false);
    setError("");
  };

  const hasPreview = !!activeHtml;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Website Builder</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {hasPreview && (
            <>
              <button
                onClick={() => setShowCode(false)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  !showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setShowCode(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <CodeXml className="w-3.5 h-3.5" />
                Code
              </button>
            </>
          )}
          {messages.length > 0 && (
            <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-1" title="New project">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main area: split layout when preview exists */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chat panel */}
        <div className={cn(
          "flex flex-col min-h-0 transition-all duration-300",
          hasPreview ? "w-[340px] border-r border-border/30" : "w-full"
        )}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/70">Describe a website</p>
                  <p className="text-xs text-muted-foreground mt-1">I'll build it live with a preview</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {["Portfolio site", "Landing page", "Dashboard UI", "Blog layout"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(`Build a modern ${s.toLowerCase()}`); inputRef.current?.focus(); }}
                      className="px-3 py-1.5 rounded-full text-xs bg-muted/50 border border-border/30 text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-chat-user text-chat-user-foreground rounded-2xl rounded-br-md"
                    : "text-foreground"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground [&_pre]:hidden [&_code]:hidden">
                      <ReactMarkdown>
                        {msg.content.replace(/```html\n[\s\S]*?```/g, hasPreview ? "✅ *Website updated — see preview →*" : "")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building...
                </div>
              </div>
            )}

            {error && <p className="text-destructive text-xs text-center">{error}</p>}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/30">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasPreview ? "Describe changes..." : "Describe a website to build..."}
                rows={1}
                className="flex-1 bg-muted/30 border border-border/30 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 max-h-[100px] overflow-y-auto"
                style={{ minHeight: "40px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview / Code panel */}
        {hasPreview && (
          <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
            {showCode ? (
              /* Code view */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground font-mono">index.html</span>
                  <button onClick={copyCode} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{activeHtml}</pre>
                </div>
              </div>
            ) : (
              /* Live preview */
              <div className="flex-1 rounded-lg overflow-hidden m-2 border border-border/30 bg-white">
                <iframe
                  srcDoc={activeHtml}
                  className="w-full h-full"
                  sandbox="allow-scripts"
                  title="Live Preview"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
