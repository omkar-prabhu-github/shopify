import { checkAuth } from '../utils/authGuard';

export interface BlogArticle {
  blog: string;
  title: string;
  handle: string;
  author: string;
  tags: string[];
  published_at: string;
  body: string;
}

export interface BlogAnalysis {
  seoScore: number;
  readabilityScore: number;
  geoScore: number;
  overallScore: number;
  wordCount: number;
  issues: string[];
  suggestions: string[];
  fixes: any[];
}

export interface GeneratedBlog {
  title: string;
  bodyHtml: string;
  tags: string[];
  metaDescription: string;
  summary: string;
}

export interface ShopifyBlog {
  id: number;
  title: string;
  handle: string;
}

export async function analyzeBlog(shop: string, token: string, article: BlogArticle): Promise<BlogAnalysis> {
  const response = await fetch('/api/blog/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ article }),
  });

  checkAuth(response);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data.analysis;
}

export async function generateBlog(
  shop: string, token: string, topic: string, blogId?: number
): Promise<{ generated: GeneratedBlog; published: boolean; article?: any; publishError?: string }> {
  const response = await fetch('/api/blog/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ topic, blogId }),
  });

  checkAuth(response);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function listBlogs(shop: string, token: string): Promise<ShopifyBlog[]> {
  const response = await fetch('/api/blog/list', {
    headers: {
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
  });

  checkAuth(response);
  const data = await response.json();
  return data.blogs || [];
}

export async function publishBlog(
  shop: string, token: string, blogId: number, generated: GeneratedBlog
): Promise<{ published: boolean; article?: any }> {
  const response = await fetch('/api/blog/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({
      blogId,
      title: generated.title,
      bodyHtml: generated.bodyHtml,
      tags: generated.tags,
    }),
  });

  checkAuth(response);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
