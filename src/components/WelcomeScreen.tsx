import { forwardRef, useState } from "react";
import { Zap, Diamond } from "lucide-react";
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
  
  onSelectSkill?: (skill: string) => void;
  activeSkillLabel?: string | null;
};

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  selectedModel = "gemini-flash",
  onSelectSkill,
  activeSkillLabel,
}, ref) {
  const [mode, setMode] = useState<"instant" | "expert">("instant");
  const modelLabel = getModelLabel(selectedModel);

  return (
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 pb-[10vh] animate-fade-in">
      {/* Brand heading */}
      <div className="mb-5 sm:mb-8 animate-slide-up text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Start chatting with <span className="text-primary">{mode === "instant" ? "Instant" : "Expert"}</span>
          </span>
        </div>

        {/* Mode toggle pill */}
        <div className="inline-flex items-center rounded-full border border-border/60 p-1 glass-subtle">
          <button
            onClick={() => setMode("instant")}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              mode === "instant"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Instant
          </button>
          <button
            onClick={() => setMode("expert")}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              mode === "expert"
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
    </div>
  );
});

export default WelcomeScreen;
