import type { ContactsPort } from "../../ports/contacts.port";
import type { Contact } from "../../types";

export class WebContactsAdapter implements ContactsPort {
  isSupported(): boolean {
    return false;
  }

  async searchByName(_name: string): Promise<Contact[]> {
    return [];
  }
}
