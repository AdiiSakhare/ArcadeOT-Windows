using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ArcadeOT.Core;
using Microsoft.Data.Sqlite;

var dir=Format.DataDir;
Directory.CreateDirectory(dir);
var tokenPath=Path.Combine(dir,"api-token.txt");
if(!File.Exists(tokenPath))throw new InvalidOperationException("Run Install.ps1 first to provision secured API credentials.");
var token=File.ReadAllText(tokenPath).Trim();
if(token.Length<32)throw new InvalidOperationException("API token too short.");
var builder=WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService(o=>o.ServiceName="ArcadeOT");
builder.WebHost.UseUrls("http://127.0.0.1:17845");
builder.Services.AddSingleton<Runtime>();
builder.Services.AddHostedService<Collector>();
builder.Services.AddHostedService<Uploader>();
var app=builder.Build();
app.Use(async(context,next)=>{
 var supplied=context.Request.Headers["X-ArcadeOT-Key"].ToString();
 if(!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(supplied),Encoding.UTF8.GetBytes(token))){context.Response.StatusCode=401;return;}
 // Mutating browser requests cannot carry this header without a preflight; no CORS is enabled.
 await next();
});
app.MapGet("/health",(Runtime r)=>Results.Json(new {status=r.Status,started=r.Started,configRevision=r.GetConfig().Revision,plcs=r.GetConfig().Plcs.Count,buffer=r.Store.Counts(),lastUpload=r.LastUpload},Format.Json));
app.MapGet("/config",(Runtime r)=>Results.Json(r.GetConfig(),Format.Json));
app.MapPost("/config",async(HttpContext c,Runtime r)=>{
 try {
  if(c.Request.ContentLength>2_000_000)return Results.BadRequest("Configuration too large.");
  var config=await JsonSerializer.DeserializeAsync<GatewayConfig>(c.Request.Body,Format.Json,c.RequestAborted)??throw new ArgumentException("Missing config");
  config.Validate();r.SaveConfig(config);return Results.Ok(new{revision=r.GetConfig().Revision});
 }catch(Exception e)when(e is ArgumentException or JsonException){return Results.BadRequest(e.Message);}
});
app.MapPost("/cloud-credential",async(HttpContext ctx)=>{using var reader=new StreamReader(ctx.Request.Body);string credential=await reader.ReadToEndAsync(ctx.RequestAborted);if(credential.Length<1||credential.Length>8192||credential.Contains('\n')||credential.Contains('\r'))return Results.BadRequest("Invalid token");File.WriteAllText(Path.Combine(Format.DataDir,"cloud-token.txt"),credential);return Results.Ok();});
app.MapGet("/live",(Runtime r)=>Results.Json(r.Live.Values.OrderBy(x=>x.Plc).ThenBy(x=>x.Sensor),Format.Json));
app.MapGet("/export.csv",(Runtime r)=>Results.Text(r.Store.Export(),"text/csv",Encoding.UTF8));
await app.RunAsync();

