export function getMicErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    switch (err.name) {
      case "NotAllowedError":
        return "Microphone permission denied. Please allow microphone access in your browser settings.";
      case "NotFoundError":
        return "No microphone detected. Please connect a microphone and try again.";
      case "NotReadableError":
        return "Microphone is in use by another application. Please close it and try again.";
      case "OverconstrainedError":
        return "Microphone doesn't meet requirements. Please try a different device.";
      default:
        return `Microphone error: ${err.message}`;
    }
  }
  return "Could not access microphone. Please check your device settings.";
}
