import { Router, Request, Response } from 'express';
import multer from 'multer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
import mammoth from 'mammoth';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI client
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// Multer — memory storage (no disk writes, required for Render free tier)
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only PDF and DOCX files are accepted. Please re-export your CV in one of these formats.') as unknown as null, false);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI skill extraction prompt
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_EXTRACTION_PROMPT = `\
You are a technical recruiter assistant. Extract structured information from the CV text below.

Return ONLY valid JSON (no markdown, no explanation) matching this schema:
{
  "skills": ["string — technical skills, tools, frameworks, languages"],
  "experienceYears": number,
  "summary": "string — 1-2 sentence professional summary"
}

Rules:
- skills: list all technical skills, languages, frameworks, databases, tools mentioned. Be thorough (e.g. "React", "Node.js", "PostgreSQL", "Docker", "AWS", "Python")
- experienceYears: total years of professional experience (0 if student/no experience)
- summary: concise professional identity statement

CV TEXT:
`;

// ─────────────────────────────────────────────────────────────────────────────
// Text extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    if (!text || text.length < 50) {
      throw new AppError(
        422,
        'We couldn\'t extract text from your PDF. This usually means it\'s a scanned image. Please re-save it as a text-based PDF or paste your CV manually.'
      );
    }
    return text;
  }

  // DOCX
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text || text.length < 50) {
    throw new AppError(
      422,
      'We couldn\'t extract text from your DOCX file. Please ensure the file isn\'t corrupted and try again.'
    );
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// All CV routes require authentication
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cv/upload
//
// Pipeline:
//   1. Receive PDF or DOCX via multipart/form-data (field name: "cv")
//   2. Extract raw text (pdf-parse / mammoth)
//   3. Send text to OpenAI → structured { skills, experienceYears, summary }
//   4. Save portfolioText + extractedSkills on the user record
//   5. Return preview to client
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/upload',
  upload.single('cv'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;

    if (!req.file) {
      throw new AppError(400, 'No file uploaded. Please attach a PDF or DOCX file with the field name "cv".');
    }

    const { buffer, mimetype, originalname, size } = req.file;

    console.log(`[CV Upload] User ${userId} uploaded "${originalname}" (${Math.round(size / 1024)} KB, ${mimetype})`);

    // ── 1. Extract raw text ───────────────────────────────────────────────
    const extractedText = await extractTextFromBuffer(buffer, mimetype);

    console.log(`[CV Upload] Extracted ${extractedText.length} characters from "${originalname}"`);

    // ── 2. Parse skills via OpenAI ────────────────────────────────────────
    let extractedSkills: string[] = [];
    let summary = '';

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: SKILL_EXTRACTION_PROMPT + extractedText.substring(0, 8000), // cap at 8k chars to save tokens
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as {
          skills?: string[];
          experienceYears?: number;
          summary?: string;
        };
        extractedSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
        summary = parsed.summary ?? '';

        console.log(`[CV Upload] Extracted ${extractedSkills.length} skills for user ${userId}`);
      }
    } catch (err) {
      // Skill extraction is best-effort — still save the raw text even if OpenAI fails
      console.error('[CV Upload] OpenAI skill extraction failed:', (err as Error).message);
    }

    // ── 3. Save to DB ─────────────────────────────────────────────────────
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        portfolioText:   extractedText,
        extractedSkills: extractedSkills,
      },
      select: {
        id:              true,
        email:           true,
        portfolioText:   true,
        extractedSkills: true,
        jobPreference:   true,
      },
    });

    // ── 4. Respond ────────────────────────────────────────────────────────
    res.json({
      status: 'success',
      message: 'CV uploaded and parsed successfully.',
      data: {
        fileName:        originalname,
        charCount:       extractedText.length,
        extractedSkills: updatedUser.extractedSkills,
        skillCount:      updatedUser.extractedSkills.length,
        summary,
        portfolioTextPreview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '…' : ''),
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cv/skills
// Returns the authenticated user's currently stored extracted skills.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/skills',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { extractedSkills: true, jobPreference: true, portfolioText: true },
    });

    if (!user) throw new AppError(404, 'User not found');

    res.json({
      status: 'success',
      data: {
        extractedSkills:  user.extractedSkills,
        skillCount:       user.extractedSkills.length,
        jobPreference:    user.jobPreference ?? 'both',
        hasPortfolioText: !!user.portfolioText,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cv/preference
// Update the user's job location preference.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PREFERENCES = ['remote_only', 'onsite_only', 'both'];

router.put(
  '/preference',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { jobPreference } = req.body as { jobPreference?: unknown };

    if (!jobPreference || typeof jobPreference !== 'string') {
      throw new AppError(400, 'jobPreference is required (one of: remote_only, onsite_only, both)');
    }

    if (!VALID_PREFERENCES.includes(jobPreference)) {
      throw new AppError(400, `Invalid jobPreference. Must be one of: ${VALID_PREFERENCES.join(', ')}`);
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { jobPreference },
    });

    res.json({
      status: 'success',
      message: 'Job preference updated.',
      data: { jobPreference },
    });
  })
);

export default router;
