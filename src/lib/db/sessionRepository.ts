import { invoke } from '@tauri-apps/api/core';

export interface Session {
  id: string;
  started_at: string;
  duration_secs: number;
  distance_m: number;
  avg_hr: number;
  max_hr: number;
  avg_pace_sec_per_km: number;
  zone2_pct: number;
  raw_fit_path: string;
}

export interface Record {
  timestamp: string;
  heart_rate?: number;
  speed_ms?: number;
  distance_m?: number;
  cadence?: number;
  altitude_m?: number;
}

export interface MonthlySummary {
  month: string;
  total_distance_km: number;
  total_duration_min: number;
  session_count: number;
}

export const sessionRepository = {
  async getAllSessions(): Promise<Session[]> {
    try {
      return await invoke<Session[]>('get_all_sessions');
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  },

  async getRecentSessions(limit: number): Promise<Session[]> {
    try {
      return await invoke<Session[]>('get_recent_sessions', { limit });
    } catch (error) {
      console.error('Failed to get recent sessions:', error);
      return [];
    }
  },

  async getSessionById(id: string): Promise<Session | null> {
    try {
      return await invoke<Session | null>('get_session_by_id', { id });
    } catch (error) {
      console.error('Failed to get session by id:', error);
      return null;
    }
  },

  async getRecordsBySession(sessionId: string): Promise<Record[]> {
    try {
      return await invoke<Record[]>('get_records_by_session', { sessionId });
    } catch (error) {
      console.error('Failed to get records:', error);
      return [];
    }
  },

  async getMonthlySummary(): Promise<MonthlySummary[]> {
    try {
      return await invoke<MonthlySummary[]>('get_monthly_summary');
    } catch (error) {
      console.error('Failed to get monthly summary:', error);
      return [];
    }
  },

  async deleteSession(id: string): Promise<void> {
    try {
      await invoke('delete_session', { id });
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  async isSessionDuplicate(startedAt: string): Promise<boolean> {
    try {
      return await invoke<boolean>('is_session_duplicate', { startedAt });
    } catch (error) {
      console.error('Failed to check duplicate:', error);
      return false;
    }
  },

  async createSession(session: Session): Promise<void> {
    try {
      await invoke('create_session', { session });
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  async createRecordsChunk(sessionId: string, records: Record[]): Promise<void> {
    try {
      await invoke('create_records_chunk', { sessionId, records });
    } catch (error) {
      console.error('Failed to create records chunk:', error);
      throw error;
    }
  }
};
