/**
 * Per-user settings, currently the BYOK Anthropic API key.
 * The key is encrypted at the application layer before it ever touches the DB,
 * and the plaintext is only ever returned internally to inject into a workspace
 * — never sent back to the client.
 */
import { admin } from '../lib/supabase';
import { httpErrors } from '../lib/errors';
import { encryptSecret, decryptSecret } from '../lib/crypto';

const TABLE = 'user_settings';

export async function setAnthropicKey(userId: string, rawKey: string): Promise<void> {
  const encrypted = encryptSecret(rawKey);
  const { error } = await admin
    .from(TABLE)
    .upsert({ user_id: userId, anthropic_key_encrypted: encrypted }, { onConflict: 'user_id' });
  if (error) {
    throw httpErrors.internal(`Failed to save API key: ${error.message}`);
  }
}

export async function hasAnthropicKey(userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from(TABLE)
    .select('anthropic_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw httpErrors.internal(`Failed to read settings: ${error.message}`);
  }
  return Boolean(data?.anthropic_key_encrypted);
}

/** Decrypted key for runtime injection. Returns null if unset or undecryptable. */
export async function getAnthropicKey(userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('anthropic_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.anthropic_key_encrypted) {
    return null;
  }
  try {
    return decryptSecret(data.anthropic_key_encrypted);
  } catch {
    return null;
  }
}

export async function deleteAnthropicKey(userId: string): Promise<void> {
  const { error } = await admin.from(TABLE).delete().eq('user_id', userId);
  if (error) {
    throw httpErrors.internal(`Failed to delete API key: ${error.message}`);
  }
}
