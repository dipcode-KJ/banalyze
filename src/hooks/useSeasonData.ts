import { useEffect, useMemo, useState } from "react";
import {
  advancedStatsBySeason,
  seasons,
  type AdvancedRankingMetric,
  type AdvancedRankingRecord,
  type GameResult,
  type SeasonKey,
  type TeamAdvancedStats,
  type TeamRecord,
} from "../data/mockStats";

type ApiTeamRecord = Omit<TeamRecord, "lastFive"> & {
  lastFive?: Array<"W" | "L">;
};

export type DivisionFilter = "ALL" | "B1" | "B2";
export type DataSourceState = "loading" | "db" | "mock";
export type SeasonSeries = Record<SeasonKey, TeamRecord[]>;
export type AdvancedStatsMap = Record<string, TeamAdvancedStats>;

export function useSeasonData(selectedSeason: SeasonKey, selectedDivision: DivisionFilter = "ALL") {
  const fallback = useMemo(
    () => filterFallback(seasons.find((season) => season.label === selectedSeason) ?? seasons[0], selectedDivision),
    [selectedDivision, selectedSeason],
  );
  const [teams, setTeams] = useState<TeamRecord[]>(fallback.teams);
  const [recentGames, setRecentGames] = useState<GameResult[]>(fallback.recentGames);
  const [source, setSource] = useState<DataSourceState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ season: selectedSeason });
        if (selectedDivision !== "ALL") {
          params.set("division", selectedDivision);
        }

        const [teamResponse, gameResponse] = await Promise.all([
          fetch(`/api/team-records.php?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/recent-games.php?${params.toString()}&limit=24`, { cache: "no-store" }),
        ]);

        if (!teamResponse.ok || !gameResponse.ok) {
          throw new Error("API request failed");
        }

        const teamPayload = (await teamResponse.json()) as { records?: ApiTeamRecord[] };
        const gamePayload = (await gameResponse.json()) as { games?: GameResult[] };

        if (cancelled) return;

        const apiTeams = (teamPayload.records ?? []).map(normalizeTeam);
        const apiGames = (gamePayload.games ?? []).map(normalizeGame);

        if (apiTeams.length > 0) {
          setTeams(apiTeams);
          setRecentGames(apiGames);
          setSource("db");
        } else {
          setTeams(fallback.teams);
          setRecentGames(fallback.recentGames);
          setSource("mock");
        }
      } catch {
        if (cancelled) return;
        setTeams(fallback.teams);
        setRecentGames(fallback.recentGames);
        setSource("mock");
      }
    }

    setTeams(fallback.teams);
    setRecentGames(fallback.recentGames);
    setSource("loading");
    void load();

    return () => {
      cancelled = true;
    };
  }, [fallback, selectedDivision, selectedSeason]);

  return { teams, recentGames, source };
}

