// Central registry of all TanStack Query keys for cache consistency

export const queryKeys = {
  userProfile: ['userProfile'] as const,

  sessions: {
    all: ['sessions'] as const,
    recent: (limit: number) => ['sessions', 'recent', limit] as const,
    byId: (id: string) => ['sessions', id] as const,
    records: (id: string) => ['sessions', id, 'records'] as const,
  },

  monthlySummary: ['monthlySummary'] as const,

  bodyMetrics: {
    all: ['bodyMetrics'] as const,
  },

  yearlyPlan: ['yearlyPlan'] as const,
  trainingSessions: ['trainingSessions'] as const,
};
