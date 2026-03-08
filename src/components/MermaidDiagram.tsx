import { useEffect, useRef, useState, memo } from "react";
import mermaid from "mermaid";
import { cn } from "@/lib/utils";

let mermaidInitialized = false;

function initMermaid(dark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: '"DM Sans", system-ui, sans-serif',
    flowchart: { htmlLabels: true, curve: "basis" },
    sequence: { actorMargin: 50, messageMargin: 40 },
  });
  mermaidInitialized = true;
}

let idCounter = 0;

function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const idRef = useRef(`mermaid-${Date.now()}-${idCounter++}`);

  useEffect(() => {
    const dark = document.documentElement.classList.contains("dark");
    if (!mermaidInitialized) initMermaid(dark);

    const render = async () => {
      try {
        // Re-init with current theme
        initMermaid(dark);
        const { svg: rendered } = await mermaid.render(idRef.current, chart.trim());
        setSvg(rendered);
        setError("");
      } catch (err: any) {
        console.warn("Mermaid render error:", err);
        setError(err?.message || "Failed to render diagram");
        setSvg("");
      }
    };

    render();
  }, [chart]);

  if (error) {
    return (
      <div className="my-2 rounded-xl border border-border/50 bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Diagram code:</p>
        <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-card/50 p-4 overflow-x-auto">
      <div
        ref={containerRef}
        className="flex justify-center [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export default memo(MermaidDiagram);
