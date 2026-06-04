export interface ExerciseResult {
  name: string;
  volumeKg: number;
  isPR: boolean;
}

interface Session {
  startTime: number;
  exercises: ExerciseResult[];
}

let _session: Session | null = null;

export function startSession(startTime: number) {
  _session = { startTime, exercises: [] };
}

export function addExerciseResult(result: ExerciseResult) {
  if (!_session) return;
  _session.exercises.push(result);
}

export function getSession(): Session | null {
  return _session;
}

export function clearSession() {
  _session = null;
}
