import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  validate,
  controller,
  sensor,
  generate,
  parseCsv,
  overlaps,
} from "../server/domain.mjs";
const configuration = (profile = "slmp", s = sensor()) => ({
  ...seed(),
  Plcs: [controller({ ProfileId: profile, Sensors: [s] })],
});
test("new installations have no controllers or fabricated observations", () => {
  const c = seed();
  assert.equal(c.Version, 3);
  assert.deepEqual(c.Plcs, []);
  validate(c);
});
test("validation rejects bad types, unknown fields, duplicate IDs and unsupported revisions", () => {
  for (const change of [
    (c) => (c.Version = 2),
    (c) => (c.Other = true),
    (c) => (c.SiteId = null),
    (c) => (c.MaxBufferMb = 1),
    (c) => (c.RetentionDays = Infinity),
    (c) => (c.Plcs = null),
  ]) {
    const c = seed();
    change(c);
    assert.throws(() => validate(c));
  }
  const c = configuration();
  c.Plcs.push(c.Plcs[0]);
  assert.throws(() => validate(c), /Duplicate controller/);
});
test("enabled hardware needs model, host, port and mapping; RTU needs serial path", () => {
  const p = controller({ Enabled: true });
  const c = { ...seed(), Plcs: [p] };
  assert.throws(() => validate(c));
  Object.assign(p, {
    Model: "FX5U-32MT/ES",
    Host: "192.0.2.10",
    Port: 5007,
    Sensors: [sensor()],
  });
  validate(c);
  p.ProfileId = "modbus-rtu";
  p.Sensors[0].Address = "holding:0";
  assert.throws(() => validate(c));
  p.Connection.SerialPath = "COM3";
  validate(c);
});
test("seven protocols validate their own address syntax and type", () => {
  const cases = [
    ["slmp", "D100", "Int16"],
    ["modbus-tcp", "holding:0", "UInt16"],
    ["modbus-rtu", "coil:3", "Bool"],
    ["opcua", "ns=2;s=Temperature", "Float32"],
    ["s7", "DB1,REAL0", "Float32"],
    ["cip", "Tank.Temperature", "Float32"],
    ["fins", "CIO0.0", "Bool"],
  ];
  for (const [profile, Address, Type] of cases) {
    const c = configuration(profile, sensor({ Address, Type }));
    if (profile === "cip") c.Plcs[0].Port = 44818;
    validate(c);
    c.Plcs[0].Sensors[0].Address = "invalid address";
    assert.throws(() => validate(c), profile);
  }
});
test("read-only addressing prevents bit/numeric mismatch, broadcasts, overflow and incorrect word swap", () => {
  for (const [profile, Address, Type] of [
    ["slmp", "X18", "Bool"],
    ["slmp", "M10", "Int16"],
    ["modbus-tcp", "holding:65535", "Int32"],
    ["s7", "DB1,REAL0", "Int16"],
    ["fins", "D100.16", "Bool"],
  ])
    assert.throws(() =>
      validate(configuration(profile, sensor({ Address, Type }))),
    );
  const c = configuration("modbus-tcp", sensor({ Address: "holding:0" }));
  c.Plcs[0].Connection.UnitId = 0;
  assert.throws(() => validate(c), /unit ID/);
  const ua = configuration(
    "opcua",
    sensor({ Address: "ns=2;i=10", SwapWords: true }),
  );
  assert.throws(() => validate(ua), /Word swap/);
});
test("HTTPS-only destinations and OPC UA security pair are enforced", () => {
  const c = seed();
  for (const u of [
    "http://localhost",
    "https://user:pass@example.com",
    "https://example.com/#secret",
  ]) {
    c.CloudUrl = u;
    assert.throws(() => validate(c));
  }
  const ua = configuration("opcua", sensor({ Address: "ns=2;i=3" }));
  ua.Plcs[0].Connection.SecurityMode = "Sign";
  assert.throws(() => validate(ua), /mode and policy/);
});
test("group creation respects multiword stride and octal addresses; overlap warnings are explicit", () => {
  const sensors = generate({ Count: 3, Address: "D100", Type: "Float32" });
  assert.deepEqual(
    sensors.map((s) => s.Address),
    ["D100", "D102", "D104"],
  );
  assert.equal(new Set(sensors.map((s) => s.Id)).size, 3);
  assert.deepEqual(
    generate({ Count: 3, Address: "X7", Type: "Bool" }).map((s) => s.Address),
    ["X7", "X10", "X11"],
  );
  assert.equal(
    generate({
      Count: 2,
      Address: "holding:5",
      Protocol: "modbus-tcp",
      Type: "Int32",
    })[1].Address,
    "holding:7",
  );
  assert.equal(
    overlaps([
      sensor({ Address: "D100", Type: "Int32" }),
      sensor({ Address: "D101" }),
    ]).length,
    1,
  );
});
test("CSV preserves quotes, Unicode, physical metadata and rejects malformed rows", () => {
  const rows = parseCsv(
    'Name,Address,Type,Scale,Unit,Terminal\r\n"Tank, temperature",D100,Int16,0.1,°C,"A""1"\r\n',
  );
  assert.equal(rows[0].Name, "Tank, temperature");
  assert.equal(rows[0].Terminal, 'A"1');
  validate(configuration("slmp", rows[0]));
  for (const csv of [
    "Name,Name,Address\na,b,D1",
    'Name,Address\n"bad,D1',
    "Name,Address\na,D1,extra",
    "Unknown,Address\na,D1",
  ])
    assert.throws(() => parseCsv(csv));
});
