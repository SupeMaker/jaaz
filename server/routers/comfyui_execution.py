import json
import time
import urllib.parse
import uuid
from datetime import timedelta
from typing import Any, Optional

import httpx
import websockets
import typer
from rich import print as pprint
from rich.progress import BarColumn, Progress, TimeElapsedColumn
from rich.table import Column, Table
from utils.http_client import HttpClient

from services.websocket_service import send_to_websocket


async def check_comfy_server_running(base_url: str) -> bool:
    async with HttpClient.create(timeout=10) as client:
        url = f"{base_url}/api/prompt"
        response = await client.get(url)
        return response.status_code == 200


async def execute(
    workflow: dict[str, Any],
    base_url: str,
    wait: bool = True,
    verbose: bool = False,
    local_paths: bool = False,
    timeout: int = 300,
    ctx: Optional[dict[str, Any]] = None,
):
    if ctx is None:
        ctx = {}
    if not await check_comfy_server_running(base_url):
        pprint(
            f"[bold red]ComfyUI not running on specified address ({base_url})[/bold red]"
        )
        raise typer.Exit(code=1)

    progress: Optional[ExecutionProgress] = None
    start = time.time()
    if wait:
        pprint("Executing comfyui workflow")
        progress = ExecutionProgress()
        # Remove or comment out the line below to avoid starting the live display
        # progress.start()
    else:
        print("Queuing comfyui workflow")

    execution = WorkflowExecution(
        workflow, base_url, verbose, progress, local_paths, timeout, ctx=ctx
    )

    try:
        if wait:
            await execution.connect()
        await execution.queue()
        if wait:
            await execution.watch_execution()
            end = time.time()
            if progress:
                progress.stop()
            progress = None

            if len(execution.outputs) > 0:
                pprint("[bold green]\nOutputs:[/bold green]")

                for f in execution.outputs:
                    pprint(f)

            elapsed = timedelta(seconds=end - start)
            pprint(
                f"[bold green]\nWorkflow execution completed ({elapsed})[/bold green]"
            )
        else:
            pprint("[bold green]Workflow queued[/bold green]")
    finally:
        if progress:
            progress.stop()
    return execution


class ExecutionProgress(Progress):
    def get_renderables(self):
        table_columns = (
            (
                Column(no_wrap=True)
                if isinstance(_column, str)
                else _column.get_table_column().copy()
            )
            for _column in self.columns
        )

        for task in self.tasks:
            percent = "[progress.percentage]{task.percentage:>3.0f}%".format(task=task)
            if task.fields.get("progress_type") == "overall":
                overall_table = Table.grid(
                    *table_columns, padding=(0, 1), expand=self.expand
                )
                overall_table.add_row(
                    BarColumn().render(task), percent, TimeElapsedColumn().render(task)
                )
                yield overall_table
            else:
                yield self.make_tasks_table([task])


