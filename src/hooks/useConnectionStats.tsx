 import { useState, useEffect, useRef, useCallback } from 'react';
 import { ConnectionQuality, CallStats, getQualityRating } from '@/types/calls';
 
 interface UseConnectionStatsResult {
   quality: ConnectionQuality | null;
   stats: CallStats | null;
   startMonitoring: (pc: RTCPeerConnection) => void;
   stopMonitoring: () => void;
 }
 
 export const useConnectionStats = (): UseConnectionStatsResult => {
   const [quality, setQuality] = useState<ConnectionQuality | null>(null);
   const [stats, setStats] = useState<CallStats | null>(null);
   const intervalRef = useRef<NodeJS.Timeout | null>(null);
   const pcRef = useRef<RTCPeerConnection | null>(null);
   const prevBytesReceivedRef = useRef<number>(0);
   const prevTimestampRef = useRef<number>(0);
 
   const calculateStats = useCallback(async (pc: RTCPeerConnection) => {
     try {
       const statsReport = await pc.getStats();
       let bytesSent = 0;
       let bytesReceived = 0;
       let packetsLost = 0;
       let roundTripTime = 0;
       let audioLevel = 0;
       let videoWidth = 0;
       let videoHeight = 0;
       let frameRate = 0;
       let jitter = 0;
       let bitrate = 0;
 
       statsReport.forEach((report) => {
         if (report.type === 'outbound-rtp') {
           bytesSent += report.bytesSent || 0;
         }
         
         if (report.type === 'inbound-rtp') {
           bytesReceived += report.bytesReceived || 0;
           packetsLost += report.packetsLost || 0;
           jitter = report.jitter || 0;
           
           if (report.kind === 'video') {
             frameRate = report.framesPerSecond || 0;
           }
         }
         
         if (report.type === 'candidate-pair' && report.state === 'succeeded') {
           roundTripTime = (report.currentRoundTripTime || 0) * 1000;
         }
         
         if (report.type === 'media-source' && report.kind === 'audio') {
           audioLevel = report.audioLevel || 0;
         }
         
         if (report.type === 'track' && report.kind === 'video') {
           videoWidth = report.frameWidth || 0;
           videoHeight = report.frameHeight || 0;
         }
       });
 
       // Calculate bitrate
       const now = Date.now();
       if (prevTimestampRef.current > 0) {
         const timeDiff = (now - prevTimestampRef.current) / 1000;
         const bytesDiff = bytesReceived - prevBytesReceivedRef.current;
         bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000); // kbps
       }
       prevBytesReceivedRef.current = bytesReceived;
       prevTimestampRef.current = now;
 
       const rating = getQualityRating(packetsLost, roundTripTime);
 
       setQuality({
         rating,
         bitrate,
         packetLoss: packetsLost,
         latency: Math.round(roundTripTime),
         jitter: Math.round(jitter * 1000),
       });
 
       setStats({
         bytesSent,
         bytesReceived,
         packetsLost,
         roundTripTime: Math.round(roundTripTime),
         audioLevel,
         videoWidth,
         videoHeight,
         frameRate: Math.round(frameRate),
       });
     } catch (error) {
       console.error('Error getting connection stats:', error);
     }
   }, []);
 
   const startMonitoring = useCallback((pc: RTCPeerConnection) => {
     pcRef.current = pc;
     prevBytesReceivedRef.current = 0;
     prevTimestampRef.current = 0;
     
     // Update stats every second
     intervalRef.current = setInterval(() => {
       if (pcRef.current && pcRef.current.connectionState === 'connected') {
         calculateStats(pcRef.current);
       }
     }, 1000);
   }, [calculateStats]);
 
   const stopMonitoring = useCallback(() => {
     if (intervalRef.current) {
       clearInterval(intervalRef.current);
       intervalRef.current = null;
     }
     pcRef.current = null;
     setQuality(null);
     setStats(null);
   }, []);
 
   useEffect(() => {
     return () => {
       stopMonitoring();
     };
   }, [stopMonitoring]);
 
   return {
     quality,
     stats,
     startMonitoring,
     stopMonitoring,
   };
 };