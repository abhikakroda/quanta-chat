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
    <div ref={ref} className="flex-1 flex flex-col items-center justify-center px-4 pb-[10vh]">
      <div className="mb-10 sm:mb-12 text-center animate-fade-in" style={{ animationDelay: "0ms" }}>
        <div className="inline-flex items-baseline gap-1.5">
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-foreground lowercase">quanta</span>
          <span className="text-4xl sm:text-5xl font-extralight tracking-tight text-muted-foreground/60">AI</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground/50 font-light tracking-wide">Think deeper. Create faster.</p>
      </div>

      <div className="w-full max-w-[640px] mb-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <ChatInput
          onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming}
          agentMode={agentMode} onToggleAgent={onToggleAgent}
          thinkingEnabled={thinkingEnabled} onToggleThinking={onToggleThinking}
          selectedModel={selectedModel} onSelectModel={onSelectModel}
          modelSupportsThinking={modelSupportsThinking}
        />
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2.5 max-w-[640px] w-full animate-fade-in" style={{ animationDelay: "200ms" }}>
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
            className="group flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl border border-border/50 bg-card/50 text-[13px] text-foreground/60 hover:text-foreground hover:border-border hover:bg-accent/50 transition-all duration-300 touch-manipulation press-scale hover-lift"
          >
            <span className="text-base group-hover:scale-110 transition-transform duration-200">{s.icon}</span>
            <span className="font-medium">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default WelcomeScreen;
