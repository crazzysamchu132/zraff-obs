export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  photoURL: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin: string;
  emailVerified: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  logo: string;
  sponsorName: string;
  sponsorLogo: string;
  season: string;
  venue: string;
  organizer: string;
  description: string;
  status: 'draft' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  banner: string;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: 'GK' | 'DF' | 'MF' | 'FW';
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string;
  logo: string;
  coach: string;
  manager: string;
  captain: string;
  country: string;
  district: string;
  club: string;
  primaryColor: string;
  secondaryColor: string;
  players: Player[];
  createdAt: string;
}

export interface Group {
  id: string; // Group_A, Group_B, etc.
  name: string; // "Group A", "Group B", etc.
  tournamentId: string;
  teamIds: string[]; // max 2 teams
  teamPositions: { [teamId: string]: number }; // e.g. { teamId: 1 or 2 }
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution';
  minute: number;
  teamId: string;
  playerName: string;
  playerNameOut?: string; // only for substitution
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  corners: { home: number; away: number };
}

export interface MatchTimer {
  elapsedSeconds: number;
  isRunning: boolean;
  lastUpdated: string; // ISO date
  half: 1 | 2;
}

export interface Match {
  id: string;
  tournamentId: string;
  matchNumber: number;
  homeTeamId: string; // Can be a placeholder like "Winner Match 1"
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamShortName: string;
  awayTeamShortName: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  date: string;
  kickoffTime: string;
  venue: string;
  status: 'Scheduled' | 'Live' | 'Finished';
  round: 'Round of 16' | 'Quarter Finals' | 'Semi Finals' | 'Third Place' | 'Final';
  referee: string;
  locked: boolean;
  winnerId: string;
  score: { home: number; away: number };
  events: MatchEvent[];
  stats: MatchStats;
  timer: MatchTimer;
}

export interface StandingsRow {
  teamId: string;
  teamName: string;
  teamLogo: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GraphicsState {
  activeOverlay: 'none' | 'intro' | 'sponsor' | 'group_draw' | 'group_tables' | 'fixture_announcement' | 'next_match' | 'match_scoreboard' | 'half_time' | 'full_time' | 'goal' | 'substitution' | 'yellow_card' | 'red_card' | 'player_of_match' | 'champion_celebration';
  activeMatchId: string;
  alertDetails?: {
    teamId?: string;
    playerName?: string;
    playerNameOut?: string;
    type?: string;
    minute?: number;
  };
}

export interface Settings {
  theme: 'dark' | 'light';
  language: string;
  animationSpeed: 'slow' | 'normal' | 'fast';
  obsResolution: '1080p' | '720p';
  activeTournamentId: string;
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
}
