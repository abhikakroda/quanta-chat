import { useState, useCallback } from "react";
import { ArrowLeft, Globe, Loader2, Brain, Trophy, RotateCcw, Landmark, Atom, Leaf, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type TabId = "history" | "polity" | "geography" | "science" | "current" | "static" | "quiz";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "static", label: "Static GK", emoji: "📋" },
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "polity", label: "Polity", emoji: "⚖️" },
  { id: "geography", label: "Geography", emoji: "🌍" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "current", label: "Current GK", emoji: "📰" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
];

const HISTORY_TOPICS = [
  "Ancient India", "Medieval India", "Modern India (1857-1947)",
  "Indian National Movement", "World History", "Art & Culture",
  "Indian Constitution History", "Important Dates & Events",
];

const POLITY_TOPICS = [
  "Indian Constitution", "Fundamental Rights & Duties",
  "Parliament & State Legislature", "President & Governor",
  "Supreme Court & High Courts", "Panchayati Raj",
  "Constitutional Amendments", "Important Articles",
  "Election Commission", "CAG & UPSC",
];

const GEOGRAPHY_TOPICS = [
  "Physical Geography of India", "Indian Rivers & Drainage",
  "Climate of India", "Soils & Natural Vegetation",
  "Indian Agriculture", "Minerals & Industries",
  "World Geography", "Maps & Important Places",
];

const SCIENCE_TOPICS = [
  "Physics (Mechanics, Light, Sound)", "Chemistry (Elements, Reactions)",
  "Biology (Human Body)", "Biology (Plants & Ecology)",
  "Computer & Technology", "Space & Astronomy",
  "Inventions & Discoveries", "Diseases & Nutrition",
];

const CURRENT_TOPICS = [
  "Awards & Honours 2024-25", "Government Schemes",
  "International Organizations", "Sports Events",
  "Books & Authors", "Summits & Conferences",
  "Important Appointments", "Defence & Security",
];

const QUIZ_TYPES = [
  "History & Culture", "Indian Polity", "Geography",
  "General Science", "Current Affairs", "Mixed GK (SSC/UPSC)",
  "Static GK", "Previous Year Questions",
];

const STATIC_GK: Record<string, string> = {
  "Ancient India": "**Key Facts:**\n- Indus Valley (3300-1300 BCE): Harappa, Mohenjo-daro\n- Vedic Period: Rigveda (oldest), 4 Vedas\n- Maurya Dynasty: Chandragupta → Ashoka (Dhamma)\n- Gupta Period: Golden Age of India\n- Important: Arthashastra (Kautilya), Nalanda University",
  "Indian Constitution": "**Key Articles:**\n| Article | Subject |\n|---------|--------|\n| 14 | Equality before law |\n| 19 | 6 Freedoms |\n| 21 | Right to Life |\n| 32 | Constitutional remedies |\n| 44 | Uniform Civil Code |\n| 370 | J&K (abrogated) |\n\n- Parts: 25, Schedules: 12, Articles: 448+\n- Borrowed from: UK, US, Ireland, Canada, Australia",
  "Fundamental Rights & Duties": "**6 Fundamental Rights (Part III):**\n1. Right to Equality (Art 14-18)\n2. Right to Freedom (Art 19-22)\n3. Right against Exploitation (Art 23-24)\n4. Right to Freedom of Religion (Art 25-28)\n5. Cultural & Educational Rights (Art 29-30)\n6. Right to Constitutional Remedies (Art 32)\n\n**11 Fundamental Duties (Art 51A)**\n- Added by 42nd Amendment (1976)",
  "Physical Geography of India": "**Quick Facts:**\n- Area: 3.28 million km², 7th largest\n- Latitudes: 8°4'N to 37°6'N\n- Longitudes: 68°7'E to 97°25'E\n- Highest: K2 (8611m), Kangchenjunga (8586m)\n- Physiographic divisions: 6 (Himalaya, Plains, Peninsula, Coast, Islands, Desert)",
  "Indian Rivers & Drainage": "**Major Rivers:**\n| River | Origin | Length |\n|-------|--------|--------|\n| Ganga | Gangotri | 2525 km |\n| Brahmaputra | Mansarovar | 2900 km |\n| Godavari | Nasik | 1465 km |\n| Krishna | Mahabaleshwar | 1400 km |\n| Narmada | Amarkantak | 1312 km |\n\n- West flowing: Narmada, Tapi (rift valleys)",
  "Physics (Mechanics, Light, Sound)": "**Key Laws:**\n- Newton's Laws: F=ma, Action=Reaction\n- Speed of light: 3×10⁸ m/s\n- Speed of sound (air): 343 m/s\n- Snell's law: n₁sinθ₁ = n₂sinθ₂\n- Mirror formula: 1/f = 1/v + 1/u\n- Doppler effect: Pitch changes with relative motion",
  "Biology (Human Body)": "**Systems:**\n- Blood groups: A, B, AB (universal recipient), O (universal donor)\n- Bones: 206 (adult), Muscles: 639\n- Largest organ: Skin\n- Largest gland: Liver\n- Smallest bone: Stapes (ear)\n- Chromosomes: 46 (23 pairs)\n- DNA discoverers: Watson & Crick (1953)",
};

