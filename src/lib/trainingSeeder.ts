import { trainingPlanRepository, type TrainingSession } from './db/trainingPlanRepository';
import { settingsRepository } from './db/settingsRepository';
import { yearlyPlanData } from './yearlyPlanData';

export async function seedTrainingPlan() {
  // Check if initialization has been done
  const seedFlag = await settingsRepository.getSetting('initial_seed_completed');
  if (seedFlag === 'true') {
    console.log('Seeding skipped: Database already initialized.');
    return;
  }

  console.log('Starting one-time database seeding...');
  
  try {
    const plans = yearlyPlanData.map(week => ({
      id: 0, // Placeholder for backend
      week_number: week.weekNumber,
      month_index: week.monthIndex,
      target_km: week.targetKm,
      phase: week.phase,
      focus_point: '',
      actual_km: 0
    }));

    // 1. Bulk create weeks and get their IDs
    const weekIds = await trainingPlanRepository.bulkCreatePlan(plans);
    
    const allSessionsToCreate: TrainingSession[] = [];

    for (let i = 0; i < yearlyPlanData.length; i++) {
        const week = yearlyPlanData[i];
        const weekId = weekIds[i];
        
        const sessionStrings = week.description.split(' | ');
        const days = [1, 3, 4, 6]; // Mon, Wed, Thu, Sat
        
        for (let j = 0; j < sessionStrings.length; j++) {
            const sessionDesc = sessionStrings[j].trim();
            if (!sessionDesc) continue;
            
            let title = 'General Training';
            let duration = 0;
            let intensity = '';
            
            const lowerDesc = sessionDesc.toLowerCase();
            if (lowerDesc.includes('strides')) title = 'Strides / Easy';
            else if (lowerDesc.includes('long')) title = 'Long Run';
            else if (lowerDesc.includes('tempo')) title = 'Tempo Run';
            else if (lowerDesc.includes('easy')) title = 'Easy Run';
            else if (sessionDesc.includes('วิ่ง')) title = 'Easy Run';

            const durationMatch = sessionDesc.match(/(\d+)\s*นาที/);
            if (durationMatch) duration = parseInt(durationMatch[1]);
            
            const hrMatch = sessionDesc.match(/(\d+-\d+)\s*bpm/);
            if (hrMatch) intensity = hrMatch[1];
            else if (lowerDesc.includes('zone 2')) intensity = 'Zone 2';
            
            allSessionsToCreate.push({
                week_id: weekId,
                day_of_week: days[j] || (j + 1),
                title,
                planned_duration_min: duration,
                intensity_target: intensity,
                description: sessionDesc
            });
        }
    }

    // 2. Bulk create sessions
    await trainingPlanRepository.bulkCreateSessions(allSessionsToCreate);

    // 3. Set completion flag
    await settingsRepository.setSetting('initial_seed_completed', 'true');
    
    console.log('Database initialization and seeding complete!');
  } catch (e) {
    console.error('Seeding failed:', e);
    throw e;
  }
}
