import { useEffect, useMemo, useState } from "react";
import { seasons, type GameResult, type SeasonKey, type TeamRecord } from "../data/mockStats";

type ApiTeamRecord = Omit<TeamRecord, "lastFive"> & {
  lastFive?: Array<"W" | "L">;
};

export type DivisionFilter = "ALL" | "B1" | "B2";
export type SeasonSeries = Record<SeasonKey, TeamRecord[]>;

export function useSeasonData(selectedSeason: SeasonKey, selectedDivision: DivisionFilter = "ALL") {
  const fallback = useMemo(
    () => filterFallback(seasons.find((season) => season.label === selectedSeason) ?? seasons[0], selectedDivision),
    [selectedDivision, selectedSeason],
  );
  const [teams, setTeams] = useState<TeamRecord[]>(fallback.teams);
  const [recentGames, setRecentGames] = useState<GameResult[]>(fallback.recentGames);
  const [source, setSource] = useState<"db" | "mock">("mock");

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
    setSource("mock");
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
  const [source, setSource] = useState<"db" | "mock">("mock");

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
    setSource("mock");
    void load();

    return () => {
      cancelled = true;
    };
  }, [fallback, selectedDivision]);

  return { series, source };
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
