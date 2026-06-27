import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Inbox, Mic, Radio, Search, ShieldAlert, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import apiClient from '../api/client';
import { formatDateTime, type TimestampValue } from '../utils/datetime';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type ActivityTab = "members" | "voice" | "presence" | "audit" | "sessions";

interface PresenceSession {
  start: string;
  end: string | null;
  durationMs: number | null;
}

interface MemberEvent {
  id: number;
  guildId: string;
  userId: string;
  eventType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: TimestampValue;
  username?: string | null;
  avatarUrl?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
}

interface VoiceEvent {
  id: number;
  guildId: string;
  userId: string;
  channelId?: string | null;
  eventType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: TimestampValue;
  username?: string | null;
  avatarUrl?: string | null;
  channelName?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
}

interface PresenceEvent {
  id: number;
  guildId?: string | null;
  userId: string;
  status?: string | null;
  clientStatus?: string | null;
  updatedAt: TimestampValue;
  username?: string | null;
  avatarUrl?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
}

interface AuditEvent {
  id: number;
  guildId: string;
  actionType: string;
  targetId?: string | null;
  targetType?: string | null;
  userId?: string | null;
  reason?: string | null;
  changesJson?: string | null;
  createdAt: TimestampValue;
  actorUsername?: string | null;
  actorAvatarUrl?: string | null;
  targetChannelName?: string | null;
  targetUsername?: string | null;
  targetRoleName?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
}

