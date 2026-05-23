from datetime import date, timedelta


def get_mock_result(doc_type: str = "startup") -> dict:
    """Return a Korean sample announcement analysis for demo and mock mode."""
    handlers = {
        "startup": _mock_startup,
        "scholarship": _mock_scholarship,
        "business_plan": _mock_business_plan,
        "application": _mock_application,
        "research": _mock_research,
    }
    handler = handlers.get(doc_type, _mock_startup)
    return handler()


def _mock_startup() -> dict:
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
            {"field": "title", "quote": "2026 청년 창업 아이디어 공모전", "note": "mock fixture", "confidence": 0.95},
            {"field": "submission_deadline", "quote": f"서류 접수 마감: {deadline.isoformat()}", "note": "mock fixture", "confidence": 0.9},
            {"field": "submission_method", "quote": "온라인 접수 시스템을 통한 PDF 파일 제출", "note": "mock fixture", "confidence": 0.9},
        ],
        "missing_questions": [
            {
                "id": "q-applicant-strength",
                "question": "팀의 핵심 강점과 증빙 가능한 성과는 무엇인가요?",
                "reason": "평가 기준의 팀 역량과 실행 가능성 항목에 맞춰 초안을 작성해야 합니다.",
                "required_for": "team_capacity",
            },
            {
                "id": "q-project-plan",
                "question": "6개월 안에 검증하거나 출시할 수 있는 구체적인 실행 계획이 있나요?",
                "reason": "사업계획서 실행 계획 섹션에 사용자 제공 사실이 필요합니다.",
                "required_for": "section-4",
            },
        ],
    }


def _mock_scholarship() -> dict:
    today = date.today()
    deadline = today + timedelta(days=21)

    return {
        "doc_type": "scholarship",
        "title": "2026년 국가우수장학금(이공계) 신청 안내",
        "organization": "한국장학재단",
        "summary": (
            "이공계 분야 우수 학생의 학업 지속을 지원하기 위한 국가장학금 신청 안내입니다. "
            "성적 및 소득 기준을 충족하는 대학생이 신청할 수 있으며, 등록금 전액 또는 일부를 지원합니다."
        ),
        "timeline": [
            {"label": "신청 접수 시작", "date": (today + timedelta(days=2)).isoformat(), "is_deadline": False},
            {"label": "신청 마감", "date": deadline.isoformat(), "is_deadline": True},
            {"label": "1차 선발 결과 발표", "date": (today + timedelta(days=35)).isoformat(), "is_deadline": False},
            {"label": "장학금 지급 시작", "date": (today + timedelta(days=50)).isoformat(), "is_deadline": False},
        ],
        "checklist": [
            {
                "label": "장학금 신청서",
                "category": "required",
                "description": "공단 홈페이지에서 다운로드 후 작성",
                "file_format": "HWP, PDF",
            },
            {
                "label": "성적 증명서",
                "category": "required",
                "description": "직전 학기 성적 (4.0/4.5 이상)",
                "file_format": "PDF",
            },
            {
                "label": "가족관계증명서",
                "category": "required",
                "description": "주민등록등본 포함",
                "file_format": "PDF",
            },
            {
                "label": "소득 증빙 자료",
                "category": "required",
                "description": "가구 소득 3분위 이하 해당자 제출",
                "file_format": "PDF",
            },
            {
                "label": "추천서",
                "category": "optional",
                "description": "지도교수 또는 학과장 발행",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "지원 동기 및 목표",
                "hint": "이공계를 선택한 이유와 졸업 후 목표, 장학금 활용 계획을 구체적으로 서술하세요.",
                "order": 1,
            },
            {
                "title": "학업 성취 및 연구 활동",
                "hint": "주요 수강 과목, 성적 우수 사유, 참여한 연구 또는 프로젝트 경험을 서술하세요.",
                "order": 2,
            },
            {
                "title": "경제적 상황 설명",
                "hint": "가정의 경제적 여건을 솔직하고 구체적으로 기술하고, 학업 지속에 필요한 지원 이유를 설명하세요.",
                "order": 3,
            },
            {
                "title": "사회 기여 및 향후 계획",
                "hint": "졸업 후 사회 또는 연구 분야에 기여할 구체적인 계획과 포부를 작성하세요.",
                "order": 4,
            },
        ],
        "eligibility": [
            "국내 4년제 대학 또는 전문대학 재학생 (휴학생 제외)",
            "이공계 관련 학과 재학자",
            "직전 학기 성적 4.0 이상 (4.5 만점 기준)",
            "가구 소득 3분위 이하 해당자 (일부 트랙 제외)",
        ],
        "submission_method": "한국장학재단 홈페이지(www.kosaf.go.kr) 온라인 신청",
        "evaluation_criteria": [
            "학업 성적 우수성 (40점)",
            "지원 동기 및 계획의 구체성 (30점)",
            "경제적 필요도 (20점)",
            "사회 기여 가능성 (10점)",
        ],
        "benefits": [
            "등록금 전액 지원 (최우수)",
            "학기당 최대 520만원 지원",
            "연속 수혜 가능 (성적 유지 시)",
        ],
        "cautions": [
            "중복 장학금 수혜 제한이 적용됩니다.",
            "신청 후 서류 누락 시 심사에서 제외될 수 있습니다.",
        ],
        "uncertain_fields": [],
        "source_evidence": [
            {"field": "title", "quote": "2026년 국가우수장학금(이공계) 신청 안내", "note": "mock fixture", "confidence": 0.95},
            {"field": "submission_deadline", "quote": f"신청 마감: {deadline.isoformat()}", "note": "mock fixture", "confidence": 0.9},
        ],
        "missing_questions": [
            {
                "id": "q-motivation",
                "question": "이공계를 선택한 구체적인 동기와 졸업 후 목표 분야는 무엇인가요?",
                "reason": "지원 동기 섹션 작성을 위해 필요합니다.",
                "required_for": "section-1",
            },
            {
                "id": "q-achievement",
                "question": "학업 중 가장 인상적인 성과나 프로젝트 경험은 무엇인가요?",
                "reason": "학업 성취 섹션 구체화에 필요합니다.",
                "required_for": "section-2",
            },
        ],
    }


