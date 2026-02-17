import { forwardRef } from "react";
import ChatInput from "./ChatInput";
import { ModelId } from "@/lib/chat";

type AttachedFile = {
  name: string;
  content: string;
  type: string;
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
};

const suggestions = [
  { icon: "🗣️", text: "Text to Speech", skill: null },
  { icon: "🧮", text: "Calculator", skill: null },
  { icon: "🌐", text: "Translate text", skill: null },
  { icon: "🌐", text: "Website Builder", skill: "code-assistant" },
];

const WelcomeScreen = forwardRef<HTMLDivElement, Props>(function WelcomeScreen({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  thinkingEnabled, onToggleThinking,
  selectedModel, onSelectModel,
  modelSupportsThinking, onSelectSkill,
}, ref) {
  return (
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-normal text-foreground mb-8 sm:mb-10 tracking-tight text-center animate-slide-up">
        What can I help with?
      </h1>

      <div className="w-full max-w-[768px] mb-6">
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          thinkingEnabled={thinkingEnabled} onToggleThinking={onToggleThinking}
          selectedModel={selectedModel} onSelectModel={onSelectModel}
          modelSupportsThinking={modelSupportsThinking}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-[768px]">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => {
              if (s.skill) {
                onSelectSkill?.(s.skill);
              } else {
                onSend(s.text);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm text-foreground/70 hover:text-foreground transition-all duration-200 hover:scale-[1.03] touch-manipulation ripple-container press-scale hover-lift"
          >
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default WelcomeScreen;
