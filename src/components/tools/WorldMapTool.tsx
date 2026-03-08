import { useState, useCallback, useEffect, memo, useMemo } from "react";
import {
  ArrowLeft, Globe, MapPin, Sparkles, ChevronRight, Loader2,
  Search, Trophy, Bookmark, BookmarkCheck, StickyNote, X,
  GitCompare, Brain, CheckCircle2, XCircle, Zap, Star
} from "lucide-react";
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

// ─── Types ───
type TopicCategory = { id: string; label: string; emoji: string; topics: string[] };
type TabId = "explore" | "quiz" | "compare" | "bookmarks";
type QuizQuestion = { question: string; options: string[]; answer: number; country: string };
type BookmarkEntry = { country: string; note: string; savedAt: string };

// ─── Constants ───
const TOPIC_CATEGORIES: TopicCategory[] = [
  { id: "geography", label: "Geography", emoji: "🌍", topics: ["Physical Features", "Climate Zones", "Rivers & Water Bodies", "Natural Resources", "Biodiversity Hotspots"] },
  { id: "history", label: "History", emoji: "📜", topics: ["Ancient Civilizations", "Colonial History", "Independence Movements", "Major Wars", "Cultural Heritage"] },
  { id: "polity", label: "Polity & IR", emoji: "🏛️", topics: ["Government System", "International Organizations", "Trade Agreements", "Border Disputes", "Diplomatic Relations"] },
  { id: "economy", label: "Economy", emoji: "💰", topics: ["GDP & Growth", "Major Industries", "Trade Routes", "Economic Policies", "Development Indicators"] },
  { id: "current", label: "Current Affairs", emoji: "📰", topics: ["Recent Events", "Geopolitical Shifts", "Climate Change Impact", "Technology & Innovation", "Social Movements"] },
];

const TABS: { id: TabId; label: string; icon: typeof Globe; emoji: string }[] = [
  { id: "explore", label: "Explore", icon: Globe, emoji: "🗺️" },
  { id: "quiz", label: "Quiz", icon: Brain, emoji: "🧠" },
  { id: "compare", label: "Compare", icon: GitCompare, emoji: "⚔️" },
  { id: "bookmarks", label: "Saved", icon: Bookmark, emoji: "📌" },
];

const COUNTRY_LIST = [
  "India", "China", "Japan", "United States of America", "Canada", "Mexico", "Brazil", "Argentina",
  "United Kingdom", "France", "Germany", "Italy", "Spain", "Russia", "Australia", "South Africa",
  "Nigeria", "Egypt", "Kenya", "Indonesia", "Pakistan", "Bangladesh", "Thailand", "Vietnam",
  "South Korea", "Turkey", "Saudi Arabia", "Iran", "Iraq", "Israel", "Colombia", "Peru", "Chile",
  "Sweden", "Norway", "Poland", "Ukraine", "New Zealand", "Ethiopia", "Morocco", "Algeria", "Ghana",
];

// ─── Color helper ───
function getColor(geo: any, hovered: boolean, highlighted?: string | null): string {
  const name = (geo.properties?.name || "").toLowerCase();
  if (highlighted && name === highlighted.toLowerCase()) return hovered ? "hsl(50 95% 60%)" : "hsl(50 90% 50%)";
  const numId = parseInt(geo.id || "0");
  if ((numId >= 10 && numId <= 180) || ["egypt","nigeria","south africa","kenya","ethiopia","morocco","algeria","ghana","tanzania"].some(c => name.includes(c)))
    return hovered ? "hsl(30 85% 55%)" : "hsl(30 65% 40%)";
  if ((numId >= 200 && numId <= 400) || ["france","germany","united kingdom","italy","spain","poland","ukraine","sweden","norway"].some(c => name.includes(c)))
    return hovered ? "hsl(260 70% 60%)" : "hsl(260 50% 40%)";
  if ((numId >= 356 && numId <= 900) || ["india","china","japan","indonesia","pakistan","bangladesh","vietnam","thailand","iran","iraq","saudi"].some(c => name.includes(c)))
    return hovered ? "hsl(350 75% 60%)" : "hsl(350 55% 40%)";
  if (["united states","canada","mexico","cuba","guatemala","honduras"].some(c => name.includes(c)))
    return hovered ? "hsl(200 80% 55%)" : "hsl(200 60% 38%)";
  if (["brazil","argentina","colombia","peru","chile","venezuela","ecuador","bolivia"].some(c => name.includes(c)))
    return hovered ? "hsl(140 70% 50%)" : "hsl(140 50% 35%)";
  if (["australia","new zealand","papua","fiji"].some(c => name.includes(c)))
    return hovered ? "hsl(180 70% 50%)" : "hsl(180 50% 35%)";
  return hovered ? "hsl(210 40% 50%)" : "hsl(210 30% 32%)";
}

