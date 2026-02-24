import { invoke } from '@tauri-apps/api/core';

export interface BodyMetrics {
  id?: number;
  recorded_at: string;
  weight_kg: number;
  body_fat_pct?: number;
  bmi?: number;
  fat_free_body_weight_kg?: number;
  subcutaneous_fat_pct?: number;
  visceral_fat?: number;
  body_water_pct?: number;
  skeletal_muscle_pct?: number;
  muscle_mass_kg?: number;
  bone_mass_kg?: number;
  protein_pct?: number;
  bmr_kcal?: number;
  metabolic_age?: number;
  heart_rate?: number;
  image_path?: string;
}

export const bodyMetricsRepository = {
  async getAllBodyMetrics(): Promise<BodyMetrics[]> {
    try {
      return await invoke<BodyMetrics[]>('get_all_body_metrics');
    } catch (error) {
      console.error('Failed to get body metrics:', error);
      return [];
    }
  },

  async deleteBodyMetrics(id: number): Promise<void> {
    try {
      await invoke('delete_body_metrics', { id });
    } catch (error) {
      console.error('Failed to delete body metrics:', error);
      throw error;
    }
  },

  async addBodyMetrics(data: Partial<BodyMetrics>): Promise<void> {
    try {
      await invoke('add_body_metrics', { data });
    } catch (error) {
      console.error('Failed to add body metrics:', error);
      throw error;
    }
  }
};
