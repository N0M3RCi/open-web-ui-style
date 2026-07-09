FROM python:3.11-slim
SHELL ["/bin/bash", "-c"]

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock* ./
COPY backend/README.md ./

# Install Python dependencies
RUN pip install --no-cache-dir uv && \
    uv pip install --system --no-cache -r <(uv export --no-dev --no-emit-project 2>/dev/null || echo "") || \
    pip install --no-cache-dir fastapi uvicorn[standard] httpx[socks] pydantic aiofiles pydash python-dotenv camel-ai[nova]==0.2.91a3

# Copy application code
COPY backend/ ./

# Add backend dir to Python path
ENV PYTHONPATH="/app:${PYTHONPATH}"
ENV MERCI_BRAIN_PORT=5001
ENV MERCI_BRAIN_HOST=0.0.0.0

EXPOSE 5001

CMD ["python", "main.py"]
