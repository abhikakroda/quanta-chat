import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Gamepad2, Trophy, Zap, Star, TrendingUp, Pin, PinOff } from "lucide-react";
import { ALL_TOOLS } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "AI", "Career", "Learning", "Productivity", "Chat", "Search", "Creative", "Code", "Utility"] as const;

// Gamified color palette per category
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  AI: { bg: "bg-violet-500/10", text: "text-violet-500", border: "border-violet-500/20", glow: "shadow-violet-500/10" },
  Career: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20", glow: "shadow-amber-500/10" },
  Learning: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
  Productivity: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20", glow: "shadow-blue-500/10" },
  Chat: { bg: "bg-pink-500/10", text: "text-pink-500", border: "border-pink-500/20", glow: "shadow-pink-500/10" },
  Search: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/20", glow: "shadow-cyan-500/10" },
  Creative: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/20", glow: "shadow-orange-500/10" },
  Code: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", glow: "shadow-green-500/10" },
  Utility: { bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20", glow: "shadow-slate-500/10" },
};

const CATEGORY_EMOJIS: Record<string, string> = {
  All: "🎮", AI: "🤖", Career: "🚀", Learning: "📚", Productivity: "⚡",
  Chat: "💬", Search: "🔍", Creative: "🎨", Code: "💻", Utility: "🔧",
};

export default function AIPlayground() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("pinned_tools") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("pinned_tools", JSON.stringify(pinnedIds)); }, [pinnedIds]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = useMemo(() => ALL_TOOLS.filter((tool) => {
    const matchesSearch = !search.trim() || tool.label.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  }), [search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_TOOLS.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, []);

  const handleSelectTool = (toolId: string) => {
    navigate(`/?tool=${toolId}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 animated-gradient-bg" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
              <Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3">
                AI Playground
                <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {ALL_TOOLS.length} tools
                </span>
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
                Explore, experiment, and level up with powerful AI tools
              </p>
            </div>

            {/* Stats bar */}
            <div className="flex gap-4 sm:gap-6">
              {[
                { icon: Trophy, label: "Categories", value: Object.keys(categoryCounts).length, color: "text-amber-500" },
                { icon: Zap, label: "Tools", value: ALL_TOOLS.length, color: "text-emerald-500" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon className={cn("w-5 h-5 mx-auto mb-1", stat.color)} />
                  <div className="text-lg font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools… e.g. 'image', 'code', 'debate'"
              className="w-full bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Category pills with emoji + count */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium whitespace-nowrap transition-all duration-200 press-scale border",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-card border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border"
              )}
            >
              <span>{CATEGORY_EMOJIS[cat]}</span>
              <span>{cat}</span>
              {cat !== "All" && categoryCounts[cat] && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeCategory === cat ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tools grid — gamified cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool, index) => {
            const colors = CATEGORY_COLORS[tool.category] || CATEGORY_COLORS.Utility;
            return (
              <button
                key={tool.id}
                onClick={() => handleSelectTool(tool.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-3 p-5 rounded-2xl border bg-card transition-all duration-300 text-left press-scale",
                  "hover:-translate-y-1 hover:shadow-xl",
                  colors.border,
                  `hover:${colors.glow}`
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Top row: icon + label + badge */}
                <div className="flex items-center gap-3 w-full">
                  <div className={cn("p-2.5 rounded-xl transition-colors", colors.bg, colors.text)}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[15px] text-foreground truncate">{tool.label}</span>
                      {"badge" in tool && (tool as any).badge && (
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                          (tool as any).badge === "New" ? "bg-emerald-500/10 text-emerald-500" :
                          (tool as any).badge === "Live" ? "bg-red-500/10 text-red-500 animate-pulse" :
                          (tool as any).badge === "Pro" ? "bg-amber-500/10 text-amber-500" :
                          "bg-primary/10 text-primary"
                        )}>
                          {(tool as any).badge}
                        </span>
                      )}
                    </div>
                    <span className={cn("text-[11px] font-medium", colors.text, "opacity-70")}>{tool.category}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tool.prompt}</p>

                {/* Bottom action hint */}
                <div className="flex items-center gap-1.5 mt-auto pt-1 text-[11px] text-muted-foreground/40 group-hover:text-primary transition-colors">
                  <Zap className="w-3 h-3" />
                  <span>Launch tool</span>
                </div>

                {/* Hover glow effect */}
                <div className={cn(
                  "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                  "bg-gradient-to-br from-transparent via-transparent to-primary/5"
                )} />
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎮</div>
            <p className="text-lg font-medium text-foreground">No tools found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or category</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 mb-6 text-center">
          <p className="text-xs text-muted-foreground/40">
            OpenTropic AI Playground — Built by Abhishek Meena
          </p>
        </div>
      </div>
    </div>
  );
}
