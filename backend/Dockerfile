FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev gdal-bin libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Single worker: the APScheduler-driven CGWB sync runs in-process, so more
# than one worker would double-run the hourly sync. Scale reads via a
# reverse proxy fronting multiple containers with the scheduler disabled on
# all but one (RWH_SCHEDULER_ENABLED=false) once that flag exists, or split
# the scheduler into its own service.
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "-b", "0.0.0.0:8000", "--timeout", "120"]
