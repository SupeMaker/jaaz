from models.tool_model import ToolInfoJson
from services.db_service import db_service
from .StreamProcessor import StreamProcessor
from .agent_manager import AgentManager
import traceback
from utils.http_client import HttpClient
from langgraph_swarm import create_swarm  # type: ignore
from langchain_openai import ChatOpenAI
from services.websocket_service import send_to_websocket  # type: ignore
from services.config_service import config_service
from typing import Optional, List, Dict, Any, cast, Set, TypedDict
from models.config_model import ModelInfo


# 兼容 langchain_core 0.3.x 在未安装 langchain 主包或主包版本不一致时
# 访问 `langchain.verbose` / `langchain.debug` / `langchain.llm_cache` 抛
# AttributeError 的问题。
# 触发点：
#   - langchain_core.language_models.base._get_verbosity → globals.get_verbose
#   - langchain_core.callbacks.manager._get_debug → globals.get_debug
#   - langchain_core.language_models.chat_models._agenerate_with_cache →
#       globals.get_llm_cache
# 它们都假设 langchain 主包已安装并具有相应属性。
# 当 langgraph_swarm / langchain_openai 等子包先于 langchain_core 被 import 时，
# 它们会向 sys.modules 注入一个不含 verbose/debug/llm_cache 的 langchain 命名
# 空间 stub，导致 AttributeError。
# 兜底策略：
#   1) 显式 set_verbose / set_debug / set_llm_cache，初始化新版内部状态；
#   2) Monkey-patch get_verbose / get_debug / get_llm_cache，遇到 AttributeError
#      时回退到内部状态；
#   3) Patch 已经 import 过的下游模块的引用（base / manager / config /
#      chat_models）；
#   4) 若 langchain 命名空间存在但缺 verbose/debug/llm_cache 属性，自动补上。
def _install_langchain_core_compat() -> None:
    try:
        from langchain_core import globals as _lc_globals
    except Exception:
        return

    # 1) 显式调用 set_*，初始化新版本内部状态
    try:
        _lc_globals.set_verbose(False)  # type: ignore[attr-defined]
    except Exception:
        try:
            _lc_globals._verbose = False  # type: ignore[attr-defined]
        except Exception:
            pass
    try:
        _lc_globals.set_debug(False)  # type: ignore[attr-defined]
    except Exception:
        try:
            _lc_globals._debug = False  # type: ignore[attr-defined]
        except Exception:
            pass
    try:
        _lc_globals.set_llm_cache(None)  # type: ignore[attr-defined]
    except Exception:
        try:
            _lc_globals._llm_cache = None  # type: ignore[attr-defined]
        except Exception:
            pass

    # 2) Monkey-patch get_* 函数，捕获 AttributeError 并回退
    _orig_get_verbose = getattr(_lc_globals, 'get_verbose', None)
    _orig_get_debug = getattr(_lc_globals, 'get_debug', None)
    _orig_get_llm_cache = getattr(_lc_globals, 'get_llm_cache', None)

    def _safe_get_verbose() -> bool:  # type: ignore[no-redef]
        try:
            if _orig_get_verbose is not None:
                return _orig_get_verbose()
        except AttributeError:
            pass
        return getattr(_lc_globals, '_verbose', False)

    def _safe_get_debug() -> bool:  # type: ignore[no-redef]
        try:
            if _orig_get_debug is not None:
                return _orig_get_debug()
        except AttributeError:
            pass
        return getattr(_lc_globals, '_debug', False)

    def _safe_get_llm_cache() -> "Optional[object]":  # type: ignore[no-redef]
        try:
            if _orig_get_llm_cache is not None:
                return _orig_get_llm_cache()
        except AttributeError:
            pass
        return getattr(_lc_globals, '_llm_cache', None)

    _lc_globals.get_verbose = _safe_get_verbose  # type: ignore[assignment]
    _lc_globals.get_debug = _safe_get_debug  # type: ignore[assignment]
    _lc_globals.get_llm_cache = _safe_get_llm_cache  # type: ignore[assignment]

    # 3) Patch 已经 import 过的下游模块的引用
    try:
        from langchain_core.language_models import base as _lc_base
        _lc_base.get_verbose = _safe_get_verbose  # type: ignore[assignment]
    except Exception:
        pass
    try:
        from langchain_core.callbacks import manager as _lc_manager
        _lc_manager.get_debug = _safe_get_debug  # type: ignore[assignment]
    except Exception:
        pass
    try:
        from langchain_core.runnables import config as _lc_config
        _lc_config.get_debug = _safe_get_debug  # type: ignore[assignment]
    except Exception:
        pass
    try:
        from langchain_core.language_models import chat_models as _lc_chat_models
        _lc_chat_models.get_llm_cache = _safe_get_llm_cache  # type: ignore[assignment]
    except Exception:
        pass


