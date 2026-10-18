import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { seed, validate, uid } from "./domain.mjs";
import { openDriver, deadline } from "./drivers.mjs";
export class Gateway {
  constructor(
    directory,
    {
      driverFactory = openDriver,
      clock = () => Date.now(),
      fetchImpl = globalThis.fetch,
    } = {},
  ) {
    this.directory = directory;
    this.factory = driverFactory;
    this.fetch = fetchImpl;
    this.clock = clock;
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(join(directory, "gateway.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,saved TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS samples(sequence INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,plc TEXT NOT NULL,sensor TEXT NOT NULL,observed TEXT NOT NULL,body TEXT NOT NULL,delivery TEXT NOT NULL DEFAULT 'pending',reason TEXT);
 CREATE INDEX IF NOT EXISTS sample_sensor ON samples(plc,sensor,sequence DESC);
 CREATE INDEX IF NOT EXISTS sample_delivery ON samples(delivery,sequence);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    const row = this.db
      .prepare("SELECT body FROM revisions ORDER BY rowid DESC LIMIT 1")
      .get();
    this.config = row ? JSON.parse(row.body) : this.apply(seed());
    this.started = new Date().toISOString();
    this.states = new Map();
    this.jobs = new Map();
    this.next = new Map();
    this.uploadState = "Cloud not configured · pending events retained";
    this.storageError = "";
    this.stopped = false;
    this.uploading = false;
    this.uploadFailures = 0;
    this.uploadNext = 0;
  }
  apply(config) {
    validate(config);
    const next = structuredClone(config);
    next.Revision = uid();
    this.db
      .prepare("INSERT INTO revisions VALUES(?,?,?)")
      .run(next.Revision, new Date().toISOString(), JSON.stringify(next));
    this.config = next;
    this.storageError = "";
    this.next?.clear();
    this.states?.clear();
    return next;
  }
  revisions() {
    return this.db
      .prepare(
        "SELECT id AS Revision,saved AS SavedUtc FROM revisions ORDER BY rowid DESC LIMIT 50",
      )
      .all();
  }
  restore(id) {
    const r = this.db.prepare("SELECT body FROM revisions WHERE id=?").get(id);
    if (!r) throw Error("Revision does not exist");
    return this.apply(JSON.parse(r.body));
  }
  append(m) {
    this.db
      .prepare(
        "INSERT INTO samples(event_id,plc,sensor,observed,body) VALUES(?,?,?,?,?)",
      )
      .run(m.EventId, m.PlcId, m.SensorId, m.ObservedAtUtc, JSON.stringify(m));
    return m;
  }
  history({
    before = Number.MAX_SAFE_INTEGER,
    limit = 100,
    plc = "",
    sensor = "",
    quality = "",
  } = {}) {
    let query =
      "SELECT sequence,body,delivery,reason FROM samples WHERE sequence<?";
    const args = [before];
    if (plc) {
      query += " AND plc=?";
      args.push(plc);
    }
    if (sensor) {
      query += " AND sensor=?";
      args.push(sensor);
    }
    if (quality) {
      query += " AND json_extract(body,'$.Quality')=?";
      args.push(quality);
    }
    query += " ORDER BY sequence DESC LIMIT ?";
    args.push(Math.max(1, Math.min(Number(limit) || 100, 10000)));
    return this.db
      .prepare(query)
      .all(...args)
      .map((r) => ({
        Sequence: r.sequence,
        Measurement: JSON.parse(r.body),
        Delivery: r.delivery,
        Reason: r.reason,
      }));
  }
  live() {
    return this.config.Plcs.flatMap((p) =>
      p.Sensors.map((s) => {
        const row = this.db
          .prepare(
            "SELECT body FROM samples WHERE plc=? AND sensor=? ORDER BY sequence DESC LIMIT 1",
          )
          .get(p.Id, s.Id);
        if (!row)
          return {
            PlcId: p.Id,
            SensorId: s.Id,
            Name: s.Name,
            Address: s.Address,
            Value: null,
            Raw: null,
            Unit: s.Unit,
            Quality: p.Enabled ? "Waiting" : "Disabled",
            ObservedAtUtc: null,
            RawHex: "",
            Detail: "No persisted observation",
          };
        const m = JSON.parse(row.body);
        let q = m.Quality;
        if (!p.Enabled) q = "Disabled";
        else if (
          m.ConfigRevision !== this.config.Revision ||
          this.clock() - Date.parse(m.ObservedAtUtc) >
            Math.max(p.PollMs * 3, p.TimeoutMs * p.Sensors.length + 1000)
        )
          q = "Stale";
        return {
          ...m,
          Name: s.Name,
          Address: s.Address,
          Raw: m.RawValue,
          Quality: q,
          Detail: m.Error ?? "",
        };
      }),
    );
  }
  health() {
    const counts = this.db
      .prepare(
        "SELECT count(*) AS Total,sum(delivery='pending') AS Pending,sum(delivery='quarantined') AS Quarantined,sum(delivery='acknowledged') AS Acknowledged FROM samples",
      )
      .get();
    const pages =
      this.db.prepare("PRAGMA page_count").get().page_count *
      this.db.prepare("PRAGMA page_size").get().page_size;
    return {
      State: this.storageError
        ? "StoragePaused"
        : this.config.Plcs.some((p) => p.Enabled)
          ? "Running"
          : "Ready",
      StartedUtc: this.started,
      Revision: this.config.Revision,
      Buffer: {
        ...counts,
        Pending: counts.Pending ?? 0,
        Quarantined: counts.Quarantined ?? 0,
        Acknowledged: counts.Acknowledged ?? 0,
        UsedBytes: pages,
      },
      Upload: this.uploadState,
      StorageError: this.storageError,
      Plcs: this.config.Plcs.map((p) => ({
        PlcId: p.Id,
        State: !p.Enabled
          ? "Disabled"
          : (this.states.get(p.Id)?.State ?? "Waiting"),
        Detail: this.states.get(p.Id)?.Detail ?? "No connection attempted",
        CycleMs: this.states.get(p.Id)?.CycleMs ?? 0,
        UpdatedUtc: this.states.get(p.Id)?.UpdatedUtc ?? null,
      })),
      Protocols: 7,
    };
  }
  async collect(p, test = false) {
    if (this.jobs.has(p.Id))
      throw Error(
        "Controller is busy. Try again after the current acquisition cycle.",
      );
    const config = structuredClone(this.config),
      saved = config.Plcs.find((x) => x.Id === p.Id);
    if (!saved) throw Error("Save this controller before testing.");
    if (test) {
      saved.Enabled = true;
      validate({ ...config, Plcs: [saved] });
    }
    const run = (async () => {
      const start = this.clock();
      let driver, connectError;
      try {
        driver = await deadline(
          this.factory(saved, this.directory),
          saved.TimeoutMs + 1000,
        );
      } catch (e) {
        connectError = e;
      }
      let first;
      let cycleProblem = null;
      try {
        for (const s of test ? saved.Sensors.slice(0, 1) : saved.Sensors) {
          if (this.stopped || this.config.Revision !== config.Revision) break;
          if (
            this.health().Buffer.UsedBytes >=
            config.MaxBufferMb * 1024 * 1024
          ) {
            this.storageError =
              "Buffer capacity reached. Collection paused; pending records retained.";
            break;
          }
          let raw = null,
            value = null,
            hex = "",
            quality = "Good",
            error = null,
            sourceAt = null;
          try {
            if (connectError) throw connectError;
            const r = await driver.read(s);
            raw = r.raw;
            hex = r.hex ?? "";
            sourceAt = r.sourceAt ?? null;
            if (s.Type === "Bool") {
              if (typeof raw !== "boolean")
                throw Error("BadDecode: expected Boolean");
              value = raw;
            } else {
              if (!Number.isFinite(raw))
                throw Error("BadDecode: expected finite scalar");
              const ranges = {
                Int16: [-32768, 32767],
                UInt16: [0, 65535],
                Int32: [-2147483648, 2147483647],
                UInt32: [0, 4294967295],
              };
              if (
                ranges[s.Type] &&
                (!Number.isInteger(raw) ||
                  raw < ranges[s.Type][0] ||
                  raw > ranges[s.Type][1])
              )
                throw Error(
                  "BadDecode: declared numeric type does not match response",
                );
              value = raw * s.Scale + s.Offset;
              if (!Number.isFinite(value))
                throw Error("BadDecode: non-finite engineering value");
              if (
                (s.Min !== null && value < s.Min) ||
                (s.Max !== null && value > s.Max)
              ) {
                quality = "UncertainRange";
                error = "Outside configured engineering limits";
              }
            }
          } catch (e) {
            const prefix = /^(Bad\w+):/.exec(e.message ?? "");
            quality = prefix?.[1] ?? "BadCommunication";
            error = String(e.message ?? e).slice(0, 500);
            value = null;
            raw = null;
            hex = "";
          }
          const m = {
            EventId: uid(),
            SiteId: config.SiteId,
            PlcId: saved.Id,
            SensorId: s.Id,
            ConfigRevision: config.Revision,
            ObservedAtUtc: new Date(this.clock()).toISOString(),
            SourceAtUtc: sourceAt,
            RawValue: raw,
            Value: value,
            Unit: s.Unit,
            Quality: quality,
            Error: error,
            RawHex: hex,
          };
          this.append(m);
          first ??= m;
          if (quality !== "Good") cycleProblem = { quality, error };
          if (this.config.Revision === config.Revision)
            this.states.set(p.Id, {
              State: cycleProblem
                ? cycleProblem.quality.startsWith("Bad")
                  ? "Disconnected"
                  : "Attention"
                : "Connected",
              Detail: cycleProblem?.error ?? "Read-only acquisition",
              CycleMs: this.clock() - start,
              UpdatedUtc: m.ObservedAtUtc,
            });
        }
        return first;
      } finally {
        if (driver) await driver.close().catch(() => {});
      }
    })();
    this.jobs.set(p.Id, run);
    try {
      return await run;
    } finally {
      this.jobs.delete(p.Id);
      this.next.set(p.Id, this.clock() + saved.PollMs);
    }
  }
  start() {
    this.timer = setInterval(() => {
      if (this.storageError) return;
      for (const p of this.config.Plcs) {
        if (
          p.Enabled &&
          !this.jobs.has(p.Id) &&
          this.clock() >= (this.next.get(p.Id) ?? 0)
        ) {
          if (
            p.ProfileId === "modbus-rtu" &&
            this.config.Plcs.some(
              (q) =>
                q.Id !== p.Id &&
                q.ProfileId === "modbus-rtu" &&
                q.Connection.SerialPath === p.Connection.SerialPath &&
                this.jobs.has(q.Id),
            )
          )
            continue;
          this.collect(p).catch((e) => {
            this.storageError = "Storage/acquisition error: " + e.message;
          });
        }
      }
      if (this.clock() >= this.uploadNext) this.upload().catch(() => {});
    }, 200);
    this.timer.unref();
  }
  retry() {
    const r = this.db
      .prepare(
        "UPDATE samples SET delivery='pending',reason=NULL WHERE delivery='quarantined'",
      )
      .run();
    this.uploadNext = 0;
    return { Retried: Number(r.changes) };
  }
  async upload() {
    if (this.uploading) return;
    this.uploading = true;
    const config = structuredClone(this.config);
    try {
      this.uploadNext = this.clock() + 5000;
      this.db
        .prepare(
          "DELETE FROM samples WHERE delivery='acknowledged' AND observed<?",
        )
        .run(
          new Date(
            this.clock() - config.RetentionDays * 86400000,
          ).toISOString(),
        );
      if (!config.CloudUrl) {
        this.uploadState = "Local buffer · cloud not configured";
        return;
      }
      const token = process.env.ARCADEOT_CLOUD_TOKEN;
      if (!token) {
        this.uploadState = "Set ARCADEOT_CLOUD_TOKEN on the gateway";
        return;
      }
      const rows = this.db
        .prepare(
          "SELECT body FROM samples WHERE delivery='pending' ORDER BY sequence LIMIT 100",
        )
        .all()
        .map((r) => JSON.parse(r.body));
      if (!rows.length) {
        this.uploadState = "No pending events";
        return;
      }
      const response = await this.fetch(config.CloudUrl, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ schemaVersion: 1, measurements: rows }),
        signal: AbortSignal.timeout(20000),
      });
      if ([400, 403, 409, 422].includes(response.status)) {
        const q = this.db.prepare(
          "UPDATE samples SET delivery='quarantined',reason=? WHERE event_id=?",
        );
        this.db.exec("BEGIN");
        try {
          for (const r of rows) q.run("HTTP " + response.status, r.EventId);
          this.db.exec("COMMIT");
        } catch (e) {
          this.db.exec("ROLLBACK");
          throw e;
        }
        this.uploadState =
          "Rejected batch preserved in quarantine · HTTP " + response.status;
        return;
      }
      if (!response.ok) throw Error("HTTP " + response.status);
      const bytes = [];
      let count = 0;
      for await (const chunk of response.body) {
        count += chunk.length;
        if (count > 100000) throw Error("Oversized acknowledgment response");
        bytes.push(chunk);
      }
      const ack = JSON.parse(Buffer.concat(bytes).toString()).acceptedEventIds,
        allowed = new Set(rows.map((r) => r.EventId));
      if (
        !Array.isArray(ack) ||
        new Set(ack).size !== ack.length ||
        ack.some((id) => !allowed.has(id))
      )
        throw Error("Invalid acknowledgment IDs");
      this.db.exec("BEGIN");
      try {
        const stmt = this.db.prepare(
          "UPDATE samples SET delivery='acknowledged',reason=NULL WHERE event_id=?",
        );
        for (const id of ack) stmt.run(id);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
      this.uploadState = `${ack.length}/${rows.length} events acknowledged`;
      this.uploadFailures = 0;
      this.storageError = "";
    } catch (e) {
      this.uploadFailures = Math.min(6, this.uploadFailures + 1);
      this.uploadNext =
        this.clock() + Math.min(300000, 5000 * 2 ** this.uploadFailures);
      this.uploadState =
        "Delivery unavailable · records retained · " + e.message;
    } finally {
      this.uploading = false;
    }
  }
  async close() {
    this.stopped = true;
    clearInterval(this.timer);
    await Promise.allSettled(this.jobs.values());
    this.db.close();
  }
}
