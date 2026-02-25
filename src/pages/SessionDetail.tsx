import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { useMemo, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import { useUserProfile } from "../store/userStore";
import { sessionRepository } from "../lib/db";
import { queryKeys } from "../lib/queryKeys";
import { type Record as SessionRecord } from "../lib/db/sessionRepository";

interface ZoneInfo {
  id: string;
  label: string;
  min: number;
  max: number;
  color: string;
  count: number;
  pct: number;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile();

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: queryKeys.sessions.byId(id!),
    queryFn: () => sessionRepository.getSessionById(id!),
    enabled: !!id,
  });

  const { data: records = [], isLoading: loadingRecords } = useQuery<SessionRecord[]>({
    queryKey: queryKeys.sessions.records(id!),
    queryFn: () => sessionRepository.getRecordsBySession(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => sessionRepository.deleteSession(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      navigate("/sessions");
    },
    onError: (e) => alert("ลบข้อมูลไม่สำเร็จ: " + e),
  });

  const zoneBreakdown = useMemo<ZoneInfo[]>(() => {
    if (!profile || !records.length) return [];
    const maxHR = profile.max_hr || 185;
    const restingHR = profile.resting_hr || 60;
    const reserve = maxHR - restingHR;
    const zones = {
      z1: {
        label: "Zone 1 (Recovery)",
        min: restingHR + reserve * 0.5,
        max: restingHR + reserve * 0.6,
        color: "bg-zinc-100",
      },
      z2: {
        label: "Zone 2 (Aerobic)",
        min: restingHR + reserve * 0.6,
        max: restingHR + reserve * 0.7,
        color: "bg-blue-100",
      },
      z3: {
        label: "Zone 3 (Tempo)",
        min: restingHR + reserve * 0.7,
        max: restingHR + reserve * 0.8,
        color: "bg-green-100",
      },
      z4: {
        label: "Zone 4 (Threshold)",
        min: restingHR + reserve * 0.8,
        max: restingHR + reserve * 0.9,
        color: "bg-orange-100",
      },
      z5: {
        label: "Zone 5 (Anaerobic)",
        min: restingHR + reserve * 0.9,
        max: maxHR,
        color: "bg-rose-100",
      },
    };
    const breakdown: ZoneInfo[] = [
      { id: "z1", ...zones.z1, count: 0, pct: 0 },
      { id: "z2", ...zones.z2, count: 0, pct: 0 },
      { id: "z3", ...zones.z3, count: 0, pct: 0 },
      { id: "z4", ...zones.z4, count: 0, pct: 0 },
      { id: "z5", ...zones.z5, count: 0, pct: 0 },
    ];
    records.forEach((r: SessionRecord) => {
      if (!r.heart_rate) return;
      const hr = r.heart_rate;
      if (hr < zones.z1.max) breakdown[0].count++;
      else if (hr < zones.z2.max) breakdown[1].count++;
      else if (hr < zones.z3.max) breakdown[2].count++;
      else if (hr < zones.z4.max) breakdown[3].count++;
      else breakdown[4].count++;
    });
    const total = breakdown.reduce((acc, curr) => acc + curr.count, 0);
    if (total > 0)
      breakdown.forEach((b: ZoneInfo) => (b.pct = (b.count / total) * 100));
    return breakdown;
  }, [profile, records]);

  const zone2AvgSpeed = useMemo(() => {
    if (!profile || !records.length) return 0;
    const maxHR = profile.max_hr || 185;
    const restingHR = profile.resting_hr || 60;
    const reserve = maxHR - restingHR;
    const z2Min = restingHR + reserve * 0.6;
    const z2Max = restingHR + reserve * 0.7;

    const z2Records = records.filter(
      (r: SessionRecord) => r.heart_rate && r.heart_rate >= z2Min && r.heart_rate < z2Max
    );
    if (!z2Records.length) return 0;
    
    const sumSpeed = z2Records.reduce((sum: number, r: SessionRecord) => sum + (r.speed_ms || 0), 0);
    return sumSpeed / z2Records.length;
  }, [profile, records]);
  
  const z2PaceSecPerKm = zone2AvgSpeed > 0 ? 1000 / zone2AvgSpeed : 0;
  const z2PaceMin = Math.floor(z2PaceSecPerKm / 60);
  const z2PaceSec = Math.round(z2PaceSecPerKm % 60);

  const chartData = useMemo(() => {
    if (!records.length) return [];
    const sampleRate = Math.max(1, Math.floor(records.length / 300));
    return records
      .filter((_: SessionRecord, i: number) => i % sampleRate === 0)
      .map((r: SessionRecord, i: number) => ({
        time: i,
        displayTime: `${Math.floor((i * sampleRate) / 60)}m`,
        hr: r.heart_rate || 0,
        speed: (r.speed_ms || 0).toFixed(1),
      }));
  }, [records]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isLoading = loadingSession || loadingRecords;

  if (isLoading)
    return <div className="p-10 text-center">Loading session data...</div>;
  if (!session)
    return <div className="p-10 text-center">Session not found.</div>;

  const durationMin = Math.floor(session.duration_secs / 60);
  const durationSec = session.duration_secs % 60;
  const paceMin = Math.floor(session.avg_pace_sec_per_km / 60);
  const paceSec = Math.round(session.avg_pace_sec_per_km % 60);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/sessions"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 text-sm font-medium flex items-center gap-1 mb-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform font-bold">
              ←
            </span>{" "}
            กลับไปรายการทั้งหมด
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter">
              {format(parseISO(session.started_at), "dd MMMM yyyy")}
            </h1>
            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Run
            </span>
          </div>
          <p className="text-zinc-500 font-medium mt-1 flex items-center gap-2">
            <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">
              {format(parseISO(session.started_at), "HH:mm")} น.
            </span>
            ·
            <span className="font-mono text-[10px] opacity-60">
              ID: {session.id.slice(0, 8)}...
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all border border-rose-100 dark:border-rose-900/30 disabled:opacity-40"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบข้อมูล"
        message="คุณต้องการลบข้อมูลการวิ่งนี้ใช่หรือไม่? ข้อมูลบันทึกและสถิติทั้งหมดที่เกี่ยวข้องจะถูกลบทิ้งถาวร"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="ระยะทาง"
          value={(session.distance_m / 1000).toFixed(2)}
          unit="KM"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="เวลา"
          value={`${durationMin}:${durationSec.toString().padStart(2, "0")}`}
          unit="MIN"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Pace เฉลี่ย"
          value={`${paceMin}:${paceSec.toString().padStart(2, "0")}`}
          unit="/KM"
          highlight
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
        <StatCard
          label="Zone 2 %"
          value={session.zone2_pct.toFixed(0)}
          unit="%"
          highlight={session.zone2_pct >= 80}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Z2 Avg Pace"
          value={z2PaceMin > 0 ? `${z2PaceMin}:${z2PaceSec.toString().padStart(2, "0")}` : "-"}
          unit="/KM"
          highlight={z2PaceMin > 0 && z2PaceMin <= 7}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
        <StatCard
          label="Avg Cadence"
          value={session.avg_cadence ? String(session.avg_cadence) : "-"}
          unit="SPM"
          highlight={session.avg_cadence ? session.avg_cadence >= 170 : false}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          label="Efficiency (EF)"
          value={session.efficiency_factor ? session.efficiency_factor.toFixed(2) : "-"}
          unit="Speed/HR"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Aerobic Decoup."
          value={session.aerobic_decoupling_pct !== undefined ? String(session.aerobic_decoupling_pct.toFixed(1)) : "-"}
          unit="%"
          highlight={session.aerobic_decoupling_pct !== undefined && session.aerobic_decoupling_pct <= 5}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Charts */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black">Performance Charts</h3>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> HR
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>{" "}
                  Pace
                </span>
              </div>
            </div>

            {/* Performance Charts */}
            <div className="space-y-12">
              <div className="h-64">
                <p className="text-[10px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.2em] mb-4 flex justify-between">
                  <span>Heart Rate (bpm)</span>
                  <span className="text-zinc-500">
                    Peak:{" "}
                    {Math.max(
                      ...records.map((r: SessionRecord) => r.heart_rate || 0),
                    )}{" "}
                    bpm
                  </span>
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    syncId="performance"
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#f43f5e"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f43f5e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      strokeOpacity={0.1}
                    />
                    <XAxis dataKey="displayTime" hide />
                    <YAxis
                      domain={[40, "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#71717a" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "10px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ display: "none" }}
                    />
                    {profile && profile.resting_hr && profile.max_hr && (
                      <ReferenceArea
                        y1={
                          profile.resting_hr +
                          (profile.max_hr - profile.resting_hr) * 0.6
                        }
                        y2={
                          profile.resting_hr +
                          (profile.max_hr - profile.resting_hr) * 0.7
                        }
                        fill="#3b82f6"
                        fillOpacity={0.05}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="hr"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHr)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <p className="text-[10px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.2em] mb-4 flex justify-between">
                  <span>Speed (m/s)</span>
                  <span className="text-zinc-500">
                    Max:{" "}
                    {Math.max(
                      ...records.map((r: SessionRecord) => r.speed_ms || 0),
                    ).toFixed(1)}{" "}
                    m/s
                  </span>
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    syncId="performance"
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorSpeed"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      strokeOpacity={0.1}
                    />
                    <XAxis
                      dataKey="displayTime"
                      tick={{ fontSize: 9, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                      interval={50}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "10px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{
                        color: "#71717a",
                        fontSize: "10px",
                        marginBottom: "4px",
                      }}
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#71717a" }}
                    />
                    <ReferenceLine 
                      y={2.38} 
                      stroke="#10b981" 
                      strokeDasharray="3 3" 
                      label={{ position: 'insideTopLeft', value: 'Pace 7 Target (2.38 m/s)', fill: '#10b981', fontSize: 10 }} 
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSpeed)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zones Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
              <h3 className="text-lg font-bold mb-6 italic">
                HR Zones Breakdown
              </h3>
              <div className="space-y-5">
                {zoneBreakdown.map((z) => (
                  <div key={z.id} className="group">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                      <span className="group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
                        {z.label}
                      </span>
                      <span>{z.pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-zinc-50 dark:bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-800">
                      <div
                        className={`h-full transition-all duration-1000 ${z.id === "z2" ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-zinc-200 dark:bg-zinc-800"}`}
                        style={{ width: `${z.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Altitude Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold mb-6 italic">
                Elevation Profile
              </h3>
              <div className="flex-1 flex items-end gap-[1px]">
                {records
                  .filter(
                    (_: SessionRecord, i: number) =>
                      i % Math.max(1, Math.floor(records.length / 60)) === 0,
                  )
                  .map((r: SessionRecord, i: number) => {
                    const minAlt = Math.min(
                      ...records.map((r: SessionRecord) => r.altitude_m || 0),
                    );
                    const maxAlt = Math.max(
                      ...records.map((r: SessionRecord) => r.altitude_m || 0),
                    );
                    const range = Math.max(1, maxAlt - minAlt);
                    const h =
                      (((r.altitude_m || 0) - minAlt) / range) * 80 + 10;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-yellow-400/20 dark:bg-yellow-400/10 border-t-2 border-yellow-400/50"
                        style={{ height: `${h}%` }}
                      ></div>
                    );
                  })}
              </div>
              <div className="mt-4 flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                <span>
                  Min:{" "}
                  {Math.min(
                    ...records.map((r: SessionRecord) => r.altitude_m || 0),
                  ).toFixed(0)}
                  m
                </span>
                <span>
                  Max:{" "}
                  {Math.max(
                    ...records.map((r: SessionRecord) => r.altitude_m || 0),
                  ).toFixed(0)}
                  m
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Detailed Metrics */}
          <div className="bg-zinc-950 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg
                className="w-32 h-32"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-8">
              Run Summary
            </p>
            <div className="space-y-6 relative z-10">
              <MetricRow
                label="Avg Heart Rate"
                value={`${session.avg_hr} bpm`}
                color="text-rose-400"
              />
              <MetricRow
                label="Max Heart Rate"
                value={`${session.max_hr} bpm`}
              />
              <MetricRow
                label="Avg Cadence"
                value={`${Math.round(records.reduce((sum: number, r: SessionRecord) => sum + (r.cadence || 0), 0) / (records.filter((r: SessionRecord) => r.cadence).length || 1)) * 2} spm`}
                color="text-blue-400"
              />
              <MetricRow
                label="Total Gain"
                value={`${(Math.max(...records.map((r) => r.altitude_m || 0)) - Math.min(...records.map((r) => r.altitude_m || 0))).toFixed(1)} m`}
              />
              <MetricRow
                label="GPS Samples"
                value={`${records.length.toLocaleString()}`}
              />
            </div>

            <div className="mt-12 pt-8 border-t border-white/10 text-center">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-loose">
                FIT File Import
                <br />
                <span className="text-zinc-400 font-mono italic">
                  {session.raw_fit_path}
                </span>
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8">
            <h4 className="text-zinc-900 dark:text-zinc-100 font-black text-sm mb-4 uppercase tracking-widest">
              Training Effect
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                  <span className="font-black text-lg">
                    {session.zone2_pct < 50
                      ? "C"
                      : session.zone2_pct < 80
                        ? "B"
                        : "A"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold">Aerobic Efficiency</p>
                  <p className="text-[10px] text-zinc-500">
                    Based on Zone 2 percentage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {session.ai_analysis && (
          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">AI Analysis</span>
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z"/></svg>
            </h3>
            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-blue-500 hover:prose-a:underline">
              <ReactMarkdown>
                {session.ai_analysis}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  highlight = false,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[32px] shadow-sm relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900 transition-all">
      <div className="text-zinc-400 mb-4 group-hover:text-blue-500 transition-colors">
        {icon}
      </div>
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">
        {label}
      </p>
      <p
        className={`text-4xl font-black tracking-tighter ${highlight ? "text-blue-600 dark:text-blue-400" : ""}`}
      >
        {value}{" "}
        <span className="text-sm font-bold text-zinc-400 tracking-normal">
          {unit}
        </span>
      </p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  color = "text-zinc-300",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
        {label}
      </span>
      <span className={`font-black text-sm ${color}`}>{value}</span>
    </div>
  );
}
