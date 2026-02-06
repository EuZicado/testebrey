import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Image as ImageIcon, Loader2, Check, X, Sticker } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AudioRecorder } from "./AudioRecorder";
import { StickerPicker } from "./StickerPicker";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface MessageInputProps {
  onSend: (message: string, stickerUrl?: string) => Promise<void>;
  onSendAudio: (audioBlob: Blob, duration: number) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
}

type SendingState = "idle" | "sending" | "success" | "error";

export const MessageInput = ({
  onSend,
  onSendAudio,
  onTypingStart,
  onTypingStop,
  disabled,
}: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [sendingState, setSendingState] = useState<SendingState>("idle");
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
    formatDuration,
  } = useAudioRecorder();

  const handleChange = (value: string) => {
    setMessage(value);

    if (value.trim()) {
      onTypingStart();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop();
      }, 2000);
    } else {
      onTypingStop();
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sendingState === "sending" || disabled) return;

    const messageToSend = message.trim();
    setMessage("");
    setSendingState("sending");
    onTypingStop();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await onSend(messageToSend);
      setSendingState("success");
      setTimeout(() => setSendingState("idle"), 1500);
    } catch (error) {
      setSendingState("error");
      setMessage(messageToSend);
      setTimeout(() => setSendingState("idle"), 2000);
    }
  };

  const handleSendSticker = async (stickerUrl: string) => {
    setSendingState("sending");
    try {
      await onSend("", stickerUrl);
      setSendingState("success");
      setTimeout(() => setSendingState("idle"), 1000);
    } catch (error) {
      setSendingState("error");
      setTimeout(() => setSendingState("idle"), 2000);
    }
  };

  const handleSendAudio = useCallback(async () => {
    if (!audioBlob) return;

    setIsSendingAudio(true);
    try {
      await onSendAudio(audioBlob, duration);
      clearRecording();
    } catch (error) {
      console.error("Error sending audio:", error);
    } finally {
      setIsSendingAudio(false);
    }
  }, [audioBlob, duration, onSendAudio, clearRecording]);

  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }, [startRecording]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getButtonContent = () => {
    switch (sendingState) {
      case "sending":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "success":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Check className="w-4 h-4" />
          </motion.div>
        );
      case "error":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <X className="w-4 h-4" />
          </motion.div>
        );
      default:
        return <Send className="w-4 h-4" />;
    }
  };

  const getButtonVariant = () => {
    switch (sendingState) {
      case "success":
        return "bg-green-500 hover:bg-green-600";
      case "error":
        return "bg-destructive hover:bg-destructive/90";
      default:
        return "";
    }
  };

  const showAudioRecorder = isRecording || audioUrl;

  return (
    <>
      <div className="bg-background/80 backdrop-blur-xl border-t border-white/5 px-4 py-3 safe-bottom transition-all duration-300">
        {/* Error Message */}
        <AnimatePresence>
          {sendingState === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2"
            >
              <p className="text-xs text-red-400 text-center font-medium bg-red-500/10 py-1 rounded-md border border-red-500/20">
                Erro ao enviar. Toque para tentar novamente.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showAudioRecorder ? (
            <motion.div
              key="audio-recorder"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <AudioRecorder
                isRecording={isRecording}
                duration={duration}
                audioUrl={audioUrl}
                onStartRecording={handleStartRecording}
                onStopRecording={stopRecording}
                onCancelRecording={cancelRecording}
                onSendAudio={handleSendAudio}
                isSending={isSendingAudio}
                formatDuration={formatDuration}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-end gap-2"
            >
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
                onClick={() => setShowStickerPicker(!showStickerPicker)}
              >
                <Sticker className="w-6 h-6" />
              </Button>

              <div className="flex-1 bg-zinc-900/50 rounded-2xl border border-white/5 focus-within:border-emerald-500/50 focus-within:bg-zinc-900 transition-all duration-200 flex items-end min-h-[44px]">
                <Input
                  value={message}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Mensagem..."
                  className="border-none bg-transparent focus-visible:ring-0 min-h-[44px] py-3 px-4 resize-none max-h-32 placeholder:text-zinc-500"
                  disabled={disabled || sendingState === "sending"}
                  autoComplete="off"
                />
                
                <AnimatePresence>
                   {!message.trim() && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="mr-1 mb-1"
                      >
                         <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
                            onClick={handleStartRecording}
                         >
                            <span className="sr-only">Gravar áudio</span>
                            <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-current" />
                            </div>
                         </Button>
                      </motion.div>
                   )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="popLayout">
                {message.trim() && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Button
                      onClick={handleSend}
                      disabled={!message.trim() || sendingState === "sending" || disabled}
                      size="icon"
                      className={cn(
                        "rounded-full w-11 h-11 shrink-0 transition-all duration-300 shadow-lg shadow-emerald-500/20",
                        getButtonVariant(),
                        !getButtonVariant() && "bg-emerald-500 hover:bg-emerald-600 text-black"
                      )}
                    >
                      {getButtonContent()}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <StickerPicker
          isOpen={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onSelect={handleSendSticker}
        />
      </div>
    </>
  );
};
