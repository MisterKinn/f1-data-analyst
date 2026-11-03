"""Discord client, owner-only slash commands and background loops."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import aiohttp
import discord
from discord import app_commands
from discord.ext import tasks

from . import ask, fia_docs, live, notifier, schedule
from .collector import Collector, CollectorError
from .config import Config
from .state import State

log = logging.getLogger('kongboda')


class KongbodaBot(discord.Client):
    def __init__(self, cfg: Config):
        super().__init__(intents=discord.Intents.default())
        self.cfg = cfg
        self.tree = app_commands.CommandTree(self)
        self.state = State(cfg.state_path)
        self.sessions = schedule.load(cfg.schedule_path)
        self.http_session: aiohttp.ClientSession | None = None
        self.collector: Collector | None = None
        self.anthropic = None
        if cfg.ask_enabled:
            from anthropic import AsyncAnthropic
            self.anthropic = AsyncAnthropic(api_key=cfg.anthropic_key)
        self.last_fia_error: str | None = None
        register_commands(self)

    async def setup_hook(self):
        self.http_session = aiohttp.ClientSession()
        self.collector = Collector(self.cfg.collector_url, self.cfg.collector_key, self.http_session)
        if self.cfg.guild_id:
            guild = discord.Object(self.cfg.guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()
        self.alert_loop.start()
        self.fia_loop.start()

    async def close(self):
        self.alert_loop.cancel()
        self.fia_loop.cancel()
        if self.http_session:
            await self.http_session.close()
        await super().close()

    async def alert_channel(self):
        if not self.cfg.alert_channel_id:
            return None
        return self.get_channel(self.cfg.alert_channel_id) or await self.fetch_channel(self.cfg.alert_channel_id)

    @tasks.loop(seconds=45)
    async def alert_loop(self):
        channel = await self.alert_channel()
        if channel is None:
            return
        now = datetime.now(timezone.utc)
        for s in notifier.due_start_alerts(self.sessions, now, self.state):
            try:
                await channel.send(notifier.start_message(s))
                self.state.mark('start', s.uid)  # mark only after delivery succeeded
            except discord.DiscordException:
                log.exception('start alert delivery failed for %s', s.uid)
        try:
            payload = await self.collector.snapshot()
        except CollectorError:
            return  # collector asleep/unreachable: no end alert, and nothing claimed as delivered
        ended = notifier.due_end_alert(payload, self.state)
        if ended:
            key, label = ended
            try:
                await channel.send(notifier.end_message(label))
                self.state.mark('end', key)
            except discord.DiscordException:
                log.exception('end alert delivery failed for %s', key)

    @tasks.loop(minutes=2)
    async def fia_loop(self):
        channel = await self.alert_channel()
        if channel is None:
            return
        year = datetime.now(timezone.utc).year
        try:
            async for doc, reason, body_read, excerpt, timing in fia_docs.check_new(self.http_session, self.state, year):
                summary = None
                if body_read and self.anthropic:
                    try:
                        summary = await ask.summarize_document(self.anthropic, self.cfg.anthropic_model, doc.title, excerpt)
                    except Exception:
                        log.exception('document summary failed')
                timing['summary_finished_at'] = datetime.now(timezone.utc).isoformat() if summary else None
                try:
                    await channel.send(fia_docs.alert_text(doc, reason, body_read, summary)[:1990])
                    timing['notified_at'] = datetime.now(timezone.utc).isoformat()
                    self.state.mark('fia', doc.uid, timing)
                except discord.DiscordException:
                    log.exception('FIA alert delivery failed for %s', doc.uid)
            self.last_fia_error = None
        except Exception as exc:
            self.last_fia_error = str(exc)
            log.warning('FIA check failed: %s', exc)

    @alert_loop.before_loop
    @fia_loop.before_loop
    async def _ready(self):
        await self.wait_until_ready()


def owner_only():
    async def predicate(interaction: discord.Interaction) -> bool:
        if interaction.user.id != interaction.client.cfg.owner_id:
            await interaction.response.send_message('이 봇은 사이트 소유자 전용입니다.', ephemeral=True)
            return False
        return True
    return app_commands.check(predicate)


def register_commands(bot: KongbodaBot) -> None:
    tree = bot.tree

    @tree.command(name='live', description='현재 세션 라이브 타이밍 요약')
    @owner_only()
    async def live_cmd(interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        try:
            payload = await bot.collector.snapshot()
        except CollectorError as exc:
            return await interaction.followup.send(str(exc))
        await interaction.followup.send(live.summarize(payload)[:1990])

    @tree.command(name='schedule', description='앞으로의 세션 일정(KST)')
    @app_commands.describe(days='며칠 이내(기본 7)', series='시리즈 예: f1, wec, nascar')
    @owner_only()
    async def schedule_cmd(interaction: discord.Interaction, days: app_commands.Range[int, 1, 14] = 7, series: str | None = None):
        found = schedule.upcoming(bot.sessions, datetime.now(timezone.utc), timedelta(days=days), series)
        if not found:
            return await interaction.response.send_message('해당 기간에 등록된 세션이 없습니다. 등록 범위 밖일 수 있어요.')
        lines = [f'`{schedule.format_kst(s.start)}` {s.series_label} · {s.name}' for s in found[:25]]
        await interaction.response.send_message('\n'.join(lines)[:1990])

    @tree.command(name='standings', description='F1 챔피언십 순위')
    @app_commands.choices(kind=[app_commands.Choice(name='드라이버', value='drivers'),
                                app_commands.Choice(name='컨스트럭터', value='constructors')])
    @owner_only()
    async def standings_cmd(interaction: discord.Interaction, kind: app_commands.Choice[str]):
        await interaction.response.defer(thinking=True)
        try:
            data = await bot.collector.standings(kind.value)
        except CollectorError as exc:
            return await interaction.followup.send(str(exc))
        rows = ((data.get('categories') or [{}])[0]).get('rows') or []
        if not rows:
            return await interaction.followup.send('순위 데이터를 해석하지 못했습니다. 수집기 응답 형식을 확인해 주세요.')
        lines = [f'{r["position"]:>2}. {r["name"]} — {r["points"]:g}점' for r in rows[:22]]
        header = f'{data.get("season", "")} 시즌 {data.get("round", "?")}라운드 기준 {kind.name} 순위'
        await interaction.followup.send(header + '\n```\n' + '\n'.join(lines) + '\n```')

    @tree.command(name='ask', description='꽁보다에게 질문하기')
    @app_commands.describe(question='예: 지금 1위와 2위 페이스 차이는?')
    @owner_only()
    async def ask_cmd(interaction: discord.Interaction, question: str):
        if not bot.anthropic:
            return await interaction.response.send_message('ANTHROPIC_API_KEY가 설정되지 않아 질문 답변이 꺼져 있습니다.', ephemeral=True)
        await interaction.response.defer(thinking=True)
        try:
            text = await ask.answer(question, client=bot.anthropic, model=bot.cfg.anthropic_model,
                                    collector=bot.collector, sessions=bot.sessions)
        except Exception:
            log.exception('ask failed')
            return await interaction.followup.send('답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
        await interaction.followup.send(text)

    @tree.command(name='status', description='봇과 수집기 연결 상태')
    @owner_only()
    async def status_cmd(interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        try:
            payload = await bot.collector.snapshot()
            collector = payload.get('collector') or {}
            collector_line = f'수집기: {collector.get("state", "알 수 없음")} (인증 {collector.get("auth_state", "?")})'
        except CollectorError as exc:
            collector_line = f'수집기: {exc}'
        channel = '설정됨' if bot.cfg.alert_channel_id else '미설정(알림 꺼짐)'
        fia = f'FIA 확인 오류: {bot.last_fia_error}' if bot.last_fia_error else 'FIA 문서 확인: 정상(최근 실행 기준)'
        await interaction.followup.send('\n'.join([
            collector_line, f'알림 채널: {channel}', fia,
            f'질문 답변: {"켜짐" if bot.anthropic else "꺼짐"}',
            'WEC 문서 알림: 아직 구현되지 않았습니다.']))

    @tree.error
    async def on_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
        if isinstance(error, app_commands.CheckFailure):
            return  # owner_only already replied
        log.exception('command error', exc_info=error)
        if interaction.response.is_done():
            await interaction.followup.send('명령 처리 중 오류가 발생했습니다.')
        else:
            await interaction.response.send_message('명령 처리 중 오류가 발생했습니다.', ephemeral=True)
