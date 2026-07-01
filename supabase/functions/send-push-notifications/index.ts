import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGES = [
  { title: "💰 Log your spending", body: "Take 30 seconds to record today's transactions in Fenowa." },
  { title: "📊 Stay on track", body: "Don't forget to log your expenses — your budget will thank you!" },
  { title: "🎯 Quick check-in", body: "How's your spending today? Open Fenowa and add your transactions." },
  { title: "💡 Money tip", body: "Tracking every transaction is the #1 habit of people who reach their savings goals." },
  { title: "📝 Record it now", body: "A few seconds of logging today keeps financial stress away tomorrow." },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64uDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── VAPID JWT ─────────────────────────────────────────────────────────────────

async function makeVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64u: string,
  privateKeyB64u: string,
): Promise<string> {
  const enc = new TextEncoder();
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64uEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })));
  const sigInput = `${header}.${payload}`;

  // Import as JWK — avoids all PKCS8 wrapping issues
  const privateKeyBytes = b64uDecode(privateKeyB64u);
  const publicKeyBytes = b64uDecode(publicKeyB64u);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: b64uEncode(privateKeyBytes),
    x: b64uEncode(publicKeyBytes.slice(1, 33)),
    y: b64uEncode(publicKeyBytes.slice(33, 65)),
  };

  const signingKey = await crypto.subtle.importKey(
    "jwk", jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    enc.encode(sigInput),
  );

  return `${sigInput}.${b64uEncode(sig)}`;
}

// ── Payload encryption (RFC 8291 / aes128gcm) ────────────────────────────────

async function encryptPayload(
  plaintext: string,
  p256dhB64u: string,
  authB64u: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  const receiverPubKey = await crypto.subtle.importKey(
    "raw", b64uDecode(p256dhB64u),
    { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiverPubKey }, ephemeral.privateKey, 256)
  );

  const authSecret = b64uDecode(authB64u);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hkdf = async (ikm: Uint8Array, s: Uint8Array, info: Uint8Array, len: number) => {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: s, info }, key, len * 8)
    );
  };

  const prk = await hkdf(
    sharedBits, authSecret,
    concat(enc.encode("WebPush: info\0"), b64uDecode(p256dhB64u), ephPubRaw),
    32
  );
  const cek = await hkdf(prk, salt, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(prk, salt, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = concat(enc.encode(plaintext), new Uint8Array([2]));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  return concat(salt, rs, new Uint8Array([ephPubRaw.length]), ephPubRaw, ct);
}

// ── Send one push ─────────────────────────────────────────────────────────────

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPub: string,
  vapidPriv: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await makeVapidJwt(audience, vapidSubject, vapidPub, vapidPriv);
  const body = await encryptPayload(payload, p256dh, auth);

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${vapidPub}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: accept either a valid Supabase JWT OR the cron secret header.
  // The cron secret approach lets pg_cron call this without a user JWT.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";

  const isValidCronSecret = CRON_SECRET && cronHeader === CRON_SECRET;
  const isValidJwt = authHeader.startsWith("Bearer ");

  if (!isValidCronSecret && !isValidJwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@fenowa.app";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log("VAPID_PUBLIC_KEY length:", VAPID_PUBLIC_KEY?.length);
  console.log("VAPID_PRIVATE_KEY length:", VAPID_PRIVATE_KEY?.length);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");

  if (error) {
    console.error("DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Subscriptions found:", subs.length);

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const payload = JSON.stringify({
    title: msg.title, body: msg.body,
    url: "/transactions", icon: "/android-chrome-192x192.png",
  });

  let sent = 0, failed = 0;
  const expired: string[] = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      const res = await sendPush(
        sub.endpoint, sub.p256dh, sub.auth,
        payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
      );
      const resText = await res.text();
      console.log("Push status:", res.status, resText.substring(0, 100));

      if (res.ok || res.status === 201) {
        sent++;
      } else if (res.status === 410 || res.status === 404) {
        expired.push(sub.endpoint);
        failed++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error("Push error:", e);
      failed++;
    }
  }));

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  console.log(`sent=${sent} failed=${failed} total=${subs.length}`);
  return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
