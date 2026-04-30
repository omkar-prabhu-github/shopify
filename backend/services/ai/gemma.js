import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

// ──────────────────────────────────────────────────────────────────────
// Shared Utilities
// ──────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractJSON(rawText) {
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) { /* fall through */ }

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

// Fetch an image URL and return base64 data for multimodal Gemma
async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mime = contentType.includes('png') ? 'image/png' :
                 contentType.includes('webp') ? 'image/webp' : 'image/jpeg';
    return { mime, base64 };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Product Analysis (Gemma 4 — Multimodal)
// ──────────────────────────────────────────────────────────────────────

const PRODUCT_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    overallScore:    { type: "integer" },
    riskLevel:       { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    seoScore:        { type: "integer" },
    geoScore:        { type: "integer" },
    contentScore:    { type: "integer" },
    imageScore:      { type: "integer" },
    issues:          { type: "array", items: { type: "object", properties: {
      severity:  { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
      category:  { type: "string" },
      title:     { type: "string" },
      detail:    { type: "string" },
    }, required: ["severity", "title", "detail"] } },
    fixes:           { type: "array", items: { type: "object", properties: {
      type:          { type: "string" },
      field:         { type: "string" },
      oldValue:      { type: "string" },
      newValue:      { type: "string" },
      label:         { type: "string" },
    }, required: ["type", "field", "oldValue", "newValue", "label"] } },
  },
  required: ["overallScore", "riskLevel", "seoScore", "geoScore", "contentScore", "imageScore", "issues", "fixes"],
};

export async function runProductAnalysis(shop, product) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const stored = policyStore.get(shop);
  if (!stored) throw new Error('Store context not available. Run a GEO audit first.');

  const systemInstruction = `You are an elite GEO Product Analyst and E-commerce Auditor. Your tone is authoritative, data-backed, and strictly objective.

Analyze the provided product data AND product images (if provided) against the Store Context Policy and the 10 GEO Principles.

### SCORING (Deductive, Anti-Hallucination)
Start each category at 100, deduct ONLY for explicitly found issues:
- CRITICAL (-20): Causes legal/sales loss or total AI blindness
- HIGH (-10): Severely hurts AI visibility
- MEDIUM (-5): Conversion friction or missing stats
- LOW (-2): Minor polish

### EVALUATION CATEGORIES
1. SEO Score: Title optimization (Brand+Type+Feature format), meta description, heading structure, keyword relevance, URL slug quality
2. GEO Score: Citation-readiness, statistics density (min 5 per product), justification fragments ("ideal for...", "best for..."), AI extractability, answer engine inclusion potential
3. Content Score: Description depth, use-case targeting, policy compliance, accuracy vs store context, specification completeness
4. Image Score: Image count (min 3 recommended), alt text presence & quality, image diversity (lifestyle vs product shots), visual quality assessment

### IMAGE ANALYSIS (when images are provided)
Evaluate product images for:
- Professional quality, lighting, and resolution
- Background consistency and branding alignment
- Whether images show the product from multiple angles
- Lifestyle vs product-only shot balance
- Alt text accuracy — does it match actual image content?

### ISSUES FORMAT
Every issue must have: severity (CRITICAL/HIGH/MEDIUM/LOW), category, title, detail.
Categories: seo, geo, content, image, compliance, metadata

### FIXES
For every fixable issue, generate a concrete fix. Supported types: product_title, product_description, product_tags, product_metafield.
Each fix must have exact oldValue and complete newValue ready for the Shopify API.

FORMAT: Return ONLY raw valid JSON. No markdown.

STORE CONTEXT:
${stored.policy}

REQUIRED JSON SCHEMA:
{
  "overallScore": 55,
  "riskLevel": "HIGH",
  "seoScore": 60,
  "geoScore": 40,
  "contentScore": 65,
  "imageScore": 50,
  "issues": [
    { "severity": "CRITICAL", "category": "geo", "title": "No statistics in description", "detail": "Description contains zero quantitative data points. GEO requires min 5 stats for +30-40% visibility." }
  ],
  "fixes": [
    { "type": "product_description", "field": "descriptionHtml", "oldValue": "current desc", "newValue": "improved desc", "label": "Add GEO statistics" }
  ]
}`;

  // Build content parts: text + optional images
  const parts = [];
  parts.push({ text: `Product Data:\n${JSON.stringify(product, null, 2)}` });

  // Fetch and attach product images (up to 3 for token budget)
  const imageUrls = (product.images || []).slice(0, 3).map(img => img.url).filter(Boolean);
  if (imageUrls.length > 0) {
    console.log(`📸 Fetching ${imageUrls.length} product images for "${product.title}"...`);
    const imageResults = await Promise.all(imageUrls.map(url => fetchImageAsBase64(url)));
    for (const img of imageResults) {
      if (img) {
        parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
      }
    }
    console.log(`📸 ${imageResults.filter(Boolean).length} images attached for multimodal analysis`);
  }

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
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
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
        continue;
      }

      const analysis = extractJSON(rawText);
      if (!analysis || typeof analysis.overallScore !== 'number') {
        lastError = new Error('Invalid JSON or missing fields');
        continue;
      }

      console.log(`✅ Product analysis: "${product.title}" → ${analysis.riskLevel} (score: ${analysis.overallScore}, ${analysis.issues?.length || 0} issues)`);
      return analysis;
    } catch (err) {
      lastError = err;
      console.error(`❌ Attempt ${attempt + 1} error:`, err.message);
      if (err.message.includes('not configured') || err.message.includes('not available')) throw err;
    }
  }

  console.error(`❌ All ${MAX_RETRIES + 1} attempts failed for "${product.title}". Last: ${lastError?.message}`);
  return {
    overallScore: 50, riskLevel: 'MEDIUM',
    seoScore: 50, geoScore: 50, contentScore: 50, imageScore: 50,
    issues: [{ severity: 'MEDIUM', category: 'system', title: 'Analysis failed', detail: 'Model returned unparseable output. Try running the analysis again.' }],
    fixes: [],
  };
}

