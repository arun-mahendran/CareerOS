import { BarChart3, BookOpen, BriefcaseBusiness, ChevronRight, Code2, Flag, Map, Send, Target, TrendingUp, Users } from "lucide-react";

export function AuthJourney() {
  return (
    <section className="auth-journey" aria-label="Your career journey">
      <h1>Welcome back to<br />your <span className="auth-title-accent">career journey.</span></h1>
      <p className="auth-intro">Your next opportunity is closer than you think.</p>
      <div className="journey-art" aria-hidden="true">
        <svg className="journey-path" viewBox="0 0 580 360" fill="none">
          <path d="M-20 335C35 270 66 253 122 261S193 268 208 232S257 194 286 176S328 95 369 84S441 94 483 66S513 18 526 4" />
          {[ [54,282], [101,261], [208,232], [286,176], [369,84], [483,66] ].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="5" />)}
        </svg>
        <div className="journey-readiness journey-tile">
          <div className="flex items-center gap-3"><span className="journey-icon"><BarChart3 /></span><div><p>Career readiness</p><strong>82%</strong></div><span className="ml-auto text-xs text-success flex items-center"><TrendingUp className="size-3" /> +12%</span></div>
          <div className="journey-meter"><span /></div>
        </div>
        <div className="journey-stop stop-learn"><BookOpen /> Learn</div>
        <div className="journey-stop stop-build"><Code2 /> Build</div>
        <div className="journey-stop stop-apply"><Send /> Apply</div>
        <div className="journey-stop stop-grow"><BarChart3 /> Grow</div>
        <span className="journey-flag"><Flag /></span>
        <div className="journey-matches journey-tile"><span className="journey-icon"><BriefcaseBusiness /></span><div><strong>3 new role matches</strong><p>Based on your profile</p></div><ChevronRight className="ml-auto size-4 text-muted-foreground" /></div>
        <div className="journey-roadmap journey-tile"><span className="journey-icon"><Map /></span><div className="flex-1"><strong>Your roadmap</strong><p>4 of 7 steps completed</p><div className="journey-segments">{Array.from({ length: 7 }, (_, i) => <span key={i} className={i < 4 ? "bg-primary" : "bg-secondary"} />)}</div></div><ChevronRight className="size-4 text-muted-foreground" /></div>
      </div>
      <div className="journey-benefits">
        <div><span><Target /></span><p>Discover<br />opportunities</p></div>
        <div><span><BarChart3 /></span><p>Build in-demand<br />skills</p></div>
        <div><span><Users /></span><p>Get job-ready<br />with guidance</p></div>
      </div>
    </section>
  );
}