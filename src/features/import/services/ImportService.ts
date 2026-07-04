import { AIImportSchema, type AIImportPayload } from '@/core/database/types';
import type { IWorkoutRepository } from '@/features/workout/services/IWorkoutRepository';
import { resolveImport } from './catalogMatch';

export type ImportResult =
  | { ok: true; days: number; exercises: number }
  | { ok: false; error: string };

export class ImportService {
  constructor(private readonly repo: IWorkoutRepository) {}

  async importJSON(raw: string): Promise<ImportResult> {
    const cleaned = raw
      .trim()
      // Remove code fences
      .replace(/^```[a-zA-Z]*\n?/m, '')
      .replace(/\n?```$/m, '')
      // Replace curly/smart quotes with straight quotes using unicode escapes
      .replace(/[“”„‟″‶]/g, '"')
      .replace(/[‘’‚‛′‵]/g, "'")
      // Remove zero-width and non-breaking spaces
      .replace(/[ ​‌‍﻿]/g, ' ')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { ok: false, error: `Parse error: ${e instanceof Error ? e.message : String(e)}` };
    }

    const result = AIImportSchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.errors[0];
      return {
        ok: false,
        error: `[${first.path.join('.')}]: ${first.message}`,
      };
    }

    const payload: AIImportPayload = result.data;
    const totalExercises = payload.reduce((sum, d) => sum + d.exercises.length, 0);

    try {
      await this.repo.importBatch(resolveImport(payload), Date.now());
      return { ok: true, days: payload.length, exercises: totalExercises };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown database error.',
      };
    }
  }
}
