import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { getCached, setCached } from '../config/redis';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI client (reused for trends generation)
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// Cache constants
// ─────────────────────────────────────────────────────────────────────────────

const TRENDS_CACHE_KEY = 'market_trends_v3'; // Bumped cache version due to schema change
const TRENDS_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DomainTrend {
  domain: string;
  marketSharePercent: number; // Accurate market share % (sum of all domains = 100)
  growthPercent: number;      // YoY demand growth %
  topStacks: string[];
  hotProjects: string[];
}

interface TrendsPayload {
  domains: DomainTrend[];
  lastUpdated: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback data (used when OpenAI is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_TRENDS: TrendsPayload = {
  domains: [
    {
      domain: 'AI & Machine Learning',
      marketSharePercent: 28,
      growthPercent: 42,
      topStacks: ['Python', 'TensorFlow', 'PyTorch', 'LangChain', 'Hugging Face'],
      hotProjects: ['Generative AI Apps', 'RAG Pipelines', 'Computer Vision', 'AI Chatbots'],
    },
    {
      domain: 'Web & Mobile Development',
      marketSharePercent: 26,
      growthPercent: 15,
      topStacks: ['React', 'Next.js', 'React Native', 'Flutter', 'TypeScript'],
      hotProjects: ['SaaS Dashboards', 'E-commerce Platforms', 'Cross-platform Apps', 'Progressive Web Apps'],
    },
    {
      domain: 'Cloud & DevOps',
      marketSharePercent: 18,
      growthPercent: 28,
      topStacks: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'GitHub Actions'],
      hotProjects: ['Cloud Migration', 'CI/CD Pipelines', 'Infrastructure as Code', 'Serverless Architecture'],
    },
    {
      domain: 'Data Engineering',
      marketSharePercent: 12,
      growthPercent: 31,
      topStacks: ['Apache Spark', 'Kafka', 'dbt', 'Snowflake', 'Airflow'],
      hotProjects: ['Real-time Data Pipelines', 'Data Warehousing', 'ETL Automation', 'Analytics Dashboards'],
    },
    {
      domain: 'Cybersecurity',
      marketSharePercent: 10,
      growthPercent: 35,
      topStacks: ['Zero Trust Architecture', 'SIEM Tools', 'Penetration Testing', 'Burp Suite', 'Wireshark'],
      hotProjects: ['Cloud Security Audits', 'Threat Detection', 'Compliance Automation', 'SOC Setup'],
    },
    {
      domain: 'Blockchain & Web3',
      marketSharePercent: 6,
      growthPercent: 18,
      topStacks: ['Solidity', 'Rust', 'Ethers.js', 'Hardhat', 'Anchor'],
      hotProjects: ['Smart Contracts', 'DeFi Protocols', 'NFT Marketplaces', 'DAO Tooling'],
    },
  ],
  lastUpdated: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI-powered live trends generation
// ─────────────────────────────────────────────────────────────────────────────

const TRENDS_SYSTEM_PROMPT = `\
You are a senior tech industry analyst. Return ONLY valid JSON (no markdown fences, no explanation) matching this exact schema:

{
  "domains": [
    {
      "domain": "string — domain name, e.g., AI & Machine Learning",
      "marketSharePercent": "number — estimated market share percentage (e.g., 28). MUST be a number. The sum of all 6 domains' marketSharePercent values MUST equal exactly 100.0",
      "growthPercent": "number — estimated YoY growth percentage (e.g., 35). MUST be a number.",
      "topStacks": ["string — 5 most in-demand technologies/frameworks"],
      "hotProjects": ["string — 4 most common freelance project types"]
    }
  ]
}

Cover exactly these 6 domains:
1. AI & Machine Learning
2. Web & Mobile Development
3. Cloud & DevOps
4. Data Engineering
5. Cybersecurity
6. Blockchain & Web3

Base your analysis on current 2025-2026 freelance market trends. Be specific with technology names. Order domains by marketSharePercent descending. Ensure the sum of all marketSharePercent values equals exactly 100.`;

async function fetchLiveTrends(): Promise<TrendsPayload> {
  try {
    console.log('[Trends] Fetching live market trends from OpenAI…');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: TRENDS_SYSTEM_PROMPT },
        { role: 'user', content: 'Generate current freelance tech market trends for 2025-2026. Return JSON only.' },
      ],
      temperature: 0.6,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('OpenAI returned empty response for trends');
    }

    const parsed = JSON.parse(raw) as { domains: DomainTrend[] };

    if (!Array.isArray(parsed.domains) || parsed.domains.length === 0) {
      throw new Error('Invalid trends structure from OpenAI');
    }

    // Verify and adjust if sum is slightly off due to float rounding
    let sum = parsed.domains.reduce((acc, d) => acc + d.marketSharePercent, 0);
    console.log(`[Trends] Initial sum of marketSharePercent: ${sum}%`);
    
    // Normalize to ensure it is exactly 100%
    if (sum !== 100 && parsed.domains.length > 0) {
      const diff = 100 - sum;
      parsed.domains[0].marketSharePercent = Number((parsed.domains[0].marketSharePercent + diff).toFixed(2));
      sum = parsed.domains.reduce((acc, d) => acc + d.marketSharePercent, 0);
      console.log(`[Trends] Normalized sum of marketSharePercent: ${sum}%`);
    }

    const tokensUsed = completion.usage?.total_tokens ?? 0;
    console.log(`[Trends] ✅ Live trends received (${tokensUsed} tokens, ${parsed.domains.length} domains)`);

    return {
      domains: parsed.domains,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Trends] Failed to fetch live trends:', (err as Error).message);
    console.warn('[Trends] Using fallback data');
    return {
      ...FALLBACK_TRENDS,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/trends
//
// Cache-Aside pattern:
//   1. Check Redis for TRENDS_CACHE_KEY.
//   2. Cache HIT  → return cached payload immediately (X-Cache: HIT).
//   3. Cache MISS → fetch live trends from OpenAI, write to Redis (TTL 24h), return.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/trends',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {

    // ── 1. Cache look-up ──────────────────────────────────────────────────
    const cached = await getCached<TrendsPayload>(TRENDS_CACHE_KEY);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({
        status: 'success',
        meta: {
          dataSource: 'live',
          cacheStatus: 'hit',
          lastUpdated: cached.lastUpdated,
        },
        data: cached,
      });
    }

    // ── 2. Cache MISS — fetch live trends ────────────────────────────────
    const payload = await fetchLiveTrends();

    // ── 3. Populate cache (fire-and-forget) ──
    await setCached(TRENDS_CACHE_KEY, payload, TRENDS_CACHE_TTL);

    // ── 4. Respond ────────────────────────────────────────────────────────
    res.setHeader('X-Cache', 'MISS');
    return res.json({
      status: 'success',
      meta: {
        dataSource: 'live',
        cacheStatus: 'miss',
        lastUpdated: payload.lastUpdated,
        cachedUntil: new Date(Date.now() + TRENDS_CACHE_TTL * 1000).toISOString(),
      },
      data: payload,
    });
  })
);

export default router;