// ──────────────────────────────────────────────────────────────────────
// Blog Analysis (Gemma 4)
// ──────────────────────────────────────────────────────────────────────

const BLOG_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    seoScore:         { type: "integer" },
    readabilityScore: { type: "integer" },
    geoScore:         { type: "integer" },
    overallScore:     { type: "integer" },
    wordCount:        { type: "integer" },
    issues:           { type: "array", items: { type: "string" } },
    suggestions:      { type: "array", items: { type: "string" } },
    fixes:            { type: "array", items: { type: "object", properties: {
      type:      { type: "string" },
      field:     { type: "string" },
      oldValue:  { type: "string" },
      newValue:  { type: "string" },
      label:     { type: "string" },
    }, required: ["type", "field", "oldValue", "newValue", "label"] } },
  },
  required: ["seoScore", "readabilityScore", "geoScore", "overallScore", "wordCount", "issues", "suggestions", "fixes"],
};

export async function runBlogAnalysis(shop, article) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const stored = policyStore.get(shop);

  const systemInstruction = `You are an elite GEO Blog Analyst for e-commerce stores.
Analyze the provided blog article for SEO quality, readability, and Generative Engine Optimization (GEO) readiness.

EVALUATION CRITERIA:
1. SEO Score (0-100): Title optimization, keyword density, meta description, heading structure, internal links potential.
2. Readability Score (0-100): Sentence length, paragraph structure, use of headers, scannability, Flesch reading ease equivalent.
3. GEO Score (0-100): Citation-readiness, statistics density, justification fragments, structured data potential, AI extractability.

ISSUES: List every specific problem found. Reference actual text from the article.
SUGGESTIONS: Concrete, actionable improvements with before/after examples.
FIXES: Generate machine-applicable fixes. Supported types: article_title, article_body, article_tags.

FORMAT: Return ONLY raw valid JSON. Start with "{" and end with "}". No markdown.

${stored ? `STORE CONTEXT:\n${stored.policy}\n` : ''}

REQUIRED JSON SCHEMA:
{
  "seoScore": 60,
  "readabilityScore": 70,
  "geoScore": 45,
  "overallScore": 58,
  "wordCount": 500,
  "issues": ["Title missing primary keyword"],
  "suggestions": ["Add statistics to support claims"],
  "fixes": [{ "type": "article_title", "field": "title", "oldValue": "current", "newValue": "improved", "label": "Optimize title" }]
}`;

  const userData = `Blog Article Data:\n${JSON.stringify(article, null, 2)}`;
  const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_API_KEY}`;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(1500 * attempt);
      console.log(`🔄 Blog analysis retry ${attempt}/${MAX_RETRIES}...`);
    }

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userData }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: BLOG_ANALYSIS_SCHEMA,
      },
    });

    try {
      const res = await httpsRequest(gemmaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, payload);

      const data = res.json();
      if (!res.ok) {
        lastError = new Error(data?.error?.message || `HTTP ${res.status}`);
        continue;
      }

      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        lastError = new Error(`Blocked: ${candidate.finishReason}`);
        continue;
      }

      const rawText = candidate?.content?.parts?.[0]?.text || '';
      if (!rawText) { lastError = new Error('Empty response'); continue; }

      const analysis = extractJSON(rawText);
      if (!analysis || typeof analysis.overallScore !== 'number') {
        lastError = new Error('Invalid JSON');
        continue;
      }

      console.log(`✅ Blog analysis complete: "${article.title}" → score=${analysis.overallScore}`);
      return analysis;
    } catch (err) {
      lastError = err;
    }
  }

  return {
    seoScore: 50, readabilityScore: 50, geoScore: 50, overallScore: 50, wordCount: 0,
    issues: ['Analysis failed after retries.'], suggestions: ['Try again.'], fixes: [],
  };
}

// ──────────────────────────────────────────────────────────────────────
// Blog Generation (Gemma 4)
// ──────────────────────────────────────────────────────────────────────

const BLOG_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    title:           { type: "string" },
    bodyHtml:        { type: "string" },
    tags:            { type: "array", items: { type: "string" } },
    metaDescription: { type: "string" },
    summary:         { type: "string" },
  },
  required: ["title", "bodyHtml", "tags", "metaDescription", "summary"],
};

export async function runBlogGeneration(shop, topic) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const stored = policyStore.get(shop);
  if (!stored) throw new Error('Store context not available. Run a GEO audit first.');

  const systemInstruction = `You are an expert e-commerce content writer specializing in GEO-optimized blog posts.

