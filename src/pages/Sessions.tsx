import { useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseFitBuffer } from '../lib/fitParser';
import { v4 as uuidv4 } from 'uuid';
import { sessionRepository, type Session } from '../lib/db/sessionRepository';
import { useUserProfile } from '../store/userStore';
import { queryKeys } from '../lib/queryKeys';
import { format, parseISO } from 'date-fns';
import { AiAnalysisService } from '../lib/aiAnalysisService';

export default function Sessions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile();

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionRepository.getAllSessions(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionRepository.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      setDeleteTargetId(null);
    },
    onError: () => alert('ลบข้อมูลไม่สำเร็จ'),
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportStatus('กำลังเลือกไฟล์...');
    setImportProgress(0);
    try {
      const selectedPath = await open({ multiple: false, filters: [{ name: 'FIT Files', extensions: ['fit'] }] });
      if (!selectedPath || typeof selectedPath !== 'string') {
        setImportStatus('');
        setImporting(false);
        return;
      }
      setImportStatus('กำลังอ่านไฟล์...');
      setImportProgress(10);
      const fileBytes = await readFile(selectedPath);
      setImportStatus('กำลัง Parse FIT...');
      setImportProgress(30);
      const fitData = await parseFitBuffer(fileBytes.buffer as ArrayBuffer);
      if (!fitData.sessions || fitData.sessions.length === 0) {
        setImportStatus('ไม่พบข้อมูลการวิ่งในไฟล์');
        setImporting(false);
        return;
      }
      const session = fitData.sessions[0];
      const startTime = session.start_time.toISOString();
      setImportStatus('ตรวจสอบข้อมูลซ้ำ...');
      const exists = await sessionRepository.isSessionDuplicate(startTime);
      if (exists) {
        setImportStatus('⚠️ พบข้อมูลการวิ่งชุดนี้ในระบบแล้ว');
        setImportProgress(100);
        setTimeout(() => { setImporting(false); setImportStatus(''); }, 2500);
        return;
      }
      setImportStatus('กำลังบันทึก session...');
      setImportProgress(50);
      const sessionId = uuidv4();
      let zone2_pct = 0;
      let avg_cadence = undefined;
      let efficiency_factor = undefined;
      let aerobic_decoupling_pct = undefined;

      if (profile && fitData.records && fitData.records.length > 0) {
        // --- 1. Zone 2 Percentage ---
        const maxHR = profile.max_hr || 185;
        const restingHR = profile.resting_hr || 60;
        const reserve = maxHR - restingHR;
        const z2Min = restingHR + reserve * 0.6;
        const z2Max = restingHR + reserve * 0.7;
        const hrRecs = fitData.records.filter((r: any) => r.heart_rate !== undefined);
        const z2Recs = hrRecs.filter((r: any) => r.heart_rate >= z2Min && r.heart_rate <= z2Max);
        if (hrRecs.length > 0) zone2_pct = (z2Recs.length / hrRecs.length) * 100;

        // --- 2. Average Cadence ---
        const cadenceRecs = fitData.records.filter((r: any) => r.cadence !== undefined && r.cadence > 0);
        if (cadenceRecs.length > 0) {
          // Generally fit parser gives RPM for one leg. Multiply by 2 for SPM for running.
          const sumCadence = cadenceRecs.reduce((sum: number, r: any) => sum + r.cadence, 0);
          avg_cadence = Math.round((sumCadence / cadenceRecs.length) * 2);
        }

        // --- 3. Efficiency Factor (EF) = Normalized Speed (m/min) / Avg HR ---
        const avgHR = session.avg_heart_rate || 0;
        const avgSpeed = session.avg_speed || 0;
        if (avgHR > 0 && avgSpeed > 0) {
          const speedMin = avgSpeed * 60; // m/min
          efficiency_factor = Number((speedMin / avgHR).toFixed(2));
        }

        // --- 4. Aerobic Decoupling (Pa:Hr ratio between 1st and 2nd half) ---
        const speedHrRecs = fitData.records.filter((r: any) => r.heart_rate !== undefined && (r.enhanced_speed ?? r.speed) !== undefined && r.heart_rate > 0);
        if (speedHrRecs.length > 10) {
          const midIndex = Math.floor(speedHrRecs.length / 2);
          const firstHalf = speedHrRecs.slice(0, midIndex);
          const secondHalf = speedHrRecs.slice(midIndex);

          const getRatio = (recs: any[]) => {
            const avgS = recs.reduce((sum: number, r: any) => sum + (r.enhanced_speed ?? r.speed), 0) / recs.length;
            const avgH = recs.reduce((sum: number, r: any) => sum + r.heart_rate, 0) / recs.length;
            return avgH > 0 ? avgS / avgH : 0;
          };

          const ratio1 = getRatio(firstHalf);
          const ratio2 = getRatio(secondHalf);
          if (ratio1 > 0) {
            // Decoupling %: How much did the Speed/HR ratio drop?
            aerobic_decoupling_pct = Number((((ratio1 - ratio2) / ratio1) * 100).toFixed(2));
          }
        }
      }

      await sessionRepository.createSession({
        id: sessionId, started_at: startTime,
        duration_secs: Math.round(session.total_timer_time || session.total_elapsed_time),
        distance_m: session.total_distance, 
        avg_hr: Math.round(session.avg_heart_rate || 0),
        max_hr: Math.round(session.max_heart_rate || 0),
        avg_pace_sec_per_km: session.avg_speed ? (1000 / session.avg_speed) : 0,
        zone2_pct, raw_fit_path: selectedPath.split('/').pop() || selectedPath,
        avg_cadence, efficiency_factor, aerobic_decoupling_pct
      });
      if (fitData.records && fitData.records.length > 0) {
        const totalRecords = fitData.records.length;
        setImportStatus(`กำลังบันทึก ${totalRecords.toLocaleString()} records...`);
        const records = fitData.records.map((r: any) => ({
          timestamp: r.timestamp ? r.timestamp.toISOString() : startTime,
          heart_rate: r.heart_rate !== undefined ? Math.round(r.heart_rate) : undefined,
          speed_ms: r.enhanced_speed ?? r.speed ?? undefined,
          distance_m: r.distance ?? undefined,
          cadence: r.cadence !== undefined ? Math.round(r.cadence) : undefined,
          altitude_m: r.enhanced_altitude ?? r.altitude ?? undefined
        }));
        const CHUNK_SIZE = 100;
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          await sessionRepository.createRecordsChunk(sessionId, records.slice(i, i + CHUNK_SIZE));
          setImportProgress(50 + Math.floor((i / totalRecords) * 50));
        }
      }
      
      setImportStatus('🤖 กำลังให้ AI วิเคราะห์การวิ่ง...');
      try {
        const historicalContext = await sessionRepository.getMonthlySummary();
        const analysis = await AiAnalysisService.analyzeSession(
          {
            id: sessionId, started_at: startTime,
            duration_secs: Math.round(session.total_timer_time || session.total_elapsed_time),
            distance_m: session.total_distance, 
            avg_hr: Math.round(session.avg_heart_rate || 0),
            max_hr: Math.round(session.max_heart_rate || 0),
            avg_pace_sec_per_km: session.avg_speed ? (1000 / session.avg_speed) : 0,
            zone2_pct, raw_fit_path: selectedPath.split('/').pop() || selectedPath
          },
          profile || {},
          historicalContext
        );
        
        if (analysis) {
          await sessionRepository.updateSessionAnalysis(sessionId, analysis);
        }
      } catch (aiErr) {
        console.error("AI Analysis encountered an error, but import was successful:", aiErr);
      }

      setImportStatus('✅ นำเข้าสำเร็จ!');
      setImportProgress(100);
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      setTimeout(() => { setImporting(false); setImportStatus(''); setImportProgress(0); }, 2000);
    } catch (e: any) {
      setImportStatus(`❌ Error: ${e.message || String(e)}`);
      setImporting(false);
    }
  };

  const formatPace = (secPerKm: number) => {
    if (!secPerKm) return '-';
    return `${Math.floor(secPerKm / 60)}:${Math.floor(secPerKm % 60).toString().padStart(2, '0')}`;
  };

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading sessions...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">ประวัติการวิ่ง</h1>
          <p className="text-gray-500 mt-2">บันทึกการซ้อมวิ่งทั้งหมดจากไฟล์ .fit</p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-wait"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          {importing ? 'กำลังนำเข้า...' : 'Import .fit'}
        </button>
      </header>

      {/* Import Progress Banner */}
      {importStatus && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-4">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{importStatus}</p>
          {importProgress > 0 && importProgress < 100 && (
            <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">วันที่ / เวลา</th>
                <th className="px-6 py-4">ระยะทาง</th>
                <th className="px-6 py-4">เวลา</th>
                <th className="px-6 py-4">Pace เฉลี่ย</th>
                <th className="px-6 py-4">HR เฉลี่ย</th>
                <th className="px-6 py-4">% Zone 2</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {sessions.map((s: Session) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium">{format(parseISO(s.started_at), 'dd MMM yyyy, HH:mm')}</td>
                  <td className="px-6 py-4 font-black">{(s.distance_m / 1000).toFixed(2)} km</td>
                  <td className="px-6 py-4">{Math.floor(s.duration_secs / 60)} min</td>
                  <td className="px-6 py-4">{formatPace(s.avg_pace_sec_per_km)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400">
                      ♥ {s.avg_hr}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-gray-100 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${(s.zone2_pct||0) >= 70 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(s.zone2_pct || 0, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`font-semibold text-xs ${(s.zone2_pct||0) >= 70 ? 'text-green-600 dark:text-green-400' : ''}`}>
                        {(s.zone2_pct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-40"
                      title="ลบข้อมูล"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="space-y-3">
                      <p className="text-gray-400 font-medium">ยังไม่มีประวัติการวิ่ง</p>
                      <p className="text-xs text-gray-300">กด "Import .fit" ด้านบนขวาเพื่อเพิ่มข้อมูล</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="ยืนยันการลบประวัติการวิ่ง"
        message="คุณต้องการลบประวัติการวิ่งนี้ใช่หรือไม่? สถิติและข้อมูลการวิ่งทั้งหมดจะถูกลบทิ้ง"
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
