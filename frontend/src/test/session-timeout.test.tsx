import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), validate: vi.fn(), signOut: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate, useRouterState: () => "/analytics" }));
vi.mock("@/services/backend", () => ({ USE_API: true, auth: { validateSession: mocks.validate, signOut: mocks.signOut, invalidate: vi.fn(), onChange: () => () => {} } }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));
import { SessionTimeout } from "@/components/session-timeout";

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["private"], { confidential: true });
  render(<QueryClientProvider client={client}><SessionTimeout userId="test-owner"><p>Private workspace</p></SessionTimeout></QueryClientProvider>);
  return client;
}

describe("authenticated session controls", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    localStorage.clear(); mocks.navigate.mockReset(); mocks.validate.mockReset(); mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined); mocks.navigate.mockResolvedValue(undefined);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it("requires successful backend validation to continue", async () => {
    mocks.validate.mockResolvedValue({ id: "test-owner" });
    mount();
    act(() => vi.advanceTimersByTime(28 * 60_000));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue Session" })); });
    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("failed continuation clears private data and redirects", async () => {
    mocks.validate.mockRejectedValue(new Error("Expired"));
    const client = mount();
    act(() => vi.advanceTimersByTime(28 * 60_000));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue Session" })); });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["private"])).toBeUndefined();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
  });
  it("automatically signs out after 30 minutes without activity", async () => {
    mount();
    await act(async () => vi.advanceTimersByTime(30 * 60_000));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
  });
  it("the warning Log Out action uses the same sign-out flow", async () => {
    mount(); act(() => vi.advanceTimersByTime(28 * 60_000));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Log Out" })); });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
  it("another tab's activity resets inactivity", () => {
    mount(); act(() => vi.advanceTimersByTime(20 * 60_000));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "careeros.activity.test-owner", newValue: String(Date.now()) })));
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("another tab's logout clears this workspace", async () => {
    mount();
    await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: "careeros.logout.test-owner", newValue: String(Date.now()) })));
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});