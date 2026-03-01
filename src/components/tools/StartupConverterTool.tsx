import { useState, useRef, useCallback } from "react";
import { Rocket, Loader2, ArrowRight, Copy, Check, ChevronDown, DollarSign, BarChart3, Target, Layers, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SECTION_CONFIG = [
  { id: "monetization", label: "Monetization Model", icon: DollarSign, emoji: "💰" },
  { id: "pitch", label: "Pitch Deck Outline", icon: BarChart3, emoji: "📊" },
  { id: "market", label: "Market Validation", icon: Target, emoji: "🎯" },
  { id: "revenue", label: "Revenue Plan", icon: TrendingUp, emoji: "📈" },
  { id: "techstack", label: "Tech Stack Upgrade", icon: Layers, emoji: "🛠️" },
] as const;

type SectionId = typeof SECTION_CONFIG[number]["id"];

type StartupPlan = {
  [K in SectionId]?: string;
};

export default function StartupConverterTool() {
  const { user } = useAuth();
  const [projectDesc, setProjectDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [plan, setPlan] = useState<StartupPlan>({});
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const callAI = useCallback(async (prompt: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "mistral",
        enableThinking: false,
        skillPrompt: "You are a startup strategist and business analyst. You turn side projects into viable startup plans. Be specific, actionable, and data-driven. Use markdown formatting.",
      }),
    });

    if (!resp.ok) throw new Error("AI request failed");
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response");
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

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
          if (content) full += content;
        } catch { /* partial */ }
      }
    }
    return full.trim();
  }, []);

  const generateAll = async () => {
    if (!projectDesc.trim()) return;
    setLoading(true);
    setGenerated(true);
    setPlan({});
    setActiveSection("monetization");

    const sections: { id: SectionId; prompt: string }[] = [
      {
        id: "monetization",
        prompt: `Given this project: "${projectDesc}"

Generate a detailed monetization model. Include:
- **Primary Revenue Stream** (SaaS, marketplace, freemium, etc.)
- **Pricing Tiers** (Free, Pro, Enterprise with specific prices)
- **Upsell Strategy**
- **Unit Economics** (estimated CAC, LTV, margins)
- **Monetization Timeline** (Month 1-3, 3-6, 6-12)

Be specific with numbers and strategies. Use markdown.`
      },
      {
        id: "pitch",
        prompt: `Given this project: "${projectDesc}"

Create a complete pitch deck outline (10 slides). For each slide include:
1. **Slide Title**
2. **Key Message** (1 sentence)
3. **Content Points** (3-4 bullets)
4. **Visual Suggestion**

Cover: Problem, Solution, Market Size, Product, Business Model, Traction, Team, Competition, Financials, Ask.
Use markdown formatting.`
      },
      {
        id: "market",
        prompt: `Given this project: "${projectDesc}"

Provide market validation analysis:
- **TAM/SAM/SOM** with estimated numbers
- **Target Customer Persona** (demographics, pain points, willingness to pay)
- **Competitor Analysis** (3-5 competitors with strengths/weaknesses)
- **Market Trends** supporting this idea
- **Validation Experiments** (3 quick tests to validate demand before building more)
- **Red Flags / Risks** to watch

Be data-driven and specific. Use markdown.`
      },
      {
        id: "revenue",
        prompt: `Given this project: "${projectDesc}"

Build a 12-month revenue projection plan:
- **Month 1-3**: Launch phase (users, revenue targets)
- **Month 4-6**: Growth phase (scaling strategy, revenue milestones)
- **Month 7-12**: Scale phase (expansion, hiring, funding needs)
- **Key Metrics to Track** (MRR, churn, conversion rate, etc.)
- **Break-even Analysis**
- **Funding Needs** (bootstrap vs seed vs Series A path)

Use specific numbers and milestones. Use markdown.`
      },
      {
        id: "techstack",
        prompt: `Given this project: "${projectDesc}"

Recommend a tech stack upgrade path for startup scale:
- **Current Stack Assessment** (likely tech based on the project)
- **Immediate Upgrades** (what to add/change now)
- **Scale-Ready Architecture** (what to build for 10K-100K users)
- **Infrastructure** (hosting, CDN, monitoring, CI/CD)
- **Security & Compliance** (SOC2, GDPR considerations)
- **Build vs Buy** decisions for key components
- **Cost Estimates** (monthly infra costs at different scales)

Be specific with technology recommendations. Use markdown.`
      },
    ];

    for (const section of sections) {
      setLoadingSection(section.id);
      setActiveSection(section.id);
      try {
        const result = await callAI(section.prompt);
        setPlan(prev => ({ ...prev, [section.id]: result }));
      } catch (err) {
        console.error(`Failed to generate ${section.id}:`, err);
        setPlan(prev => ({ ...prev, [section.id]: `⚠️ Failed to generate. Please try again.` }));
      }
    }

    setLoadingSection(null);
    setLoading(false);
    setActiveSection("monetization");
  };

  const copySection = (id: string) => {
    const content = plan[id as SectionId];
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    const allContent = SECTION_CONFIG
      .map(s => `# ${s.emoji} ${s.label}\n\n${plan[s.id] || "Not generated"}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(`# 🚀 Startup Plan: ${projectDesc}\n\n${allContent}`);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  const reset = () => {
    setProjectDesc("");
    setPlan({});
    setGenerated(false);
    setActiveSection(null);
    setLoading(false);
    setLoadingSection(null);
  };

  // Input screen
  if (!generated) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full animate-message-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Rocket className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Project → Startup</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Describe your project and AI will generate a complete startup plan — monetization, pitch deck, market analysis, and more.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Describe your project</label>
            <textarea
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="e.g. I built an AI-powered resume builder that uses GPT to tailor resumes for specific job postings. It supports multiple templates and ATS optimization..."
              className="w-full resize-none bg-muted/30 border border-border rounded-xl outline-none text-sm text-foreground p-3.5 min-h-[120px] max-h-[200px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40 leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground/50 mt-1">The more detail you provide, the better the startup plan.</p>
          </div>

          {/* What you'll get */}
          <div className="space-y-1.5">
            {SECTION_CONFIG.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                <span>{s.emoji}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={generateAll}
            disabled={!projectDesc.trim() || loading}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            Generate Startup Plan
          </button>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{projectDesc.slice(0, 40)}{projectDesc.length > 40 ? "…" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAll}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
          >
            {copied === "all" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied === "all" ? "Copied!" : "Copy All"}
          </button>
          <button onClick={reset} className="px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            New Plan
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Section tabs - vertical */}
        <div className="w-[180px] shrink-0 border-r border-border/40 overflow-y-auto py-2 hidden sm:block">
          {SECTION_CONFIG.map(s => {
            const isLoading = loadingSection === s.id;
            const isDone = !!plan[s.id] && !isLoading;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-left transition-colors",
                  activeSection === s.id
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <span className="text-sm shrink-0">{s.emoji}</span>
                )}
                <span className="truncate">{s.label}</span>
                {isDone && <Check className="w-3 h-3 ml-auto text-green-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden shrink-0 flex overflow-x-auto border-b border-border/40 px-2 py-1.5 gap-1">
          {SECTION_CONFIG.map(s => {
            const isLoading = loadingSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors shrink-0",
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{s.emoji}</span>}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeSection && (
            <div className="animate-message-in max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  {SECTION_CONFIG.find(s => s.id === activeSection)?.emoji}
                  {SECTION_CONFIG.find(s => s.id === activeSection)?.label}
                </h3>
                {plan[activeSection] && (
                  <button
                    onClick={() => copySection(activeSection)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copy section"
                  >
                    {copied === activeSection ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {loadingSection === activeSection ? (
                <div className="flex items-center gap-2.5 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating {SECTION_CONFIG.find(s => s.id === activeSection)?.label.toLowerCase()}...
                </div>
              ) : plan[activeSection] ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/85 leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:text-sm [&_p]:text-sm [&_strong]:text-foreground">
                  <MarkdownContent content={plan[activeSection]!} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/50 py-8 text-center">Waiting to generate...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple markdown renderer for the plan sections
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];

  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary/60 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={i}>{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={i} className="mt-4">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={i} className="mt-3">{line.slice(4)}</h3>);
    } else if (line.startsWith("---")) {
      flushList();
      elements.push(<hr key={i} className="my-4 border-border/40" />);
    } else if (/^[-*]\s/.test(line)) {
      inList = true;
      listItems.push(line.replace(/^[-*]\s/, ""));
    } else if (/^\d+\.\s/.test(line)) {
      inList = true;
      listItems.push(line.replace(/^\d+\.\s/, ""));
    } else {
      flushList();
      if (line.trim()) {
        elements.push(
          <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      }
    }
  }
  flushList();

  return <>{elements}</>;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-[12px] font-mono">$1</code>');
}
