/**
 * Multi-Model Consensus Audit Engine
 * Queries 3 LLMs concurrently via HF router, aggregates findings.
 */

const SYSTEM_PROMPT = `You are the AgentLens Audit Engine. Analyze the Shopify Store JSON. Find Policy Contradictions, Hard Data Mismatches, and Compliance Risks.
Output ONLY a raw JSON array. No markdown, no backticks, no conversational text.
Schema:
[
  {
    "productId": "ID or 'Global'",
    "title": "Finding Title",
    "severity": "High" | "Medium" | "Low",
    "category": "Contradiction" | "Mismatch" | "Compliance",
    "explanation": "Specific evidence of the error."
  }
]`;

const MODELS = [
  {
    id: 'Qwen',
    provider: 'nscale',
    providerId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
  },
  {
    id: 'Llama',
    provider: 'scaleway',
    providerId: 'llama-3.1-70b-instruct',
  },
  {
    id: 'Mixtral',
    provider: 'nscale',
    providerId: 'mistralai/mixtral-8x22b-instruct-v0.1',
  },
];

export interface AuditFinding {
  productId: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  category: 'Contradiction' | 'Mismatch' | 'Compliance';
  explanation: string;
  fix_suggestion?: string;
  detected_by: string;
}

export interface AuditResult {
  health_score: number;
  summary: string;
  findings: AuditFinding[];
  modelResults: { modelId: string; status: 'success' | 'error'; findingsCount: number; error?: string }[];
}

/**
 * Robustly extract a JSON array from LLM response text.
 * Handles markdown fences, leading/trailing text, nested structures.
 */
function parseFindingsJson(raw: string): any[] {
  // Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  // Try to find a JSON array
  const firstBracket = cleaned.indexOf('[');
  if (firstBracket === -1) {
    // Maybe it returned an object with a findings array
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1) {
      try {
        const obj = JSON.parse(cleaned.slice(firstBrace));
        if (Array.isArray(obj.findings)) return obj.findings;
        if (Array.isArray(obj)) return obj;
      } catch { /* fall through */ }
    }
    return [];
  }

  // Brace-match the array
  let depth = 0;
  let lastBracket = -1;
  for (let i = firstBracket; i < cleaned.length; i++) {
    if (cleaned[i] === '[') depth++;
    if (cleaned[i] === ']') {
      depth--;
      if (depth === 0) { lastBracket = i; break; }
    }
  }

  if (lastBracket === -1) return [];

  try {
    const arr = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Query a single model via the proxy server.
 */
async function queryModel(
  model: typeof MODELS[number],
  storePayload: string,
  token: string,
): Promise<AuditFinding[]> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Here is the Shopify Store JSON:\n\n${storePayload}` },
  ];

  const response = await fetch('http://localhost:3000/api/huggingface', {
    method: 'POST',
    headers: {
      'x-hf-token': token,
      'x-hf-provider': model.provider,
      'x-hf-model': model.providerId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${model.id} API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json();

  // Extract generated text from OpenAI-compatible response
  let generatedText = '';
  if (json?.choices?.[0]?.message?.content) {
    generatedText = json.choices[0].message.content;
  } else if (Array.isArray(json)) {
    const gt = json[0]?.generated_text;
    generatedText = typeof gt === 'object' ? (gt.content || JSON.stringify(gt)) : (gt ?? '');
  } else if (json?.generated_text) {
    generatedText = json.generated_text;
  } else {
    generatedText = JSON.stringify(json);
  }

  const findings = parseFindingsJson(generatedText);

  // Inject detected_by into each finding
  return findings.map((f: any) => ({
    productId: f.productId || 'Global',
    title: f.title || 'Untitled Finding',
    severity: ['High', 'Medium', 'Low'].includes(f.severity) ? f.severity : 'Low',
    category: ['Contradiction', 'Mismatch', 'Compliance'].includes(f.category) ? f.category : 'Mismatch',
    explanation: f.explanation || '',
    fix_suggestion: f.fix_suggestion || '',
    detected_by: model.id,
  }));
}

/**
 * Multi-model consensus analysis.
 * Queries all 3 models concurrently, aggregates findings.
 */
export async function analyzeStore(masterJson: any): Promise<AuditResult> {
  const token = import.meta.env.VITE_HF_API_TOKEN;
  if (!token) {
    throw new Error('Missing VITE_HF_API_TOKEN — add it to .env.local');
  }

  const storePayload = JSON.stringify(masterJson);

  // Fire all 3 models concurrently
  const results = await Promise.allSettled(
    MODELS.map((model) => queryModel(model, storePayload, token))
  );

  // Aggregate results
  const modelResults: AuditResult['modelResults'] = [];
  const masterFindings: AuditFinding[] = [];

  results.forEach((result, i) => {
    const model = MODELS[i];
    if (result.status === 'fulfilled') {
      modelResults.push({
        modelId: model.id,
        status: 'success',
        findingsCount: result.value.length,
      });
      masterFindings.push(...result.value);
    } else {
      console.error(`${model.id} failed:`, result.reason);
      modelResults.push({
        modelId: model.id,
        status: 'error',
        findingsCount: 0,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  // Calculate health score based on findings
  const successfulModels = modelResults.filter((m) => m.status === 'success').length;
  const highCount = masterFindings.filter((f) => f.severity === 'High').length;
  const medCount = masterFindings.filter((f) => f.severity === 'Medium').length;
  const lowCount = masterFindings.filter((f) => f.severity === 'Low').length;

  let healthScore = 100;
  healthScore -= highCount * 15;
  healthScore -= medCount * 7;
  healthScore -= lowCount * 3;
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Generate summary
  let summary = '';
  if (successfulModels === 0) {
    summary = 'All models failed to respond. Please try again.';
  } else if (masterFindings.length === 0) {
    summary = `${successfulModels} model(s) analyzed your store and found no issues. Store looks clean.`;
  } else {
    summary = `${successfulModels} model(s) identified ${masterFindings.length} finding(s) across your store data.`;
  }

  return {
    health_score: healthScore,
    summary,
    findings: masterFindings,
    modelResults,
  };
}
