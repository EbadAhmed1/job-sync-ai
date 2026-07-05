/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Job Ingestion Service                               ║
 * ║                                                                           ║
 * ║  Fetches full-time jobs from multiple free/freemium sources:              ║
 * ║    1. Adzuna API  (freemium, 250 req/day, requires ADZUNA_APP_ID/KEY)     ║
 * ║    2. Remotive    (free JSON API, no key needed, remote-focused)          ║
 * ║    3. RemoteOK    (free JSON API, no key needed, remote tech jobs)        ║
 * ║                                                                           ║
 * ║  Upserts into the Job table via externalId — safe to re-run anytime.     ║
 * ║  Cleans up jobs older than 30 days automatically.                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI client (for skill extraction from job descriptions)
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const JOB_EXPIRY_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NormalisedJob {
  externalId:     string;
  title:          string;
  company:        string;
  location:       string;
  locationType:   'remote' | 'onsite' | 'hybrid';
  description:    string;
  salaryMin:      number | null;
  salaryMax:      number | null;
  currency:       string | null;
  applyUrl:       string;
  source:         string;
  postedAt:       Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill extraction via OpenAI (batched — one call per 10 jobs)
// ─────────────────────────────────────────────────────────────────────────────

const SKILLS_PROMPT = `\
Extract technical skills from this job description. Return ONLY a JSON array of strings.
Example: ["React", "Node.js", "PostgreSQL", "Docker"]
Include languages, frameworks, databases, tools, platforms. Max 15 items. Job:
`;

async function extractSkillsFromDescription(description: string): Promise<string[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: SKILLS_PROMPT + description.substring(0, 2000) }],
      temperature: 0.1,
      max_tokens: 200,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    // Handle both bare arrays and json_object wrapped responses
    const clean = raw.startsWith('[') ? raw : raw.match(/\[.*\]/s)?.[0] ?? '[]';
    const skills = JSON.parse(clean) as string[];
    return Array.isArray(skills) ? skills.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: infer locationType from title/description/location
// ─────────────────────────────────────────────────────────────────────────────

