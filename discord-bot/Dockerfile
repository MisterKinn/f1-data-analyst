# Build from the repository root: docker build -f discord-bot/Dockerfile .
FROM node:22-bookworm-slim AS schedule
WORKDIR /source
COPY package.json ./
COPY worker/session-schedule.js worker/session-schedule.js
COPY discord-bot/export_schedule.mjs discord-bot/export_schedule.mjs
RUN node discord-bot/export_schedule.mjs

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 BOT_STATE_PATH=/data/state.json
WORKDIR /app/discord-bot
COPY discord-bot/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home bot \
    && mkdir /data && chown bot:bot /data
COPY --chown=bot:bot discord-bot/ ./
COPY --chown=bot:bot docs/answer-principles.md /app/docs/answer-principles.md
COPY --from=schedule --chown=bot:bot /source/discord-bot/schedule.json ./schedule.json
USER bot
CMD ["python", "-m", "kongboda_bot"]
