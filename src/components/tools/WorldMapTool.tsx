import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Globe, BookOpen, MapPin, Sparkles, ChevronRight, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Continent = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  hoverColor: string;
  path: string;
  cx: number;
  cy: number;
  countries: Country[];
};

type Country = {
  name: string;
  capital: string;
  emoji: string;
};

type TopicCategory = {
  id: string;
  label: string;
  emoji: string;
  topics: string[];
};

const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: "geography",
    label: "Geography",
    emoji: "🌍",
    topics: ["Physical Features", "Climate Zones", "Rivers & Water Bodies", "Natural Resources", "Biodiversity Hotspots"],
  },
  {
    id: "history",
    label: "History",
    emoji: "📜",
    topics: ["Ancient Civilizations", "Colonial History", "Independence Movements", "Major Wars", "Cultural Heritage"],
  },
  {
    id: "polity",
    label: "Polity & IR",
    emoji: "🏛️",
    topics: ["Government System", "International Organizations", "Trade Agreements", "Border Disputes", "Diplomatic Relations"],
  },
  {
    id: "economy",
    label: "Economy",
    emoji: "💰",
    topics: ["GDP & Growth", "Major Industries", "Trade Routes", "Economic Policies", "Development Indicators"],
  },
  {
    id: "current",
    label: "Current Affairs",
    emoji: "📰",
    topics: ["Recent Events", "Geopolitical Shifts", "Climate Change Impact", "Technology & Innovation", "Social Movements"],
  },
];

const CONTINENTS: Continent[] = [
  {
    id: "north-america",
    name: "North America",
    emoji: "🌎",
    color: "hsl(200 80% 50%)",
    hoverColor: "hsl(200 90% 60%)",
    path: "M80,55 L120,40 L160,45 L175,60 L170,85 L155,100 L140,115 L120,120 L100,110 L85,95 L75,75 Z",
    cx: 125,
    cy: 80,
    countries: [
      { name: "USA", capital: "Washington D.C.", emoji: "🇺🇸" },
      { name: "Canada", capital: "Ottawa", emoji: "🇨🇦" },
      { name: "Mexico", capital: "Mexico City", emoji: "🇲🇽" },
    ],
  },
  {
    id: "south-america",
    name: "South America",
    emoji: "🌎",
    color: "hsl(140 70% 45%)",
    hoverColor: "hsl(140 80% 55%)",
    path: "M140,135 L160,125 L175,140 L180,170 L175,200 L165,225 L150,240 L140,230 L135,200 L130,170 Z",
    cx: 155,
    cy: 180,
    countries: [
      { name: "Brazil", capital: "Brasília", emoji: "🇧🇷" },
      { name: "Argentina", capital: "Buenos Aires", emoji: "🇦🇷" },
      { name: "Colombia", capital: "Bogotá", emoji: "🇨🇴" },
    ],
  },
  {
    id: "europe",
    name: "Europe",
    emoji: "🌍",
    color: "hsl(260 70% 55%)",
    hoverColor: "hsl(260 80% 65%)",
    path: "M230,45 L260,35 L290,40 L300,55 L295,70 L280,80 L260,85 L240,80 L225,65 Z",
    cx: 260,
    cy: 60,
    countries: [
      { name: "UK", capital: "London", emoji: "🇬🇧" },
      { name: "France", capital: "Paris", emoji: "🇫🇷" },
      { name: "Germany", capital: "Berlin", emoji: "🇩🇪" },
    ],
  },
  {
    id: "africa",
    name: "Africa",
    emoji: "🌍",
    color: "hsl(30 85% 55%)",
    hoverColor: "hsl(30 90% 65%)",
    path: "M230,90 L270,85 L290,95 L300,120 L295,155 L280,185 L265,200 L245,195 L230,175 L220,145 L215,115 Z",
    cx: 260,
    cy: 140,
    countries: [
      { name: "Nigeria", capital: "Abuja", emoji: "🇳🇬" },
      { name: "South Africa", capital: "Pretoria", emoji: "🇿🇦" },
      { name: "Egypt", capital: "Cairo", emoji: "🇪🇬" },
    ],
  },
  {
    id: "asia",
    name: "Asia",
    emoji: "🌏",
    color: "hsl(350 75% 55%)",
    hoverColor: "hsl(350 85% 65%)",
    path: "M300,35 L350,30 L400,40 L420,60 L415,90 L400,110 L380,120 L350,115 L320,105 L305,85 L295,60 Z",
    cx: 360,
    cy: 75,
    countries: [
      { name: "India", capital: "New Delhi", emoji: "🇮🇳" },
      { name: "China", capital: "Beijing", emoji: "🇨🇳" },
      { name: "Japan", capital: "Tokyo", emoji: "🇯🇵" },
    ],
  },
  {
    id: "oceania",
    name: "Oceania",
    emoji: "🌏",
    color: "hsl(180 70% 45%)",
    hoverColor: "hsl(180 80% 55%)",
    path: "M380,155 L410,145 L435,155 L440,175 L430,195 L410,200 L390,195 L375,180 Z",
    cx: 410,
    cy: 170,
    countries: [
      { name: "Australia", capital: "Canberra", emoji: "🇦🇺" },
      { name: "New Zealand", capital: "Wellington", emoji: "🇳🇿" },
      { name: "Fiji", capital: "Suva", emoji: "🇫🇯" },
    ],
  },
];

