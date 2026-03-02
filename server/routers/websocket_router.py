# routers/websocket_router.py
from typing import Any
from services.websocket_state import sio, add_connection, remove_connection

@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> None:
    print(f"Client {sid} connected")
    
    user_info = auth or {}
    add_connection(sid, user_info)
    
    await sio.emit('connected', {'status': 'connected'}, room=sid)

@sio.event
async def disconnect(sid: str) -> None:
    print(f"Client {sid} disconnected")
    remove_connection(sid)

@sio.event
async def ping(sid: str, data: Any) -> None:
    await sio.emit('pong', data, room=sid)
