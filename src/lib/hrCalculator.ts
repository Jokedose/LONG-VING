export interface HRZones {
  zone1: [number, number]; // Recovery
  zone2: [number, number]; // Aerobic Base
  zone3: [number, number]; // Aerobic
  zone4: [number, number]; // Threshold
  zone5: [number, number]; // VO2Max
}

/**
 * Calculates HR Zones using the Heart Rate Reserve (HRR) method / Karvonen Formula
 */
export function calcHRZones(age: number, restingHR: number, customMaxHR?: number): HRZones {
  const maxHR = customMaxHR || (220 - age);
  const hrr = maxHR - restingHR;
  
  const zone = (lo: number, hi: number): [number, number] => [
    Math.round(restingHR + lo * hrr),
    Math.round(restingHR + hi * hrr),
  ];
  
  return {
    zone1: zone(0.50, 0.60),
    zone2: zone(0.60, 0.70),
    zone3: zone(0.70, 0.80),
    zone4: zone(0.80, 0.90),
    zone5: zone(0.90, 1.00),
  };
}
