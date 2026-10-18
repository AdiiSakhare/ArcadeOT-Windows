import net from "node:net";
import dgram from "node:dgram";
import { lookup } from "node:dns/promises";
import { address } from "./domain.mjs";
const width = (s) => (["Int32", "UInt32", "Float32"].includes(s.Type) ? 2 : 1);
export function decode(bytes, s, little = false) {
  let b = Buffer.from(bytes);
  if (s.Type === "Bool") {
    if (b.length !== 1 || ![0, 1, 16].includes(b[0]))
      throw Error("BadDecode: invalid bit payload");
    return b[0] !== 0;
  }
  if (b.length !== width(s) * 2)
    throw Error("BadDecode: incorrect payload length");
  if (s.SwapWords && b.length === 4) b = Buffer.from([b[2], b[3], b[0], b[1]]);
  const methods = {
    Int16: "readInt16",
    UInt16: "readUInt16",
    Int32: "readInt32",
    UInt32: "readUInt32",
    Float32: "readFloat",
  };
  const raw = b[methods[s.Type] + (little ? "LE" : "BE")](0);
  if (!Number.isFinite(raw))
    throw Error("BadDecode: non-finite numeric payload");
  return raw;
}
export function slmpRequest(s, mode = "Binary") {
  const n = address(s.Address),
    area = s.Address[0],
    w = width(s),
    bit = s.Type === "Bool";
  if (mode !== "Binary") {
    const number = /[XY]/.test(area)
      ? n.toString(mode === "AsciiOctal" ? 8 : 16).padStart(6, "0")
      : String(n).padStart(6, "0");
    const data =
      "00100401" +
      (bit ? "0001" : "0000") +
      area +
      "*" +
      number +
      w.toString(16).padStart(4, "0");
    return Buffer.from(
      "500000FF03FF00" + data.length.toString(16).padStart(4, "0") + data,
      "ascii",
    );
  }
  const b = Buffer.from([
    0x50,
    0,
    0,
    255,
    255,
    3,
    0,
    12,
    0,
    16,
    0,
    1,
    4,
    bit ? 1 : 0,
    0,
    0,
    0,
    0,
    { D: 168, M: 144, X: 156, Y: 157 }[area],
    w,
    0,
  ]);
  b.writeUIntLE(n, 15, 3);
  return b;
}
export function slmpResponse(packet, s, mode = "Binary") {
  let payload;
  if (mode === "Binary") {
    if (
      packet.length < 11 ||
      !packet.subarray(0, 7).equals(Buffer.from([208, 0, 0, 255, 255, 3, 0]))
    )
      throw Error("BadProtocol: invalid SLMP header/route");
    const n = packet.readUInt16LE(7);
    if (n < 2 || n > 4096 || packet.length !== 9 + n)
      throw Error("BadProtocol: invalid SLMP length");
    const end = packet.readUInt16LE(9);
    if (end) throw Error(`BadProtocol: SLMP end code 0x${end.toString(16)}`);
    payload = packet.subarray(11);
    if (
      s.Type === "Bool" &&
      (payload.length !== 1 || ![0, 16].includes(payload[0]))
    )
      throw Error("BadDecode: invalid SLMP packed bit");
  } else {
    const h = packet.toString("ascii");
    if (
      !/^D00000FF03FF00[0-9A-F]{4}/i.test(h) ||
      packet.length !== 18 + parseInt(h.slice(14, 18), 16)
    )
      throw Error("BadProtocol: invalid ASCII SLMP header");
    const body = h.slice(18);
    if (!/^[0-9a-f]+$/i.test(body) || body.slice(0, 4) !== "0000")
      throw Error(`BadProtocol: SLMP end code ${body.slice(0, 4)}`);
    const data = body.slice(4);
    if (s.Type === "Bool") {
      if (!["0", "1"].includes(data))
        throw Error("BadDecode: invalid ASCII bit");
      payload = Buffer.from([data === "1" ? 16 : 0]);
    } else {
      if (data.length !== width(s) * 4)
        throw Error("BadDecode: invalid ASCII data length");
      payload = Buffer.alloc(width(s) * 2);
      for (let i = 0; i < width(s); i++)
        payload.writeUInt16LE(
          parseInt(data.slice(i * 4, i * 4 + 4), 16),
          i * 2,
        );
    }
  }
  return {
    raw: decode(payload, s, true),
    hex: payload.toString("hex").toUpperCase(),
  };
}
function slmp(p) {
  return {
    read: (s) =>
      new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: p.Host, port: p.Port });
        let data = Buffer.alloc(0),
          settled = false;
        const finish = (err, value) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          err ? reject(err) : resolve(value);
        };
        socket.setTimeout(p.TimeoutMs, () =>
          finish(Error("BadTimeout: SLMP response deadline exceeded")),
        );
        socket.on("error", (e) => finish(e));
        socket.on("end", () =>
          finish(Error("BadCommunication: SLMP peer closed the connection")),
        );
        socket.on("connect", () => socket.write(slmpRequest(s, p.FrameMode)));
        socket.on("data", (chunk) => {
          data = Buffer.concat([data, chunk]);
          const head = p.FrameMode === "Binary" ? 9 : 18;
          if (data.length > 8210)
            return finish(Error("BadProtocol: oversized SLMP response"));
          if (data.length < head) return;
          let n;
          if (head === 9) n = data.readUInt16LE(7);
          else {
            const field = data.subarray(14, 18).toString();
            if (!/^[0-9a-f]{4}$/i.test(field))
              return finish(Error("BadProtocol: malformed length"));
            n = parseInt(field, 16);
          }
          if (n < (head === 9 ? 2 : 4) || n > (head === 9 ? 4096 : 8192))
            return finish(Error("BadProtocol: invalid length"));
          if (data.length >= head + n) {
            try {
              finish(null, slmpResponse(data, s, p.FrameMode));
            } catch (e) {
              finish(e);
            }
          }
        });
      }),
    close: async () => {},
  };
}
export async function openDriver(p, dataDir) {
  const c = p.Connection;
  if (p.ProfileId === "slmp") return slmp(p);
  if (p.ProfileId.startsWith("modbus")) {
    const { default: Modbus } = await import("modbus-serial");
    const client = new Modbus();
    client.setTimeout(p.TimeoutMs);
    client.setID(c.UnitId);
    try {
      if (p.ProfileId === "modbus-tcp")
        await deadline(
          client.connectTCP(p.Host, { port: p.Port }),
          p.TimeoutMs,
          () => client.close(),
        );
      else
        await deadline(
          client.connectRTUBuffered(c.SerialPath, {
            baudRate: c.BaudRate,
            parity: c.Parity,
            dataBits: c.DataBits,
            stopBits: c.StopBits,
          }),
          p.TimeoutMs,
          () => client.close(),
        );
    } catch (e) {
      try {
        client.close();
      } catch {}
      throw e;
    }
    return {
      read: async (s) => {
        const [area, addr] = s.Address.split(":");
        const fn = {
          holding: "readHoldingRegisters",
          input: "readInputRegisters",
          coil: "readCoils",
          discrete: "readDiscreteInputs",
        }[area];
        const r = await client[fn](
          Number(addr),
          s.Type === "Bool" ? 1 : width(s),
        );
        const b =
          s.Type === "Bool" ? Buffer.from([r.data[0] ? 1 : 0]) : r.buffer;
        return { raw: decode(b, s), hex: b.toString("hex").toUpperCase() };
      },
      close: async () => {
        try {
          client.close();
        } catch {}
      },
    };
  }
  if (p.ProfileId === "s7") {
    const { default: S7 } = await import("nodes7");
    const client = new S7({ silent: true });
    client.setTranslationCB((x) => x);
    try {
      await deadline(
        new Promise((resolve, reject) =>
          client.initiateConnection(
            {
              host: p.Host,
              port: p.Port,
              rack: c.Rack,
              slot: c.Slot,
              timeout: p.TimeoutMs,
            },
            (e) => (e ? reject(e) : resolve()),
          ),
        ),
        p.TimeoutMs,
        () => client.dropConnection(),
      );
    } catch (e) {
      client.dropConnection();
      throw e;
    }
    return {
      read: async (s) => {
        client.removeItems();
        client.addItems(s.Address);
        const raw = await deadline(
          new Promise((resolve, reject) =>
            client.readAllItems((bad, values) =>
              bad
                ? reject(Error("BadProtocol: S7 read returned bad quality"))
                : resolve(values[s.Address]),
            ),
          ),
          p.TimeoutMs,
          () => client.dropConnection(),
        );
        return { raw, hex: "" };
      },
      close: async () => client.dropConnection(),
    };
  }
  if (p.ProfileId === "cip") {
    const { Controller, Tag } = await import("st-ethernet-ip");
    const client = new Controller(false, {
      unconnectedSendTimeout: p.TimeoutMs,
    });
    client.timeout_sp = p.TimeoutMs;
    client.on("error", () => {});
    try {
      await deadline(
        client.connect(p.Host, c.CpuSlot, false),
        p.TimeoutMs,
        () => client.destroy(),
      );
    } catch (e) {
      client.destroy();
      throw e;
    }
    return {
      read: async (s) => {
        class ScalarReadTag extends Tag {
          parseReadMessageResponse(data) {
            const codes = {
              Bool: 193,
              Int16: 195,
              Int32: 196,
              UInt16: 199,
              UInt32: 200,
              Float32: 202,
            };
            if (data.length < 2 || data.readUInt16LE(0) !== codes[s.Type])
              throw Error(
                "BadDecode: CIP datatype differs from declared mapping",
              );
            this.state.tag.type = data.readUInt16LE(0);
            const bytes = data.subarray(2);
            this.capturedHex = bytes.toString("hex").toUpperCase();
            if (s.Type === "Bool") {
              if (bytes.length !== 1 || ![0, 1, 255].includes(bytes[0]))
                throw Error("BadDecode: invalid scalar CIP Boolean");
              this.capturedRaw = bytes[0] !== 0;
            } else this.capturedRaw = decode(bytes, s, true);
            this.controller_value = this.capturedRaw;
          }
        }
        const tag = new ScalarReadTag(s.Address);
        await deadline(client.readTag(tag), p.TimeoutMs, () =>
          client.destroy(),
        );
        return { raw: tag.capturedRaw, hex: tag.capturedHex };
      },
      close: async () => client.destroy(),
    };
  }
  if (p.ProfileId === "opcua") {
    const {
      OPCUAClient,
      MessageSecurityMode,
      SecurityPolicy,
      AttributeIds,
      UserTokenType,
      DataType,
    } = await import("node-opcua-client");
    const { OPCUACertificateManager } =
      await import("node-opcua-certificate-manager");
    const manager = new OPCUACertificateManager({
      rootFolder: dataDir + "/pki",
      automaticallyAcceptUnknownCertificate: false,
    });
    const client = OPCUAClient.create({
      applicationName: "ArcadeOT Web Gateway",
      securityMode: MessageSecurityMode[c.SecurityMode],
      securityPolicy: SecurityPolicy[c.SecurityPolicy],
      clientCertificateManager: manager,
      ...(c.CertificateFile ? { certificateFile: c.CertificateFile } : {}),
      ...(c.PrivateKeyFile ? { privateKeyFile: c.PrivateKeyFile } : {}),
      connectionStrategy: { maxRetry: 0, initialDelay: 100 },
      endpointMustExist: true,
      transportTimeout: p.TimeoutMs,
    });
    let session;
    try {
      await deadline(client.connect(c.Endpoint), p.TimeoutMs, () =>
        client.disconnect(),
      );
      const prefix = c.CredentialRef;
      const identity = prefix
        ? {
            type: UserTokenType.UserName,
            userName: process.env[prefix + "_USERNAME"],
            password: process.env[prefix + "_PASSWORD"],
          }
        : { type: UserTokenType.Anonymous };
      if (prefix && (!identity.userName || !identity.password))
        throw Error(
          "BadConfiguration: OPC UA credential environment variables are missing",
        );
      session = await deadline(
        client.createSession(identity),
        p.TimeoutMs,
        () => client.disconnect(),
      );
    } catch (e) {
      await client.disconnect().catch(() => {});
      throw e;
    }
    return {
      read: async (s) => {
        const v = await deadline(
          session.read({ nodeId: s.Address, attributeId: AttributeIds.Value }),
          p.TimeoutMs,
          () => client.disconnect(),
        );
        if (!v.statusCode.isGood())
          throw Error("BadProtocol: " + v.statusCode.toString());
        const dt = {
          Bool: DataType.Boolean,
          Int16: DataType.Int16,
          UInt16: DataType.UInt16,
          Int32: DataType.Int32,
          UInt32: DataType.UInt32,
          Float32: DataType.Float,
        };
        if (v.value.dataType !== dt[s.Type] || v.value.arrayType !== 0)
          throw Error(
            "BadDecode: OPC UA scalar type differs from declared mapping",
          );
        return {
          raw: v.value.value,
          hex: "",
          sourceAt: v.sourceTimestamp?.toISOString() ?? null,
        };
      },
      close: async () => {
        await session.close().catch(() => {});
        await client.disconnect().catch(() => {});
        await manager.dispose();
      },
    };
  }
  if (p.ProfileId === "fins") {
    const ip = (await lookup(p.Host, { family: 4 })).address;
    let sid = 0;
    return {
      read: (s) =>
        new Promise((resolve, reject) => {
          const socket = dgram.createSocket("udp4");
          const bit = s.Type === "Bool",
            m = /^(D|CIO|W|H|A)(\d+)(?:\.(\d+))?$/.exec(s.Address),
            areas = {
              D: [0x82, 0x02],
              CIO: [0xb0, 0x30],
              W: [0xb1, 0x31],
              H: [0xb2, 0x32],
              A: [0xb3, 0x33],
            };
          const id = ++sid % 256;
          const request = Buffer.from([
            0x80,
            0,
            2,
            c.DestinationNetwork,
            c.DestinationNode,
            0,
            c.SourceNetwork,
            c.SourceNode,
            0,
            id,
            1,
            1,
            areas[m[1]][bit ? 1 : 0],
            0,
            0,
            Number(m[3] ?? 0),
            0,
            width(s),
          ]);
          request.writeUInt16BE(Number(m[2]), 13);
          let done = false;
          const timer = setTimeout(
            () => finish(Error("BadTimeout: FINS read deadline exceeded")),
            p.TimeoutMs,
          );
          const finish = (err, value) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
              socket.close();
            } catch {}
            err ? reject(err) : resolve(value);
          };
          socket.on("error", (e) => finish(e));
          socket.on("message", (b, r) => {
            if (
              r.address !== ip ||
              r.port !== p.Port ||
              b.length < 14 ||
              b[9] !== id
            )
              return;
            if (
              !(b[0] & 0x40) ||
              b[3] !== c.SourceNetwork ||
              b[4] !== c.SourceNode ||
              b[6] !== c.DestinationNetwork ||
              b[7] !== c.DestinationNode ||
              b[10] !== 1 ||
              b[11] !== 1
            )
              return finish(Error("BadProtocol: FINS route/command mismatch"));
            const end = b.readUInt16BE(12);
            if (end)
              return finish(
                Error("BadProtocol: FINS end code 0x" + end.toString(16)),
              );
            try {
              const payload = b.subarray(14);
              finish(null, {
                raw: decode(payload, s),
                hex: payload.toString("hex").toUpperCase(),
              });
            } catch (e) {
              finish(e);
            }
          });
          socket.send(request, p.Port, ip, (e) => {
            if (e) finish(e);
          });
        }),
      close: async () => {},
    };
  }
  throw Error("BadConfiguration: unknown protocol adapter");
}
export async function deadline(promise, ms, cancel = () => {}) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          Promise.resolve()
            .then(cancel)
            .catch(() => {});
          reject(Error("BadTimeout: protocol deadline exceeded"));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
