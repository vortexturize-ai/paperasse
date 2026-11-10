let suspended = 0;

export function lockSuspended(): boolean {
  return suspended > 0;
}

export async function withLockSuspended<T>(fn: () => Promise<T>): Promise<T> {
  suspended++;
  try {
    return await fn();
  } finally {
    suspended--;
  }
}