_install_langchain_core_compat()

# 4) 若 langchain 命名空间存在但缺 verbose/debug/llm_cache，补上默认属性
try:
    import langchain  # type: ignore
    if not hasattr(langchain, 'verbose'):
        langchain.verbose = False  # type: ignore[attr-defined]
    if not hasattr(langchain, 'debug'):
        langchain.debug = False  # type: ignore[attr-defined]
    if not hasattr(langchain, 'llm_cache'):
        langchain.llm_cache = None  # type: ignore[attr-defined]
except Exception:
    pass


class ContextInfo(TypedDict):
    """Context information passed to tools"""
    canvas_id: str
    session_id: str
    model_info: Dict[str, List[ModelInfo]]


def _fix_chat_history(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """修复聊天历史中不完整的工具调用

    根据LangGraph文档建议，移除没有对应ToolMessage的tool_calls
    参考: https://langchain-ai.github.io/langgraph/troubleshooting/errors/INVALID_CHAT_HISTORY/
    """
    if not messages:
        return messages

    fixed_messages: List[Dict[str, Any]] = []
    tool_call_ids: Set[str] = set()

    # 第一遍：收集所有ToolMessage的tool_call_id
    for msg in messages:
        if msg.get('role') == 'tool' and msg.get('tool_call_id'):
            tool_call_id = msg.get('tool_call_id')
            if tool_call_id:
                tool_call_ids.add(tool_call_id)

    # 第二遍：修复AIMessage中的tool_calls
    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            # 过滤掉没有对应ToolMessage的tool_calls
            valid_tool_calls: List[Dict[str, Any]] = []
            removed_calls: List[str] = []

            for tool_call in msg.get('tool_calls', []):
                tool_call_id = tool_call.get('id')
                if tool_call_id in tool_call_ids:
                    valid_tool_calls.append(tool_call)
                elif tool_call_id:
                    removed_calls.append(tool_call_id)

            # 记录修复信息
            if removed_calls:
                print(
                    f"🔧 修复消息历史：移除了 {len(removed_calls)} 个不完整的工具调用: {removed_calls}")

            # 更新消息
            if valid_tool_calls:
                msg_copy = msg.copy()
                msg_copy['tool_calls'] = valid_tool_calls
                fixed_messages.append(msg_copy)
            elif msg.get('content'):  # 如果没有有效的tool_calls但有content，保留消息
                msg_copy = msg.copy()
                msg_copy.pop('tool_calls', None)  # 移除空的tool_calls
                fixed_messages.append(msg_copy)
            # 如果既没有有效tool_calls也没有content，跳过这条消息
        else:
            # 非assistant消息或没有tool_calls的消息直接保留
            fixed_messages.append(msg)

    return fixed_messages


async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    tool_list: List[ToolInfoJson],
    system_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数

    Args:
        messages: 消息历史
        canvas_id: 画布ID
        session_id: 会话ID
        text_model: 文本模型配置
        tool_list: 工具模型配置列表（图像或视频模型）
        system_prompt: 系统提示词
    """
    try:
        # 0. 修复消息历史
        fixed_messages = _fix_chat_history(messages)

        # 2. 文本模型
        text_model_instance = _create_text_model(text_model)

        # 3. 创建智能体
        agents = AgentManager.create_agents(
            text_model_instance,
            tool_list,  # 传入所有注册的工具
            system_prompt or ""
        )
        agent_names = [agent.name for agent in agents]
        print('👇agent_names', agent_names)
        last_agent = AgentManager.get_last_active_agent(
            fixed_messages, agent_names)

        print('👇last_agent', last_agent)

        # 4. 创建智能体群组
        swarm = create_swarm(
            agents=agents,  # type: ignore
            default_active_agent=last_agent if last_agent else agent_names[0]
        )

        # 5. 创建上下文
        context: Dict[str, Any] = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'tool_list': tool_list,
        }

        # 6. 流处理
        processor = StreamProcessor(
            session_id, db_service, send_to_websocket)  # type: ignore
        await processor.process_stream(swarm, fixed_messages, context)

    except Exception as e:
        # 检查是否是文本模型连接错误，如果是则尝试直接调用图像生成工具
        if _is_connection_error(e) and tool_list:
            print(f"⚠️ 文本模型连接失败，尝试直接调用图像生成工具: {e}")
            handled = await _try_direct_image_generation(
                e, messages, canvas_id, session_id, tool_list
            )
            if handled:
                return
        await _handle_error(e, session_id)


def _is_connection_error(error: Exception) -> bool:
    """检查是否是网络连接错误"""
    error_str = str(error).lower()
    # openai.APIConnectionError 或类似连接错误
    if 'connection' in error_str or 'connect' in error_str:
        return True
    if 'apiconnectionerror' in type(error).__name__.lower():
        return True
    # 检查异常链
    cause = error.__cause__
    if cause and ('connection' in str(cause).lower() or 'apiconnectionerror' in type(cause).__name__.lower()):
        return True
    return False


async def _try_direct_image_generation(
    error: Exception,
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    tool_list: List[ToolInfoJson],
) -> bool:
    """
    当文本模型不可用时，尝试直接用用户提示词调用图像生成工具。

    Returns:
        True 如果成功调用了图像生成，False 如果无法处理
    """
    try:
        # 从消息中提取最后的用户提示词
        user_prompt = ""
        for msg in reversed(messages):
            if msg.get('role') == 'user':
                content = msg.get('content', '')
                if isinstance(content, str):
                    user_prompt = content
                elif isinstance(content, list):
                    # 处理多模态消息
                    for part in content:
                        if isinstance(part, dict) and part.get('type') == 'text':
                            user_prompt = part.get('text', '')
                            break
                break

        if not user_prompt.strip():
            print("⚠️ 无法提取用户提示词，跳过直接图像生成")
            return False

        # 找到第一个图像生成工具
        image_tool = None
        for tool in tool_list:
            if tool.get('type') == 'image':
                image_tool = tool
                break

        if not image_tool:
            print("⚠️ 没有可用的图像生成工具")
            return False

        provider = image_tool.get('provider', 'agnes')
        model = image_tool.get('model') or image_tool.get('id', 'agnes-image-2.0-flash')

        print(f"🎨 直接图像生成 fallback: provider={provider}, model={model}")
        print(f"   提示词: {user_prompt[:100]}...")

        # 通知前端正在直接生成图像
        await send_to_websocket(session_id, cast(Dict[str, Any], {
            'type': 'info',
            'info': f'文本模型不可用，正在直接生成图像...'
        }))

        # 导入图像生成核心函数
        from tools.utils.image_generation_core import generate_image_with_provider

        # 直接调用图像生成（纯文生图，无输入图片）
        result = await generate_image_with_provider(
            canvas_id=canvas_id,
            session_id=session_id,
            provider=provider,
            model=model,
            prompt=user_prompt,
            aspect_ratio="1:1",
            input_images=None,
        )

        print(f"✅ 直接图像生成成功: {result}")
        return True

    except Exception as fallback_error:
        print(f"❌ 直接图像生成 fallback 也失败了: {fallback_error}")
        traceback.print_exc()
        return False


def _create_text_model(text_model: ModelInfo) -> Any:
    """创建语言模型实例"""
    model = text_model.get('model')
    provider = text_model.get('provider')
    url = text_model.get('url')
    api_key = config_service.app_config.get(  # type: ignore
        provider, {}).get("api_key", "")

    # TODO: Verify if max token is working
    # max_tokens = text_model.get('max_tokens', 8148)

    if provider == 'ollama':
        try:
            from langchain_ollama import ChatOllama
        except Exception as e:
            raise RuntimeError(
                "Ollama provider requested but 'langchain_ollama' is not available."
                " Install the package or enable a different provider in config."
            ) from e

        return ChatOllama(
            model=model,
            base_url=url,
        )
    else:
        # Create httpx client with SSL configuration for ChatOpenAI
        http_client = HttpClient.create_sync_client()
        http_async_client = HttpClient.create_async_client()
        return ChatOpenAI(
            model=model,
            api_key=api_key,  # type: ignore
            timeout=300,
            base_url=url,
            temperature=0,
            # max_tokens=max_tokens, # TODO: 暂时注释掉有问题的参数
            http_client=http_client,
            http_async_client=http_async_client
        )


async def _handle_error(error: Exception, session_id: str) -> None:
    """处理错误"""
    print('Error in langgraph_agent', error)
    tb_str = traceback.format_exc()
    print(f"Full traceback:\n{tb_str}")
    traceback.print_exc()

    await send_to_websocket(session_id, cast(Dict[str, Any], {
        'type': 'error',
        'error': str(error)
    }))
