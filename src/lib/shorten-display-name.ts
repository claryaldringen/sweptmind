interface LocationAddress {
  name?: string;
  state?: string;
  country?: string;
}

export function formatLocationName(address: LocationAddress): string {
  const parts: string[] = [];
  if (address.name) parts.push(address.name);
  if (address.state) parts.push(address.state);
  if (address.country) parts.push(address.country);
  return parts.join(", ");
}
