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

// Get all available API keys for fallback
function getApiKeys() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
  ].filter(Boolean);
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured');
  return keys;
}

export async function runProductAnalysis(shop, product) {
  const API_KEYS = getApiKeys();

  const stored = policyStore.get(shop);
  if (!stored) throw new Error('Store context not available. Run a GEO audit first.');

  const systemInstruction = `You are Axiom's elite GEO Product Analyst — the most rigorous e-commerce product auditor in existence. You run 15 distinct diagnostic tests on every product. Your analysis is forensic, data-backed, and mercilessly honest. You NEVER inflate scores.

STORE CONTEXT (treat as ground truth for brand voice, pricing, and policy compliance):
${stored.policy}

═══════════════════════════════════════════════════════════
SCORING METHODOLOGY (Deductive — start at 100, deduct for violations)
═══════════════════════════════════════════════════════════
Each of the 4 category scores starts at 100.
- CRITICAL violation: −20 (blocks sales, breaks compliance, or causes total AI blindness)
- HIGH violation: −10 (severely degrades visibility or trust)
- MEDIUM violation: −5 (friction, missed optimization, suboptimal content)
- LOW violation: −2 (minor polish, style, or best-practice deviation)
overallScore = weighted average: SEO 25%, GEO 30%, Content 25%, Image 20%
riskLevel: ≥75 LOW, ≥50 MEDIUM, ≥30 HIGH, <30 CRITICAL

═══════════════════════════════════════════════════════════
15 DIAGNOSTIC TESTS — Run every single one and report violations
═══════════════════════════════════════════════════════════

── SEO TESTS (seoScore) ──
T1. TITLE STRUCTURE: Must follow "Brand + Product Type + Key Differentiator" (e.g., "Axiom Pro Carbon Snowboard — Lightweight All-Mountain"). Check character count (50-60 ideal). Flag keyword stuffing or generic titles.
T2. META DESCRIPTION / SNIPPET READINESS: Does the description's first 155 chars form a compelling, keyword-rich snippet? If the description starts with filler, flag it.
T3. KEYWORD DENSITY & PLACEMENT: Identify the primary keyword from the title. Check if it appears in: description first paragraph, tags, variant names. Flag if density is <1% or >3%.
T4. URL SLUG QUALITY: Check the product handle. Flag if it contains numbers, special chars, or doesn't include the primary keyword. Ideal: short, hyphenated, keyword-rich.

── GEO TESTS (geoScore) ──
T5. STATISTICS DENSITY: Count exact quantitative data points in the description (weights, dimensions, percentages, comparisons, ratings). Minimum 5 required for GEO visibility. Flag each missing stat.
T6. JUSTIFICATION FRAGMENTS: Count phrases like "ideal for", "best for", "recommended for", "designed for", "perfect for". Minimum 3 required. These are what AI engines extract for recommendations.
T7. CITATION READINESS: Can an AI engine directly quote a factual sentence from this listing? Check for authoritative, self-contained statements. Flag vague or subjective-only copy.
T8. COMPARISON ANCHORS: Does the description position the product against alternatives or use-cases? (e.g., "Unlike traditional X, this Y offers Z"). Flag if no competitive context exists.

── CONTENT TESTS (contentScore) ──
T9. DESCRIPTION DEPTH: Word count check. <50 words = CRITICAL, <100 = HIGH, <200 = MEDIUM. Check for use-case targeting (who is this for?), feature-benefit mapping, and specification completeness.
T10. DESCRIPTION ↔ IMAGE CROSS-VALIDATION: Compare what the description claims with what the images actually show. Flag mismatches: if description says "available in 5 colors" but images show 1 color. If description mentions a feature not visible in images. If images show details not mentioned in copy.
T11. STORE POLICY COMPLIANCE: Cross-reference product claims against the store context. Flag contradictions (e.g., "free shipping" if store policy doesn't offer it). Check brand voice consistency.
T12. TAG QUALITY: Check tag relevance, count (ideal 5-15), and coverage. Flag missing category tags, season tags, or use-case tags. Flag duplicate or overly broad tags like "sale" without context.

── IMAGE TESTS (imageScore) ──
T13. IMAGE COUNT & DIVERSITY: Minimum 3 images recommended. Check for: main hero shot, detail/closeup, lifestyle/in-use shot, scale reference. Flag if all images are identical angles.
T14. ALT TEXT AUDIT: Every image needs descriptive alt text. Check if alt text matches actual image content (not just product title copy-pasted). Flag missing or generic alt text.
T15. VISUAL QUALITY ASSESSMENT: (When images are provided) Evaluate: lighting consistency, background professionalism, resolution adequacy, brand alignment. Flag watermarks, low-res, or cluttered backgrounds.

═══════════════════════════════════════════════════════════
ISSUE REPORTING
═══════════════════════════════════════════════════════════
For EVERY test that finds a violation, create an issue with:
- severity: CRITICAL / HIGH / MEDIUM / LOW
- category: seo / geo / content / image / compliance
- title: Short, specific, in PLAIN LANGUAGE a shop owner understands (e.g., "Only 2 statistics in description — minimum 5 required")
- detail: Explain what's wrong in simple, non-technical language. Quote the specific problematic text. Do NOT include test numbers (T1, T2, etc.) or technical terms like JSON-LD, schema, meta tags, slug, handle, canonical, semantic, extraction readiness, justification fragments. Use plain words like "product page URL", "product info", "AI-friendly", "search engines".

═══════════════════════════════════════════════════════════
FIX GENERATION
═══════════════════════════════════════════════════════════
For every issue that CAN be fixed via Shopify API, generate a concrete fix:
- type: product_title | product_description | product_tags | product_metafield
- field: title | descriptionHtml | tags | [metafield namespace.key]
- oldValue: EXACT current value (copy from product data)
- newValue: COMPLETE replacement (not a diff — the full new value ready for API)
- label: Short, plain-language description (e.g., "Rewrite title to include brand name and product type")

For product_description fixes: rewrite the ENTIRE description with all improvements applied (statistics added, justification fragments inserted, GEO-optimized structure). Do NOT provide partial patches.
For product_tags fixes: provide the full new tag array as comma-separated string.

FORMAT: Return ONLY raw valid JSON matching the schema. No markdown, no commentary.`;



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

  let lastError = null;

  for (const apiKey of API_KEYS) {
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = 1500 * attempt;
        console.log(`🔄 Retry ${attempt}/${MAX_RETRIES} (${keyLabel} key) for "${product.title}" (${delay}ms)...`);
        await sleep(delay);
      }

      const payload = JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
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
          console.error(`❌ Attempt ${attempt + 1} (${keyLabel}): API error — ${errMsg}`);
          continue;
        }

        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason;
        if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
          lastError = new Error(`Response blocked: ${finishReason}`);
          console.warn(`⚠️ Attempt ${attempt + 1} (${keyLabel}): finishReason=${finishReason}`);
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

        console.log(`✅ Product analysis (${keyLabel}): "${product.title}" → ${analysis.riskLevel} (score: ${analysis.overallScore}, ${analysis.issues?.length || 0} issues)`);
        return analysis;
      } catch (err) {
        lastError = err;
        console.error(`❌ Attempt ${attempt + 1} (${keyLabel}) error:`, err.message);
        if (err.message.includes('not configured') || err.message.includes('not available')) throw err;
      }
    }
    console.warn(`⚠️ All retries exhausted for ${keyLabel} key, trying next...`);
  }

  console.error(`❌ All keys and retries failed for "${product.title}". Last: ${lastError?.message}`);
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
  const API_KEYS = getApiKeys();

  const stored = policyStore.get(shop);

  const systemInstruction = `You are Axiom's elite GEO Blog Analyst — the most thorough content auditor for e-commerce blogs. You run 12 distinct diagnostic tests on every article. You are forensic, specific, and never vague. You quote exact text from the article in your issues.

${stored ? `STORE CONTEXT (treat as ground truth for brand voice and product alignment):\n${stored.policy}\n` : ''}

═══════════════════════════════════════════════════════════
SCORING METHODOLOGY (Deductive — start at 100, deduct for violations)
═══════════════════════════════════════════════════════════
Each of the 3 category scores starts at 100.
- CRITICAL violation: −20
- HIGH violation: −10
- MEDIUM violation: −5
- LOW violation: −2
overallScore = weighted average: SEO 30%, Readability 30%, GEO 40%
Minimum score is 0. NEVER inflate scores. Be honest.

═══════════════════════════════════════════════════════════
12 DIAGNOSTIC TESTS — Run every single one
═══════════════════════════════════════════════════════════

── SEO TESTS (seoScore) ──
T1. TITLE OPTIMIZATION: Does the title contain the primary keyword? Is it 50-60 characters? Is it compelling (would a human click it)? Flag clickbait, keyword stuffing, or generic titles like "Blog Post" or "News".
T2. HEADING STRUCTURE: Does the article use H2/H3 hierarchy? Are headings descriptive and keyword-rich? Flag missing headings, single-heading articles, or heading-less long paragraphs (>200 words without a heading).
T3. KEYWORD STRATEGY: Identify the primary keyword from the title. Check: does it appear in the first 100 words? In at least 2 subheadings? Is keyword density 1-2%? Flag keyword absence or stuffing.
T4. META & SNIPPET READINESS: Do the first 155 characters of the article body form a compelling search snippet? Flag if article starts with filler, greetings, or non-informative content.

── READABILITY TESTS (readabilityScore) ──
T5. PARAGRAPH LENGTH: Average paragraph length should be 2-4 sentences. Flag paragraphs >6 sentences or walls of text >150 words without a break.
T6. SENTENCE COMPLEXITY: Flag sentences >30 words. Check for passive voice overuse (>20% of sentences). Check for jargon without explanation.
T7. SCANNABILITY: Does the article use bullet points, numbered lists, bold text for key terms, and clear visual breaks? Flag articles that are pure prose with no formatting.
T8. WORD COUNT: <300 words = CRITICAL (thin content). 300-600 = HIGH (too short for GEO). 600-800 = MEDIUM. 800-1500 = ideal. >2000 = check for fluff.

── GEO TESTS (geoScore) ──
T9. STATISTICS & DATA DENSITY: Count quantitative claims (numbers, percentages, comparisons, measurements). Minimum 5 per article. These are what AI engines extract and cite. Flag each missing stat below the threshold.
T10. JUSTIFICATION & RECOMMENDATION FRAGMENTS: Count phrases like "ideal for", "best for", "recommended because", "this works well for". Minimum 3 per article. These power AI product recommendations.
T11. E-E-A-T SIGNALS: Does the article demonstrate Experience, Expertise, Authority, Trust? Check for: author credibility signals, first-hand experience language, specific examples (not generic advice), source attribution.
T12. FAQ / STRUCTURED ANSWER READINESS: Does the article contain Q&A sections, direct answers to common questions, or self-contained factual statements that an AI can extract verbatim? Flag if the entire article is narrative-only with no extractable answer blocks.

═══════════════════════════════════════════════════════════
ISSUE REPORTING
═══════════════════════════════════════════════════════════
"issues" array: Each item is a specific, actionable string written in PLAIN LANGUAGE a shop owner understands. Do NOT include test numbers (T1, T5, etc.) or technical terms like meta tags, canonical, E-E-A-T, keyword density. Use simple words.
Example: "Paragraph 3 is too long (189 words) — break it into 2-3 shorter paragraphs so readers don't lose interest"
Example: "The article only mentions 1 specific number. Add at least 4 more real stats (like prices, measurements, or percentages) so AI assistants can quote your article."

═══════════════════════════════════════════════════════════
SUGGESTIONS
═══════════════════════════════════════════════════════════
"suggestions" array: Concrete, actionable improvements in plain language. Include before/after examples.
Example: "Add a Frequently Asked Questions section with 3-5 questions your customers actually ask. Example: 'What is the best budget snowboard for beginners?' followed by a clear 2-sentence answer."
Example: "Instead of saying 'very durable', use a real number like 'rated for 500+ hours of use in independent testing' — AI assistants love specific facts they can quote."

═══════════════════════════════════════════════════════════
FIX GENERATION
═══════════════════════════════════════════════════════════
For fixable issues, generate concrete fixes:
- type: article_title | article_body | article_tags
- field: title | body_html | tags
- oldValue: EXACT current value
- newValue: COMPLETE replacement ready to apply
- label: Short, plain-language description of what the fix does (e.g., "Rewrite title to be more specific and clickable")

For article_body fixes: provide the COMPLETE rewritten body_html with ALL improvements applied (headings added, stats inserted, FAQ section appended, formatting improved). Not a partial patch.
For article_tags fixes: provide full comma-separated tag list.

FORMAT: Return ONLY raw valid JSON matching the schema. No markdown, no commentary.`;

  const userData = `Blog Article Data:\n${JSON.stringify(article, null, 2)}`;
  let lastError = null;

  for (const apiKey of API_KEYS) {
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(1500 * attempt);
        console.log(`🔄 Blog analysis retry ${attempt}/${MAX_RETRIES} (${keyLabel} key)...`);
      }

      const payload = JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userData }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
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

        console.log(`✅ Blog analysis (${keyLabel}): "${article.title}" → score=${analysis.overallScore}`);
        return analysis;
      } catch (err) {
        lastError = err;
      }
    }
    console.warn(`⚠️ Blog analysis: ${keyLabel} key exhausted, trying next...`);
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
  const API_KEYS = getApiKeys();

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

  let lastError = null;

  for (const apiKey of API_KEYS) {
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(2000 * attempt);
        console.log(`🔄 Blog generation retry ${attempt}/${MAX_RETRIES} (${keyLabel} key)...`);
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

        console.log(`✅ Blog generated (${keyLabel}): "${blog.title}" (${blog.tags?.length || 0} tags)`);
        return blog;
      } catch (err) {
        lastError = err;
      }
    }
    console.warn(`⚠️ Blog generation: ${keyLabel} key exhausted, trying next...`);
  }

  throw new Error(`Blog generation failed after all keys and retries. Last: ${lastError?.message}`);
}