export default function WorldMapTool({ onBack }: { onBack: () => void }) {
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ category: TopicCategory; topic: string } | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const handleContinentClick = (continent: Continent) => {
    setSelectedContinent(continent);
    setSelectedTopic(null);
    setAiContent("");
    setSelectedCountry(null);
  };

  const handleTopicSelect = useCallback(async (category: TopicCategory, topic: string, country?: Country) => {
    if (!selectedContinent) return;
    setSelectedTopic({ category, topic });
    setAiLoading(true);
    setAiContent("");

    const region = country ? `${country.name} (${country.capital})` : selectedContinent.name;
    const prompt = `Give a concise, UPSC-exam-focused summary about "${topic}" related to ${region}. 
Include: key facts, important data points, exam-relevant details, and 3 potential UPSC questions at the end.
Format with clear headings, bullet points, and bold key terms. Keep it under 600 words.`;

    try {
      const res = await supabase.functions.invoke("chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
          model: "google/gemini-2.5-flash",
          systemPrompt: "You are an expert UPSC preparation tutor. Provide accurate, exam-oriented content with facts, figures, and practice questions. Use markdown formatting.",
        },
      });

      if (res.data) {
        const reader = res.data.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            setAiContent(text);
          }
        } else if (typeof res.data === "string") {
          setAiContent(res.data);
        }
      }
    } catch {
      setAiContent("Failed to load content. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, [selectedContinent]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <button onClick={selectedContinent ? () => { setSelectedContinent(null); setSelectedTopic(null); setAiContent(""); } : onBack}
          className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {selectedContinent ? selectedContinent.name : "World Map"} 
              {selectedCountry && ` › ${selectedCountry.name}`}
            </h2>
            <p className="text-[10px] text-muted-foreground">UPSC & Competitive Exam Prep</p>
          </div>
        </div>
        {selectedContinent && (
          <span className="ml-auto text-lg">{selectedContinent.emoji}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedContinent ? (
          /* ============ WORLD MAP VIEW ============ */
          <div className="p-4 space-y-4">
            {/* Interactive SVG Map */}
            <div className="relative bg-card rounded-2xl border border-border/50 overflow-hidden p-4">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-500">LIVE</span>
              </div>
              
              <svg viewBox="0 0 500 280" className="w-full h-auto" style={{ maxHeight: "320px" }}>
                {/* Ocean background */}
                <rect x="0" y="0" width="500" height="280" rx="16" fill="hsl(210 40% 12%)" />
                
                {/* Grid lines */}
                {[...Array(10)].map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 28} x2="500" y2={i * 28} stroke="hsl(210 30% 20%)" strokeWidth="0.5" />
                ))}
                {[...Array(10)].map((_, i) => (
                  <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="280" stroke="hsl(210 30% 20%)" strokeWidth="0.5" />
                ))}

                {/* Continents */}
                {CONTINENTS.map((cont) => (
                  <g key={cont.id}
                    onClick={() => handleContinentClick(cont)}
                    onMouseEnter={() => setHoveredContinent(cont.id)}
                    onMouseLeave={() => setHoveredContinent(null)}
                    className="cursor-pointer"
                    style={{ transition: "all 0.3s ease" }}
                  >
                    <path
                      d={cont.path}
                      fill={hoveredContinent === cont.id ? cont.hoverColor : cont.color}
                      stroke="hsl(0 0% 100% / 0.2)"
                      strokeWidth="1.5"
                      style={{
                        filter: hoveredContinent === cont.id ? `drop-shadow(0 0 12px ${cont.color})` : "none",
                        transition: "all 0.3s ease",
                        transform: hoveredContinent === cont.id ? "scale(1.03)" : "scale(1)",
                        transformOrigin: `${cont.cx}px ${cont.cy}px`,
                      }}
                    />
                    {/* Label */}
                    <text
                      x={cont.cx}
                      y={cont.cy - 6}
                      textAnchor="middle"
                      fill="white"
                      fontSize="8"
                      fontWeight="700"
                      style={{ pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      {cont.name}
                    </text>
                    {/* Ping dot */}
                    <circle cx={cont.cx} cy={cont.cy + 6} r="3" fill="white" opacity="0.8">
                      <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </g>
                ))}
              </svg>

              <p className="text-center text-xs text-muted-foreground mt-3">
                🗺️ Click any continent to explore UPSC-relevant topics
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Continents", value: "6", emoji: "🌍", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
                { label: "Topics", value: "25+", emoji: "📚", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
                { label: "Categories", value: "5", emoji: "📋", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
              ].map((s) => (
                <div key={s.label} className={cn("text-center p-3 rounded-xl border", s.color)}>
                  <div className="text-lg">{s.emoji}</div>
                  <div className="text-base font-bold mt-1">{s.value}</div>
                  <div className="text-[10px] opacity-70">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Topic categories preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Topic Categories</h3>
              <div className="flex flex-wrap gap-2">
                {TOPIC_CATEGORIES.map((cat) => (
                  <span key={cat.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/50 text-xs font-medium text-foreground">
                    {cat.emoji} {cat.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : !selectedTopic ? (
          /* ============ CONTINENT DETAIL VIEW ============ */
          <div className="p-4 space-y-4">
            {/* Continent hero */}
            <div className="rounded-2xl p-5 border border-border/50" style={{ background: `linear-gradient(135deg, ${selectedContinent.color}15, ${selectedContinent.color}05)` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{selectedContinent.emoji}</span>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">{selectedContinent.name}</h3>
                  <p className="text-xs text-muted-foreground">Select a country or topic to study</p>
                </div>
              </div>

              {/* Countries */}
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedContinent.countries.map((country) => (
                  <button
                    key={country.name}
                    onClick={() => setSelectedCountry(selectedCountry?.name === country.name ? null : country)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                      selectedCountry?.name === country.name
                        ? "bg-primary text-primary-foreground border-primary shadow-lg"
                        : "bg-card border-border/50 text-foreground hover:border-primary/30"
                    )}
                  >
                    <span>{country.emoji}</span>
                    <span>{country.name}</span>
                    <span className="text-[10px] opacity-60">({country.capital})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic categories */}
            {TOPIC_CATEGORIES.map((category) => (
              <div key={category.id} className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                  {category.emoji} {category.label}
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {category.topics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleTopicSelect(category, topic, selectedCountry || undefined)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 hover:bg-accent/30 transition-all text-left group"
                    >
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-sm font-medium text-foreground flex-1">{topic}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ============ AI CONTENT VIEW ============ */
          <div className="p-4 space-y-3">
            {/* Topic header */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setSelectedTopic(null); setAiContent(""); }}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to topics
              </button>
            </div>

            <div className="rounded-xl p-4 border border-border/50 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{selectedTopic.category.emoji}</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedTopic.topic}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedTopic.category.label} • {selectedCountry?.name || selectedContinent.name}
                  </p>
                </div>
                {aiLoading && <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />}
              </div>
            </div>

            {/* AI Generated Content */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-4 min-h-[200px]">
              {aiContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground
                  prose-headings:text-foreground prose-strong:text-foreground
                  prose-p:text-muted-foreground prose-li:text-muted-foreground
                  prose-h2:text-base prose-h3:text-sm">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  <p className="text-xs text-muted-foreground">Generating UPSC study material…</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
