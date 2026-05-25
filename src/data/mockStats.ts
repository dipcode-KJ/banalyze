export type SeasonKey = "2025-26" | "2024-25" | "2023-24";

export type TeamRecord = {
  id: string;
  name: string;
  shortName: string;
  division?: string;
  conference: "B1 East" | "B1 Central" | "B1 West" | string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  lastFive: Array<"W" | "L">;
};

export type GameResult = {
  id: string;
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  venue: string;
};

export type SeasonDataset = {
  label: SeasonKey;
  teams: TeamRecord[];
  recentGames: GameResult[];
};

const currentTeams: TeamRecord[] = [
  {
    id: "utsunomiya",
    name: "宇都宮ブレックス",
    shortName: "宇都宮",
    conference: "B1 East",
    wins: 41,
    losses: 13,
    pointsFor: 4378,
    pointsAgainst: 3988,
    homeWins: 23,
    homeLosses: 4,
    awayWins: 18,
    awayLosses: 9,
    lastFive: ["W", "W", "L", "W", "W"],
  },
  {
    id: "chiba-jets",
    name: "千葉ジェッツ",
    shortName: "千葉J",
    conference: "B1 East",
    wins: 39,
    losses: 15,
    pointsFor: 4512,
    pointsAgainst: 4210,
    homeWins: 22,
    homeLosses: 5,
    awayWins: 17,
    awayLosses: 10,
    lastFive: ["W", "L", "W", "W", "W"],
  },
  {
    id: "san-en",
    name: "三遠ネオフェニックス",
    shortName: "三遠",
    conference: "B1 Central",
    wins: 38,
    losses: 16,
    pointsFor: 4580,
    pointsAgainst: 4262,
    homeWins: 20,
    homeLosses: 7,
    awayWins: 18,
    awayLosses: 9,
    lastFive: ["L", "W", "W", "W", "L"],
  },
  {
    id: "ryukyu",
    name: "琉球ゴールデンキングス",
    shortName: "琉球",
    conference: "B1 West",
    wins: 37,
    losses: 17,
    pointsFor: 4304,
    pointsAgainst: 4016,
    homeWins: 21,
    homeLosses: 6,
    awayWins: 16,
    awayLosses: 11,
    lastFive: ["W", "W", "W", "L", "W"],
  },
  {
    id: "alvark",
    name: "アルバルク東京",
    shortName: "A東京",
    conference: "B1 Central",
    wins: 36,
    losses: 18,
    pointsFor: 4218,
    pointsAgainst: 3997,
    homeWins: 19,
    homeLosses: 8,
    awayWins: 17,
    awayLosses: 10,
    lastFive: ["L", "W", "W", "L", "W"],
  },
  {
    id: "nagoya-d",
    name: "名古屋ダイヤモンドドルフィンズ",
    shortName: "名古屋D",
    conference: "B1 West",
    wins: 34,
    losses: 20,
    pointsFor: 4416,
    pointsAgainst: 4301,
    homeWins: 18,
    homeLosses: 9,
    awayWins: 16,
    awayLosses: 11,
    lastFive: ["W", "L", "L", "W", "W"],
  },
];

const games2026: GameResult[] = [
  {
    id: "g-2026-001",
    date: "2026-05-23",
    home: "千葉J",
    away: "宇都宮",
    homeScore: 79,
    awayScore: 83,
    venue: "LaLa arena TOKYO-BAY",
  },
  {
    id: "g-2026-002",
    date: "2026-05-23",
    home: "琉球",
    away: "名古屋D",
    homeScore: 88,
    awayScore: 74,
    venue: "沖縄アリーナ",
  },
  {
    id: "g-2026-003",
    date: "2026-05-22",
    home: "三遠",
    away: "A東京",
    homeScore: 91,
    awayScore: 86,
    venue: "豊橋市総合体育館",
  },
  {
    id: "g-2026-004",
    date: "2026-05-18",
    home: "宇都宮",
    away: "琉球",
    homeScore: 77,
    awayScore: 71,
    venue: "日環アリーナ栃木",
  },
];

