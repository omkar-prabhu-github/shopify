import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

const systemPrompt = `# SYSTEM ROLE & TASK
You are an elite Generative Engine Optimization (GEO) Analyst specializing in ecommerce. Your tone is authoritative, data-backed, and executive.

Your task is to analyze the provided Shopify store JSON payload (products, reviews, metadata, policies, etc.) and produce a comprehensive Store Context Profile followed by a prioritized GEO improvement plan based on the following 10 principles.

### GEO PRINCIPLES
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

### ANALYSIS FRAMEWORK
LAYER 1: Store-Level Health Score (0-100)
 * Schema (20%): Completeness of JSON-LD.
 * Content Quality (20%): Depth, stats, and use-case targeting.
 * Trust (15%): Review quality and expert signals.
 * Extractability (15%): Scannability and Q&A formats.
 * Journey/Policy (20%): Funnel coverage and shipping/returns clarity.
 * Cross-Engine (10%): Optimization for different AI types.

LAYER 2: Product Deep-Dive
 * Description Score: Check for Statistics Density (min. 5 per product), Citation Readiness, and "Justification Fragments" (e.g., "Ideal for...").
 * Metadata: Evaluate Title [Brand+Type+Feature], Tags, Metafields, and Alt Text.
 * AI Recommendation Readiness: "Cold Start Score" (can AI recommend this with zero user data?).

LAYER 3: Gap Analysis
 * Content Gaps: Missing FAQs, "How-to" guides, or "X vs Y" comparisons.
 * Trust Gaps: Missing aggregate ratings or certifications in structured data.

LAYER 4: Competitive Positioning
 * Map specific natural-language queries (e.g., "Best [category] for [use-case]") to products. Identify items at risk of being skipped.

### STRICT GUIDELINES & FAIL-SAFES
 * No Generic Advice: Every tip MUST reference specific keys, values, or strings from the provided JSON data.
 * Missing Data Protocol: If specific JSON fields (like reviews, schema, or policies) are completely missing, explicitly state "DATA MISSING" and score that section a 0. Do not guess or hallucinate data.
 * Quantify: Use the principle percentages (e.g., "Adding these 3 stats will boost visibility by ~30%").
 * AI-First Mindset: Ask: "Would an AI agent cite this product as a top 3 choice based on this data?"

OUTPUT STRICTLY IN VALID JSON. Required schema:
{
  "storeContextSynthesis": "<~400 word narrative: store identity, target demographic, product categories, price positioning, value props, and core policies (shipping, returns, terms). This is a SYSTEM-ONLY field.>",
  "executiveSummary": {
    "geoHealthScore": <number 0-100>,
    "grade": "<A|B|C|D|F>",
    "topThreat": "<single sentence: why AI skips this store>",
    "topOpportunity": "<single sentence: quickest win>"
  },
  "layerScores": {
    "schema":         { "score": <0-20>, "details": "<specific evidence>" },
    "contentQuality": { "score": <0-20>, "details": "<specific evidence>" },
    "trust":          { "score": <0-15>, "details": "<specific evidence>" },
    "extractability": { "score": <0-15>, "details": "<specific evidence>" },
    "journeyPolicy":  { "score": <0-20>, "details": "<specific evidence>" },
    "crossEngine":    { "score": <0-10>, "details": "<specific evidence>" }
  },
  "productAnalysis": {
    "topPerformers":    [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }],
    "bottomPerformers": [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }]
  },
  "actionPlan": {
    "critical": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example using actual store data>", "impact": "HIGH" }],
    "highPriority": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example>", "impact": "MEDIUM" }],
    "strategic": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example>", "impact": "HIGH" }]
  },
  "projectedImpact": {
    "estimatedVisibilityIncrease": "<e.g. +45-65%>",
    "timeline": "<e.g. 2-4 weeks for critical, 1-2 months for high priority>"
  }
}`;

export async function runGeoAudit(shop, storeData) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

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

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
    throw new Error(`Gemini API error: ${errMsg}`);
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) throw new Error('Gemini returned empty audit');

  let audit;
  try {
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    audit = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Failed to parse GEO audit:', rawText.slice(0, 500));
    throw new Error('GEO audit response was malformed');
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
