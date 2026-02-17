import { memo, useMemo, useRef, useEffect } from "react";

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const prevLengthRef = useRef(0);
  
  // Track how much content was already rendered (not new)
  useEffect(() => {
    if (!isStreaming) {
      prevLengthRef.current = 0;
    }
  }, [isStreaming]);

  const parts = useMemo(() => {
    if (!isStreaming) return null;
    
    const oldLength = prevLengthRef.current;
    const oldText = content.slice(0, oldLength);
    const newText = content.slice(oldLength);
    
    // Update ref for next render
    prevLengthRef.current = content.length;
    
    return { oldText, newText };
  }, [content, isStreaming]);

  if (!isStreaming || !parts) return null;

  return (
    <>
      {parts.oldText && <span>{parts.oldText}</span>}
      {parts.newText && (
        <span className="streaming-word">{parts.newText}</span>
      )}
    </>
  );
}

export default memo(StreamingText);
