function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxChars = 78): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildLessonPdfBuffer(params: {
  academyName: string;
  courseTitle: string;
  instructorName: string;
  lessonTitle: string;
  pdfTitle: string;
  summary: string;
  description: string;
  exercise: string;
}): Buffer {
  const lines: Array<{ text: string; size: number; bold?: boolean; gap?: number }> = [
    { text: params.academyName.toUpperCase(), size: 11, bold: true, gap: 18 },
    { text: 'OFFICIAL COURSE STUDY GUIDE', size: 16, bold: true, gap: 26 },
    { text: `Course: ${params.courseTitle}`, size: 12, bold: true, gap: 18 },
    { text: `Instructor: ${params.instructorName}`, size: 10, gap: 16 },
    { text: `Lesson: ${params.lessonTitle}`, size: 12, bold: true, gap: 22 },
    { text: '1. Lesson Overview', size: 12, bold: true, gap: 16 },
    ...wrapLines(params.description).map((l) => ({ text: l, size: 10, gap: 14 })),
    { text: '', size: 10, gap: 10 },
    { text: '2. Study Notes Summary', size: 12, bold: true, gap: 16 },
    ...wrapLines(params.summary).map((l) => ({ text: l, size: 10, gap: 14 })),
    { text: '', size: 10, gap: 10 },
    { text: '3. Practical Exercise', size: 12, bold: true, gap: 16 },
    ...wrapLines(params.exercise).map((l) => ({ text: l, size: 10, gap: 14 })),
    { text: '', size: 10, gap: 18 },
    { text: 'EK TECH SOLUTIONS Online Academy | WhatsApp Support: 0551464715', size: 9, gap: 14 },
  ];

  let y = 760;
  const contentOps: string[] = ['BT'];
  for (const line of lines) {
    if (y < 60) break;
    const fontRef = line.bold ? '/F2' : '/F1';
    contentOps.push(`${fontRef} ${line.size} Tf`);
    contentOps.push(`1 0 0 1 54 ${y} Tm`);
    contentOps.push(`(${escapePdfText(line.text)}) Tj`);
    y -= line.gap ?? 14;
  }
  contentOps.push('ET');
  const streamContent = contentOps.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
