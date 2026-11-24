import PDFDocument from 'pdfkit';

export interface PdfReportData {
  testCode: string;
  sampleCode: string;
  testName: string;
  category: string;
  status: string;
  priority: string;
  sampleType: string;
  referringPhysician: string | null;
  clinicalNotes: string | null;
  pathologistName: string;
  orderedAt: Date;
  collectedAt: Date | null;
  completedAt: Date | null;
  patient: {
    patientCode: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    email: string | null;
    bloodGroup: string | null;
  };
  results: Array<{
    parameterName: string;
    measuredValue: string;
    unit: string;
    referenceRange: string;
    flag: string;
  }>;
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return 'Pending';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFlagLabel(flag: string): string {
  switch (flag) {
    case 'high':
      return 'HIGH';
    case 'low':
      return 'LOW';
    case 'critical':
      return 'CRITICAL';
    default:
      return 'NORMAL';
  }
}

export function generateDiagnosticReportPdf(data: PdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: `Meridian Diagnostics Report — ${data.testCode}`,
        Author: 'Meridian Clinical Diagnostics',
        Subject: data.testName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 96;

    // Header band
    doc
      .fillColor('#0F766E')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('MERIDIAN DIAGNOSTICS', 48, 44);

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(9)
      .text('Accredited Clinical Pathology & Reference Laboratory', 48, 66)
      .text('400 Clinical Parkway, Suite 200  ·  CLIA ID: 05D2198441  ·  CAP Accredited', 48, 79);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('LABORATORY REPORT', 360, 46, { width: pageWidth - 312, align: 'right' });

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(9)
      .text(`Report ID: ${data.testCode}`, 360, 62, { width: pageWidth - 312, align: 'right' })
      .text(`Sample ID: ${data.sampleCode}`, 360, 75, { width: pageWidth - 312, align: 'right' });

    doc
      .moveTo(48, 98)
      .lineTo(48 + pageWidth, 98)
      .strokeColor('#CBD5E1')
      .lineWidth(1)
      .stroke();

    // Patient & Specimen Grid
    const infoTop = 112;
    doc
      .rect(48, infoTop, pageWidth, 92)
      .fillColor('#F8FAFC')
      .fill()
      .strokeColor('#E2E8F0')
      .lineWidth(0.75)
      .stroke();

    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8);
    doc.text('PATIENT INFORMATION', 60, infoTop + 10);
    doc.text('SPECIMEN & ORDER DETAILS', 310, infoTop + 10);

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10);
    doc.text(data.patient.fullName, 60, infoTop + 24);
    doc.text(data.testName, 310, infoTop + 24, { width: 225 });

    doc.fillColor('#334155').font('Helvetica').fontSize(8.5);
    doc.text(`Patient ID: ${data.patient.patientCode}`, 60, infoTop + 40);
    doc.text(`DOB / Gender: ${data.patient.dateOfBirth}  ·  ${data.patient.gender}`, 60, infoTop + 53);
    doc.text(`Contact: ${data.patient.phone}${data.patient.bloodGroup ? `  ·  Blood: ${data.patient.bloodGroup}` : ''}`, 60, infoTop + 66);

    doc.text(`Category: ${data.category}  ·  Sample: ${data.sampleType}`, 310, infoTop + 40, { width: 225 });
    doc.text(`Referring Physician: ${data.referringPhysician || 'Self / Clinic Referral'}`, 310, infoTop + 53, { width: 225 });
    doc.text(`Collected: ${formatDateTime(data.collectedAt)}  ·  Reported: ${formatDateTime(data.completedAt)}`, 310, infoTop + 66, { width: 225 });

    // Test Results Table
    let y = infoTop + 114;
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Diagnostic Assay Results', 48, y);

    y += 20;

    // Table header
    doc
      .rect(48, y, pageWidth, 24)
      .fillColor('#0F172A')
      .fill();

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    doc.text('PARAMETER / ANALYTE', 58, y + 8, { width: 175 });
    doc.text('RESULT', 238, y + 8, { width: 70, align: 'right' });
    doc.text('UNITS', 316, y + 8, { width: 65 });
    doc.text('REFERENCE INTERVAL', 385, y + 8, { width: 100 });
    doc.text('FLAG', 488, y + 8, { width: 52, align: 'right' });

    y += 24;

    if (data.results.length === 0) {
      doc
        .rect(48, y, pageWidth, 34)
        .fillColor('#FFFFFF')
        .fill()
        .strokeColor('#E2E8F0')
        .stroke();
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9)
        .text('No structured analytical parameters recorded for this report.', 58, y + 12);
      y += 34;
    } else {
      data.results.forEach((row, index) => {
        if (y > 700) {
          doc.addPage();
          y = 56;
        }

        const isAlt = index % 2 === 1;
        doc
          .rect(48, y, pageWidth, 24)
          .fillColor(isAlt ? '#F8FAFC' : '#FFFFFF')
          .fill();

        const isAbnormal = row.flag !== 'normal';
        doc
          .fillColor('#0F172A')
          .font('Helvetica')
          .fontSize(9)
          .text(row.parameterName, 58, y + 7, { width: 175 });

        doc
          .fillColor(isAbnormal ? '#B91C1C' : '#0F172A')
          .font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica')
          .text(row.measuredValue, 238, y + 7, { width: 70, align: 'right' });

        doc
          .fillColor('#475569')
          .font('Helvetica')
          .text(row.unit, 316, y + 7, { width: 65 });

        doc
          .fillColor('#475569')
          .text(row.referenceRange, 385, y + 7, { width: 100 });

        doc
          .fillColor(
            row.flag === 'critical'
              ? '#991B1B'
              : row.flag === 'high' || row.flag === 'low'
                ? '#B45309'
                : '#15803D'
          )
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(formatFlagLabel(row.flag), 488, y + 8, { width: 52, align: 'right' });

        doc
          .moveTo(48, y + 24)
          .lineTo(48 + pageWidth, y + 24)
          .strokeColor('#E2E8F0')
          .lineWidth(0.5)
          .stroke();

        y += 24;
      });
    }

    // Clinical Interpretation Notes
    y += 18;
    if (y > 670) {
      doc.addPage();
      y = 56;
    }

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Pathologist Remarks & Clinical Interpretation', 48, y);

    y += 16;
    const notesText =
      data.clinicalNotes && data.clinicalNotes.trim().length > 0
        ? data.clinicalNotes.trim()
        : 'Results have been analytically verified against quality control standards. Please interpret in conjunction with patient clinical history.';

    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(9)
      .text(notesText, 48, y, { width: pageWidth, lineGap: 3 });

    // Signature & Verification Footer
    const footerY = Math.max(y + 56, 700);
    doc
      .moveTo(48, footerY)
      .lineTo(48 + pageWidth, footerY)
      .strokeColor('#CBD5E1')
      .lineWidth(0.75)
      .stroke();

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(data.pathologistName, 48, footerY + 12);

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text('Senior Clinical Pathologist · Electronically Signed & Verified', 48, footerY + 25);

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `Meridian Diagnostics Digital Record · Verification Ref: ${data.testCode}/${data.sampleCode} · Generated ${formatDateTime(new Date())}`,
        48,
        footerY + 46,
        { width: pageWidth }
      );

    doc.end();
  });
}
