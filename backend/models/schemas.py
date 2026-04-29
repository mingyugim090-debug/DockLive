from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime


class TimelineItem(BaseModel):
    id: str
    label: str
    date: str  # "YYYY-MM-DD"
    d_day: int
    is_deadline: bool = False
    status: Literal["safe", "warning", "danger", "passed"]


class ChecklistItem(BaseModel):
    id: str
    label: str
    category: Literal["required", "optional"]
    description: Optional[str] = None
    file_format: Optional[str] = None


class DocumentSection(BaseModel):
    id: str
    title: str
    hint: str
    order: int


class AnalysisResult(BaseModel):
    id: str
    doc_type: Literal["competition", "research", "scholarship", "startup"]
    title: str
    organization: str
    timeline: list[TimelineItem]
    checklist: list[ChecklistItem]
    document_template: list[DocumentSection]
    analyzed_at: str


class AnalysisResponse(BaseModel):
    success: bool
    data: AnalysisResult
