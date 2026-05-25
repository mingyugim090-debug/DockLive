import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "backend" / "hwpx_toolchain" / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    from clone_form import clone, extract_texts  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name != "lxml":
        raise
    clone = None
    extract_texts = None


SECTION_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p id="1" paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="11"><hp:t>Problem(풀고자 하는 문제)</hp:t></hp:run>
  </hp:p>
  <hp:p id="2" paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="22"><hp:t>기존 문제 설명</hp:t></hp:run>
  </hp:p>
  <hp:p id="3" paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="11"><hp:t>Solution(나의 솔루션)</hp:t></hp:run>
  </hp:p>
  <hp:p id="4" paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="22"><hp:t>기존 솔루션 설명</hp:t></hp:run>
  </hp:p>
  <hp:p id="5" paraPrIDRef="0" styleIDRef="0">
    <hp:tbl id="10">
      <hp:tr>
        <hp:tc>
          <hp:subList>
            <hp:p id="6" paraPrIDRef="0" styleIDRef="0">
              <hp:run charPrIDRef="33"><hp:t>AI 활용 역량</hp:t></hp:run>
            </hp:p>
          </hp:subList>
        </hp:tc>
        <hp:tc>
          <hp:subList>
            <hp:p id="7" paraPrIDRef="0" styleIDRef="0">
              <hp:run charPrIDRef="44"><hp:t>작성 필요</hp:t></hp:run>
            </hp:p>
          </hp:subList>
        </hp:tc>
      </hp:tr>
    </hp:tbl>
  </hp:p>
</hs:sec>
"""


def write_minimal_hwpx(path: Path) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("mimetype", "application/hwp+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr("Contents/content.hpf", "<?xml version='1.0'?><package/>")
        zf.writestr("Contents/header.xml", "<?xml version='1.0'?><header/>")
        zf.writestr("Contents/section0.xml", SECTION_XML)


class HwpxCloneFormTests(unittest.TestCase):
    def test_heading_fill_preserves_table_and_run_structure(self):
        if clone is None or extract_texts is None:
            self.skipTest("lxml is not installed")

        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.hwpx"
            result = Path(tmp) / "result.hwpx"
            write_minimal_hwpx(source)

            report = clone(
                str(source),
                str(result),
                fill_sections={
                    "Problem": "문제 설명\n줄바꿈은 XML 오염 없이 정리됩니다.",
                    "Solution": "솔루션 설명",
                    "AI 활용 역량": "AI 활용 역량 설명",
                },
                strict_fill=True,
            )

            self.assertEqual(report["missing"], [])
            self.assertEqual(set(report["matched"]), {"Problem", "Solution", "AI 활용 역량"})

            with zipfile.ZipFile(source) as zf:
                source_section = zf.read("Contents/section0.xml").decode("utf-8")
            with zipfile.ZipFile(result) as zf:
                result_section = zf.read("Contents/section0.xml").decode("utf-8")
                self.assertEqual(zf.namelist()[0], "mimetype")

            self.assertEqual(source_section.count("<hp:tbl"), result_section.count("<hp:tbl"))
            self.assertIn('charPrIDRef="22"', result_section)
            self.assertIn("문제 설명 줄바꿈은 XML 오염 없이 정리됩니다.", result_section)
            self.assertNotIn("문제 설명\n줄바꿈", result_section)

            texts = "\n".join(extract_texts(str(result)))
            self.assertIn("솔루션 설명", texts)
            self.assertIn("AI 활용 역량 설명", texts)


if __name__ == "__main__":
    unittest.main()
