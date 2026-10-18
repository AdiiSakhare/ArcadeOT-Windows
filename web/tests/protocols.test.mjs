import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { controller, sensor } from "../server/domain.mjs";
import { openDriver } from "../server/drivers.mjs";
const listen = (server, port = 0) =>
  new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server.address().port));
  });
const close = (server) => new Promise((resolve) => server.close(resolve));
test(
  "Siemens S7 adapter negotiates ISO/PDU and performs a DB read without writes",
  { timeout: 8000 },
  async () => {
    const commands = [];
    const peer = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4 && buffer.length >= buffer.readUInt16BE(2)) {
          const length = buffer.readUInt16BE(2),
            req = buffer.subarray(0, length);
          buffer = buffer.subarray(length);
          if (req[5] === 0xe0) {
            const response = Buffer.from(req);
            response[5] = 0xd0;
            socket.write(response);
          } else if (req[17] === 0xf0) {
            const b = Buffer.from(
              "0300001b02f080320300000000000800000000f0000001000101e0",
              "hex",
            );
            req.copy(b, 11, 11, 13);
            socket.write(b);
          } else if (req[17] === 4) {
            commands.push(req[17]);
            const b = Buffer.from(
              "0300001b02f0803203000000000002000600000401ff04001004d2",
              "hex",
            );
            req.copy(b, 11, 11, 13);
            socket.write(b);
          } else {
            commands.push(req[17]);
            socket.destroy();
          }
        }
      });
    });
    const port = await listen(peer);
    let d;
    try {
      const p = controller({
        ProfileId: "s7",
        Host: "127.0.0.1",
        Port: port,
        TimeoutMs: 1000,
      });
      d = await openDriver(p, "/tmp");
      const r = await d.read(sensor({ Address: "DB1,INT0", Type: "Int16" }));
      assert.equal(r.raw, 1234);
      assert.deepEqual(commands, [4]);
    } finally {
      await d?.close();
      await close(peer);
    }
  },
);
test(
  "EtherNet/IP CIP adapter registers a session and reads a scalar UDINT tag",
  { timeout: 15000 },
  async () => {
    const commands = [];
    const peer = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (
          buffer.length >= 24 &&
          buffer.length >= 24 + buffer.readUInt16LE(2)
        ) {
          const len = 24 + buffer.readUInt16LE(2),
            req = buffer.subarray(0, len);
          buffer = buffer.subarray(len);
          const command = req.readUInt16LE(0);
          if (command === 0x65) {
            const b = Buffer.from(req);
            b.writeUInt32LE(1, 4);
            socket.write(b);
          } else if (command === 0x6f) {
            commands.push(Buffer.from(req));
            const data = Buffer.from(
              "000000000000020000000000b2000a00cc000000c800ffffffff",
              "hex",
            );
            const h = Buffer.alloc(24);
            h.writeUInt16LE(0x6f, 0);
            h.writeUInt16LE(data.length, 2);
            h.writeUInt32LE(1, 4);
            socket.write(Buffer.concat([h, data]));
          } else if (command === 0x66) socket.end();
          else socket.destroy();
        }
      });
    });
    await listen(peer, 44818);
    let d;
    try {
      const p = controller({
        ProfileId: "cip",
        Host: "127.0.0.1",
        Port: 44818,
        TimeoutMs: 1000,
      });
      d = await openDriver(p, "/tmp");
      const r = await d.read(sensor({ Address: "Counter", Type: "UInt32" }));
      assert.equal(r.raw, 4294967295);
      assert.equal(r.hex, "FFFFFFFF");
      assert.equal(commands.length, 1);
      assert.equal(commands[0][40], 0x52);
      assert.ok(commands[0].includes(Buffer.from([0x4c, 5, 0x91, 7])));
    } finally {
      await d?.close();
      await close(peer);
    }
  },
);
test(
  "OPC UA adapter reads a real scalar session and preserves source timestamp",
  { timeout: 30000 },
  async () => {
    const { OPCUAServer } = await import("node-opcua-server");
    const { OPCUACertificateManager } =
      await import("node-opcua-certificate-manager");
    const { Variant, DataType } = await import("node-opcua-client");
    const directory = await mkdtemp(join(tmpdir(), "arcade-opcua-"));
    const reserve = net.createServer();
    const port = await listen(reserve);
    await close(reserve);
    const manager = new OPCUACertificateManager({
      rootFolder: join(directory, "server-pki"),
      automaticallyAcceptUnknownCertificate: false,
    });
    const server = new OPCUAServer({
      port,
      hostname: "127.0.0.1",
      resourcePath: "/UA/ArcadeTest",
      serverCertificateManager: manager,
      securityModes: [1],
      securityPolicies: ["http://opcfoundation.org/UA/SecurityPolicy#None"],
    });
    let d;
    try {
      await server.initialize();
      const namespace = server.engine.addressSpace.getOwnNamespace();
      namespace.addVariable({
        organizedBy: server.engine.addressSpace.rootFolder.objects,
        nodeId: "s=Temperature",
        browseName: "Temperature",
        dataType: "Float",
        value: new Variant({ dataType: DataType.Float, value: 23.5 }),
      });
      await server.start();
      const p = controller({ ProfileId: "opcua", TimeoutMs: 5000 });
      p.Connection.Endpoint = `opc.tcp://127.0.0.1:${port}/UA/ArcadeTest`;
      d = await openDriver(p, join(directory, "client"));
      const r = await d.read(
        sensor({ Address: "ns=1;s=Temperature", Type: "Float32" }),
      );
      assert.equal(r.raw, 23.5);
      assert.ok(r.sourceAt);
      assert.equal(r.hex, "");
    } finally {
      await d?.close();
      await server.shutdown(0);
      await manager.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
test(
  "Modbus RTU uses the gateway serial device, unit ID and CRC on a raw pseudo-terminal",
  { timeout: 8000, skip: process.platform !== "linux" },
  async () => {
    const { spawn } = await import("node:child_process");
    const child = spawn(
      "python3",
      [
        "-u",
        "-c",
        `import os,pty,tty,json
master,slave=pty.openpty()
tty.setraw(slave)
print(os.ttyname(slave),flush=True)
def crc(data):
 c=65535
 for b in data:
  c^=b
  for _ in range(8): c=(c>>1)^0xA001 if c&1 else c>>1
 return c
buf=b''
while True:
 buf+=os.read(master,1024)
 if len(buf)>=8:
  req,buf=buf[:8],buf[8:]
  print(json.dumps(list(req)),flush=True)
  if req[1]!=3 or crc(req[:6])!=int.from_bytes(req[6:8],'little'): raise Exception('Unexpected or invalid RTU request')
  body=bytes([req[0],3,2,4,87])
  os.write(master,body+crc(body).to_bytes(2,'little'))
`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let text = "",
      resolvePath,
      resolveRequest;
    const pathPromise = new Promise((r) => (resolvePath = r)),
      requestPromise = new Promise((r) => (resolveRequest = r));
    child.stdout.on("data", (chunk) => {
      text += chunk;
      let i;
      while ((i = text.indexOf("\n")) !== -1) {
        const line = text.slice(0, i);
        text = text.slice(i + 1);
        if (line.startsWith("/dev/")) resolvePath(line);
        else if (line.startsWith("[")) resolveRequest(JSON.parse(line));
      }
    });
    let d;
    try {
      const path = await pathPromise;
      const p = controller({ ProfileId: "modbus-rtu", TimeoutMs: 1000 });
      p.Connection.SerialPath = path;
      p.Connection.UnitId = 7;
      p.Connection.Parity = "none";
      d = await openDriver(p, "/tmp");
      const r = await d.read(sensor({ Address: "holding:5", Type: "UInt16" }));
      assert.equal(r.raw, 1111);
      const req = await requestPromise;
      assert.equal(req[0], 7);
      assert.equal(req[1], 3);
      assert.equal(Buffer.from(req).readUInt16BE(2), 5);
    } finally {
      await d?.close();
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
  },
);
