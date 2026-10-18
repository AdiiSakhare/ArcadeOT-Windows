using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ArcadeOT.Domain;
using ArcadeOT.Drivers.Slmp;
using ArcadeOT.Infrastructure;
using ArcadeOT.Service;

if (!File.Exists(StoragePaths.ApiToken)) throw new InvalidOperationException("Install ArcadeOT2 to provision protected API credentials, or set an isolated ARCADEOT_DATA_DIR for development.");
var key = File.ReadAllText(StoragePaths.ApiToken).Trim();
if (key.Length is < 32 or > 256) throw new InvalidOperationException("Invalid API credential length.");
var url = Environment.GetEnvironmentVariable("ARCADEOT_LOCAL_URL") ?? "http://127.0.0.1:17846";
if (!Uri.TryCreate(url, UriKind.Absolute, out var endpoint) || endpoint.Scheme != "http" || endpoint.Host != "127.0.0.1" || endpoint.AbsolutePath != "/" || endpoint.Query != "" || endpoint.UserInfo != "") throw new InvalidOperationException("Local API must bind to an explicit IPv4 loopback HTTP endpoint.");
var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService(options => options.ServiceName = "ArcadeOT2");
builder.WebHost.UseUrls(url);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2_000_000);
builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(10));
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
    options.SerializerOptions.PropertyNameCaseInsensitive = false;
    options.SerializerOptions.UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow;
    options.SerializerOptions.MaxDepth = 32;
});
builder.Services.AddSingleton<GatewayRuntime>();
builder.Services.AddHostedService<Collector>(); builder.Services.AddHostedService<Uploader>();
var app = builder.Build();
app.Use(async (context, next) =>
{
    var supplied = context.Request.Headers["X-ArcadeOT-Key"].ToString();
    if (supplied.Length > 256 || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(supplied), Encoding.UTF8.GetBytes(key)))
    { context.Response.StatusCode = 401; return; }
    try { await next(); }
    catch (Exception error) when (error is ArgumentException or JsonException or BadHttpRequestException)
    {
        if (context.Response.HasStarted) throw;
        context.Response.StatusCode = error is BadHttpRequestException bad ? bad.StatusCode : 400;
        await context.Response.WriteAsJsonAsync(new { Error = error is BadHttpRequestException ? "Invalid or oversized request" : error.Message });
    }
});
app.MapGet("/health", (GatewayRuntime runtime) => runtime.Health());
app.MapGet("/catalog", () => HardwareCatalog.Profiles);
app.MapGet("/config", (GatewayRuntime runtime) => runtime.Config);
app.MapPost("/config", async (HttpContext context, GatewayRuntime runtime) =>
{
    var config = await JsonSerializer.DeserializeAsync<SiteConfiguration>(context.Request.Body, JsonContract.Options, context.RequestAborted);
    ConfigurationValidator.Validate(config);
    return Results.Json(runtime.Apply(config!));
});
app.MapGet("/config/history", (GatewayRuntime runtime) => runtime.Store.Revisions());
app.MapPost("/config/restore/{revision}", (string revision, GatewayRuntime runtime) => runtime.Apply(runtime.Store.GetRevision(revision)));
app.MapGet("/live", (GatewayRuntime runtime) => runtime.ReadLive());
app.MapGet("/history", (long? before, int? limit, GatewayRuntime runtime) => runtime.Store.History(before ?? long.MaxValue, limit ?? 200));
app.MapPost("/quarantine/retry", (GatewayRuntime runtime) => new { Retried = runtime.Store.RetryQuarantined() });
app.MapPost("/cloud-credential", async (HttpContext context) =>
{
    using var memory = new MemoryStream(); var buffer = new byte[1024]; int count;
    while ((count = await context.Request.Body.ReadAsync(buffer, context.RequestAborted)) > 0)
    {
        if (memory.Length + count > 8192) throw new ArgumentException("Credential exceeds 8192 bytes.");
        memory.Write(buffer, 0, count);
    }
    var token = Encoding.UTF8.GetString(memory.ToArray());
    if (token.Length < 1 || token.Any(char.IsControl)) throw new ArgumentException("Credential must be nonempty text without control characters.");
    var temporary = StoragePaths.CloudToken + ".tmp";
    await File.WriteAllTextAsync(temporary, token, context.RequestAborted); File.Move(temporary, StoragePaths.CloudToken, true);
    return Results.Ok();
});
app.MapPost("/plcs/{id}/test", async (string id, GatewayRuntime runtime, HttpContext context) =>
{
    var config = runtime.Config;
    var plc = config.Plcs.FirstOrDefault(p => p.Id == id) ?? throw new ArgumentException("Save this PLC configuration first.");
    var testConfig = JsonContract.Clone(config); var testPlc = testConfig.Plcs.Single(p => p.Id == id); testPlc.Enabled = true;
    ConfigurationValidator.Validate(testConfig);
    await using var driver = new SlmpDriver(); var sensor = plc.Sensors[0];
    var sample = await driver.ReadAsync(config.SiteId, config.Revision, plc, sensor, context.RequestAborted);
    runtime.Store.Append(sample);
    return sample;
});
app.MapGet("/export.csv", async (GatewayRuntime runtime, HttpContext context) =>
{
    context.Response.ContentType = "text/csv; charset=utf-8";
    context.Response.Headers.ContentDisposition = "attachment; filename=ArcadeOT-readings.csv";
    await context.Response.WriteAsync("EventId,SiteId,PlcId,SensorId,ConfigRevision,ObservedAtUtc,SourceAtUtc,RawValue,Value,Unit,Quality,Error,RawHex\r\n", context.RequestAborted);
    foreach (var row in runtime.Store.History(limit: 10000))
    {
        var m = row.Measurement;
        var values = new object?[] { m.EventId, m.SiteId, m.PlcId, m.SensorId, m.ConfigRevision, m.ObservedAtUtc.ToString("O"), m.SourceAtUtc?.ToString("O"), m.RawValue, m.Value, m.Unit, m.Quality, m.Error, m.RawHex };
        await context.Response.WriteAsync(string.Join(",", values.Select(Csv)) + "\r\n", context.RequestAborted);
    }
});
await app.RunAsync();
static string Csv(object? value)
{
    var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
    if (text.TrimStart().StartsWith('=') || text.TrimStart().StartsWith('+') || text.TrimStart().StartsWith('-') || text.TrimStart().StartsWith('@')) text = "'" + text;
    return "\"" + text.Replace("\"", "\"\"") + "\"";
}
