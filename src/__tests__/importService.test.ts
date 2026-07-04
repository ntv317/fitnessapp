import { ImportService, type ImportResult } from '@/features/import/services/ImportService';
import type { IWorkoutRepository } from '@/features/workout/services/IWorkoutRepository';

describe('ImportService', () => {
  let mockRepo: IWorkoutRepository;
  let service: ImportService;

  beforeEach(() => {
    mockRepo = { importBatch: jest.fn() } as any;
    service = new ImportService(mockRepo);
  });

  describe('importJSON - valid imports', () => {
    it('should import valid JSON with counts', async () => {
      const json = JSON.stringify([
        {
          day: 'Push',
          exercises: [
            { name: 'Bench Press', isCompound: true, sets: 4, repMin: 6, repMax: 8 },
          ],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result).toEqual({ ok: true, days: 1, exercises: 1 });
      expect(mockRepo.importBatch).toHaveBeenCalled();
    });

    it('should count multiple days and exercises', async () => {
      const json = JSON.stringify([
        {
          day: 'Push',
          exercises: [
            { name: 'Bench', isCompound: true, sets: 4, repMin: 6, repMax: 8 },
            { name: 'Incline', isCompound: true, sets: 3, repMin: 8, repMax: 10 },
          ],
        },
        {
          day: 'Pull',
          exercises: [
            { name: 'Pullups', isCompound: true, sets: 3, repMin: 5, repMax: 8 },
          ],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result).toEqual({ ok: true, days: 2, exercises: 3 });
    });

    it('should handle legacy reps field mapped to repMin/repMax', async () => {
      const json = JSON.stringify([
        {
          day: 'Legs',
          exercises: [
            { name: 'Squat', isCompound: true, sets: 5, reps: 5 },
          ],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result).toEqual({ ok: true, days: 1, exercises: 1 });
      const resolvedPayload = (mockRepo.importBatch as jest.Mock).mock.calls[0][0];
      expect(resolvedPayload[0].exercises[0].repMin).toBe(5);
      expect(resolvedPayload[0].exercises[0].repMax).toBe(5);
    });
  });

  describe('importJSON - string cleaning', () => {
    it('should strip markdown code fences', async () => {
      const json = '```json\n' + JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]) + '\n```';

      const result = await service.importJSON(json);

      expect(result.ok).toBe(true);
    });

    it('should replace curly quotes with straight quotes', async () => {
      // Every JSON delimiter is a curly quote; cleaning must convert them back
      // to straight quotes so JSON.parse succeeds.
      const json = JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ])
        .replace(/"/g, '“'); // U+201C LEFT DOUBLE QUOTATION MARK

      const result = await service.importJSON(json);

      expect(result.ok).toBe(true);
    });

    it('should remove zero-width spaces', async () => {
      const json = JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]).replace('Test', 'Te​st'); // U+200B zero-width space

      const result = await service.importJSON(json);

      expect(result.ok).toBe(true);
    });

    it('should handle whitespace-only strings', async () => {
      const json = '   \n  ' + JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]) + '\n\n';

      const result = await service.importJSON(json);

      expect(result.ok).toBe(true);
    });
  });

  describe('importJSON - validation errors', () => {
    it('should reject invalid JSON', async () => {
      const result = await service.importJSON('{invalid}');

      expect(result.ok).toBe(false);
      expect((result as any).error).toContain('Parse error');
    });

    it('should reject sets: 0', async () => {
      const json = JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 0 }] },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
      expect((result as any).error).toContain('greater than 0');
    });

    it('should reject empty day name', async () => {
      const json = JSON.stringify([
        { day: '', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
    });

    it('should reject empty exercises array', async () => {
      const json = JSON.stringify([
        { day: 'Test', exercises: [] },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
    });

    it('should reject repMin > repMax', async () => {
      const json = JSON.stringify([
        {
          day: 'Test',
          exercises: [{ name: 'Ex', isCompound: false, sets: 1, repMin: 10, repMax: 5 }],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
      expect((result as any).error).toContain('repMin');
    });

    it('should reject missing exercise name', async () => {
      const json = JSON.stringify([
        {
          day: 'Test',
          exercises: [{ isCompound: false, sets: 1 }],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
    });

    it('should reject empty exercise name', async () => {
      const json = JSON.stringify([
        {
          day: 'Test',
          exercises: [{ name: '', isCompound: false, sets: 1 }],
        },
      ]);

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
    });
  });

  describe('importJSON - repo errors', () => {
    it('should return ok:false if repo throws', async () => {
      const json = JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]);
      (mockRepo.importBatch as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('DB error');
    });

    it('should handle non-Error throw from repo', async () => {
      const json = JSON.stringify([
        { day: 'Test', exercises: [{ name: 'Ex', isCompound: false, sets: 1 }] },
      ]);
      (mockRepo.importBatch as jest.Mock).mockRejectedValue('string error');

      const result = await service.importJSON(json);

      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Unknown database error.');
    });
  });

  describe('importJSON - catalog resolution', () => {
    it('should resolve import with correct catalog matching', async () => {
      const json = JSON.stringify([
        {
          day: 'Legs',
          exercises: [
            { name: 'Barbell Back Squat', isCompound: true, sets: 4, repMin: 5, repMax: 8 },
          ],
        },
      ]);

      await service.importJSON(json);

      const resolvedPayload = (mockRepo.importBatch as jest.Mock).mock.calls[0][0];
      expect(resolvedPayload).toBeDefined();
      expect(resolvedPayload[0].day).toBe('Legs');
      expect(resolvedPayload[0].exercises[0].sets).toBe(4);
    });
  });
});
