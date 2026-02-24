import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { useUserProfile } from '../store/userStore';
import { sessionRepository, type MonthlySummary as MonthlySummaryRow } from '../lib/db/sessionRepository';
import { queryKeys } from '../lib/queryKeys';

export default function Dashboard() {
  const { data: profile } = useUserProfile();

  // Fetch all sessions for weekly stats calculation
  const { data: allSessions = [] } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionRepository.getAllSessions(),
  });

  // Fetch 5 most recent sessions
  const { data: recentSessions = [], isLoading } = useQuery({
    queryKey: queryKeys.sessions.recent(5),
    queryFn: () => sessionRepository.getRecentSessions(5),
  });

  // Fetch monthly summaries
  const { data: rawMonthly = [] } = useQuery({
    queryKey: queryKeys.monthlySummary,
    queryFn: () => sessionRepository.getMonthlySummary(),
  });

  // Compute weekly stats from cached allSessions
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weeklyData = allSessions.filter(s =>
    isWithinInterval(parseISO(s.started_at), { start: weekStart, end: weekEnd })
  );
  const weeklyDist = weeklyData.reduce((sum, s) => sum + s.distance_m, 0) / 1000;
  const avgZone2 = weeklyData.length > 0
    ? weeklyData.reduce((sum, s) => sum + (s.zone2_pct || 0), 0) / weeklyData.length
    : 0;

  // Pace Now calculation: Avg pace of all high z2 sessions (>80%)
  const z2Sessions = allSessions.filter(s => (s.zone2_pct || 0) >= 80);
  const avgZ2PaceSec = z2Sessions.length > 0
    ? z2Sessions.reduce((sum, s) => sum + s.avg_pace_sec_per_km, 0) / z2Sessions.length
    : 0; // fallback if no sessions yet
  
  const paceNowStr = avgZ2PaceSec > 0 
    ? `${Math.floor(avgZ2PaceSec / 60)}:${Math.round(avgZ2PaceSec % 60).toString().padStart(2, '0')}`
    : '--:--';
  
  const targetPaceSec = 7 * 60; // 7:00
  // Progress calculation: how close is our pace to the target?
  // If pace is 9:00 (540s) and target is 7:00 (420s), progress is lower.
  // We'll use a simple ratio or a more complex health-based mapping.
  // For now, let's say 10:00 or more is 0%, 7:00 is 100%.
  const maxPaceSec = 10 * 60;
  const progressPct = avgZ2PaceSec > 0 
    ? Math.max(0, Math.min(100, ((maxPaceSec - avgZ2PaceSec) / (maxPaceSec - targetPaceSec)) * 100))
    : 0;

  const monthlySummaries = rawMonthly.map((m: MonthlySummaryRow) => ({
    month: format(parseISO(`${m.month}-01`), 'MMM yyyy'),
    count: m.session_count,
    dist: m.total_distance_km,
    duration: m.total_duration_min,
    avgZ2: 0,
    avgPace: 0,
  }));

  if (isLoading) return <div className="p-8 text-center">Loading Dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight"> Dashboard</h1>
          <p className="text-gray-500 mt-2">เป้าหมาย: Zone 2 (140–154 bpm) ที่ Pace 7:00 /km</p>
        </div>
        <div className="text-right hidden md:block">
           <p className="text-xs font-bold text-gray-400 uppercase">Last Updated</p>
           <p className="text-sm font-medium">{format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        </div>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Zone 2 Target HR</h3>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">140–154 <span className="text-xs font-normal text-gray-400">bpm</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Resting HR ปัจจุบัน</h3>
          <p className="text-2xl font-black text-rose-500">{profile?.resting_hr || '--'} <span className="text-xs font-normal text-gray-400">bpm</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">สัปดาห์นี้ (กม.)</h3>
          <p className="text-2xl font-black">{weeklyDist.toFixed(1)} <span className="text-xs font-normal text-gray-400">km</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Zone 2 % เฉลี่ย</h3>
          <p className={`text-2xl font-black ${avgZone2 >= 80 ? 'text-green-500' : 'text-orange-500'}`}>
            {avgZone2.toFixed(1)}<span className="text-xs font-normal text-gray-400">%</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent 5 Runs Table */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><span></span> 5 ครั้งล่าสุด</h2>
          <div className="overflow-hidden border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">วันที่</th>
                  <th className="px-6 py-3">ระยะ (กม.)</th>
                  <th className="px-6 py-3 text-center">HR เเละ Pace</th>
                  <th className="px-6 py-3 text-right">Zone 2 %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {recentSessions.length > 0 ? recentSessions.map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{format(parseISO(s.started_at), 'dd MMM')}</td>
                    <td className="px-6 py-4 font-black">{(s.distance_m/1000).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                       <p className="text-xs">{s.avg_hr} bpm</p>
                       <p className="text-blue-500 font-bold">{(s.avg_pace_sec_per_km/60).toFixed(2).replace('.', ':')}/km</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${s.zone2_pct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700'}`}>
                          {s.zone2_pct?.toFixed(0)}%
                       </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic">ไม่มีข้อมูลการวิ่ง</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><span></span> สรุปรายเดือน</h2>
          <div className="overflow-hidden border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">เดือน</th>
                  <th className="px-4 py-3 text-right">KM</th>
                  <th className="px-4 py-3 text-right">Z2 %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {monthlySummaries.map((m, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-semibold">{m.month}</td>
                    <td className="px-4 py-3 text-right font-black">{m.dist.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{m.avgZ2.toFixed(0)}%</td>
                  </tr>
                ))}
                {monthlySummaries.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400 italic">ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Goal Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="text-sm font-bold opacity-80 uppercase mb-4">Progress to Goal</h3>
               <div className="flex justify-between items-end mb-4">
                 <div>
                   <p className="text-xs opacity-70 mb-1">Target Pace</p>
                   <p className="text-2xl font-black">7:00 <span className="text-xs font-normal opacity-70">/km</span></p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs opacity-70 mb-1">Pace Now</p>
                   <p className="text-2xl font-black text-green-300">{paceNowStr} <span className="text-xs font-normal opacity-70">/km</span></p>
                 </div>
               </div>
               <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                 <div 
                   className="bg-white rounded-full h-2 transition-all duration-1000 ease-out" 
                   style={{ width: `${progressPct}%` }}
                 ></div>
               </div>
               <div className="flex justify-between text-[10px] opacity-70 font-bold uppercase">
                 <span>Current Efficiency</span>
                 <span>{progressPct.toFixed(1)}%</span>
               </div>
             </div>
             <div className="absolute -bottom-6 -right-6 text-white/10 rotate-12 select-none">
                <span className="text-9xl font-black">Pace</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
