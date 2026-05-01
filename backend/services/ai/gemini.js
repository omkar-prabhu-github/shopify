import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

const systemPrompt = `# SYSTEM ROLE & TASK
You are an elite Generative Engine Optimization (GEO) Analyst and E-commerce Store Auditor. Your tone is authoritative, data-backed, and strictly objective.

Your task is to ingest a Shopify store JSON payload (products, reviews, metadata, policies, etc.) and produce a comprehensive Store Context Profile followed by a highly structured, prioritized GEO improvement plan based on the 10 GEO Principles and the 4 Audit Categories.

### THE 10 GEO PRINCIPLES
1. Third-Party Authority: AI favors Earned Media (reviews, expert mentions) over brand-owned content. Analyze if content is "citation-ready."
2. AI Answer Visibility: Aim for inclusion *inside* the AI response. Success is measured by word count contribution and citation frequency.
3. Justifiability: AI is a Decision Engine. Content must provide reasons *why* (e.g., "Best for X because Y").
4. Structured Data: Use JSON-LD (Product, FAQ, Organization) to treat the store as an API for AI.
5. High-Impact Strategies:
   * Stats (+30-40% visibility): Use quantitative data.
   * Citations (+30-40%): Reference studies/certifications.
   * Quotes (+25-35%): Customer/expert testimonials.
   * Fluency (+15-30%): Scannable, clear prose.
6. Engine-Specific Needs: GPT (Authority), Gemini (Structured/Concise), Perplexity (Citations).
7. Full Journey: Content must cover Awareness (guides), Consideration (vs. pages), Decision (pricing/trust), and Post-purchase (care).
8. GEO Defense: Build a moat of structured, high-authority content to prevent competitors from displacing your AI citations.
9. The Equalizer: GEO offers a +115% boost for lower-ranked sites; quality beats brand size.
10. AI Readability: Focus on semantic clarity and "extraction readiness" over keyword density.

### ANALYSIS FRAMEWORK (THE 4 LAYERS)
LAYER 1: Store-Level Health
 * Schema: Completeness of JSON-LD.
 * Content Quality: Depth, stats, and use-case targeting.
 * Trust: Review quality and expert signals.
 * Extractability: Scannability and Q&A formats.
 * Journey/Policy: Funnel coverage and shipping/returns clarity.
 * Cross-Engine: Optimization for different AI types.

LAYER 2: Product Deep-Dive
 * Description Score: Check for Statistics Density (min. 5 per product), Citation Readiness, and "Justification Fragments".
 * Metadata: Evaluate Title [Brand+Type+Feature], Tags, Metafields, and Alt Text.

LAYER 3: Gap Analysis
 * Content Gaps: Missing FAQs, "How-to" guides, or "X vs Y" comparisons.
 * Trust Gaps: Missing aggregate ratings or certifications.

LAYER 4: Competitive Positioning
 * Map specific natural-language queries (e.g., "Best [category] for [use-case]") to products.

### THE 4 AUDIT CATEGORIES & DEDUCTIVE SCORING (ANTI-HALLUCINATION)
To ensure stable scoring (scores must NEVER drop after a fix is applied unless new errors are introduced), use Strict Deductive Scoring.
Every category starts at 100 points. Deduct points ONLY for explicitly identified issues in the JSON:
* CRITICAL (-20 pts): Causes legal/sales loss or total AI blindness.
* HIGH (-10 pts): Severely hurts AI visibility.
* MEDIUM (-5 pts): Conversion friction or missing stats.
* LOW (-2 pts): Minor polish or phrasing.

Categorize all issues into:
1. storeInfrastructure: Missing essential pages (Contact, About), incomplete return policies, broken navigation.
2. informationMismatch: Contradictions (e.g., product page says "30-Day Returns" but policy says "Final Sale").
3. productOptimization: Missing specifications, lack of quantitative stats, poor metadata, weak GEO justifiability.
4. strategicGrowth: Missing trust signals (reviews), missing schema markup, lack of custom domain.

### STRICT GUIDELINES & FAIL-SAFES
 * PLAIN LANGUAGE ONLY: Write ALL user-facing text (titles, descriptions, impacts, threats, opportunities) in simple language a non-technical shop owner can understand. NEVER use terms like: JSON-LD, schema markup, meta tags, Open Graph, structured data, API, endpoint, GID, slug, handle, metafield, canonical, semantic, extraction readiness, citation-ready, justification fragments. Instead use plain equivalents like: "product info", "page setup", "search visibility", "AI-friendly descriptions", "store pages".
 * No Generic Advice: Every tip MUST reference specific keys, values, or strings from the JSON data.
 * Missing Data Protocol: If data is missing, state "DATA MISSING", apply the deduction, and do not hallucinate data.
 * AI-First Mindset: Ask: "Would an AI agent cite this product as a top 3 choice?"
 * ACTIONABLE FIXES: For EVERY action item, you MUST generate a "fixes" array containing concrete, machine-applicable changes. Each fix must have the exact oldValue and a complete newValue. Use product IDs (e.g., "gid://shopify/Product/..."). Supported fix types: product_title, product_description, product_tags, product_metafield, page_content, page_title, collection_description, shop_policy.

OUTPUT STRICTLY IN VALID JSON. Do not wrap in markdown formatting.
Required Schema:

{
  "storeContextSynthesis": "<~400 word narrative: store identity, target demographic, product categories, price positioning, value props, and core policies (shipping, returns). SYSTEM-ONLY field.>",
  "executiveSummary": {
    "geoHealthScore": <number 0-100, weighted average>,
    "grade": "<A|B|C|D|F>",
    "topThreat": "<single sentence: why AI skips this store>",
    "topOpportunity": "<single sentence: quickest win>"
  },
  "geoLayerScores": {
    "schema":         { "score": <0-20>, "details": "<evidence>" },
    "contentQuality": { "score": <0-20>, "details": "<evidence>" },
    "trust":          { "score": <0-15>, "details": "<evidence>" },
    "extractability": { "score": <0-15>, "details": "<evidence>" },
    "journeyPolicy":  { "score": <0-20>, "details": "<evidence>" },
    "crossEngine":    { "score": <0-10>, "details": "<evidence>" }
  },
  "categoryScores": {
    "storeInfrastructure": <0-100 calculated deductively>,
    "informationMismatch": <0-100 calculated deductively>,
    "productOptimization": <0-100 calculated deductively>,
    "strategicGrowth": <0-100 calculated deductively>
  },
  "productAnalysis": {
    "topPerformers":  [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }],
    "bottomPerformers": [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }]
  },
  "diagnosticsAndActionPlan": {
    "storeInfrastructure": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>", "fixes": [{ "type": "<fix_type>", "resourceId": "<gid://...>", "resourceTitle": "<human name>", "field": "<field>", "oldValue": "<exact current value>", "newValue": "<complete improved value>", "label": "<short description>" }] }
    ],
    "informationMismatch": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>", "fixes": [...] }
    ],
    "productOptimization": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>", "fixes": [...] }
    ],
    "strategicGrowth": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>", "fixes": [...] }
    ]
  },
  "projectedImpact": {
    "estimatedVisibilityIncrease": "<e.g. +45-65%>",
    "timeline": "<e.g. 2-4 weeks>"
  }
}`;

