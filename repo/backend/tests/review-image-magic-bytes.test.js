/**
 * Magic-byte / file-signature validation tests for review image uploads.
 *
 * Verifies that server-side validation rejects payloads whose bytes do not
 * match the declared MIME type, even when the declared MIME is valid.
 */

const { decodeAndValidateImage } = require("../src/modules/reviews/moderation.service");

// Helper: build a minimal valid PNG buffer (8-byte magic + minimal IHDR)
function validPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
    0x00, 0x00, 0x00, 0x0d  // placeholder IHDR length
  ]);
}

// Helper: build a minimal valid JPEG buffer (SOI + APP0 marker start)
function validJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, // JPEG SOI + APP0
    0x00, 0x10              // placeholder segment length
  ]);
}

// Helper: non-image bytes (e.g. a PHP webshell or plain text)
function nonImageBytes() {
  return Buffer.from("<?php system($_GET['cmd']); ?>", "utf8");
}

function toBase64(buf) {
  return buf.toString("base64");
}

describe("decodeAndValidateImage - magic byte enforcement", () => {
  test("accepts valid PNG bytes with image/png MIME", () => {
    const buf = validPngBuffer();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(buf),
        mimeType: "image/png",
        sizeBytes: buf.length
      })
    ).not.toThrow();
  });

  test("accepts valid JPEG bytes with image/jpeg MIME", () => {
    const buf = validJpegBuffer();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(buf),
        mimeType: "image/jpeg",
        sizeBytes: buf.length
      })
    ).not.toThrow();
  });

  test("rejects non-image bytes even when MIME is image/png (spoofed MIME)", () => {
    const fakeBytes = nonImageBytes();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(fakeBytes),
        mimeType: "image/png",
        sizeBytes: fakeBytes.length
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_CONTENT" })
    );
  });

  test("rejects non-image bytes even when MIME is image/jpeg (spoofed MIME)", () => {
    const fakeBytes = nonImageBytes();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(fakeBytes),
        mimeType: "image/jpeg",
        sizeBytes: fakeBytes.length
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_CONTENT" })
    );
  });

  test("rejects JPEG bytes declared as PNG (wrong MIME for content)", () => {
    const jpegBuf = validJpegBuffer();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(jpegBuf),
        mimeType: "image/png", // wrong MIME
        sizeBytes: jpegBuf.length
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_CONTENT" })
    );
  });

  test("rejects PNG bytes declared as JPEG (wrong MIME for content)", () => {
    const pngBuf = validPngBuffer();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(pngBuf),
        mimeType: "image/jpeg", // wrong MIME
        sizeBytes: pngBuf.length
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_CONTENT" })
    );
  });

  test("rejects disallowed MIME type regardless of content", () => {
    const buf = Buffer.from("GIF89a", "utf8");
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(buf),
        mimeType: "image/gif",
        sizeBytes: buf.length
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_TYPE" })
    );
  });

  test("rejects empty payload", () => {
    expect(() =>
      decodeAndValidateImage({
        base64Data: "",
        mimeType: "image/png",
        sizeBytes: 0
      })
    ).toThrow(
      expect.objectContaining({ status: 400 })
    );
  });

  test("rejects zero-byte declared size", () => {
    const buf = validPngBuffer();
    expect(() =>
      decodeAndValidateImage({
        base64Data: toBase64(buf),
        mimeType: "image/png",
        sizeBytes: 0 // invalid: must be >= 1
      })
    ).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_IMAGE_SIZE" })
    );
  });
});
