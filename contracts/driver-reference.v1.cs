using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
namespace ArcadeOT.Core;
public static class Format {
 public static readonly JsonSerializerOptions Json = new() { WriteIndented=true, PropertyNameCaseInsensitive=true, NumberHandling=JsonNumberHandling.Strict };
 public static string DataDir => Environment.GetEnvironmentVariable("ARCADEOT_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"ArcadeOT");
}
public sealed record Sensor {
 public string Id {get;set;}="";
 public string Name {get;set;}="";
 public string Address {get;set;}="D0";
 public string Type {get;set;}="Int16";
 public bool SwapWords {get;set;}
 public double Scale {get;set;}=1;
 public double Offset {get;set;}
 public string Unit {get;set;}="";
 public double? Min {get;set;}
 public double? Max {get;set;}
}
public sealed record Plc {
 public string Id {get;set;}="fx5u-1";
 public string Model {get;set;}="FX5U (confirm full SKU)";
 public string Firmware {get;set;}="unknown";
 public string Host {get;set;}="";
 public int Port {get;set;}=0;
 public string FrameMode {get;set;}="Binary";
 public bool Enabled {get;set;}
 public int PollMs {get;set;}=1000;
 public int TimeoutMs {get;set;}=3000;
 public List<Sensor> Sensors {get;set;}=[];
}
public sealed record GatewayConfig {
 public int Version {get;set;}=1;
 public string Revision {get;set;}=Guid.NewGuid().ToString("N");
 public string SiteId {get;set;}="site-1";
 public List<Plc> Plcs {get;set;}=[];
 public string CloudUrl {get;set;}="";
 public int RetentionDays {get;set;}=30;
 public int MaxBufferMb {get;set;}=1024;
 public void Validate() {
  if(Version!=1 || string.IsNullOrWhiteSpace(SiteId) || SiteId.Length>100 || Plcs.Count>100) throw new ArgumentException("Invalid version, site or PLC count (maximum 100).");
  if(RetentionDays<1 || RetentionDays>3650 || MaxBufferMb<64 || MaxBufferMb>102400) throw new ArgumentException("Invalid retention or buffer size.");
  if(CloudUrl!="" && (!Uri.TryCreate(CloudUrl,UriKind.Absolute,out var u)||u.Scheme!="https"||!string.IsNullOrEmpty(u.UserInfo))) throw new ArgumentException("Cloud URL must use HTTPS without embedded credentials.");
  var ids=new HashSet<string>(StringComparer.Ordinal);
  foreach(var p in Plcs) {
   if(string.IsNullOrWhiteSpace(p.Id)||!ids.Add(p.Id)) throw new ArgumentException("PLC IDs must be unique and nonempty.");
   if(p.Enabled && (string.IsNullOrWhiteSpace(p.Host)||p.Port<1||p.Port>65535)) throw new ArgumentException($"{p.Id}: enter the actual PLC host and configured TCP port.");
   if(p.FrameMode is not ("Binary" or "AsciiOctal" or "AsciiHex"))throw new ArgumentException("Unsupported SLMP frame mode.");
   if(p.PollMs<250||p.PollMs>3600000||p.TimeoutMs<250||p.TimeoutMs>60000||p.Sensors.Count>10000) throw new ArgumentException("Poll interval, timeout or sensor count invalid.");
   var tags=new HashSet<string>(StringComparer.Ordinal);
   foreach(var s in p.Sensors) {
    if(string.IsNullOrWhiteSpace(s.Id)||!tags.Add(s.Id))throw new ArgumentException($"{p.Id}: duplicate or empty sensor ID.");
    var (area,number)=Slmp.ParseAddress(s.Address);
    var width=Slmp.Width(s.Type);
    if((area is "M" or "X" or "Y") != (s.Type=="Bool"))throw new ArgumentException("M/X/Y require Bool; D requires a numeric type.");
    if(number+width-1>0xFFFFFF)throw new ArgumentException("Device address overflows.");
    if(!double.IsFinite(s.Scale)||!double.IsFinite(s.Offset)||(s.Min.HasValue&&!double.IsFinite(s.Min.Value))||(s.Max.HasValue&&!double.IsFinite(s.Max.Value))||s.Min>s.Max)throw new ArgumentException("Invalid scaling/range.");
   }
  }
 }
}
public sealed record Measurement(string EventId,string SiteId,string PlcId,string SensorId,string ConfigRevision,DateTimeOffset ObservedAtUtc,DateTimeOffset? SourceAtUtc,object? RawValue,object? Value,string Unit,string Quality,string? Error,string RawHex);
public sealed record LiveRow(string Plc,string Sensor,string Address,string Type,string Raw,string Value,string Unit,string Quality,string ObservedUtc,string Detail);
public interface IPlcDriver : IAsyncDisposable {
 Task<Measurement> ReadAsync(string site,string revision,Plc plc,Sensor sensor,CancellationToken ct);
}
