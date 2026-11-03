import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from kongboda_bot.bot import KongbodaBot
from kongboda_bot.config import Config


class CommandTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        (root / 'schedule.json').write_text('{}')
        cfg = Config('not-a-real-token', 1, None, None, 'https://collector.example', 'k'*32,
                     None, '', root/'state.json', root/'schedule.json')
        self.bot = KongbodaBot(cfg)
        self.bot.collector = SimpleNamespace(session_results=AsyncMock(return_value={'state': 'pending'}))
        self.bot.published = SimpleNamespace(standings=AsyncMock(return_value={'pending': True}))
        self.interaction = SimpleNamespace(client=self.bot, user=SimpleNamespace(id=1),
            response=SimpleNamespace(defer=AsyncMock(), send_message=AsyncMock()),
            followup=SimpleNamespace(send=AsyncMock()))

    async def asyncTearDown(self):
        await self.bot.close()
        self.temp.cleanup()

    async def test_all_requested_commands_exist_and_deny_other_users(self):
        for name in ('fp', 'qualifying', 'race', 'standings', 'briefing', 'ask'):
            command = self.bot.tree.get_command(name)
            self.assertIsNotNone(command)
            self.interaction.user.id = 2
            self.assertFalse(await command.checks[0](self.interaction))
            self.interaction.response.send_message.assert_awaited_with('이 봇은 사이트 소유자 전용입니다.', ephemeral=True)

    async def test_archive_commands_defer_before_work_and_forward_exact_identity(self):
        async def check_deferred(*args):
            self.interaction.response.defer.assert_awaited_once()
            return {'state': 'pending'}
        self.bot.collector.session_results.side_effect = check_deferred
        for name, kwargs, code in [('fp', {'practice': 'FP3'}, 'FP3'),
                                   ('qualifying', {'sprint': True}, 'SQ'), ('race', {'sprint': False}, 'R')]:
            self.interaction.response.defer.reset_mock()
            await self.bot.tree.get_command(name).callback(self.interaction, event=7, year=2025, **kwargs)
            self.bot.collector.session_results.assert_awaited_with(2025, 7, code)

    async def test_standings_uses_same_public_service_without_collector_key(self):
        await self.bot.tree.get_command('standings').callback(self.interaction, kind='drivers', series='wec', category='hypercar-drivers')
        self.bot.published.standings.assert_awaited_with('drivers', 'wec', 'hypercar-drivers')

    async def test_stop_briefing_stops_future_updates(self):
        self.bot.briefing_channel_id = 10
        await self.bot.tree.get_command('briefing').callback(self.interaction, action='stop')
        self.assertIsNone(self.bot.briefing_channel_id)
        self.assertIsNone(self.bot.briefing_message)

    async def test_stop_during_collector_request_does_not_send_to_old_channel(self):
        self.bot.briefing_channel_id = 10
        async def snapshot():
            self.bot.briefing_channel_id = None
            return {}
        self.bot.collector.snapshot = snapshot
        self.bot.get_channel = Mock()
        await self.bot.briefing_loop.coro(self.bot)
        self.bot.get_channel.assert_not_called()
