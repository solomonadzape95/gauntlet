/**
 * Thin typed wrapper around the API-Football REST endpoints we use.
 *
 * Every call goes through a Cache (Section 4.5 of the Day-5 plan). The
 * client itself is dumb: it builds the URL, sends the key header, parses
 * JSON. Caching, retries, and refresh policy live in the caller.
 *
 * Endpoint docs: https://www.api-football.com/documentation-v3
 */

import type { Cache } from "./cache";
import { TTL } from "./ttl";

const BASE = "https://v3.football.api-sports.io";

export interface ApiFootballConfig {
  apiKey: string;
  cache: Cache;
  refetchAll?: boolean;
  refetchByEndpoint?: Partial<Record<EndpointName, boolean>>;
}

export type EndpointName = "teams" | "fixtures" | "squads" | "players";

interface ApiFootballEnvelope<T> {
  response: T[];
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
}

export interface ApiTeam {
  team: { id: number; name: string; code?: string; country: string; logo?: string };
  venue?: { id: number; name: string; city: string };
}

export interface ApiFixture {
  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
    venue: { id: number; name: string; city: string };
    status: { long: string; short: string };
  };
  league: { id: number; name: string; country: string; season: number };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  score?: unknown;
}

export interface ApiSquadPlayer {
  id: number;
  name: string;
  age: number;
  number: number | null;
  position: string; // "Goalkeeper" | "Defender" | "Midfielder" | "Attacker"
  photo?: string;
}

export interface ApiSquadResponse {
  team: { id: number; name: string; logo?: string };
  players: ApiSquadPlayer[];
}

export interface ApiPlayer {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    nationality?: string;
    height?: string;
    weight?: string;
    photo?: string;
  };
  statistics?: Array<{
    team?: { id: number; name: string };
    league?: { id: number; name: string; season: number };
  }>;
}

export class ApiFootballClient {
  constructor(private cfg: ApiFootballConfig) {}

  private shouldRefetch(endpoint: EndpointName): boolean {
    if (this.cfg.refetchAll) return true;
    return Boolean(this.cfg.refetchByEndpoint?.[endpoint]);
  }

  private async get<T>(endpointPath: string, params: Record<string, string | number>): Promise<T> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) query.set(k, String(v));
    const url = `${BASE}${endpointPath}?${query.toString()}`;
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": this.cfg.apiKey,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API-Football ${res.status} on ${endpointPath}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as ApiFootballEnvelope<T>;
    if (json.errors && typeof json.errors === "object" && Object.keys(json.errors).length > 0) {
      throw new Error(`API-Football errors on ${endpointPath}: ${JSON.stringify(json.errors)}`);
    }
    // Most endpoints return { response: [...] }. We let callers decide whether to
    // take response[0] or the whole array.
    return json.response as unknown as T;
  }

  /** Resolve a team by name + country (more reliable than hardcoded IDs). */
  async teams(args: { name: string; country?: string }): Promise<ApiTeam[]> {
    const key = `teams/${slug(args.name)}-${slug(args.country ?? "any")}.json`;
    const { data } = await this.cfg.cache.fetchWithCache<ApiTeam[]>({
      key,
      ttlSeconds: TTL.teams,
      refetch: this.shouldRefetch("teams"),
      fetcher: () =>
        this.get<ApiTeam[]>("/teams", {
          name: args.name,
          ...(args.country ? { country: args.country } : {}),
        }),
    });
    return data;
  }

  /** Fixtures for a given league/season/team/date window. */
  async fixtures(args: {
    league?: number;
    season?: number;
    team?: number;
    from?: string;
    to?: string;
    id?: number;
  }): Promise<ApiFixture[]> {
    const queryParts = Object.entries(args)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
    const key = `fixtures/${hashShort(queryParts)}.json`;
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) params[k] = v as string | number;
    }
    const { data } = await this.cfg.cache.fetchWithCache<ApiFixture[]>({
      key,
      ttlSeconds: TTL.fixtures,
      refetch: this.shouldRefetch("fixtures"),
      fetcher: () => this.get<ApiFixture[]>("/fixtures", params),
    });
    return data;
  }

  /** Current squad for a team. */
  async squad(args: { team: number }): Promise<ApiSquadResponse | null> {
    const key = `squads/team-${args.team}.json`;
    const { data } = await this.cfg.cache.fetchWithCache<ApiSquadResponse[]>({
      key,
      ttlSeconds: TTL.squads,
      refetch: this.shouldRefetch("squads"),
      fetcher: () => this.get<ApiSquadResponse[]>("/players/squads", { team: args.team }),
    });
    return data[0] ?? null;
  }

  /** Player profile by id (used as a fallback for missing fields on squad endpoint). */
  async player(args: { id: number; season: number }): Promise<ApiPlayer | null> {
    const key = `players/${args.id}-${args.season}.json`;
    const { data } = await this.cfg.cache.fetchWithCache<ApiPlayer[]>({
      key,
      ttlSeconds: TTL.players,
      refetch: this.shouldRefetch("players"),
      fetcher: () => this.get<ApiPlayer[]>("/players", { id: args.id, season: args.season }),
    });
    return data[0] ?? null;
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tiny non-crypto hash so cache keys for compound queries stay short and stable. */
function hashShort(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
