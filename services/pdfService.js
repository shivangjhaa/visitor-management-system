const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BRAND = { navy: '#1c2530', amber: '#f2b134', slate: '#6b7684', line: '#d9dee3' };

const drawSignatureBox = (doc, x, y, w, label) => {
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor(BRAND.line).lineWidth(1).stroke();
  doc.fontSize(9).fillColor(BRAND.slate).text(label, x, y + 4, { width: w, align: 'center' });
};

/**
 * Generates the visitor gate pass PDF and writes it to disk.
 * Returns the absolute file path.
 */
const generateGatePassPDF = ({ visitor, gatePassNumber, outputDir }) =>
  new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const fileName = `${gatePassNumber.replace(/\//g, '-')}.pdf`;
      const filePath = path.join(outputDir, fileName);
      const doc = new PDFDocument({ size: 'A5', margin: 0 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageW = doc.page.width;
      const margin = 28;
      const contentW = pageW - margin * 2;

      // ---------- Header band ----------
      doc.rect(0, 0, pageW, 74).fill(BRAND.navy);
      doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
        .text(process.env.COMPANY_NAME || 'Alok Industries Ltd.', margin, 16);
      doc.fontSize(9).font('Helvetica').fillColor('#c7cfd8')
        .text('Visitor Management System — Gate Pass', margin, 36);
      doc.fontSize(8).fillColor(BRAND.amber)
        .text('MANUFACTURING FACILITY', margin, 52);

      // Gate pass number chip (top right, acts as the "logo" corner mark)
      doc.roundedRect(pageW - 150, 16, 122, 42, 4).fill(BRAND.amber);
      doc.fillColor(BRAND.navy).fontSize(8).font('Helvetica-Bold')
        .text('GATE PASS NO.', pageW - 144, 22, { width: 110, align: 'center' });
      doc.fontSize(12).text(gatePassNumber, pageW - 144, 34, { width: 110, align: 'center' });

      let y = 90;

      // ---------- Photo placeholder + Inward number ----------
      const photoBoxW = 72;
      if (visitor.photoUrl && fs.existsSync(visitor.photoUrl)) {
        doc.image(visitor.photoUrl, margin, y, { width: photoBoxW, height: 90, fit: [photoBoxW, 90] });
      } else {
        doc.rect(margin, y, photoBoxW, 90).strokeColor(BRAND.line).lineWidth(1).stroke();
        doc.fontSize(8).fillColor(BRAND.slate).text('VISITOR\nPHOTO', margin, y + 36, { width: photoBoxW, align: 'center' });
      }

      const infoX = margin + photoBoxW + 16;
      const infoW = contentW - photoBoxW - 16;

      doc.fontSize(8).fillColor(BRAND.slate).text('INWARD NUMBER', infoX, y);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND.navy).text(visitor.inwardNumber, infoX, y + 11);

      doc.fontSize(8).font('Helvetica').fillColor(BRAND.slate).text('VISITOR NAME', infoX, y + 32);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND.navy).text(visitor.visitorName, infoX, y + 43);

      doc.fontSize(8).font('Helvetica').fillColor(BRAND.slate).text('CATEGORY', infoX, y + 64);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.navy).text(visitor.visitorCategory?.categoryName || '—', infoX, y + 75, { width: infoW });

      y += 104;
      doc.moveTo(margin, y).lineTo(pageW - margin, y).strokeColor(BRAND.line).stroke();
      y += 12;

      // ---------- Detail grid ----------
      const rowGap = 15;
      const col1X = margin;
      const col2X = margin + contentW / 2;
      const colW = contentW / 2 - 8;

      const field = (label, value, x, yy) => {
        doc.fontSize(7.5).font('Helvetica').fillColor(BRAND.slate).text(label, x, yy);
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(BRAND.navy)
          .text(value && String(value).trim() ? String(value) : '—', x, yy + 9, { width: colW });
      };

      field('MOBILE NUMBER', visitor.mobile, col1X, y);
      field('VISITOR COMPANY', visitor.visitorCompany, col2X, y);
      y += rowGap * 2;

      field('PERSON TO MEET', visitor.personToMeet, col1X, y);
      field('DEPARTMENT', visitor.department?.departmentName, col2X, y);
      y += rowGap * 2;

      field('PURPOSE OF VISIT', visitor.purpose, col1X, y);
      field('APPOINTMENT DATE', new Date(visitor.appointmentDate).toLocaleDateString('en-IN'), col2X, y);
      y += rowGap * 2;

      field('PLANT / LOCATION', [visitor.plant?.plantName, visitor.location?.locationName].filter(Boolean).join(' · '), col1X, y);
      field('DIVISION', visitor.division?.divisionName, col2X, y);
      y += rowGap * 2;

      field('ENTRY TIME', visitor.entryTime ? new Date(visitor.entryTime).toLocaleString('en-IN') : '—', col1X, y);
      field('VEHICLE TYPE', visitor.vehicleType, col2X, y);
      y += rowGap * 2;

      field('VEHICLE NUMBER', visitor.vehicleNumber, col1X, y);
      field('MATERIAL CARRIED', visitor.materialCarried, col2X, y);
      y += rowGap * 2;

      field('ID PROOF', `${visitor.idProofType}${visitor.idProofNumber ? ' — ' + visitor.idProofNumber : ''}`, col1X, y);
      field('ACCESS CARD', visitor.assignedCard?.cardNumber || 'Not assigned', col2X, y);
      y += rowGap * 2 + 6;

      doc.moveTo(margin, y).lineTo(pageW - margin, y).strokeColor(BRAND.line).stroke();
      y += 20;

      // ---------- Signature boxes ----------
      const sigW = (contentW - 24) / 3;
      drawSignatureBox(doc, margin, y, sigW, 'Visitor Signature');
      drawSignatureBox(doc, margin + sigW + 12, y, sigW, 'Security Signature');
      drawSignatureBox(doc, margin + (sigW + 12) * 2, y, sigW, 'Employee Signature');

      y += 34;
      doc.fontSize(7).fillColor(BRAND.slate)
        .text('This pass must be visibly worn/carried at all times within the premises and surrendered at exit.', margin, y, { width: contentW, align: 'center' });
      doc.fontSize(7).fillColor(BRAND.slate)
        .text(`Issued: ${new Date().toLocaleString('en-IN')}`, margin, y + 12, { width: contentW, align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateGatePassPDF };
