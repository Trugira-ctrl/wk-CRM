// Keep the same logical purchase on retries, including after a tab reload.
// A confirmed result clears it; the next explicit purchase gets a fresh key.
export function renewalKey(member: number, plan: number): string {
  const slot = `waka_renewal_${member}_${plan}`;
  let key = sessionStorage.getItem(slot);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(slot, key);
  }
  return key;
}

export function completeRenewal(member: number, plan: number) {
  sessionStorage.removeItem(`waka_renewal_${member}_${plan}`);
}