def _mock_business_plan() -> dict:
    today = date.today()
    deadline = today + timedelta(days=30)

    return {
        "doc_type": "startup",
        "title": "2026 소상공인 디지털 전환 지원사업 신청",
        "organization": "소상공인시장진흥공단",
        "summary": (
            "매출 10억 이하 소상공인의 디지털 기술 도입을 지원하는 정부 지원사업입니다. "
            "온라인 판매 시스템, POS 도입, 스마트 주문 시스템 등 디지털화에 필요한 비용을 최대 300만원 지원합니다."
        ),
        "timeline": [
            {"label": "공고 게시", "date": today.isoformat(), "is_deadline": False},
            {"label": "신청 마감", "date": deadline.isoformat(), "is_deadline": True},
            {"label": "심사 및 결과 발표", "date": (today + timedelta(days=55)).isoformat(), "is_deadline": False},
            {"label": "지원금 지급", "date": (today + timedelta(days=70)).isoformat(), "is_deadline": False},
        ],
        "checklist": [
            {
                "label": "사업 신청서",
                "category": "required",
                "description": "소진공 공식 양식 사용",
                "file_format": "HWP, PDF",
            },
            {
                "label": "사업자등록증 사본",
                "category": "required",
                "description": "신청일 기준 유효한 사업자",
                "file_format": "PDF",
            },
            {
                "label": "사업계획서",
                "category": "required",
                "description": "A4 5매 이내, 디지털 전환 목표 및 계획 포함",
                "file_format": "HWP, PDF",
            },
            {
                "label": "최근 3개년 매출 증빙",
                "category": "required",
                "description": "세금계산서 또는 부가세 신고서",
                "file_format": "PDF",
            },
            {
                "label": "견적서",
                "category": "optional",
                "description": "도입 예정 장비/서비스 견적",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "사업 목적 및 배경",
                "hint": "현재 사업의 디지털 전환 필요성과 추진 배경을 구체적으로 서술하세요.",
                "order": 1,
            },
            {
                "title": "현황 분석 및 문제점",
                "hint": "현재 운영 방식의 비효율성, 매출 현황, 경쟁사 대비 단점을 분석하세요.",
                "order": 2,
            },
            {
                "title": "디지털 전환 추진 계획",
                "hint": "도입할 디지털 시스템의 종류, 도입 방법, 예상 일정을 구체적으로 작성하세요.",
                "order": 3,
            },
            {
                "title": "기대 효과",
                "hint": "디지털 전환 후 예상 매출 증가, 비용 절감, 고객 서비스 개선 효과를 수치로 제시하세요.",
                "order": 4,
            },
            {
                "title": "예산 집행 계획",
                "hint": "지원금 사용 항목별 금액과 사유를 명확하게 작성하세요.",
                "order": 5,
            },
        ],
        "eligibility": [
            "부가가치세법상 사업자 등록을 완료한 소상공인",
            "연 매출 10억 원 이하 사업체",
            "동종 지원사업 최근 2년 이내 미수혜자",
        ],
        "submission_method": "소진공 온라인 신청 시스템(www.sbiz.or.kr) 또는 지역 소진공 센터 방문 접수",
        "evaluation_criteria": [
            "사업 필요성 및 적합성 (30점)",
            "추진 계획의 구체성과 실현 가능성 (35점)",
            "기대 효과의 타당성 (25점)",
            "지원금 집행 계획의 적절성 (10점)",
        ],
        "benefits": [
            "디지털 전환 비용 최대 300만원 지원",
            "사후 컨설팅 및 성과 관리 지원",
        ],
        "cautions": [
            "지원금은 지정된 목적 이외로 사용 불가합니다.",
            "심사 결과 발표 이전 자체 집행 비용은 지원 불가합니다.",
        ],
        "uncertain_fields": [],
        "source_evidence": [
            {"field": "title", "quote": "2026 소상공인 디지털 전환 지원사업", "note": "mock fixture", "confidence": 0.95},
            {"field": "submission_deadline", "quote": f"신청 마감: {deadline.isoformat()}", "note": "mock fixture", "confidence": 0.9},
        ],
        "missing_questions": [
            {
                "id": "q-current-state",
                "question": "현재 사업의 디지털 수준(온라인 판매, POS 등)과 주요 불편사항은 무엇인가요?",
                "reason": "현황 분석 섹션 작성에 필요합니다.",
                "required_for": "section-2",
            },
            {
                "id": "q-digital-plan",
                "question": "도입하려는 디지털 시스템 또는 장비는 구체적으로 무엇인가요?",
                "reason": "추진 계획 섹션의 핵심 내용입니다.",
                "required_for": "section-3",
            },
        ],
    }


