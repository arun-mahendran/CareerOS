import { describe, expect, it } from "vitest";
import type { Company, Job } from "@/lib/data";
import { EMPTY_FILTERS, filterCompanies, filterOptions, jobsFor } from "@/lib/companies/directory";

const co = (o: Partial<Company> & Pick<Company, "id" | "name">): Company => ({
  slug: o.id, industry: "Not specified", hq: "Not specified", website: "", careers: "", logo: "", about: "", activeJobs: 0, followed: false, ...o,
});
const job = (o: Partial<Job> & Pick<Job, "id" | "title" | "company">): Job => ({
  location: "Not specified", mode: "Not specified", level: "Not specified", salary: "Not specified", posted: "", match: null,
  skills: [], missing: [], about: "", responsibilities: [], portal: "", ...o,
});

const companies = [
  co({ id: "a", name: "Airbnb", industry: "Travel", hq: "San Francisco", activeJobs: 3, followed: true }),
  co({ id: "r", name: "Ramp", industry: "Fintech", hq: "New York", activeJobs: 0 }),
  co({ id: "s", name: "Stripe", industry: "Fintech" }),
];
const jobs = [
  job({ id: "1", title: "Data Engineer", company: "Airbnb", companyId: "a", location: "Remote" }),
  job({ id: "2", title: "Product Designer", company: "Ramp", companyId: "r", location: "Bengaluru" }),
];
const names = (f: Partial<typeof EMPTY_FILTERS>) => filterCompanies(companies, jobs, { ...EMPTY_FILTERS, ...f }).map((c) => c.name);

describe("company directory filters", () => {
  it("searches by job title and job location, not only company name", () => {
    expect(names({ q: "designer" })).toEqual(["Ramp"]);
    expect(names({ q: "bengaluru" })).toEqual(["Ramp"]);
    expect(names({ q: "fintech" })).toEqual(["Ramp", "Stripe"]);
  });
  it("does not match the 'Not specified' placeholder", () => {
    expect(names({ q: "specified" })).toEqual([]);
  });
  it("filters by industry, headquarters, active jobs and followed", () => {
    expect(names({ industry: "Fintech" })).toEqual(["Ramp", "Stripe"]);
    expect(names({ location: "New York" })).toEqual(["Ramp"]);
    expect(names({ activeOnly: true })).toEqual(["Airbnb"]);
    expect(names({ followedOnly: true })).toEqual(["Airbnb"]);
  });
  it("offers only known industries and locations", () => {
    expect(filterOptions(companies)).toEqual({ industries: ["Fintech", "Travel"], locations: ["New York", "San Francisco"] });
  });
  it("matches company jobs by server id before name", () => {
    expect(jobsFor(companies[0]!, [...jobs, job({ id: "3", title: "X", company: "Airbnb", companyId: "other" })]).map((j) => j.id)).toEqual(["1"]);
  });
});
