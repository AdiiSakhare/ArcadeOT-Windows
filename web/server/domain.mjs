import { randomUUID } from "node:crypto";
export const profiles = [
  ["slmp", "Mitsubishi", "SLMP controller", "SLMP 3E TCP", 5007],
  ["modbus-tcp", "Multi-vendor", "Modbus TCP device", "Modbus TCP", 502],
  ["modbus-rtu", "Multi-vendor", "Modbus serial device", "Modbus RTU", 0],
  ["opcua", "Multi-vendor", "OPC UA server", "OPC UA", 4840],
  ["s7", "Siemens", "S7 controller", "Siemens S7", 102],
  [
    "cip",
    "Rockwell / compatible",
    "Logix controller",
    "EtherNet/IP CIP",
    44818,
  ],
  ["fins", "Omron", "FINS controller", "Omron FINS UDP", 9600],
].map(([Id, Manufacturer, Family, Protocol, Port]) => ({
  Id,
  Manufacturer,
  Family,
  Protocol,
  Port,
  Implemented: true,
  Version: "2026.10.18",
  Status: "Adapter implemented · exact hardware unqualified",
}));
export const connectionDefaults = {
  UnitId: 1,
  SerialPath: "",
  BaudRate: 9600,
  Parity: "even",
  DataBits: 8,
  StopBits: 1,
  Rack: 0,
  Slot: 1,
  CpuSlot: 0,
  SourceNode: 10,
  DestinationNode: 1,
  DestinationNetwork: 0,
  SourceNetwork: 0,
  Endpoint: "",
  SecurityMode: "None",
  SecurityPolicy: "None",
  CredentialRef: "",
  CertificateFile: "",
  PrivateKeyFile: "",
};
export const uid = () => randomUUID().replaceAll("-", "");
export function sensor(overrides = {}) {
  return {
    Id: uid(),
    Name: "New sensor",
    Group: "",
    Address: "D100",
    Type: "Int16",
    SwapWords: false,
    Scale: 1,
    Offset: 0,
    Unit: "",
    Min: null,
    Max: null,
    ModuleSku: "",
    Slot: "",
    Channel: "",
    Terminal: "",
    Common: "",
    Signal: "",
    SensorModel: "",
    ManualReference: "",
    ...overrides,
  };
}
export function controller(overrides = {}) {
  return {
    Id: uid(),
    Name: "New controller",
    ProfileId: "slmp",
    ProfileVersion: "2026.10.18",
    Model: "",
    Firmware: "unknown",
    Interface: "Built-in Ethernet",
    Host: "",
    Port: 0,
    FrameMode: "Binary",
    PollMs: 1000,
    TimeoutMs: 3000,
    Enabled: false,
    Connection: { ...connectionDefaults },
    Sensors: [],
    ...overrides,
  };
}
export function seed() {
  return {
    Version: 3,
    Revision: uid(),
    SiteId: "my-site",
    RetentionDays: 30,
    MaxBufferMb: 1024,
    CloudUrl: "",
    Plcs: [],
  };
}
function fail(message) {
  throw new Error(message);
}
const text = (v, n, max = 200, required = false) => {
  if (
    typeof v !== "string" ||
    v.length > max ||
    /[\x00-\x1f\x7f]/.test(v) ||
    (required && !v.trim())
  )
    fail(`${n}: enter valid text (up to ${max} characters).`);
};
const integer = (v, min, max, n) => {
  if (!Number.isInteger(v) || v < min || v > max)
    fail(`${n} must be an integer between ${min} and ${max}.`);
};
function shape(o, keys, n) {
  if (!o || Array.isArray(o) || typeof o !== "object") fail(`Invalid ${n}.`);
  for (const k of Object.keys(o))
    if (!keys.includes(k)) fail(`Unknown ${n} field: ${k}`);
  for (const k of keys) if (!(k in o)) fail(`Missing ${n} field: ${k}`);
}
export function address(s) {
  if (
    typeof s !== "string" ||
    s.length > 10 ||
    !/^([DM][0-9]+|[XY][0-7]+)$/.test(s)
  )
    fail("Use decimal D/M or octal X/Y addresses.");
  const n = parseInt(s.slice(1), /[XY]/.test(s[0]) ? 8 : 10);
  if (n > 0xffffff) fail("Address exceeds 24-bit limit.");
  return n;
}
export function validate(c) {
  shape(c, Object.keys(seed()), "configuration");
  if (c.Version !== 3) fail("Web configuration version 3 is required.");
  text(c.Revision, "Revision", 100, true);
  text(c.SiteId, "Site ID", 100, true);
  integer(c.RetentionDays, 1, 3650, "Retention");
  integer(c.MaxBufferMb, 64, 102400, "Buffer");
  text(c.CloudUrl, "Cloud URL", 2048);
  if (c.CloudUrl) {
    let u;
    try {
      u = new URL(c.CloudUrl);
    } catch {
      fail("Enter a valid HTTPS cloud URL.");
    }
    if (u.protocol !== "https:" || u.username || u.password || u.hash)
      fail("Cloud URL requires HTTPS without credentials or fragments.");
  }
  if (!Array.isArray(c.Plcs) || c.Plcs.length > 100)
    fail("At most 100 controllers allowed.");
  const ids = new Set();
  for (const p of c.Plcs) {
    shape(p, Object.keys(controller()), "controller");
    text(p.Id, "Controller ID", 100, true);
    if (ids.has(p.Id)) fail("Duplicate controller ID.");
    ids.add(p.Id);
    text(p.Name, "Controller name", 200, true);
    for (const k of ["Model", "Firmware", "Interface", "Host"])
      text(p[k], k, k === "Host" ? 253 : 200);
    const profile = profiles.find((x) => x.Id === p.ProfileId);
    if (!profile || p.ProfileVersion !== profile.Version)
      fail("Unsupported controller profile/version.");
    if (typeof p.Enabled !== "boolean") fail("Enabled must be Boolean.");
    integer(p.Port, 0, 65535, "TCP port");
    integer(p.PollMs, 250, 3600000, "Polling interval");
    integer(p.TimeoutMs, 250, 60000, "Response timeout");
    if (!["Binary", "AsciiOctal", "AsciiHex"].includes(p.FrameMode))
      fail("Unsupported frame mode.");
    if (
      p.Enabled &&
      (!profile.Implemented ||
        !p.Model.trim() ||
        (p.ProfileId === "modbus-rtu"
          ? !p.Connection.SerialPath
          : p.ProfileId === "opcua"
            ? !p.Connection.Endpoint
            : !p.Host || !/^([\w-]+\.)*[\w-]+$/.test(p.Host) || p.Port < 1))
    )
      fail(
        `${p.Name}: enabled controllers need an implemented driver, exact model, host and port.`,
      );
    validateConnection(p);
    if (
      !Array.isArray(p.Sensors) ||
      p.Sensors.length > 10000 ||
      (p.Enabled && !p.Sensors.length)
    )
      fail("Enabled controllers need 1–10000 sensors.");
    const sids = new Set();
    for (const s of p.Sensors) {
      shape(s, Object.keys(sensor()), "sensor");
      text(s.Id, "Sensor ID", 100, true);
      text(s.Name, "Sensor name", 200, true);
      if (sids.has(s.Id)) fail("Duplicate sensor ID.");
      sids.add(s.Id);
      validateMapping(p, s);
      for (const k of ["Scale", "Offset"])
        if (!Number.isFinite(s[k])) fail("Scale and offset must be finite.");
      for (const k of ["Min", "Max"])
        if (s[k] !== null && !Number.isFinite(s[k]))
          fail("Limits must be finite or empty.");
      if (s.Min !== null && s.Max !== null && s.Min > s.Max)
        fail("Minimum cannot exceed maximum.");
      if (typeof s.SwapWords !== "boolean") fail("SwapWords must be Boolean.");
      for (const k of [
        "Group",
        "Unit",
        "ModuleSku",
        "Slot",
        "Channel",
        "Terminal",
        "Common",
        "Signal",
        "SensorModel",
        "ManualReference",
      ])
        text(s[k], k, 500);
    }
  }
  return c;
}
export function overlaps(sensors) {
  const ranges = [];
  const result = [];
  for (const s of sensors) {
    const n = address(s.Address),
      end = n + (["Int32", "UInt32", "Float32"].includes(s.Type) ? 1 : 0);
    for (const r of ranges)
      if (r.area === s.Address[0] && n <= r.end && end >= r.start)
        result.push(`${s.Name} overlaps ${r.name}`);
    ranges.push({ area: s.Address[0], start: n, end, name: s.Name });
  }
  return result;
}
export function generate({
  Prefix = "Temperature",
  Address = "D100",
  Type = "Int16",
  Count = 8,
  Unit = "°C",
  Scale = 0.1,
  Protocol = "slmp",
}) {
  integer(Count, 1, 1000, "Group count");
  const width = ["Int32", "UInt32", "Float32"].includes(Type) ? 2 : 1;
  let base,
    prefix,
    radix = 10;
  if (Protocol === "slmp") {
    base = address(Address);
    prefix = Address[0];
    radix = /[XY]/.test(prefix) ? 8 : 10;
  } else if (Protocol.startsWith("modbus")) {
    const m = /^(holding|input|coil|discrete):(\d+)$/.exec(Address);
    if (!m) fail("Use a zero-based Modbus address.");
    prefix = m[1] + ":";
    base = Number(m[2]);
  } else if (Protocol === "fins") {
    const m = /^(D|CIO|W|H|A)(\d+)$/.exec(Address);
    if (!m || Type === "Bool")
      fail("FINS repeated groups require a numeric word address.");
    prefix = m[1];
    base = Number(m[2]);
  } else fail("Use CSV import for explicit symbolic or S7 addresses.");
  return Array.from({ length: Count }, (_, i) =>
    sensor({
      Name: `${Prefix} ${String(i + 1).padStart(2, "0")}`,
      Group: Prefix,
      Address: prefix + (base + i * width).toString(radix),
      Type,
      Unit,
      Scale,
    }),
  );
}
export function parseCsv(input) {
  if (typeof input !== "string" || input.length > 1000000)
    fail("CSV exceeds 1 MB.");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(cell);
      cell = "";
      if (c !== ",") {
        if (c === "\r" && input[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) fail("Unclosed CSV quote.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim().replace(/^\uFEFF/, ""));
  if (!headers?.includes("Name") || !headers.includes("Address"))
    fail("CSV needs Name and Address columns.");
  if (new Set(headers).size !== headers.length) fail("Duplicate CSV headers.");
  const allowed = Object.keys(sensor());
  for (const h of headers)
    if (!allowed.includes(h)) fail(`Unknown CSV column: ${h}`);
  if (rows.length > 10000) fail("At most 10000 rows.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      fail(`CSV row ${i + 2} has an incorrect column count.`);
    const s = sensor();
    headers.forEach((k, j) => {
      const v = r[j];
      if (["Scale", "Offset", "Min", "Max"].includes(k))
        s[k] = v === "" && ["Min", "Max"].includes(k) ? null : Number(v);
      else if (k === "SwapWords") {
        if (!["true", "false", ""].includes(v.toLowerCase()))
          fail("SwapWords requires true/false.");
        s[k] = v.toLowerCase() === "true";
      } else if (k !== "Id" || v) s[k] = v;
    });
    return s;
  });
}
export function csv(rows) {
  const keys = [
    "EventId",
    "SiteId",
    "PlcId",
    "SensorId",
    "ConfigRevision",
    "ObservedAtUtc",
    "SourceAtUtc",
    "RawValue",
    "Value",
    "Unit",
    "Quality",
    "Error",
    "RawHex",
  ];
  const quote = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    keys.join(",") +
    "\r\n" +
    rows
      .map((r) => keys.map((k) => quote(r.Measurement[k])).join(","))
      .join("\r\n")
  );
}

export function validateConnection(p) {
  const c = p.Connection;
  shape(c, Object.keys(connectionDefaults), "connection");
  integer(c.UnitId, 1, 247, "Modbus unit ID");
  integer(c.BaudRate, 300, 4000000, "Baud rate");
  integer(c.DataBits, 7, 8, "Data bits");
  integer(c.StopBits, 1, 2, "Stop bits");
  if (!["none", "even", "odd"].includes(c.Parity))
    fail("Invalid serial parity.");
  integer(c.Rack, 0, 7, "S7 rack");
  integer(c.Slot, 0, 31, "S7 slot");
  integer(c.CpuSlot, 0, 31, "CPU slot");
  for (const k of [
    "SourceNode",
    "DestinationNode",
    "SourceNetwork",
    "DestinationNetwork",
  ])
    integer(c[k], 0, 254, k);
  for (const k of [
    "SerialPath",
    "Endpoint",
    "CredentialRef",
    "CertificateFile",
    "PrivateKeyFile",
  ])
    text(c[k], k, 2048);
  if (c.CredentialRef && !/^[A-Z][A-Z0-9_]*$/.test(c.CredentialRef))
    fail(
      "Credential reference must be an uppercase environment variable prefix.",
    );
  if (
    !["None", "Sign", "SignAndEncrypt"].includes(c.SecurityMode) ||
    ![
      "None",
      "Basic256Sha256",
      "Aes128_Sha256_RsaOaep",
      "Aes256_Sha256_RsaPss",
    ].includes(c.SecurityPolicy)
  )
    fail("Unsupported OPC UA security setting.");
  if ((c.SecurityMode === "None") !== (c.SecurityPolicy === "None"))
    fail("Security mode and policy must both be None or both secure.");
  if (p.ProfileId === "opcua" && c.Endpoint) {
    let u;
    try {
      u = new URL(c.Endpoint);
    } catch {
      fail("Invalid OPC UA endpoint.");
    }
    if (u.protocol !== "opc.tcp:" || u.username || u.password || u.hash)
      fail("Use an opc.tcp:// endpoint without embedded credentials.");
  }
}
export function validateMapping(p, s) {
  text(s.Address, "Readable address", 500, true);
  if (
    !["Int16", "UInt16", "Int32", "UInt32", "Float32", "Bool"].includes(s.Type)
  )
    fail("Unsupported data type.");
  const width = ["Int32", "UInt32", "Float32"].includes(s.Type) ? 2 : 1;
  if (p.ProfileId === "slmp") {
    const n = address(s.Address);
    if ((s.Address[0] !== "D") !== (s.Type === "Bool"))
      fail("D requires numeric types; M/X/Y require Bool.");
    if (n + width - 1 > 0xffffff) fail("Multiword address overflows.");
    if (
      p.FrameMode !== "Binary" &&
      (/[DM]/.test(s.Address[0])
        ? n > 999999
        : p.FrameMode === "AsciiOctal" && n > 262143)
    )
      fail("Address exceeds ASCII field.");
  }
  if (p.ProfileId.startsWith("modbus")) {
    const m = /^(holding|input|coil|discrete):(\d+)$/.exec(s.Address);
    if (!m)
      fail(
        "Modbus address: holding:0, input:0, coil:0 or discrete:0 (zero-based).",
      );
    if (["coil", "discrete"].includes(m[1]) !== (s.Type === "Bool"))
      fail("Coil/discrete require Bool; registers require numeric types.");
    if (Number(m[2]) + width > 65536) fail("Modbus address overflows.");
  }
  if (p.ProfileId === "opcua" && !/^(ns=\d+;)?[isgb]=.+$/.test(s.Address))
    fail("OPC UA requires a NodeId, for example ns=2;s=Temperature.");
  if (p.ProfileId === "s7") {
    const m = /^(DB\d+,)(REAL|DINT|DWORD|INT|WORD|X)(\d+)(?:\.(\d+))?$/.exec(
      s.Address,
    );
    if (!m) fail("S7: use DB1,REAL0, DB1,INT0 or DB1,X0.0.");
    const types = {
      REAL: "Float32",
      DINT: "Int32",
      DWORD: "UInt32",
      INT: "Int16",
      WORD: "UInt16",
      X: "Bool",
    };
    if (
      Number(m[1].slice(2, -1)) > 65535 ||
      Number(m[3]) + width * 2 - 1 > 0x1fffff
    )
      fail("S7 DB or byte offset exceeds protocol limits.");
    if (types[m[2]] !== s.Type || (m[2] === "X" && (!m[4] || Number(m[4]) > 7)))
      fail("S7 address and data type must agree.");
  }
  if (p.ProfileId === "cip" && p.Port !== 44818)
    fail("EtherNet/IP adapter requires TCP port 44818.");
  if (["opcua", "s7", "cip"].includes(p.ProfileId) && s.SwapWords)
    fail("Word swap applies to raw register protocols only.");
  if (
    p.ProfileId === "cip" &&
    !/^[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(
      s.Address,
    )
  )
    fail(
      "Enter a symbolic CIP tag, e.g. Program: tags are not supported in this version.",
    );
  if (p.ProfileId === "fins") {
    const m = /^(D|CIO|W|H|A)(\d+)(?:\.(\d+))?$/.exec(s.Address);
    if (
      !m ||
      Number(m[2]) + width > 32768 ||
      (m[3] !== undefined && Number(m[3]) > 15) ||
      (s.Type === "Bool") !== (m[3] !== undefined)
    )
      fail("FINS: D100 for words; CIO0.0 for Bool. Maximum word 32767.");
  }
}
