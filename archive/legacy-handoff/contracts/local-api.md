# Implemented loopback API

Bind: http://127.0.0.1:17845. Every request needs `X-ArcadeOT-Key` from protected api-token.txt. No CORS. Request/measurement config fields use PascalCase; health fields are the anonymous-object names visible in service source.

| Method | Path | Purpose |
|---|---|---|
| GET | /health | status/start/config revision/PLC count/buffer counts/upload state |
| GET | /config | current config, no secret values |
| POST | /config | validate and atomically save new generation; 400 on rejected config |
| POST | /cloud-credential | plaintext token body, 1–8192 characters, no newline; write-only |
| GET | /live | current per-sensor raw/value/unit/quality/UTC/detail rows |
| GET | /export.csv | latest 100,000 measurements in quoted CSV |

No lifecycle endpoint stops service or writes PLC values. Admin service control uses Windows SCM. Versioned IPC, role authorization and richer pagination/errors remain production work.
