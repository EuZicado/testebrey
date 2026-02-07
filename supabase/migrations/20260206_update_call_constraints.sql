-- Update check constraint for call_sessions status
ALTER TABLE public.call_sessions DROP CONSTRAINT IF EXISTS call_sessions_status_check;
ALTER TABLE public.call_sessions ADD CONSTRAINT call_sessions_status_check 
  CHECK (status IN ('pending', 'initiating', 'ringing', 'connected', 'ended', 'missed', 'declined', 'rejected', 'busy'));

-- Update check constraint for call_signals signal_type
ALTER TABLE public.call_signals DROP CONSTRAINT IF EXISTS call_signals_signal_type_check;
ALTER TABLE public.call_signals ADD CONSTRAINT call_signals_signal_type_check 
  CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'hangup', 'screen-share-start', 'screen-share-stop', 'audio-state-change', 'video-state-change', 'rejected', 'busy'));