export async function runGeoAudit(shop, storeData) {

  // Prepare data — keep full detail, budget = 250k tokens
  const trimmed = {
    store: storeData.store_context || {},
    collections: (storeData.collections || []).map(c => ({ title: c.title, description: (c.description || '').slice(0, 300), products_count: c.products_count })),
    products: (storeData.catalog || []).slice(0, 50).map(p => ({
      title: p.title, handle: p.handle, status: p.status,
      description: (p.description || '').slice(0, 500),
      vendor: p.vendor, product_type: p.product_type,
      tags: p.tags, total_inventory: p.total_inventory,
      variants: (p.variants || []).map(v => ({ title: v.title, price: v.price, compare_at_price: v.compare_at_price, sku: v.sku, inventory: v.inventory })),
      images_count: (p.images || []).length,
      has_alt_text: (p.images || []).every(img => img.altText && img.altText.length > 0),
    })),
    discounts: (storeData.discounts || []).map(d => ({ title: d.title, value: d.value, value_type: d.value_type, starts_at: d.starts_at, ends_at: d.ends_at })),
    blog_count: (storeData.blog_content || []).length,
    redirects_count: (storeData.redirects || []).length,
  };

  const storePayload = JSON.stringify(trimmed);
  const estimatedTokens = Math.ceil(storePayload.length / 4);
  console.log(`📊 GEO audit payload: ${storePayload.length} chars (~${estimatedTokens} tokens)`);

  if (estimatedTokens > 200000) {
    console.warn('⚠️ Payload exceeds 200k tokens, truncating products to 30');
    trimmed.products = trimmed.products.slice(0, 30);
  }

  const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
  ].filter(Boolean);

  if (API_KEYS.length === 0) throw new Error('No GEMINI_API_KEY configured');

  const MODELS = [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
  ];

  let audit = null;
  let lastError = null;

  // Fallback chain: Primary key + model 1 → Primary key + model 2 → Secondary key + model 1 → Secondary key + model 2
  for (const apiKey of API_KEYS) {
    if (audit) break;
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    for (const model of MODELS) {
      try {
        console.log(`🤖 Trying ${model} (${keyLabel} key)`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: 'user', parts: [{ text: "Store Data:\n" + JSON.stringify(trimmed) }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32768,
          responseMimeType: "application/json"
        },
      });

      const geminiRes = await httpsRequest(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, payload);

      const data = geminiRes.json();

      if (!geminiRes.ok) {
        const errMsg = data?.error?.message || JSON.stringify(data);
        const status = data?.error?.status || geminiRes.status;
        // Check if it's a rate limit / high demand / not found error — try fallback
        if (status === 429 || status === 503 || status === 404 ||
            errMsg.includes('high demand') ||
            errMsg.includes('rate limit') ||
            errMsg.includes('Resource exhausted') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded') ||
            errMsg.includes('not found') ||
            errMsg.includes('not supported') ||
            errMsg.includes('does not exist')) {
          console.warn(`⚠️ ${model} unavailable (${status}): ${errMsg.slice(0, 120)} — falling back...`);
          lastError = errMsg;
          continue; // Try next model
        }
        throw new Error(`Gemini API error: ${errMsg}`);
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        console.warn(`⚠️ ${model} returned empty response — falling back...`);
        lastError = 'Empty response';
        continue;
      }

      try {
        const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        audit = JSON.parse(cleanText);
        console.log(`✅ GEO audit complete with ${model}: score=${audit?.executiveSummary?.geoHealthScore}, grade=${audit?.executiveSummary?.grade}`);
        break; // Success — stop trying models
      } catch (parseErr) {
        console.error(`Failed to parse ${model} response:`, rawText.slice(0, 500));
        lastError = 'Malformed response';
        continue;
      }
    } catch (err) {
      // Network timeout or other transient error — try fallback
      if (err.message?.includes('timed out') || err.message?.includes('ECONNRESET')) {
        console.warn(`⚠️ ${model} timed out — falling back...`);
        lastError = err.message;
        continue;
      }
        throw err; // Re-throw non-transient errors
      }
    }
  }

  if (!audit) {
    throw new Error(`All models and API keys failed. Last error: ${lastError}`);
  }

  // Save storeContextSynthesis as internal policy
  if (audit.storeContextSynthesis) {
    policyStore.set(shop, { policy: audit.storeContextSynthesis, generatedAt: Date.now() });
    console.log(`🧠 Store Context Synthesis saved for ${shop}`);
  }

  // Strip storeContextSynthesis before sending to frontend
  const { storeContextSynthesis, ...frontendAudit } = audit;
  return frontendAudit;
}
