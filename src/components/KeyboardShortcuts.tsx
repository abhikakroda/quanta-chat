import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { keys: ["⌘", "Enter"], desc: "Send message" },
  { keys: ["Shift", "Enter"], desc: "New line in message" },
  { keys: ["⌘", "K"], desc: "New chat" },
  { keys: ["⌘", "B"], desc: "Toggle sidebar" },
  { keys: ["⌘", "\\"], desc: "Toggle dark mode" },
  { keys: ["?"], desc: "Show shortcuts" },
  { keys: ["Esc"], desc: "Close panel / Stop generation" },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
      <div className="bg-popover border border-border rounded-2xl shadow-lg w-[340px] p-5 space-y-4 animate-scale-spring" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground/70">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-mono text-muted-foreground min-w-[24px] text-center">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center pt-1">Press ? anywhere to toggle</p>
      </div>
    </div>
  );
}
