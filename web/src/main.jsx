import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
  createContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Cloud,
  CloudUpload,
  Copy,
  Cpu,
  Database,
  Download,
  FileClock,
  FileInput,
  Grid2X2,
  History,
  Layers,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Trash2,
  TriangleAlert,
  Unplug,
  Upload,
  X,
  Zap,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./styles.css";
const ErrorContext = createContext("");
const uuid = () => crypto.randomUUID().replaceAll("-", "");
let accessKey = "";
async function api(path, options = {}) {
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      "X-ArcadeOT-Web": "1",
      ...(accessKey ? { Authorization: "Bearer " + accessKey } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!r.ok) {
    let e;
    try {
      e = await r.json();
    } catch {}
    const error = Error(e?.Error ?? `Gateway returned ${r.status}`);
    error.status = r.status;
    throw error;
  }
  return r.headers.get("Content-Type")?.includes("text/csv")
    ? r.text()
    : r.json();
}
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["controllers", "Controllers", Cpu],
  ["sensors", "Sensor mappings", Layers],
  ["monitor", "Live monitor", Activity],
  ["history", "History & exports", History],
  ["delivery", "Cloud delivery", CloudUpload],
  ["settings", "Site settings", Settings2],
];
const protocols = {
  slmp: {
    name: "Mitsubishi SLMP",
    short: "SLMP",
    example: "D100",
    hint: "SLMP 3E over TCP. D/M addresses are decimal; X/Y use octal. Configure a read-enabled SLMP listener in the PLC.",
  },
  "modbus-tcp": {
    name: "Modbus TCP",
    short: "Modbus TCP",
    example: "holding:0",
    hint: "Zero-based offsets: holding:0, input:0, coil:0, discrete:0. Numeric values use big-endian bytes per register; configure word swap for 32-bit values.",
  },
  "modbus-rtu": {
    name: "Modbus RTU",
    short: "Modbus RTU",
    example: "holding:0",
    hint: "The serial adapter must be attached to the gateway machine. Offsets are zero-based. Shared serial buses are polled sequentially.",
  },
  opcua: {
    name: "OPC UA",
    short: "OPC UA",
    example: "ns=2;s=Temperature",
    hint: "Read scalar NodeIds. Configure endpoint security and trust the server certificate on the gateway. Credentials stay in gateway environment variables.",
  },
  s7: {
    name: "Siemens S7",
    short: "S7",
    example: "DB1,INT0",
    hint: "Absolute DB addresses require PUT/GET access and non-optimized blocks on applicable CPUs. DB1,REAL0 = Float32; DB1,X0.0 = Bool.",
  },
  cip: {
    name: "EtherNet/IP CIP",
    short: "CIP",
    example: "Temperature",
    hint: "Controller-scoped scalar Logix tags. Enter a symbolic tag or member, for example Tank.Temperature. CPU slot is configured explicitly. TCP port 44818.",
  },
  fins: {
    name: "Omron FINS",
    short: "FINS",
    example: "D100",
    hint: "FINS UDP memory-area reads. D100 for numeric words; CIO0.0 for bits. Source node must match gateway network configuration.",
  },
};
const types = ["Int16", "UInt16", "Int32", "UInt32", "Float32", "Bool"];
const fmt = (v) =>
  v == null
    ? "—"
    : typeof v === "boolean"
      ? v
        ? "True"
        : "False"
      : typeof v === "number"
        ? Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(v)
        : String(v);
const when = (s) =>
  s ? new Date(s).toLocaleTimeString("en-IN", { hour12: false }) : "—";
