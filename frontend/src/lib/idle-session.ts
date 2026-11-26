/** Wall-clock deadlines also work after a sleeping/background tab resumes. */
export class IdleSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private stopped = false;
  constructor(private lastActivity: number, private timeout: number, private warning: number, private onWarning: () => void, private onExpire: () => void) {
    this.check();
  }
  activity(at = Date.now()) {
    if (this.stopped || at <= this.lastActivity) return;
    this.lastActivity = at;
    this.warned = false;
    this.check();
  }
  check = () => {
    if (this.stopped) return;
    clearTimeout(this.timer);
    const remaining = this.lastActivity + this.timeout - Date.now();
    if (remaining <= 0) { this.stop(); this.onExpire(); return; }
    if (remaining <= this.warning && !this.warned) { this.warned = true; this.onWarning(); }
    this.timer = setTimeout(this.check, this.warned ? remaining : remaining - this.warning);
  };
  stop() { this.stopped = true; clearTimeout(this.timer); }
}