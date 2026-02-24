import { useEffect, useState } from 'react';
import { useUserProfile, useUpdateProfile } from '../store/userStore';
import { calcHRZones, HRZones } from '../lib/hrCalculator';

export default function Profile() {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();
  
  const [age, setAge] = useState(27);
  const [restingHr, setRestingHr] = useState(62);
  const [maxHr, setMaxHr] = useState(193);
  const [zones, setZones] = useState<HRZones | null>(null);

  useEffect(() => {
    if (profile) {
      setAge(profile.age ?? 27);
      setRestingHr(profile.resting_hr ?? 62);
      setMaxHr(profile.max_hr ?? 193);
    }
  }, [profile]);

  useEffect(() => {
    setZones(calcHRZones(age, restingHr, maxHr));
  }, [age, restingHr, maxHr]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({ id: profile?.id, age, resting_hr: restingHr, max_hr: maxHr });
    alert('Profile saved!');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading Profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">🏃‍♂️ เเผนการวิ่ง (Runner Profile)</h1>
        <p className="text-gray-500 dark:text-gray-400">ตั้งค่าข้อมูลส่วนตัวเพื่อคำนวณ Zone หัวใจด้วยวิธี HRR (Heart Rate Reserve)</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-6">ข้อมูลส่วนตัว (Personal Info)</h2>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">อายุ (Age)</label>
              <input 
                type="number" 
                value={age} 
                onChange={e => setAge(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Resting HR (bpm)</label>
              <input 
                type="number" 
                value={restingHr} 
                onChange={e => setRestingHr(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max HR (bpm)</label>
              <input 
                type="number" 
                value={maxHr} 
                onChange={e => setMaxHr(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-2">ค่าพื้นฐาน = 220 - อายุ ({220 - age}) | ปรับเปลี่ยนได้ถ้าเคยทดสอบ</p>
            </div>
            <button 
              type="submit"
              disabled={updateProfile.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {updateProfile.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล (Save)'}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">เป้าหมาย Zone 2 (Target)</h2>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">สำหรับนาฬิกา COROS Pace Pro และระยะ Pace 7:00</p>
            <div className="flex items-end gap-3 justify-center mb-2">
              <span className="text-5xl font-black tracking-tighter text-blue-600 dark:text-blue-400">
                {zones?.zone2[0]} - {zones?.zone2[1]}
              </span>
              <span className="text-lg font-medium text-blue-500 dark:text-blue-400 pb-1">bpm</span>
            </div>
            <p className="text-center text-sm font-medium text-blue-800/60 dark:text-blue-200/50">Heart Rate Reserve (60% - 70%)</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">ตารางโซนหัวใจ (HR Zones)</h3>
            <div className="space-y-3 font-mono text-sm">
              {[
                { name: 'Zone 5 : VO2Max (90-100%)', range: zones?.zone5, color: 'bg-red-500' },
                { name: 'Zone 4 : Threshold (80-90%)', range: zones?.zone4, color: 'bg-orange-500' },
                { name: 'Zone 3 : Aerobic (70-80%)', range: zones?.zone3, color: 'bg-green-500' },
                { name: 'Zone 2 : Base (60-70%)', range: zones?.zone2, color: 'bg-blue-500', bold: true },
                { name: 'Zone 1 : Recovery (50-60%)', range: zones?.zone1, color: 'bg-gray-400' },
              ].map((z, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${z.bold ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-zinc-800'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${z.color}`}></span>
                    <span className={z.bold ? 'font-bold text-blue-700 dark:text-blue-300' : ''}>{z.name}</span>
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {z.range?.[0]} - {z.range?.[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
