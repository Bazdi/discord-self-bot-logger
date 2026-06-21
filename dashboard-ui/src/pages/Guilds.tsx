import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users } from 'lucide-react';
import apiClient from '../api/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface GuildItem {
  id: string;
  name: string;
  icon?: string | null;
  messageCount: number;
  memberCount: number;
}

export default function Guilds() {
  const [guilds, setGuilds] = useState<GuildItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<GuildItem[]>('/guilds')
      .then((res) => setGuilds(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Servers</h1>
        <p className="text-sm text-muted-foreground">
          Browse all tracked Discord servers and their message history.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      ) : guilds.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">No servers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guilds.map((guild) => {
            const initials = guild.name.slice(0, 2).toUpperCase();
            return (
              <Link key={guild.id} to={`/guilds/${guild.id}`}>
                <Card
                  className={`h-full cursor-pointer transition-all hover:border-muted-foreground/40 hover:shadow-sm ${
                    guild.messageCount === 0 ? 'opacity-60' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0 rounded-xl">
                        {guild.icon ? (
                          <AvatarImage
                            src={guild.icon}
                            alt={guild.name}
                            className="rounded-xl object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="rounded-xl text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{guild.name}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3 shrink-0" />
                            {guild.memberCount.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3 shrink-0" />
                            {guild.messageCount === 0
                              ? 'not tracked'
                              : guild.messageCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
