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
    <div className="max-w-xs mx-auto p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Calculator</h2>
      </div>

      {/* Display */}
      <div className="bg-muted/50 border border-border rounded-2xl p-4">
        <div className="text-right text-xs text-muted-foreground/50 min-h-[1.2em] truncate">
          {expression && hasResult ? "" : expression || ""}
        </div>
        <div className="text-right text-3xl font-mono font-semibold text-foreground truncate">
          {display}
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        {buttons.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => handleInput(btn)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-base font-medium transition-all duration-150 active:scale-95 touch-manipulation",
                  btn === "="
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : btn === "C"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : btn === "⌫"
                    ? "bg-muted text-muted-foreground hover:bg-accent"
                    : /[+\-*/%()]/.test(btn)
                    ? "bg-accent text-foreground hover:bg-accent/80"
                    : "bg-muted/50 text-foreground hover:bg-muted border border-border"
                )}
              >
                {btn === "⌫" ? <Delete className="w-4 h-4 mx-auto" /> : btn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
