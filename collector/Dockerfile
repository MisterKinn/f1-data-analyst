FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 DATA_DIR=/data PORT=8080 XDG_DATA_HOME=/data/auth
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY collector.py cloud.py lap_archive.py telemetry.py recovery.py history.py session_results.py championship.py diagnostics.py official_published.py wec_browser.py wec_runtime.py wec_install.py wec_published.py ./
EXPOSE 8080
CMD ["python", "cloud.py", "serve"]
