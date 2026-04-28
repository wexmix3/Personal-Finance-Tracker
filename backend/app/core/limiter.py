"""
Shared slowapi Limiter singleton.

Import this in main.py (to attach to app.state) and in any route module
that uses @limiter.limit() decorators.  Using one instance everywhere
ensures the rate-limit state and the app.state reference are in sync.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
