import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bodyMetricsRepository, type BodyMetrics } from '../lib/db/bodyMetricsRepository';
import { queryKeys } from '../lib/queryKeys';
import { format, parseISO } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

type ViewMode = 'list' | 'add';

export default function BodyMetricsHistory() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // Manual entry form state
  const [form, setForm] = useState({
    weight_kg: '', body_fat_pct: '', bmi: '', muscle_mass_kg: '',
    bone_mass_kg: '', body_water_pct: '', visceral_fat: '',
    bmr_kcal: '', metabolic_age: '', skeletal_muscle_pct: '',
    fat_free_body_weight_kg: '', subcutaneous_fat_pct: '', protein_pct: '',
    heart_rate: '', recorded_at: new Date().toISOString().slice(0, 16),
  });

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: queryKeys.bodyMetrics.all,
    queryFn: () => bodyMetricsRepository.getAllBodyMetrics(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bodyMetricsRepository.deleteBodyMetrics(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bodyMetrics.all }),
    onError: (e) => alert('ลบข้อมูลไม่สำเร็จ: ' + e),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<BodyMetrics>) => bodyMetricsRepository.addBodyMetrics(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bodyMetrics.all });
      setViewMode('list');
    },
    onError: (e) => alert('บันทึกข้อมูลไม่สำเร็จ: ' + e),
  });

  const handleOCR = async () => {
    setOcrLoading(true);
    setOcrStatus('กำลังเลือกรูปภาพ...');
    try {
      const path = await open({ multiple: false, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
      if (!path || typeof path !== 'string') { setOcrStatus(''); setOcrLoading(false); return; }
      setOcrStatus('กำลังรับข้อมูลจากรูปภาพ (macOS Vision)...');
      const bytes = await readFile(path);
      const base64 = btoa(Array.from(new Uint8Array(bytes)).map(b => String.fromCharCode(b)).join(''));
      
      const text: string = await invoke('recognize_text', { imageBase64: `data:image/png;base64,${base64}` });
      
      console.log('--- RAW OCR TEXT ---');
      console.log(text);
      console.log('--------------------');
      
      setOcrStatus('สำเร็จ! ตรวจสอบข้อมูลที่ดึงมา');
      parseOCRText(text);
      setViewMode('add');
    } catch (e: any) {
      setOcrStatus('OCR Error: ' + e.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const parseOCRText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const findValue = (keywords: string[], expectedUnit?: '%' | 'kg' | 'kcal' | 'bpm') => {
      let fallbackMatch = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        const lineNoSpace = line.replace(/\s+/g, '');
        
        if (keywords.some(kw => lineNoSpace.includes(kw.toLowerCase().replace(/\s+/g, '')))) {
            const checkTexts = [i > 0 ? lines[i-1] : '', line];
            
            // First pass: try to find with expected unit
            if (expectedUnit) {
                for (const textToSearch of checkTexts) {
                    const t = textToSearch.toLowerCase();
                    if (expectedUnit === '%' && t.includes('%')) {
                        const m = t.match(/(\d+\.\d+|\d+)\s*%/);
                        if (m) return m[1];
                    }
                    if (expectedUnit === 'kg' && (t.includes('กก') || t.includes('kg'))) {
                        const m = t.match(/(\d+\.\d+|\d+)\s*(กก|kg)/);
                        if (m) return m[1];
                    }
                    if (expectedUnit === 'kcal' && (t.includes('kcal') || t.includes('แคล'))) {
                        const m = t.match(/(\d+\.\d+|\d+)\s*(kcal|แคล)/);
                        if (m) return m[1];
                    }
                    if (expectedUnit === 'bpm' && t.includes('bpm')) {
                        const m = t.match(/(\d+\.\d+|\d+)\s*bpm/);
                        if (m) return m[1];
                    }
                }
            }
            
            // Store fallback if we haven't found a unit-matched value yet
            if (!fallbackMatch) {
                for (const textToSearch of checkTexts) {
                    const m = textToSearch.match(/(\d+\.\d+|\d+)/);
                    if (m) {
                        fallbackMatch = m[1];
                        break;
                    }
                }
            }
        }
      }
      return fallbackMatch;
    };

    let weight = '';
    for (const line of lines) {
      const match = line.match(/^(\d{2,3}\.\d+)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val >= 20 && val <= 250) {
          weight = match[1];
          break;
        }
      }
    }

    const newForm = {
      weight_kg:               weight || findValue(['น้ำหนัก', 'weight'], 'kg'),
      bmi:                     findValue(['bmi']),
      body_fat_pct:            findValue(['ไขมันในร่างกาย', 'body fat'], '%'),
      muscle_mass_kg:          findValue(['มวลกล้ามเนื้อ', 'muscle mass'], 'kg'),
      body_water_pct:          findValue(['น้ำในร่างกาย', 'water'], '%'),
      bone_mass_kg:            findValue(['ปริมาณแร่ธาตุ', 'bone mass'], 'kg'),
      visceral_fat:            findValue(['อวัยวะภายใน', 'visceral', 'ระดับไขมัน']),
      bmr_kcal:                findValue(['เผาผลาญ', 'bmr'], 'kcal'),
      metabolic_age:           findValue(['อายุร่างกาย', 'metabolic age']),
      skeletal_muscle_pct:     findValue(['เปอร์เซ็นต์ของกล้ามเนื้อ', 'กล้ามเนื้อลาย'], '%'),
      fat_free_body_weight_kg: findValue(['ปราศจากไขมัน', 'fat-free'], 'kg'),
      protein_pct:             findValue(['โปรตีน', 'protein'], '%'),
      heart_rate:              findValue(['เต้นของหัวใจ', 'heart rate'], 'bpm'),
    };
    
    console.log('--- NORMALIZED FORM ---');
    console.log(newForm);
    console.log('-----------------------');

    setForm(prev => ({ ...prev, ...newForm }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = (v: string) => v ? parseFloat(v) : undefined;
    const ni = (v: string) => v ? parseInt(v) : undefined;
    addMutation.mutate({
      recorded_at: form.recorded_at ? new Date(form.recorded_at).toISOString() : new Date().toISOString(),
      weight_kg: parseFloat(form.weight_kg) || 0,
      body_fat_pct: n(form.body_fat_pct), bmi: n(form.bmi),
      muscle_mass_kg: n(form.muscle_mass_kg), bone_mass_kg: n(form.bone_mass_kg),
      body_water_pct: n(form.body_water_pct), visceral_fat: ni(form.visceral_fat),
      bmr_kcal: ni(form.bmr_kcal), metabolic_age: ni(form.metabolic_age),
      skeletal_muscle_pct: n(form.skeletal_muscle_pct),
      fat_free_body_weight_kg: n(form.fat_free_body_weight_kg),
      subcutaneous_fat_pct: n(form.subcutaneous_fat_pct),
      protein_pct: n(form.protein_pct), heart_rate: ni(form.heart_rate),
    });
  };

  const latestMetric = useMemo(() => metrics[0], [metrics]);

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">⚖️ ประวัติร่างกาย</h1>
          <p className="text-zinc-500 mt-1">ข้อมูลย้อนหลังจากเครื่องชั่งน้ำหนักอัจฉริยะ</p>
        </div>
        <div className="flex gap-2">
          {/* OCR Button */}
          <button
            onClick={handleOCR}
            disabled={ocrLoading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-500/20 disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            {ocrLoading ? 'กำลังสแกน...' : 'OCR รูปภาพ'}
          </button>
          {/* Manual Add Button */}
          <button
            onClick={() => setViewMode(viewMode === 'add' ? 'list' : 'add')}
            className={`flex items-center gap-2 font-bold py-2.5 px-4 rounded-xl transition-all active:scale-95 ${
              viewMode === 'add'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {viewMode === 'add' ? 'ยกเลิก' : 'บันทึกด้วยมือ'}
          </button>
        </div>
      </header>

      {/* OCR Status */}
      {ocrStatus && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30 rounded-2xl px-5 py-3 text-sm font-medium text-violet-700 dark:text-violet-300">
          {ocrStatus}
        </div>
      )}

      {/* Add / Edit Form */}
      {viewMode === 'add' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-black mb-6">บันทึกข้อมูลร่างกาย</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'recorded_at', label: 'วันที่/เวลา', type: 'datetime-local', required: true },
              { key: 'weight_kg', label: 'น้ำหนัก (kg)', type: 'number', required: true },
              { key: 'body_fat_pct', label: 'Body Fat (%)', type: 'number' },
              { key: 'bmi', label: 'BMI', type: 'number' },
              { key: 'muscle_mass_kg', label: 'Muscle Mass (kg)', type: 'number' },
              { key: 'bone_mass_kg', label: 'Bone Mass (kg)', type: 'number' },
              { key: 'body_water_pct', label: 'Body Water (%)', type: 'number' },
              { key: 'visceral_fat', label: 'Visceral Fat', type: 'number' },
              { key: 'bmr_kcal', label: 'BMR (kcal)', type: 'number' },
              { key: 'metabolic_age', label: 'Metabolic Age', type: 'number' },
              { key: 'skeletal_muscle_pct', label: 'Skeletal Muscle (%)', type: 'number' },
              { key: 'fat_free_body_weight_kg', label: 'Fat-free Weight (kg)', type: 'number' },
              { key: 'protein_pct', label: 'Protein (%)', type: 'number' },
              { key: 'heart_rate', label: 'Heart Rate (bpm)', type: 'number' },
            ].map(f => (
              <div key={f.key} className={f.key === 'recorded_at' ? 'col-span-2' : ''}>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{f.label}</label>
                <input
                  type={f.type}
                  step="0.1"
                  required={f.required}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 flex gap-3 mt-2">
              <button type="submit" disabled={addMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50">
                {addMutation.isPending ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Latest Snapshot Card */}
      {latestMetric && viewMode === 'list' && (
        <div className="bg-zinc-950 text-white rounded-3xl p-6 flex flex-wrap gap-6 shadow-xl shadow-zinc-900/30">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">น้ำหนักล่าสุด</p>
            <p className="text-4xl font-black mt-1">{latestMetric.weight_kg.toFixed(1)} <span className="text-lg font-normal text-zinc-400">kg</span></p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Body Fat</p>
            <p className="text-4xl font-black mt-1">{latestMetric.body_fat_pct?.toFixed(1) || '--'} <span className="text-lg font-normal text-zinc-400">%</span></p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Muscle</p>
            <p className="text-4xl font-black mt-1">{latestMetric.muscle_mass_kg?.toFixed(1) || '--'} <span className="text-lg font-normal text-zinc-400">kg</span></p>
          </div>
          <div className="ml-auto self-end text-right">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Last Recorded</p>
            <p className="text-sm text-zinc-400">{format(parseISO(latestMetric.recorded_at), 'dd MMM yyyy')}</p>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="grid grid-cols-1 gap-3">
        {metrics.map((m: BodyMetrics) => (
          <div key={m.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">วันที่</p>
                <p className="text-sm font-black">{format(parseISO(m.recorded_at), 'dd MMM yy HH:mm')}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">น้ำหนัก</p>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">{m.weight_kg.toFixed(1)} <span className="text-[10px] font-normal text-zinc-400">kg</span></p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Body Fat</p>
                <p className="text-xl font-black">{m.body_fat_pct?.toFixed(1) || '--'} <span className="text-[10px] font-normal text-zinc-400">%</span></p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Muscle</p>
                <p className="text-xl font-black">{m.muscle_mass_kg?.toFixed(1) || '--'} <span className="text-[10px] font-normal text-zinc-400">kg</span></p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => m.id !== undefined && window.confirm('ลบข้อมูลนี้?') && deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-zinc-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="ลบ"
                >🗑️</button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800/50 grid grid-cols-3 md:grid-cols-6 gap-2">
              <MiniMetric label="BMI"      value={m.bmi?.toFixed(1)} />
              <MiniMetric label="Water"    value={m.body_water_pct?.toFixed(1)} suffix="%" />
              <MiniMetric label="Visceral" value={m.visceral_fat} />
              <MiniMetric label="BMR"      value={m.bmr_kcal} suffix=" kcal" />
              <MiniMetric label="Bone"     value={m.bone_mass_kg?.toFixed(1)} suffix=" kg" />
              <MiniMetric label="Age"      value={m.metabolic_age} />
            </div>
          </div>
        ))}

        {metrics.length === 0 && (
          <div className="p-16 text-center bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <p className="text-zinc-400 italic">ยังไม่มีข้อมูล — ใช้ปุ่ม "OCR รูปภาพ" หรือ "บันทึกด้วยมือ" ด้านบน</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, suffix = '' }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">{label}</p>
      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
        {value !== undefined && value !== null ? value + suffix : '--'}
      </p>
    </div>
  );
}
