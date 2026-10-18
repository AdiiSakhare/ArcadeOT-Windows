using System.Text.Json;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;
namespace ArcadeOT.Domain;

public static class JsonContract
{
    public static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true, PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 32
    };
    public static T Clone<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Options), Options)!;
}
public sealed record SiteConfiguration
{
    public int Version { get; set; } = 2;
    public string Revision { get; set; } = "initial";
    public string SiteId { get; set; } = "site-1";
    public ObservableCollection<PlcConfiguration> Plcs { get; set; } = [];
    public string CloudUrl { get; set; } = "";
    public int RetentionDays { get; set; } = 30;
    public int MaxBufferMb { get; set; } = 1024;
}
public sealed record PlcConfiguration
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "New controller";
    public string ProfileId { get; set; } = "mitsubishi-fx5u";
    public string ProfileVersion { get; set; } = "2026.10.18";
    public string Model { get; set; } = "";
    public string Firmware { get; set; } = "unknown";
    public string Interface { get; set; } = "Built-in Ethernet";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string FrameMode { get; set; } = "Binary";
    public int PollMs { get; set; } = 1000;
    public int TimeoutMs { get; set; } = 3000;
    public bool Enabled { get; set; }
    public ObservableCollection<SensorConfiguration> Sensors { get; set; } = [];
}
public sealed record SensorConfiguration
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "New sensor";
    public string Group { get; set; } = "";
    public string Address { get; set; } = "D0";
    public string Type { get; set; } = "Int16";
    public bool SwapWords { get; set; }
    public double Scale { get; set; } = 1;
    public double Offset { get; set; }
    public string Unit { get; set; } = "";
    public double? Min { get; set; }
    public double? Max { get; set; }
    public string ModuleSku { get; set; } = "";
    public string Slot { get; set; } = "";
    public string Channel { get; set; } = "";
    public string Terminal { get; set; } = "";
    public string Common { get; set; } = "";
    public string Signal { get; set; } = "";
    public string SensorModel { get; set; } = "";
    public string ManualReference { get; set; } = "";
}
public sealed record PlcProfile(string Id, string Manufacturer, string Family, string Protocol, bool Implemented, string Source)
{
    public string Version => "2026.10.18";
    public string Display => $"{Manufacturer} · {Family}";
    public string Status => Implemented ? "Driver available · hardware unqualified" : "Research only · driver unavailable";
}
public static class HardwareCatalog
{
    public static IReadOnlyList<PlcProfile> Profiles { get; } = [
        new("mitsubishi-fx5u", "Mitsubishi", "FX5U", "SLMP 3E TCP", true, "SH-082625ENG-J / JY997D56001K"),
        new("custom-slmp", "Custom", "Unqualified SLMP controller", "SLMP 3E TCP", true, "Operator must confirm direct 3E compatibility"),
        new("siemens-s7-1200", "Siemens", "S7-1200", "OPC UA / S7", false, "TIA CPU/firmware/license-specific documentation"),
        new("delta-dvp-se", "Delta", "DVP-SE", "Modbus TCP", false, "Exact model programming manual required"),
        new("schneider-m221", "Schneider", "M221", "Modbus TCP/RTU", false, "EIO0000003297 / EIO0000003313"),
        new("omron-cj", "Omron", "CJ / CP", "FINS", false, "W342 / exact Ethernet unit manual"),
        new("rockwell-logix", "Rockwell", "CompactLogix", "EtherNet/IP CIP", false, "1756-PM020I-EN-P")];
}
public static class DeviceAddress
{
    public static (string Area, int Number) Parse(string? address)
    {
        if (string.IsNullOrWhiteSpace(address) || address.Length < 2 || address.Length > 10)
            throw new ArgumentException("Enter a device address, such as D100 or X10.");
        var area = address[..1].ToUpperInvariant();
        if (area is not ("D" or "M" or "X" or "Y")) throw new ArgumentException("Supported areas are D, M, X and Y.");
        var digits = address[1..];
        if (digits.Any(c => c < '0' || c > (area is "X" or "Y" ? '7' : '9')))
            throw new ArgumentException("D/M addresses are decimal; X/Y labels use octal digits 0–7.");
        try
        {
            int number = Convert.ToInt32(digits, area is "X" or "Y" ? 8 : 10);
            if (number > 0xFFFFFF) throw new ArgumentException("Address exceeds frame encoding limit.");
            return (area, number);
        }
        catch (Exception e) when (e is FormatException or OverflowException)
        { throw new ArgumentException("Device address is too large or malformed."); }
    }
    public static int Width(string? type) => type switch
    { "Bool" or "Int16" or "UInt16" => 1, "Int32" or "UInt32" or "Float32" => 2, _ => throw new ArgumentException("Unsupported data type.") };
}
public static class ConfigurationValidator
{
    public static void Validate(SiteConfiguration? config)
    {
        if (config is null || config.Version != 2) throw new ArgumentException("Configuration version 2 is required.");
        Text(config.SiteId, "Site ID", 100, true);
        if (config.Plcs is null || config.Plcs.Count > 100) throw new ArgumentException("At most 100 PLC configurations are allowed.");
        if (config.RetentionDays is < 1 or > 3650 || config.MaxBufferMb is < 64 or > 102400) throw new ArgumentException("Invalid retention or buffer size.");
        Text(config.CloudUrl, "Cloud URL", 2048);
        if (config.CloudUrl != "" && (!Uri.TryCreate(config.CloudUrl, UriKind.Absolute, out var url) || url.Scheme != "https" || url.UserInfo != "" || url.Fragment != ""))
            throw new ArgumentException("Cloud URL must be HTTPS without embedded credentials or fragments.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var plc in config.Plcs)
        {
            if (plc is null) throw new ArgumentException("PLC entries cannot be null.");
            Text(plc.Id, "PLC ID", 100, true);
            if (!ids.Add(plc.Id)) throw new ArgumentException("Duplicate PLC ID: " + plc.Id);
            var profile = HardwareCatalog.Profiles.FirstOrDefault(x => x.Id == plc.ProfileId) ?? throw new ArgumentException("Unknown PLC profile.");
            if (plc.ProfileVersion != profile.Version) throw new ArgumentException("Unsupported catalog profile version; review and migrate the configuration.");
            Text(plc.Name, "PLC name", 200, true); Text(plc.Model, "Exact CPU model", 200); Text(plc.Firmware, "Firmware", 100);
            Text(plc.Interface, "Interface", 200); Text(plc.Host, "Host", 253);
            if (plc.Enabled && (!profile.Implemented || string.IsNullOrWhiteSpace(plc.Model) || Uri.CheckHostName(plc.Host) == UriHostNameType.Unknown || plc.Port is < 1 or > 65535))
                throw new ArgumentException($"{plc.Name}: select an implemented driver and enter exact model, host/IP and TCP port.");
            if (plc.Port is < 0 or > 65535 || plc.PollMs is < 250 or > 3600000 || plc.TimeoutMs is < 250 or > 60000)
                throw new ArgumentException($"{plc.Name}: invalid port, interval or deadline.");
            if (plc.FrameMode is not ("Binary" or "AsciiOctal" or "AsciiHex")) throw new ArgumentException("Unsupported frame mode.");
            if (plc.Sensors is null || plc.Sensors.Count > 10000 || (plc.Enabled && plc.Sensors.Count == 0)) throw new ArgumentException("Enabled PLCs need 1–10000 sensors.");
            var sensorIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var sensor in plc.Sensors)
            {
                if (sensor is null) throw new ArgumentException("Sensor entries cannot be null.");
                Text(sensor.Id, "Sensor ID", 100, true); Text(sensor.Name, "Sensor name", 200, true);
                if (!sensorIds.Add(sensor.Id)) throw new ArgumentException("Duplicate sensor ID: " + sensor.Id);
                var (area, number) = DeviceAddress.Parse(sensor.Address); var width = DeviceAddress.Width(sensor.Type);
                if ((area != "D") != (sensor.Type == "Bool")) throw new ArgumentException("D requires a numeric type; M/X/Y require Bool.");
                if (number + width - 1 > 0xFFFFFF) throw new ArgumentException("Multiword address overflows.");
                if (plc.FrameMode != "Binary" && (area is "D" or "M" ? number > 999999 : (plc.FrameMode == "AsciiOctal" && number > 262143)))
                    throw new ArgumentException("Address exceeds six-character ASCII device field.");
                if (!double.IsFinite(sensor.Scale) || !double.IsFinite(sensor.Offset) || (sensor.Min.HasValue && !double.IsFinite(sensor.Min.Value)) || (sensor.Max.HasValue && !double.IsFinite(sensor.Max.Value)) || sensor.Min > sensor.Max)
                    throw new ArgumentException("Scaling and range must be finite and ordered.");
                foreach (var value in new[] { sensor.Group, sensor.Unit, sensor.ModuleSku, sensor.Slot, sensor.Channel, sensor.Terminal, sensor.Common, sensor.Signal, sensor.SensorModel, sensor.ManualReference }) Text(value, "Sensor metadata", 500);
            }
        }
    }
    static void Text(string? value, string name, int max, bool required = false)
    {
        if (value is null || value.Length > max || (required && string.IsNullOrWhiteSpace(value)) || value.Any(char.IsControl))
            throw new ArgumentException($"{name} must be valid text (maximum {max} characters).");
    }
}
