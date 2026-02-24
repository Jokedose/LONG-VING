import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { userRepository, type UserProfile } from '../lib/db/userRepository';
import { queryKeys } from '../lib/queryKeys';

// ── Zustand store for profile write operations / local state ──────────────────
interface UserStore {
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const useUserStore = create<UserStore>(() => ({
  updateProfile: async (data) => {
    // Get current profile directly from repository
    const current = await userRepository.getUserProfile();
    if (!current) return;
    const updated = { ...current, ...data };
    await userRepository.updateUserProfile(updated);
  },
}));

// ── useUserProfile — TanStack Query hook for reading profile ──────────────────
export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: () => userRepository.getUserProfile(),
    staleTime: 1000 * 60 * 5, // Profile doesn't change often — 5 min
  });
}

// ── useUpdateProfile — mutation hook for profile updates ──────────────────────
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const current = await userRepository.getUserProfile();
      if (!current) throw new Error('No profile found');
      const updated = { ...current, ...data };
      await userRepository.updateUserProfile(updated);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
    },
  });
}
