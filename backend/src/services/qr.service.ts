import QRCode from 'qrcode';
import { prisma } from '../db/store';
import { STATIC_OFFICE_QR_TOKEN } from '../controllers/attendance.controller';

export const qrService = {
  /**
   * Generate High-Resolution QR PNG Buffer for Office Attendance
   */
  generateOfficeQRBuffer: async (officeName?: string): Promise<Buffer> => {
    const token = STATIC_OFFICE_QR_TOKEN;

    // Generate high-resolution, crisp QR matrix with margin
    const qrBuffer = await QRCode.toBuffer(token, {
      type: 'png',
      width: 720,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0A1E3F',
        light: '#FFFFFF',
      },
    });

    return qrBuffer;
  },

  /**
   * Generate Base64 Data URL for embedding directly in mobile or web
   */
  generateOfficeQRDataUrl: async (): Promise<string> => {
    const token = STATIC_OFFICE_QR_TOKEN;
    return QRCode.toDataURL(token, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0A1E3F',
        light: '#FFFFFF',
      },
    });
  },
};
