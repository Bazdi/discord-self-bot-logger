import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCheck, Loader2, Play, Plus, Square, X } from 'lucide-react';
import apiClient from '../api/client';
import { GuildPicker } from '../components/GuildPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface GuildItem {
  id: string;
  name: string;
  icon?: string | null;
  messageCount: number;
  memberCount: number;
}

interface ChannelProgress {
  channelId: string;
  channelName: string | null;
  fetched: number;
  done: boolean;
}

interface GuildProgress {
  guildId: string;
  guildName: string;
  channels: ChannelProgress[];
  fetched: number;
  done: boolean;
  startedAt: number;
  elapsedMs: number;
}

interface BackfillStatus {
  running: boolean;
  startedAt: number | null;
  elapsedMs: number | null;
  totalFetched: number;
  currentGuild: string | null;
  currentChannel: string | null;
  guilds: GuildProgress[];
  stoppedEarly: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function Setup() {
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState<GuildItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Manual guild ID input
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Backfill settings
  const [perRequest, setPerRequest] = useState(100);
  const [delayMs, setDelayMs] = useState(1500);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Which guilds to backfill: null = all tracked, Set = specific selection
  const [backfillAll, setBackfillAll] = useState(true);
  const [backfillSelected, setBackfillSelected] = useState<Set<string>>(new Set());

  // Live backfill status
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  // Poll status every 2s while running
  useEffect(() => {
    if (!backfillStatus?.running) return;
    const id = setInterval(async () => {
      try {
        const res = await apiClient.get<BackfillStatus>('/backfill/status');
        setBackfillStatus(res.data);
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [backfillStatus?.running]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [guildsRes, configRes, statusRes] = await Promise.all([
          apiClient.get<GuildItem[]>('/guilds'),
          apiClient.get<{ logging?: { guilds?: string[]; backfill?: { perRequest?: number; delayMs?: number } } }>('/config'),
          apiClient.get<BackfillStatus>('/backfill/status'),
        ]);
        setGuilds(guildsRes.data);
        const active = new Set(configRes.data.logging?.guilds ?? []);
        setSelected(active);
        const bf = configRes.data.logging?.backfill;
        if (bf?.perRequest) setPerRequest(bf.perRequest);
        if (bf?.delayMs !== undefined) setDelayMs(bf.delayMs);
        setBackfillStatus(statusRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const persistSelection = async (nextSelected: Set<string>) => {
    setSaveError(null);
    try {
      await apiClient.post('/config/guilds', { guildIds: Array.from(nextSelected) });
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save guild selection');
      throw err;
    }
  };

  const toggleGuild = async (id: string) => {
    const previous = new Set(selected);
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    try {
      await persistSelection(next);
    } catch {
      setSelected(previous);
    }
  };

  const manualIds = Array.from(selected).filter((id) => !guilds.some((g) => g.id === id));

  const addManualId = async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) { setManualError('Please enter a guild ID'); return; }
    if (selected.has(trimmed)) { setManualError('This guild ID is already in the whitelist'); return; }
    if (!/^\d{17,20}$/.test(trimmed)) { setManualError('Invalid guild ID format (expected 17-20 digits)'); return; }
    const previous = new Set(selected);
    const next = new Set(previous);
    next.add(trimmed);
    const previousInput = manualInput;
    setSelected(next);
    setManualInput('');
    setManualError(null);
    try {
      await persistSelection(next);
    } catch {
      setSelected(previous);
      setManualInput(previousInput);
    }
  };

  const removeManualId = async (id: string) => {
    const previous = new Set(selected);
    const next = new Set(previous);
    next.delete(id);
    setSelected(next);
    try {
      await persistSelection(next);
    } catch {
      setSelected(previous);
    }
  };

  const selectedGuildCount = guilds.filter((g) => selected.has(g.id)).length;

  const selectAll = async () => {
    const previous = new Set(selected);
    const next = new Set(selected);
    for (const g of guilds) next.add(g.id);
    setSelected(next);
    try { await persistSelection(next); } catch { setSelected(previous); }
  };

  const deselectAll = async () => {
    const previous = new Set(selected);
    const guildIds = new Set(guilds.map((g) => g.id));
    const next = new Set(Array.from(selected).filter((id) => !guildIds.has(id)));
    setSelected(next);
    try { await persistSelection(next); } catch { setSelected(previous); }
  };

  const saveBackfillSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await apiClient.patch('/backfill/settings', { perRequest, delayMs });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err: any) {
      setBackfillError(err?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const startBackfill = async () => {
    setBackfillError(null);
    try {
      const guildIds = backfillAll ? undefined : Array.from(backfillSelected);
      await apiClient.post('/backfill/start', { guildIds });
      const res = await apiClient.get<BackfillStatus>('/backfill/status');
      setBackfillStatus(res.data);
    } catch (err: any) {
      setBackfillError(err?.response?.data?.error || 'Failed to start backfill');
    }
  };

  const stopBackfill = async () => {
    try {
      await apiClient.post('/backfill/stop');
    } catch {}
  };

  const toggleBackfillGuild = (id: string) => {
    const next = new Set(backfillSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBackfillSelected(next);
  };

  const trackedGuilds = guilds.filter((g) => selected.has(g.id));

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guild Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select which guilds to monitor. Only selected guilds will be logged.
          </p>
        </div>
        <Button onClick={() => navigate('/')} size="sm" className="gap-2 shrink-0">
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Save status banner */}
      {saveError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <X className="size-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{saveError}</p>
        </div>
      )}

      {/* Manual guild ID input */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Add Guild by ID</h2>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Enter Discord guild ID..."
            value={manualInput}
            onChange={(e) => { setManualInput(e.target.value); setManualError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualId(); } }}
            className="max-w-sm"
          />
          <Button onClick={addManualId} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add to whitelist
          </Button>
        </div>
        {manualError && <p className="text-xs text-destructive">{manualError}</p>}
        {manualIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {manualIds.map((id) => (
              <div key={id} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-mono">
                {id}
                <button onClick={() => removeManualId(id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={`Remove ${id}`}>
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk selection controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Available Guilds
          <span className="ml-1 font-normal text-muted-foreground">
            · {selectedGuildCount} of {guilds.length} selected
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={selectAll} size="sm" variant="outline" className="gap-1.5" disabled={loading || guilds.length === 0 || selectedGuildCount === guilds.length}>
            <CheckCheck className="size-4" />
            Select all
          </Button>
          <Button onClick={deselectAll} size="sm" variant="outline" className="gap-1.5" disabled={loading || selectedGuildCount === 0}>
            <X className="size-4" />
            Deselect all
          </Button>
        </div>
      </div>

      {/* Guild picker grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : (
        <GuildPicker guilds={guilds} selected={selected} onToggle={toggleGuild} />
      )}

      {/* ── History Backfill ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">History Backfill</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fetch past messages from Discord into the database.
          </p>
        </div>

        <div className="p-4 space-y-5">
          {/* ToS warning */}
          <div className="flex gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertTriangle className="size-4 shrink-0 text-yellow-500 mt-0.5" />
            <p className="text-xs text-yellow-200/80">
              Mass-fetching message history violates Discord's Terms of Service.
              Use only on servers you own or with explicit permission. Your account may be banned.
            </p>
          </div>

          {/* Settings row */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rate limiting</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Messages per batch (1–100)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={perRequest}
                  onChange={(e) => setPerRequest(Number(e.target.value))}
                  className="w-32"
                  disabled={backfillStatus?.running}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Delay between batches (ms)</label>
                <Input
                  type="number"
                  min={0}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  className="w-36"
                  disabled={backfillStatus?.running}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={saveBackfillSettings}
                disabled={savingSettings || backfillStatus?.running}
                className="gap-1.5"
              >
                {savingSettings ? <Loader2 className="size-3 animate-spin" /> : null}
                {settingsSaved ? 'Saved!' : 'Save settings'}
              </Button>
            </div>
          </div>

          {/* Server selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Servers to backfill</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="backfillScope"
                  checked={backfillAll}
                  onChange={() => setBackfillAll(true)}
                  disabled={backfillStatus?.running}
                  className="accent-primary"
                />
                <span className="text-sm">All tracked servers ({trackedGuilds.length})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="backfillScope"
                  checked={!backfillAll}
                  onChange={() => setBackfillAll(false)}
                  disabled={backfillStatus?.running}
                  className="accent-primary"
                />
                <span className="text-sm">Specific servers</span>
              </label>
            </div>

            {!backfillAll && (
              <div className="ml-5 mt-2 flex flex-wrap gap-2">
                {trackedGuilds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tracked servers yet.</p>
                ) : (
                  trackedGuilds.map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={backfillSelected.has(g.id)}
                        onChange={() => toggleBackfillGuild(g.id)}
                        disabled={backfillStatus?.running}
                        className="accent-primary"
                      />
                      {g.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {backfillError && (
            <p className="text-xs text-destructive">{backfillError}</p>
          )}

          {/* Start / Stop */}
          <div>
            {backfillStatus?.running ? (
              <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-2">
                <Square className="size-3 fill-current" />
                Stop backfill
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={startBackfill}
                disabled={!backfillAll && backfillSelected.size === 0}
                className="gap-2"
              >
                <Play className="size-3 fill-current" />
                Start backfill
              </Button>
            )}
          </div>

          {/* Progress */}
          {backfillStatus && (backfillStatus.running || backfillStatus.totalFetched > 0) && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              {/* Summary line */}
              <div className="flex items-center gap-2 flex-wrap">
                {backfillStatus.running ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Running
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    {backfillStatus.stoppedEarly ? 'Stopped early' : 'Completed'}
                  </span>
                )}
                {backfillStatus.elapsedMs != null && (
                  <span className="text-xs text-muted-foreground">· {formatDuration(backfillStatus.elapsedMs)}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  · {backfillStatus.totalFetched.toLocaleString()} messages fetched
                </span>
              </div>

              {/* Current position */}
              {backfillStatus.running && backfillStatus.currentGuild && (
                <p className="text-xs text-muted-foreground">
                  Currently:{' '}
                  <span className="text-foreground font-medium">{backfillStatus.currentGuild}</span>
                  {backfillStatus.currentChannel && (
                    <> → <span className="text-foreground">#{backfillStatus.currentChannel}</span></>
                  )}
                </p>
              )}

              {/* Per-guild table */}
              {backfillStatus.guilds.length > 0 && (
                <div className="space-y-1.5">
                  {backfillStatus.guilds.map((g) => (
                    <div key={g.guildId} className="flex items-center gap-3">
                      <span className="w-3 shrink-0 text-center text-xs">
                        {g.done ? '✓' : <Loader2 className="size-3 animate-spin inline" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{g.guildName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {g.fetched.toLocaleString()} msgs
                      </span>
                      {g.done && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDuration(g.elapsedMs)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
