import { invoke } from '@tauri-apps/api/core';

export const settingsRepository = {
  async getSetting(key: string): Promise<string | null> {
    try {
      return await invoke<string | null>('get_setting', { key });
    } catch (error) {
      console.error('Failed to get setting:', error);
      return null;
    }
  },

  async setSetting(key: string, value: string): Promise<void> {
    try {
      await invoke('set_setting', { key, value });
    } catch (error) {
      console.error('Failed to set setting:', error);
      throw error;
    }
  }
};
