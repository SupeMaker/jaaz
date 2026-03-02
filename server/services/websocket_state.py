# services/websocket_state.py
import socketio  # type: ignore
from typing import Any, Dict, Optional

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi'
)

active_connections: Dict[str, dict[str, Any]] = {}

def add_connection(socket_id: str, user_info: Optional[dict[str, Any]] = None) -> None:
    active_connections[socket_id] = user_info or {}
    print(f"New connection added: {socket_id}, total connections: {len(active_connections)}")

def remove_connection(socket_id: str) -> None:
    if socket_id in active_connections:
        del active_connections[socket_id]
        print(f"Connection removed: {socket_id}, total connections: {len(active_connections)}")

def get_all_socket_ids() -> list[str]:
    return list(active_connections.keys())

def get_connection_count() -> int:
    return len(active_connections)
