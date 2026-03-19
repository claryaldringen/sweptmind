interface LocationAddress {
  name?: string;
  city?: string;
  /** Municipality, county or district — used to disambiguate when city === name */
  region?: string;
  state?: string;
  country?: string;
}

export function formatLocationName(address: LocationAddress): string {
  const parts: string[] = [];
  if (address.name) parts.push(address.name);
  // Add city if different from name (e.g. "Lužiny, Praha" but not "Praha, Praha")
  if (address.city && address.city !== address.name) parts.push(address.city);
  // When city equals name (small villages) or is missing, add region for disambiguation
  if (address.region && (!address.city || address.city === address.name))
    parts.push(address.region);
  if (address.country) parts.push(address.country);
  return parts.join(", ");
}
