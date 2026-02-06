-- Enable RLS
alter table if exists public.call_sessions enable row level security;
alter table if exists public.call_signals enable row level security;

-- Create call_sessions table if not exists
create table if not exists public.call_sessions (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) not null,
  caller_id uuid references public.profiles(id) not null,
  callee_id uuid references public.profiles(id) not null,
  status text not null default 'initiating', -- initiating, ringing, connected, ended, rejected, busy
  call_type text not null default 'audio', -- audio, video
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz default now()
);

-- Create call_signals table if not exists
create table if not exists public.call_signals (
  id uuid default gen_random_uuid() primary key,
  call_id uuid references public.call_sessions(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  signal_type text not null, -- offer, answer, ice-candidate, hangup, screen-share-start, screen-share-stop
  signal_data jsonb not null,
  created_at timestamptz default now()
);

-- RLS Policies for call_sessions
create policy "Users can view their own calls"
  on public.call_sessions for select
  using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "Users can insert calls they initiate"
  on public.call_sessions for insert
  with check (auth.uid() = caller_id);

create policy "Users can update their own calls"
  on public.call_sessions for update
  using (auth.uid() = caller_id or auth.uid() = callee_id);

-- RLS Policies for call_signals
create policy "Users can view signals for their calls"
  on public.call_signals for select
  using (
    exists (
      select 1 from public.call_sessions
      where id = call_signals.call_id
      and (caller_id = auth.uid() or callee_id = auth.uid())
    )
  );

create policy "Users can insert signals for their calls"
  on public.call_signals for insert
  with check (
    exists (
      select 1 from public.call_sessions
      where id = call_signals.call_id
      and (caller_id = auth.uid() or callee_id = auth.uid())
    )
    and auth.uid() = sender_id
  );

-- Indexes for performance
create index if not exists idx_call_sessions_caller on public.call_sessions(caller_id);
create index if not exists idx_call_sessions_callee on public.call_sessions(callee_id);
create index if not exists idx_call_sessions_status on public.call_sessions(status);
create index if not exists idx_call_signals_call_id on public.call_signals(call_id);
