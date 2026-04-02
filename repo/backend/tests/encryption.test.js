const { encrypt, decrypt } = require("../src/security/encryption");

describe("Profile encryption", () => {
  test("encrypts and decrypts profile values", () => {
    const plaintext = "Sensitive Person Name";
    const encrypted = encrypt(plaintext);

    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("returns null for empty values", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt("")).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
});
