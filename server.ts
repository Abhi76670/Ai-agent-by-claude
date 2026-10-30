import express from "express";
import { exec } from "node:child_process";
import { mkdtemp, writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

// >>> Apni Gemini API key yaha daalo (sirf server pe rehti hai, browser me nahi jaati)
const API_KEY = process.env.GEMINI_API_KEY || "PASTE_YOUR_KEY_HERE";
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];

const SYSTEM = `You are an AI app builder inside a dashboard, with your own terminal. Projects are simple React 18 apps with NO build step and NO imports/exports.
Files are plain scripts run in the browser with Babel; React and ReactDOM are globals (use React.useState etc, never import).
Always have src/App.jsx defining function App(). Extra components go in other src/*.jsx files (loaded alphabetically, App.jsx last). Styles go in src/styles.css.

OUTPUT FORMAT (never wrap these tags in markdown code fences):
- Write or edit a file (FULL content each time): <file path="src/App.jsx">...content...</file>
- Delete a file: <delete path="src/Old.jsx"/>
- Run a terminal command (curl, ls, cat, node...): <run>curl -s https://example.com</run>. After <run> tags STOP writing and wait: the output comes back next turn in <result> tags, then continue.
- Everything outside tags is your reply to the user. Decide the best format yourself (one-line answer, short summary, steps, explanation), whatever helps this user most.
You are given the current project files: only write files that need to change and never forget what the project already contains.
If the user only asks a question or chats, answer in plain text and do not write files.
BEFORE building, think about what the app really needs: audience, sections or screens, believable realistic content (never lorem ipsum) and a distinctive visual style. Then build a complete, polished result. A build is complete only when BOTH src/App.jsx and src/styles.css exist. If the request is very vague, still build a good first version and end your reply by asking 1-2 specific questions (for example school name, colors).
ALWAYS finish with a short reply to the user in the language they write in (Hinglish if they write Hinglish): what you built or fixed and what to try next. Never end a turn with only files.
PROJECT FILES YOU MAINTAIN: requirements.md (create it first for a new project, update when needs change) and memory.md (update after every build or edit: decisions, files and their purpose, done, todo). Write every file the project needs, edit only what must change, and keep all files consistent. Apps must be responsive and keep user data in localStorage. The user may attach images or videos as reference: study them and recreate the design.`;

function parser(emit: (e: any) => void, onRun: (c: string) => void) {
  let buf = "", mode = "text", cur = "";
  const hold = (close: string) => { for (let n = Math.min(close.length - 1, buf.length); n > 0; n--) if (close.startsWith(buf.slice(-n))) return n; return 0; };
  const pump = () => {
    for (;;) {
      if (mode === "text") {
        const i = buf.indexOf("<");
        if (i < 0) { if (buf) emit({ type: "text", text: buf }); buf = ""; return; }
        if (i > 0) { emit({ type: "text", text: buf.slice(0, i) }); buf = buf.slice(i); }
        let m = buf.match(/^<file path="([^"]+)">\n?/);
        if (m) { mode = "file"; cur = m[1]; buf = buf.slice(m[0].length); emit({ type: "file", op: "write", path: cur, status: "start" }); continue; }
        m = buf.match(/^<delete path="([^"]+)"\s*\/>/);
        if (m) { buf = buf.slice(m[0].length); emit({ type: "file", op: "delete", path: m[1], status: "start" }); emit({ type: "file", op: "delete", path: m[1], status: "done" }); continue; }
        if (buf.startsWith("<run>")) { mode = "run"; cur = ""; buf = buf.slice(5); continue; }
        if (!buf.includes(">") && buf.length < 200) return;
        emit({ type: "text", text: "<" }); buf = buf.slice(1); continue;
      }
      const close = mode === "file" ? "</file>" : "</run>";
      const j = buf.indexOf(close);
      if (j < 0) {
        const k = hold(close), out = buf.slice(0, buf.length - k); buf = buf.slice(buf.length - k);
        if (mode === "file") { if (out) emit({ type: "file", op: "write", path: cur, status: "chunk", content: out }); } else cur += out;
        return;
      }
      const out = buf.slice(0, j); buf = buf.slice(j + close.length);
      if (mode === "file") { if (out) emit({ type: "file", op: "write", path: cur, status: "chunk", content: out }); emit({ type: "file", op: "write", path: cur, status: "done" }); }
      else onRun((cur + out).trim());
      mode = "text";
    }
  };
  return { push(s: string) { buf += s; pump(); }, end() { if (mode === "text" && buf) emit({ type: "text", text: buf }); buf = ""; } };
}

// >>> NVIDIA key (build.nvidia.com, nvapi-...) yaha daalo, ya NVIDIA_API_KEY env set karo
const NV_KEY = process.env.NVIDIA_API_KEY || "PASTE_NVIDIA_KEY_HERE";

