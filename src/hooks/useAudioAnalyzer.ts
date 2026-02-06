import { useEffect, useRef, useState } from "react";

export const useAudioAnalyzer = (stream: MediaStream | null) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!stream) {
      setAudioLevel(0);
      return;
    }

    // Initialize Audio Context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    
    // Create Analyser
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Create Source
    // Note: We need to handle cases where the stream might not have audio tracks yet
    if (stream.getAudioTracks().length > 0) {
      try {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (e) {
        console.error("Error creating audio source:", e);
      }
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-100 range roughly
      // Audio levels are usually low, so we amplify a bit for visual effect
      const normalized = Math.min(100, (average / 255) * 200);
      
      setAudioLevel(normalized);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      // Do not close audioContext as it might be expensive to recreate frequently
      // or if we want to reuse it. But for a hook, maybe we should suspend it.
    };
  }, [stream]);

  return { audioLevel };
};