function inferLocationType(title: string, description: string, location: string): 'remote' | 'onsite' | 'hybrid' {
  const text = `${title} ${description.substring(0, 500)} ${location}`.toLowerCase();
  if (text.includes('hybrid')) return 'hybrid';
  if (
    text.includes('remote') ||
    text.includes('work from home') ||
    text.includes('wfh') ||
    location.toLowerCase() === 'remote' ||
    location.toLowerCase().includes('anywhere')
  ) return 'remote';
  return 'onsite';
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1: Adzuna API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAdzunaJobs(): Promise<NormalisedJob[]> {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('[Ingestion] Adzuna credentials not set — skipping Adzuna source');
    return [];
  }

  const jobs: NormalisedJob[] = [];

  // Fetch from multiple countries for broader coverage
  const countries = ['gb', 'us', 'au'];
  const keywords  = ['software developer', 'backend developer', 'frontend developer', 'full stack developer', 'data engineer'];

  for (const country of countries) {
    for (const keyword of keywords.slice(0, 2)) { // limit to 2 keywords × 3 countries = 6 calls
      try {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
        url.searchParams.set('app_id',          ADZUNA_APP_ID);
        url.searchParams.set('app_key',         ADZUNA_APP_KEY);
        url.searchParams.set('results_per_page', '50');
        url.searchParams.set('what',            keyword);
        url.searchParams.set('full_time',        '1');
        url.searchParams.set('content-type',    'application/json');

        const res  = await fetch(url.toString());
        if (!res.ok) {
          console.warn(`[Ingestion] Adzuna ${country}/${keyword}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json() as {
          results?: Array<{
            id: string;
            title: string;
            company?: { display_name?: string };
            location?: { display_name?: string };
            description?: string;
            salary_min?: number;
            salary_max?: number;
            redirect_url?: string;
            created?: string;
          }>;
        };

        for (const item of data.results ?? []) {
          if (!item.id || !item.title) continue;
          const description = item.description ?? '';
          const location    = item.location?.display_name ?? 'Unknown';
          jobs.push({
            externalId:   `adzuna_${item.id}`,
            title:        item.title,
            company:      item.company?.display_name ?? 'Unknown Company',
            location,
            locationType: inferLocationType(item.title, description, location),
            description,
            salaryMin:    item.salary_min ?? null,
            salaryMax:    item.salary_max ?? null,
            currency:     country === 'us' ? 'USD' : country === 'au' ? 'AUD' : 'GBP',
            applyUrl:     item.redirect_url ?? '',
            source:       'adzuna',
            postedAt:     item.created ? new Date(item.created) : new Date(),
          });
        }

        console.log(`[Ingestion] Adzuna ${country}/${keyword}: fetched ${data.results?.length ?? 0} jobs`);

        // Small delay to be polite to the API
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`[Ingestion] Adzuna ${country}/${keyword} error:`, (err as Error).message);
      }
    }
  }

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 2: Remotive API (free, no key required)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRemotiveJobs(): Promise<NormalisedJob[]> {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=100');
    if (!res.ok) {
      console.warn(`[Ingestion] Remotive: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json() as {
      jobs?: Array<{
        id: number;
        title: string;
        company_name: string;
        candidate_required_location?: string;
        description: string;
        salary?: string;
        url: string;
        publication_date: string;
        tags?: string[];
      }>;
    };

    const jobs: NormalisedJob[] = (data.jobs ?? []).map((item) => ({
      externalId:   `remotive_${item.id}`,
      title:        item.title,
      company:      item.company_name,
      location:     item.candidate_required_location || 'Worldwide',
      locationType: 'remote' as const,
      description:  item.description.replace(/<[^>]*>/g, ''), // strip HTML tags
      salaryMin:    null,
      salaryMax:    null,
      currency:     null,
      applyUrl:     item.url,
      source:       'remotive',
      postedAt:     new Date(item.publication_date),
    }));

    console.log(`[Ingestion] Remotive: fetched ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error('[Ingestion] Remotive error:', (err as Error).message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3: RemoteOK (free JSON API, no key required)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRemoteOKJobs(): Promise<NormalisedJob[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'JobMatchApp/1.0' }, // RemoteOK requires a UA header
    });

    if (!res.ok) {
      console.warn(`[Ingestion] RemoteOK: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json() as Array<{
      id?: string;
      position?: string;
      company?: string;
      location?: string;
      description?: string;
      salary_min?: number;
      salary_max?: number;
      url?: string;
      date?: string;
      tags?: string[];
    }>;

    // First element is metadata — skip it
    const listings = data.slice(1).filter((item) => item.id && item.position);

    const jobs: NormalisedJob[] = listings.map((item) => ({
      externalId:   `remoteok_${item.id}`,
      title:        item.position ?? 'Untitled',
      company:      item.company ?? 'Unknown',
      location:     item.location || 'Remote',
      locationType: 'remote' as const,
      description:  (item.description ?? '').replace(/<[^>]*>/g, ''),
      salaryMin:    item.salary_min ?? null,
      salaryMax:    item.salary_max ?? null,
      currency:     item.salary_min ? 'USD' : null,
      applyUrl:     item.url ?? '',
      source:       'remoteok',
      postedAt:     item.date ? new Date(item.date) : new Date(),
    }));

    console.log(`[Ingestion] RemoteOK: fetched ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error('[Ingestion] RemoteOK error:', (err as Error).message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert jobs into the database
// ─────────────────────────────────────────────────────────────────────────────

async function upsertJobs(jobs: NormalisedJob[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Process in batches of 20 to avoid overwhelming the DB connection pool
  const BATCH_SIZE = 20;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    // Extract skills for this batch in parallel (max 5 concurrent OpenAI calls)
    const skillsResults = await Promise.all(
      batch.map((job) =>
        job.description.length > 100
          ? extractSkillsFromDescription(job.description)
          : Promise.resolve([])
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const job    = batch[j]!;
      const skills = skillsResults[j] ?? [];

      const expiresAt = new Date(job.postedAt);
      expiresAt.setDate(expiresAt.getDate() + JOB_EXPIRY_DAYS);

      try {
        const result = await prisma.job.upsert({
          where:  { externalId: job.externalId },
          create: {
            externalId:     job.externalId,
            title:          job.title,
            company:        job.company,
            location:       job.location,
            locationType:   job.locationType,
            description:    job.description,
            salaryMin:      job.salaryMin,
            salaryMax:      job.salaryMax,
            currency:       job.currency,
            applyUrl:       job.applyUrl,
            source:         job.source,
            requiredSkills: skills,
            postedAt:       job.postedAt,
            expiresAt,
          },
          update: {
            title:          job.title,
            description:    job.description,
            salaryMin:      job.salaryMin,
            salaryMax:      job.salaryMax,
            fetchedAt:      new Date(),
            requiredSkills: skills.length > 0 ? skills : undefined,
            expiresAt,
          },
        });

        // Prisma upsert doesn't directly tell us create vs update — use fetchedAt heuristic
        const isNew = Math.abs(result.fetchedAt.getTime() - Date.now()) < 5000;
        if (isNew) created++; else updated++;
      } catch (err) {
        console.error(`[Ingestion] Failed to upsert job ${job.externalId}:`, (err as Error).message);
      }
    }
  }

  return { created, updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup: remove expired jobs
// ─────────────────────────────────────────────────────────────────────────────

async function cleanupExpiredJobs(): Promise<number> {
  try {
    const result = await prisma.job.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { postedAt:  { lt: new Date(Date.now() - JOB_EXPIRY_DAYS * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return result.count;
  } catch (err) {
    console.error('[Ingestion] Cleanup error:', (err as Error).message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ingestion run — called by the worker on interval
// ─────────────────────────────────────────────────────────────────────────────

export async function runJobIngestion(): Promise<void> {
  const startTime = Date.now();
  console.log('[Ingestion] ── Starting job ingestion run ──────────────────');

  try {
    // Fetch from all sources in parallel
    const [adzunaJobs, remotiveJobs, remoteOKJobs] = await Promise.all([
      fetchAdzunaJobs(),
      fetchRemotiveJobs(),
      fetchRemoteOKJobs(),
    ]);

    const allJobs = [...adzunaJobs, ...remotiveJobs, ...remoteOKJobs];
    console.log(`[Ingestion] Total fetched: ${allJobs.length} jobs (Adzuna: ${adzunaJobs.length}, Remotive: ${remotiveJobs.length}, RemoteOK: ${remoteOKJobs.length})`);

    if (allJobs.length > 0) {
      const { created, updated } = await upsertJobs(allJobs);
      console.log(`[Ingestion] DB: ${created} created, ${updated} updated`);
    }

    // Cleanup
    const deleted = await cleanupExpiredJobs();
    if (deleted > 0) {
      console.log(`[Ingestion] Cleaned up ${deleted} expired jobs`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Ingestion] ── Run complete in ${elapsed}s ─────────────────`);
  } catch (err) {
    console.error('[Ingestion] Fatal error during run:', (err as Error).message);
  }
}
