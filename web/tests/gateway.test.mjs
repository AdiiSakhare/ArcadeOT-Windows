import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import dgram from "node:dgram";
import { Gateway } from "../server/gateway.mjs";
import { createServer } from "../server/index.mjs";
import { controller, sensor, seed } from "../server/domain.mjs";
import {
  slmpRequest,
  slmpResponse,
  decode,
  openDriver,
} from "../server/drivers.mjs";
const temporary = () => mkdtemp(join(tmpdir(), "arcade-web-test-"));
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );
const close = (server) => new Promise((resolve) => server.close(resolve));
const config = (
  Port,
  Sensors = [
    sensor({ Id: "temperature", Address: "D100", Scale: 0.1, Unit: "°C" }),
  ],
) => ({
  ...seed(),
  Plcs: [
    controller({
      Id: "fixture-plc",
      Name: "Test fixture",
      Model: "Protocol fixture",
      Host: "127.0.0.1",
      Port,
      Enabled: true,
      TimeoutMs: 300,
      Sensors,
    }),
  ],
});
const response = Buffer.from("d00000ffff030004000000d204", "hex");
test("SLMP request vectors and fragmented response decode use only batch read commands", async () => {
  const s = sensor({ Address: "D100" });
  assert.equal(
    slmpRequest(s).toString("hex"),
    "500000ffff03000c00100001040000640000a80100",
  );
  assert.equal(
    slmpRequest(s, "AsciiOctal").toString(),
    "500000FF03FF000018001004010000D*0001000001",
  );
  assert.equal(slmpResponse(response, s).raw, 1234);
  assert.equal(
    slmpResponse(Buffer.from("D00000FF03FF000008000004D2"), s, "AsciiOctal")
      .raw,
    1234,
  );
  const bad = Buffer.from(response);
  bad[9] = 0x51;
  assert.throws(() => slmpResponse(bad, s), /end code/);
  assert.throws(
    () =>
      decode(Buffer.from("0000c07f", "hex"), sensor({ Type: "Float32" }), true),
    /non-finite/,
  );
  assert.equal(
    decode(Buffer.from("0000803f", "hex"), sensor({ Type: "Float32" }), true),
    1,
  );
});
test("real SLMP TCP transport persists raw/scaled values, survives restart, and keeps failed reads null", async () => {
  const dir = await temporary();
  const requests = [];
  const peer = net.createServer((s) =>
    s.on("data", (b) => {
      requests.push(b);
      s.write(response.subarray(0, 5));
      setTimeout(() => s.end(response.subarray(5)), 5);
    }),
  );
  const port = await listen(peer);
  let g = new Gateway(dir);
  try {
    assert.equal(g.health().Buffer.Total, 0);
    const c = g.apply(config(port));
    const m = await g.collect(c.Plcs[0], true);
    assert.equal(m.RawValue, 1234);
    assert.equal(m.Value, 123.4);
    assert.equal(m.RawHex, "D204");
    assert.equal(m.Quality, "Good");
    assert.equal(m.SourceAtUtc, null);
    assert.equal(requests[0][11], 1);
    assert.equal(requests[0][12], 4);
    assert.equal(g.live()[0].Value, 123.4);
    const rev = c.Revision;
    assert.throws(() => g.apply({ ...c, RetentionDays: 0 }));
    assert.equal(g.config.Revision, rev);
    await g.close();
    g = new Gateway(dir);
    assert.equal(g.history()[0].Measurement.EventId, m.EventId);
    assert.equal(g.config.Revision, rev);
    const restored = g.restore(g.revisions().at(-1).Revision);
    assert.notEqual(restored.Revision, rev);
    assert.equal(g.history().length, 1);
    await close(peer);
    const broken = g.apply(config(port));
    const failure = await g.collect(broken.Plcs[0], true);
    assert.match(failure.Quality, /^Bad/);
    assert.equal(failure.Value, null);
    assert.equal(failure.RawValue, null);
    assert.equal(g.history().length, 2);
  } finally {
    await g.close();
    if (peer.listening) await close(peer);
    await rm(dir, { recursive: true, force: true });
  }
});
test("Modbus TCP uses FC3, exact unit ID and zero-based offset; scales actual register bytes", async () => {
  const requests = [];
  const peer = net.createServer((s) =>
    s.on("data", (req) => {
      requests.push(Buffer.from(req));
      const b = Buffer.from([0, 0, 0, 0, 0, 5, req[6], 3, 2, 0x09, 0xc4]);
      req.copy(b, 0, 0, 2);
      s.write(b);
    }),
  );
  const port = await listen(peer);
  let driver;
  try {
    const p = controller({
      ProfileId: "modbus-tcp",
      Host: "127.0.0.1",
      Port: port,
      TimeoutMs: 500,
    });
    p.Connection.UnitId = 7;
    driver = await openDriver(p, await temporary());
    const r = await driver.read(
      sensor({ Address: "holding:5", Type: "UInt16" }),
    );
    assert.equal(r.raw, 2500);
    assert.equal(r.hex, "09C4");
    assert.equal(requests[0][7], 3);
    assert.equal(requests[0][6], 7);
    assert.equal(requests[0].readUInt16BE(8), 5);
  } finally {
    await driver?.close();
    await close(peer);
  }
});
test("FINS UDP validates SID and routing and sends only memory area read", async () => {
  const socket = dgram.createSocket("udp4");
  await new Promise((resolve) => socket.bind(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  let captured;
  socket.on("message", (req, r) => {
    captured = Buffer.from(req);
    const b = Buffer.from([
      0xc0,
      0,
      2,
      req[6],
      req[7],
      req[8],
      req[3],
      req[4],
      req[5],
      req[9],
      1,
      1,
      0,
      0,
      0,
      42,
    ]);
    socket.send(b, r.port, r.address);
  });
  let driver;
  try {
    const p = controller({
      ProfileId: "fins",
      Host: "127.0.0.1",
      Port: port,
      TimeoutMs: 500,
    });
    driver = await openDriver(p, "/tmp");
    const r = await driver.read(sensor({ Address: "D100", Type: "UInt16" }));
    assert.equal(r.raw, 42);
    assert.equal(captured.subarray(10, 12).toString("hex"), "0101");
    assert.equal(captured[12], 0x82);
    assert.equal(captured.readUInt16BE(13), 100);
  } finally {
    await driver?.close();
    socket.close();
  }
});
test("TCP timeout is explicit and never produces a good zero reading", async () => {
  const sockets = new Set();
  const peer = net.createServer((s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  const port = await listen(peer);
  const dir = await temporary();
  const g = new Gateway(dir);
  try {
    const c = g.apply(config(port));
    const m = await g.collect(c.Plcs[0], true);
    assert.equal(m.Quality, "BadTimeout");
    assert.equal(m.Value, null);
    assert.equal(g.health().Plcs[0].State, "Disconnected");
  } finally {
    await g.close();
    sockets.forEach((s) => s.destroy());
    await close(peer);
    await rm(dir, { recursive: true, force: true });
  }
});
test("HTTP API validates atomically, previews imports without mutation, and exports provenance", async () => {
  const dir = await temporary();
  const { server, gateway } = await createServer({
    dataDir: dir,
    collect: false,
  });
  const port = await listen(server);
  const base = "http://127.0.0.1:" + port;
  const request = (path, method = "GET", body) =>
    fetch(base + "/api" + path, {
      method,
      headers: { "X-ArcadeOT-Web": "1", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await fetch(base + "/api/config")).status, 403);
    const original = await (await request("/config")).json();
    assert.equal(original.Plcs.length, 0);
    const invalid = await request("/config", "POST", {
      ...original,
      SiteId: null,
    });
    assert.equal(invalid.status, 400);
    assert.equal(gateway.config.Revision, original.Revision);
    const p = controller();
    const preview = await (
      await request("/sensors/preview", "POST", {
        Controller: p,
        Csv: "Name,Address\nTemperature,D100",
      })
    ).json();
    assert.equal(preview.Sensors.length, 1);
    assert.equal(gateway.config.Plcs.length, 0);
    const saved = await (
      await request("/config", "POST", {
        ...original,
        Plcs: [{ ...p, Sensors: preview.Sensors }],
      })
    ).json();
    assert.notEqual(saved.Revision, original.Revision);
    assert.equal((await request("/export.csv")).status, 200);
    const csv = await (await request("/export.csv")).text();
    assert.match(
      csv,
      /EventId,SiteId,PlcId,SensorId,ConfigRevision,ObservedAtUtc/,
    );
    assert.equal((await request("/catalog")).status, 200);
    assert.equal((await (await request("/catalog")).json()).length, 7);
    const restore = await request(
      "/config/restore/" + original.Revision,
      "POST",
    );
    assert.equal(restore.status, 200);
    assert.equal((await restore.json()).Plcs.length, 0);
  } finally {
    await close(server);
    await gateway.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "scheduled acquisition isolates controllers, continues without a browser and stops after disabling",
  { timeout: 5000 },
  async () => {
    const directory = await temporary();
    const peer = net.createServer((socket) =>
      socket.on("data", () => socket.end(response)),
    );
    const port = await listen(peer);
    const g = new Gateway(directory);
    const until = async (predicate) => {
      const end = Date.now() + 2500;
      while (!predicate()) {
        if (Date.now() > end)
          throw Error("Timed out waiting for gateway acquisition");
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    try {
      const c = config(port);
      c.Plcs[0].PollMs = 250;
      const offline = structuredClone(c.Plcs[0]);
      offline.Id = "offline-plc";
      offline.Name = "Offline controller";
      offline.Port = 1;
      c.Plcs.push(offline);
      g.apply(c);
      g.start();
      await until(
        () =>
          g.history().filter((r) => r.Measurement.PlcId === "fixture-plc")
            .length >= 2 &&
          g.history().filter((r) => r.Measurement.PlcId === "offline-plc")
            .length >= 2,
      );
      assert.equal(
        g.live().find((r) => r.PlcId === "fixture-plc").Quality,
        "Good",
      );
      assert.match(
        g.live().find((r) => r.PlcId === "offline-plc").Quality,
        /^Bad/,
      );
      assert.equal(
        g.health().Plcs.find((p) => p.PlcId === "fixture-plc").State,
        "Connected",
      );
      assert.equal(
        g.health().Plcs.find((p) => p.PlcId === "offline-plc").State,
        "Disconnected",
      );
      const disabled = structuredClone(g.config);
      disabled.Plcs.forEach((p) => (p.Enabled = false));
      g.apply(disabled);
      await until(() => g.jobs.size === 0);
      const total = g.health().Buffer.Total;
      await new Promise((r) => setTimeout(r, 450));
      assert.equal(g.health().Buffer.Total, total);
      assert.ok(g.live().every((r) => r.Quality === "Disabled"));
    } finally {
      await g.close();
      await close(peer);
      await rm(directory, { recursive: true, force: true });
    }
  },
);
