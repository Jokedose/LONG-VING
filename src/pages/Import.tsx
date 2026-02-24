import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseFitBuffer, FitData } from '../lib/fitParser';
import { v4 as uuidv4 } from 'uuid';
import { useUserProfile } from '../store/userStore';
import { sessionRepository } from '../lib/db/sessionRepository';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';

export default function Import() {
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [recentImport, setRecentImport] = useState<FitData | null>(null);
  
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();

  const handleImport = async () => {
    try {
      setStatus('Waiting for file selection...');
      setProgress(0);
      
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'FIT Files',
          extensions: ['fit']
        }]
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        setStatus('Cancelled');
        return;
      }

      setStatus('Reading file...');
      setProgress(10);
      
      const fileBytes = await readFile(selectedPath);
      
      setStatus('Parsing FIT data...');
      setProgress(30);
      
      const fitData = await parseFitBuffer(fileBytes.buffer as ArrayBuffer);
      setRecentImport(fitData);
      
      if (!fitData.sessions || fitData.sessions.length === 0) {
        setStatus('No valid running sessions found in the file.');
        return;
      }

      const session = fitData.sessions[0];
      const startTime = session.start_time.toISOString();

      // Duplicate Detection
      setStatus('Checking for duplicates...');
      const exists = await sessionRepository.isSessionDuplicate(startTime);
      if (exists) {
        setStatus('Session already imported (พบข้อมูลการวิ่งชุดนี้ในระบบแล้ว)');
        setProgress(100);
        return;
      }

      setStatus('Saving session to database...');
      setProgress(50);

      const sessionId = uuidv4();
      
      // Calculate zone 2 percentage
      let zone2_pct = 0;
      if (profile && fitData.records && fitData.records.length > 0) {
        const maxHR = profile?.max_hr || 185;
        const restingHR = profile?.resting_hr || 60;
        const reserve = maxHR - restingHR;
        const z2Min = restingHR + reserve * 0.6;
        const z2Max = restingHR + reserve * 0.7;
        
        const hrRecords = fitData.records.filter(r => r.heart_rate !== undefined);
        const z2Records = hrRecords.filter(r => r.heart_rate! >= z2Min && r.heart_rate! <= z2Max);
        
        if (hrRecords.length > 0) {
          zone2_pct = (z2Records.length / hrRecords.length) * 100;
        }
      }

      const sessionData = {
        id: sessionId,
        started_at: startTime,
        duration_secs: session.total_timer_time || session.total_elapsed_time,
        distance_m: session.total_distance,
        avg_hr: session.avg_heart_rate || 0,
        max_hr: session.max_heart_rate || 0,
        avg_pace_sec_per_km: session.avg_speed ? (1000 / session.avg_speed) : 0,
        zone2_pct,
        raw_fit_path: selectedPath.split('/').pop() || selectedPath
      };

      await sessionRepository.createSession(sessionData);

      if (fitData.records && fitData.records.length > 0) {
        const totalRecords = fitData.records.length;
        setStatus(`Saving ${totalRecords.toLocaleString()} records...`);

        const records = fitData.records.map((r: any) => ({
          timestamp: r.timestamp ? r.timestamp.toISOString() : startTime,
          heart_rate: r.heart_rate ?? null,
          speed_ms: r.enhanced_speed ?? r.speed ?? null,
          distance_m: r.distance ?? null,
          cadence: r.cadence ?? null,
          altitude_m: r.enhanced_altitude ?? r.altitude ?? null
        }));

        const CHUNK_SIZE = 100;
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          await sessionRepository.createRecordsChunk(sessionId, chunk);
          setProgress(50 + Math.floor((i / totalRecords) * 50));
        }
      }

      setStatus('Successfully imported session!');
      setProgress(100);
      // Invalidate sessions cache so Sessions & Dashboard refresh automatically
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message || String(e)}`);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">📁 นำเข้าข้อมูลการวิ่ง</h1>
        <p className="text-gray-500 dark:text-gray-400">Import .fit ไฟล์จากนาฬิกา COROS หรืออื่นๆ</p>
      </header>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
        <div className="mx-auto w-24 h-24 mb-6 text-blue-500">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        
        <button
          onClick={handleImport}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-xl transition-all active:scale-95 text-lg"
        >
          เลือกไฟล์ .fit (Select FIT File)
        </button>
        
        {status && (
          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{status}</p>
            {progress > 0 && progress < 100 && (
               <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
                 <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
               </div>
            )}
          </div>
        )}
      </div>

      {recentImport && recentImport.sessions[0] && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/40 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-green-900 dark:text-green-300 mb-4">✅ Import Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
              <p className="text-xs text-gray-500 mb-1">ระยะทาง</p>
              <p className="font-semibold">{(recentImport.sessions[0].total_distance / 1000).toFixed(2)} km</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
              <p className="text-xs text-gray-500 mb-1">เวลา</p>
              <p className="font-semibold">{Math.floor((recentImport.sessions[0].total_timer_time || 0) / 60)} min</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
              <p className="text-xs text-gray-500 mb-1">Pace เฉลี่ย</p>
              <p className="font-semibold">
                {recentImport.sessions[0].avg_speed ? 
                  `${Math.floor(1000 / recentImport.sessions[0].avg_speed / 60)}:${Math.floor((1000 / recentImport.sessions[0].avg_speed) % 60).toString().padStart(2, '0')}` : '-'}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
              <p className="text-xs text-gray-500 mb-1">HR เฉลี่ย</p>
              <p className="font-semibold">{recentImport.sessions[0].avg_heart_rate} bpm</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
