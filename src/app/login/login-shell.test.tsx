import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

vi.mock("./actions", () => ({
  requestAccess: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

import { LoginShell } from "./login-shell";

describe("<LoginShell />", () => {
  it("renders the Sign-in form by default", () => {
    render(<LoginShell />);
    expect(screen.getByRole("button", { name: /sign in/i, hidden: false })).toBeInTheDocument();
    // Password field is present on the sign-in tab.
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("switches to the Request access tab", () => {
    render(<LoginShell />);
    fireEvent.click(screen.getByRole("tab", { name: /request access/i }));
    expect(screen.getByLabelText(/why you want access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send request/i })).toBeInTheDocument();
  });

  it("honours initialTab", () => {
    render(<LoginShell initialTab="request" />);
    expect(screen.getByLabelText(/why you want access/i)).toBeInTheDocument();
  });
});
