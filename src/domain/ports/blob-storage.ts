export interface IBlobStorage {
  save(path: string, data: Buffer): Promise<string>;
  delete(url: string): Promise<void>;
}
