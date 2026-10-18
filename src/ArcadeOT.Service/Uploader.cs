using ArcadeOT.Infrastructure;
namespace ArcadeOT.Service;
public sealed class Uploader(GatewayRuntime runtime, ILogger<Uploader> logger) : BackgroundService
{
    readonly HttpClient http = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(20) };
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        int failures = 0;
        while (!ct.IsCancellationRequested)
        {
            var config = runtime.Config;
            try
            {
                runtime.Store.PruneAcknowledged(config.RetentionDays);
                if (config.CloudUrl == "") runtime.UploadState = "Local buffer · cloud not configured; pending records retained";
                else if (!File.Exists(StoragePaths.CloudToken)) runtime.UploadState = "Cloud credential required";
                else
                {
                    var result = await CloudDelivery.SendAsync(runtime.Store, http, new Uri(config.CloudUrl), File.ReadAllText(StoragePaths.CloudToken).Trim(), ct);
                    runtime.UploadState = result.Quarantined ? "Rejected batch preserved in quarantine · inspect backend before retry" : result.Sent == 0 ? "No eligible pending events" : $"{result.Accepted}/{result.Sent} events acknowledged · {DateTimeOffset.UtcNow:O}";
                }
                failures = 0;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                failures = Math.Min(failures + 1, 6);
                runtime.UploadState = "Upload unavailable · pending events retained; retrying";
                logger.LogWarning("Upload failed ({ErrorType}); records retained", error.GetType().Name);
            }
            await Task.Delay(TimeSpan.FromSeconds(failures == 0 ? 5 : Math.Min(300, 5 * (1 << failures)) + Random.Shared.NextDouble()), ct);
        }
    }
    public override void Dispose() { http.Dispose(); base.Dispose(); }
}
