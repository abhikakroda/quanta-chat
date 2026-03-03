import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { ALL_TOOLS } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "AI", "Career", "Learning", "Productivity", "Chat", "Search", "Creative", "Code", "Utility"] as const;

export default function AILabs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = ALL_TOOLS.filter((tool) => {
    const matchesSearch = !search.trim() || tool.label.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectTool = (toolId: string) => {
    // Navigate back to chat with the tool selected via URL param
    navigate(`/?tool=${toolId}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">AI Labs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{ALL_TOOLS.length} tools available</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="w-full bg-muted/30 border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 focus:bg-muted/50 transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 press-scale",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleSelectTool(tool.id)}
              className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent/30 hover:border-primary/20 transition-all duration-200 text-left press-scale hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                  <tool.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{tool.label}</span>
                    {"badge" in tool && (tool as any).badge && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{(tool as any).badge}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground/50">{tool.category}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tool.prompt}</p>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground/50">
            <p className="text-lg">No tools found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        )}
      </div>
    </div>
  );
}