sealed class Runtime {
 readonly object configLock=new();GatewayConfig config;
 public readonly Store Store=new(Path.Combine(Format.DataDir,"arcadeot.db"));
 public readonly ConcurrentDictionary<string,LiveRow> Live=new();
 public string Status="Starting";public string LastUpload="Not configured";public DateTimeOffset Started=DateTimeOffset.UtcNow;
 public Runtime(){var path=Path.Combine(Format.DataDir,"config.json");config=File.Exists(path)?JsonSerializer.Deserialize<GatewayConfig>(File.ReadAllText(path),Format.Json)!:new();config.Validate();}
 public GatewayConfig GetConfig(){lock(configLock)return JsonSerializer.Deserialize<GatewayConfig>(JsonSerializer.Serialize(config,Format.Json),Format.Json)!;}
 public void SaveConfig(GatewayConfig c){lock(configLock){c.Revision=Guid.NewGuid().ToString("N");string path=Path.Combine(Format.DataDir,"config.json");File.WriteAllText(path+".tmp",JsonSerializer.Serialize(c,Format.Json));File.Move(path+".tmp",path,true);config=c;}}
 public bool HasSpace(GatewayConfig c)=>Store.UsedBytes()<(long)c.MaxBufferMb*1024*1024 && new DriveInfo(Path.GetPathRoot(Format.DataDir)!).AvailableFreeSpace>50L*1024*1024;
 public void Observe(Plc p,Sensor s,Measurement m){Live[p.Id+"/"+s.Id]=new(p.Id,s.Id,s.Address,s.Type,Convert.ToString(m.RawValue,CultureInfo.InvariantCulture)??"",Convert.ToString(m.Value,CultureInfo.InvariantCulture)??"",s.Unit,m.Quality,m.ObservedAtUtc.ToString("O"),m.Error??"");}
}
sealed class Collector(Runtime runtime,ILogger<Collector> log):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken stoppingToken){
  while(!stoppingToken.IsCancellationRequested){
   var c=runtime.GetConfig();using var generation=CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
   runtime.Live.Clear();
   var jobs=c.Plcs.Where(p=>p.Enabled).Select(p=>Poll(c,p,generation.Token)).ToArray();
   runtime.Status=jobs.Length==0?"No PLC enabled — configure actual host, port and sensors":"Collecting";
   try{while(runtime.GetConfig().Revision==c.Revision){await Task.Delay(500,stoppingToken);foreach(var j in jobs)if(j.IsFaulted)await j;}}
   finally{generation.Cancel();try{await Task.WhenAll(jobs);}catch(OperationCanceledException){} }
  }
 }
 async Task Poll(GatewayConfig c,Plc p,CancellationToken ct){
  await using var driver=new Slmp();int failures=0;
  while(!ct.IsCancellationRequested){
   var cycle=System.Diagnostics.Stopwatch.StartNew();
   if(!runtime.HasSpace(c)){runtime.Status="Storage limit reached — collection paused; export or free storage";await Task.Delay(5000,ct);continue;}
   runtime.Status="Collecting";
   bool failed=false;
   foreach(var s in p.Sensors){
    ct.ThrowIfCancellationRequested();
    if(!runtime.HasSpace(c)){runtime.Status="Storage limit reached — collection paused";break;}
    var m=failed?new Measurement(Guid.NewGuid().ToString("N"),c.SiteId,p.Id,s.Id,c.Revision,DateTimeOffset.UtcNow,null,null,null,s.Unit,"BadCommunication","Skipped after PLC communication failure",""):await driver.ReadAsync(c.SiteId,c.Revision,p,s,ct);
    runtime.Store.Append(m);runtime.Observe(p,s,m);
    if(m.Quality is "BadCommunication" or "BadTimeout")failed=true;
   }
   failures=failed?Math.Min(failures+1,5):0;
   if(failed)log.LogWarning("PLC {Plc} communication failed; see live detail",p.Id);
   int delay=failed?Math.Max(p.PollMs,Math.Min(30000,1000*(1<<failures))):p.PollMs;
   await Task.Delay(Math.Max(1,delay-(int)cycle.ElapsedMilliseconds),ct);
  }
 }
}
sealed class Uploader(Runtime runtime,ILogger<Uploader> log):BackgroundService {
 readonly HttpClient http=new(){Timeout=TimeSpan.FromSeconds(20)};
 protected override async Task ExecuteAsync(CancellationToken ct){
  while(!ct.IsCancellationRequested){
   var c=runtime.GetConfig();
   try{
    runtime.Store.Prune(c.RetentionDays);
    if(c.CloudUrl!=""){
     var secretPath=Path.Combine(Format.DataDir,"cloud-token.txt");
     if(!File.Exists(secretPath)){runtime.LastUpload="Cloud credential missing";}
     else {
      var pending=runtime.Store.Pending();
      if(pending.Count>0){
       using var req=new HttpRequestMessage(HttpMethod.Post,c.CloudUrl);
       req.Headers.Authorization=new("Bearer",File.ReadAllText(secretPath).Trim());
       req.Content=new StringContent("{\"schemaVersion\":1,\"measurements\":["+string.Join(",",pending.Select(x=>x.Payload))+"]}",Encoding.UTF8,"application/json");
       using var response=await http.SendAsync(req,ct);response.EnsureSuccessStatusCode();
       using var body=JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
       var accepted=body.RootElement.GetProperty("acceptedEventIds").EnumerateArray().Select(x=>x.GetString()!).ToHashSet();
       runtime.Store.Ack(pending.Where(x=>accepted.Contains(x.Id)).Select(x=>x.Id));runtime.LastUpload=DateTimeOffset.UtcNow.ToString("O");
      }
     }
    }
   }catch(OperationCanceledException)when(ct.IsCancellationRequested){break;}
   catch(Exception e){runtime.LastUpload="Upload/storage maintenance error: "+e.Message;log.LogWarning(e,"Upload failed; measurements remain buffered");}
   await Task.Delay(5000,ct);
  }
 }
 public override void Dispose(){http.Dispose();base.Dispose();}
}
sealed class Store {
 readonly string cs;readonly object gate=new();
 public Store(string path){cs=new SqliteConnectionStringBuilder{DataSource=path,Mode=SqliteOpenMode.ReadWriteCreate}.ToString();using var db=Open();using var q=db.CreateCommand();q.CommandText="PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS measurements(event_id TEXT PRIMARY KEY, observed_utc TEXT NOT NULL, payload TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN (0,1))); CREATE INDEX IF NOT EXISTS ix_pending ON measurements(acknowledged, observed_utc);";q.ExecuteNonQuery();}
 SqliteConnection Open(){var d=new SqliteConnection(cs);d.Open();using var q=d.CreateCommand();q.CommandText="PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;";q.ExecuteNonQuery();return d;}
 public void Append(Measurement m){lock(gate){using var d=Open();using var q=d.CreateCommand();q.CommandText="INSERT INTO measurements(event_id,observed_utc,payload) VALUES($id,$t,$p)";q.Parameters.AddWithValue("$id",m.EventId);q.Parameters.AddWithValue("$t",m.ObservedAtUtc.ToString("O"));q.Parameters.AddWithValue("$p",JsonSerializer.Serialize(m,Format.Json));q.ExecuteNonQuery();}}
 public List<(string Id,string Payload)> Pending(){lock(gate){using var d=Open();using var q=d.CreateCommand();q.CommandText="SELECT event_id,payload FROM measurements WHERE acknowledged=0 ORDER BY observed_utc LIMIT 100";using var rd=q.ExecuteReader();var result=new List<(string,string)>();while(rd.Read())result.Add((rd.GetString(0),rd.GetString(1)));return result;}}
 public void Ack(IEnumerable<string> ids){lock(gate){using var d=Open();using var tx=d.BeginTransaction();foreach(var id in ids){using var q=d.CreateCommand();q.Transaction=tx;q.CommandText="UPDATE measurements SET acknowledged=1 WHERE event_id=$id";q.Parameters.AddWithValue("$id",id);q.ExecuteNonQuery();}tx.Commit();}}
 public long UsedBytes(){lock(gate){using var d=Open();long Read(string sql){using var q=d.CreateCommand();q.CommandText=sql;return Convert.ToInt64(q.ExecuteScalar());}return (Read("PRAGMA page_count")-Read("PRAGMA freelist_count"))*Read("PRAGMA page_size");}}
 public object Counts(){lock(gate){using var d=Open();using var q=d.CreateCommand();q.CommandText="SELECT COUNT(*),COALESCE(SUM(1-acknowledged),0) FROM measurements";using var rd=q.ExecuteReader();rd.Read();return new{total=rd.GetInt64(0),pending=rd.GetInt64(1)};}}
 public void Prune(int days){lock(gate){using var d=Open();using var q=d.CreateCommand();q.CommandText="DELETE FROM measurements WHERE acknowledged=1 AND observed_utc<$t;";q.Parameters.AddWithValue("$t",DateTimeOffset.UtcNow.AddDays(-days).ToString("O"));q.ExecuteNonQuery();using var cp=d.CreateCommand();cp.CommandText="PRAGMA wal_checkpoint(TRUNCATE);";cp.ExecuteNonQuery();}}
 public string Export(){lock(gate){using var d=Open();using var q=d.CreateCommand();q.CommandText="SELECT payload FROM measurements ORDER BY observed_utc DESC LIMIT 100000";using var rd=q.ExecuteReader();var b=new StringBuilder("EventId,SiteId,PlcId,SensorId,ObservedAtUtc,RawValue,Value,Unit,Quality,Error\r\n");while(rd.Read()){var m=JsonSerializer.Deserialize<Measurement>(rd.GetString(0),Format.Json)!;b.AppendLine(string.Join(",",new object?[]{m.EventId,m.SiteId,m.PlcId,m.SensorId,m.ObservedAtUtc.ToString("O"),m.RawValue,m.Value,m.Unit,m.Quality,m.Error}.Select(Csv)));}return b.ToString();}}
 static string Csv(object? v){var s=Convert.ToString(v,CultureInfo.InvariantCulture)??"";if(s.StartsWith('=')||s.StartsWith('+')||s.StartsWith('-')||s.StartsWith('@'))s="'"+s;return "\""+s.Replace("\"","\"\"")+"\"";}
}
