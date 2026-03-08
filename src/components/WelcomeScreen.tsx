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
  selectedModel?: ModelId;
  
  onSelectSkill?: (skill: string) => void;
  activeSkillLabel?: string | null;
};

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  selectedModel, onSelectModel,
  onSelectSkill,
  activeSkillLabel,
}, ref) {
  return (
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 pb-[10vh] animate-fade-in">
      {/* Large centered brand */}
      <div className="mb-6 sm:mb-10 animate-slide-up">
        <span className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground uppercase">OPENTROPIC</span>
      </div>

      <div className="w-full max-w-[640px]">
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          selectedModel={selectedModel} onSelectModel={onSelectModel}
          activeSkillLabel={activeSkillLabel}
          noBorder
        />
      </div>
    </div>
  );
});

export default WelcomeScreen;
