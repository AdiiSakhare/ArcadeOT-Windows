using System.Globalization;
using System.Text.Json;
using ArcadeOT.Domain;
using Microsoft.Data.Sqlite;
namespace ArcadeOT.Infrastructure;

public sealed record PendingEvent(string Id, string Payload);
public sealed class MeasurementStore
{
    readonly string connectionString;
    readonly string path;
    readonly object gate = new();
    public MeasurementStore(string path)
    {
        this.path = path;
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        connectionString = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        using var db = Open(); using var query = db.CreateCommand();
        query.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version'";
        bool versioned = Convert.ToInt64(query.ExecuteScalar()) > 0;
        if (versioned)
        {
            query.CommandText = "SELECT COUNT(*),MIN(version),MAX(version) FROM schema_version";
            using var existing = query.ExecuteReader(); existing.Read();
            if (existing.GetInt64(0) != 1 || existing.GetInt32(1) != 2 || existing.GetInt32(2) != 2)
                throw new InvalidOperationException("Unsupported database schema; preserve it and use a compatible release.");
        }
        else
        {
            query.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
            if (Convert.ToInt64(query.ExecuteScalar()) != 0) throw new InvalidOperationException("Unversioned database detected; import/migration must be explicit.");
        }
        query.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
            INSERT OR IGNORE INTO schema_version VALUES(2);
            CREATE TABLE IF NOT EXISTS measurements(
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,
                observed_utc TEXT NOT NULL,payload TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0,
                quarantine_reason TEXT);
            CREATE INDEX IF NOT EXISTS ix_outbox ON measurements(acknowledged,quarantine_reason,sequence);
            CREATE TABLE IF NOT EXISTS configurations(
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,revision TEXT NOT NULL UNIQUE,
                saved_utc TEXT NOT NULL,payload TEXT NOT NULL);
            """;
        query.ExecuteNonQuery();
        using var version = db.CreateCommand(); version.CommandText = "SELECT MIN(version),MAX(version) FROM schema_version";
        using var reader = version.ExecuteReader(); reader.Read();
        if (reader.GetInt32(0) != 2 || reader.GetInt32(1) != 2) throw new InvalidOperationException("Unsupported database schema; preserve database and use a compatible release.");
    }
    SqliteConnection Open()
    {
        var db = new SqliteConnection(connectionString); db.Open();
        using var query = db.CreateCommand(); query.CommandText = "PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;"; query.ExecuteNonQuery(); return db;
    }
    public SiteConfiguration LoadConfiguration()
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand();
            query.CommandText = "SELECT payload FROM configurations ORDER BY sequence DESC LIMIT 1";
            return query.ExecuteScalar() is string json ? JsonSerializer.Deserialize<SiteConfiguration>(json, JsonContract.Options)! : new();
        }
    }
    public SiteConfiguration SaveConfiguration(SiteConfiguration input)
    {
        ConfigurationValidator.Validate(input); var config = JsonContract.Clone(input); config.Revision = Guid.NewGuid().ToString("N");
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand();
            query.CommandText = "INSERT INTO configurations(revision,saved_utc,payload) VALUES($r,$t,$p)";
            query.Parameters.AddWithValue("$r", config.Revision); query.Parameters.AddWithValue("$t", DateTimeOffset.UtcNow.ToString("O"));
            query.Parameters.AddWithValue("$p", JsonSerializer.Serialize(config, JsonContract.Options)); query.ExecuteNonQuery();
        }
        return config;
    }
    public IReadOnlyList<ConfigurationRevision> Revisions()
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "SELECT revision,saved_utc FROM configurations ORDER BY sequence DESC LIMIT 50";
            using var rows = query.ExecuteReader(); var result = new List<ConfigurationRevision>();
            while (rows.Read()) result.Add(new(rows.GetString(0), DateTimeOffset.Parse(rows.GetString(1), CultureInfo.InvariantCulture)));
            return result;
        }
    }
    public SiteConfiguration GetRevision(string revision)
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "SELECT payload FROM configurations WHERE revision=$r"; query.Parameters.AddWithValue("$r", revision);
            return query.ExecuteScalar() is string json ? JsonSerializer.Deserialize<SiteConfiguration>(json, JsonContract.Options)! : throw new ArgumentException("Unknown revision.");
        }
    }
    public void Append(Measurement measurement)
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "INSERT INTO measurements(event_id,observed_utc,payload) VALUES($id,$time,$payload)";
            query.Parameters.AddWithValue("$id", measurement.EventId); query.Parameters.AddWithValue("$time", measurement.ObservedAtUtc.ToString("O"));
            query.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(measurement, JsonContract.Options)); query.ExecuteNonQuery();
        }
    }
    public IReadOnlyList<PendingEvent> Pending()
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "SELECT event_id,payload FROM measurements WHERE acknowledged=0 AND quarantine_reason IS NULL ORDER BY sequence LIMIT 100";
            using var rows = query.ExecuteReader(); var result = new List<PendingEvent>();
            while (rows.Read()) result.Add(new(rows.GetString(0), rows.GetString(1)));
            return result;
        }
    }
    public void Acknowledge(IEnumerable<string> ids) => Update(ids, "UPDATE measurements SET acknowledged=1 WHERE event_id=$id AND quarantine_reason IS NULL", null);
    public void Quarantine(IEnumerable<string> ids, string reason) => Update(ids, "UPDATE measurements SET quarantine_reason=$reason WHERE event_id=$id AND acknowledged=0", reason);
    void Update(IEnumerable<string> ids, string sql, string? reason)
    {
        lock (gate)
        {
            using var db = Open(); using var tx = db.BeginTransaction();
            foreach (var id in ids)
            {
                using var query = db.CreateCommand(); query.Transaction = tx; query.CommandText = sql; query.Parameters.AddWithValue("$id", id);
                if (reason is not null) query.Parameters.AddWithValue("$reason", reason);
                query.ExecuteNonQuery();
            }
            tx.Commit();
        }
    }
    public int RetryQuarantined()
    {
        lock (gate) { using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "UPDATE measurements SET quarantine_reason=NULL WHERE acknowledged=0 AND quarantine_reason IS NOT NULL"; return query.ExecuteNonQuery(); }
    }
    public IReadOnlyList<StoredMeasurement> History(long before = long.MaxValue, int limit = 200)
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "SELECT sequence,payload FROM measurements WHERE sequence<$before ORDER BY sequence DESC LIMIT $limit";
            query.Parameters.AddWithValue("$before", before); query.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 10000));
            using var rows = query.ExecuteReader(); var result = new List<StoredMeasurement>();
            while (rows.Read()) result.Add(new(rows.GetInt64(0), JsonSerializer.Deserialize<Measurement>(rows.GetString(1), JsonContract.Options)!));
            return result;
        }
    }
    public BufferHealth Health()
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "SELECT COUNT(*),COALESCE(SUM(acknowledged=0),0),COALESCE(SUM(quarantine_reason IS NOT NULL),0) FROM measurements";
            using var rows = query.ExecuteReader(); rows.Read();
            long total = rows.GetInt64(0), pending = rows.GetInt64(1), quarantined = rows.GetInt64(2);
            rows.Close();
            return new(total, pending, quarantined, UsedBytes());
        }
    }
    public long UsedBytes()
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand();
            query.CommandText = "PRAGMA page_count"; long pages = Convert.ToInt64(query.ExecuteScalar());
            query.CommandText = "PRAGMA freelist_count"; long free = Convert.ToInt64(query.ExecuteScalar());
            query.CommandText = "PRAGMA page_size"; long size = Convert.ToInt64(query.ExecuteScalar());
            long wal = File.Exists(path + "-wal") ? new FileInfo(path + "-wal").Length : 0;
            return (pages - free) * size + wal;
        }
    }
    public void PruneAcknowledged(int days)
    {
        lock (gate)
        {
            using var db = Open(); using var query = db.CreateCommand(); query.CommandText = "DELETE FROM measurements WHERE acknowledged=1 AND observed_utc<$time";
            query.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.AddDays(-days).ToString("O")); query.ExecuteNonQuery();
            query.CommandText = "PRAGMA wal_checkpoint(PASSIVE)"; query.ExecuteNonQuery();
        }
    }
}
