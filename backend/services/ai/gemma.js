import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

export async function runProductAnalysis(shop, product) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const stored = policyStore.get(shop);
  if (!stored) throw new Error('Store context not available. Run a GEO audit first.');

  const systemInstruction = `You are an elite Shopify compliance auditor.
Your job is to find contradictions, legal risks, missing content, SEO issues, pricing errors, or marketing violations in product data relative to the Store Policy.

<CRITICAL_INSTRUCTION>
DO NOT output conversational text. DO NOT output bullet points. DO NOT output markdown.
YOU MUST OUTPUT ONLY A VALID JSON OBJECT STARTING WITH { AND ENDING WITH } OR THE SYSTEM WILL CRASH.
</CRITICAL_INSTRUCTION>

OUTPUT STRICTLY IN VALID JSON. Required schema:
{
  "riskLevel": "HIGH" | "MEDIUM" | "LOW" | "SAFE",
  "overallScore": 0-100,
  "issues": ["missing policy X", "low SEO score"],
  "suggestions": ["add X to description"],
  "seoScore": 0-100,
  "complianceScore": 0-100,
  "contentScore": 0-100
}`;

  const userData = `${systemInstruction}

Global Store Policy:
${stored.policy}

Product Data:
${JSON.stringify(product, null, 2)}`;

  const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_API_KEY}`;
  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: userData }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  });

  const gemmaRes = await httpsRequest(gemmaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  }, payload);

  const data = gemmaRes.json();
  if (!gemmaRes.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Gemma API error: ${errMsg}`);
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) throw new Error('Gemma returned empty response');
  
  console.log('🤖 RAW GEMMA RESPONSE:\n', rawText);

  let analysis;
  try {
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    analysis = JSON.parse(cleanText);
  } catch {
    console.error('Failed to parse Gemma 4 response. Raw output was printed above.');
    analysis = {
      riskLevel: 'MEDIUM', overallScore: 50,
      issues: ['Model returned unparseable output.'],
      suggestions: ['Try running the analysis again.'],
      seoScore: 50, complianceScore: 50, contentScore: 50,
    };
  }

  return analysis;
}
