from datetime import date, timedelta


def get_mock_result() -> dict:
    """테스트용 샘플 분석 결과를 반환합니다."""
    today = date.today()

    return {
        "doc_type": "competition",
        "title": "2026 청년 창업 아이디어 공모전",
        "organization": "서울특별시 경제진흥원",
        "timeline": [
            {
                "label": "접수 시작",
                "date": (today + timedelta(days=1)).isoformat(),
                "is_deadline": False,
            },
            {
                "label": "서류 접수 마감",
                "date": (today + timedelta(days=3)).isoformat(),
                "is_deadline": True,
            },
            {
                "label": "1차 심사 결과 발표",
                "date": (today + timedelta(days=10)).isoformat(),
                "is_deadline": False,
            },
            {
                "label": "최종 발표 (PT)",
                "date": (today + timedelta(days=20)).isoformat(),
                "is_deadline": True,
            },
            {
                "label": "수상자 발표",
                "date": (today + timedelta(days=25)).isoformat(),
                "is_deadline": False,
            },
            {
                "label": "사업계획서 제출",
                "date": (today - timedelta(days=2)).isoformat(),
                "is_deadline": True,
            },
        ],
        "checklist": [
            {
                "label": "사업계획서",
                "category": "required",
                "description": "A4 10매 이내, 지정 양식 사용 필수",
                "file_format": "PDF, HWP",
            },
            {
                "label": "팀원 재학증명서",
                "category": "required",
                "description": "발급일 3개월 이내, 팀원 전원 제출",
                "file_format": "PDF",
            },
            {
                "label": "사업자등록증 사본",
                "category": "optional",
                "description": "법인 또는 개인사업자인 경우만 제출",
                "file_format": "PDF",
            },
            {
                "label": "포트폴리오",
                "category": "optional",
                "description": "기존 프로젝트 실적이 있는 경우 제출 가능",
                "file_format": "PDF",
            },
            {
                "label": "특허 또는 지식재산권 증명서",
                "category": "optional",
                "description": "보유한 경우에만 해당",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "문제 정의",
                "hint": "해결하려는 사회적·경제적 문제와 현황을 데이터와 함께 서술하세요. 문제의 심각성과 시장 규모를 수치로 제시하면 설득력이 높아집니다.",
                "order": 1,
            },
            {
                "title": "솔루션 제안",
                "hint": "우리 팀이 제안하는 해결책과 기존 대안 대비 차별점을 명확하게 작성하세요. 핵심 기술 또는 방법론을 간략히 설명합니다.",
                "order": 2,
            },
            {
                "title": "비즈니스 모델",
                "hint": "수익 창출 구조를 명확히 기술하세요. 고객 세그먼트, 가치 제안, 채널, 수익원을 포함한 비즈니스 캔버스를 작성하면 좋습니다.",
                "order": 3,
            },
            {
                "title": "시장 분석",
                "hint": "목표 시장의 규모(TAM/SAM/SOM)를 분석하고, 주요 경쟁사와의 비교 포지셔닝을 표 또는 그래프로 제시하세요.",
                "order": 4,
            },
            {
                "title": "팀 소개",
                "hint": "팀원 각자의 역할과 핵심 역량을 소개하세요. 프로젝트와 관련된 수상 이력, 경험, 기술 스택을 강조하면 좋습니다.",
                "order": 5,
            },
            {
                "title": "실행 계획 및 일정",
                "hint": "향후 6개월~1년간의 개발·마케팅 로드맵을 마일스톤 기반으로 작성하세요. 지원금 사용 계획도 포함합니다.",
                "order": 6,
            },
        ],
    }