def _mock_application() -> dict:
    today = date.today()
    deadline = today + timedelta(days=60)

    return {
        "doc_type": "competition",
        "title": "2026년 취업취약계층 고용장려금 신청",
        "organization": "고용노동부 고용서비스정책관",
        "summary": (
            "장기 실업자, 경력 단절 여성, 고령 구직자 등 취업 취약계층을 신규 채용한 사업주에게 "
            "고용장려금을 지원합니다. 고용 후 6개월 이내 신청 가능합니다."
        ),
        "timeline": [
            {"label": "신청 접수 (연중)", "date": today.isoformat(), "is_deadline": False},
            {"label": "신청 마감", "date": deadline.isoformat(), "is_deadline": True},
            {"label": "심사 결과 통보", "date": (today + timedelta(days=30)).isoformat(), "is_deadline": False},
            {"label": "장려금 지급", "date": (today + timedelta(days=45)).isoformat(), "is_deadline": False},
        ],
        "checklist": [
            {
                "label": "고용장려금 신청서",
                "category": "required",
                "description": "고용노동부 공식 양식",
                "file_format": "HWP",
            },
            {
                "label": "사업자등록증",
                "category": "required",
                "description": "신청 사업장 기준",
                "file_format": "PDF",
            },
            {
                "label": "근로계약서 사본",
                "category": "required",
                "description": "신규 채용 근로자 계약서",
                "file_format": "PDF",
            },
            {
                "label": "임금대장 또는 급여 지급 증빙",
                "category": "required",
                "description": "채용 이후 전 기간",
                "file_format": "PDF",
            },
            {
                "label": "취약계층 확인서",
                "category": "required",
                "description": "고용센터 발급 또는 관련 증빙",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "사업주 현황 및 채용 경위",
                "hint": "사업장 현황과 취약계층 채용에 이르게 된 과정을 설명하세요.",
                "order": 1,
            },
            {
                "title": "채용 근로자 정보",
                "hint": "채용한 취약계층 근로자의 유형(장기실업, 경력단절, 고령 등), 직무, 임금을 기술하세요.",
                "order": 2,
            },
            {
                "title": "고용 유지 계획",
                "hint": "해당 근로자를 장기 고용하기 위한 계획과 지원 내용을 서술하세요.",
                "order": 3,
            },
        ],
        "eligibility": [
            "4대 보험 가입 사업장",
            "취업취약계층 신규 채용 사업주 (장기실업자 6개월 이상, 경력단절여성, 만 60세 이상 구직자 등)",
            "최저임금 이상 지급 사업장",
        ],
        "submission_method": "관할 고용센터 방문 또는 고용24(www.work.go.kr) 온라인 신청",
        "evaluation_criteria": [
            "신청 자격 적합 여부",
            "채용 근로자 취약계층 해당 여부",
            "임금 지급 적법성",
        ],
        "benefits": [
            "월 최대 60만원 × 최대 12개월 지원",
            "장기 고용 시 추가 인센티브 적용 가능",
        ],
        "cautions": [
            "채용 후 6개월이 지나면 소급 신청이 불가합니다.",
            "타 고용장려금과 중복 수혜 제한이 있습니다.",
        ],
        "uncertain_fields": [],
        "source_evidence": [
            {"field": "title", "quote": "취업취약계층 고용장려금 신청", "note": "mock fixture", "confidence": 0.95},
            {"field": "submission_deadline", "quote": f"신청 마감: {deadline.isoformat()}", "note": "mock fixture", "confidence": 0.9},
        ],
        "missing_questions": [
            {
                "id": "q-worker-type",
                "question": "채용한 근로자는 어떤 취업취약계층 유형에 해당하나요? (장기실업자, 경력단절, 고령 등)",
                "reason": "채용 근로자 정보 섹션 작성에 필요합니다.",
                "required_for": "section-2",
            },
            {
                "id": "q-employment-plan",
                "question": "해당 근로자의 담당 업무와 장기 고용 계획은 어떻게 되나요?",
                "reason": "고용 유지 계획 섹션 작성에 필요합니다.",
                "required_for": "section-3",
            },
        ],
    }