export default function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as ActivityTab) || "members";
  const [members, setMembers] = useState<MemberEvent[]>([]);
  const [voice, setVoice] = useState<VoiceEvent[]>([]);
  const [presence, setPresence] = useState<PresenceEvent[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<PresenceSession[]>([]);
  const [sessionUserId, setSessionUserId] = useState('');
  const [sessionUserIdInput, setSessionUserIdInput] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [mRes, vRes, pRes, aRes] = await Promise.all([
          apiClient
            .get<MemberEvent[]>("/activity/member-events?limit=50")
            .catch(() => ({ data: [] })),
          apiClient
            .get<VoiceEvent[]>("/activity/voice?limit=50")
            .catch(() => ({ data: [] })),
          apiClient
            .get<PresenceEvent[]>("/activity/presence?limit=50")
            .catch(() => ({ data: [] })),
          apiClient
            .get<AuditEvent[]>("/activity/audit?limit=50")
            .catch(() => ({ data: [] })),
        ]);
        setMembers(mRes.data);
        setVoice(vRes.data);
        setPresence(pRes.data);
        setAudit(aRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const fetchSessions = async (input: string) => {
    if (!input.trim()) return;
    setSessionsLoading(true);
    try {
      let userId = input.trim();
      // If it doesn't look like a snowflake ID, search by username first
      if (!/^\d{15,20}$/.test(userId)) {
        try {
          const searchRes = await apiClient.get<{ data: { id: string }[] }>(`/users?search=${encodeURIComponent(userId)}&limit=1`);
          const found = searchRes.data?.data?.[0];
          if (found) userId = found.id;
          else { setSessions([]); setSessionUserId(input.trim()); return; }
        } catch {
          setSessions([]); setSessionUserId(input.trim()); return;
        }
      }
      const res = await apiClient.get<PresenceSession[]>(`/activity/presence/sessions?userId=${encodeURIComponent(userId)}&limit=100`);
      setSessions(res.data);
      setSessionUserId(userId);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Activity Explorer
        </h1>
        <p className="text-sm text-muted-foreground">
          Track member joins, voice events, presence updates, and audit actions
          across guilds.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="members" className="gap-1.5 text-sm">
            <Users className="size-3.5" />
            Members
            {!loading && <CountPill count={members.length} />}
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5 text-sm">
            <Mic className="size-3.5" />
            Voice
            {!loading && <CountPill count={voice.length} />}
          </TabsTrigger>
          <TabsTrigger value="presence" className="gap-1.5 text-sm">
            <Radio className="size-3.5" />
            Presence
            {!loading && <CountPill count={presence.length} />}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-sm">
            <ShieldAlert className="size-3.5" />
            Guild Audit
            {!loading && <CountPill count={audit.length} />}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5 text-sm">
            <Clock className="size-3.5" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MemberTable data={members} loading={loading} />
        </TabsContent>
        <TabsContent value="voice" className="mt-4">
          <VoiceTable data={voice} loading={loading} />
        </TabsContent>
        <TabsContent value="presence" className="mt-4">
          <PresenceTable data={presence} loading={loading} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTable data={audit} loading={loading} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsPanel
            sessions={sessions}
            loading={sessionsLoading}
            userIdInput={sessionUserIdInput}
            onUserIdInputChange={setSessionUserIdInput}
            onSearch={() => fetchSessions(sessionUserIdInput)}
            activeUserId={sessionUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────

function CountPill({ count }: { count: number }) {
  return (
    <span className="ml-0.5 rounded-full bg-background px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground shadow-sm">
      {count}
    </span>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4 flex-1"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
      <Inbox className="size-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function eventVariant(
  type: string,
): "default" | "secondary" | "destructive" | "outline" {
  const lower = type.toLowerCase();
  if (/join|create|add|connect|grant/.test(lower)) return "default";
  if (/leave|remove|delete|ban|kick|disconnect|prune/.test(lower))
    return "destructive";
  return "secondary";
}

function StatusDot({ status }: { status?: string | null }) {
  const colorMap: Record<string, string> = {
    online: "bg-emerald-500",
    idle: "bg-amber-500",
    dnd: "bg-red-500",
  };
  const color = colorMap[status ?? ""] ?? "bg-muted-foreground/40";
  return (
    <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />
  );
}

function GuildCell({
  guildId,
  guildName,
  guildIconUrl,
}: {
  guildId: string;
  guildName?: string | null;
  guildIconUrl?: string | null;
}) {
  if (!guildName) {
    return (
      <span className="truncate text-sm text-muted-foreground">{guildId}</span>
    );
  }

  const fallback = guildName.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={guildIconUrl ?? undefined} alt={guildName} />
        <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{guildName}</span>
    </div>
  );
}

function UserCell({
  userId,
  username,
  avatarUrl,
}: {
  userId: string;
  username?: string | null;
  avatarUrl?: string | null;
}) {
  if (!username) {
    return (
      <span className="truncate text-sm text-muted-foreground">{userId}</span>
    );
  }

  const displayName = `@${username}`;
  const fallback = displayName.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
      </Avatar>
      <Link
        to={`/users/${userId}`}
        className="truncate text-sm font-medium hover:underline"
      >
        {displayName}
      </Link>
    </div>
  );
}

// ─── Table panels ───────────────────────────────────────────────────────────────

function MemberTable({
  data,
  loading,
}: {
  data: MemberEvent[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Member Events</CardTitle>
        <CardDescription>
          Join, leave, role, and nickname changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={4} />
        ) : data.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState message="No member events found." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Guild</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge
                      variant={eventVariant(row.eventType)}
                      className="text-xs font-medium"
                    >
                      {row.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserCell
                      userId={row.userId}
                      username={row.username}
                      avatarUrl={row.avatarUrl}
                    />
                  </TableCell>
                  <TableCell>
                    <GuildCell
                      guildId={row.guildId}
                      guildName={row.guildName}
                      guildIconUrl={row.guildIconUrl}
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function VoiceTable({
  data,
  loading,
}: {
  data: VoiceEvent[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Voice Events</CardTitle>
        <CardDescription>
          Channel joins, leaves, and state changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={4} />
        ) : data.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState message="No voice events found." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge
                      variant={eventVariant(row.eventType)}
                      className="text-xs font-medium"
                    >
                      {row.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserCell
                      userId={row.userId}
                      username={row.username}
                      avatarUrl={row.avatarUrl}
                    />
                  </TableCell>
                  <TableCell>
                    <GuildCell
                      guildId={row.guildId}
                      guildName={row.guildName}
                      guildIconUrl={row.guildIconUrl}
                    />
                  </TableCell>
                  <TableCell>
                    {row.channelName ? (
                      <span className="text-sm font-medium">{row.channelName}</span>
                    ) : row.channelId ? (
                      <span className="text-sm text-muted-foreground">{row.channelId}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PresenceTable({
  data,
  loading,
}: {
  data: PresenceEvent[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Presence Updates</CardTitle>
        <CardDescription>
          Online status and client state changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={4} />
        ) : data.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState message="No presence updates found." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      userId={row.userId}
                      username={row.username}
                      avatarUrl={row.avatarUrl}
                    />
                  </TableCell>
                  <TableCell>
                    {row.guildId ? (
                      <GuildCell
                        guildId={row.guildId}
                        guildName={row.guildName}
                        guildIconUrl={row.guildIconUrl}
                      />
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot status={row.status} />
                      <span className="text-sm capitalize">
                        {row.status ?? "offline"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.clientStatus ?? (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function summarizeChanges(changesJson?: string | null): string | null {
  if (!changesJson) return null;
  try {
    const changes = JSON.parse(changesJson) as Record<string, { old?: unknown; new?: unknown }>;
    return Object.entries(changes)
      .map(([field, val]) => {
        const o = val?.old;
        const n = val?.new;
        if (o !== undefined && n !== undefined) return `${field}: "${String(o)}" → "${String(n)}"`;
        if (n !== undefined) return `${field}: "${String(n)}"`;
        if (o !== undefined) return `${field}: removed "${String(o)}"`;
        return field;
      })
      .join(' · ');
  } catch {
    return null;
  }
}

function AuditTarget({ row }: { row: AuditEvent }) {
  const channelName = row.targetChannelName;
  const username = row.targetUsername;
  const roleName = row.targetRoleName;
  const changesSummary = summarizeChanges(row.changesJson);

  const label = channelName
    ? `#${channelName}`
    : username
      ? `@${username}`
      : roleName
        ? `@${roleName}`
        : row.targetId
          ? row.targetId.slice(-8)
          : null;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {label ? (
        <span className="text-sm font-medium truncate">{label}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
      {changesSummary && (
        <span className="text-xs text-muted-foreground truncate max-w-[220px]" title={changesSummary}>
          {changesSummary}
        </span>
      )}
      {row.reason && (
        <span className="text-xs text-muted-foreground/70 italic truncate max-w-[220px]">
          {row.reason}
        </span>
      )}
    </div>
  );
}

function AuditTable({
  data,
  loading,
}: {
  data: AuditEvent[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Guild Audit Log</CardTitle>
        <CardDescription>
          Administrative actions and permission changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={4} />
        ) : data.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState message="No audit events found." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Target / Changes</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge
                      variant={eventVariant(row.actionType)}
                      className="text-xs font-medium"
                    >
                      {row.actionType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <GuildCell
                      guildId={row.guildId}
                      guildName={row.guildName}
                      guildIconUrl={row.guildIconUrl}
                    />
                  </TableCell>
                  <TableCell>
                    {row.userId ? (
                      <UserCell
                        userId={row.userId}
                        username={row.actorUsername}
                        avatarUrl={row.actorAvatarUrl}
                      />
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AuditTarget row={row} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sessions Panel ──────────────────────────────────────────────────────────

function formatSessionDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SessionsPanel({
  sessions,
  loading,
  userIdInput,
  onUserIdInputChange,
  onSearch,
  activeUserId,
}: {
  sessions: PresenceSession[];
  loading: boolean;
  userIdInput: string;
  onUserIdInputChange: (v: string) => void;
  onSearch: () => void;
  activeUserId: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Presence Sessions</CardTitle>
        <CardDescription>Online/offline session history for a specific user.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Username or User ID..."
            value={userIdInput}
            onChange={(e) => onUserIdInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            className="max-w-xs"
          />
          <button
            onClick={onSearch}
            disabled={loading || !userIdInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Search className="size-3.5" />
            Search
          </button>
        </div>

        {!activeUserId && (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
            <Clock className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Enter a username or user ID to view their presence sessions.</p>
          </div>
        )}

        {activeUserId && loading && <TableSkeleton cols={3} />}

        {activeUserId && !loading && sessions.length === 0 && (
          <div className="px-2">
            <EmptyState message="No presence sessions found for this user." />
          </div>
        )}

        {activeUserId && !loading && sessions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {new Date(s.start).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {s.end ? (
                      new Date(s.end).toLocaleString()
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        Still online
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.durationMs != null ? formatSessionDuration(s.durationMs) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
