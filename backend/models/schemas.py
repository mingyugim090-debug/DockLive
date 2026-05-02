from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


DocType = Literal["competition", "research", "scholarship", "startup"]
ItemCategory = Literal["required", "optional"]
DayStatus = Literal["safe", "warning", "danger", "passed"]
InputFieldType = Literal["text", "textarea", "number", "date", "file_note"]
DraftStatus = Literal["empty", "needs_input", "drafted", "revised", "confirmed"]
WorkflowStatus = Literal["analyzed", "collecting_inputs", "drafting", "reviewing", "confirmed", "finalized"]


class TimelineItem(BaseModel):
    id: str
    label: str
    date: str
    d_day: int
    is_deadline: bool = False
    status: DayStatus


class ChecklistItem(BaseModel):
    id: str
    label: str
    category: ItemCategory
    description: Optional[str] = None
    file_format: Optional[str] = None


class DocumentSection(BaseModel):
    id: str
    title: str
    hint: str
    order: int


class AnalysisResult(BaseModel):
    id: str
    doc_type: DocType
    title: str
    organization: str
    timeline: list[TimelineItem]
    checklist: list[ChecklistItem]
    document_template: list[DocumentSection]
    analyzed_at: str
    eligibility: list[str] = Field(default_factory=list)
    submission_method: Optional[str] = None
    evaluation_criteria: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    uncertain_fields: list[str] = Field(default_factory=list)


class UserInputField(BaseModel):
    id: str
    label: str
    field_type: InputFieldType = "textarea"
    required: bool = True
    section_id: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    value: str = ""


class UserInputUpdate(BaseModel):
    field_id: str
    value: str


class UserInputsRequest(BaseModel):
    inputs: list[UserInputUpdate]


class DraftSection(BaseModel):
    id: str
    section_id: str
    title: str
    content_markdown: str = ""
    status: DraftStatus = "empty"
    needs_confirmation: list[str] = Field(default_factory=list)
    user_feedback: str = ""
    updated_at: Optional[str] = None


class DraftFeedbackRequest(BaseModel):
    feedback: str


class FinalDocument(BaseModel):
    title: str
    content_markdown: str
    created_at: str


class WorkflowSession(BaseModel):
    id: str
    analysis: AnalysisResult
    status: WorkflowStatus = "analyzed"
    user_inputs: list[UserInputField] = Field(default_factory=list)
    draft_sections: list[DraftSection] = Field(default_factory=list)
    final_document: Optional[FinalDocument] = None
    confirmed_at: Optional[str] = None
    created_at: str
    updated_at: str


class AnalysisResponse(BaseModel):
    success: bool
    data: AnalysisResult


class WorkflowResponse(BaseModel):
    success: bool
    data: WorkflowSession


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"
