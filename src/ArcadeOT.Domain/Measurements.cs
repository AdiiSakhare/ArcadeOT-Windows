namespace ArcadeOT.Domain;
public sealed record Measurement(string EventId, string SiteId, string PlcId, string SensorId, string ConfigRevision, DateTimeOffset ObservedAtUtc, DateTimeOffset? SourceAtUtc, object? RawValue, object? Value, string Unit, string Quality, string? Error, string RawHex);
public interface IPlcDriver : IAsyncDisposable
{
    Task<Measurement> ReadAsync(string site, string revision, PlcConfiguration plc, SensorConfiguration sensor, CancellationToken ct);
}
public sealed record PlcHealth(string PlcId, string State, string Detail, DateTimeOffset UpdatedUtc, double CycleMs);
public sealed record LiveReading(string PlcId, string SensorId, string Name, string Address, string Raw, string Value, string Unit, string Quality, DateTimeOffset ObservedAtUtc, string RawHex, string Detail);
public sealed record BufferHealth(long Total, long Pending, long Quarantined, long UsedBytes);
public sealed record GatewayHealth(string State, DateTimeOffset StartedUtc, string Revision, BufferHealth Buffer, string Upload, IReadOnlyList<PlcHealth> Plcs);

public sealed record StoredMeasurement(long Sequence, Measurement Measurement);
public sealed record ConfigurationRevision(string Revision, DateTimeOffset SavedUtc)
{
    public string Display => $"{SavedUtc:yyyy-MM-dd HH:mm:ss} UTC · {Revision[..Math.Min(8, Revision.Length)]}";
}
