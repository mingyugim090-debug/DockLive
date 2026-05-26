from models.schemas import AnalysisResult, WorkflowSession
from services import storage
from services.drafting_service import create_workflow_session


def recover_workflow_from_analysis(workflow_id: str) -> WorkflowSession | None:
    data = storage.load_result(workflow_id)
    if data is None:
        return None
    result = AnalysisResult(**data)
    workflow = create_workflow_session(result)
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))
    return workflow


def load_or_recover_workflow(workflow_id: str) -> WorkflowSession | None:
    data = storage.load_workflow(workflow_id)
    if data is None:
        return recover_workflow_from_analysis(workflow_id)
    try:
        return WorkflowSession(**data)
    except Exception:
        return recover_workflow_from_analysis(workflow_id)
