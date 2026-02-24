import { invoke } from '@tauri-apps/api/core';

export interface WeeklyPlan {
  id: number;
  week_number: number;
  month_index: number;
  target_km: number;
  phase: string;
  focus_point: string;
  actual_km: number;
}

export interface TrainingSession {
  id?: number;
  week_id: number;
  day_of_week: number;
  title: string;
  planned_duration_min: number;
  intensity_target: string;
  description: string;
}

export const trainingPlanRepository = {
  async getAllTrainingSessions(): Promise<TrainingSession[]> {
    try {
      return await invoke<TrainingSession[]>('get_all_training_sessions');
    } catch (error) {
      console.error('Failed to get training sessions:', error);
      return [];
    }
  },
  async getYearlyPlan(): Promise<WeeklyPlan[]> {
    try {
      return await invoke<WeeklyPlan[]>('get_yearly_plan');
    } catch (error) {
      console.error('Failed to get yearly plan:', error);
      return [];
    }
  },

  async bulkCreatePlan(plans: WeeklyPlan[]): Promise<number[]> {
    try {
      return await invoke<number[]>('bulk_create_plan', { plans });
    } catch (error) {
      console.error('Failed to bulk create plan:', error);
      throw error;
    }
  },

  async bulkCreateSessions(sessions: TrainingSession[]): Promise<void> {
    try {
      await invoke('bulk_create_sessions', { sessions });
    } catch (error) {
      console.error('Failed to bulk create sessions:', error);
      throw error;
    }
  }
};
