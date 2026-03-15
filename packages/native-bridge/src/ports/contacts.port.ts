import type { Contact } from "../types";

export interface ContactsPort {
  isSupported(): boolean;
  searchByName(name: string): Promise<Contact[]>;
}
