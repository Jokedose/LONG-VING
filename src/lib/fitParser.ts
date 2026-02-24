import FitParser from 'fit-file-parser';
import { Buffer } from 'buffer';

// Polyfill Buffer for fit-file-parser which depends on it
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

export interface FitRecord {
  timestamp: Date;
  heart_rate?: number;
  speed?: number; // m/s
  distance?: number; // m
  cadence?: number; // rpm
  altitude?: number; // m
}

export interface FitSession {
  timestamp: Date;
  start_time: Date;
  total_elapsed_time: number;
  total_timer_time: number;
  total_distance: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_speed?: number;
}

export interface FitData {
  sessions: FitSession[];
  records: FitRecord[];
}

export async function parseFitBuffer(buffer: ArrayBuffer): Promise<FitData> {
  return new Promise((resolve, reject) => {
    // fit-file-parser expects a Buffer or ArrayBuffer
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: false,
      mode: 'list',
    });

    parser.parse(buffer, (error: any, data: any) => {
      console.log('Parser result:', { error, hasData: !!data });
      if (error) {
        console.error('FIT Parser Error:', error);
        reject(error);
      } else {
        // sessions and records might be in root or in activity depending on mode
        const sessions = data.sessions || (data.activity && data.activity.sessions) || [];
        const records = data.records || [];
        
        console.log(`Parsed ${sessions.length} sessions and ${records.length} records`);
        
        resolve({
          sessions,
          records,
        });
      }
    });
  });
}
