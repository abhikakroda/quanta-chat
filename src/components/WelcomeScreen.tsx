import { forwardRef } from "react";
import { Image as ImageIcon, Pencil, Globe, FlaskConical } from "lucide-react";
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
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  onSelectSkill?: (skill: string) => void;
  activeSkillLabel?: string | null;
};

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  selectedModel = "gemini-flash",
  expertMode = false,
  onToggleExpert,
  thinkingEnabled = false,
  onToggleThinking,
  onSelectSkill,
  activeSkillLabel,
}, ref) {
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
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-foreground mb-4">
          AI for all from <span className="text-primary">OpenTropic</span>
        </h1>
        <p className="max-w-xl mx-auto text-sm sm:text-base text-muted-foreground px-4">
          A free AI chat assistant with multiple models for code, research, writing, image generation, voice chat and 40+ specialized tools — all in one place. Use the <span className="font-medium text-foreground">+</span> button to enable Thinking, Expert or Agent modes.
        </p>
      </div>

      <div className="w-full max-w-[640px]">
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          expertMode={expertMode} onToggleExpert={onToggleExpert}
          thinkingEnabled={thinkingEnabled} onToggleThinking={onToggleThinking}
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
