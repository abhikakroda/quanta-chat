import { forwardRef } from "react";
import ChatInput from "./ChatInput";
import { ModelId } from "@/lib/chat";

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
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  selectedModel?: ModelId;
  onSelectModel?: (model: ModelId) => void;
  modelSupportsThinking?: boolean;
  onSelectSkill?: (skill: string) => void;
  activeSkillLabel?: string | null;
};

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  thinkingEnabled, onToggleThinking,
  selectedModel, onSelectModel,
  modelSupportsThinking, onSelectSkill,
  activeSkillLabel,
}, ref) {
  return (
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-4 pb-[10vh] animate-fade-in">
      {/* Large centered brand — Kimi style */}
      <div className="mb-10 animate-slide-up">
        <span className="text-5xl sm:text-6xl font-bold tracking-tighter text-foreground uppercase">OPENTROPIC</span>
      </div>

      <div className="w-full max-w-[640px]">
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          thinkingEnabled={thinkingEnabled} onToggleThinking={onToggleThinking}
          selectedModel={selectedModel} onSelectModel={onSelectModel}
          modelSupportsThinking={modelSupportsThinking}
          activeSkillLabel={activeSkillLabel}
        />
      </div>
    </div>
  );
});

export default WelcomeScreen;
