import { forwardRef } from "react";
import { Zap, Diamond, Image as ImageIcon, Pencil, Globe, FlaskConical } from "lucide-react";
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

  const quickActions = [
    { icon: ImageIcon, label: "Create an image", action: () => prefill("Create an image of ") },
    { icon: Pencil, label: "Write or edit", action: () => prefill("Help me write or edit ") },
    { icon: Globe, label: "Look something up", action: () => prefill("Look up information about ") },
    { icon: FlaskConical, label: "40+ Tools", action: () => navigate("/ai-playground") },
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

      {/* Quick action pills */}
      <div className="w-full max-w-[720px] flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-6 sm:mt-8">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full",
              "border border-border/60 bg-background/40 backdrop-blur-sm",
              "text-sm text-foreground/90 hover:text-foreground",
              "hover:bg-muted/40 hover:border-border transition-all duration-200"
            )}
          >
            <action.icon className="w-4 h-4 text-muted-foreground" />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default WelcomeScreen;