// ═══ STATIC GK REFERENCE TABLES ═══
const STATIC_TABLES: Record<string, string> = {
  "Indian States & Capitals":
`| State | Capital | Formation |
|-------|---------|-----------|
| Andhra Pradesh | Amaravati | 1956 |
| Arunachal Pradesh | Itanagar | 1987 |
| Assam | Dispur | 1950 |
| Bihar | Patna | 1950 |
| Chhattisgarh | Raipur | 2000 |
| Goa | Panaji | 1987 |
| Gujarat | Gandhinagar | 1960 |
| Haryana | Chandigarh | 1966 |
| Himachal Pradesh | Shimla | 1971 |
| Jharkhand | Ranchi | 2000 |
| Karnataka | Bengaluru | 1956 |
| Kerala | Thiruvananthapuram | 1956 |
| Madhya Pradesh | Bhopal | 1956 |
| Maharashtra | Mumbai | 1960 |
| Manipur | Imphal | 1972 |
| Meghalaya | Shillong | 1972 |
| Mizoram | Aizawl | 1987 |
| Nagaland | Kohima | 1963 |
| Odisha | Bhubaneswar | 1950 |
| Punjab | Chandigarh | 1966 |
| Rajasthan | Jaipur | 1956 |
| Sikkim | Gangtok | 1975 |
| Tamil Nadu | Chennai | 1956 |
| Telangana | Hyderabad | 2014 |
| Tripura | Agartala | 1972 |
| Uttar Pradesh | Lucknow | 1950 |
| Uttarakhand | Dehradun | 2000 |
| West Bengal | Kolkata | 1950 |`,

  "Union Territories & LG/Admin":
`| Union Territory | Capital | Administrator |
|----------------|---------|---------------|
| Andaman & Nicobar | Port Blair | Lt. Governor |
| Chandigarh | Chandigarh | Administrator |
| Dadra & Nagar Haveli and Daman & Diu | Daman | Administrator |
| Delhi (NCT) | New Delhi | Lt. Governor |
| Jammu & Kashmir | Srinagar/Jammu | Lt. Governor |
| Ladakh | Leh | Lt. Governor |
| Lakshadweep | Kavaratti | Administrator |
| Puducherry | Puducherry | Lt. Governor |`,

  "National Symbols of India":
`| Symbol | Name |
|--------|------|
| National Flag | Tiranga (Tricolour) |
| National Emblem | Lion Capital of Ashoka |
| National Anthem | Jana Gana Mana (Rabindranath Tagore) |
| National Song | Vande Mataram (Bankim Chandra Chattopadhyay) |
| National Animal | Royal Bengal Tiger |
| National Bird | Indian Peacock |
| National Flower | Lotus |
| National Tree | Indian Banyan |
| National Fruit | Mango |
| National River | Ganga |
| National Aquatic Animal | Gangetic Dolphin |
| National Heritage Animal | Indian Elephant |
| National Reptile | King Cobra |
| National Currency | Indian Rupee (₹) |
| National Calendar | Saka Calendar |
| National Game | Hockey (unofficial) |
| National Motto | Satyameva Jayate |`,

  "Countries, Capitals & Currencies":
`| Country | Capital | Currency |
|---------|---------|----------|
| Afghanistan | Kabul | Afghani |
| Australia | Canberra | Australian Dollar |
| Bangladesh | Dhaka | Taka |
| Bhutan | Thimphu | Ngultrum |
| Brazil | Brasília | Real |
| Canada | Ottawa | Canadian Dollar |
| China | Beijing | Yuan/Renminbi |
| Egypt | Cairo | Egyptian Pound |
| France | Paris | Euro |
| Germany | Berlin | Euro |
| Indonesia | Jakarta | Rupiah |
| Iran | Tehran | Rial |
| Iraq | Baghdad | Dinar |
| Israel | Jerusalem | Shekel |
| Italy | Rome | Euro |
| Japan | Tokyo | Yen |
| Malaysia | Kuala Lumpur | Ringgit |
| Maldives | Malé | Rufiyaa |
| Myanmar | Naypyidaw | Kyat |
| Nepal | Kathmandu | Nepali Rupee |
| North Korea | Pyongyang | Won |
| Pakistan | Islamabad | Pakistani Rupee |
| Russia | Moscow | Ruble |
| Saudi Arabia | Riyadh | Riyal |
| South Africa | Pretoria | Rand |
| South Korea | Seoul | Won |
| Sri Lanka | Sri Jayawardenepura Kotte | Rupee |
| Thailand | Bangkok | Baht |
| Turkey | Ankara | Lira |
| UAE | Abu Dhabi | Dirham |
| UK | London | Pound Sterling |
| USA | Washington D.C. | US Dollar |
| Vietnam | Hanoi | Dong |`,

  "Important Dams & Rivers":
`| Dam | River | State |
|-----|-------|-------|
| Tehri Dam | Bhagirathi | Uttarakhand |
| Bhakra Nangal | Sutlej | Himachal/Punjab |
| Sardar Sarovar | Narmada | Gujarat |
| Hirakud | Mahanadi | Odisha |
| Nagarjuna Sagar | Krishna | Telangana/AP |
| Mettur Dam | Cauvery | Tamil Nadu |
| Tungabhadra | Tungabhadra | Karnataka |
| Koyna Dam | Koyna | Maharashtra |
| Idukki Dam | Periyar | Kerala |
| Farakka Barrage | Ganga | West Bengal |`,

  "First in India & World":
`**First in India:**
| Achievement | Person/Detail |
|------------|---------------|
| President | Dr. Rajendra Prasad |
| Prime Minister | Jawaharlal Nehru |
| Woman President | Pratibha Patil |
| Woman PM | Indira Gandhi |
| Chief Justice | H.J. Kania |
| Woman CJI | None yet |
| Governor General | Lord William Bentinck |
| Viceroy | Lord Canning |
| ICS Officer | Satyendranath Tagore |
| IPS Officer (Woman) | Kiran Bedi |
| Nobel Laureate | Rabindranath Tagore (1913) |
| Olympic Gold (Individual) | Abhinav Bindra (2008) |
| Satellite | Aryabhata (1975) |
| Supercomputer | PARAM 8000 (1991) |

**First in World:**
| Achievement | Person |
|------------|--------|
| Man on Moon | Neil Armstrong (1969) |
| Woman in Space | Valentina Tereshkova (1963) |
| Everest Summit | Tenzing & Hillary (1953) |
| President of USA | George Washington |
| Printed Book | Gutenberg Bible (~1455) |`,

  "Important Constitutional Amendments":
`| Amendment | Year | Key Change |
|-----------|------|------------|
| 1st | 1951 | Restrictions on Fundamental Rights |
| 7th | 1956 | Reorganization of states |
| 24th | 1971 | Parliament can amend FRs |
| 42nd | 1976 | "Mini Constitution" — Secular, Socialist, Integrity added |
| 44th | 1978 | Right to Property removed as FR |
| 52nd | 1985 | Anti-Defection Law |
| 61st | 1989 | Voting age 21→18 |
| 73rd | 1992 | Panchayati Raj |
| 74th | 1992 | Municipalities |
| 86th | 2002 | Right to Education (Art 21A) |
| 101st | 2016 | GST |
| 103rd | 2019 | 10% EWS Reservation |`,

  "Important Articles of Constitution":
`| Article | Subject |
|---------|---------|
| 1 | India = Union of States |
| 12-35 | Fundamental Rights |
| 14 | Equality before law |
| 17 | Abolition of Untouchability |
| 19 | 6 Freedoms |
| 21 | Right to Life & Liberty |
| 21A | Right to Education (6-14 yrs) |
| 32 | Constitutional Remedies (Ambedkar: "Heart & Soul") |
| 36-51 | Directive Principles (DPSP) |
| 51A | Fundamental Duties |
| 72 | President's Pardoning Power |
| 112 | Union Budget |
| 123 | Ordinance Power (President) |
| 143 | Advisory Jurisdiction of SC |
| 148 | CAG |
| 280 | Finance Commission |
| 312 | All India Services |
| 352 | National Emergency |
| 356 | President's Rule |
| 360 | Financial Emergency |
| 368 | Amendment Procedure |`,

  "Inventions & Discoveries":
`| Invention/Discovery | Inventor | Year |
|---------------------|----------|------|
| Telephone | Alexander Graham Bell | 1876 |
| Electric Bulb | Thomas Edison | 1879 |
| Radio | Guglielmo Marconi | 1895 |
| Airplane | Wright Brothers | 1903 |
| Penicillin | Alexander Fleming | 1928 |
| Computer | Charles Babbage | 1837 |
| World Wide Web | Tim Berners-Lee | 1989 |
| X-Ray | Wilhelm Röntgen | 1895 |
| Dynamite | Alfred Nobel | 1867 |
| Theory of Relativity | Albert Einstein | 1905 |
| Gravity | Isaac Newton | 1687 |
| Periodic Table | Dmitri Mendeleev | 1869 |
| Vaccine (Smallpox) | Edward Jenner | 1796 |
| DNA Structure | Watson & Crick | 1953 |
| Telescope | Galileo Galilei | 1609 |
| Printing Press | Johannes Gutenberg | 1440 |`,

  "Important International Organizations":
`| Organization | HQ | Founded | Head |
|-------------|-----|---------|------|
| United Nations (UN) | New York | 1945 | Secretary General |
| WHO | Geneva | 1948 | Director General |
| UNESCO | Paris | 1945 | Director General |
| UNICEF | New York | 1946 | Executive Director |
| World Bank | Washington D.C. | 1944 | President |
| IMF | Washington D.C. | 1944 | Managing Director |
| WTO | Geneva | 1995 | Director General |
| NATO | Brussels | 1949 | Secretary General |
| ASEAN | Jakarta | 1967 | Secretary General |
| SAARC | Kathmandu | 1985 | Secretary General |
| BRICS | Rotating | 2006 | Chair (Rotating) |
| G20 | Rotating | 1999 | Presidency (Rotating) |
| Interpol | Lyon | 1923 | Secretary General |
| Red Cross | Geneva | 1863 | President |`,

  "Indian National Parks & Sanctuaries":
`| National Park | State | Famous For |
|--------------|-------|------------|
| Jim Corbett | Uttarakhand | Tiger (1st NP, 1936) |
| Kaziranga | Assam | One-horned Rhino |
| Ranthambore | Rajasthan | Tigers |
| Gir Forest | Gujarat | Asiatic Lions |
| Sundarbans | West Bengal | Royal Bengal Tiger |
| Kanha | Madhya Pradesh | Tiger, Barasingha |
| Periyar | Kerala | Elephants |
| Bandhavgarh | Madhya Pradesh | White Tigers |
| Hemis | Ladakh | Snow Leopard |
| Valley of Flowers | Uttarakhand | Alpine Flowers (UNESCO) |
| Keibul Lamjao | Manipur | Sangai Deer (floating NP) |
| Bandipur | Karnataka | Elephants, Tigers |

**Tiger Reserves:** Project Tiger started 1973, 55+ reserves
**Biosphere Reserves:** 18 in India, 12 in UNESCO network`,

  "Important Lakes of India":
`| Lake | State | Type |
|------|-------|------|
| Wular | J&K | Largest freshwater |
| Chilika | Odisha | Largest coastal lagoon |
| Sambhar | Rajasthan | Largest salt water (inland) |
| Vembanad | Kerala | Longest lake |
| Loktak | Manipur | Floating lake |
| Dal | J&K | Tourist attraction |
| Pulicat | AP/TN | 2nd largest lagoon |
| Pangong | Ladakh | High altitude |
| Hussain Sagar | Telangana | Artificial |
| Gobind Sagar | HP | Bhakra Dam reservoir |`,

  "Important Boundary Lines":
`| Boundary Line | Between |
|---------------|---------|
| Radcliffe Line | India & Pakistan |
| McMahon Line | India & China |
| Durand Line | Pakistan & Afghanistan |
| LOC (Line of Control) | India & Pakistan (J&K) |
| LAC (Line of Actual Control) | India & China |
| 17th Parallel | North & South Vietnam |
| 38th Parallel | North & South Korea |
| 49th Parallel | USA & Canada |
| Maginot Line | France & Germany |
| Hindenburg Line | Germany & Poland |
| Order-Neisse Line | Germany & Poland (post-WWII) |`,

  "Indian Space Missions":
`| Mission | Year | Significance |
|---------|------|-------------|
| Aryabhata | 1975 | 1st Indian satellite |
| Rohini | 1980 | 1st by Indian launch vehicle (SLV-3) |
| INSAT-1B | 1983 | Communication satellite |
| IRS-1A | 1988 | Remote sensing |
| Chandrayaan-1 | 2008 | Moon mission (discovered water) |
| Mars Orbiter (MOM) | 2014 | 1st Asian nation to Mars orbit |
| Chandrayaan-2 | 2019 | Orbiter still active |
| Chandrayaan-3 | 2023 | Soft landing on Moon (South Pole) |
| Aditya-L1 | 2023 | Solar observatory at L1 |
| Gaganyaan | Upcoming | 1st crewed Indian spaceflight |

**ISRO:** Founded 1969, HQ: Bengaluru
**Launch vehicles:** PSLV, GSLV Mk-II, GSLV Mk-III (LVM3)`,
};

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

