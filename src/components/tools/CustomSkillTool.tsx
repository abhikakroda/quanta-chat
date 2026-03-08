import { useState, useEffect } from "react";
import {
  ArrowLeft, Plus, Trash2, Play, Loader2, ChevronRight,
  CheckCircle2, XCircle, Star, Zap, Trophy, Brain, RotateCcw,
  Pencil, Sparkles, BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

type CustomSkill = {
  id: string;
  name: string;
  description: string;
  topics: string[];
  systemPrompt: string;
  emoji: string;
};

type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

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

const EMOJI_OPTIONS = ["📚", "🔬", "🧪", "💻", "🎨", "🎵", "⚡", "🌍", "🧠", "📐", "🔧", "🏗️", "📊", "🎯", "🚀"];

export default function CustomSkillTool({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const [skills, setSkills] = useState<CustomSkill[]>([]);
  const [view, setView] = useState<"list" | "create" | "study" | "quiz">("list");
  const [activeSkill, setActiveSkill] = useState<CustomSkill | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topicsInput, setTopicsInput] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [creating, setCreating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Study
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const key = user ? `custom_skills_${user.id}` : "custom_skills_anon";
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      setSkills(saved);
    } catch { setSkills([]); }
  }, [user]);

  const saveSkills = (updated: CustomSkill[]) => {
    const key = user ? `custom_skills_${user.id}` : "custom_skills_anon";
    localStorage.setItem(key, JSON.stringify(updated));
    setSkills(updated);
  };

  const autoGenerateTopics = async () => {
    if (!name.trim()) return;
    setAutoGenerating(true);
    let raw = "";
    await streamAI(
      `Generate 8-10 study topics for the subject "${name}" (${description || "general"}). Return ONLY a JSON array of strings like ["Topic 1", "Topic 2", ...]`,
      "You are an education expert. Return only a JSON array of topic strings.",
      (t) => { raw = t; }
    );
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const topics = JSON.parse(match[0]);
        setTopicsInput(topics.join("\n"));
      }
    } catch {}
    setAutoGenerating(false);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const topics = topicsInput.split("\n").map(t => t.trim()).filter(Boolean);
    const newSkill: CustomSkill = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      topics: topics.length > 0 ? topics : ["General Overview"],
      systemPrompt: `You are an expert tutor in ${name.trim()}. ${description.trim()}. Explain concepts clearly with examples, formulas, and practice problems. Use markdown formatting.`,
      emoji,
    };
    saveSkills([...skills, newSkill]);
    setName(""); setDescription(""); setTopicsInput(""); setEmoji("📚");
    setView("list");
  };

  const deleteSkill = (id: string) => {
    saveSkills(skills.filter(s => s.id !== id));
  };

  const handleTopicClick = async (skill: CustomSkill, topic: string) => {
    setActiveSkill(skill);
    setSelectedTopic(topic);
    setAiContent("");
    setAiLoading(true);
    setView("study");
    const prompt = `Explain "${topic}" comprehensively for a student studying ${skill.name}. Include:\n1. Core concepts\n2. Key formulas/rules\n3. 2 solved examples\n4. Common mistakes\n5. Quick revision points`;
    await streamAI(prompt, skill.systemPrompt, setAiContent);
    setAiLoading(false);
  };

  const startQuiz = async (skill: CustomSkill) => {
    setActiveSkill(skill);
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFinished(false);
    setQuizLoading(true);
    setView("quiz");
    let raw = "";
    const topicList = skill.topics.join(", ");
    await streamAI(
      `Generate 5 MCQ questions on ${skill.name} covering these topics: ${topicList}. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`,
      "You are a quiz master. Return only a JSON array.",
      (t) => { raw = t; }
    );
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setQuizQuestions(JSON.parse(match[0]));
    } catch {}
    setQuizLoading(false);
  };

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(idx);
    if (idx === quizQuestions[quizIdx]?.answer) {
      setQuizScore(s => s + 1);
      setQuizStreak(s => s + 1);
    } else {
      setQuizStreak(0);
    }
  };

  const nextQuestion = () => {
    if (quizIdx + 1 >= quizQuestions.length) { setQuizFinished(true); return; }
    setQuizIdx(i => i + 1);
    setQuizAnswer(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <button onClick={() => {
          if (view !== "list") { setView("list"); setSelectedTopic(null); setAiContent(""); }
          else onBack?.();
        }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <Pencil className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {view === "create" ? "Create Skill" : view === "study" ? activeSkill?.name : view === "quiz" ? `${activeSkill?.name} Quiz` : "My Skills"}
          </h2>
          <p className="text-xs text-muted-foreground">Create & study your own custom topics</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">

          {/* LIST VIEW */}
          {view === "list" && (
            <div className="space-y-4">
              <button onClick={() => setView("create")}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create New Skill</span>
              </button>

              {skills.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No custom skills yet. Create one to start studying!</p>
                </div>
              )}

              {skills.map(skill => (
                <div key={skill.id} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{skill.emoji}</span>
                      <div>
                        <h3 className="font-bold text-foreground">{skill.name}</h3>
                        <p className="text-xs text-muted-foreground">{skill.topics.length} topics • {skill.description || "Custom skill"}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteSkill(skill.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {skill.topics.slice(0, 4).map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                    ))}
                    {skill.topics.length > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{skill.topics.length - 4}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveSkill(skill); setView("study"); setSelectedTopic(null); setAiContent(""); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                      <BookOpen className="w-4 h-4" /> Study
                    </button>
                    <button onClick={() => startQuiz(skill)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                      <Brain className="w-4 h-4" /> Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CREATE VIEW */}
          {view === "create" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Skill Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Machine Learning, Data Structures..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of what you want to study"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all",
                        emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80")}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-foreground">Topics (one per line)</label>
                  <button onClick={autoGenerateTopics} disabled={!name.trim() || autoGenerating}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                    {autoGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Auto-generate
                  </button>
                </div>
                <textarea value={topicsInput} onChange={e => setTopicsInput(e.target.value)}
                  placeholder={"Topic 1\nTopic 2\nTopic 3\n..."}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
              <button onClick={handleCreate} disabled={!name.trim()}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                Create Skill
              </button>
            </div>
          )}

          {/* STUDY VIEW */}
          {view === "study" && activeSkill && (
            <div className="space-y-3">
              {!selectedTopic ? (
                <>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span>{activeSkill.emoji}</span> {activeSkill.name} Topics
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {activeSkill.topics.map(topic => (
                      <button key={topic} onClick={() => handleTopicClick(activeSkill, topic)}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                        <span className="font-medium text-foreground text-sm">{topic}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => { setSelectedTopic(null); setAiContent(""); }}
                    className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to topics
                  </button>
                  <h3 className="text-lg font-bold text-foreground">{selectedTopic}</h3>
                  {aiLoading && !aiContent && (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-muted-foreground">Generating content...</span>
                    </div>
                  )}
                  {aiContent && (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50">
                      <ReactMarkdown>{aiContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* QUIZ VIEW */}
          {view === "quiz" && activeSkill && (
            <div className="space-y-4">
              {quizLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Generating quiz...</span>
                </div>
              ) : quizFinished ? (
                <div className="text-center space-y-4 py-8">
                  <Trophy className="w-12 h-12 mx-auto text-amber-500" />
                  <h3 className="text-2xl font-bold text-foreground">{quizScore}/{quizQuestions.length}</h3>
                  <p className="text-muted-foreground">
                    {quizScore === quizQuestions.length ? "Perfect! 🎉" : quizScore >= 3 ? "Good job! 👍" : "Keep practicing! 💪"}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => startQuiz(activeSkill)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                      <RotateCcw className="w-4 h-4 inline mr-1" /> Retry
                    </button>
                    <button onClick={() => setView("list")} className="px-4 py-2 rounded-lg bg-muted text-foreground font-medium">
                      Back
                    </button>
                  </div>
                </div>
              ) : quizQuestions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Q{quizIdx + 1}/{quizQuestions.length}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> {quizScore}</span>
                      <span className="text-sm flex items-center gap-1"><Zap className="w-4 h-4 text-orange-500" /> {quizStreak}🔥</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border/50">
                    <p className="font-medium text-foreground mb-3">{quizQuestions[quizIdx]?.question}</p>
                    <div className="space-y-2">
                      {quizQuestions[quizIdx]?.options.map((opt, i) => (
                        <button key={i} onClick={() => handleQuizAnswer(i)} disabled={quizAnswer !== null}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all text-sm",
                            quizAnswer === null ? "border-border/50 hover:border-primary/50 hover:bg-primary/5" :
                            i === quizQuestions[quizIdx]?.answer ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                            i === quizAnswer ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400" :
                            "border-border/30 opacity-50"
                          )}>
                          <span className="flex items-center gap-2">
                            {quizAnswer !== null && i === quizQuestions[quizIdx]?.answer && <CheckCircle2 className="w-4 h-4" />}
                            {quizAnswer !== null && i === quizAnswer && i !== quizQuestions[quizIdx]?.answer && <XCircle className="w-4 h-4" />}
                            {opt}
                          </span>
                        </button>
                      ))}
                    </div>
                    {quizAnswer !== null && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                        💡 {quizQuestions[quizIdx]?.explanation}
                      </div>
                    )}
                  </div>
                  {quizAnswer !== null && (
                    <button onClick={nextQuestion} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium">
                      {quizIdx + 1 >= quizQuestions.length ? "See Results" : "Next Question →"}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
