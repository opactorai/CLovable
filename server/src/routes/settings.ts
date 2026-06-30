/**
 * User settings — BYOK Anthropic API key management.
 * The raw key is write-only: clients can set, check status, or delete it, but
 * can never read it back.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { maskKey } from '../lib/crypto';
import {
  deleteAnthropicKey,
  hasAnthropicKey,
  setAnthropicKey,
} from '../services/user-settings';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const keySchema = z.object({
  // Anthropic keys look like sk-ant-... ; keep the check loose but bounded.
  apiKey: z.string().trim().min(20).max(400),
});

// Whether the caller has a key on file (never returns the key itself).
settingsRouter.get(
  '/anthropic-key',
  asyncHandler(async (req, res) => {
    res.json({ configured: await hasAnthropicKey(req.user!.id) });
  }),
);

// Set / replace the caller's key.
settingsRouter.put(
  '/anthropic-key',
  asyncHandler(async (req, res) => {
    const { apiKey } = keySchema.parse(req.body);
    await setAnthropicKey(req.user!.id, apiKey);
    res.json({ ok: true, configured: true, masked: maskKey(apiKey) });
  }),
);

// Remove the caller's key.
settingsRouter.delete(
  '/anthropic-key',
  asyncHandler(async (req, res) => {
    await deleteAnthropicKey(req.user!.id);
    res.json({ ok: true, configured: false });
  }),
);
