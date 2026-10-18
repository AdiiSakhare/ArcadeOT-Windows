import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Gateway } from "../server/gateway.mjs";
const measurement = (id) => ({
  EventId: id,
  SiteId: "fixture-site",
  PlcId: "p",
  SensorId: "s",
  ConfigRevision: "fixture",
  ObservedAtUtc: new Date().toISOString(),
  SourceAtUtc: null,
  RawValue: 12,
  Value: 12,
  Unit: "bar",
  Quality: "Good",
  Error: null,
  RawHex: "0C00",
});
test("cloud delivery accepts only explicit sent IDs; partial ACK and failures retain stable events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "arcade-delivery-"));
  let status = 200,
    ack = ["event-a"];
  const calls = [];
  const prior = process.env.ARCADEOT_CLOUD_TOKEN;
  process.env.ARCADEOT_CLOUD_TOKEN = "isolated-test-token";
  const g = new Gateway(directory, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ acceptedEventIds: ack }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  try {
    g.apply({
      ...g.config,
      CloudUrl: "https://fixture.example/v1/measurements:ingest",
    });
    g.append(measurement("event-a"));
    g.append(measurement("event-b"));
    await g.upload();
    assert.equal(g.health().Buffer.Acknowledged, 1);
    assert.equal(g.health().Buffer.Pending, 1);
    assert.deepEqual(
      JSON.parse(calls[0].options.body).measurements.map((m) => m.EventId),
      ["event-a", "event-b"],
    );
    ack = ["unsent-id"];
    await g.upload();
    assert.equal(g.health().Buffer.Pending, 1);
    assert.match(g.health().Upload, /Invalid acknowledgment/);
    assert.equal(
      JSON.parse(calls[1].options.body).measurements[0].EventId,
      "event-b",
    );
    status = 401;
    await g.upload();
    assert.equal(g.health().Buffer.Pending, 1);
    status = 409;
    await g.upload();
    assert.equal(g.health().Buffer.Quarantined, 1);
    assert.equal(g.health().Buffer.Pending, 0);
    assert.equal(g.retry().Retried, 1);
    assert.equal(g.health().Buffer.Pending, 1);
    status = 200;
    ack = ["event-b"];
    await g.upload();
    assert.equal(g.health().Buffer.Acknowledged, 2);
    assert.equal(g.health().Buffer.Pending, 0);
  } finally {
    if (prior === undefined) delete process.env.ARCADEOT_CLOUD_TOKEN;
    else process.env.ARCADEOT_CLOUD_TOKEN = prior;
    await g.close();
    await rm(directory, { recursive: true, force: true });
  }
});
