export interface IQrGenerator {
  toDataURL(data: string): Promise<string>;
}
