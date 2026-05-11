import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { changePasswordMock } = vi.hoisted(() => ({
  changePasswordMock: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { changePassword: changePasswordMock },
}));

import { ChangePasswordDialog } from "./change-password-dialog";

function setup() {
  const onClose = vi.fn();
  render(<ChangePasswordDialog open={true} onClose={onClose} />);
  return { onClose };
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("<ChangePasswordDialog />", () => {
  it("validates the password length", async () => {
    changePasswordMock.mockReset();
    setup();
    fill(/current password/i, "old-password");
    fill(/^new password/i, "short");
    fill(/confirm new password/i, "short");
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("validates that the two new fields match", async () => {
    changePasswordMock.mockReset();
    setup();
    fill(/current password/i, "old-password");
    fill(/^new password/i, "p4ssw0rd-test");
    fill(/confirm new password/i, "different-pass-word");
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("calls authClient.changePassword with revokeOtherSessions on success", async () => {
    changePasswordMock.mockReset();
    changePasswordMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { onClose } = setup();
    fill(/current password/i, "old-password");
    fill(/^new password/i, "p4ssw0rd-test");
    fill(/confirm new password/i, "p4ssw0rd-test");
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledOnce());
    expect(changePasswordMock).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "p4ssw0rd-test",
      revokeOtherSessions: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("surfaces the server error message", async () => {
    changePasswordMock.mockReset();
    changePasswordMock.mockResolvedValue({ data: null, error: { message: "Wrong password" } });
    setup();
    fill(/current password/i, "old-password");
    fill(/^new password/i, "p4ssw0rd-test");
    fill(/confirm new password/i, "p4ssw0rd-test");
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/wrong password/i)).toBeInTheDocument();
  });
});
