import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingPlanRepository, type WeeklyPlan } from '../lib/db/trainingPlanRepository';
import { sessionRepository, type Session } from '../lib/db/sessionRepository';
import { queryKeys } from '../lib/queryKeys';
import { startOfWeek, endOfWeek, addWeeks, isWithinInterval, endOfMonth, addDays } from 'date-fns';

type ViewMode = 'week' | 'month' | 'year';

const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const PHASE_COLORS: Record<string, string> = {
  'Base': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Build': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Peak': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Taper': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Race': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

export default function YearlyPlan() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('month');
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: queryKeys.yearlyPlan,
    queryFn: () => trainingPlanRepository.getYearlyPlan(),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionRepository.getAllSessions(),
  });

  const { data: dailyPlans = [], isLoading: dailyPlansLoading } = useQuery({
    queryKey: queryKeys.trainingSessions,
    queryFn: () => trainingPlanRepository.getAllTrainingSessions(),
  });

  if (plansLoading || sessionsLoading || dailyPlansLoading) return <div className="p-10 text-center text-zinc-400">Loading plan...</div>;

  const now = new Date();

  // Helper to get week ranges for each plan
  const plansWithActual = plans.map((p: WeeklyPlan) => {
    // Approximate: week_number relative to year start (2026)
    const yearStart = new Date(2026, 0, 1);
    const weekStart = addWeeks(startOfWeek(yearStart, { weekStartsOn: 1 }), p.week_number - 1);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Filter sessions that fell within this week
    const weekSessions = sessions.filter((s: Session) => {
      const sessionDate = new Date(s.started_at);
      return isWithinInterval(sessionDate, { start: weekStart, end: weekEnd });
    });

    const actual_km = weekSessions.reduce((sum: number, s: Session) => sum + (s.distance_m / 1000), 0);
    
    return { ...p, actual_km, weekStart, weekEnd };
  });

  // Find current week plan
  const currentPlan = plansWithActual.find(p => 
    isWithinInterval(now, { start: p.weekStart, end: p.weekEnd })
  ) || plansWithActual[0];

  const selectedPlan = selectedWeekId ? plansWithActual.find(p => p.id === selectedWeekId) : currentPlan;

  const totalTargetKm = plansWithActual.reduce((sum: number, p) => sum + (p.target_km || 0), 0);
  const totalActualKm = plansWithActual.reduce((sum: number, p) => sum + (p.actual_km || 0), 0);

  // Calendar Logic
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getDayPlan = (d: Date) => {
    // Find which week this day belongs to
    const plan = plansWithActual.find(p => isWithinInterval(d, { start: p.weekStart, end: p.weekEnd }));
    if (!plan) return null;

    // Find training session for this day (1=Mon, 7=Sun)
    let dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
    if (dayOfWeek === 0) dayOfWeek = 7; // Convert to 1=Mon, 7=Sun

    const dailyPlan = dailyPlans.find(ds => ds.week_id === plan.id && ds.day_of_week === dayOfWeek);
    
    // Also check if there was an actual session on this day
    const actualSessions = sessions.filter(s => {
      const sDate = new Date(s.started_at);
      return sDate.getFullYear() === d.getFullYear() && sDate.getMonth() === d.getMonth() && sDate.getDate() === d.getDate();
    });

    return { plan, dailyPlan, actualSessions };
  };

  const selectedDayData = selectedDay ? getDayPlan(selectedDay) : null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">📋 แผนซ้อม 2026</h1>
          <p className="text-zinc-500 mt-1">Road to Marathon · Monthly Calendar</p>
        </div>
        {/* View Toggle */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1 self-start md:self-auto">
          {(['week', 'month', 'year'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                view === v
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {v === 'week' ? 'รายสัปดาห์' : v === 'month' ? 'รายเดือน' : 'รายปี'}
            </button>
          ))}
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">เป้าหมายรวม</p>
          <p className="text-2xl font-black mt-1">{totalTargetKm.toFixed(0)} <span className="text-xs font-normal text-zinc-400">km</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">วิ่งไปแล้ว</p>
          <p className="text-2xl font-black text-green-600 mt-1">{totalActualKm.toFixed(2)} <span className="text-xs font-normal text-zinc-400">km</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Progress</p>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {totalTargetKm > 0 ? ((totalActualKm / totalTargetKm) * 100).toFixed(2) : 0}<span className="text-xs font-normal text-zinc-400">%</span>
          </p>
        </div>
      </div>

      {/* === WEEKLY VIEW === */}
      {view === 'week' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Week List */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {plansWithActual.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedWeekId(p.id)}
                className={`w-full text-left rounded-2xl p-4 border transition-all ${
                  selectedPlan?.id === p.id
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm">สัปดาห์ {p.week_number}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PHASE_COLORS[p.phase] || 'bg-zinc-100 text-zinc-500'}`}>
                    {p.phase}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-zinc-400">{p.focus_point}</span>
                  <span className="font-black text-sm">{p.target_km} <span className="text-[9px] font-normal text-zinc-400">km</span></span>
                </div>
                <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.actual_km >= p.target_km ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, p.target_km > 0 ? (p.actual_km / p.target_km) * 100 : 0)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          {/* Week Detail */}
          {selectedPlan && (
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm self-start">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black">สัปดาห์ที่ {selectedPlan.week_number}</h2>
                  <p className="text-zinc-500 font-medium">{MONTHS[selectedPlan.month_index]} · {selectedPlan.focus_point}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${PHASE_COLORS[selectedPlan.phase] || 'bg-zinc-100 text-zinc-500'}`}>
                  {selectedPlan.phase}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">เป้าหมาย</p>
                  <p className="text-3xl font-black mt-1">{selectedPlan.target_km} <span className="text-sm font-normal text-zinc-400">km</span></p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">วิ่งไปแล้ว</p>
                  <p className={`text-3xl font-black mt-1 ${selectedPlan.actual_km >= selectedPlan.target_km ? 'text-green-600' : ''}`}>
                    {selectedPlan.actual_km.toFixed(1)} <span className="text-sm font-normal text-zinc-400">km</span>
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">
                  <span>Progress</span>
                  <span>{selectedPlan.target_km > 0 ? ((selectedPlan.actual_km / selectedPlan.target_km) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${selectedPlan.actual_km >= selectedPlan.target_km ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, selectedPlan.target_km > 0 ? (selectedPlan.actual_km / selectedPlan.target_km) * 100 : 0)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => navigate('/sessions')}
                className="w-full mt-4 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline text-left"
              >
                → ดูประวัติการวิ่งสัปดาห์นี้
              </button>
            </div>
          )}
        </div>
      )}

      {/* === MONTHLY CALENDAR VIEW === */}
      {view === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-black">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  ←
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date(2026, now.getMonth(), 1))}
                  className="px-3 py-1 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                >
                  วันนี้
                </button>
                <button 
                  onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  →
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => (
                  <div key={day} className="py-3 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((d, i) => {
                  const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                  const isToday = d.toDateString() === now.toDateString();
                  const isSelected = selectedDay?.toDateString() === d.toDateString();
                  const data = getDayPlan(d);
                  const hasPlan = !!data?.dailyPlan;
                  const hasActual = (data?.actualSessions?.length || 0) > 0;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(d)}
                      className={`min-h-[100px] p-2 text-left border-r border-b border-zinc-50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/30 group ${
                        !isCurrentMonth ? 'opacity-20' : ''
                      } ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : 'text-zinc-500'}`}>
                          {d.getDate()}
                        </span>
                        {data?.plan && isCurrentMonth && d.getDay() === 1 && (
                          <span className="text-[8px] font-black text-blue-400 uppercase leading-none">Wk {data.plan.week_number}</span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {hasPlan && (
                          <div className={`text-[9px] font-medium leading-tight p-1 rounded ${hasActual ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200'}`}>
                            {data.dailyPlan?.title}
                          </div>
                        )}
                        {!hasPlan && hasActual && (
                          <div className="text-[9px] font-medium leading-tight p-1 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            วิ่งนอกแผน
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day details */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm min-h-[400px]">
              {selectedDay ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">
                      {selectedDay.toLocaleDateString('th-TH', { weekday: 'long' })}
                    </p>
                    <h3 className="text-2xl font-black">
                      {selectedDay.getDate()} {MONTHS[selectedDay.getMonth()]}
                    </h3>
                  </div>

                  {selectedDayData?.plan && (
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-lg inline-block ${PHASE_COLORS[selectedDayData.plan.phase]}`}>
                      Phase: {selectedDayData.plan.phase} (Wk {selectedDayData.plan.week_number})
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">แผนการซ้อม</h4>
                    {selectedDayData?.dailyPlan ? (
                      <div className="space-y-3">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-tight">
                          {selectedDayData.dailyPlan.title}
                        </p>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase">เวลา</p>
                            <p className="font-black">{selectedDayData.dailyPlan.planned_duration_min} <span className="text-[10px] font-normal">min</span></p>
                          </div>
                          <div>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase">ความหนัก</p>
                            <p className="font-black text-rose-500">{selectedDayData.dailyPlan.intensity_target}</p>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed italic">
                          "{selectedDayData.dailyPlan.description}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">ไม่มีเแผนซ้อมในวันนี้ (พักผ่อน)</p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">บันทึกการวิ่งจริง</h4>
                    {selectedDayData?.actualSessions && selectedDayData.actualSessions.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDayData.actualSessions.map(s => (
                          <div key={s.id} onClick={() => navigate(`/sessions/${s.id}`)} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:border-blue-400 transition-all">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-green-600">สำเร็จแล้ว</span>
                              <span className="text-[10px] text-zinc-400">{(s.distance_m / 1000).toFixed(2)} km</span>
                            </div>
                            <p className="text-xs font-medium text-zinc-500">{new Date(s.started_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">ยังไม่ได้บันทึกการซ้อม</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 space-y-3">
                  <div className="text-4xl">📅</div>
                  <p className="text-sm font-medium">เลือกวันที่บนปฏิทินเพื่อดูรายละเอียด</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === YEARLY VIEW === */}
      {view === 'year' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left py-3 pr-4">สัปดาห์</th>
                <th className="text-left py-3 pr-4">เดือน</th>
                <th className="text-left py-3 pr-4">Phase</th>
                <th className="text-left py-3 pr-4">Focus</th>
                <th className="text-right py-3 pr-4">เป้า (km)</th>
                <th className="text-right py-3 pr-4">จริง (km)</th>
                <th className="text-right py-3">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {plansWithActual.map((p) => {
                const pct = p.target_km > 0 ? ((p.actual_km / p.target_km) * 100) : 0;
                const done = p.actual_km >= p.target_km;
                return (
                  <tr
                    key={p.id}
                    onClick={() => { setSelectedWeekId(p.id); setView('week'); }}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4 font-black">Wk {p.week_number}</td>
                    <td className="py-3 pr-4 text-zinc-500">{MONTHS[p.month_index]}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PHASE_COLORS[p.phase] || 'bg-zinc-100 text-zinc-500'}`}>
                        {p.phase}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 text-xs max-w-[160px] truncate">{p.focus_point}</td>
                    <td className="py-3 pr-4 text-right font-bold">{p.target_km}</td>
                    <td className={`py-3 pr-4 text-right font-bold ${done ? 'text-green-600' : ''}`}>{p.actual_km.toFixed(1)}</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-bold ${done ? 'text-green-600' : pct > 50 ? 'text-blue-500' : 'text-zinc-400'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
