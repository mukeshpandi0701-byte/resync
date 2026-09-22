import fs from 'fs';
import path from 'path';

/**
 * Perform server-side evidence analysis using Google Gemini API.
 * API key is read strictly from process.env.GEMINI_API_KEY.
 * Never logs or exposes the API key or raw credentials.
 */
export async function analyzeMediaWithGemini({ filePath, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Gemini API key is not configured on the server.'
    };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: false,
      error: 'Media file missing or inaccessible.'
    };
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    const prompt = `You are an expert field inspection analyst. Analyze this inspection photo/media evidence.
Return strictly a raw JSON object with NO markdown formatting, NO backticks, NO extra commentary.
The JSON MUST strictly conform to this schema:
{
  "findings": ["string finding 1", "string finding 2"],
  "confidenceScore": 0.95
}
Where:
- findings: an array of strings detailing visual defects, observations, safety issues, or compliance status.
- confidenceScore: a float between 0.0 and 1.0 representing overall confidence in the analysis.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Gemini API service error (${response.status})`
      };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return {
        success: false,
        error: 'Empty response returned by Gemini API'
      };
    }

    const cleanedText = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanedText);

    let findings = [];
    if (Array.isArray(parsed.findings)) {
      findings = parsed.findings.map(f => String(f).trim()).filter(Boolean);
    }

    let confidenceScore = 0;
    const rawScore = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : parsed.confidence_score;
    if (typeof rawScore === 'number' && !isNaN(rawScore)) {
      confidenceScore = Math.max(0, Math.min(1, rawScore));
    }

    return {
      success: true,
      findings,
      confidenceScore
    };
  } catch (err) {
    return {
      success: false,
      error: err.message ? `Analysis failed: ${err.message}` : 'Analysis failed'
    };
  }
}
