import type {
  HwpxBlock,
  HwpxCheckboxGroupBlock,
  HwpxDocumentModel,
  HwpxHeadingBlock,
  HwpxParagraphBlock,
  HwpxSignatureBlock,
  HwpxSpacerBlock,
  HwpxTableBlock,
} from '@/lib/types';

const createdAt = '2026-05-21T00:00:00.000Z';

type CellInput = string | { text: string; colSpan?: number; rowSpan?: number; background?: string; align?: 'left' | 'center' | 'right'; editable?: boolean };

function p(id: string, text: string, style: HwpxParagraphBlock['style'] = {}, editable = true): HwpxParagraphBlock {
  return { id, type: 'paragraph', text, style: { lineHeight: 1.75, marginBottom: 8, ...style }, editable };
}

function h(id: string, text: string, level: 1 | 2 | 3 = 2, style: HwpxHeadingBlock['style'] = {}, editable = true): HwpxHeadingBlock {
  const fontSize = level === 1 ? 24 : level === 2 ? 16 : 13;
  return { id, type: 'heading', text, level, style: { bold: true, fontSize, ...style }, editable };
}

function spacer(id: string, height = 14): HwpxSpacerBlock {
  return { id, type: 'spacer', height };
}

function table(id: string, rows: CellInput[][]): HwpxTableBlock {
  return {
    id,
    type: 'table',
    style: { borderCollapse: true, width: '100%' },
    rows: rows.map((row, rowIndex) => ({
      cells: row.map((value, cellIndex) => {
        const cell = typeof value === 'string' ? { text: value } : value;
        return {
          id: `${id}-r${rowIndex}-c${cellIndex}`,
          text: cell.text,
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
          align: cell.align ?? (rowIndex === 0 ? 'center' : 'left'),
          verticalAlign: 'middle',
          background: cell.background ?? (rowIndex === 0 || cellIndex === 0 ? '#eef3f0' : undefined),
          editable: cell.editable ?? rowIndex !== 0,
        };
      }),
    })),
  };
}

function checks(id: string, label: string, options: Array<[string, boolean]>): HwpxCheckboxGroupBlock {
  return {
    id,
    type: 'checkboxGroup',
    label,
    options: options.map(([optionLabel, checked], index) => ({ id: `${id}-o${index}`, label: optionLabel, checked })),
    editable: true,
  };
}

function sign(id: string, organizationText: string): HwpxSignatureBlock {
  return {
    id,
    type: 'signature',
    dateText: '2026. 5. 21.',
    signerLabel: '신청인 또는 대표자: __________________ (서명 또는 인)',
    organizationText,
    editable: true,
  };
}

