 import { useRef, useCallback, useEffect } from 'react';
 
 // Audio frequencies for different call sounds
 const RINGTONE_FREQUENCIES = [440, 480]; // Traditional phone ring
 const CONNECTING_FREQUENCY = 350;
 const BUSY_FREQUENCIES = [480, 620];
 const ENDED_FREQUENCY = 440;
 
 export const useCallSounds = () => {
   const audioContextRef = useRef<AudioContext | null>(null);
   const oscillatorsRef = useRef<OscillatorNode[]>([]);
   const gainNodeRef = useRef<GainNode | null>(null);
   const isPlayingRef = useRef(false);
   const intervalRef = useRef<NodeJS.Timeout | null>(null);
 
   const getAudioContext = useCallback(() => {
     if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
       audioContextRef.current = new AudioContext();
     }
     if (audioContextRef.current.state === 'suspended') {
       audioContextRef.current.resume();
     }
     return audioContextRef.current;
   }, []);
 
   const stopAllSounds = useCallback(() => {
     isPlayingRef.current = false;
     
     if (intervalRef.current) {
       clearInterval(intervalRef.current);
       intervalRef.current = null;
     }
     
     oscillatorsRef.current.forEach(osc => {
       try {
         osc.stop();
         osc.disconnect();
       } catch (e) {
         // Oscillator may already be stopped
       }
     });
     oscillatorsRef.current = [];
     
     if (gainNodeRef.current) {
       gainNodeRef.current.disconnect();
       gainNodeRef.current = null;
     }
   }, []);
 
   const playRingtone = useCallback(() => {
     stopAllSounds();
     const ctx = getAudioContext();
     isPlayingRef.current = true;
     
     const playRingCycle = () => {
       if (!isPlayingRef.current) return;
       
       const gainNode = ctx.createGain();
       gainNode.connect(ctx.destination);
       gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
       gainNodeRef.current = gainNode;
       
       const oscillators: OscillatorNode[] = [];
       
       // Create dual-tone ringtone
       RINGTONE_FREQUENCIES.forEach(freq => {
         const osc = ctx.createOscillator();
         osc.frequency.setValueAtTime(freq, ctx.currentTime);
         osc.type = 'sine';
         osc.connect(gainNode);
         osc.start(ctx.currentTime);
         oscillators.push(osc);
       });
       
       oscillatorsRef.current = oscillators;
       
       // Ring pattern: 400ms on, 200ms off, 400ms on, 2000ms off
       gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
       gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.4);
       gainNode.gain.setValueAtTime(0.08, ctx.currentTime + 0.6);
       gainNode.gain.setValueAtTime(0, ctx.currentTime + 1.0);
       
       setTimeout(() => {
         oscillators.forEach(osc => {
           try {
             osc.stop();
             osc.disconnect();
           } catch (e) {}
         });
         gainNode.disconnect();
       }, 1100);
     };
     
     playRingCycle();
     intervalRef.current = setInterval(playRingCycle, 3000);
   }, [getAudioContext, stopAllSounds]);
 
   const playConnecting = useCallback(() => {
     stopAllSounds();
     const ctx = getAudioContext();
     isPlayingRef.current = true;
     
     const playBeep = () => {
       if (!isPlayingRef.current) return;
       
       const gainNode = ctx.createGain();
       gainNode.connect(ctx.destination);
       gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
       
       const osc = ctx.createOscillator();
       osc.frequency.setValueAtTime(CONNECTING_FREQUENCY, ctx.currentTime);
       osc.type = 'sine';
       osc.connect(gainNode);
       osc.start(ctx.currentTime);
       
       gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
       
       setTimeout(() => {
         try {
           osc.stop();
           osc.disconnect();
           gainNode.disconnect();
         } catch (e) {}
       }, 600);
     };
     
     playBeep();
     intervalRef.current = setInterval(playBeep, 3000);
   }, [getAudioContext, stopAllSounds]);
 
   const playConnected = useCallback(() => {
     stopAllSounds();
     const ctx = getAudioContext();
     
     const gainNode = ctx.createGain();
     gainNode.connect(ctx.destination);
     gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
     
     const osc = ctx.createOscillator();
     osc.frequency.setValueAtTime(440, ctx.currentTime);
     osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
     osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
     osc.type = 'sine';
     osc.connect(gainNode);
     osc.start(ctx.currentTime);
     
     gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
     
     setTimeout(() => {
       try {
         osc.stop();
         osc.disconnect();
         gainNode.disconnect();
       } catch (e) {}
     }, 600);
   }, [getAudioContext, stopAllSounds]);
 
   const playEnded = useCallback(() => {
     stopAllSounds();
     const ctx = getAudioContext();
     
     const gainNode = ctx.createGain();
     gainNode.connect(ctx.destination);
     gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
     
     const osc = ctx.createOscillator();
     osc.frequency.setValueAtTime(ENDED_FREQUENCY, ctx.currentTime);
     osc.frequency.setValueAtTime(ENDED_FREQUENCY * 0.8, ctx.currentTime + 0.15);
     osc.frequency.setValueAtTime(ENDED_FREQUENCY * 0.6, ctx.currentTime + 0.3);
     osc.type = 'sine';
     osc.connect(gainNode);
     osc.start(ctx.currentTime);
     
     gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
     
     setTimeout(() => {
       try {
         osc.stop();
         osc.disconnect();
         gainNode.disconnect();
       } catch (e) {}
     }, 600);
   }, [getAudioContext, stopAllSounds]);
 
   const playBusy = useCallback(() => {
     stopAllSounds();
     const ctx = getAudioContext();
     isPlayingRef.current = true;
     
     let count = 0;
     const maxCount = 6;
     
     const playBusyTone = () => {
       if (!isPlayingRef.current || count >= maxCount) {
         stopAllSounds();
         return;
       }
       count++;
       
       const gainNode = ctx.createGain();
       gainNode.connect(ctx.destination);
       gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
       
       const oscillators: OscillatorNode[] = [];
       BUSY_FREQUENCIES.forEach(freq => {
         const osc = ctx.createOscillator();
         osc.frequency.setValueAtTime(freq, ctx.currentTime);
         osc.type = 'sine';
         osc.connect(gainNode);
         osc.start(ctx.currentTime);
         oscillators.push(osc);
       });
       
       setTimeout(() => {
         oscillators.forEach(osc => {
           try {
             osc.stop();
             osc.disconnect();
           } catch (e) {}
         });
         gainNode.disconnect();
       }, 500);
     };
     
     playBusyTone();
     intervalRef.current = setInterval(playBusyTone, 500);
   }, [getAudioContext, stopAllSounds]);
 
   const vibrate = useCallback((pattern: number | number[]) => {
     if ('vibrate' in navigator) {
       navigator.vibrate(pattern);
     }
   }, []);
 
   const vibrateRingtone = useCallback(() => {
     vibrate([200, 100, 200, 2500]);
   }, [vibrate]);
 
   const vibrateShort = useCallback(() => {
     vibrate(50);
   }, [vibrate]);
 
   const vibrateLong = useCallback(() => {
     vibrate(200);
   }, [vibrate]);
 
   useEffect(() => {
     return () => {
       stopAllSounds();
       if (audioContextRef.current) {
         audioContextRef.current.close();
       }
     };
   }, [stopAllSounds]);
 
   return {
     playRingtone,
     playConnecting,
     playConnected,
     playEnded,
     playBusy,
     stopAllSounds,
     vibrateRingtone,
     vibrateShort,
     vibrateLong,
   };
 };