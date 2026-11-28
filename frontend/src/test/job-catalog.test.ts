import { describe, expect, it } from "vitest";
import { toCatalogJob } from "@/lib/job-catalog";
import type { LiveJob } from "@/services/backend";

const liveJob: LiveJob = {
  id: "job-1", slug: "acme-engineer", title: "Engineer", company_id: "co-1", company: "Acme", location: "Remote",
  work_mode: "Remote", level: "Mid", salary: null, description: "Published description", requirements: ["Build APIs"],
  skills: [{ name: "SQL", required_level: 60, importance: "REQUIRED" }], posted_at: "2026-11-01T00:00:00Z", posted_at_known: true,
  updated_at: null, first_seen_at: "2026-11-02T00:00:00Z", employment_type: null, department: null, is_new: false,
  source: { key: "greenhouse-acme", name: "Acme · Greenhouse", kind: "ATS", is_demo: false },
  official_url: "https://example.com/job", apply_url: "https://example.com/apply", status: "ACTIVE", saved: false,
};

describe("live job catalog", () => {
  it("does not fabricate a match score, salary, level, or skill gaps", () => {
    const job = toCatalogJob(liveJob);
    expect(job.match).toBeNull();
    expect(job.salary).toBe("Not specified");
    expect(job.level).toBe("Not specified");
    expect(job.missing).toEqual([]);
  });

  it("keeps employer-published skills, requirements and official application link", () => {
    const job = toCatalogJob(liveJob);
    expect(job.skills).toEqual(["SQL"]);
    expect(job.responsibilities).toEqual(["Build APIs"]);
    expect(job.portal).toBe("https://example.com/apply");
  });

  it("preserves the published employment type when available", () => {
    const job = toCatalogJob({ ...liveJob, employment_type: "Full-time" });
    expect(job.employmentType).toBe("Full-time");
  });
});
