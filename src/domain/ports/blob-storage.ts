export interface IBlobStorage {
  delete(url: string): Promise<void>;
}
