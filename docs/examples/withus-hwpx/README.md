# withUS HWPX Example

이 폴더는 사용자가 제공한 HWPX 신청서 양식을 복제하고, 필요한 텍스트만 치환해 새 HWPX 결과물을 만드는 예시를 보관합니다.

## 파일

- `withus-sample-map.json`: 템플릿 치환 mapping 예시
- `withus-sample-filled.hwpx`: 치환 후 생성된 HWPX 예시 결과물

원본 신청서 파일은 개인 다운로드 폴더에서 제공된 샘플이므로 repository에는 포함하지 않습니다.

## 처리 흐름

```mermaid
flowchart LR
  A["원본 HWPX 양식"] --> B["양식 구조 분석"]
  B --> C["치환 mapping JSON 작성"]
  C --> D["템플릿 복제와 텍스트 치환"]
  D --> E["namespace fix"]
  E --> F["validate"]
  F --> G["구조 보존 검증"]
  G --> H["완성 HWPX"]
```

## LiveDock 적용 방식

서비스에서는 사용자가 업로드한 HWPX 공식 양식을 다음 순서로 처리합니다.

1. 공고 PDF, URL, 텍스트 또는 fixture를 분석합니다.
2. 신청자명, 팀 정보, 지원 동기, 활동 목표, 운영 방법, 예산 계획처럼 문서 작성에 필요한 정보를 식별합니다.
3. 누락된 정보만 사용자에게 질문합니다.
4. 공고 조건과 사용자 정보를 기반으로 section-level draft를 생성합니다.
5. 사용자가 중요한 주장과 개인정보를 확인하면 치환 JSON을 만듭니다.
6. HWPX 원본 양식을 복제하고 텍스트만 치환합니다.
7. namespace fix, validation, 구조 보존 검증을 통과한 HWPX만 다운로드 대상으로 제공합니다.

## 관련 API

현재 백엔드는 다음 endpoint로 HWPX 템플릿 클로닝을 지원합니다.

```text
POST /api/workflow/{workflow_id}/export/hwpx/template
```

multipart form fields:

- `template`: 업로드할 `.hwpx` 공식 양식
- `replacements_json`: 정확한 source text 또는 XML fragment 치환 map
- `keywords_json`: `<hp:t>` 내부 keyword fallback 치환 map

기본 placeholder 예시:

- `{{title}}`
- `{{content}}`
- `{{applicant_name}}`
- `{{applicant_profile}}`
- `{{project_summary}}`
- `{{evidence}}`
- `{{organization}}`
- `{{announcement_title}}`
- `{{section:section-1}}`
