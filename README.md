# sarcast.ai

A sarcasm-tuned AI chatbot that adapts its tone to each user based on a short onboarding quiz and ongoing conversation analysis.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI (Python) |
| Database | Supabase (Postgres) |
| LLM | Groq |

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A free [Supabase](https://supabase.com) project
- A free [Groq](https://console.groq.com) API key

### 1. Clone the repo

```bash
git clone https://github.com/your-org/sarcast-ai.git
cd sarcast-ai
```

### 2. Set up the database

In the Supabase SQL Editor, run the contents of `supabase_schema.sql`.

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your values:

```
GROQ_API_KEY=your_groq_api_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
```

### 4. Start the backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 5. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
```

`frontend/.env` defaults work out of the box for local development:

```
VITE_BACKEND_URL=http://localhost:8000
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production deployment

See [deployment-guide-v2.md](./deployment-guide-v2.md) for full instructions covering Supabase, Render, and Vercel.

## Project structure

```
sarcast-ai/
├── backend/
│   ├── main.py          # FastAPI app
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   └── .env.example
├── supabase_schema.sql
├── requirements.txt
└── deployment-guide-v2.md
```
