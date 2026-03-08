export function randomInt(min: number, max: number): number {
 return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
 const ms = randomInt(minMs, maxMs);
 return new Promise(resolve => setTimeout(resolve, ms));
}

export function todayDateString(): string {
 return new Date().toISOString().slice(0, 10);
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
 let timer: NodeJS.Timeout;
 const timeout = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms${label ? ': ' + label : ''}`)), ms);
 });
 return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}
