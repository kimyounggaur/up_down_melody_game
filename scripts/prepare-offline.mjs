import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(absolute) : [absolute];
    }),
  );
  return groups.flat();
}
const files = (await filesIn(out))
  .filter(
    (file) => !file.endsWith(`${path.sep}sw.js`) && !file.endsWith(".map"),
  )
  .sort();
const version = createHash("sha256");
const urls = [];
const routes = {};
let bytes = 0;
for (const file of files) {
  const relative = path.relative(out, file).split(path.sep).join("/");
  const data = await readFile(file);
  const url = "/" + relative.split("/").map(encodeURIComponent).join("/");
  version.update(relative).update(data);
  bytes += data.length;
  urls.push(url);
  if (relative.endsWith(".html")) {
    const clean =
      relative === "index.html"
        ? "/"
        : relative.endsWith("/index.html")
          ? "/" + relative.slice(0, -10)
          : "/" + relative.slice(0, -5) + "/";
    routes[clean] = { html: url };
    const rsc = file.replace(/\.html$/, ".txt");
    if (files.includes(rsc))
      routes[clean].rsc =
        "/" +
        path
          .relative(out, rsc)
          .split(path.sep)
          .map(encodeURIComponent)
          .join("/");
  }
}
const template = await readFile(path.join(root, "public", "sw.js"), "utf8");
version.update(template);
const revision = version.digest("hex").slice(0, 16);
const worker = template
  .replace("__BUILD_VERSION__", revision)
  .replace("[]; // __PRECACHE_FILES__", JSON.stringify(urls) + ";")
  .replace("{}; // __OFFLINE_ROUTES__", JSON.stringify(routes) + ";");
await writeFile(path.join(out, "sw.js"), worker);
console.log(
  `Offline cache ready: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB, revision ${revision}`,
);
