// Likes + guestbook for yuchenhou.me — Cloudflare Worker + KV.
//
//   GET  /likes?ids=a,b,c        -> { counts: {a: n, ...} }
//   GET  /notes?id=home&limit=20 -> { notes: [{name, text, ts}, ...] }
//   POST /like  {id, name?, email?, text?}  -> { count, liked: true }
//   POST /unlike {id}                       -> { count, liked: false }
//        a note (text) is accepted only with name + valid email; e-mail is
//        stored for accountability but never returned by the API
//
// Anonymous by default. One like per id per visitor per day (keyed by a
// hashed IP, TTL 24h). Notes are capped (name 40 chars, text 140 chars), HTML
// stripped, last 200 kept per id.

const ALLOWED_ORIGINS = ["https://yuchenhou.me", "https://www.yuchenhou.me", "https://yc11hou.github.io", "http://localhost:8765", "http://localhost:8790"];
const ID_RE = /^[a-z0-9:_-]{1,64}$/i;

function cors(req) {
  const origin = req.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, req, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(req) },
  });
}

async function sha(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const clean = (s, max) =>
  String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });

    if (req.method === "GET" && url.pathname === "/likes") {
      const ids = (url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => ID_RE.test(s)).slice(0, 50);
      const counts = {};
      await Promise.all(ids.map(async (id) => { counts[id] = parseInt((await env.LIKES.get("count:" + id)) || "0", 10); }));
      return json({ counts }, req);
    }

    if (req.method === "GET" && url.pathname === "/notes") {
      const id = url.searchParams.get("id") || "";
      if (!ID_RE.test(id)) return json({ error: "bad id" }, req, 400);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
      const notes = JSON.parse((await env.LIKES.get("notes:" + id)) || "[]");
      return json({ notes: notes.slice(0, limit).map((n) => ({ name: n.name, text: n.text, ts: n.ts })) }, req);
    }

    if (req.method === "POST" && url.pathname === "/like") {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: "bad json" }, req, 400); }
      const id = String(body.id || "");
      if (!ID_RE.test(id)) return json({ error: "bad id" }, req, 400);
      const ip = req.headers.get("CF-Connecting-IP") || "0";
      const visitor = await sha(ip + "|" + (req.headers.get("User-Agent") || ""));
      const guard = "seen:" + id + ":" + visitor;
      const already = await env.LIKES.get(guard);

      const name = clean(body.name, 40);
      const text = clean(body.text, 140);
      const email = clean(body.email, 80).toLowerCase();
      // A note is only accepted with a real-looking name and e-mail; likes stay anonymous.
      if (text && (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))) {
        return json({ error: "name and email required for a note" }, req, 422);
      }
      let count = parseInt((await env.LIKES.get("count:" + id)) || "0", 10);

      if (!already) {
        count += 1;
        await env.LIKES.put("count:" + id, String(count));
        await env.LIKES.put(guard, "1", { expirationTtl: 86400 });
      }
      if (text) {
        // one note per visitor per id per day, so a form resubmit can't spam
        const noteGuard = "noted:" + id + ":" + visitor;
        if (!(await env.LIKES.get(noteGuard))) {
          const notes = JSON.parse((await env.LIKES.get("notes:" + id)) || "[]");
          notes.unshift({ name, text, ts: Date.now(), email, ip: visitor });
          await env.LIKES.put("notes:" + id, JSON.stringify(notes.slice(0, 200)));
          await env.LIKES.put(noteGuard, "1", { expirationTtl: 86400 });
        }
      }
      return json({ count, liked: true }, req);
    }

    if (req.method === "POST" && url.pathname === "/unlike") {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: "bad json" }, req, 400); }
      const id = String(body.id || "");
      if (!ID_RE.test(id)) return json({ error: "bad id" }, req, 400);
      const ip = req.headers.get("CF-Connecting-IP") || "0";
      const visitor = await sha(ip + "|" + (req.headers.get("User-Agent") || ""));
      const guard = "seen:" + id + ":" + visitor;
      let count = parseInt((await env.LIKES.get("count:" + id)) || "0", 10);
      if (await env.LIKES.get(guard)) {
        count = Math.max(0, count - 1);
        await env.LIKES.put("count:" + id, String(count));
        await env.LIKES.delete(guard);
      }
      return json({ count, liked: false }, req);
    }

    return json({ error: "not found" }, req, 404);
  },
};
