using System.Diagnostics;
using ArcadeOT.Domain;
using ArcadeOT.Drivers.Slmp;
namespace ArcadeOT.Service;
public sealed class Collector(GatewayRuntime runtime, ILogger<Collector> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var config = runtime.Config; using var generation = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            runtime.Live.Clear(); runtime.PlcStates.Clear();
            foreach (var plc in config.Plcs) runtime.PlcStates[plc.Id] = new(plc.Id, plc.Enabled ? "Connecting" : "Disabled", "", DateTimeOffset.UtcNow, 0);
            var workers = config.Plcs.Where(p => p.Enabled).Select(p => Poll(config, p, generation.Token)).ToArray();
            try { while (runtime.Config.Revision == config.Revision) await Task.Delay(300, stoppingToken); }
            finally { await generation.CancelAsync(); try { await Task.WhenAll(workers); } catch (OperationCanceledException) { } }
        }
    }
    async Task Poll(SiteConfiguration config, PlcConfiguration plc, CancellationToken ct)
    {
        await using var driver = new SlmpDriver(); int failures = 0;
        while (!ct.IsCancellationRequested)
        {
            var cycle = Stopwatch.StartNew();
            try
            {
                if (!runtime.HasSpace(config)) { Set("StoragePaused", "Buffer or free-disk limit reached", 0); await Task.Delay(5000, ct); continue; }
                bool failed = false; string quality = "Good"; string detail = "";
                foreach (var sensor in plc.Sensors)
                {
                    ct.ThrowIfCancellationRequested();
                    if (!runtime.HasSpace(config)) { Set("StoragePaused", "Buffer limit reached during cycle", cycle.Elapsed.TotalMilliseconds); failed = true; break; }
                    var measurement = failed ? new Measurement(Guid.NewGuid().ToString("N"), config.SiteId, plc.Id, sensor.Id, config.Revision, DateTimeOffset.UtcNow, null, null, null, sensor.Unit, "BadCommunication", "Skipped after connection failure", "") : await driver.ReadAsync(config.SiteId, config.Revision, plc, sensor, ct);
                    runtime.Publish(plc, sensor, measurement);
                    if (measurement.Quality != "Good") { quality = measurement.Quality; detail = measurement.Error ?? ""; }
                    if (measurement.Quality is "BadCommunication" or "BadTimeout") failed = true;
                }
                if (!runtime.PlcStates.TryGetValue(plc.Id, out var state) || state.State != "StoragePaused") Set(quality == "Good" ? "Collecting" : "Degraded", detail, cycle.Elapsed.TotalMilliseconds);
                else if (runtime.HasSpace(config)) Set(quality == "Good" ? "Collecting" : "Degraded", detail, cycle.Elapsed.TotalMilliseconds);
                failures = failed ? Math.Min(5, failures + 1) : 0;
                int interval = failed ? Math.Max(plc.PollMs, Math.Min(30000, 1000 * (1 << failures))) : plc.PollMs;
                await Task.Delay(TimeSpan.FromMilliseconds(Math.Max(1, interval - cycle.Elapsed.TotalMilliseconds)), ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                Set("Faulted", "Collection failed; inspect service log and storage", cycle.Elapsed.TotalMilliseconds);
                logger.LogError(error, "PLC {PlcId} collection fault", plc.Id);
                await Task.Delay(5000, ct);
            }
        }
        void Set(string state, string detail, double ms) => runtime.PlcStates[plc.Id] = new(plc.Id, state, detail, DateTimeOffset.UtcNow, ms);
    }
}
