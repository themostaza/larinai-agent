import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createProviderRegistry } from 'ai';

// Provider Registry - supporta OpenAI, Anthropic, Google
export const registry = createProviderRegistry({
  openai,
  anthropic,
  google,
});

// Metadata per UI e gestione modelli
export interface ModelConfig {
  id: string;                           // formato: 'provider:model-name'
  name: string;                         // Nome user-friendly
  provider: 'OpenAI' | 'Anthropic' | 'Google';
  description: string;
  category: 'fast' | 'smart' | 'pro';  // Per raggruppare nella UI
  contextWindow?: number;               // Token context
  maxOutput?: number;                   // Max output tokens
}

// Lista completa dei modelli disponibili
// NOTA: Attualmente forzato solo Claude Sonnet 4.5
export const AVAILABLE_MODELS: ModelConfig[] = [
  // ===== Anthropic Models =====
  {
    id: 'anthropic:claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Ultima generazione Anthropic, capacità di ragionamento superiori',
    category: 'pro',
    contextWindow: 200000,
    maxOutput: 8192,
  },
];

// Modello di default (Claude Sonnet 4.5 - ultima generazione Anthropic)
export const DEFAULT_MODEL = 'anthropic:claude-sonnet-4-5';

// ===== Helper Functions =====

/**
 * Valida se un modelId è presente nella lista dei modelli disponibili
 */
export function isValidModel(modelId: string): boolean {
  return AVAILABLE_MODELS.some(m => m.id === modelId);
}

/**
 * Ottiene la configurazione completa di un modello
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}

/**
 * Raggruppa i modelli per categoria
 */
export function getModelsByCategory() {
  return {
    fast: AVAILABLE_MODELS.filter(m => m.category === 'fast'),
    smart: AVAILABLE_MODELS.filter(m => m.category === 'smart'),
    pro: AVAILABLE_MODELS.filter(m => m.category === 'pro'),
  };
}

/**
 * Raggruppa i modelli per provider
 */
export function getModelsByProvider() {
  return {
    OpenAI: AVAILABLE_MODELS.filter(m => m.provider === 'OpenAI'),
    Anthropic: AVAILABLE_MODELS.filter(m => m.provider === 'Anthropic'),
    Google: AVAILABLE_MODELS.filter(m => m.provider === 'Google'),
  };
}

