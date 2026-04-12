import { forwardRef } from "react";
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
    </div>
  );
});

export default WelcomeScreen;
