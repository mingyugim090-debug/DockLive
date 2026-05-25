// Codex가 테스트를 이 디렉토리에 작성합니다.
// Claude Code는 이 파일을 포함한 *.test.ts 파일을 절대 수정하지 않습니다.
// 테스트가 실패하면 프로덕션 코드를 수정합니다 (자가치유 루프 max 5회).

describe('환경 검증', () => {
  it('vitest + jsdom 환경이 정상 작동한다', () => {
    expect(true).toBe(true);
  });

  it('document 객체가 존재한다 (jsdom)', () => {
    expect(document).toBeDefined();
    expect(document.body).toBeDefined();
  });
});
