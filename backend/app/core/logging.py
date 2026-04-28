"""
Structured JSON logging configuration.

Call configure_logging() once at startup (before the first log statement).
Every log record emits a single-line JSON object with:
  - timestamp   ISO-8601 UTC
  - level       DEBUG | INFO | WARNING | ERROR | CRITICAL
  - logger      dotted module name
  - message     human-readable message
  - request_id  UUID injected by RequestIdMiddleware (empty string if outside
                a request context)

Usage in any module:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Something happened", extra={"user_id": str(user.id)})
"""
import logging
import sys

from pythonjsonlogger import jsonlogger


def configure_logging(level: str = "INFO") -> None:
    """
    Replace the root handler with a JSON formatter.

    Call once from main.py before `app = FastAPI(...)`.
    """
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Quieten noisy libraries that aren't ours
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
