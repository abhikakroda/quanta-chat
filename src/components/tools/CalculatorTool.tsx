import { useState, useCallback } from "react";
import { Calculator, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalculatorTool() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [hasResult, setHasResult] = useState(false);

  const handleInput = useCallback((val: string) => {
    if (hasResult && /[0-9.]/.test(val)) {
      setDisplay(val);
      setExpression(val);
      setHasResult(false);
      return;
    }
    setHasResult(false);

    if (val === "C") {
      setDisplay("0");
      setExpression("");
      return;
    }

    if (val === "⌫") {
      const newExpr = expression.slice(0, -1);
      setExpression(newExpr);
      setDisplay(newExpr || "0");
      return;
    }

    if (val === "=") {
      try {
        // Safe math eval - only allow numbers and operators
        const sanitized = expression.replace(/[^0-9+\-*/.()%]/g, "");
        if (!sanitized) return;
        const result = new Function(`return (${sanitized})`)();
        const formatted = Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : "Error";
        setDisplay(formatted);
        setExpression(formatted);
        setHasResult(true);
      } catch {
        setDisplay("Error");
        setHasResult(true);
      }
      return;
    }

    const newExpr = expression + val;
    setExpression(newExpr);
    setDisplay(newExpr);
  }, [expression, hasResult]);

  const buttons = [
    ["C", "(", ")", "⌫"],
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "%", "+"],
    ["="],
  ];

  return (
    <div className="max-w-[320px] mx-auto p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-center gap-2.5 mb-3">
        <Calculator className="w-6 h-6 text-foreground" />
        <h2 className="text-xl font-semibold text-foreground tracking-tight">Calculator</h2>
      </div>

      {/* Display */}
      <div className="bg-muted/40 border border-border rounded-2xl px-5 py-6">
        <div className="text-right text-xs text-muted-foreground/40 min-h-[1.2em] truncate">
          {expression && hasResult ? "" : expression || ""}
        </div>
        <div className="text-right text-4xl font-semibold text-foreground truncate tracking-tight">
          {display}
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        {buttons.map((row, ri) => (
          <div key={ri} className="flex gap-3 justify-center">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => handleInput(btn)}
                className={cn(
                  "transition-all duration-150 active:scale-95 active:shadow-inner touch-manipulation font-medium text-lg shadow-sm hover:shadow-md",
                  btn === "="
                    ? "w-full h-14 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]"
                    : "w-14 h-14 rounded-[1.25rem]",
                  btn !== "=" && (
                    btn === "C"
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
                      : btn === "⌫"
                      ? "bg-muted text-muted-foreground hover:bg-accent active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]"
                      : /[+\-*/%()]/.test(btn)
                      ? "bg-accent text-foreground/70 hover:bg-accent/80 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]"
                      : "bg-muted/40 text-foreground hover:bg-muted border border-border/50 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                  )
                )}
              >
                {btn === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : btn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
