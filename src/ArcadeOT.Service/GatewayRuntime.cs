using System.Collections.Concurrent;
using System.Globalization;
using ArcadeOT.Domain;
using ArcadeOT.Infrastructure;
namespace ArcadeOT.Service;
public sealed class GatewayRuntime
{
    readonly object gate = new();
    SiteConfiguration configuration;
    public MeasurementStore Store { get; } = new(Path.Combine(StoragePaths.DataDirectory, "arcadeot.db"));
    public ConcurrentDictionary<string, LiveReading> Live { get; } = new();
    public ConcurrentDictionary<string, PlcHealth> PlcStates { get; } = new();
    public DateTimeOffset Started { get; } = DateTimeOffset.UtcNow;
    public string UploadState { get; set; } = "Cloud not configured";
    public GatewayRuntime() { configuration = Store.LoadConfiguration(); ConfigurationValidator.Validate(configuration); }
    public SiteConfiguration Config { get { lock (gate) return JsonContract.Clone(configuration); } }
    public SiteConfiguration Apply(SiteConfiguration config)
    {
        lock (gate) { configuration = Store.SaveConfiguration(config); return JsonContract.Clone(configuration); }
    }
    public bool HasSpace(SiteConfiguration config) => Store.UsedBytes() < (long)config.MaxBufferMb * 1024 * 1024 && new DriveInfo(Path.GetPathRoot(Path.GetFullPath(StoragePaths.DataDirectory))!).AvailableFreeSpace > 100L * 1024 * 1024;
    public void Publish(PlcConfiguration plc, SensorConfiguration sensor, Measurement measurement)
    {
        Store.Append(measurement); // Never show a current reading before durable persistence succeeds.
        Live[plc.Id + "/" + sensor.Id] = new(plc.Id, sensor.Id, sensor.Name, sensor.Address,
            Convert.ToString(measurement.RawValue, CultureInfo.InvariantCulture) ?? "", Convert.ToString(measurement.Value, CultureInfo.InvariantCulture) ?? "", sensor.Unit,
            measurement.Quality, measurement.ObservedAtUtc, measurement.RawHex, measurement.Error ?? "");
    }
    public IReadOnlyList<LiveReading> ReadLive()
    {
        var config = Config; var now = DateTimeOffset.UtcNow;
        return Live.Values.Select(row => config.Plcs.FirstOrDefault(p => p.Id == row.PlcId) is { } plc && now - row.ObservedAtUtc > TimeSpan.FromMilliseconds(Math.Max(plc.PollMs * 3L, plc.TimeoutMs + 5000))
            ? row with { Quality = "Stale", Detail = "No recent observation; last quality: " + row.Quality } : row).OrderBy(x => x.PlcId).ThenBy(x => x.Name).ToArray();
    }
    public GatewayHealth Health()
    {
        var config = Config; var states = PlcStates.Values.OrderBy(x => x.PlcId).ToArray();
        string state = states.Any(x => x.State is "StoragePaused" or "Faulted") ? "Attention required" : states.Any(x => x.State != "Collecting" && x.State != "Disabled") ? "Degraded" : config.Plcs.Any(p => p.Enabled) ? "Collecting" : "Ready · no PLC enabled";
        return new(state, Started, config.Revision, Store.Health(), UploadState, states);
    }
}
