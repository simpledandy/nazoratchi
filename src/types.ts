export interface Stats {
  totalInvites: number;
  totalLeaves: number;
  totalMembers: number;
  invites: any[];
  leaves: any[];
  members: any[];
}

export interface LeaderboardItem {
  id: string;
  count: number;
  name: string;
}

export type TabType = "dashboard" | "leaderboard" | "contests" | "sales" | "settings" | "instructions";
