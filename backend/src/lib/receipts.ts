import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export interface ReceiptData {
  reservationId: number;
  spaceLabel: string;
  vehicleType: string;
  plate: string;
  driverName: string;
  reservationDate: string;
}

// UC3: generate the single, inalterable QR/PDF receipt. The caller uploads the
// returned bytes to S3 and stores the key in reservations.receipt_s3_key.
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const qrPayload = JSON.stringify({
    r: data.reservationId,
    s: data.spaceLabel,
    d: data.reservationDate,
  });
  const qrPng = await QRCode.toBuffer(qrPayload, { width: 240, margin: 1 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText('Comprobante de Reserva', {
    x: 40,
    y: 540,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });

  const lines = [
    `Reserva #: ${data.reservationId}`,
    `Colaborador: ${data.driverName}`,
    `Espacio: ${data.spaceLabel}`,
    `Vehiculo: ${data.vehicleType} (${data.plate})`,
    `Fecha: ${data.reservationDate}`,
  ];
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 500 - i * 22, size: 12, font }));

  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, { x: 90, y: 140, width: 240, height: 240 });

  return Buffer.from(await pdf.save());
}