Write a comprehensive, engaging, GEO-optimized blog article on the given topic for the store described below.

CONTENT REQUIREMENTS:
- 800-1500 words
- Use proper HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- Include at least 5 quantitative statistics (with citations where possible)
- Include at least 3 "justification fragments" (e.g., "ideal for...", "best for...", "recommended because...")
- Include FAQ section at the end with 3-5 questions in Q&A format
- Use scannable structure: short paragraphs, bullet points, subheadings
- Naturally incorporate store products/brand where relevant
- Write for AI extractability: clear, authoritative, citation-ready prose
- Include a compelling meta description (under 160 characters)

STORE CONTEXT:
${stored.policy}

FORMAT: Return ONLY raw valid JSON. Start with "{" and end with "}". No markdown.

REQUIRED JSON SCHEMA:
{
  "title": "Blog post title",
  "bodyHtml": "<h2>Introduction</h2><p>...</p>...",
  "tags": ["tag1", "tag2"],
  "metaDescription": "Under 160 chars...",
  "summary": "1-2 sentence summary"
}`;

  const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_API_KEY}`;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(2000 * attempt);
      console.log(`🔄 Blog generation retry ${attempt}/${MAX_RETRIES}...`);
    }

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: `Write a blog post about: ${topic}` }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        responseSchema: BLOG_GENERATION_SCHEMA,
      },
    });

    try {
      const res = await httpsRequest(gemmaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, payload);

      const data = res.json();
      if (!res.ok) {
        lastError = new Error(data?.error?.message || `HTTP ${res.status}`);
        continue;
      }

      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        lastError = new Error(`Blocked: ${candidate.finishReason}`);
        continue;
      }

      const rawText = candidate?.content?.parts?.[0]?.text || '';
      if (!rawText) { lastError = new Error('Empty response'); continue; }

      const blog = extractJSON(rawText);
      if (!blog || !blog.title || !blog.bodyHtml) {
        lastError = new Error('Invalid blog JSON');
        continue;
      }

      console.log(`✅ Blog generated: "${blog.title}" (${blog.tags?.length || 0} tags)`);
      return blog;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Blog generation failed after ${MAX_RETRIES + 1} attempts. Last: ${lastError?.message}`);
}
