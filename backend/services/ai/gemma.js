import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

const PRODUCT_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    riskLevel:       { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    overallScore:    { type: "integer" },
    issues:          { type: "array", items: { type: "string" } },
    suggestions:     { type: "array", items: { type: "string" } },
    seoScore:        { type: "integer" },
    complianceScore: { type: "integer" },
    contentScore:    { type: "integer" },
  },
  required: ["riskLevel", "overallScore", "issues", "suggestions", "seoScore", "complianceScore", "contentScore"],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractJSON(rawText) {
  // Strip markdown code fences if present
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* fall through */ }

  // Extract outermost JSON object via brace-matching
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;

  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch (_) { return null; }
}

const MAX_RETRIES = 2;

export async function runProductAnalysis(shop, product) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const stored = policyStore.get(shop);
  if (!stored) throw new Error('Store context not available. Run a GEO audit first.');

  const systemInstruction = `You are an elite Shopify compliance auditor.
Your job is to find contradictions, legal risks, missing content, SEO issues, pricing errors, or marketing violations in product data relative to the Store Policy.

FORMAT RESTRICTIONS:
- NO conversational text.
- NO bullet points.
- NO markdown formatting.
- START your response completely with "{" and end it with "}".
- Do not output your thinking process.
- Return ONLY raw, valid JSON.

REQUIRED JSON SCHEMA:
{
  "riskLevel": "HIGH",
  "overallScore": 60,
  "issues": ["missing policy X"],
  "suggestions": ["add X to description"],
  "seoScore": 50,
  "complianceScore": 50,
  "contentScore": 50
}`;

  const userData = `Global Store Policy:
${stored.policy}

Product Data:
${JSON.stringify(product, null, 2)}`;

  const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_API_KEY}`;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = 1500 * attempt;
      console.log(`🔄 Retry ${attempt}/${MAX_RETRIES} for "${product.title}" (${delay}ms)...`);
      await sleep(delay);
    }

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userData }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: PRODUCT_ANALYSIS_SCHEMA,
      },
    });

    try {
      const gemmaRes = await httpsRequest(gemmaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, payload);

      const data = gemmaRes.json();
      if (!gemmaRes.ok) {
        const errMsg = data?.error?.message || JSON.stringify(data);
        lastError = new Error(`Gemma API error: ${errMsg}`);
        console.error(`❌ Attempt ${attempt + 1}: API error — ${errMsg}`);
        continue;
      }

      // Check for blocked/filtered responses
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        lastError = new Error(`Response blocked: ${finishReason}`);
        console.warn(`⚠️ Attempt ${attempt + 1}: finishReason=${finishReason}`);
        continue;
      }

      const rawText = candidate?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        lastError = new Error('Gemma returned empty response');
        console.warn(`⚠️ Attempt ${attempt + 1}: Empty response`);
        continue;
      }

      console.log(`🤖 RAW GEMMA RESPONSE (attempt ${attempt + 1}):\n`, rawText);

      const analysis = extractJSON(rawText);
      if (!analysis) {
        lastError = new Error('No valid JSON found');
        console.warn(`⚠️ Attempt ${attempt + 1}: Failed to extract JSON`);
        continue;
      }

      if (typeof analysis.overallScore !== 'number' || !analysis.riskLevel) {
        lastError = new Error('JSON missing required fields');
        console.warn(`⚠️ Attempt ${attempt + 1}: Missing required fields`);
        continue;
      }

      return analysis;
    } catch (err) {
      lastError = err;
      console.error(`❌ Attempt ${attempt + 1} error:`, err.message);
      if (err.message.includes('not configured') || err.message.includes('not available')) throw err;
    }
  }

  console.error(`❌ All ${MAX_RETRIES + 1} attempts failed for "${product.title}". Last: ${lastError?.message}`);
  return {
    riskLevel: 'MEDIUM', overallScore: 50,
    issues: ['Model returned unparseable output.'],
    suggestions: ['Try running the analysis again.'],
    seoScore: 50, complianceScore: 50, contentScore: 50,
  };
}
