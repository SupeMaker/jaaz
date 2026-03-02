from pydantic import BaseModel
from typing import Literal, List, TypedDict, Union

class LLMConfig(BaseModel):
    model: str
    base_url: str
    api_key: str
    max_tokens: int
    temperature: float

class ConfigUpdate(BaseModel):
    llm: LLMConfig

class ModelInfo(TypedDict):
    provider: str
    model: str # For tool type, it is the function name
    url: str
    type: Union[Literal['text', 'image', 'video'], List[Literal['text', 'image', 'video']]]