function model(templateId: string, title: string, sourceFileName: string, blocks: HwpxBlock[]): HwpxDocumentModel {
  return {
    id: `${templateId}-sample-model`,
    title,
    sourceFileName,
    pages: [{ id: `${templateId}-page-1`, blocks }],
    metadata: {
      templateId,
      documentType: title,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

export const hwpxTemplateModels: Record<string, HwpxDocumentModel> = {
  startup_camp_notice: model('startup_camp_notice', '2026년 청년 창업캠프 참가자 모집 공고', '2026_청년_창업캠프_참가자_모집_공고.hwpx', [
    p('startup-no', '창업지원단 공고 제2026-01호', { align: 'center', fontSize: 11 }, false),
    h('startup-title', '2026년 청년 창업캠프 참가자 모집 공고', 1, { align: 'center' }),
    p('startup-org', 'OO대학교 창업지원단', { align: 'center', bold: true, fontSize: 13 }, true),
    spacer('startup-space-1', 18),
    h('startup-intro-h', '공고 안내문', 2),
    p('startup-intro', '예비창업자와 초기 창업팀의 사업화 역량 강화 및 창업 아이디어 고도화를 위하여 다음과 같이 창업캠프 참가자를 모집합니다.'),
    table('startup-application', [
      ['참가 신청서', { text: '', colSpan: 3, background: '#ffffff', editable: false }],
      ['신청자/기업명', '입력 필요', '대표자', '입력 필요'],
      ['소속/학과', '입력 필요', '연락처', '입력 필요'],
      ['창업 아이템명', '입력 필요', '참가 구분', '개인 / 팀'],
    ]),
    table('startup-plan', [
      ['신청 내용 및 추진 계획', { text: '', colSpan: 2, editable: false }],
      ['창업 아이디어 요약', '해결하려는 문제, 고객, 핵심 기능을 5문장 이내로 작성합니다.', ''],
      ['추진 계획', '시장 검증, 고객 인터뷰, MVP 제작 및 발표 준비 일정을 작성합니다.', ''],
      ['팀 역량', '팀 구성원의 역할, 보유 경험, 외부 협력 계획을 작성합니다.', ''],
    ]),
    h('startup-eval-h', '평가 기준', 2),
    table('startup-eval', [
      ['평가 항목', '비중', '세부 기준'],
      ['참여 의지', '30%', '교육 전 일정 참여 가능 여부와 제출 서류 충실도'],
      ['아이디어 구체성', '30%', '문제 정의, 고객 검증, 시장성'],
      ['팀 실행력', '25%', '역할 분담, 준비 수준, 후속 실행 가능성'],
      ['서류 완성도', '15%', '필수 항목 누락 여부'],
    ]),
    h('startup-overview-h', '1. 사업 개요', 2),
    p('startup-overview', '가. 창업 아이디어 검증, 시장 분석, 사업계획서 작성 실습을 중심으로 캠프를 운영합니다.'),
    h('startup-eligibility-h', '2. 신청 자격', 2),
    p('startup-eligibility', '가. 창업 아이디어를 보유하거나 창업 교육 참여 의지가 있는 개인 또는 팀을 대상으로 합니다.'),
    h('startup-selection-h', '3. 선정 방법', 2),
    p('startup-selection', '가. 신청서 충실도, 아이디어 구체성, 참여 의지를 종합 검토하여 선정합니다.'),
    h('startup-method-h', '4. 신청 방법', 2),
    p('startup-method', '가. 붙임 참가 신청서와 개인정보 수집 및 이용 동의서를 작성하여 담당 부서 이메일로 제출합니다.'),
    h('startup-attach-h', '붙임 문서 목록', 2),
    p('startup-attach', '1. 참가 신청서 1부\n2. 창업 아이디어 요약서 1부\n3. 개인정보 수집 및 이용 동의서 1부'),
    checks('startup-privacy', '개인정보 수집·이용 동의서', [
      ['성명, 연락처, 소속 정보를 참가자 선정 및 안내 목적으로 수집하는 데 동의합니다.', false],
      ['창업캠프 운영 결과보고 및 만족도 조사에 필요한 범위 내 이용에 동의합니다.', false],
    ]),
    sign('startup-sign', 'OO대학교 창업지원단'),
  ]),

  business_support_notice: model('business_support_notice', '2026년 지역기업 성장 지원사업 참여기업 모집 공고', '2026_지역기업_성장지원사업_참여기업_모집공고.hwpx', [
    p('support-no', 'OO산업진흥원 공고 제2026-02호', { align: 'center', fontSize: 11 }, false),
    h('support-title', '2026년 지역기업 성장 지원사업 참여기업 모집 공고', 1, { align: 'center' }),
    p('support-intro', '지역 중소기업의 판로 확대와 경쟁력 강화를 위하여 참여기업을 다음과 같이 모집합니다.'),
    table('support-overview', [
      ['사업 개요', '내용'],
      ['사업명', '지역기업 성장 지원사업'],
      ['지원 규모', '총 20개사 내외'],
      ['신청 기간', '2026. 6. 1.(월) ~ 2026. 6. 21.(일) 18:00'],
      ['선정 결과 안내', '심사 종료 후 기관 누리집 공고 및 개별 통보'],
    ]),
    table('support-company', [
      ['기업 정보 입력 표', { text: '', colSpan: 3, editable: false }],
      ['기업명', '입력 필요', '사업자등록번호', '입력 필요'],
      ['대표자', '입력 필요', '업종', '입력 필요'],
      ['소재지', '입력 필요', '담당자 연락처', '입력 필요'],
    ]),
    h('support-target-h', '1. 지원 대상', 2),
    p('support-target', '가. 공고일 기준 사업자등록을 완료하고 지원 분야와 관련된 제품 또는 서비스를 보유한 기업을 대상으로 합니다.'),
    h('support-content-h', '2. 지원 내용', 2),
    table('support-content', [
      ['지원 분야', '세부 내용', '비고'],
      ['홍보·마케팅', '홍보물 제작, 온라인 광고, 상세페이지 개선', '기업 진단 후 조정'],
      ['판로 개척', '전시회 참가, 바이어 상담, 국내외 유통 연계', '일부 자부담 가능'],
      ['인증·지식재산', '인증 취득, 특허·상표 출원 컨설팅', '증빙 필요'],
    ]),
    h('support-docs-h', '3. 제출 서류', 2),
    p('support-docs', '가. 참여 신청서, 사업계획서, 기업정보 제공 및 활용 동의서, 사업자등록증을 제출합니다.'),
    h('support-eval-h', '4. 평가 절차', 2),
    p('support-eval', '가. 요건 검토, 서면 평가, 필요 시 발표 평가 순으로 진행하며 최종 선정 결과는 개별 안내합니다.'),
    h('support-contact-h', '5. 문의처', 2),
    table('support-contact', [['부서', '연락처', '이메일'], ['기업지원팀', '02-000-0000', 'support@example.go.kr']]),
    sign('support-sign', 'OO산업진흥원장'),
  ]),

  education_program_notice: model('education_program_notice', '2026년 디지털 역량 교육 프로그램 수강생 모집 공고', '2026_디지털역량교육_수강생_모집공고.hwpx', [
    h('edu-title', '2026년 디지털 역량 교육 프로그램 수강생 모집 공고', 1, { align: 'center' }),
    p('edu-purpose', '실무 중심 교육을 통해 지역 인재의 디지털 활용 역량을 강화하고자 다음과 같이 수강생을 모집합니다.'),
    table('edu-info', [
      ['교육명', '디지털 실무 역량 향상 과정'],
      ['교육 목적', '기초 이론과 프로젝트 실습을 통한 실무 역량 강화'],
      ['교육 장소', 'OO교육센터 3층 실습실'],
      ['모집 대상', '교육 주제에 관심 있는 청년, 재직자, 예비창업자'],
      ['모집 인원', '과정별 25명 내외'],
    ]),
    h('edu-schedule-h', '1. 교육 일정', 2),
    table('edu-curriculum', [
      ['회차', '교육 내용', '일시', '운영 방식'],
      ['1회차', '오리엔테이션 및 기초 도구 사용', '2026. 7. 1.(수)', '대면'],
      ['2회차', '데이터 정리와 문서 자동화 실습', '2026. 7. 3.(금)', '실습'],
      ['3회차', '팀 프로젝트 설계 및 피드백', '2026. 7. 8.(수)', '워크숍'],
      ['4회차', '결과 발표 및 수료 평가', '2026. 7. 10.(금)', '발표'],
    ]),
    h('edu-apply-h', '2. 수강 신청 방법', 2),
    p('edu-apply', '가. 온라인 신청서 작성 후 개인정보 수집 및 이용 동의서를 제출합니다.\n나. 신청 인원이 모집 정원을 초과할 경우 교육 목적 적합성 및 신청 순서를 고려합니다.'),
    h('edu-complete-h', '3. 출석 및 수료 기준', 2),
    table('edu-complete', [['구분', '기준'], ['출석', '총 교육시간의 80% 이상 출석'], ['과제', '과정별 실습 과제 제출'], ['수료', '출석과 과제 기준을 모두 충족']]),
    h('edu-contact-h', '4. 문의처', 2),
    table('edu-contact', [['담당 부서', '전화', '이메일'], ['교육운영팀', '02-111-0000', 'edu@example.go.kr']]),
    sign('edu-sign', 'OO교육센터장'),
  ]),

  event_participant_notice: model('event_participant_notice', '2026년 지역 혁신 포럼 참가자 모집 공고', '2026_지역혁신포럼_참가자_모집공고.hwpx', [
    h('event-title', '2026년 지역 혁신 포럼 참가자 모집 공고', 1, { align: 'center' }),
    table('event-summary', [
      ['행사 개요', '내용'],
      ['행사 일시', '2026. 8. 20.(목) 13:00 ~ 17:00'],
      ['행사 장소', 'OO컨벤션센터 중회의실'],
      ['참가 대상', '지역 문제 해결과 공공 혁신에 관심 있는 시민 및 기관 관계자'],
      ['참가비 여부', '무료'],
    ]),
    h('event-apply-h', '1. 신청 기간', 2),
    p('event-apply', '가. 2026. 7. 20.(월)부터 2026. 8. 10.(월) 18:00까지 온라인으로 접수합니다.'),
    h('event-program-h', '2. 프로그램 일정표', 2),
    table('event-program', [
      ['시간', '프로그램', '주요 내용'],
      ['13:00~13:20', '등록', '참가 확인 및 자료집 배부'],
      ['13:20~14:10', '기조 강연', '지역 혁신 정책 방향'],
      ['14:20~15:40', '사례 발표', '기관별 우수 사례 공유'],
      ['15:50~16:50', '토론', '참가자 질의응답 및 네트워킹'],
    ]),
    h('event-note-h', '3. 유의사항', 2),
    p('event-note', '가. 좌석 수에 따라 조기 마감될 수 있으며, 참석 확정자는 개별 안내합니다.\n나. 행사 일정과 장소는 운영 사정에 따라 변경될 수 있습니다.'),
    h('event-contact-h', '4. 문의처', 2),
    table('event-contact', [['담당', '연락처'], ['행사운영사무국', '02-222-0000']]),
    sign('event-sign', 'OO문화재단'),
  ]),

  scholarship_notice: model('scholarship_notice', '2026년 미래인재 장학생 모집 공고', '2026_미래인재_장학생_모집공고.hwpx', [
    h('scholar-title', '2026년 미래인재 장학생 모집 공고', 1, { align: 'center' }),
    p('scholar-intro', '학업 의지가 우수한 학생의 안정적인 학업 지속을 지원하기 위하여 장학생을 다음과 같이 선발합니다.'),
    table('scholar-summary', [
      ['장학명', '미래인재 장학금'],
      ['선발 대상', '공고 기준을 충족하는 재학생'],
      ['선발 인원', 'OO명 내외'],
      ['지원 금액', '1인당 등록금 또는 학업장려금 일부'],
      ['지급 일정', '최종 선발 후 2026년 2학기 중 지급'],
    ]),
    h('scholar-eligibility-h', '1. 신청 자격', 2),
    p('scholar-eligibility', '가. 성적, 소득, 활동 실적 등 장학 유형별 기준을 충족해야 하며 중복 수혜 제한 사항을 확인해야 합니다.'),
    h('scholar-docs-h', '2. 제출 서류', 2),
    table('scholar-docs', [['구분', '필수 서류', '비고'], ['공통', '장학금 신청서, 재학증명서', '서명 필수'], ['성적', '성적증명서', '최근 학기 기준'], ['소득', '가족관계증명서, 소득 관련 증빙', '해당자']]),
    h('scholar-eval-h', '3. 심사 기준', 2),
    table('scholar-eval', [['항목', '비중'], ['학업 성취도', '35%'], ['성장 가능성', '25%'], ['경제 여건', '25%'], ['서류 충실도', '15%']]),
    h('scholar-note-h', '4. 유의사항', 2),
    p('scholar-note', '가. 제출 서류의 허위 기재 또는 누락이 확인될 경우 선발이 취소될 수 있습니다.'),
    checks('scholar-privacy', '개인정보 동의 항목', [
      ['장학생 선발 심사를 위한 개인정보 수집 및 이용에 동의합니다.', false],
      ['장학금 지급 및 사후 관리를 위한 학적 정보 확인에 동의합니다.', false],
    ]),
    sign('scholar-sign', 'OO장학재단 이사장'),
  ]),

  bid_rfp_notice: model('bid_rfp_notice', '2026년 통합 업무관리 시스템 구축 용역 입찰 공고', '2026_통합업무관리시스템_구축용역_입찰공고.hwpx', [
    p('bid-no', '입찰공고 제2026-08호', { align: 'center', fontSize: 11 }, false),
    h('bid-title', '2026년 통합 업무관리 시스템 구축 용역 입찰 공고', 1, { align: 'center' }),
    table('bid-overview', [
      ['입찰 개요', '내용'],
      ['과업명', '통합 업무관리 시스템 구축 및 운영 용역'],
      ['계약 기간', '계약일로부터 8개월'],
      ['예산 금액', '금 000,000,000원(부가가치세 포함)'],
      ['계약 방법', '제한경쟁입찰 및 협상에 의한 계약'],
    ]),
    h('bid-scope-h', '1. 과업 범위', 2),
    p('bid-scope', '가. 요구사항 분석, 시스템 설계, 개발, 데이터 이관, 시험 운영, 사용자 교육 및 하자보수 계획을 포함합니다.'),
    h('bid-qualification-h', '2. 참가 자격', 2),
    p('bid-qualification', '가. 관련 법령에 따라 입찰 참가 자격을 갖추고 공고에서 정한 실적 및 기술 인력 요건을 충족해야 합니다.'),
    h('bid-submit-h', '3. 제안서 제출 방법', 2),
    table('bid-submit', [['제출 항목', '부수 및 형식', '확인 사항'], ['기술제안서', '원본 1부 및 사본 지정 부수', '목차 준수'], ['가격제안서', '별도 밀봉 또는 전자 제출', '산출 내역 포함'], ['증빙서류', '참가 자격 확인 서류', '기한 내 제출']]),
    h('bid-eval-h', '4. 평가 기준표', 2),
    table('bid-eval', [['평가 구분', '배점', '세부 항목'], ['기술 능력 평가', '80점', '수행 계획, 인력 구성, 보안 및 품질 관리'], ['가격 평가', '20점', '입찰 가격 평점'], ['협상', '적격자 대상', '기술·가격 종합 점수 순']]),
    h('bid-contract-h', '5. 계약 조건', 2),
    p('bid-contract', '가. 계약 체결, 보안 서약, 결과물 제출, 검수 및 대금 지급 조건은 제안요청서와 관계 법령을 따릅니다.'),
    h('bid-contact-h', '6. 문의처', 2),
    table('bid-contact', [['구분', '담당 부서', '연락처'], ['사업 문의', '정보화기획팀', '02-333-0000'], ['계약 문의', '계약관리팀', '02-333-0001']]),
    sign('bid-sign', 'OO공공기관장'),
  ]),
};

export function cloneHwpxDocumentModel(model: HwpxDocumentModel): HwpxDocumentModel {
  return JSON.parse(JSON.stringify(model)) as HwpxDocumentModel;
}

export function getHwpxTemplateModel(templateId: string): HwpxDocumentModel {
  return cloneHwpxDocumentModel(hwpxTemplateModels[templateId] ?? hwpxTemplateModels.startup_camp_notice);
}

