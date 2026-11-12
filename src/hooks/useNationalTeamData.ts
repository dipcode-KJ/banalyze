import { useEffect, useState } from "react";

export type NationalTeamStats = {
  points: number;
  threePointMakes: number;
  threePointAttempts: number;
  twoPointMakes: number;
  twoPointAttempts: number;
  freeThrowMakes: number;
  freeThrowAttempts: number;
  rebounds: number;
  offensiveRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
};

export type NationalTeamGame = {
  id: number;
  date: string;
  tipoffTime: string | null;
  competition: string;
  status: string;
  venue: string;
  opponent: string;
  japanScore: number;
  opponentScore: number;
  result: "W" | "L" | "D";
  japanSide: "home" | "away";
  periods: Array<{ label: string; japan: number; opponent: number }>;
  japanStats: NationalTeamStats;
  opponentStats: NationalTeamStats;
  sourceUrl: string;
  sourceProvider: string;
  updatedAt: string;
};

export type NationalTeamPlayer = {
  gameId: number;
  team: string;
  isJapan: boolean;
  number: string;
  name: string;
  starter: boolean;
  points: number;
  threePointMakes: number;
  threePointAttempts: number;
  twoPointMakes: number;
  twoPointAttempts: number;
  freeThrowMakes: number;
  freeThrowAttempts: number;
  rebounds: number;
  offensiveRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  minutes: string | null;
  didNotPlay: boolean;
};

export type NationalTeamLeader = {
  name: string;
  games: number;
  points: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  steals: number;
  turnovers: number;
  threePointMakes: number;
  threePointAttempts: number;
  minutes: string | null;
};

export type NationalTeamSummary = {
  games: number;
  wins: number;
  losses: number;
  averagePoints: number;
  averageAllowed: number;
  threePointPercentage: number;
  averageAssists: number;
  averageRebounds: number;
  averageTurnovers: number;
};

export type NationalTeamPayload = {
  source: "db" | "empty";
  updatedAt: string | null;
  summary: NationalTeamSummary;
  games: NationalTeamGame[];
  players: NationalTeamPlayer[];
  playerLeaders: NationalTeamLeader[];
};

const emptyPayload: NationalTeamPayload = {
  source: "empty",
  updatedAt: null,
  summary: {
    games: 0,
    wins: 0,
    losses: 0,
    averagePoints: 0,
    averageAllowed: 0,
    threePointPercentage: 0,
    averageAssists: 0,
    averageRebounds: 0,
    averageTurnovers: 0,
  },
  games: [],
  players: [],
  playerLeaders: [],
};

export function useNationalTeamData(initialData?: NationalTeamPayload | null) {
  const [data, setData] = useState<NationalTeamPayload>(initialData ?? emptyPayload);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/national-team.php?limit=100", { cache: "no-store" });
        if (!response.ok) throw new Error("National team API request failed");
        const payload = (await response.json()) as NationalTeamPayload;
        if (!cancelled) {
          setData(payload);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, error };
}