export default function GKTool() {
  const [tab, setTab] = useState<TabId>("static");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const fetchTopic = useCallback(async (topic: string, category: string) => {
    setActiveTopic(topic);
    setLoading(true);
    setContent("");
    const sys = `You are a GK/General Awareness expert for competitive exams (SSC/UPSC/Banking). Explain "${topic}" under "${category}" with key facts, important points, tables, mnemonics, and exam-relevant details. Format with markdown. Add quick revision points at the end.`;
    await streamAI(`Explain "${topic}" for competitive exam GK preparation with key facts and revision notes.`, sys, setContent);
    setLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    const sys = `You are a competitive exam GK quiz generator. Generate exactly 5 ${type} MCQ questions at SSC CGL/UPSC Prelims level. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. answer is 0-indexed.`;
    let raw = "";
    await streamAI(`Generate 5 ${type} GK MCQ questions.`, sys, (t) => { raw = t; });
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setQuizQuestions(JSON.parse(match[0]));
    } catch {}
    setLoading(false);
  }, []);

  const submitQuiz = () => {
    let s = 0;
    quizQuestions.forEach((q, i) => { if (quizAnswers[i] === q.answer) s++; });
    setScore(s);
    setStreak(prev => s === quizQuestions.length ? prev + 1 : 0);
    setQuizSubmitted(true);
  };

  const renderTopicGrid = (topics: string[], category: string) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {topics.map(t => (
        <button key={t} onClick={() => fetchTopic(t, category)}
          className="px-3 py-3 rounded-xl text-[13px] font-medium bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-all text-left">
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-foreground">General Knowledge</h2>
          <p className="text-[11px] text-muted-foreground">History, Polity, Geography, Science & Current Affairs</p>
        </div>
        {streak > 0 && (
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[11px] font-bold">
            <Trophy className="w-3 h-3" /> {streak}🔥
          </div>
        )}
      </div>

      <div className="flex gap-1 px-4 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setContent(""); setActiveTopic(null); setQuizQuestions([]); }}
            className={cn("px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ═══ STATIC GK TAB ═══ */}
        {tab === "static" && !activeTopic && (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground">📋 Static GK — Quick Reference Tables</h3>
            <p className="text-xs text-muted-foreground">Instant-load fact tables for SSC, UPSC & competitive exams</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.keys(STATIC_TABLES).map(title => (
                <button key={title} onClick={() => setActiveTopic(title)}
                  className="p-3 rounded-xl text-[13px] font-medium bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-all text-left">
                  {title}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "static" && activeTopic && (
          <div className="space-y-3">
            <button onClick={() => setActiveTopic(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h3 className="text-base font-bold text-foreground">{activeTopic}</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50 overflow-x-auto">
              <ReactMarkdown>{STATIC_TABLES[activeTopic]}</ReactMarkdown>
            </div>
          </div>
        )}

        {tab === "history" && !activeTopic && !loading && renderTopicGrid(HISTORY_TOPICS, "History")}
        {tab === "polity" && !activeTopic && !loading && renderTopicGrid(POLITY_TOPICS, "Indian Polity")}
        {tab === "geography" && !activeTopic && !loading && renderTopicGrid(GEOGRAPHY_TOPICS, "Geography")}
        {tab === "science" && !activeTopic && !loading && renderTopicGrid(SCIENCE_TOPICS, "General Science")}
        {tab === "current" && !activeTopic && !loading && renderTopicGrid(CURRENT_TOPICS, "Current Affairs")}

        {tab === "quiz" && !quizQuestions.length && !loading && (
          <div className="grid grid-cols-2 gap-2">
            {QUIZ_TYPES.map(t => (
              <button key={t} onClick={() => startQuiz(t)}
                className="px-3 py-4 rounded-xl text-[13px] font-medium bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-all text-center">
                <Brain className="w-5 h-5 mx-auto mb-1 opacity-60" /> {t}
              </button>
            ))}
          </div>
        )}

        {activeTopic && tab !== "quiz" && (
          <div className="space-y-3">
            <button onClick={() => { setActiveTopic(null); setContent(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h3 className="text-base font-bold text-foreground">{activeTopic}</h3>
            {STATIC_GK[activeTopic] && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference</div>
                <ReactMarkdown>{STATIC_GK[activeTopic]}</ReactMarkdown>
              </div>
            )}
            {loading && !content && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading detailed explanation...</span>
              </div>
            )}
            {content && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}



        {quizQuestions.length > 0 && (
          <div className="space-y-4">
            <button onClick={() => { setQuizQuestions([]); setQuizSubmitted(false); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            {quizQuestions.map((q, i) => (
              <div key={i} className={cn("p-4 rounded-xl border", quizSubmitted
                ? quizAnswers[i] === q.answer ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
                : "border-border/50 bg-muted/20")}>
                <p className="text-sm font-medium mb-3">{i + 1}. {q.question}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {q.options.map((opt, j) => (
                    <button key={j} disabled={quizSubmitted}
                      onClick={() => setQuizAnswers(p => ({ ...p, [i]: j }))}
                      className={cn("px-3 py-2 rounded-lg text-[13px] text-left transition-all border",
                        quizSubmitted && j === q.answer ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600" :
                        quizSubmitted && quizAnswers[i] === j ? "bg-destructive/10 border-destructive/40 text-destructive" :
                        quizAnswers[i] === j ? "bg-primary/10 border-primary/40 text-primary" :
                        "border-border/30 hover:bg-muted/50")}>
                      {opt}
                    </button>
                  ))}
                </div>
                {quizSubmitted && <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>}
              </div>
            ))}
            {!quizSubmitted ? (
              <button onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40">
                Submit Answers
              </button>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-lg font-bold">{score}/{quizQuestions.length} Correct! {score === quizQuestions.length ? "🎉" : "📝"}</p>
                <button onClick={() => { setQuizQuestions([]); setQuizSubmitted(false); }}
                  className="flex items-center gap-1 mx-auto text-sm text-primary hover:underline">
                  <RotateCcw className="w-3 h-3" /> Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
