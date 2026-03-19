import type { IQrGenerator } from "@/domain/ports/qr-generator";

export class QrCodeGenerator implements IQrGenerator {
  async toDataURL(data: string): Promise<string> {
    const QRCode = (await import("qrcode")).default;
    return QRCode.toDataURL(data);
  }
}
