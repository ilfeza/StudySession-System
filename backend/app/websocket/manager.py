from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, session_id: int, websocket: WebSocket):
        await websocket.accept()
        self.connections[session_id].append(websocket)

    def disconnect(self, session_id: int, websocket: WebSocket):
        sockets = self.connections.get(session_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets and session_id in self.connections:
            del self.connections[session_id]

    async def broadcast(self, session_id: int, payload: dict):
        for websocket in list(self.connections.get(session_id, [])):
            await websocket.send_json(payload)


chat_manager = ConnectionManager()
widgets_manager = ConnectionManager()
tasks_manager = ConnectionManager()