def _mock_research() -> dict:
    today = date.today()
    deadline = today + timedelta(days=28)

    return {
        "doc_type": "research",
        "title": "2026년 신진연구자 기초연구 과제 신청",
        "organization": "한국연구재단",
        "summary": (
            "박사 취득 후 7년 이내 신진 연구자를 위한 기초연구 지원 과제입니다. "
            "연구자 주도의 창의적 기초 연구를 지원하며, 과제당 연 5천만원 이내 3년간 지원합니다."
        ),
        "timeline": [
            {"label": "공고 게시", "date": today.isoformat(), "is_deadline": False},
            {"label": "신청 마감", "date": deadline.isoformat(), "is_deadline": True},
            {"label": "서면 평가", "date": (today + timedelta(days=45)).isoformat(), "is_deadline": False},
            {"label": "대면 발표 평가", "date": (today + timedelta(days=65)).isoformat(), "is_deadline": False},
            {"label": "최종 선정 통보", "date": (today + timedelta(days=80)).isoformat(), "is_deadline": False},
        ],
        "checklist": [
            {
                "label": "연구제안서",
                "category": "required",
                "description": "A4 20매 이내, 연구 배경·목표·방법·일정·예산 포함",
                "file_format": "PDF",
            },
            {
                "label": "연구책임자 이력서 (CV)",
                "category": "required",
                "description": "최근 5년 연구실적 강조",
                "file_format": "PDF",
            },
            {
                "label": "연구비 명세서",
                "category": "required",
                "description": "연도별·항목별 예산 계획",
                "file_format": "HWP, XLSX",
            },
            {
                "label": "인간 대상 연구 확인서",
                "category": "optional",
                "description": "해당 연구 시 IRB 승인서 첨부",
                "file_format": "PDF",
            },
        ],
        "document_sections": [
            {
                "title": "연구 배경 및 필요성",
                "hint": "선행 연구 동향, 현재 연구 공백, 본 연구의 사회·학문적 필요성을 논거와 함께 서술하세요.",
                "order": 1,
            },
            {
                "title": "연구 목표 및 내용",
                "hint": "최종 목표, 단계별 연구 목표, 핵심 연구 내용과 가설을 명확하게 기술하세요.",
                "order": 2,
            },
            {
                "title": "연구 방법론",
                "hint": "데이터 수집 방법, 실험 설계, 분석 기법, 타당성 검증 방법을 구체적으로 설명하세요.",
                "order": 3,
            },
            {
                "title": "기대 효과 및 활용 방안",
                "hint": "학문적 기여, 사회·경제적 파급 효과, 후속 연구로의 연계 가능성을 서술하세요.",
                "order": 4,
            },
            {
                "title": "연구팀 구성 및 역량",
                "hint": "연구책임자 및 참여연구원의 전문성, 관련 연구 실적, 분담 역할을 기술하세요.",
                "order": 5,
            },
        ],
        "eligibility": [
            "박사학위 취득 후 7년 이내 연구자",
            "국내 연구기관 또는 대학 소속 전임교원·연구원",
            "동일 사업 동시 2건 이상 수행 불가",
        ],
        "submission_method": "한국연구재단 e-R&D 시스템(ernd.nrf.re.kr) 온라인 접수",
        "evaluation_criteria": [
            "연구의 창의성과 도전성 (30점)",
            "연구 목표 및 방법론의 타당성 (30점)",
            "연구자 역량 및 수행 가능성 (25점)",
            "기대 효과 및 파급력 (15점)",
        ],
        "benefits": [
            "연 최대 5,000만원 × 3년 지원",
            "간접비 별도 지원",
            "국제 학술 교류 활동비 포함",
        ],
        "cautions": [
            "연구비 집행 계획은 항목별 기준을 엄격히 준수해야 합니다.",
            "연구 착수 보고서를 협약 후 60일 이내 제출해야 합니다.",
        ],
        "uncertain_fields": [],
        "source_evidence": [
            {"field": "title", "quote": "2026년 신진연구자 기초연구 과제 신청", "note": "mock fixture", "confidence": 0.95},
            {"field": "submission_deadline", "quote": f"신청 마감: {deadline.isoformat()}", "note": "mock fixture", "confidence": 0.9},
        ],
        "missing_questions": [
            {
                "id": "q-research-hypothesis",
                "question": "핵심 연구 가설과 검증하려는 주요 명제는 무엇인가요?",
                "reason": "연구 목표 및 내용 섹션에 필수 정보입니다.",
                "required_for": "section-2",
            },
            {
                "id": "q-methodology",
                "question": "주된 연구 방법(실험, 서베이, 문헌 분석, 시뮬레이션 등)과 데이터 확보 방법은 무엇인가요?",
                "reason": "연구 방법론 섹션 작성에 필요합니다.",
                "required_for": "section-3",
            },
        ],
    }
