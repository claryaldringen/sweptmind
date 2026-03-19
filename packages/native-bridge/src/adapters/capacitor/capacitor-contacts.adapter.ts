import type { ContactsPort } from "../../ports/contacts.port";
import type { Contact } from "../../types";

export class CapacitorContactsAdapter implements ContactsPort {
  isSupported(): boolean {
    return true;
  }

  async searchByName(name: string): Promise<Contact[]> {
    const { Contacts } = await import("@capacitor-community/contacts");

    const result = await Contacts.getContacts({
      projection: {
        name: true,
        phones: true,
      },
    });

    const query = name.toLowerCase();
    return result.contacts
      .filter((c) => {
        const displayName = c.name?.display ?? "";
        return displayName.toLowerCase().includes(query);
      })
      .map((c) => ({
        name: c.name?.display ?? "",
        phones: (c.phones ?? []).map((p) => p.number ?? "").filter(Boolean),
      }))
      .filter((c) => c.phones.length > 0);
  }
}
