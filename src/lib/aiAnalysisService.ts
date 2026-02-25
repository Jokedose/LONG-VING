import { GoogleGenerativeAI } from "@google/generative-ai";
import { sessionRepository, Session, MonthlySummary } from "./db/sessionRepository";

export class AiAnalysisService {
  private static async getApiKey(): Promise<string | null> {
    try {
      return await sessionRepository.getSetting("gemini_api_key");
    } catch {
      return null;
    }
  }

  static async analyzeSession(
    session: Session,
    profile: any,
    historicalContext: MonthlySummary[]
  ): Promise<string | null> {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        console.warn("No Gemini API key found. Skipping AI Analysis.");
        return null;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
You are an expert running coach and physiologist. Analyze this recent running session in the context of the runner's profile and historical data.

# Runner Profile
- Age: ${profile.age || "N/A"}
- Resting HR: ${profile.resting_hr || "N/A"} bpm
- Max HR: ${profile.max_hr || "N/A"} bpm

# Recent Run (ID: ${session.id})
- Date: ${session.started_at}
- Duration: ${session.duration_secs} seconds
- Distance: ${session.distance_m} meters
- Avg Pace: ${session.avg_pace_sec_per_km} sec/km
- Avg HR: ${session.avg_hr} bpm
- Max HR: ${session.max_hr} bpm
- Zone 2 Time: ${session.zone2_pct.toFixed(1)}%
- Avg Cadence: ${session.avg_cadence ?? "N/A"} SPM
- Efficiency Factor: ${session.efficiency_factor?.toFixed(2) ?? "N/A"} (Speed/HR ratio)
- Aerobic Decoupling: ${session.aerobic_decoupling_pct?.toFixed(2) ?? "N/A"}% (HR Drift)

# Historical Summary (Recent Months)
${historicalContext.map(s => `- ${s.month}: ${s.total_distance_km.toFixed(1)} km across ${s.session_count} runs`).join("\n")}

Provide your analysis in Thai, formatted nicely in Markdown. 
Keep it encouraging but analytical. Include:
1. **สรุปภาพรวม:** How was this run overall? Did they manage Zone 2 well?
2. **วิเคราะห์เชิงลึก (Cadence & Efficiency):** Are they overstriding? Is their cadence near 170-180? Is their HR drifting too much (decoupling > 5%)? 
3. **การเปรียบเทียบจากอดีต:** How does this relate to their historical average? Are they improving their aerobic base?
4. **คำแนะนำสำหรับครั้งถัดไป:** Specific recommendations for their next run to help reach their Pace 7:00 min/km in Zone 2 goal.

Limit to 4 concise paragraphs. Use bullet points where appropriate.
      `.trim();

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.error("AI Analysis failed:", e);
      return null;
    }
  }
}