const date = (s) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "—";
const good = (q) => ["Good", "Connected", "Running"].includes(q);
function Badge({ value, children }) {
  const v = value ?? "";
  return (
    <span
      className={
        "badge " +
        (good(v)
          ? "green"
          : /Bad|Disconnected|Paused|Error/.test(v)
            ? "red"
            : /Uncertain|Stale|Attention|pending|quarantined/.test(v)
              ? "amber"
              : "neutral")
      }
    >
      <i />
      {children ?? v}
    </span>
  );
}
function Button({ icon: Icon, children, variant = "", ...props }) {
  return (
    <button className={"button " + variant} {...props}>
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Field({ label, help, children, className = "" }) {
  return (
    <label className={"field " + className}>
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
function Input({ value, onChange, type = "text", ...props }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) =>
        onChange(
          type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value,
        )
      }
      {...props}
    />
  );
}
function Select({ value, onChange, children, ...props }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {children}
    </select>
  );
}
function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={"toggle-label " + (disabled ? "muted" : "")}>
      <input
        type="checkbox"
        role="switch"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle" />
      <span>{label}</span>
    </label>
  );
}
function Empty({ icon: Icon = Radio, title, detail, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  const error = useContext(ErrorContext);
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="alert error modal-error" role="alert">
          <TriangleAlert size={17} />
          <span>{error}</span>
        </div>
      )}
      {children}
    </dialog>
  );
}
function DownloadFile(name, contents, type = "application/json") {
  const u = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "overview"),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState("connection");
  const [config, setConfig] = useState(null),
    [saved, setSaved] = useState(""),
    [catalog, setCatalog] = useState([]),
    [defaults, setDefaults] = useState(null),
    [health, setHealth] = useState(null),
    [live, setLive] = useState([]),
    [revisions, setRevisions] = useState([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [paused, setPaused] = useState(false),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState(false),
    [auth, setAuth] = useState(false),
    [key, setKey] = useState("");
  const [modal, setModal] = useState(null),
    [sensorForm, setSensorForm] = useState(null),
    [sensorPlc, setSensorPlc] = useState(""),
    [sensorTab, setSensorTab] = useState("mapping"),
    [preview, setPreview] = useState(null),
    [csvText, setCsvText] = useState(""),
    [group, setGroup] = useState({
      Prefix: "Temperature",
      Address: "D100",
      Type: "Int16",
      Count: 8,
      Unit: "°C",
      Scale: 0.1,
    });
  const [history, setHistory] = useState([]),
    [historyPlc, setHistoryPlc] = useState(""),
    [historyQuality, setHistoryQuality] = useState(""),
    [historyBusy, setHistoryBusy] = useState(false),
    [historyMore, setHistoryMore] = useState(true);
  const dirty = config && JSON.stringify(config) !== saved;
  const showError = (e) => {
    setError(e.message ?? String(e));
    if (e.status === 401) setAuth(true);
  };
  const notify = (t) => {
    setNotice(t);
    setTimeout(() => setNotice(""), 5500);
  };
  const load = useCallback(async () => {
    try {
      const [c, profiles, d, h, l, r] = await Promise.all([
        api("/config"),
        api("/catalog"),
        api("/defaults"),
        api("/health"),
        api("/live"),
        api("/config/history"),
      ]);
      setConfig(c);
      setSaved(JSON.stringify(c));
      setCatalog(profiles);
      setDefaults(d);
      setHealth(h);
      setLive(l);
      setRevisions(r);
      setError("");
      setAuth(false);
    } catch (e) {
      showError(e);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, refresh]);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (paused || auth) return;
      try {
        const [h, l] = await Promise.all([api("/health"), api("/live")]);
        setHealth(h);
        setLive(l);
      } catch (e) {
        setHealth(null);
        setLive((rows) =>
          rows.map((r) => ({
            ...r,
            Quality: r.ObservedAtUtc ? "Stale" : r.Quality,
          })),
        );
        showError(e);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [paused, auth]);
  useEffect(() => {
    const listener = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  useEffect(() => {
    if (selected && !config?.Plcs.some((p) => p.Id === selected))
      setSelected(null);
  }, [config, selected]);
  const navigate = (p) => {
    setPage(p);
    location.hash = p;
    setQuery("");
    setMenu(false);
  };
  useEffect(() => {
    const h = () => setPage(location.hash.slice(1) || "overview");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const mutate = (fn) =>
    setConfig((c) => {
      const n = structuredClone(c);
      fn(n);
      return n;
    });
  const plc = config?.Plcs.find((p) => p.Id === selected);
  const updatePlc = (id, key, value) =>
    mutate((c) => {
      c.Plcs.find((p) => p.Id === id)[key] = value;
    });
  const updateConnection = (k, v) =>
    mutate((c) => {
      c.Plcs.find((p) => p.Id === selected).Connection[k] = v;
    });
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const c = await api("/config", { method: "POST", body: config });
      setConfig(c);
      setSaved(JSON.stringify(c));
      setRevisions(await api("/config/history"));
      notify("Configuration saved. Gateway is applying this revision.");
      setHealth(await api("/health"));
    });
  const newPlc = (profile = "slmp") => {
    const p = structuredClone(defaults.Controller);
    p.Id = uuid();
    p.Name = "Controller " + String(config.Plcs.length + 1).padStart(2, "0");
    p.ProfileId = profile;
    p.Port = catalog.find((x) => x.Id === profile)?.Port ?? 0;
    mutate((c) => c.Plcs.push(p));
    setSelected(p.Id);
    setTab("connection");
    navigate("controllers");
    setModal(null);
  };
  const editPlc = (id) => {
    setSelected(id);
    setTab("connection");
    navigate("controllers");
  };
  const addSensor = (id = selected) => {
    const target = id || config.Plcs[0]?.Id;
    if (!target) {
      setModal("controller");
      return;
    }
    const p = config.Plcs.find((p) => p.Id === target);
    setSensorPlc(target);
    setSensorForm({
      ...structuredClone(defaults.Sensor),
      Id: uuid(),
      Name: "Sensor " + String(p.Sensors.length + 1).padStart(2, "0"),
      Address: protocols[p.ProfileId].example,
    });
    setSensorTab("mapping");
    setModal("sensor");
  };
  const persistSensor = () => {
    mutate((c) => {
      const p = c.Plcs.find((p) => p.Id === sensorPlc);
      const i = p.Sensors.findIndex((s) => s.Id === sensorForm.Id);
      i < 0 ? p.Sensors.push(sensorForm) : p.Sensors.splice(i, 1, sensorForm);
    });
    setModal(null);
    notify("Mapping added to draft. Save & apply to activate.");
  };
  const test = (id) =>
    run(async () => {
      if (dirty)
        throw Error(
          "Save & apply your changes before testing the saved mapping.",
        );
      const m = await api("/plcs/" + encodeURIComponent(id) + "/test", {
        method: "POST",
      });
      notify(
        `Read result: ${m.Quality} · ${fmt(m.Value)} ${m.Unit}${m.Error ? " · " + m.Error : ""}`,
      );
      setLive(await api("/live"));
      setHealth(await api("/health"));
    });
  const exportCsv = () =>
    run(async () => {
      const text = await api(
        "/export.csv?plc=" +
          encodeURIComponent(historyPlc) +
          "&quality=" +
          encodeURIComponent(historyQuality),
      );
      DownloadFile("ArcadeOT-readings.csv", text, "text/csv;charset=utf-8");
      notify(
        "Exported up to 10,000 persisted observations. Export does not acknowledge delivery.",
      );
    });
  const fetchHistory = useCallback(
    async (older = false) => {
      setHistoryBusy(true);
      try {
        const cursor = older && history.length ? history.at(-1).Sequence : "";
        const rows = await api(
          `/history?limit=100&before=${cursor}&plc=${encodeURIComponent(historyPlc)}&quality=${encodeURIComponent(historyQuality)}`,
        );
        setHistory((x) => (older ? [...x, ...rows] : rows));
        setHistoryMore(rows.length === 100);
      } catch (e) {
        showError(e);
      } finally {
        setHistoryBusy(false);
      }
    },
    [history, historyPlc, historyQuality],
  );
  useEffect(() => {
    if (page === "history") fetchHistory(false);
  }, [page, historyPlc, historyQuality]);
  const latest = live.filter((r) =>
    [
      r.Name,
      r.Address,
      config?.Plcs.find((p) => p.Id === r.PlcId)?.Name,
      r.Quality,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const countSensors =
    config?.Plcs.reduce((n, p) => n + p.Sensors.length, 0) ?? 0;
  const connected =
    health?.Plcs.filter((p) => p.State === "Connected").length ?? 0;
  const issueCount = live.filter((r) =>
    /Bad|Uncertain|Stale/.test(r.Quality),
  ).length;
  const filteredPlcs =
    config?.Plcs.filter((p) =>
      [p.Name, p.Model, p.Host, protocols[p.ProfileId]?.name]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  const title = nav.find((x) => x[0] === page)?.[1] ?? "Overview";
  const diagnostics = plc && health?.Plcs.find((p) => p.PlcId === plc.Id);
  const allSensors =
    config?.Plcs.flatMap((p) =>
      p.Sensors.map((s) => ({ ...s, plc: p })),
    ).filter((s) =>
      [s.Name, s.Address, s.Group, s.plc.Name]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  return (
    <ErrorContext.Provider value={error}>
      <div className="app">
        <aside className={"sidebar " + (menu ? "open" : "")}>
          <a
            className="brand"
            href="#overview"
            onClick={() => navigate("overview")}
          >
            <span className="brand-symbol">
              <Layers size={24} />
            </span>
            arcade<span className="brand-ot">OT</span>
            <span className="brand-v">2</span>
          </a>
          <div className="workspace-label">INDUSTRIAL WORKSPACE</div>
          <div className="site-switch">
            <div className="site-icon">
              <Box size={18} />
            </div>
            <div>
              <strong>{config?.SiteId ?? "Connecting…"}</strong>
              <small>Local gateway</small>
            </div>
            <button
              aria-label="Open site settings"
              className="icon-button"
              onClick={() => navigate("settings")}
            >
              <ChevronsUpDown size={14} />
            </button>
          </div>
          <div className="nav-section">WORKSPACE</div>
          <nav>
            {nav.slice(0, 5).map(([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "controllers" && <b>{config?.Plcs.length ?? 0}</b>}
                {id === "monitor" && connected > 0 && (
                  <i className="live-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="nav-section">MANAGE</div>
          <nav>
            {nav.slice(5).map(([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="readonly">
              <ShieldCheck size={18} />
              <strong>Read-only by design</strong>
              <p>Your PLC programs and values stay in your control.</p>
            </div>
            <div className="sidebar-status">
              <i className={health ? "live-dot" : "offline-dot"} />
              <span>
                {health ? "Gateway connected" : "Gateway unavailable"}
              </span>
              <span>v0.1</span>
            </div>
          </div>
        </aside>
        {menu && <div className="backdrop" onClick={() => setMenu(false)} />}
        <div className="main">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMenu(!menu)}
                aria-label="Toggle navigation"
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{title}</strong>
            </div>
            <div className="topbar-right">
              <span className="gateway-indicator">
                <i className={health ? "live-dot" : "offline-dot"} /> Local
                gateway
              </span>
              <span className="topbar-separator" />
              <button
                className="icon-button"
                onClick={() => setModal("help")}
                aria-label="Connection guide"
              >
                <CircleHelp size={18} />
              </button>
              <div className="avatar">OP</div>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {page === "overview"
                    ? "OPERATIONS CENTER"
                    : page === "controllers" && plc
                      ? "CONTROLLER WORKSPACE"
                      : "ARCADEOT WORKSPACE"}
                </div>
                <h1>
                  {page === "overview"
                    ? "Your operation, in view."
                    : page === "controllers" && plc
                      ? plc.Name
                      : title}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {
                    {
                      overview:
                        "Connect your equipment. Understand every signal.",
                      controllers: plc
                        ? "Configure the connection. Map the signal. Keep the evidence."
                        : "One workspace for every controller on your floor.",
                      sensors:
                        "Turn readable PLC addresses into meaningful measurements.",
                      monitor:
                        "Persisted observations, straight from your connected equipment.",
                      history:
                        "Every observation, with its quality and provenance intact.",
                      delivery:
                        "Keep your data moving. Keep every event accounted for.",
                      settings:
                        "Your installation, configured for your operation.",
                    }[page]
                  }
                </p>
              </div>
              <div className="heading-actions">
                {dirty && (
                  <span className="draft">
                    <i /> Unsaved changes
                  </span>
                )}
                {dirty ? (
                  <Button
                    icon={Check}
                    variant="primary"
                    onClick={save}
                    disabled={busy}
                  >
                    {busy ? "Applying…" : "Save & apply"}
                  </Button>
                ) : (
                  <Button
                    icon={Plus}
                    variant="primary"
                    onClick={() => setModal("controller")}
                    disabled={!config}
                  >
                    Add controller
                  </Button>
                )}
              </div>
            </div>
            {error && (
              <div className="alert error" role="alert">
                <TriangleAlert size={18} />
                <span>{error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {health?.StorageError && (
              <div className="alert error" role="alert">
                <Database size={18} />
                <span>
                  {health.StorageError} Review storage capacity in Site
                  settings.
                </span>
              </div>
            )}
            {!config ? (
              <div className="panel">
                <Empty
                  icon={Network}
                  title="Connect to your gateway"
                  detail="Start the ArcadeOT gateway on a machine with access to your equipment."
                  action={
                    <Button onClick={() => load()} icon={RefreshCw}>
                      Retry connection
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {page === "overview" && (
                  <>
                    <section className="overview-banner">
                      <div className="banner-main">
                        <span className="banner-label">
                          <i className={connected ? "live-dot" : "soft-dot"} />
                          {connected
                            ? "YOUR GATEWAY IS COLLECTING"
                            : "READY WHEN YOU ARE"}
                        </span>
                        <h2>
                          {config.Plcs.length
                            ? "A clear connection to your floor."
                            : "Every signal starts with a connection."}
                        </h2>
                        <p>
                          {config.Plcs.length
                            ? `${config.Plcs.length} configured controllers. ${countSensors} mapped signals. One place to see what’s happening.`
                            : "Bring your first controller online, map a sensor, and let the data tell its story."}
                        </p>
                        <Button
                          icon={config.Plcs.length ? ArrowUpRight : Plus}
                          variant="light"
                          onClick={() =>
                            config.Plcs.length
                              ? navigate("monitor")
                              : setModal("controller")
                          }
                        >
                          {config.Plcs.length
                            ? "Open live monitor"
                            : "Connect your first controller"}
                        </Button>
                      </div>
                      <div className="banner-art" aria-hidden="true">
                        <div className="orbit one" />
                        <div className="orbit two" />
                        <div className="art-center">
                          <Layers size={35} />
                        </div>
                        <span className="art-node a">
                          <Cpu size={24} />
                        </span>
                        <span className="art-node b">
                          <Activity size={22} />
                        </span>
                        <span className="art-node c">
                          <Database size={22} />
                        </span>
                        <span className="art-cross">+</span>
                        <span className="art-caption">
                          CONNECT · COLLECT · UNDERSTAND
                        </span>
                      </div>
                    </section>
                    <div className="stat-grid">
                      <Stat
                        label="Connected controllers"
                        value={connected}
                        suffix={"/ " + config.Plcs.length}
                        icon={Cpu}
                        detail={
                          config.Plcs.length
                            ? "Independently monitored"
                            : "Waiting for your first connection"
                        }
                        color="sage"
                      />
                      <Stat
                        label="Mapped sensors"
                        value={countSensors}
                        icon={Radio}
                        detail={`${live.filter((r) => r.Quality === "Good").length} readings with good quality`}
                        color="blue"
                      />
                      <Stat
                        label="Pending delivery"
                        value={fmt(health?.Buffer.Pending ?? 0)}
                        icon={Database}
                        detail={
                          config.CloudUrl
                            ? "Buffered until cloud acknowledgment"
                            : "Safely retained in local storage"
                        }
                        color="sand"
                      />
                      <Stat
                        label="Signals to review"
                        value={issueCount}
                        icon={Activity}
                        detail={
                          issueCount
                            ? "Check quality in the live monitor"
                            : "No quality issues reported"
                        }
                        color="pink"
                      />
                    </div>
                    <div className="overview-grid">
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>
                              Controller health{" "}
                              <span className="count">
                                {config.Plcs.length}
                              </span>
                            </h2>
                            <p>A pulse on every connection.</p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => navigate("controllers")}
                          >
                            View all <ArrowUpRight size={15} />
                          </button>
                        </div>
                        {!config.Plcs.length ? (
                          <Empty
                            icon={Cpu}
                            title="Your floor, connected"
                            detail="Add a controller to see connection health, cycle time, and mapped signals here."
                            action={
                              <Button
                                icon={Plus}
                                onClick={() => setModal("controller")}
                              >
                                Add controller
                              </Button>
                            }
                          />
                        ) : (
                          <div className="controller-health-list">
                            {config.Plcs.map((p) => {
                              const h = health?.Plcs.find(
                                (h) => h.PlcId === p.Id,
                              );
                              return (
                                <button
                                  className="health-row"
                                  key={p.Id}
                                  onClick={() => editPlc(p.Id)}
                                >
                                  <span
                                    className={
                                      "device-icon " +
                                      (h?.State === "Connected"
                                        ? "connected"
                                        : "")
                                    }
                                  >
                                    <Cpu size={23} />
                                  </span>
                                  <div>
                                    <strong>{p.Name}</strong>
                                    <small>
                                      {protocols[p.ProfileId].short}{" "}
                                      <span>·</span>{" "}
                                      {p.Host ||
                                        p.Connection.SerialPath ||
                                        p.Connection.Endpoint ||
                                        "Not configured"}
                                    </small>
                                  </div>
                                  <Badge value={h?.State ?? "Waiting"} />
                                  <ChevronRight size={16} />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="panel-foot">
                          <ShieldCheck size={14} />
                          Acquisition uses read commands only.
                        </div>
                      </section>
                      <section className="panel pipeline">
                        <div className="panel-head">
                          <div>
                            <h2>Your data journey</h2>
                            <p>From equipment to insight.</p>
                          </div>
                          <Link2 size={18} />
                        </div>
                        {[
                          [
                            Cpu,
                            "Connect equipment",
                            `${connected} controller${connected === 1 ? "" : "s"} connected`,
                            connected > 0,
                          ],
                          [
                            Activity,
                            "Collect observations",
                            `${fmt(health?.Buffer.Total ?? 0)} persisted measurements`,
                            (health?.Buffer.Total ?? 0) > 0,
                          ],
                          [
                            Database,
                            "Buffer locally",
                            "SQLite · durable local storage",
                            !!health,
                          ],
                          [
                            Cloud,
                            "Deliver to cloud",
                            config.CloudUrl
                              ? health?.Upload
                              : "Optional · not configured",
                            !!config.CloudUrl,
                          ],
                        ].map(([Icon, t, d, on], i) => (
                          <div
                            className={"pipeline-step " + (on ? "done" : "")}
                            key={t}
                          >
                            <span className="pipeline-icon">
                              <Icon size={19} />
                            </span>
                            <div>
                              <strong>{t}</strong>
                              <small>{d}</small>
                            </div>
                            {on ? (
                              <Check size={15} />
                            ) : (
                              <span className="step-number">0{i + 1}</span>
                            )}
                          </div>
                        ))}
                        <button
                          className="text-button"
                          onClick={() => navigate("delivery")}
                        >
                          Manage delivery <ArrowRight size={15} />
                        </button>
                      </section>
                    </div>
                    <section className="panel protocols">
                      <div className="panel-head">
                        <div>
                          <h2>Different equipment. One workspace.</h2>
                          <p>
                            Seven real protocol adapters. Configure the one your
                            hardware speaks.
                          </p>
                        </div>
                        <span className="subtle-label">
                          MULTI-PROTOCOL GATEWAY
                        </span>
                      </div>
                      <div className="protocol-strip">
                        {Object.entries(protocols).map(([id, p]) => (
                          <button key={id} onClick={() => newPlc(id)}>
                            <Network size={19} />
                            <strong>{p.short}</strong>
                            <span>
                              {id === "slmp"
                                ? "Mitsubishi"
                                : id === "s7"
                                  ? "Siemens"
                                  : id === "cip"
                                    ? "Rockwell"
                                    : id === "fins"
                                      ? "Omron"
                                      : "Multi-vendor"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                )}
                {page === "controllers" && !plc && (
                  <>
                    <Toolbar
                      query={query}
                      setQuery={setQuery}
                      placeholder="Search controllers…"
                    >
                      <span className="muted">
                        {filteredPlcs.length} controllers
                      </span>
                    </Toolbar>
                    {!filteredPlcs.length ? (
                      <section className="panel">
                        <Empty
                          icon={Cpu}
                          title={
                            query
                              ? "No controllers match"
                              : "Make your first connection"
                          }
                          detail="Choose a protocol, enter your equipment’s connection settings, then map a readable signal."
                          action={
                            <Button
                              icon={Plus}
                              variant="primary"
                              onClick={() => setModal("controller")}
                            >
                              Add controller
                            </Button>
                          }
                        />
                      </section>
                    ) : (
                      <div className="controller-grid">
                        {filteredPlcs.map((p) => (
                          <div className="panel controller-card" key={p.Id}>
                            <div className="controller-card-top">
                              <span className="device-icon">
                                <Cpu size={26} />
                              </span>
                              <Badge
                                value={
                                  health?.Plcs.find((h) => h.PlcId === p.Id)
                                    ?.State ?? "Waiting"
                                }
                              />
                            </div>
                            <h2>{p.Name}</h2>
                            <p>{p.Model || "Exact model not entered"}</p>
                            <dl>
                              <div>
                                <dt>Protocol</dt>
                                <dd>{protocols[p.ProfileId].name}</dd>
                              </div>
                              <div>
                                <dt>Connection</dt>
                                <dd className="mono">
                                  {p.Host
                                    ? `${p.Host}:${p.Port}`
                                    : p.Connection.SerialPath ||
                                      p.Connection.Endpoint ||
                                      "Not configured"}
                                </dd>
                              </div>
                              <div>
                                <dt>Mapped signals</dt>
                                <dd>{p.Sensors.length}</dd>
                              </div>
                            </dl>
                            <div className="controller-card-foot">
                              <button
                                className="text-button"
                                onClick={() => editPlc(p.Id)}
                              >
                                Open workspace <ArrowRight size={15} />
                              </button>
                              <Button
                                icon={Copy}
                                variant="icon-only"
                                aria-label={"Clone " + p.Name}
                                onClick={() => {
                                  const copy = structuredClone(p);
                                  copy.Id = uuid();
                                  copy.Name += " copy";
                                  copy.Enabled = false;
                                  copy.Sensors.forEach((s) => (s.Id = uuid()));
                                  mutate((c) => c.Plcs.push(copy));
                                  notify(
                                    "Controller cloned, with acquisition disabled.",
                                  );
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {page === "controllers" && plc && (
                  <>
                    <div className="detail-top">
                      <button
                        className="text-button"
                        onClick={() => setSelected(null)}
                      >
                        <ArrowLeft size={16} />
                        All controllers
                      </button>
                      <div className="row">
                        <Badge value={diagnostics?.State ?? "Waiting"} />
                        <Button
                          icon={Copy}
                          onClick={() => {
                            const copy = structuredClone(plc);
                            copy.Id = uuid();
                            copy.Name += " copy";
                            copy.Enabled = false;
                            copy.Sensors.forEach((s) => (s.Id = uuid()));
                            mutate((c) => c.Plcs.push(copy));
                            setSelected(copy.Id);
                          }}
                        >
                          Clone
                        </Button>
                        <Button
                          icon={Trash2}
                          variant="danger-ghost"
                          onClick={() =>
                            setModal({ kind: "deletePlc", id: plc.Id })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="tabs">
                      {[
                        ["connection", "Connection", Link2],
                        ["sensors", "Sensor mappings", Layers],
                        ["physical", "Physical I/O", Box],
                        ["diagnostics", "Diagnostics", Activity],
                      ].map(([id, label, Icon]) => (
                        <button
                          key={id}
                          className={tab === id ? "active" : ""}
                          onClick={() => setTab(id)}
                        >
                          <Icon size={16} />
                          {label}
                          {id === "sensors" && (
                            <span className="count">{plc.Sensors.length}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {tab === "connection" && (
                      <div className="connection-grid">
                        <section className="panel form-panel">
                          <div className="section-label">
                            <span>01</span>
                            <div>
                              <h2>Controller identity</h2>
                              <p>
                                Give this connection a place in your operation.
                              </p>
                            </div>
                          </div>
                          <div className="form-grid">
                            <Field label="Controller name">
                              <Input
                                value={plc.Name}
                                onChange={(v) => updatePlc(plc.Id, "Name", v)}
                              />
                            </Field>
                            <Field label="Protocol adapter">
                              <Select
                                value={plc.ProfileId}
                                onChange={(v) => {
                                  mutate((c) => {
                                    const p = c.Plcs.find(
                                      (p) => p.Id === plc.Id,
                                    );
                                    p.ProfileId = v;
                                    p.Port = catalog.find(
                                      (x) => x.Id === v,
                                    ).Port;
                                    p.Enabled = false;
                                  });
                                  notify(
                                    "Protocol changed. Review every sensor address before enabling.",
                                  );
                                }}
                              >
                                {catalog.map((p) => (
                                  <option key={p.Id} value={p.Id}>
                                    {p.Protocol}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Exact CPU model / order code">
                              <Input
                                placeholder="e.g. FX5U-32MT/ES"
                                value={plc.Model}
                                onChange={(v) => updatePlc(plc.Id, "Model", v)}
                              />
                            </Field>
                            <Field label="Firmware version">
                              <Input
                                value={plc.Firmware}
                                onChange={(v) =>
                                  updatePlc(plc.Id, "Firmware", v)
                                }
                              />
                            </Field>
                            <Field
                              className="span-2"
                              label="Network interface / module"
                            >
                              <Input
                                value={plc.Interface}
                                onChange={(v) =>
                                  updatePlc(plc.Id, "Interface", v)
                                }
                              />
                            </Field>
                          </div>
                          <div className="form-divider" />
                          <div className="section-label">
                            <span>02</span>
                            <div>
                              <h2>Connection settings</h2>
                              <p>{protocols[plc.ProfileId].name}</p>
                            </div>
                          </div>
                          <div className="form-grid">
                            {plc.ProfileId === "modbus-rtu" ? (
                              <>
                                <Field
                                  className="span-2"
                                  label="Serial port on gateway"
                                  help="Windows: COM3 · Linux: /dev/ttyUSB0"
                                >
                                  <Input
                                    placeholder="COM3"
                                    value={plc.Connection.SerialPath}
                                    onChange={(v) =>
                                      updateConnection("SerialPath", v)
                                    }
                                  />
                                </Field>
                                <Field label="Baud rate">
                                  <Input
                                    type="number"
                                    value={plc.Connection.BaudRate}
                                    onChange={(v) =>
                                      updateConnection("BaudRate", v)
                                    }
                                  />
                                </Field>
                                <Field label="Parity">
                                  <Select
                                    value={plc.Connection.Parity}
                                    onChange={(v) =>
                                      updateConnection("Parity", v)
                                    }
                                  >
                                    {["none", "even", "odd"].map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field label="Data bits">
                                  <Select
                                    value={plc.Connection.DataBits}
                                    onChange={(v) =>
                                      updateConnection("DataBits", Number(v))
                                    }
                                  >
                                    {[7, 8].map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field label="Stop bits">
                                  <Select
                                    value={plc.Connection.StopBits}
                                    onChange={(v) =>
                                      updateConnection("StopBits", Number(v))
                                    }
                                  >
                                    {[1, 2].map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </Select>
                                </Field>
                              </>
                            ) : plc.ProfileId === "opcua" ? (
                              <>
                                <Field
                                  className="span-2"
                                  label="OPC UA endpoint"
                                >
                                  <Input
                                    placeholder="opc.tcp://192.168.1.10:4840"
                                    value={plc.Connection.Endpoint}
                                    onChange={(v) =>
                                      updateConnection("Endpoint", v)
                                    }
                                  />
                                </Field>
                                <Field label="Security mode">
                                  <Select
                                    value={plc.Connection.SecurityMode}
                                    onChange={(v) =>
                                      updateConnection("SecurityMode", v)
                                    }
                                  >
                                    {["None", "Sign", "SignAndEncrypt"].map(
                                      (x) => (
                                        <option key={x}>{x}</option>
                                      ),
                                    )}
                                  </Select>
                                </Field>
                                <Field label="Security policy">
                                  <Select
                                    value={plc.Connection.SecurityPolicy}
                                    onChange={(v) =>
                                      updateConnection("SecurityPolicy", v)
                                    }
                                  >
                                    {[
                                      "None",
                                      "Basic256Sha256",
                                      "Aes128_Sha256_RsaOaep",
                                      "Aes256_Sha256_RsaPss",
                                    ].map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field
                                  className="span-2"
                                  label="Credential environment prefix (optional)"
                                  help="e.g. PLC1 → PLC1_USERNAME and PLC1_PASSWORD on the gateway. Empty = anonymous."
                                >
                                  <Input
                                    placeholder="PLC1"
                                    value={plc.Connection.CredentialRef}
                                    onChange={(v) =>
                                      updateConnection("CredentialRef", v)
                                    }
                                  />
                                </Field>
                                <Field label="Client certificate path (optional)">
                                  <Input
                                    value={plc.Connection.CertificateFile}
                                    onChange={(v) =>
                                      updateConnection("CertificateFile", v)
                                    }
                                  />
                                </Field>
                                <Field label="Private key path (optional)">
                                  <Input
                                    value={plc.Connection.PrivateKeyFile}
                                    onChange={(v) =>
                                      updateConnection("PrivateKeyFile", v)
                                    }
                                  />
                                </Field>
                              </>
                            ) : (
                              <>
                                <Field label="PLC IP address / hostname">
                                  <Input
                                    placeholder="192.168.1.10"
                                    value={plc.Host}
                                    onChange={(v) =>
                                      updatePlc(plc.Id, "Host", v)
                                    }
                                  />
                                </Field>
                                <Field
                                  label={
                                    plc.ProfileId === "fins"
                                      ? "UDP port"
                                      : "TCP port"
                                  }
                                >
                                  <Input
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={plc.Port}
                                    disabled={plc.ProfileId === "cip"}
                                    onChange={(v) =>
                                      updatePlc(plc.Id, "Port", v)
                                    }
                                  />
                                </Field>
                              </>
                            )}
                            {plc.ProfileId.startsWith("modbus") && (
                              <Field label="Unit / station ID">
                                <Input
                                  type="number"
                                  min="1"
                                  max="247"
                                  value={plc.Connection.UnitId}
                                  onChange={(v) =>
                                    updateConnection("UnitId", v)
                                  }
                                />
                              </Field>
                            )}
                            {plc.ProfileId === "slmp" && (
                              <Field
                                className="span-2"
                                label="3E frame encoding"
                              >
                                <Select
                                  value={plc.FrameMode}
                                  onChange={(v) =>
                                    updatePlc(plc.Id, "FrameMode", v)
                                  }
                                >
                                  <option value="Binary">
                                    Binary · direct CPU
                                  </option>
                                  <option value="AsciiOctal">
                                    ASCII · X/Y octal
                                  </option>
                                  <option value="AsciiHex">
                                    ASCII · X/Y hexadecimal wire format
                                  </option>
                                </Select>
                              </Field>
                            )}
                            {plc.ProfileId === "s7" && (
                              <>
                                {["Rack", "Slot"].map((k) => (
                                  <Field
                                    key={k}
                                    label={"CPU " + k.toLowerCase()}
                                  >
                                    <Input
                                      type="number"
                                      value={plc.Connection[k]}
                                      onChange={(v) => updateConnection(k, v)}
                                    />
                                  </Field>
                                ))}
                              </>
                            )}
                            {plc.ProfileId === "cip" && (
                              <Field label="CPU slot">
                                <Input
                                  type="number"
                                  value={plc.Connection.CpuSlot}
                                  onChange={(v) =>
                                    updateConnection("CpuSlot", v)
                                  }
                                />
                              </Field>
                            )}
                            {plc.ProfileId === "fins" && (
                              <>
                                {[
                                  ["SourceNode", "Gateway source node"],
                                  ["DestinationNode", "PLC destination node"],
                                  ["SourceNetwork", "Source network"],
                                  ["DestinationNetwork", "Destination network"],
                                ].map(([k, l]) => (
                                  <Field key={k} label={l}>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="254"
                                      value={plc.Connection[k]}
                                      onChange={(v) => updateConnection(k, v)}
                                    />
                                  </Field>
                                ))}
                              </>
                            )}
                            <Field label="Polling interval (ms)">
                              <Input
                                type="number"
                                min="250"
                                value={plc.PollMs}
                                onChange={(v) => updatePlc(plc.Id, "PollMs", v)}
                              />
                            </Field>
                            <Field label="Response timeout (ms)">
                              <Input
                                type="number"
                                min="250"
                                max="60000"
                                value={plc.TimeoutMs}
                                onChange={(v) =>
                                  updatePlc(plc.Id, "TimeoutMs", v)
                                }
                              />
                            </Field>
                          </div>
                          <div className="enable-box">
                            <div>
                              <strong>Read-only acquisition</strong>
                              <p>
                                Starts after saving. Requires at least one valid
                                mapping.
                              </p>
                            </div>
                            <Toggle
                              label={plc.Enabled ? "Enabled" : "Disabled"}
                              checked={plc.Enabled}
                              onChange={(v) => updatePlc(plc.Id, "Enabled", v)}
                            />
                          </div>
                          <div className="form-footer">
                            <Button
                              icon={Check}
                              variant="primary"
                              onClick={save}
                              disabled={busy}
                            >
                              Save & apply
                            </Button>
                            <Button
                              icon={Radio}
                              onClick={() => test(plc.Id)}
                              disabled={busy || dirty || !plc.Sensors.length}
                            >
                              {busy ? "Reading…" : "Test first saved mapping"}
                            </Button>
                          </div>
                        </section>
                        <aside className="connection-aside">
                          <div className="panel guide-card">
                            <span className="guide-icon">
                              <Network size={25} />
                            </span>
                            <div className="eyebrow">CONNECTION NOTES</div>
                            <h2>Set up with confidence.</h2>
                            <p>{protocols[plc.ProfileId].hint}</p>
                            <div className="guide-divider" />
                            <div className="guide-check">
                              <ShieldCheck size={17} />
                              <span>Read operations only</span>
                            </div>
                            <div className="guide-check">
                              <Database size={17} />
                              <span>Persisted before display</span>
                            </div>
                            <div className="guide-check">
                              <FileClock size={17} />
                              <span>Every configuration is versioned</span>
                            </div>
                            <div className="note">
                              Adapter availability does not certify a CPU,
                              firmware, or wiring configuration. Confirm the
                              exact hardware and approved PLC map.
                            </div>
                          </div>
                          <div className="panel next-card">
                            <span className="step-number">NEXT STEP</span>
                            <h3>Give your data meaning.</h3>
                            <p>Map a readable address to a named sensor.</p>
                            <button
                              className="text-button"
                              onClick={() => setTab("sensors")}
                            >
                              Configure sensor mappings <ArrowRight size={15} />
                            </button>
                          </div>
                        </aside>
                      </div>
                    )}
                    {(tab === "sensors" || tab === "physical") && (
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>
                              {tab === "physical"
                                ? "Physical installation references"
                                : "Sensor mappings"}{" "}
                              <span className="count">
                                {plc.Sensors.length}
                              </span>
                            </h2>
                            <p>
                              {tab === "physical"
                                ? "Operator-entered references. Terminals do not determine PLC addresses."
                                : "Configure addresses, scaling, types, and engineering limits."}
                            </p>
                          </div>
                          <div className="row">
                            {tab === "sensors" && (
                              <>
                                <Button
                                  icon={FileInput}
                                  onClick={() => {
                                    setSensorPlc(plc.Id);
                                    setPreview(null);
                                    setModal("import");
                                  }}
                                >
                                  Import CSV
                                </Button>
                                <Button
                                  icon={Copy}
                                  onClick={() => {
                                    setSensorPlc(plc.Id);
                                    setGroup((g) => ({
                                      ...g,
                                      Address: protocols[plc.ProfileId].example,
                                    }));
                                    setPreview(null);
                                    setModal("group");
                                  }}
                                >
                                  Repeated group
                                </Button>
                              </>
                            )}
                            <Button
                              icon={Plus}
                              variant="primary"
                              onClick={() => addSensor(plc.Id)}
                            >
                              Add sensor
                            </Button>
                          </div>
                        </div>
                        {!plc.Sensors.length ? (
                          <Empty
                            icon={Layers}
                            title="Make your first mapping"
                            detail={`Start with a known readable address, such as ${protocols[plc.ProfileId].example}. Use your approved PLC program map.`}
                            action={
                              <Button
                                icon={Plus}
                                onClick={() => addSensor(plc.Id)}
                              >
                                Add sensor
                              </Button>
                            }
                          />
                        ) : (
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Sensor / group</th>
                                  <th>PLC address</th>
                                  {tab === "physical" ? (
                                    <>
                                      <th>Module / slot</th>
                                      <th>Channel / terminal</th>
                                      <th>Reference</th>
                                    </>
                                  ) : (
                                    <>
                                      <th>Data type</th>
                                      <th>Conversion</th>
                                      <th>Limits</th>
                                    </>
                                  )}
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {plc.Sensors.map((s) => (
                                  <tr key={s.Id}>
                                    <td>
                                      <strong>{s.Name}</strong>
                                      <small>{s.Group || "Ungrouped"}</small>
                                    </td>
                                    <td className="mono">{s.Address}</td>
                                    {tab === "physical" ? (
                                      <>
                                        <td>
                                          {s.ModuleSku || "—"}
                                          <small>Slot {s.Slot || "—"}</small>
                                        </td>
                                        <td>
                                          {s.Channel || "—"} /{" "}
                                          {s.Terminal || "—"}
                                          <small>
                                            Unverified operator entry
                                          </small>
                                        </td>
                                        <td>
                                          {s.ManualReference || "No reference"}
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td>
                                          <span className="type-chip">
                                            {s.Type}
                                          </span>
                                        </td>
                                        <td className="mono">
                                          × {s.Scale}{" "}
                                          {s.Offset >= 0 ? "+" : "−"}{" "}
                                          {Math.abs(s.Offset)}{" "}
                                          <small>
                                            {s.Unit || "No unit"}
                                            {s.SwapWords
                                              ? " · swapped words"
                                              : ""}
                                          </small>
                                        </td>
                                        <td>
                                          {fmt(s.Min)} – {fmt(s.Max)}
                                        </td>
                                      </>
                                    )}
                                    <td>
                                      <div className="row">
                                        <button
                                          className="text-button"
                                          onClick={() => {
                                            setSensorPlc(plc.Id);
                                            setSensorForm(structuredClone(s));
                                            setSensorTab(
                                              tab === "physical"
                                                ? "physical"
                                                : "mapping",
                                            );
                                            setModal("sensor");
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="icon-button danger-ghost"
                                          aria-label={"Remove " + s.Name}
                                          onClick={() =>
                                            setModal({
                                              kind: "deleteSensor",
                                              plcId: plc.Id,
                                              id: s.Id,
                                            })
                                          }
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}
                    {tab === "diagnostics" && (
                      <>
                        <div className="stat-grid">
                          <Stat
                            label="Connection"
                            value={diagnostics?.State ?? "Waiting"}
                            icon={Link2}
                            detail={
                              plc.Enabled
                                ? "Acquisition enabled"
                                : "Acquisition disabled"
                            }
                            color="sage"
                          />
                          <Stat
                            label="Last cycle"
                            value={Math.round(diagnostics?.CycleMs ?? 0)}
                            suffix="ms"
                            icon={Activity}
                            detail="Measured on the gateway"
                            color="blue"
                          />
                          <Stat
                            label="Mapped sensors"
                            value={plc.Sensors.length}
                            icon={Radio}
                            detail="Configured read-only mappings"
                            color="sand"
                          />
                          <Stat
                            label="Configured poll"
                            value={plc.PollMs}
                            suffix="ms"
                            icon={RefreshCw}
                            detail="Cycles never overlap per PLC"
                            color="pink"
                          />
                        </div>
                        <section className="panel form-panel">
                          <h2>Last connection result</h2>
                          <p className="diagnostic-result">
                            {diagnostics?.Detail ??
                              "No connection attempted yet."}
                          </p>
                          <div className="key-values">
                            <div>
                              <span>Last update</span>
                              <strong>{date(diagnostics?.UpdatedUtc)}</strong>
                            </div>
                            <div>
                              <span>Protocol adapter</span>
                              <strong>{protocols[plc.ProfileId].name}</strong>
                            </div>
                            <div>
                              <span>Hardware qualification</span>
                              <strong>
                                Unqualified · verify exact CPU and firmware
                              </strong>
                            </div>
                            <div>
                              <span>Active configuration</span>
                              <strong className="mono">
                                {health?.Revision.slice(0, 12)}
                              </strong>
                            </div>
                          </div>
                          <Button
                            icon={Radio}
                            onClick={() => test(plc.Id)}
                            disabled={dirty || busy || !plc.Sensors.length}
                          >
                            Test first saved mapping
                          </Button>
                        </section>
                      </>
                    )}
                  </>
                )}
                {page === "sensors" && (
                  <>
                    <Toolbar
                      query={query}
                      setQuery={setQuery}
                      placeholder="Search mappings, addresses, groups…"
                    >
                      <Button icon={Plus} onClick={() => addSensor()}>
                        Add sensor
                      </Button>
                    </Toolbar>
                    <section className="panel">
                      {allSensors.length ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Sensor / group</th>
                                <th>Controller</th>
                                <th>Address</th>
                                <th>Data type</th>
                                <th>Unit</th>
                                <th>Scale / offset</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {allSensors.map((s) => (
                                <tr key={s.plc.Id + s.Id}>
                                  <td>
                                    <strong>{s.Name}</strong>
                                    <small>{s.Group || "Ungrouped"}</small>
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => editPlc(s.plc.Id)}
                                    >
                                      {s.plc.Name}
                                    </button>
                                  </td>
                                  <td className="mono">{s.Address}</td>
                                  <td>
                                    <span className="type-chip">{s.Type}</span>
                                  </td>
                                  <td>{s.Unit || "—"}</td>
                                  <td className="mono">
                                    {s.Scale} / {s.Offset}
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        setSensorPlc(s.plc.Id);
                                        const { plc, ...form } = s;
                                        setSensorForm(form);
                                        setSensorTab("mapping");
                                        setModal("sensor");
                                      }}
                                    >
                                      Edit mapping <ArrowUpRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          icon={Layers}
                          title={
                            query
                              ? "No matching mappings"
                              : "Map your first signal"
                          }
                          detail="A sensor mapping connects a PLC address to a name, unit, and engineering conversion."
                          action={
                            <Button icon={Plus} onClick={() => addSensor()}>
                              Add sensor
                            </Button>
                          }
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "monitor" && (
                  <>
                    <div className="monitor-status">
                      <div>
                        <i className={paused ? "offline-dot" : "live-dot"} />
                        <strong>
                          {paused
                            ? "Display paused"
                            : "Auto-refresh every 2 seconds"}
                        </strong>
                        <span>
                          Collection continues independently on the gateway.
                        </span>
                      </div>
                      <Button
                        icon={paused ? Play : Pause}
                        onClick={() => setPaused(!paused)}
                      >
                        {paused ? "Resume display" : "Pause display"}
                      </Button>
                    </div>
                    <Toolbar
                      query={query}
                      setQuery={setQuery}
                      placeholder="Find a signal or controller…"
                    >
                      <Badge value={issueCount ? "Attention" : "Good"}>
                        {issueCount
                          ? issueCount + " to review"
                          : "Quality overview"}
                      </Badge>
                    </Toolbar>
                    <section className="panel">
                      {latest.length ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Sensor</th>
                                <th>Controller / address</th>
                                <th>Engineering value</th>
                                <th>Raw value</th>
                                <th>Quality</th>
                                <th>Observed time</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {latest.map((r) => (
                                <tr key={r.PlcId + r.SensorId}>
                                  <td>
                                    <strong>{r.Name}</strong>
                                    <small>
                                      {r.Detail || "Read-only mapping"}
                                    </small>
                                  </td>
                                  <td>
                                    {
                                      config.Plcs.find((p) => p.Id === r.PlcId)
                                        ?.Name
                                    }
                                    <small className="mono">{r.Address}</small>
                                  </td>
                                  <td>
                                    <span className="reading-value">
                                      {fmt(r.Value)}
                                    </span>
                                    <span className="unit">{r.Unit}</span>
                                  </td>
                                  <td className="mono">
                                    {fmt(r.Raw)}
                                    <small>
                                      {r.RawHex
                                        ? "0x" + r.RawHex
                                        : "Raw bytes unavailable"}
                                    </small>
                                  </td>
                                  <td>
                                    <Badge value={r.Quality} />
                                  </td>
                                  <td className="mono">
                                    {when(r.ObservedAtUtc)}
                                    <small>
                                      {r.ObservedAtUtc
                                        ? "Gateway observed time"
                                        : "No observation"}
                                    </small>
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={"Inspect " + r.Name}
                                      onClick={() =>
                                        setModal({
                                          kind: "reading",
                                          reading: r,
                                        })
                                      }
                                    >
                                      <ArrowUpRight size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          icon={Activity}
                          title={
                            query
                              ? "No matching signals"
                              : "Listening starts with a mapping"
                          }
                          detail="Configure a controller and a readable sensor address, then enable acquisition."
                          action={
                            <Button
                              icon={Plus}
                              onClick={() => setModal("controller")}
                            >
                              Connect equipment
                            </Button>
                          }
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "history" && (
                  <>
                    <div className="history-toolbar">
                      <div className="row">
                        <Select
                          aria-label="Filter by controller"
                          value={historyPlc}
                          onChange={setHistoryPlc}
                        >
                          <option value="">All controllers</option>
                          {config.Plcs.map((p) => (
                            <option value={p.Id} key={p.Id}>
                              {p.Name}
                            </option>
                          ))}
                        </Select>
                        <Select
                          aria-label="Filter by quality"
                          value={historyQuality}
                          onChange={setHistoryQuality}
                        >
                          <option value="">All qualities</option>
                          {[
                            "Good",
                            "UncertainRange",
                            "BadCommunication",
                            "BadTimeout",
                            "BadProtocol",
                            "BadDecode",
                          ].map((q) => (
                            <option key={q}>{q}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="row">
                        <Button
                          icon={RefreshCw}
                          onClick={() => fetchHistory(false)}
                          disabled={historyBusy}
                        >
                          Refresh
                        </Button>
                        <Button
                          icon={Download}
                          onClick={exportCsv}
                          disabled={busy}
                        >
                          Export CSV
                        </Button>
                      </div>
                    </div>
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Observation history</h2>
                          <p>
                            Newest first · stored in UTC · displayed in your
                            browser’s local time.
                          </p>
                        </div>
                        <span className="muted">{history.length} loaded</span>
                      </div>
                      {history.length ? (
                        <>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Observed time</th>
                                  <th>Sensor / controller</th>
                                  <th>Raw → scaled</th>
                                  <th>Quality</th>
                                  <th>Delivery</th>
                                  <th>Event ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((row) => {
                                  const m = row.Measurement,
                                    p = config.Plcs.find(
                                      (p) => p.Id === m.PlcId,
                                    );
                                  return (
                                    <tr key={row.Sequence}>
                                      <td className="mono">
                                        {when(m.ObservedAtUtc)}
                                        <small>
                                          {new Date(
                                            m.ObservedAtUtc,
                                          ).toLocaleDateString()}
                                        </small>
                                      </td>
                                      <td>
                                        <strong>
                                          {p?.Sensors.find(
                                            (s) => s.Id === m.SensorId,
                                          )?.Name ?? m.SensorId}
                                        </strong>
                                        <small>{p?.Name ?? m.PlcId}</small>
                                      </td>
                                      <td className="mono">
                                        {fmt(m.RawValue)} →{" "}
                                        <strong>{fmt(m.Value)}</strong> {m.Unit}
                                      </td>
                                      <td>
                                        <Badge value={m.Quality} />
                                      </td>
                                      <td>
                                        <Badge value={row.Delivery} />
                                      </td>
                                      <td>
                                        <button
                                          className="text-button mono"
                                          onClick={() =>
                                            setModal({
                                              kind: "reading",
                                              reading: m,
                                            })
                                          }
                                        >
                                          {m.EventId.slice(0, 8)}{" "}
                                          <ArrowUpRight size={13} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="pagination">
                            <span>
                              History and pending events survive gateway
                              restarts.
                            </span>
                            <Button
                              onClick={() => fetchHistory(true)}
                              disabled={!historyMore || historyBusy}
                            >
                              {historyBusy
                                ? "Loading…"
                                : historyMore
                                  ? "Load older observations"
                                  : "All observations loaded"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Empty
                          icon={History}
                          title="Your history starts here"
                          detail="Once acquisition begins, every observation is persisted with raw values, quality, and configuration provenance."
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "delivery" && (
                  <>
                    <div className="stat-grid three">
                      <Stat
                        label="Pending acknowledgment"
                        value={fmt(health?.Buffer.Pending ?? 0)}
                        icon={CloudUpload}
                        detail="Retained until explicit event acknowledgment"
                        color="sand"
                      />
                      <Stat
                        label="Acknowledged"
                        value={fmt(health?.Buffer.Acknowledged ?? 0)}
                        icon={Check}
                        detail="Confirmed by your ingestion endpoint"
                        color="sage"
                      />
                      <Stat
                        label="Quarantined"
                        value={fmt(health?.Buffer.Quarantined ?? 0)}
                        icon={TriangleAlert}
                        detail="Rejected events retained for review"
                        color="pink"
                      />
                    </div>
                    <div className="connection-grid">
                      <section className="panel form-panel">
                        <h2>Cloud destination</h2>
                        <p className="section-description">
                          Use an HTTPS ingestion endpoint compatible with the
                          ArcadeOT acknowledgment contract.
                        </p>
                        <Field
                          label="Ingestion URL"
                          help="Full endpoint, such as https://your-server/v1/measurements:ingest"
                        >
                          <Input
                            value={config.CloudUrl}
                            onChange={(v) => mutate((c) => (c.CloudUrl = v))}
                            placeholder="https://…/v1/measurements:ingest"
                          />
                        </Field>
                        <div className="credential-note">
                          <Terminal size={19} />
                          <div>
                            <strong>Credentials stay on the gateway.</strong>
                            <p>
                              Set <code>ARCADEOT_CLOUD_TOKEN</code> in the
                              gateway environment, then restart it. Tokens are
                              never included in configuration exports.
                            </p>
                          </div>
                        </div>
                        <div className="form-footer">
                          <Button
                            icon={Check}
                            variant="primary"
                            onClick={save}
                            disabled={busy}
                          >
                            Save destination
                          </Button>
                          <Button
                            icon={CloudUpload}
                            disabled={busy || dirty || !config.CloudUrl}
                            onClick={() =>
                              run(async () => {
                                setHealth(
                                  await api("/upload", { method: "POST" }),
                                );
                                notify(
                                  "Delivery attempted. Check the status below.",
                                );
                              })
                            }
                          >
                            Send pending events
                          </Button>
                        </div>
                        <div className="delivery-state">
                          <Cloud size={20} />
                          <div>
                            <strong>Delivery status</strong>
                            <p>{health?.Upload}</p>
                          </div>
                        </div>
                      </section>
                      <aside className="panel guide-card">
                        <span className="guide-icon">
                          <ShieldCheck size={24} />
                        </span>
                        <h2>Every event accounted for.</h2>
                        <p>
                          Events retain the same ID across retries. Only IDs
                          explicitly acknowledged by your backend are marked
                          delivered.
                        </p>
                        <div className="guide-divider" />
                        <p>
                          Rejected batches remain in quarantine. Review the
                          endpoint’s rejection reason before retrying.
                        </p>
                        <Button
                          icon={RefreshCw}
                          disabled={busy || !health?.Buffer.Quarantined}
                          onClick={() =>
                            run(async () => {
                              const r = await api("/quarantine/retry", {
                                method: "POST",
                              });
                              notify(
                                `${r.Retried} quarantined events returned to the pending queue.`,
                              );
                              setHealth(await api("/health"));
                            })
                          }
                        >
                          Retry quarantined events
                        </Button>
                      </aside>
                    </div>
                  </>
                )}
                {page === "settings" && (
                  <>
                    <div className="connection-grid">
                      <section className="panel form-panel">
                        <h2>Site identity & storage</h2>
                        <p className="section-description">
                          Settings apply to new observations after saving.
                        </p>
                        <div className="form-grid">
                          <Field
                            className="span-2"
                            label="Site ID"
                            help="Stable installation identifier attached to every new measurement."
                          >
                            <Input
                              value={config.SiteId}
                              onChange={(v) => mutate((c) => (c.SiteId = v))}
                            />
                          </Field>
                          <Field label="Acknowledged retention (days)">
                            <Input
                              type="number"
                              min="1"
                              max="3650"
                              value={config.RetentionDays}
                              onChange={(v) =>
                                mutate((c) => (c.RetentionDays = v))
                              }
                            />
                          </Field>
                          <Field label="Storage capacity (MB)">
                            <Input
                              type="number"
                              min="64"
                              max="102400"
                              value={config.MaxBufferMb}
                              onChange={(v) =>
                                mutate((c) => (c.MaxBufferMb = v))
                              }
                            />
                          </Field>
                        </div>
                        <div className="note">
                          Pending and quarantined events never expire
                          automatically. Acquisition pauses visibly when the
                          database reaches the configured capacity. CSV export
                          does not acknowledge events.
                        </div>
                        <div className="form-footer">
                          <Button
                            icon={Check}
                            variant="primary"
                            onClick={save}
                            disabled={busy}
                          >
                            Save settings
                          </Button>
                        </div>
                        <div className="form-divider" />
                        <h2>Configuration files</h2>
                        <p className="section-description">
                          Export your current draft or preview an imported web
                          configuration.
                        </p>
                        <div className="row">
                          <Button
                            icon={Download}
                            onClick={() =>
                              DownloadFile(
                                "ArcadeOT-web-config.json",
                                JSON.stringify(config, null, 2),
                              )
                            }
                          >
                            Export configuration
                          </Button>
                          <label className="button">
                            <Upload size={16} />
                            Import configuration
                            <input
                              className="sr-only"
                              type="file"
                              accept=".json,application/json"
                              onChange={(e) => {
                                const f = e.target.files[0];
                                if (!f) return;
                                run(async () => {
                                  if (f.size > 2000000)
                                    throw Error("Configuration exceeds 2 MB");
                                  const c = JSON.parse(await f.text());
                                  await api("/config/validate", {
                                    method: "POST",
                                    body: c,
                                  });
                                  if (c.Version !== 3)
                                    throw Error(
                                      "Import requires a web version 3 configuration. Windows v2 remains separate.",
                                    );
                                  setModal({ kind: "importConfig", config: c });
                                });
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </section>
                      <aside className="panel guide-card">
                        <div className="eyebrow">GATEWAY STORAGE</div>
                        <h2>
                          {fmt((health?.Buffer.UsedBytes ?? 0) / 1048576)}{" "}
                          <span className="muted">MB used</span>
                        </h2>
                        <div className="storage-bar">
                          <i
                            style={{
                              width:
                                Math.min(
                                  100,
                                  ((health?.Buffer.UsedBytes ?? 0) /
                                    (config.MaxBufferMb * 1048576)) *
                                    100,
                                ) + "%",
                            }}
                          />
                        </div>
                        <p>of {config.MaxBufferMb} MB configured</p>
                        <div className="guide-divider" />
                        <div className="guide-check">
                          <Database size={17} />
                          SQLite WAL storage
                        </div>
                        <div className="guide-check">
                          <ShieldCheck size={17} />
                          Stable event identifiers
                        </div>
                        <div className="guide-check">
                          <FileClock size={17} />
                          UTC observation timestamps
                        </div>
                        {health?.StorageError && (
                          <div className="note">{health.StorageError}</div>
                        )}
                      </aside>
                    </div>
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Configuration history</h2>
                          <p>
                            Restoring creates a new revision. Measurements and
                            secrets stay intact.
                          </p>
                        </div>
                        <FileClock size={20} />
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Saved time</th>
                              <th>Revision</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {revisions.map((r, i) => (
                              <tr key={r.Revision}>
                                <td>{date(r.SavedUtc)}</td>
                                <td className="mono">
                                  {r.Revision.slice(0, 16)}
                                </td>
                                <td>
                                  {i === 0 ? (
                                    <Badge value="Good">Active revision</Badge>
                                  ) : (
                                    <span className="muted">Historical</span>
                                  )}
                                </td>
                                <td>
                                  <Button
                                    disabled={i === 0 || busy}
                                    icon={History}
                                    onClick={() =>
                                      setModal({ kind: "restore", revision: r })
                                    }
                                  >
                                    Restore
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}
                <footer className="page-footer">
                  <span>
                    <ShieldCheck size={13} /> Read-only acquisition · real
                    equipment data
                  </span>
                  <span>
                    ArcadeOT Web <span className="footer-dot">•</span>{" "}
                    {health
                      ? `Gateway ${health.State.toLowerCase()}`
                      : "Connecting to gateway"}
                  </span>
                </footer>
              </>
            )}
          </main>
        </div>
        {notice && (
          <div className="toast" role="status">
            <Check size={18} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {auth && (
          <Modal
            title="Gateway access"
            subtitle="Enter the access key configured on your gateway."
            onClose={() => setAuth(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accessKey = key;
                load();
              }}
            >
              <div className="modal-body">
                <Field label="Gateway access key">
                  <Input
                    type="password"
                    autoFocus
                    value={key}
                    onChange={setKey}
                  />
                </Field>
                <p className="muted">
                  The key is held in memory for this browser session.
                </p>
              </div>
              <div className="modal-actions">
                <Button variant="primary" type="submit">
                  Connect
                </Button>
              </div>
            </form>
          </Modal>
        )}
        {modal === "controller" && (
          <Modal
            title="Connect a controller"
            subtitle="Choose the protocol configured on your equipment."
            wide
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <div className="protocol-picker">
                {Object.entries(protocols).map(([id, p]) => (
                  <button key={id} onClick={() => newPlc(id)}>
                    <span className="device-icon">
                      <Network size={22} />
                    </span>
                    <strong>{p.name}</strong>
                    <small>
                      {id === "slmp"
                        ? "FX5U and compatible 3E controllers"
                        : id === "modbus-rtu"
                          ? "Serial RTU · RS-232 / RS-485"
                          : id === "opcua"
                            ? "Secure scalar NodeId reads"
                            : id === "cip"
                              ? "Logix symbolic tag reads"
                              : id === "fins"
                                ? "UDP memory-area reads"
                                : id === "s7"
                                  ? "Absolute DB address reads"
                                  : "Registers, coils, and discrete inputs"}
                    </small>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
              <div className="note">
                All adapters perform real reads. You’ll need network or serial
                access from the gateway machine, plus an approved readable
                mapping. Exact hardware compatibility must be verified.
              </div>
            </div>
          </Modal>
        )}
        {modal === "sensor" && sensorForm && (
          <Modal
            title={
              config.Plcs.find((p) => p.Id === sensorPlc)?.Sensors.some(
                (s) => s.Id === sensorForm.Id,
              )
                ? "Edit sensor mapping"
                : "Add a sensor mapping"
            }
            subtitle="Keep physical references separate from readable addresses."
            wide
            onClose={() => setModal(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const p = config.Plcs.find((p) => p.Id === sensorPlc);
                  const sensors = p.Sensors.filter(
                    (s) => s.Id !== sensorForm.Id,
                  );
                  await api("/config/validate", {
                    method: "POST",
                    body: {
                      ...config,
                      Plcs: [{ ...p, Sensors: [...sensors, sensorForm] }],
                    },
                  });
                  persistSensor();
                });
              }}
            >
              <div className="modal-tabs">
                <button
                  type="button"
                  className={sensorTab === "mapping" ? "active" : ""}
                  onClick={() => setSensorTab("mapping")}
                >
                  Signal mapping
                </button>
                <button
                  type="button"
                  className={sensorTab === "physical" ? "active" : ""}
                  onClick={() => setSensorTab("physical")}
                >
                  Physical I/O references
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  {sensorTab === "mapping" ? (
                    <>
                      <Field className="span-2" label="Controller">
                        <Select
                          value={sensorPlc}
                          disabled={config.Plcs.some((p) =>
                            p.Sensors.some((s) => s.Id === sensorForm.Id),
                          )}
                          onChange={(v) => {
                            setSensorPlc(v);
                            setSensorForm((s) => ({
                              ...s,
                              Address:
                                protocols[
                                  config.Plcs.find((p) => p.Id === v).ProfileId
                                ].example,
                            }));
                          }}
                        >
                          {config.Plcs.map((p) => (
                            <option value={p.Id} key={p.Id}>
                              {p.Name} · {protocols[p.ProfileId].short}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Sensor name">
                        <Input
                          required
                          value={sensorForm.Name}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Name: v }))
                          }
                        />
                      </Field>
                      <Field label="Group">
                        <Input
                          value={sensorForm.Group}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Group: v }))
                          }
                        />
                      </Field>
                      <Field
                        className="span-2"
                        label="Readable address / tag / NodeId"
                        help={
                          protocols[
                            config.Plcs.find((p) => p.Id === sensorPlc)
                              ?.ProfileId
                          ]?.hint
                        }
                      >
                        <Input
                          required
                          className="mono"
                          value={sensorForm.Address}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Address: v }))
                          }
                        />
                      </Field>
                      <Field label="Declared data type">
                        <Select
                          value={sensorForm.Type}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Type: v }))
                          }
                        >
                          {types.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Engineering unit">
                        <Input
                          value={sensorForm.Unit}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Unit: v }))
                          }
                        />
                      </Field>
                      <Field label="Scale">
                        <Input
                          type="number"
                          step="any"
                          value={sensorForm.Scale}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Scale: v }))
                          }
                        />
                      </Field>
                      <Field label="Offset">
                        <Input
                          type="number"
                          step="any"
                          value={sensorForm.Offset}
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, Offset: v }))
                          }
                        />
                      </Field>
                      <Field label="Minimum (optional)">
                        <Input
                          type="number"
                          step="any"
                          value={sensorForm.Min}
                          onChange={(v) =>
                            setSensorForm((s) => ({
                              ...s,
                              Min: v === "" ? null : v,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Maximum (optional)">
                        <Input
                          type="number"
                          step="any"
                          value={sensorForm.Max}
                          onChange={(v) =>
                            setSensorForm((s) => ({
                              ...s,
                              Max: v === "" ? null : v,
                            }))
                          }
                        />
                      </Field>
                      <div className="span-2">
                        <Toggle
                          checked={sensorForm.SwapWords}
                          label="Swap 16-bit words for 32-bit register values"
                          onChange={(v) =>
                            setSensorForm((s) => ({ ...s, SwapWords: v }))
                          }
                        />
                      </div>
                      <div className="formula span-2">
                        <span>Engineering value</span>
                        <code>
                          raw × {sensorForm.Scale} + {sensorForm.Offset}
                        </code>
                      </div>
                    </>
                  ) : (
                    <>
                      {[
                        ["ModuleSku", "CPU / module SKU"],
                        ["Slot", "Physical module slot"],
                        ["Channel", "Channel"],
                        ["Terminal", "Terminal designation"],
                        ["Common", "Common group"],
                        ["Signal", "Electrical signal range"],
                        ["SensorModel", "Sensor model"],
                        ["ManualReference", "Manual edition / diagram / page"],
                      ].map(([k, l]) => (
                        <Field key={k} label={l}>
                          <Input
                            value={sensorForm[k]}
                            onChange={(v) =>
                              setSensorForm((s) => ({ ...s, [k]: v }))
                            }
                          />
                        </Field>
                      ))}
                      <div className="note span-2">
                        Unverified operator references. Selecting a terminal
                        does not infer a PLC register, configure physical I/O,
                        or validate wiring.
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <Button type="button" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={Check}
                  disabled={busy}
                >
                  Keep mapping in draft
                </Button>
              </div>
            </form>
          </Modal>
        )}
        {(modal === "group" || modal === "import") && (
          <Modal
            title={
              modal === "group"
                ? "Create a repeated group"
                : "Import sensor mappings"
            }
            subtitle="Preview and validate all mappings before adding them."
            wide
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              {modal === "group" ? (
                <div className="form-grid">
                  {[
                    ["Prefix", "Name prefix", "text"],
                    ["Address", "Starting address", "text"],
                    ["Count", "Number of sensors", "number"],
                    ["Unit", "Engineering unit", "text"],
                    ["Scale", "Scale", "number"],
                  ].map(([k, l, t]) => (
                    <Field key={k} label={l}>
                      <Input
                        type={t}
                        step={k === "Scale" ? "any" : undefined}
                        value={group[k]}
                        onChange={(v) => {
                          setGroup((g) => ({ ...g, [k]: v }));
                          setPreview(null);
                        }}
                      />
                    </Field>
                  ))}
                  <Field label="Data type">
                    <Select
                      value={group.Type}
                      onChange={(v) => {
                        setGroup((g) => ({ ...g, Type: v }));
                        setPreview(null);
                      }}
                    >
                      {types.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </Field>
                  <p className="muted span-2">
                    Repeated groups support SLMP and register-based Modbus/FINS
                    mappings. S7 and symbolic NodeIds/tags use CSV import for
                    explicit addresses.
                  </p>
                </div>
              ) : (
                <>
                  <label className="upload-area">
                    <Upload size={23} />
                    <strong>Choose a CSV file</strong>
                    <span>Required headers: Name,Address · up to 1 MB</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        const f = e.target.files[0];
                        if (f)
                          run(async () => {
                            if (f.size > 1000000)
                              throw Error("CSV exceeds 1 MB");
                            setCsvText(await f.text());
                            setPreview(null);
                          });
                      }}
                    />
                  </label>
                  <Field label="CSV content">
                    <textarea
                      rows="7"
                      className="mono"
                      placeholder={
                        "Name,Address,Type,Scale,Unit\nTemperature,D100,Int16,0.1,°C"
                      }
                      value={csvText}
                      onChange={(e) => {
                        setCsvText(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </Field>
                </>
              )}
              <Button
                icon={Search}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setPreview(null);
                    const p = config.Plcs.find((p) => p.Id === sensorPlc);
                    setPreview(
                      await api("/sensors/preview", {
                        method: "POST",
                        body: {
                          Controller: p,
                          ...(modal === "import"
                            ? { Csv: csvText }
                            : { Group: group }),
                        },
                      }),
                    );
                  })
                }
              >
                Validate & preview
              </Button>
              {preview && (
                <div className="import-preview">
                  <h3>{preview.Sensors.length} mappings ready</h3>
                  {preview.Warnings.map((w) => (
                    <div key={w} className="note">
                      {w}
                    </div>
                  ))}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Address</th>
                          <th>Type</th>
                          <th>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.Sensors.slice(0, 100).map((s) => (
                          <tr key={s.Id}>
                            <td>{s.Name}</td>
                            <td className="mono">{s.Address}</td>
                            <td>{s.Type}</td>
                            <td>{s.Unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                icon={Plus}
                variant="primary"
                disabled={!preview || busy}
                onClick={() => {
                  mutate((c) =>
                    c.Plcs.find((p) => p.Id === sensorPlc).Sensors.push(
                      ...preview.Sensors,
                    ),
                  );
                  setModal(null);
                  notify("Mappings added to draft. Review and save to apply.");
                }}
              >
                Add {preview?.Sensors.length ?? 0} mappings
              </Button>
            </div>
          </Modal>
        )}
        {modal?.kind === "reading" && (
          <Modal
            title="Observation evidence"
            subtitle="Stored values and provenance from the gateway."
            wide
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <pre className="json-evidence">
                {JSON.stringify(modal.reading, null, 2)}
              </pre>
              <Button
                icon={Download}
                onClick={() =>
                  DownloadFile(
                    "ArcadeOT-observation.json",
                    JSON.stringify(modal.reading, null, 2),
                  )
                }
              >
                Export observation
              </Button>
            </div>
          </Modal>
        )}
        {modal?.kind === "deletePlc" && (
          <Modal
            title="Remove this controller?"
            subtitle="This removes its mappings from the draft. Stored observations are retained."
            onClose={() => setModal(null)}
          >
            <div className="modal-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  mutate(
                    (c) => (c.Plcs = c.Plcs.filter((p) => p.Id !== modal.id)),
                  );
                  setSelected(null);
                  setModal(null);
                }}
              >
                Remove controller
              </Button>
            </div>
          </Modal>
        )}
        {modal?.kind === "deleteSensor" && (
          <Modal
            title="Remove this mapping?"
            subtitle="Stored observations stay in history. Save the draft to apply the removal."
            onClose={() => setModal(null)}
          >
            <div className="modal-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  mutate((c) => {
                    const p = c.Plcs.find((p) => p.Id === modal.plcId);
                    p.Sensors = p.Sensors.filter((s) => s.Id !== modal.id);
                  });
                  setModal(null);
                }}
              >
                Remove mapping
              </Button>
            </div>
          </Modal>
        )}
        {modal?.kind === "restore" && (
          <Modal
            title="Restore this configuration?"
            subtitle={
              "Saved " +
              date(modal.revision.SavedUtc) +
              ". This applies immediately as a new revision."
            }
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <div className="note">
                {dirty ? "Your unsaved draft will be replaced. " : ""}This can
                change active equipment connections. Measurements and cloud
                credentials are retained.
              </div>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const c = await api(
                      "/config/restore/" + modal.revision.Revision,
                      { method: "POST" },
                    );
                    setConfig(c);
                    setSaved(JSON.stringify(c));
                    setRevisions(await api("/config/history"));
                    setModal(null);
                    notify("Restored as a new configuration revision.");
                  })
                }
              >
                Restore revision
              </Button>
            </div>
          </Modal>
        )}
        {modal?.kind === "importConfig" && (
          <Modal
            title="Review configuration import"
            subtitle="Replaces the current draft. Collection changes only after Save & apply."
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <pre className="json-evidence">
                {JSON.stringify(modal.config, null, 2)}
              </pre>
              <p>{dirty ? "Your current draft has unsaved changes." : ""}</p>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfig(modal.config);
                  setSelected(null);
                  setModal(null);
                  notify(
                    "Configuration loaded into draft. Validate with Save & apply.",
                  );
                }}
              >
                Load into draft
              </Button>
            </div>
          </Modal>
        )}
        {modal === "help" && (
          <Modal
            title="Get your equipment connected"
            subtitle="The React app talks to your local ArcadeOT gateway."
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <ol className="help-steps">
                <li>
                  <strong>Run the gateway on your PLC network.</strong>
                  <p>
                    The browser cannot open PLC TCP or serial connections. The
                    Node.js gateway handles those connections.
                  </p>
                </li>
                <li>
                  <strong>Add the exact controller and protocol.</strong>
                  <p>
                    For FX5U, use SLMP and the TCP port actually configured in
                    GX Works3. Confirm binary or ASCII frame settings.
                  </p>
                </li>
                <li>
                  <strong>Map one approved readable address.</strong>
                  <p>
                    Choose the declared type, scale, and engineering unit.
                    Physical terminals are separate references.
                  </p>
                </li>
                <li>
                  <strong>Save, test, then enable acquisition.</strong>
                  <p>
                    Connection failures remain explicit. No values are generated
                    or substituted for missing data.
                  </p>
                </li>
              </ol>
            </div>
          </Modal>
        )}
      </div>
    </ErrorContext.Provider>
  );
}
function Stat({ label, value, suffix, icon: Icon, detail, color }) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"stat-icon " + color}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">
        {value}
        <small>{suffix}</small>
      </div>
      <p>{detail}</p>
    </section>
  );
}
function Toolbar({ query, setQuery, placeholder, children }) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      <div className="row">{children}</div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
