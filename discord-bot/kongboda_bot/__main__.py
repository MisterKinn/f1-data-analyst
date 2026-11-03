import logging

from . import config
from .bot import KongbodaBot

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
cfg = config.load()
KongbodaBot(cfg).run(cfg.discord_token, log_handler=None)
