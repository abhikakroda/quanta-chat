import { forwardRef } from "react";
import { Zap, Diamond, Code2, Globe, ImagePlus, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChatInput from "./ChatInput";
import { ModelId, getModelLabel } from "@/lib/chat";
import { cn } from "@/lib/utils";

type AttachedFile = {
  name: string;
  content: string;
  type: string;
  dataUrl?: string;
};

type Props = {
  onSend: (text: string, files?: AttachedFile[]) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
  agentMode?: boolean;
  onToggleAgent?: () => void;
  selectedModel?: ModelId;
  expertMode?: boolean;
  onToggleExpert?: () => void;
  onSelectSkill?: (skill: string) => void;
  activeSkillLabel?: string | null;
};

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  selectedModel = "gemini-flash",
  expertMode = false,
  onToggleExpert,
  onSelectSkill,
  activeSkillLabel,
}, ref) {
  const modelLabel = getModelLabel(selectedModel);

  const navigate = useNavigate();

  const prefill = (text: string) => onSend(text);

  const featureCards = [
    { icon: Code2, title: "Code & Build", desc: "Write, debug, review code in any language", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/5", action: () => prefill("Help me write, debug, and review code. What language or project are you working on?") },
    { icon: Globe, title: "Research", desc: "Deep research with live web access", color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/5", action: () => prefill("Do a deep research on this topic for me:") },
    { icon: ImagePlus, title: "Create", desc: "Generate images, docs, and content", color: "text-pink-400", border: "border-pink-500/20", bg: "bg-pink-500/5", action: () => prefill("Help me create content — I need to generate:") },
    { icon: FlaskConical, title: "40+ Tools", desc: "AI playground with specialized tools", color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5", action: () => navigate("/ai-playground") },
  ];

  return (
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 pb-[10vh] animate-fade-in">
      {/* Brand heading */}
      <div className="mb-5 sm:mb-8 animate-slide-up text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Start chatting with <span className="text-primary">{expertMode ? "Expert" : "Instant"}</span>
          </span>
        </div>

        {/* Mode toggle pill */}
        <div className="inline-flex items-center rounded-full border border-border/60 p-1 glass-subtle">
          <button
            onClick={() => expertMode && onToggleExpert?.()}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              !expertMode
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Instant
          </button>
          <button
            onClick={() => !expertMode && onToggleExpert?.()}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              expertMode
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Diamond className="w-3.5 h-3.5" />
            Expert
          </button>
        </div>
      </div>

      <div className="w-full max-w-[640px]">
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          selectedModel={selectedModel}
          activeSkillLabel={activeSkillLabel}
          noBorder
        />
      </div>

      {/* Feature cards */}
      <div className="w-full max-w-[720px] grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 sm:mt-8">
        {featureCards.map((card) => (
          <button
            key={card.title}
            onClick={card.action}
            className={cn(
              "flex flex-col items-start gap-2 p-3.5 sm:p-4 rounded-xl border transition-all duration-200 text-left",
              card.border, card.bg,
              "hover:scale-[1.02] hover:shadow-lg"
            )}
          >
            <card.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", card.color)} />
            <div>
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">{card.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

export default WelcomeScreen;
