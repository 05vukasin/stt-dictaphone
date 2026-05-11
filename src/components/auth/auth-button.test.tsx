import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { signOutMock, useSessionMock, softResetMock, replaceMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(() => Promise.resolve()),
  useSessionMock: vi.fn(),
  softResetMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: useSessionMock,
  signOut: signOutMock,
  authClient: { changePassword: vi.fn() },
}));

vi.mock("@/lib/storage/wipe", () => ({
  softResetCachesFor: softResetMock,
}));

vi.mock("@/lib/storage/user-scope", () => ({
  useUserId: () => "test-user",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn() }),
}));

import { AuthButton } from "./auth-button";

describe("<AuthButton />", () => {
  it("renders nothing when there is no session", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    const { container } = render(<AuthButton />);
    expect(container.firstChild).toBeNull();
  });

  it("opens the menu and signs out", async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "u1", email: "a@b.co", role: "user" } },
      isPending: false,
    });
    render(<AuthButton />);
    fireEvent.click(screen.getByLabelText(/account/i));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalledOnce());
    expect(softResetMock).toHaveBeenCalledWith("test-user");
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("shows the Admin link for admins", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "u1", email: "admin@x.co", role: "admin" } },
      isPending: false,
    });
    render(<AuthButton />);
    fireEvent.click(screen.getByLabelText(/account/i));
    expect(screen.getByRole("menuitem", { name: /admin panel/i })).toBeInTheDocument();
  });

  it("offers a Change password menu item that opens the dialog", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "u1", email: "a@b.co", role: "user" } },
      isPending: false,
    });
    render(<AuthButton />);
    fireEvent.click(screen.getByLabelText(/account/i));
    const item = screen.getByRole("menuitem", { name: /change password/i });
    expect(item).toBeInTheDocument();
    fireEvent.click(item);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });
});
