# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy frontend source code and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
COPY backend/app/static/ ./backend/app/static/

# Build the frontend (Vite config builds to ../backend/app/static)
RUN cd frontend && npm run build

# Stage 2: Build the FastAPI backend and serve the frontend
FROM python:3.12-slim
WORKDIR /workspace

# Install system dependencies required by PyMuPDF and other tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY backend/ ./

# Copy the compiled static assets from the frontend-builder stage
COPY --from=frontend-builder /app/backend/app/static/ ./app/static/

# Expose port 8000
EXPOSE 8000

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Command to run uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
