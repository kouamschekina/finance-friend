import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Minimal Web Push implementation using VAPID ---
// Deno doesn't have the npm web-push library, so we implement VAPID signing manually.

async function importVapidPrivateKey(b64url: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(b64url);
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );
}

async function importVapidPrivateKeyForSigning(b64url: string): Promise<CryptoKey> {
  // Convert raw private key bytes to PKCS8 for ECDSA signing
  const rawKey = base64UrlDecode(b64url);
  // Build PKCS8 DER for P-256 private key
  const pkcs8 = buildPkcs8(rawKey);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function buildPkcs8(rawPrivateKey: Uint8Array): ArrayBuffer {
  // PKCS8 wrapper for P-256 private key (RFC 5958)
  const oidP256 = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const ecPrivateKey = new Uint8Array([
    0x30, 0x77, // SEQUENCE
    0x02, 0x01, 0x01, // version = 1
    0x04, 0x20, ...rawPrivateKey, // privateKey
    0xa0, 0x0a, 0x06, 0x08, ...oidP256, // parameters (OID P-256)
  ]);
  const algorithmIdentifier = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, ...oidP256,
  ]);
  const privateKeyInfo = new Uint8Array([
    0x30, 0x00, // SEQUENCE (length filled below)
    0x02, 0x01, 0x00, // version = 0
    ...algorithmIdentifier,
    0x04, ecPrivateKey.length, ...ecPrivateKey,
  ]);
  // Fix outer SEQUENCE length
  const totalLen = privateKeyInfo.length - 2;
  privateKeyInfo[1] = totalLen;
  return privateKeyInfo.buffer;
}

function base64UrlDecode(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64: string,
  publicKeyB64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signingKey = await importVapidPrivateKeyForSigning(privateKeyB64);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);

  // Encrypt the payload using ECDH + AES-GCM (RFC 8291)
  const encrypted = await encryptPayload(payload, subscription.p256dh, subscription.auth);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    },
    body: encrypted,
  });

  return { ok: res.ok, status: res.status };
}

async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(payload);

  // Import receiver's public key
  const receiverPublicKeyBytes = base64UrlDecode(p256dhB64);
  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    receiverPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  // Export ephemeral public key
  const ephemeralPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey)
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );

  const authBytes = base64UrlDecode(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive content encryption key and nonce (RFC 8291)
  const prk = await hkdf(
    new Uint8Array(sharedSecret),
    authBytes,
    concat(encoder.encode("WebPush: info\0"), receiverPublicKeyBytes, ephemeralPublicKeyBytes),
    32
  );

  const cek = await hkdf(prk, salt, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(prk, salt, encoder.encode("Content-Encoding: nonce\0"), 12);

  // Import CEK
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);

  // Pad plaintext: add 0x02 delimiter + padding
  const paddedPlaintext = new Uint8Array(plaintext.length + 1);
  paddedPlaintext.set(plaintext);
  paddedPlaintext[plaintext.length] = 0x02;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext)
  );

  // Build aes128gcm content (RFC 8188): salt(16) + rs(4) + idlen(1) + keyid + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([ephemeralPublicKeyBytes.length]);

  return concat(salt, rs, idlen, ephemeralPublicKeyBytes, ciphertext);
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// --- Notification messages ---
const MESSAGES = [
  { title: "💰 Log your spending", body: "Take 30 seconds to record today's transactions in Fenowa." },
  { title: "📊 Stay on track", body: "Don't forget to log your expenses — your budget will thank you!" },
  { title: "🎯 Quick check-in", body: "How's your spending today? Open Fenowa and add your transactions." },
  { title: "💡 Money tip", body: "Tracking every transaction is the #1 habit of people who reach their savings goals." },
  { title: "📝 Record it now", body: "A few seconds of logging today keeps financial stress away tomorrow." },
];

function randomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

// --- Main handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@fenowa.app";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all push subscriptions
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const msg = randomMessage();
  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    url: "/transactions",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
  });

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
          VAPID_SUBJECT
        );
        if (result.ok) {
          sent++;
        } else if (result.status === 410 || result.status === 404) {
          // Subscription expired — clean it up
          expired.push(sub.endpoint);
          failed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error("Push failed for", sub.endpoint, e);
        failed++;
      }
    })
  );

  // Remove expired subscriptions
  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return new Response(JSON.stringify({ sent, failed, total: subscriptions.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
