const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_MOD_64 = 0xffffffffffffffffn;

export function computeContentHash(value) {
  const text = String(value || "");
  if (!text) {
    return null;
  }

  const bytes = new TextEncoder().encode(text);
  let hash = FNV_OFFSET_BASIS_64;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME_64) & FNV_MOD_64;
  }

  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
