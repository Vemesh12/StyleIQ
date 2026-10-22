import bcrypt from 'bcryptjs';

// A real bcrypt hash of a random throwaway value, computed once. Comparing
// against it when an account doesn't exist makes "unknown email" take the same
// time as "wrong password", so response timing can't be used to discover
// which emails are registered.
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync(crypto.randomUUID(), 10);
  return dummyHash;
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, getDummyHash());
    return false;
  }
  return bcrypt.compare(password, hash);
}
