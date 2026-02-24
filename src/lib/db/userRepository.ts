import { invoke } from '@tauri-apps/api/core';

export interface UserProfile {
  id: number;
  age: number | null;
  resting_hr: number | null;
  max_hr: number | null;
  updated_at: string;
}

export const userRepository = {
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      return await invoke<UserProfile | null>('get_user_profile');
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  },

  async updateUserProfile(profile: UserProfile): Promise<void> {
    try {
      await invoke('update_user_profile', { profile });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }
};