export function useSeasonSeries(selectedDivision: DivisionFilter = "ALL") {
  const fallback = useMemo(
    () =>
      seasons.reduce((series, season) => {
        series[season.label] = filterFallback(season, selectedDivision).teams;
        return series;
      }, {} as SeasonSeries),
    [selectedDivision],
  );
  const [series, setSeries] = useState<SeasonSeries>(fallback);
  const [source, setSource] = useState<DataSourceState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const entries = await Promise.all(
          seasons.map(async ({ label }) => {
            const params = new URLSearchParams({ season: label });
            if (selectedDivision !== "ALL") {
              params.set("division", selectedDivision);
            }

            const response = await fetch(`/api/team-records.php?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) {
              throw new Error("API request failed");
            }

            const payload = (await response.json()) as { records?: ApiTeamRecord[] };
            return [label, (payload.records ?? []).map(normalizeTeam)] as const;
          }),
        );

        if (cancelled) return;

        const nextSeries = entries.reduce((acc, [label, records]) => {
          acc[label] = records.length > 0 ? records : fallback[label];
          return acc;
        }, {} as SeasonSeries);

        setSeries(nextSeries);
        setSource(entries.some(([, records]) => records.length > 0) ? "db" : "mock");
      } catch {
        if (cancelled) return;
        setSeries(fallback);
        setSource("mock");
      }
    }

    setSeries(fallback);
    setSource("loading");
    void load();

    return () => {
      cancelled = true;
    };
  }, [fallback, selectedDivision]);

  return { series, source };
}

export function useTeamAdvancedStats(selectedSeason: SeasonKey, selectedDivision: DivisionFilter = "ALL") {
  const fallback = useMemo(() => buildAdvancedStatsMap(selectedSeason, selectedDivision), [selectedDivision, selectedSeason]);
  const [stats, setStats] = useState<AdvancedStatsMap>(fallback);
  const [source, setSource] = useState<DataSourceState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ season: selectedSeason });
        if (selectedDivision !== "ALL") {
          params.set("division", selectedDivision);
        }

        const response = await fetch(`/api/team-advanced-stats.php?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("API request failed");
        }

        const payload = (await response.json()) as { records?: TeamAdvancedStats[] };
        const records = payload.records ?? [];
        if (cancelled) return;

        if (records.length > 0) {
          setStats(
            records.reduce((acc, record) => {
              acc[record.teamId] = normalizeAdvancedStats(record);
              return acc;
            }, {} as AdvancedStatsMap),
          );
          setSource("db");
        } else {
          setStats(fallback);
          setSource("mock");
        }
      } catch {
        if (cancelled) return;
        setStats(fallback);
        setSource("mock");
      }
    }

    setStats(fallback);
    setSource("loading");
    void load();

    return () => {
      cancelled = true;
    };
  }, [fallback, selectedDivision, selectedSeason]);

  return { stats, source };
}