// ─── Map Component ───
const MapChart = memo(({ onSelect, hoveredGeo, setHoveredGeo, highlighted, tooltipRef, zoom, onZoomChange }: {
  onSelect: (name: string) => void;
  hoveredGeo: string | null;
  setHoveredGeo: (g: string | null) => void;
  highlighted?: string | null;
  tooltipRef?: React.MutableRefObject<string>;
  zoom: number;
  onZoomChange: (z: number) => void;
}) => (
  <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }} width={800} height={400} style={{ width: "100%", height: "auto" }}>
    <ZoomableGroup center={[0, 20]} zoom={zoom} minZoom={1} maxZoom={12} onMoveEnd={({ zoom: z }) => onZoomChange(z)}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const name = geo.properties?.name || "Unknown";
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onMouseEnter={() => { setHoveredGeo(geo.rsmKey); if (tooltipRef) tooltipRef.current = name; }}
                onMouseLeave={() => { setHoveredGeo(null); if (tooltipRef) tooltipRef.current = ""; }}
                onClick={() => onSelect(name)}
                style={{
                  default: { fill: getColor(geo, false, highlighted), stroke: "hsl(210 20% 18%)", strokeWidth: 0.5, outline: "none", transition: "fill 0.2s" },
                  hover: { fill: getColor(geo, true, highlighted), stroke: "hsl(0 0% 60%)", strokeWidth: 1, outline: "none", cursor: "pointer" },
                  pressed: { fill: getColor(geo, true, highlighted), stroke: "hsl(0 0% 80%)", strokeWidth: 1.2, outline: "none" },
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

// ─── AI Stream helper ───
async function streamAI(prompt: string, systemPrompt: string, onChunk: (text: string) => void) {
  const res = await supabase.functions.invoke("chat", {
    body: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash", systemPrompt },
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
        onChunk(text);
      }
    } else if (typeof res.data === "string") {
      onChunk(res.data);
    }
  }
}

// ─── Main Component ───
export default function WorldMapTool({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("explore");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<{ category: TopicCategory; topic: string } | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // Compare state
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareContent, setCompareContent] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("worldmap_bookmarks") || "[]"); } catch { return []; }
  });
  const [noteInput, setNoteInput] = useState("");
  const [bookmarkCountry, setBookmarkCountry] = useState("");

  useEffect(() => { localStorage.setItem("worldmap_bookmarks", JSON.stringify(bookmarks)); }, [bookmarks]);

  const filteredCountries = useMemo(() =>
    search.trim() ? COUNTRY_LIST.filter(c => c.toLowerCase().includes(search.toLowerCase())) : [],
  [search]);

  // ─── Explore ───
  const handleCountrySelect = (name: string) => {
    setSelectedCountry(name);
    setSelectedTopic(null);
    setAiContent("");
    setSearch("");
    setActiveTab("explore");
  };

  const handleTopicSelect = useCallback(async (category: TopicCategory, topic: string) => {
    if (!selectedCountry) return;
    setSelectedTopic({ category, topic });
    setAiLoading(true);
    setAiContent("");
    try {
      await streamAI(
        `Give a concise, UPSC-exam-focused summary about "${topic}" related to ${selectedCountry}. Include: key facts, data points, exam-relevant details, and 3 potential UPSC questions. Format with headings, bullets, bold key terms. Under 600 words.`,
        "You are an expert UPSC preparation tutor. Provide accurate, exam-oriented content with facts and practice questions. Use markdown.",
        (t) => setAiContent(t)
      );
    } catch { setAiContent("Failed to load. Try again."); }
    finally { setAiLoading(false); }
  }, [selectedCountry]);

  // ─── Quiz ───
  const startQuiz = useCallback(async () => {
    setQuizLoading(true);
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFinished(false);
    try {
      await streamAI(
        `Generate exactly 5 UPSC-style geography/polity MCQ questions about different countries. 
Return ONLY a JSON array, no markdown, no code fences. Each object: {"question":"...","options":["A","B","C","D"],"answer":0,"country":"CountryName"}
answer is the 0-based index of the correct option. Make questions challenging but fair.`,
        "You are a UPSC exam question generator. Return only valid JSON array.",
        (text) => {
          try {
            const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed) && parsed.length >= 1) setQuizQuestions(parsed);
          } catch { /* still streaming */ }
        }
      );
    } catch { /* error */ }
    finally { setQuizLoading(false); }
  }, []);

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(idx);
    const correct = quizQuestions[quizIdx]?.answer === idx;
    if (correct) { setQuizScore(s => s + 1); setQuizStreak(s => s + 1); }
    else { setQuizStreak(0); }
  };

  const nextQuestion = () => {
    if (quizIdx + 1 >= quizQuestions.length) { setQuizFinished(true); return; }
    setQuizIdx(i => i + 1);
    setQuizAnswer(null);
  };

  // ─── Compare ───
  const runCompare = useCallback(async () => {
    if (!compareA || !compareB) return;
    setCompareLoading(true);
    setCompareContent("");
    try {
      await streamAI(
        `Compare ${compareA} vs ${compareB} for UPSC preparation. Include a comparison table with: Area, Population, GDP, Government, Capital, Key Resources, Strategic Importance, Recent Events. Then add 3 UPSC-style questions comparing both. Use markdown tables and formatting.`,
        "You are a UPSC comparison expert. Create detailed, exam-relevant comparisons with tables and practice questions.",
        (t) => setCompareContent(t)
      );
    } catch { setCompareContent("Failed to generate comparison."); }
    finally { setCompareLoading(false); }
  }, [compareA, compareB]);

  // ─── Bookmarks ───
  const addBookmark = () => {
    if (!bookmarkCountry.trim()) return;
    setBookmarks(prev => [...prev, { country: bookmarkCountry.trim(), note: noteInput.trim(), savedAt: new Date().toISOString() }]);
    setBookmarkCountry("");
    setNoteInput("");
  };

  const isBookmarked = (name: string) => bookmarks.some(b => b.country.toLowerCase() === name.toLowerCase());

  const toggleBookmark = (country: string) => {
    if (isBookmarked(country)) {
      setBookmarks(prev => prev.filter(b => b.country.toLowerCase() !== country.toLowerCase()));
    } else {
      setBookmarks(prev => [...prev, { country, note: "", savedAt: new Date().toISOString() }]);
    }
  };

  const goBack = () => {
    if (selectedTopic) { setSelectedTopic(null); setAiContent(""); }
    else if (selectedCountry) { setSelectedCountry(null); }
    else { onBack(); }
  };

  const currentQ = quizQuestions[quizIdx];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10"><Globe className="w-4 h-4 text-primary" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{selectedCountry || "World Map"}</h2>
            <p className="text-[10px] text-muted-foreground">UPSC & Competitive Exam Prep</p>
          </div>
        </div>
        {selectedCountry && (
          <button onClick={() => toggleBookmark(selectedCountry)}
            className={cn("p-1.5 rounded-lg transition-colors", isBookmarked(selectedCountry) ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}>
            {isBookmarked(selectedCountry) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-500">LIVE</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/40 bg-card/30 shrink-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedCountry(null); setSelectedTopic(null); setAiContent(""); }}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ═══════ EXPLORE TAB ═══════ */}
        {activeTab === "explore" && !selectedCountry && (
          <div className="p-3 space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search any country…"
                className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search results */}
            {filteredCountries.length > 0 && (
              <div className="bg-card border border-border/50 rounded-xl overflow-hidden divide-y divide-border/30">
                {filteredCountries.slice(0, 8).map(c => (
                  <button key={c} onClick={() => handleCountrySelect(c)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent/30 transition-colors text-left">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-medium">{c}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 ml-auto" />
                  </button>
                ))}
              </div>
            )}

            {/* Map */}
            {!search && (
              <>
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                  <div className="bg-muted/30 p-2">
                    <MapChart onSelect={handleCountrySelect} hoveredGeo={hoveredGeo} setHoveredGeo={setHoveredGeo} />
                  </div>
                  <p className="text-center text-xs text-muted-foreground py-2">🗺️ Click country • Scroll zoom • Drag pan</p>
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {TOPIC_CATEGORIES.map(cat => (
                    <span key={cat.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-card border border-border/50 text-[11px] font-medium text-foreground">
                      {cat.emoji} {cat.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Country detail */}
        {activeTab === "explore" && selectedCountry && !selectedTopic && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl p-4 border border-border/50 bg-card flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">{selectedCountry}</h3>
                <p className="text-xs text-muted-foreground mt-1">Select a topic to study</p>
              </div>
              <button onClick={() => toggleBookmark(selectedCountry)}
                className={cn("p-2 rounded-lg transition-colors", isBookmarked(selectedCountry) ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {isBookmarked(selectedCountry) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            </div>
            {TOPIC_CATEGORIES.map(category => (
              <div key={category.id} className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">{category.emoji} {category.label}</h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {category.topics.map(topic => (
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
        )}

        {/* AI Content */}
        {activeTab === "explore" && selectedTopic && (
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
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  <p className="text-xs text-muted-foreground">Generating study material…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ QUIZ TAB ═══════ */}
        {activeTab === "quiz" && (
          <div className="p-4 space-y-4">
            {quizQuestions.length === 0 && !quizLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="p-4 rounded-2xl bg-primary/10"><Brain className="w-10 h-10 text-primary" /></div>
                <h3 className="text-lg font-bold text-foreground">Map Quiz Mode</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Test your UPSC geography & polity knowledge with AI-generated MCQs
                </p>
                <button onClick={startQuiz}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Start Quiz
                </button>
              </div>
            ) : quizLoading && quizQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Generating questions…</p>
              </div>
            ) : quizFinished ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="p-4 rounded-2xl bg-amber-500/10"><Trophy className="w-10 h-10 text-amber-500" /></div>
                <h3 className="text-xl font-bold text-foreground">Quiz Complete!</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-primary">{quizScore}/{quizQuestions.length}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-amber-500">{Math.round((quizScore / quizQuestions.length) * 100)}%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {quizScore === quizQuestions.length && <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold">🏆 Perfect!</span>}
                  {quizScore >= quizQuestions.length * 0.8 && quizScore < quizQuestions.length && <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-semibold">⭐ Great!</span>}
                </div>
                <button onClick={startQuiz}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors mt-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Play Again
                </button>
              </div>
            ) : currentQ ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">{quizIdx + 1}/{quizQuestions.length}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-foreground">{quizScore}</span>
                  </div>
                  {quizStreak > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold">🔥 {quizStreak}</span>
                  )}
                </div>

                {/* Question */}
                <div className="rounded-xl p-4 border border-border/50 bg-card">
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{currentQ.country}</span>
                  <p className="text-sm font-semibold text-foreground mt-2 leading-relaxed">{currentQ.question}</p>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = quizAnswer === i;
                    const isCorrect = currentQ.answer === i;
                    const answered = quizAnswer !== null;
                    return (
                      <button key={i} onClick={() => handleQuizAnswer(i)} disabled={answered}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all",
                          answered && isCorrect ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600" :
                          answered && isSelected && !isCorrect ? "bg-destructive/10 border-destructive/40 text-destructive" :
                          answered ? "bg-card border-border/30 text-muted-foreground opacity-60" :
                          "bg-card border-border/50 text-foreground hover:border-primary/30 hover:bg-accent/30"
                        )}>
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border",
                          answered && isCorrect ? "bg-emerald-500 text-emerald-50 border-emerald-500" :
                          answered && isSelected ? "bg-destructive text-destructive-foreground border-destructive" :
                          "bg-muted border-border text-muted-foreground"
                        )}>
                          {answered && isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           answered && isSelected ? <XCircle className="w-3.5 h-3.5" /> :
                           String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {quizAnswer !== null && (
                  <button onClick={nextQuestion}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
                    {quizIdx + 1 >= quizQuestions.length ? "See Results" : "Next Question →"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ═══════ COMPARE TAB ═══════ */}
        {activeTab === "compare" && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl p-4 border border-border/50 bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" /> Compare Countries
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase">Country A</label>
                  <select value={compareA} onChange={e => setCompareA(e.target.value)}
                    className="w-full mt-1 bg-muted border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40">
                    <option value="">Select…</option>
                    {COUNTRY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase">Country B</label>
                  <select value={compareB} onChange={e => setCompareB(e.target.value)}
                    className="w-full mt-1 bg-muted border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40">
                    <option value="">Select…</option>
                    {COUNTRY_LIST.filter(c => c !== compareA).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={runCompare} disabled={!compareA || !compareB || compareLoading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {compareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                {compareLoading ? "Comparing…" : "Compare"}
              </button>
            </div>

            {compareContent && (
              <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-table:text-xs">
                  <ReactMarkdown>{compareContent}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ BOOKMARKS TAB ═══════ */}
        {activeTab === "bookmarks" && (
          <div className="p-4 space-y-4">
            {/* Add bookmark */}
            <div className="rounded-xl p-4 border border-border/50 bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-primary" /> Add Bookmark
              </h3>
              <select value={bookmarkCountry} onChange={e => setBookmarkCountry(e.target.value)}
                className="w-full bg-muted border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40">
                <option value="">Select country…</option>
                {COUNTRY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                placeholder="Add a study note (optional)…"
                className="w-full bg-muted border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none h-16 focus:border-primary/40" />
              <button onClick={addBookmark} disabled={!bookmarkCountry}
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                Save Bookmark
              </button>
            </div>

            {/* Bookmark list */}
            {bookmarks.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No bookmarks yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Save countries while exploring to revisit later</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Saved ({bookmarks.length})
                </h4>
                {bookmarks.map((bm, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/40 group">
                    <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => handleCountrySelect(bm.country)}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-left">
                        {bm.country}
                      </button>
                      {bm.note && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bm.note}</p>}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {new Date(bm.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => setBookmarks(prev => prev.filter((_, j) => j !== i))}
                      className="p-1 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
