// Types for WebRTC calling system

// Connection quality metrics
export interface ConnectionQuality {
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
  bitrate: number;
  packetLoss: number;
  latency: number;
  jitter: number;
}

// Call statistics
export interface CallStats {
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  roundTripTime: number;
  audioLevel: number;
  videoWidth?: number;
  videoHeight?: number;
  frameRate?: number;
}

export type CallStatus = 'pending' | 'initiating' | 'ringing' | 'connected' | 'ended' | 'missed' | 'declined' | 'rejected';
export type CallType = 'audio' | 'video';
export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'screen-share-start' | 'screen-share-stop';

export interface CallSession {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  call_type: CallType;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface CallSignal {
  id: string;
  call_id: string;
  sender_id: string;
  signal_type: SignalType;
  signal_data: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
  created_at: string;
}

export interface CallMessage {
  id: string;
  call_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface CallParticipant {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ActiveCall {
  session: CallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  otherParticipant: CallParticipant | null;
  connectionQuality: ConnectionQuality | null;
  stats: CallStats | null;
}

export interface IncomingCall {
  session: CallSession;
  caller: CallParticipant;
}

// ICE Server configuration
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// Helper to get quality rating from metrics
export const getQualityRating = (packetLoss: number, latency: number): ConnectionQuality['rating'] => {
  if (latency < 100 && packetLoss < 1) return 'excellent';
  if (latency < 200 && packetLoss < 3) return 'good';
  if (latency < 400 && packetLoss < 5) return 'fair';
  if (latency < 800 && packetLoss < 10) return 'poor';
  return 'disconnected';
};