export const seasons: SeasonDataset[] = [
  {
    label: "2025-26",
    teams: currentTeams,
    recentGames: games2026,
  },
  {
    label: "2024-25",
    teams: [
      { ...currentTeams[2], wins: 46, losses: 14, pointsFor: 4920, pointsAgainst: 4598, homeWins: 25, homeLosses: 5, awayWins: 21, awayLosses: 9 },
      { ...currentTeams[3], wins: 44, losses: 16, pointsFor: 4804, pointsAgainst: 4450, homeWins: 24, homeLosses: 6, awayWins: 20, awayLosses: 10 },
      { ...currentTeams[0], wins: 42, losses: 18, pointsFor: 4688, pointsAgainst: 4342, homeWins: 23, homeLosses: 7, awayWins: 19, awayLosses: 11 },
      { ...currentTeams[1], wins: 39, losses: 21, pointsFor: 4860, pointsAgainst: 4630, homeWins: 22, homeLosses: 8, awayWins: 17, awayLosses: 13 },
      { ...currentTeams[4], wins: 37, losses: 23, pointsFor: 4615, pointsAgainst: 4416, homeWins: 20, homeLosses: 10, awayWins: 17, awayLosses: 13 },
      { ...currentTeams[5], wins: 35, losses: 25, pointsFor: 4708, pointsAgainst: 4644, homeWins: 19, homeLosses: 11, awayWins: 16, awayLosses: 14 },
    ],
    recentGames: [
      { id: "g-2025-001", date: "2025-05-26", home: "三遠", away: "琉球", homeScore: 84, awayScore: 77, venue: "豊橋市総合体育館" },
      { id: "g-2025-002", date: "2025-05-24", home: "宇都宮", away: "千葉J", homeScore: 80, awayScore: 72, venue: "日環アリーナ栃木" },
      { id: "g-2025-003", date: "2025-05-18", home: "A東京", away: "名古屋D", homeScore: 76, awayScore: 71, venue: "国立代々木競技場" },
    ],
  },
  {
    label: "2023-24",
    teams: [
      { ...currentTeams[0], wins: 51, losses: 9, pointsFor: 4890, pointsAgainst: 4302, homeWins: 27, homeLosses: 3, awayWins: 24, awayLosses: 6 },
      { ...currentTeams[1], wins: 48, losses: 12, pointsFor: 5012, pointsAgainst: 4588, homeWins: 26, homeLosses: 4, awayWins: 22, awayLosses: 8 },
      { ...currentTeams[3], wins: 41, losses: 19, pointsFor: 4720, pointsAgainst: 4488, homeWins: 23, homeLosses: 7, awayWins: 18, awayLosses: 12 },
      { ...currentTeams[4], wins: 40, losses: 20, pointsFor: 4664, pointsAgainst: 4452, homeWins: 22, homeLosses: 8, awayWins: 18, awayLosses: 12 },
      { ...currentTeams[5], wins: 37, losses: 23, pointsFor: 4822, pointsAgainst: 4718, homeWins: 20, homeLosses: 10, awayWins: 17, awayLosses: 13 },
      { ...currentTeams[2], wins: 33, losses: 27, pointsFor: 4601, pointsAgainst: 4568, homeWins: 18, homeLosses: 12, awayWins: 15, awayLosses: 15 },
    ],
    recentGames: [
      { id: "g-2024-001", date: "2024-05-28", home: "宇都宮", away: "千葉J", homeScore: 82, awayScore: 75, venue: "横浜アリーナ" },
      { id: "g-2024-002", date: "2024-05-25", home: "琉球", away: "A東京", homeScore: 79, awayScore: 73, venue: "沖縄アリーナ" },
      { id: "g-2024-003", date: "2024-05-18", home: "名古屋D", away: "三遠", homeScore: 88, awayScore: 81, venue: "ドルフィンズアリーナ" },
    ],
  },
];

export const seasonLabels = seasons.map((season) => season.label);
export const winRate = (team: TeamRecord) => {
  const games = team.wins + team.losses;
  return games > 0 ? team.wins / games : 0;
};
export const pointDiff = (team: TeamRecord) => team.pointsFor - team.pointsAgainst;
