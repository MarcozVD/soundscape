import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from .pipeline import run_pipeline

logger = logging.getLogger(__name__)


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        lambda: asyncio.run(run_pipeline()),
        trigger="interval",
        hours=24,
        id="daily_retrain",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduled daily retraining")
