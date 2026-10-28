export type FocusPhase = 'focus' | 'break';
export type FocusStatus = 'idle' | 'running' | 'paused' | 'completed';
export const FOCUS_DURATION = { focus: 25 * 60_000, break: 5 * 60_000 };

/** One session, measured against a deadline rather than interval ticks. */
export class FocusTimer {
  phase: FocusPhase = 'focus';
  status: FocusStatus = 'idle';
  remainingMs = FOCUS_DURATION.focus;
  deadline = 0;

  start(phase: FocusPhase, now: number) {
    if (this.status === 'running' || this.status === 'paused') return;
    this.phase = phase;
    this.remainingMs = FOCUS_DURATION[phase];
    this.deadline = now + this.remainingMs;
    this.status = 'running';
  }
  tick(now: number): boolean {
    if (this.status !== 'running') return false;
    this.remainingMs = Math.max(0, this.deadline - now);
    if (this.remainingMs > 0) return false;
    this.status = 'completed';
    this.deadline = 0;
    return true;
  }
  pause(now: number): boolean {
    const completed = this.tick(now);
    if (this.status === 'running') {
      this.status = 'paused';
      this.deadline = 0;
    }
    return completed;
  }
  resume(now: number) {
    if (this.status !== 'paused') return;
    this.deadline = now + this.remainingMs;
    this.status = 'running';
  }
  end() {
    this.status = 'idle';
    this.phase = 'focus';
    this.remainingMs = FOCUS_DURATION.focus;
    this.deadline = 0;
  }
}
