import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { Gateway } from "./gateway.mjs";
import {
  profiles,
  controller,
  sensor,
  generate,
  parseCsv,
  validate,
  overlaps,
  csv,
} from "./domain.mjs";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function createServer({
  dataDir = resolve(root, ".data"),
  collect = true,
} = {}) {
  const gateway = new Gateway(dataDir);
  if (collect) gateway.start();
  const server = http.createServer(async (req, res) => {
    const json = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (path.startsWith("/api/")) {
        if (req.headers["sec-fetch-site"] === "cross-site")
          return json({ Error: "Cross-site API access denied" }, 403);
        if (req.headers["x-arcadeot-web"] !== "1")
          return json(
            { Error: "Required gateway request header missing" },
            403,
          );
        const token = process.env.ARCADEOT_WEB_TOKEN;
        if (token) {
          const supplied = String(req.headers.authorization ?? "").replace(
            /^Bearer /,
            "",
          );
          const a = Buffer.from(supplied),
            b = Buffer.from(token);
          if (a.length !== b.length || !timingSafeEqual(a, b))
            return json({ Error: "Gateway access key required" }, 401);
        }
        const read = async () => {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 2000000) {
              const error = Error("Request exceeds 2 MB");
              error.status = 413;
              throw error;
            }
            chunks.push(chunk);
          }
          return chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString())
            : {};
        };
        if (req.method === "GET") {
          if (path === "/api/health") return json(gateway.health());
          if (path === "/api/catalog") return json(profiles);
          if (path === "/api/defaults")
            return json({ Controller: controller(), Sensor: sensor() });
          if (path === "/api/config") return json(gateway.config);
          if (path === "/api/config/history") return json(gateway.revisions());
          if (path === "/api/live") return json(gateway.live());
          if (["/api/history", "/api/export.csv"].includes(path)) {
            const options = {
              before:
                Number(url.searchParams.get("before")) ||
                Number.MAX_SAFE_INTEGER,
              limit: path.endsWith(".csv")
                ? 10000
                : Number(url.searchParams.get("limit")) || 100,
              plc: url.searchParams.get("plc") ?? "",
              sensor: url.searchParams.get("sensor") ?? "",
              quality: url.searchParams.get("quality") ?? "",
            };
            const rows = gateway.history(options);
            if (path.endsWith(".csv")) {
              res.writeHead(200, {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="ArcadeOT-readings.csv"',
              });
              res.end(csv(rows));
              return;
            }
            return json(rows);
          }
        }
        if (req.method === "POST") {
          if (path === "/api/config") return json(gateway.apply(await read()));
          if (path === "/api/config/validate") {
            validate(await read());
            return json({ Valid: true });
          }
          if (path.startsWith("/api/config/restore/"))
            return json(gateway.restore(decodeURIComponent(path.slice(20))));
          if (path === "/api/quarantine/retry") return json(gateway.retry());
          if (path === "/api/upload") {
            await gateway.upload();
            return json(gateway.health());
          }
          if (/^\/api\/plcs\/[^/]+\/test$/.test(path)) {
            const id = decodeURIComponent(path.split("/")[3]),
              p = gateway.config.Plcs.find((p) => p.Id === id);
            if (!p) throw Error("Save this controller first");
            const m = await gateway.collect(p, true);
            if (!m) throw Error("No sample was collected");
            return json(m);
          }
          if (path === "/api/sensors/preview") {
            const body = await read();
            const Sensors =
              body.Csv !== undefined
                ? parseCsv(body.Csv)
                : generate({
                    ...body.Group,
                    Protocol: body.Controller?.ProfileId,
                  });
            const p = controller({
              ...body.Controller,
              Sensors: [...(body.Controller?.Sensors ?? []), ...Sensors],
            });
            validate({ ...gateway.config, Plcs: [p] });
            let Warnings = [];
            if (p.ProfileId === "slmp") Warnings = overlaps(p.Sensors);
            return json({ Sensors, Warnings });
          }
        }
        return json({ Error: "API route not found" }, 404);
      }
      if (!["GET", "HEAD"].includes(req.method))
        return json({ Error: "Method not allowed" }, 405);
      let file = resolve(root, "dist", "." + decodeURIComponent(path));
      const dist = resolve(root, "dist");
      if (!file.startsWith(dist + sep)) file = resolve(dist, "index.html");
      try {
        if (!(await stat(file)).isFile()) file = resolve(dist, "index.html");
      } catch {
        file = resolve(dist, "index.html");
      }
      try {
        const bytes = await readFile(file);
        res.writeHead(200, {
          "Content-Type":
            {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript",
              ".css": "text/css",
              ".svg": "image/svg+xml",
              ".woff2": "font/woff2",
            }[extname(file)] ?? "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "same-origin",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
      } catch {
        json(
          {
            Error:
              "Build the React app with npm run build, or use npm run dev.",
          },
          503,
        );
      }
    } catch (e) {
      if (!res.headersSent) json({ Error: e.message }, e.status ?? 400);
      else res.end();
    }
  });
  return { server, gateway };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const host = process.env.HOST ?? "127.0.0.1",
    port = Number(process.env.PORT ?? 3001);
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) &&
    !process.env.ARCADEOT_WEB_TOKEN
  )
    throw Error(
      "Set ARCADEOT_WEB_TOKEN before exposing the gateway beyond loopback. Use TLS at your reverse proxy.",
    );
  const { server, gateway } = await createServer({
    dataDir: process.env.ARCADEOT_WEB_DATA_DIR,
  });
  server.listen(port, host, () =>
    console.log(
      `ArcadeOT real gateway: http://${host}:${port} · 7 protocol adapters · no simulated data`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      server.close();
      await gateway.close();
      process.exit();
    });
}
