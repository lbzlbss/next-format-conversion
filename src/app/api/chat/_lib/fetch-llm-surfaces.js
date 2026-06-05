import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARK_CHAT_URL,
  ARK_CHAT_MODEL,
  getChatApiKey,
} from '../../_lib/ark.js';
import { detectLlmUiIntent } from '../../../lib/a2ui/detect-llm-ui-intent.js';
import { extractJsonFromLlmResponse } from '../../../lib/a2ui/parse-llm-ui-response.js';
import { validateLlmSurfaces } from '../../../lib/a2ui/validator.js';
import { buildFortuneFallbackSurface } from '../../../lib/a2ui/build-fortune-fallback-surface.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_RULES_PATH = path.resolve(
  __dirname,
  '../../../lib/a2ui/catalog-rules.txt',
);

const A2UI_LLM_ENABLED = process.env.A2UI_LLM_ENABLED === '1';
const A2UI_LLM_MAX_TOKENS = Number(process.env.A2UI_LLM_MAX_TOKENS || 2048);

let cachedRules = '';

function getCatalogRules() {
  if (cachedRules) return cachedRules;
  try {
    cachedRules = fs.readFileSync(CATALOG_RULES_PATH, 'utf8');
  } catch {
    cachedRules = '仅输出 {"surfaces":[]}  JSON。';
  }
  return cachedRules;
}

/**
 * @param {'fortune' | 'tutorial'} intent
 */
function intentHint(intent) {
  if (intent === 'fortune') {
    return '当前场景：命理咨询。生成 fortune dataModel 与三张 Text 摘要卡。';
  }
  return '当前场景：操作教程。生成 Steps 组件（3-5 步）。';
}

/**
 * 辅助非流式请求生成 A2UI Surface
 * @param {string} userContent
 * @param {{ toolKey?: string | null }} context
 * @returns {Promise<import('../../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState[]>}
 */
export async function fetchLlmSurfaces(userContent, context = {}) {
  if (!A2UI_LLM_ENABLED) return [];

  const intent = detectLlmUiIntent(userContent, context);
  if (!intent) return [];

  const apiKey = getChatApiKey();
  if (!apiKey) return [];

  const systemPrompt = `${getCatalogRules()}\n\n${intentHint(intent)}`;

  try {
    const res = await fetch(ARK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ARK_CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        stream: false,
        max_tokens: A2UI_LLM_MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error('[chat/a2ui-llm] Ark error', res.status);
      if (intent === 'fortune') return [buildFortuneFallbackSurface()];
      return [];
    }

    const json = await res.json();
    const content =
      json?.choices?.[0]?.message?.content ??
      json?.output?.text ??
      '';

    const parsed = extractJsonFromLlmResponse(String(content));
    const validated = validateLlmSurfaces(parsed);

    if (validated.ok && validated.surfaces.length > 0) {
      return validated.surfaces;
    }

    console.warn('[chat/a2ui-llm] validate failed:', validated.ok ? 'empty' : validated.error);

    if (intent === 'fortune') {
      return [buildFortuneFallbackSurface()];
    }

    return [];
  } catch (err) {
    console.error('[chat/a2ui-llm]', err);
    if (intent === 'fortune') return [buildFortuneFallbackSurface()];
    return [];
  }
}
