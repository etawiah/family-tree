import { describe, expect, it } from "vitest";
import { buildRequestAlert, buildSignedAdminUrl } from "../src/telegram.js";

describe("Telegram approve/deny buttons", () => {
  it("builds Access-admin URLs with id, exp, and HMAC query params", () => {
    const url = buildSignedAdminUrl("https://family-tree.tawiah.net", "approve", {
      id: "abc-123",
      exp: 1700000000,
      sig: "sig_value",
    });
    expect(url).toBe(
      "https://family-tree.tawiah.net/access-admin/approve?id=abc-123&exp=1700000000&sig=sig_value"
    );
  });

  it("uses URL buttons, not callback buttons", () => {
    const payload = buildRequestAlert({
      name: "Ada",
      email: "ada@example.com",
      approveUrl: "https://family-tree.tawiah.net/access-admin/approve?id=1",
      denyUrl: "https://family-tree.tawiah.net/access-admin/deny?id=1",
    });
    const row = payload.reply_markup.inline_keyboard[0];
    expect(row[0]).toEqual({
      text: "Approve",
      url: "https://family-tree.tawiah.net/access-admin/approve?id=1",
    });
    expect(row[1]).toEqual({
      text: "Deny",
      url: "https://family-tree.tawiah.net/access-admin/deny?id=1",
    });
    expect(row[0].callback_data).toBeUndefined();
    expect(row[1].callback_data).toBeUndefined();
    expect(payload.text).toContain("Ada");
    expect(payload.text).toContain("ada@example.com");
  });
});
