import { useState, useCallback, memo } from "react";
import { ArrowLeft, Globe, MapPin, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type TopicCategory = {
  id: string;
  label: string;
  emoji: string;
  topics: string[];
};

const TOPIC_CATEGORIES: TopicCategory[] = [
  { id: "geography", label: "Geography", emoji: "🌍", topics: ["Physical Features", "Climate Zones", "Rivers & Water Bodies", "Natural Resources", "Biodiversity Hotspots"] },
  { id: "history", label: "History", emoji: "📜", topics: ["Ancient Civilizations", "Colonial History", "Independence Movements", "Major Wars", "Cultural Heritage"] },
  { id: "polity", label: "Polity & IR", emoji: "🏛️", topics: ["Government System", "International Organizations", "Trade Agreements", "Border Disputes", "Diplomatic Relations"] },
  { id: "economy", label: "Economy", emoji: "💰", topics: ["GDP & Growth", "Major Industries", "Trade Routes", "Economic Policies", "Development Indicators"] },
  { id: "current", label: "Current Affairs", emoji: "📰", topics: ["Recent Events", "Geopolitical Shifts", "Climate Change Impact", "Technology & Innovation", "Social Movements"] },
];

// Color countries by continent region
function getColor(geo: any, hovered: boolean): string {
  const id = geo.id || geo.properties?.ISO_A3 || "";
  const name = (geo.properties?.name || "").toLowerCase();

  // Rough continent mapping by ISO numeric
  const numId = parseInt(id);
  let base = "hsl(210 30% 30%)";

  // Africa ~10-180
  if ((numId >= 10 && numId <= 180) || ["egypt","nigeria","south africa","kenya","ethiopia","morocco","algeria","ghana","tanzania"].some(c => name.includes(c)))
    base = hovered ? "hsl(30 85% 55%)" : "hsl(30 65% 40%)";
  // Europe ~200-400
  else if ((numId >= 200 && numId <= 400) || ["france","germany","united kingdom","italy","spain","poland","ukraine","sweden","norway"].some(c => name.includes(c)))
    base = hovered ? "hsl(260 70% 60%)" : "hsl(260 50% 40%)";
  // Asia ~400-700
  else if ((numId >= 356 && numId <= 900) || ["india","china","japan","indonesia","pakistan","bangladesh","vietnam","thailand","iran","iraq","saudi"].some(c => name.includes(c)))
    base = hovered ? "hsl(350 75% 60%)" : "hsl(350 55% 40%)";
  // North America
  else if (["united states","canada","mexico","cuba","guatemala","honduras"].some(c => name.includes(c)) || (numId >= 124 && numId <= 840 && numId < 200))
    base = hovered ? "hsl(200 80% 55%)" : "hsl(200 60% 38%)";
  // South America
  else if (["brazil","argentina","colombia","peru","chile","venezuela","ecuador","bolivia"].some(c => name.includes(c)))
    base = hovered ? "hsl(140 70% 50%)" : "hsl(140 50% 35%)";
  // Oceania
  else if (["australia","new zealand","papua","fiji"].some(c => name.includes(c)))
    base = hovered ? "hsl(180 70% 50%)" : "hsl(180 50% 35%)";
  else
    base = hovered ? "hsl(210 40% 50%)" : "hsl(210 30% 32%)";

  return base;
}

const MapChart = memo(({ onSelect, hoveredGeo, setHoveredGeo }: {
  onSelect: (name: string) => void;
  hoveredGeo: string | null;
  setHoveredGeo: (g: string | null) => void;
}) => (
  <ComposableMap
    projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
    width={800}
    height={400}
    style={{ width: "100%", height: "auto" }}
  >
    <ZoomableGroup center={[0, 20]} zoom={1} minZoom={1} maxZoom={8}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const name = geo.properties?.name || "Unknown";
            const isHovered = hoveredGeo === geo.rsmKey;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onMouseEnter={() => setHoveredGeo(geo.rsmKey)}
                onMouseLeave={() => setHoveredGeo(null)}
                onClick={() => onSelect(name)}
                style={{
                  default: {
                    fill: getColor(geo, false),
                    stroke: "hsl(210 20% 18%)",
                    strokeWidth: 0.5,
                    outline: "none",
                    transition: "fill 0.2s",
                  },
                  hover: {
                    fill: getColor(geo, true),
                    stroke: "hsl(0 0% 60%)",
                    strokeWidth: 1,
                    outline: "none",
                    cursor: "pointer",
                  },
                  pressed: {
                    fill: getColor(geo, true),
                    stroke: "hsl(0 0% 80%)",
                    strokeWidth: 1.2,
                    outline: "none",
                  },
                }}
              />
            );
          })
        }
      </Geographies>
    </ZoomableGroup>
  </ComposableMap>
));
MapChart.displayName = "MapChart";