class WorkflowExecution:
    def __init__(
        self,
        workflow: dict[str, Any],
        base_url: str,
        verbose: bool,
        progress: Optional[ExecutionProgress],
        local_paths: bool,
        timeout: int = 30,
        ctx: Optional[dict[str, Any]] = None,
    ):
        self.workflow = workflow
        self.base_url = base_url
        self.verbose = verbose
        self.local_paths = local_paths
        self.client_id = str(uuid.uuid4())
        self.outputs: list[str] = []
        self.progress = progress
        self.remaining_nodes: set[str] = set(self.workflow.keys())
        self.total_nodes = len(self.remaining_nodes)
        self.overall_task: Any = None
        if self.progress is not None:
            self.overall_task = self.progress.add_task(
                "", total=self.total_nodes, progress_type="overall"
            )
        self.current_node: Optional[str] = None
        self.progress_task: Any = None
        self.progress_node: Optional[str] = None
        self.prompt_id: Optional[str] = None
        self.ws: Any = None
        self.timeout = timeout
        self.ctx: dict[str, Any] = ctx if ctx is not None else {}

    async def connect(self):
        if self.base_url.startswith("https"):
            self.ws_core = "wss://"
        else:
            self.ws_core = "ws://"
        ws_url = self.base_url.split("//")[1]
        if "/" in ws_url:
            ws_url = ws_url.split("/")[0]
        self.ws = await websockets.connect(
            f"{self.ws_core}{ws_url}/ws?clientId={self.client_id}"
        )

    async def queue(self) -> None:
        data: dict[str, Any] = {"prompt": self.workflow, "client_id": self.client_id}
        async with HttpClient.create() as client:
            try:
                response = await client.post(f"{self.base_url}/prompt", json=data)
                body = response.json()
                self.prompt_id = body["prompt_id"]
            except httpx.HTTPStatusError as e:
                message = "An unknown error occurred"
                if e.response.status_code == 500:
                    message = e.response.text
                elif e.response.status_code == 400:
                    body = e.response.json()
                    if body["node_errors"].keys():
                        message = json.dumps(body["node_errors"], indent=2)

                if self.progress:
                    self.progress.stop()

                pprint(f"[bold red]Error running workflow\n{message}[/bold red]")
                await send_to_websocket(
                    self.ctx.get("session_id") or "", {"type": "error", "error": message}
                )
                raise Exception(message)

    async def watch_execution(self) -> None:
        if self.ws is None:
            raise Exception("WebSocket not connected")
        async for message in self.ws:
            if isinstance(message, str):
                message = json.loads(message)
                if message.get("data", {}).get("prompt_id") != self.prompt_id:
                    continue
                if not await self.on_message(message):
                    # get task_id and check if task_id is saved to prompt
                    async with HttpClient.create() as client:
                        try:
                            response = await client.get(f"{self.base_url}/history/{self.prompt_id}")
                            if response.status_code != 200:
                                raise Exception(response)
                            response_body = response.json()
                            if self.prompt_id in response_body:
                                break
                            else:
                                continue
                        except Exception as e:
                            pprint(f"[bold red]Error getting history\n{str(e)}[/bold red]")
                            raise Exception(str(e))

    def update_overall_progress(self) -> None:
        if self.progress and self.overall_task is not None:
            self.progress.update(
                self.overall_task, completed=self.total_nodes - len(self.remaining_nodes)
            )

    def get_node_title(self, node_id: str) -> str:
        node = self.workflow[node_id]
        if "_meta" in node and "title" in node["_meta"]:
            return node["_meta"]["title"]
        return node["class_type"]

    def log_node(self, type: str, node_id: str) -> None:
        if not self.verbose:
            return

        node = self.workflow[node_id]
        class_type = node["class_type"]
        title = self.get_node_title(node_id)

        if title != class_type:
            title += f"[bright_black] - {class_type}[/]"
        title += f"[bright_black] ({node_id})[/]"

        pprint(f"{type} : {title}")

    def format_image_path(self, img: dict[str, Any]) -> str:
        query = urllib.parse.urlencode(img)
        return f"{self.base_url}/view?{query}"

    async def on_message(self, message: dict[str, Any]) -> Optional[bool]:
        data: dict[str, Any] = message["data"] if "data" in message else {}
        if "prompt_id" not in data or data["prompt_id"] != self.prompt_id:
            return True

        if message["type"] == "status":
            return await self.on_status(data)
        elif message["type"] == "executing":
            return await self.on_executing(data)
        elif message["type"] == "execution_cached":
            await self.on_cached(data)
        elif message["type"] == "progress":
            await self.on_progress(data)
        elif message["type"] == "executed":
            await self.on_executed(data)
        elif message["type"] == "execution_error":
            await self.on_error(data)

        return True

    async def on_status(self, data: dict[str, Any]) -> None:
        queue = data['data']['status']['exec_info']['queue_remaining']
        session_id = self.ctx.get("session_id") or ""
        await send_to_websocket(
            session_id,
            {
                "type": "tool_call_progress",
                "tool_call_id": self.ctx.get("tool_call_id"),
                "session_id": session_id,
                "update": f"In queue, there's {queue} works ahead...",
            },
        )

    async def on_executing(self, data: dict[str, Any]) -> bool:
        if self.progress_task and self.progress is not None:
            self.progress.remove_task(self.progress_task)
            self.progress_task = None

        if data["node"] is None:
            return False
        else:
            if self.current_node:
                self.remaining_nodes.discard(self.current_node)
                self.update_overall_progress()
            # Use display_node if available, otherwise use node
            node_id: str = str(data.get("display_node", data.get('node')))
            
            self.current_node = node_id
            self.log_node("Executing", node_id)
            session_id = self.ctx.get("session_id")
            if session_id:
                await send_to_websocket(
                    session_id,
                    {
                        "type": "tool_call_progress",
                        "tool_call_id": self.ctx.get("tool_call_id"),
                        "session_id": session_id,
                        "update": f"Executing {self.get_node_title(node_id)}",
                    },
                )
        return True

    async def on_cached(self, data: dict[str, Any]) -> None:
        nodes = data["nodes"]
        for n in nodes:
            self.remaining_nodes.discard(n)
            self.log_node("Cached", n)
        self.update_overall_progress()

    async def on_progress(self, data: dict[str, Any]) -> None:
        node: str = data["node"]
        session_id = self.ctx.get("session_id")
        if session_id:
            await send_to_websocket(
                session_id,
                {
                    "type": "tool_call_progress",
                    "tool_call_id": self.ctx.get("tool_call_id"),
                    "session_id": session_id,
                    "update": f"Executing {self.get_node_title(node)} {round(data['value'] / data['max'] * 100)}%",
                },
            )
        if self.progress is not None:
            if self.progress_node != node:
                self.progress_node = node
                if self.progress_task:
                    self.progress.remove_task(self.progress_task)

                self.progress_task = self.progress.add_task(
                    self.get_node_title(node), total=data["max"], progress_type="node"
                )

            self.progress.update(self.progress_task, completed=data["value"])

    async def on_executed(self, data: dict[str, Any]) -> None:
        self.remaining_nodes.discard(data["node"])
        self.update_overall_progress()

        if "output" not in data:
            return

        output = data["output"]

        if output is None:
            return

        for img in output.get("images", []):
            self.outputs.append(self.format_image_path(img))

        for gif in output.get("gifs", []):
            self.outputs.append(self.format_image_path(gif))

        session_id = self.ctx.get("session_id") or ""
        await send_to_websocket(
            session_id,
            {
                "type": "tool_call_progress",
                "tool_call_id": self.ctx.get("tool_call_id"),
                "session_id": session_id,
                "update": "",  # clear the progress update section by send empty string
            },
        )

    async def on_error(self, data: dict[str, Any]) -> None:
        pprint(
            f"[bold red]Error running workflow\n{json.dumps(data, indent=2)}[/bold red]"
        )
        session_id = self.ctx.get("session_id") or ""
        await send_to_websocket(
            session_id,
            {"type": "error", "error": json.dumps(data, indent=2)},
        )
        raise Exception(json.dumps(data, indent=2))


async def upload_image(image: Any, base_url: str, filename: Optional[str] = None, subfolder: str = 'jaaz') -> str:
    # Create a tuple with (filename, file_content) for proper multipart upload
    files = {"image": (filename, image)}
    data = {"type": "input", "subfolder": subfolder, "overwrite": "false"}
    async with HttpClient.create() as client:
        try:
            response = await client.post(
                f"{base_url}/upload/image", files=files, data=data
            )
            body = response.json()
            image_name = body["name"]
            return f"{subfolder}/{image_name}"
        except httpx.HTTPStatusError as e:
            message = "An unknown error occurred"
            if e.response.status_code == 500:
                message = e.response.text
            elif e.response.status_code == 400:
                body = e.response.json()
                if body["node_errors"].keys():
                    message = json.dumps(body["node_errors"], indent=2)
            pprint(f"[bold red]Error uploading image\n{message}[/bold red]")
            raise Exception(message)
