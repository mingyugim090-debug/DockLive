import { NextRequest, NextResponse } from 'next/server';
import { sampleTemplates } from '@/data/sampleTemplates';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { templateId?: string };
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'missing_template_id' }, { status: 400 });
    }

    const template = sampleTemplates.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
    }

    // --- HWPX → PDF conversion hook ---
    // To connect a real converter, implement one of the following:
    //
    // Option 1 — LibreOffice (self-hosted):
    //   const hwpxFilePath = path.join(process.cwd(), 'public', template.hwpxPath);
    //   await execAsync(`libreoffice --headless --convert-to pdf --outdir /tmp "${hwpxFilePath}"`);
    //   const pdfKey = `previews/${templateId}.pdf`;
    //   fs.copyFileSync(`/tmp/${templateId}.pdf`, path.join(process.cwd(), 'public/samples', pdfKey));
    //   return NextResponse.json({ previewUrl: `/samples/${pdfKey}`, status: 'ready' });
    //
    // Option 2 — 한컴 변환 서버:
    //   const hancomRes = await fetch(process.env.HANCOM_CONVERT_URL, {
    //     method: 'POST', body: formData  // multipart with the hwpx file
    //   });
    //   // Save the returned PDF to public/samples/previews/ and return its path.
    //
    // Option 3 — HWPX XML parser + Puppeteer:
    //   Parse the HWPX zip (it is a ZIP of XML files), extract text/tables,
    //   render via a headless browser to PDF.
    // ---

    if (template.previewPdfPath) {
      return NextResponse.json({ previewUrl: template.previewPdfPath, status: 'ready' });
    }

    return NextResponse.json({ previewUrl: null, status: 'no_preview' });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
