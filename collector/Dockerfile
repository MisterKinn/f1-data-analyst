FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 DATA_DIR=/data PORT=8080 XDG_DATA_HOME=/data/auth
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY collector.py cloud.py lap_archive.py wec_browser.py wec_runtime.py ./
EXPOSE 8080
CMD ["python", "cloud.py", "serve"]
