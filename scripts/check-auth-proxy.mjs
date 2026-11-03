import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const origin = (process.env.ATLAS_ORIGIN || "https://yflb-atlas.vercel.app").replace(/\/+$/, "");
const configSource = await readFile(new URL("../src/firebase-config.js", import.meta.url), "utf8");
const apiKey = configSource.match(/apiKey:\s*"([^"]+)"/)?.[1];
assert.ok(apiKey, "Firebase API key was not found in src/firebase-config.js");

const query = new URLSearchParams({
  apiKey,
  appName: "[DEFAULT]",
  authType: "signInViaPopup",
  redirectUrl: `${origin}/`,
  v: "13.1.0",
  providerId: "google.com",
  scopes: "email",
  customParameters: JSON.stringify({ prompt: "select_account" }),
  eventId: "1"
});

const checks = [
  { name: "OAuth callback", path: "/__/auth/handler", marker: "fireauth.oauthhelper.widget.initialize()", type: "text/html" },
  { name: "OAuth callback with trailing slash", path: "/__/auth/handler/", marker: "fireauth.oauthhelper.widget.initialize()", type: "text/html" },
  { name: "OAuth helper script", path: "/__/auth/handler.js", marker: "fireauth.oauthhelper", type: "javascript" },
  { name: "Redirect iframe", path: "/__/auth/iframe", marker: "fireauth", type: "text/html" },
  { name: "Redirect iframe script", path: "/__/auth/iframe.js", marker: "fireauth", type: "javascript" }
];

let failures = 0;
for (const check of checks) {
  const url = `${origin}${check.path}?${query}`;
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const passed = response.ok && contentType.includes(check.type) && body.includes(check.marker) && !body.includes("YFLB Atlas");
  console.log(`${passed ? "PASS" : "FAIL"} ${check.name}: HTTP ${response.status}, ${contentType.split(";")[0] || "no content type"}`);
  if (!passed) failures += 1;
}

assert.equal(failures, 0, `${failures} Firebase auth helper endpoint check(s) failed.`);