async function skills() { // skills/<name>/SKILL.md sab models ke prompt me jaate hain
  let s = "";
  try { for (const d of await readdir("skills", { withFileTypes: true })) if (d.isDirectory()) s += `\n\n## SKILL: ${d.name}\n` + (await readFile(join("skills", d.name, "SKILL.md"), "utf8")); } catch {}
  return s;
}
const toOpenAI = (system: string, contents: any[]) => [{ role: "system", content: system }, ...contents.map((c) => {
  const imgs = c.parts.filter((p: any) => p.inline_data?.mime_type?.startsWith("image/"));
  const text = c.parts.filter((p: any) => p.text != null).map((p: any) => p.text).join("");
  return { role: c.role === "model" ? "assistant" : "user", content: imgs.length ? [{ type: "text", text }, ...imgs.map((p: any) => ({ type: "image_url", image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } }))] : text };
})];
const nvFetch = (m: string, system: string, contents: any[]) => fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST", headers: { Authorization: `Bearer ${NV_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: m, messages: toOpenAI(system, contents), stream: true, max_tokens: 16384, temperature: 0.6 }),
});
const nvParts = (j: any) => { const d = j.choices?.[0]?.delta || {}; const o: any[] = []; if (d.reasoning_content) o.push({ thought: true, text: d.reasoning_content }); if (d.content) o.push({ text: d.content }); return o; };

const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(express.static("public"));
app.get("/api/models", async (_q, res) => {
  let nvidia: string[] = [];
  try {
    const j: any = await (await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${NV_KEY}` } })).json();
    nvidia = (j.data || []).map((x: any) => x.id).filter((id: string) => !/embed|rerank|clip|guard|safety|parse|retriev|ocr|riva|tts|asr/i.test(id)).sort();
  } catch {}
  res.json({ gemini: MODELS, nvidia });
});

app.post("/api/agent", async (req, res) => {
  const { model, messages, files, attachments } = req.body;
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (o: any) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  const fsm: Record<string, string> = { ...(files || {}) }, acc: Record<string, string> = {};
  const project = Object.entries(fsm).map(([p, c]) => `--- ${p} ---\n${c}`).join("\n") || "(no files yet)";
  const system = `${SYSTEM}${await skills()}\n\nCurrent project files:\n${project}`;
  const contents: any[] = messages.map((m: any) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
  const nv = typeof model === "string" && model.startsWith("nvidia:");
  const m = nv ? model.slice(7) : MODELS.includes(model) ? model : MODELS[0];
  if (attachments?.length) contents[contents.length - 1].parts.push(...attachments.map((a: any) => ({ inline_data: { mime_type: a.mime, data: a.data } })));
  const dir = await mkdtemp(join(tmpdir(), "aib-"));
  let nid = 0;
  try {
    for (let turn = 0; turn < 6; turn++) {
      const runs: { id: number; c: string }[] = [];
      let wrote = false, saw = false;
      const P = parser((e) => {
        if (e.type === "file" && e.op === "write") { if (e.status === "start") acc[e.path] = ""; else if (e.status === "chunk") acc[e.path] += e.content; else fsm[e.path] = acc[e.path]; }
        if (e.type === "file" && e.op === "delete" && e.status === "done") delete fsm[e.path];
        if (e.type === "file" && e.status === "done") wrote = true;
        if (e.type === "text" && e.text.trim()) saw = true;
        send(e);
      }, (c) => { const id = ++nid; runs.push({ id, c }); send({ type: "cmd", id, cmd: c, status: "start" }); });
      const r = nv ? await nvFetch(m, system, contents) : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`, {
        method: "POST", headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { thinkingConfig: { includeThoughts: true } } }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as any)?.error?.message || r.statusText);
      const dec = new TextDecoder(); let sb = "", raw = "";
      for await (const chunk of r.body as any) {
        sb += dec.decode(chunk, { stream: true });
        const lines = sb.split("\n"); sb = lines.pop()!;
        for (const ln of lines) {
          if (!ln.startsWith("data:")) continue;
          let j: any; try { j = JSON.parse(ln.slice(5)); } catch { continue; }
          for (const p of nv ? nvParts(j) : j.candidates?.[0]?.content?.parts || []) {
            if (p.thought) { const t = p.text || ""; send({ type: "thought", text: t, heading: (t.match(/\*\*(.+?)\*\*/) || [])[1] }); }
            else if (p.text) { raw += p.text; P.push(p.text); }
          }
        }
      }
      P.end();
      if (!runs.length) {
        const nudge = wrote && !fsm["src/App.jsx"]
          ? "src/App.jsx is missing, so the app cannot run. Write the full src/App.jsx now, then reply to the user briefly."
          : !saw ? "Now reply to the user in 2-3 short lines: what you built or answered, and what to try next." : "";
        if (!nudge || turn >= 4) break;
        contents.push({ role: "model", parts: [{ text: raw.trim() || "(no reply)" }] }, { role: "user", parts: [{ text: nudge }] });
        continue;
      }
      for (const f in fsm) { if (f.includes("..") || f.startsWith("/")) continue; const fp = join(dir, f); await mkdir(dirname(fp), { recursive: true }); await writeFile(fp, fsm[f]); }
      let results = "";
      for (const { id, c } of runs) {
        const out = await new Promise<string>((ok) => exec(c, { cwd: dir, timeout: 30000, maxBuffer: 2e6 }, (err, so, se) => ok(((so || "") + (se || "") + (err && !so && !se ? err.message : "")).slice(0, 8000) || "(no output)")));
        send({ type: "cmd", id, status: "done", out });
        results += `<result cmd="${c}">\n${out}\n</result>\n`;
      }
      contents.push({ role: "model", parts: [{ text: raw }] }, { role: "user", parts: [{ text: results }] });
    }
  } catch (e: any) { send({ type: "error", text: e.message }); }
  send({ type: "done" });
  res.end();
});

// 127.0.0.1 only: terminal commands sirf tumhare device se hi chal sakte hain
app.listen(3000, "127.0.0.1", () => console.log("Open http://localhost:3000"));
