import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

function Controls() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme}</button>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.classList.remove("dark"); });

describe("Shared CareerOS theme", () => {
  it("updates every consumer and persists changes", () => {
    render(<ThemeProvider><Controls /><Controls /></ThemeProvider>);
    const lightButton = screen.getAllByRole("button", { name: "light" }).at(0);
    if (!lightButton) throw new Error("Missing theme control");
    fireEvent.click(lightButton);
    expect(screen.getAllByRole("button", { name: "dark" })).toHaveLength(2);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("careeros-theme")).toBe("dark");
    const darkButton = screen.getAllByRole("button", { name: "dark" }).at(0);
    if (!darkButton) throw new Error("Missing theme control");
    fireEvent.click(darkButton);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
  it("restores the stored preference", () => {
    localStorage.setItem("careeros-theme", "dark");
    render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(screen.getByRole("button", { name: "dark" })).toBeTruthy();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
  it("defaults to system preference without overriding an explicit selection", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(screen.getByRole("button", { name: "dark" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(localStorage.getItem("careeros-theme")).toBe("light");
  });
});