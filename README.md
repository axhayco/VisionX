# AI-Powered Lab Report Triage

A full-stack application for automated lab report triage.

## Project Structure

```
├── backend/
│   ├── main.py             # FastAPI entrypoint with CORS
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment variables template
│   ├── routes/
│   │   ├── __init__.py
│   │   └── triage.py       # Triage router (POST /triage)
│   └── test_triage.py      # Backend unit tests
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── ...
    ├── package.json
    └── vite.config.js
```

## Getting Started

### Backend Setup
1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   API Docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend Setup
1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   App will be available at: [http://localhost:5173](http://localhost:5173)
