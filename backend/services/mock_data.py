from datetime import date, timedelta


def get_mock_result() -> dict:
    """Return a Korean sample announcement analysis for demo and mock mode."""
    today = date.today()
    deadline = today + timedelta(days=14)

    return {
        "doc_type": "startup",
        "title": "2026 청년 창업 아이디어 공모전",
        "organization": "서울청년경제진흥원",
        "summary": (
            "예비 창업자와 초기 창업팀을 대상으로 창업 아이디어와 실행 계획을 평가하는 공모전입니다. "
            "선정 팀에는 상금, 창업 멘토링, 공유오피스 이용권이 제공됩니다."
        ),
        "timeline": [
            {"label": "접수 시작", "date": (today + timedelta(days=1)).isoformat(), "is_deadline": False},
            {"label": "서류 접수 마감", "date": deadline.isoformat(), "is_deadline": True},
            {"label": "1차 심사 결과 발표", "date": (today + timedelta(days=24)).isoformat(), "is_deadline": False},
            {"label": "최종 발표 평가", "date": (today + timedelta(days=35)).isoformat(), "is_deadline": True},
        ],
        "checklist": [
            {
                "label": "참가 신청서",
                "category": "required",
                "description": "공고문에 첨부된 지정 양식을 사용합니다.",
                "file_format": "HWP, PDF",
            },
            {
                "label": "사업계획서",
                "category": "required",
                "description": "A4 10매 이내로 문제 정의, 솔루션, 실행 계획을 포함합니다.",
                "file_format": "HWP, PDF",
            },
            {
                "label": "대표자 재학 또는 재직 증명서",
                "category": "required",
                "description": "팀 참가 시 구성원 전원 제출이 필요합니다.",
                "file_format": "PDF",
            },
            {
                "label": "포트폴리오",
                "category": "optional",
                "description": "기존 프로젝트 실적이 있는 경우 제출할 수 있습니다.",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "문제 정의",
                "hint": "해결하려는 고객 문제, 현재 불편, 시장에서의 필요성을 구체적으로 작성하세요.",
                "order": 1,
            },
            {
                "title": "솔루션 개요",
                "hint": "제안하는 서비스의 핵심 기능과 기존 대안 대비 차별점을 작성하세요.",
                "order": 2,
            },
            {
                "title": "비즈니스 모델",
                "hint": "고객군, 수익 구조, 가격 전략, 초기 확보 전략을 작성하세요.",
                "order": 3,
            },
            {
                "title": "실행 계획",
                "hint": "6개월 이내 개발, 검증, 출시 계획과 주요 마일스톤을 작성하세요.",
                "order": 4,
            },
            {
                "title": "팀 역량",
                "hint": "팀원의 역할, 관련 경험, 프로젝트 수행 역량을 작성하세요.",
                "order": 5,
            },
        ],
        "eligibility": [
            "만 19세 이상 34세 이하 청년",
            "예비창업자 또는 창업 3년 이내 초기 창업팀",
            "팀 참가 시 대표자를 포함해 최대 5명까지 가능",
        ],
        "submission_method": "온라인 접수 시스템을 통한 PDF 파일 제출",
        "evaluation_criteria": [
            "문제 인식의 구체성",
            "아이디어의 혁신성과 실현 가능성",
            "사업화 가능성과 기대 효과",
            "팀 역량과 실행 계획의 타당성",
        ],
        "benefits": [
            "대상 1팀 상금 500만원",
            "우수팀 창업 멘토링 및 후속 사업 연계",
            "공유오피스 6개월 이용권",
        ],
        "cautions": [
            "타 공모전 수상작과 동일한 아이디어는 심사에서 제외될 수 있습니다.",
            "제출 마감 이후에는 서류 수정이 불가능합니다.",
        ],
        "uncertain_fields": [],
        "source_evidence": [
            {"field": "title", "quote": "2026 청년 창업 아이디어 공모전", "note": "mock fixture"},
            {"field": "submission_deadline", "quote": f"서류 접수 마감: {deadline.isoformat()}", "note": "mock fixture"},
            {"field": "submission_method", "quote": "온라인 접수 시스템을 통한 PDF 파일 제출", "note": "mock fixture"},
        ],
    }
