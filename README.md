# JobSync AI

A full-stack AI career platform that aggregates live job listings from multiple sources, scores candidate compatibility using GPT-powered analysis, identifies skill gaps, and generates hyper-tailored job proposals in seconds.

---

## Features

- **Live Job Aggregation** — Pulls real-time listings from LinkedIn, Indeed, Adzuna, Remotive, and RemoteOK via a unified REST API
- **AI Fit Scoring** — Compares the candidate's CV and skills against each job description, returning a 0-100 fit score with reasoning
- **Skill Gap Detection** — Identifies missing skills per role and highlights matching ones
- **AI Proposal Generator** — Generates GPT-written, personalised proposals with advanced controls (tone, length, tech stack focus)
- **CV Parsing** — Extracts skills and context from uploaded PDF/DOCX files automatically
- **Market Trends Dashboard** — Real-time chart of tech domain demand, top stacks, and in-demand project types
- **Subscription Tier System** — Free Tier and Subscribed plan states with an interactive plan switcher modal
- **Authentication** — JWT-based sign up/sign in with secure password hashing via bcrypt
- **Dark/Light Theme** — Fully themed UI with persistent preference
- **Async AI Processing** — Proposal generation is decoupled from the HTTP lifecycle via RabbitMQ worker queue
- **Redis Caching** — API rate limiting and response caching via Upstash/Redis
- **Fully Responsive** — Mobile-first layout across all pages

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite | Build tool and dev server |
| Tailwind CSS v4 | Utility-first styling |
| Recharts | Market trends data visualisation |
| React Router v6 | Client-side routing |
| Axios | HTTP client with interceptors |
| Lucide React | Icon set |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | REST API server |
| TypeScript | Type-safe server code |
| Prisma ORM | Database schema and migrations |
| PostgreSQL | Primary relational database |
| JWT + bcrypt | Authentication and password hashing |
| OpenAI SDK | GPT-powered fit scoring and proposal generation |
| amqplib | RabbitMQ producer/consumer for async AI tasks |
| ioredis | Redis client for caching and rate limiting |
| multer + mammoth + pdf-parse | CV file upload and parsing |
| express-rate-limit | API rate limiting |

---

## Architecture

```
Client (React/Vite)
      |
      | HTTP (REST API)
      v
Express API Server
      |
      |---- PostgreSQL (Prisma ORM) -- users, jobs, proposals
      |---- Redis -- response caching, rate limit tracking
      |---- RabbitMQ -- queues AI proposal generation tasks
      v
Background Worker (worker.ts)
      |
      |---- OpenAI API -- generates proposals, scores fit
      |---- PostgreSQL -- writes completed proposals back to DB
```

The API server offloads all GPT generation tasks to a separate worker process via a RabbitMQ queue. This keeps API response times low and prevents timeouts during heavy AI processing.

---

## Database Models

- **User** — email, hashed password, portfolio text, extracted skills, job preference
- **Job** — aggregated job postings with source, salary range, location type, required skills
- **JobPosting** — job descriptions used for proposal generation
- **Proposal** — generated text, status (PENDING / COMPLETED / FAILED), fit score, matching/missing skills

---

## API Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| GET | `/api/user/me` | Get current user profile |
| PUT | `/api/user/preferences` | Update job preference |
| POST | `/api/cv/upload` | Upload and parse CV (PDF/DOCX) |
| GET | `/api/jobs` | Fetch and filter aggregated jobs |
| POST | `/api/jobs/fetch` | Trigger a fresh job pull from all sources |
| POST | `/api/proposals` | Queue a new AI proposal generation task |
| GET | `/api/proposals` | List user proposals with status |
| GET | `/api/proposals/:id` | Get a single proposal |

---

## Production Deployment

| Service | Platform | Role |
|---|---|---|
| Frontend | Vercel | Serves the compiled React/Vite static files |
| API Server | Render | Runs the Express application (Node.js) |
| Database | Neon | Serverless PostgreSQL, managed via Prisma migrations |
| Cache | Upstash | Serverless Redis for rate limiting and caching |
| Message Broker | CloudAMQP | Managed RabbitMQ for async AI task queuing |

---

## Local Development

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for local services)

### 1. Clone the repository

```bash
git clone https://github.com/EbadAhmed1/job-sync-ai.git
cd job-sync-ai
```

### 2. Start local infrastructure

```bash
docker-compose up postgres redis rabbitmq -d
```

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
```

Fill in the values in `server/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/freelance_proposal_db?schema=public"
PORT=5000
NODE_ENV=development
JWT_SECRET="your-secret-key-min-32-chars"
CLIENT_ORIGIN="http://localhost:5173"
REDIS_URL="redis://localhost:6379"
RABBITMQ_URL="amqp://localhost:5672"
OPENAI_API_KEY="your-openai-api-key"
ADZUNA_APP_ID="your-adzuna-app-id"
ADZUNA_APP_KEY="your-adzuna-app-key"
RAPIDAPI_KEY="your-rapidapi-key"
RAPIDAPI_INDEED_HOST="indeed-scraper-api.p.rapidapi.com"
RAPIDAPI_LINKEDIN_HOST="linkedin-job-search-api.p.rapidapi.com"
```

### 4. Set up the database

```bash
cd server
npm install
npx prisma migrate dev
```

### 5. Start the backend API server

```bash
npm run dev
```

### 6. Start the background worker (separate terminal)

```bash
npm run worker:dev
```

### 7. Start the frontend

```bash
cd ../client
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Docker (Full Stack)

To run the entire stack in containers:

```bash
docker-compose up --build
```

This starts PostgreSQL, Redis, RabbitMQ, the backend API server, the background worker, and the frontend served via Nginx on port 80.

---

## Project Structure

```
job-sync-ai/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── api/             # Axios instances and typed API functions
│   │   ├── components/      # Shared layout and UI components
│   │   ├── contexts/        # Auth and Theme context providers
│   │   └── pages/           # Landing, Login, Dashboard, Jobs, Generator
│   └── index.html
├── server/                  # Node.js backend
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── src/
│       ├── routes/          # Express route handlers
│       ├── services/        # Business logic and external API calls
│       ├── middleware/       # Auth, rate limiting, error handling
│       ├── lib/             # Prisma client, Redis, RabbitMQ setup
│       ├── index.ts         # API server entry point
│       └── worker.ts        # Background queue worker
└── docker-compose.yml
```

---

## License

MIT
