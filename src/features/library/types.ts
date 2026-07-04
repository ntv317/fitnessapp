export interface CatalogExercise {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  mechanic: 'compound' | 'isolation' | null;
  equipment: string | null;
  level: string;
  category: string;
  instructions: string[];
  images: string[];
}
