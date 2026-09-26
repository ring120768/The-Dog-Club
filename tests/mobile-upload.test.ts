import test from "node:test";
import assert from "node:assert/strict";
import {
  MobileUploadTooLargeError,
  readBoundedBody,
} from "../src/lib/mobile-upload";

test("bounded mobile uploads return the exact request bytes", async () => {
  const source = new Uint8Array([1, 2, 3, 4]);
  const request = new Request("https://example.test/photo", {
    method: "PUT",
    body: source.buffer,
  });
  assert.deepEqual(await readBoundedBody(request, 4), source);
});

test("declared oversized uploads are rejected before reading", async () => {
  const request = new Request("https://example.test/photo", {
    method: "PUT",
    headers: { "content-length": "5" },
    body: new Uint8Array([1]).buffer,
  });
  await assert.rejects(readBoundedBody(request, 4), MobileUploadTooLargeError);
});

test("actual oversized uploads are rejected when content length is absent", async () => {
  const request = new Request("https://example.test/photo", {
    method: "PUT",
    body: new Uint8Array([1, 2, 3, 4, 5]).buffer,
  });
  await assert.rejects(readBoundedBody(request, 4), MobileUploadTooLargeError);
});
