import { useState, useRef, useCallback } from "react";
import { Play, Loader2, RotateCcw, Terminal, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type LogEntry = { type: "log" | "error" | "warn" | "info" | "result"; content: string };

export default function CodeRunnerTool() {
  const [code, setCode] = useState(`// Write JavaScript code here\nconsole.log("Hello, World!");\n\n// Try math\nconst sum = Array.from({length: 10}, (_, i) => i + 1).reduce((a, b) => a + b, 0);\nconsole.log("Sum 1-10:", sum);`);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const runCode = useCallback(() => {
    setRunning(true);
    setLogs([]);

    // Create sandboxed iframe for execution
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    document.body.appendChild(iframe);

    const entries: LogEntry[] = [];
    const timeout = setTimeout(() => {
      entries.push({ type: "error", content: "⏱ Execution timed out (5s limit)" });
      setLogs([...entries]);
      setRunning(false);
      document.body.removeChild(iframe);
    }, 5000);

    // Listen for messages from sandbox
    const handler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data;
      if (msg?.type === "done") {
        clearTimeout(timeout);
        if (msg.result !== undefined && msg.result !== "undefined") {
          entries.push({ type: "result", content: String(msg.result) });
        }
        setLogs([...entries]);
        setRunning(false);
        window.removeEventListener("message", handler);
        document.body.removeChild(iframe);
      } else if (msg?.type === "console") {
        entries.push({ type: msg.level || "log", content: msg.content });
        setLogs([...entries]);
      }
    };
    window.addEventListener("message", handler);

    const wrappedCode = `
      <script>
        const _origConsole = console;
        const _post = (type, level, content) => parent.postMessage({ type, level, content }, "*");
        console.log = (...args) => _post("console", "log", args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
        console.error = (...args) => _post("console", "error", args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
        console.warn = (...args) => _post("console", "warn", args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
        console.info = (...args) => _post("console", "info", args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
        try {
          const _result = eval(${JSON.stringify(code)});
          parent.postMessage({ type: "done", result: typeof _result === "object" ? JSON.stringify(_result, null, 2) : String(_result) }, "*");
        } catch(e) {
          _post("console", "error", e.message);
          parent.postMessage({ type: "done" }, "*");
        }
      </script>
    `;

    iframe.srcdoc = wrappedCode;
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCode('// Write JavaScript code here\nconsole.log("Hello, World!");');
    setLogs([]);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Code Runner</h2>
            <p className="text-[11px] text-muted-foreground">Execute JavaScript in a sandbox</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={handleReset} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1 flex flex-col min-h-0 gap-3">
        <div className="flex-1 min-h-[200px] rounded-xl overflow-hidden border border-border/30 bg-muted/10">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/20">
            <span className="text-[10px] font-mono text-muted-foreground/60">JavaScript</span>
            <button
              onClick={runCode}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-500/90 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="w-full h-[calc(100%-36px)] p-3 bg-transparent font-mono text-sm text-foreground resize-none outline-none leading-relaxed"
            placeholder="Write your code here..."
          />
        </div>

        {/* Output */}
        <div className="rounded-xl border border-border/30 bg-muted/10 min-h-[120px] max-h-[200px] overflow-y-auto">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/20 sticky top-0">
            <span className="text-[10px] font-mono text-muted-foreground/60">Output</span>
          </div>
          <div className="p-3 space-y-1">
            {logs.length === 0 && (
              <p className="text-xs text-muted-foreground/40 font-mono">// Output will appear here</p>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs font-mono whitespace-pre-wrap",
                  log.type === "error" && "text-red-400",
                  log.type === "warn" && "text-yellow-400",
                  log.type === "info" && "text-blue-400",
                  log.type === "log" && "text-foreground/80",
                  log.type === "result" && "text-green-400"
                )}
              >
                {log.type === "result" ? `→ ${log.content}` : log.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