export default function WorldMapTool({ onBack }: { onBack: () => void }) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ category: TopicCategory; topic: string } | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleCountrySelect = (name: string) => {
    setSelectedCountry(name);
    setSelectedTopic(null);
    setAiContent("");
  };

  const handleTopicSelect = useCallback(async (category: TopicCategory, topic: string) => {
    if (!selectedCountry) return;
    setSelectedTopic({ category, topic });
    setAiLoading(true);
    setAiContent("");

    const prompt = `Give a concise, UPSC-exam-focused summary about "${topic}" related to ${selectedCountry}. 
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
  }, [selectedCountry]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <button
          onClick={selectedTopic ? () => { setSelectedTopic(null); setAiContent(""); } : selectedCountry ? () => setSelectedCountry(null) : onBack}
          className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {selectedCountry || "World Map"}
            </h2>
            <p className="text-[10px] text-muted-foreground">UPSC & Competitive Exam Prep</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-500">LIVE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedCountry ? (
          /* ====== MAP VIEW ====== */
          <div className="p-3 space-y-3">
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              <div className="bg-muted/30 p-2">
                <MapChart onSelect={handleCountrySelect} hoveredGeo={hoveredGeo} setHoveredGeo={setHoveredGeo} />
              </div>
              <p className="text-center text-xs text-muted-foreground py-2.5">
                🗺️ Click any country • Scroll to zoom • Drag to pan
              </p>
            </div>

            {/* Quick topic categories */}
            <div className="flex flex-wrap gap-2 px-1">
              {TOPIC_CATEGORIES.map((cat) => (
                <span key={cat.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/50 text-xs font-medium text-foreground">
                  {cat.emoji} {cat.label}
                </span>
              ))}
            </div>
          </div>
        ) : !selectedTopic ? (
          /* ====== COUNTRY TOPICS ====== */
          <div className="p-4 space-y-4">
            <div className="rounded-xl p-4 border border-border/50 bg-card">
              <h3 className="text-lg font-extrabold text-foreground">{selectedCountry}</h3>
              <p className="text-xs text-muted-foreground mt-1">Select a topic category to generate study material</p>
            </div>

            {TOPIC_CATEGORIES.map((category) => (
              <div key={category.id} className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                  {category.emoji} {category.label}
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {category.topics.map((topic) => (
                    <button key={topic} onClick={() => handleTopicSelect(category, topic)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 hover:bg-accent/30 transition-all text-left group">
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
          /* ====== AI CONTENT ====== */
          <div className="p-4 space-y-3">
            <div className="rounded-xl p-4 border border-border/50 bg-card">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedTopic.category.emoji}</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedTopic.topic}</h3>
                  <p className="text-[10px] text-muted-foreground">{selectedTopic.category.label} • {selectedCountry}</p>
                </div>
                {aiLoading && <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-card/50 p-4 min-h-[200px]">
              {aiContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-h2:text-base prose-h3:text-sm">
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
