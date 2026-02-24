import { yearlyPlanData } from './yearlyPlanData';

export interface WeeklyPlan {
  weekNumber: number;
  monthIndex: number; // 0-11
  targetKm: number;
  description: string;
  phase: 'Base' | 'Build' | 'Tempo' | 'Race Ready' | 'Taper' | string;
}

export function generateYearlyPlan(_currentBaseKm: number = 20): WeeklyPlan[] {
  // Use data extracted from Excel instead of calculating
  return yearlyPlanData as WeeklyPlan[];
}