export function useAdvancedRankings(
  selectedSeason: SeasonKey,
  selectedDivision: DivisionFilter = "ALL",
  metric: AdvancedRankingMetric = "three_point_percentage",
  limit = 10,
) {
  const fallback = useMemo(
    () => buildAdvancedRankingFallback(selectedSeason, selectedDivision, metric, limit),
    [limit, metric, selectedDivision, selectedSeason],
  );
  const [records, setRecords] = useState<AdvancedRankingRecord[]>(fallback);
  const [source, setSource] = useState<DataSourceState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({
          season: selectedSeason,
          limit: String(limit),
          metric,
        });
        if (selectedDivision !== "ALL") {
          params.set("division", selectedDivision);
        }

        const response = await fetch(`/api/team-stat-rankings.php?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("API request failed");
        }

        const payload = (await response.json()) as { records?: AdvancedRankingRecord[] };
        const apiRecords = (payload.records ?? []).map(normalizeAdvancedRankingRecord);
        if (cancelled) return;

        if (apiRecords.length > 0) {
          setRecords(apiRecords);
          setSource("db");
        } else {
          setRecords(fallback);
          setSource("mock");
        }
      } catch {
        if (cancelled) return;
        setRecords(fallback);
        setSource("mock");
      }
    }

    setRecords(fallback);
    setSource("loading");
    void load();

    return () => {
      cancelled = true;
    };
  }, [fallback, limit, metric, selectedDivision, selectedSeason]);

  return { records, source };
}

export function useShootingRankings(selectedSeason: SeasonKey, selectedDivision: DivisionFilter = "ALL", limit = 10) {
  return useAdvancedRankings(selectedSeason, selectedDivision, "three_point_percentage", limit);
}

function normalizeTeam(team: ApiTeamRecord): TeamRecord {
  return {
    ...team,
    wins: Number(team.wins),
    losses: Number(team.losses),
    pointsFor: Number(team.pointsFor),
    pointsAgainst: Number(team.pointsAgainst),
    homeWins: Number(team.homeWins),
    homeLosses: Number(team.homeLosses),
    awayWins: Number(team.awayWins),
    awayLosses: Number(team.awayLosses),
    lastFive: normalizeLastFive(team.lastFive),
  };
}

function normalizeGame(game: GameResult): GameResult {
  return {
    ...game,
    homeScore: Number(game.homeScore),
    awayScore: Number(game.awayScore),
  };
}

function normalizeLastFive(lastFive: Array<"W" | "L"> | undefined) {
  const values = lastFive?.length ? lastFive : [];
  return values.slice(0, 5) as Array<"W" | "L">;
}

function normalizeAdvancedStats(record: TeamAdvancedStats): TeamAdvancedStats {
  return {
    ...record,
    assists: nullableNumber(record.assists),
    turnovers: nullableNumber(record.turnovers),
    totalRebounds: nullableNumber(record.totalRebounds),
    threePointMakes: nullableNumber(record.threePointMakes),
    threePointAttempts: nullableNumber(record.threePointAttempts),
    threePointPercentage: nullableNumber(record.threePointPercentage),
    pace: nullableNumber(record.pace),
    offensiveRating: nullableNumber(record.offensiveRating),
    defensiveRating: nullableNumber(record.defensiveRating),
  };
}

function normalizeAdvancedRankingRecord(record: AdvancedRankingRecord): AdvancedRankingRecord {
  return {
    ...record,
    rank: Number(record.rank),
    value: nullableNumber(record.value),
    assists: nullableNumber(record.assists),
    totalRebounds: nullableNumber(record.totalRebounds),
    threePointMakes: nullableNumber(record.threePointMakes),
    threePointAttempts: nullableNumber(record.threePointAttempts),
    threePointPercentage: nullableNumber(record.threePointPercentage),
    offensiveRating: nullableNumber(record.offensiveRating),
    defensiveRating: nullableNumber(record.defensiveRating),
  };
}

function nullableNumber(value: number | null) {
  return value === null || value === undefined ? null : Number(value);
}

function filterFallback(dataset: (typeof seasons)[number], division: DivisionFilter) {
  if (division === "ALL") {
    return dataset;
  }

  const teamIds = new Set(dataset.teams.filter((team) => (team.division ?? "B1") === division).map((team) => team.shortName));
  return {
    ...dataset,
    teams: dataset.teams.filter((team) => (team.division ?? "B1") === division),
    recentGames: dataset.recentGames.filter((game) => teamIds.has(game.home) && teamIds.has(game.away)),
  };
}

function buildAdvancedStatsMap(selectedSeason: SeasonKey, selectedDivision: DivisionFilter) {
  const teams = filterFallback(seasons.find((season) => season.label === selectedSeason) ?? seasons[0], selectedDivision).teams;
  const teamIds = new Set(teams.map((team) => team.id));
  return (advancedStatsBySeason[selectedSeason] ?? []).reduce((acc, record) => {
    if (teamIds.has(record.teamId)) {
      acc[record.teamId] = record;
    }
    return acc;
  }, {} as AdvancedStatsMap);
}

function buildAdvancedRankingFallback(
  selectedSeason: SeasonKey,
  selectedDivision: DivisionFilter,
  metric: AdvancedRankingMetric,
  limit: number,
) {
  const dataset = filterFallback(seasons.find((season) => season.label === selectedSeason) ?? seasons[0], selectedDivision);
  const stats = buildAdvancedStatsMap(selectedSeason, selectedDivision);
  return dataset.teams
    .map((team) => {
      const advanced = stats[team.id];
      const value = rankingValue(advanced, metric);
      return {
        rank: 0,
        metric,
        value,
        teamId: team.id,
        name: team.name,
        shortName: team.shortName,
        division: team.division ?? null,
        conference: team.conference,
        assists: advanced?.assists ?? null,
        totalRebounds: advanced?.totalRebounds ?? null,
        threePointMakes: advanced?.threePointMakes ?? null,
        threePointAttempts: advanced?.threePointAttempts ?? null,
        threePointPercentage: advanced?.threePointPercentage ?? null,
        offensiveRating: advanced?.offensiveRating ?? null,
        defensiveRating: advanced?.defensiveRating ?? null,
        source: advanced?.source ?? "Sample fallback",
        updatedAt: advanced?.updatedAt ?? null,
      };
    })
    .filter((record) => record.value !== null)
    .sort((a, b) => (metric === "defensive_rating" ? (a.value ?? 0) - (b.value ?? 0) : (b.value ?? 0) - (a.value ?? 0)))
    .slice(0, limit)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

function rankingValue(record: TeamAdvancedStats | undefined, metric: AdvancedRankingMetric) {
  if (!record) return null;
  switch (metric) {
    case "three_point_percentage":
      return record.threePointPercentage;
    case "assists":
      return record.assists;
    case "total_rebounds":
      return record.totalRebounds;
    case "offensive_rating":
      return record.offensiveRating;
    case "defensive_rating":
      return record.defensiveRating;
  }
}
