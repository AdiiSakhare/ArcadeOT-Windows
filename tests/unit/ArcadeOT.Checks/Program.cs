using System.Net;
using System.Net.Sockets;
using ArcadeOT.Domain;
using ArcadeOT.Drivers.Slmp;
using ArcadeOT.Application;
using ArcadeOT.Infrastructure;
using System.Text.Json;
static void Eq(object? actual,object? expected){if(!Equals(actual,expected))throw new Exception($"Expected {expected}; got {actual}");}
static void Reject(Action a){try{a();}catch(ArgumentException){return;}catch(IOException){return;}throw new Exception("Expected rejection");}
var sensor=new SensorConfiguration{Id="t1",Address="D100",Type="Int16",Scale=.1};
Eq(Convert.ToHexString(SlmpDriver.Request(sensor)),"500000FFFF03000C00100001040000640000A80100");
Eq(System.Text.Encoding.ASCII.GetString(SlmpDriver.Request(sensor,"AsciiOctal")),"500000FF03FF000018001004010000D*0001000001");
Eq(SlmpDriver.Decode(Convert.FromHexString("D204"),sensor),(short)1234);
Eq(SlmpDriver.Decode(Convert.FromHexString("FFFF"),sensor),(short)-1);
Eq(SlmpDriver.Decode(Convert.FromHexString("FFFF"),sensor with {Type="UInt16"}),(ushort)65535);
Eq(SlmpDriver.Decode(Convert.FromHexString("0000803F"),sensor with{Type="Float32"}),1f);
Eq(SlmpDriver.Decode(Convert.FromHexString("803F0000"),sensor with{Type="Float32",SwapWords=true}),1f);
Eq(SlmpDriver.Decode([0x10],new(){Type="Bool"}),true);
Eq(SlmpDriver.ParseAddress("X10").Number,8);
Eq(SlmpDriver.Request(new(){Address="X10",Type="Bool"})[15],(byte)8);
Eq(SlmpDriver.Decode(SlmpDriver.AsciiPayload("000004D2",sensor),sensor),(short)1234);
Reject(()=>SlmpDriver.ParseAddress("X18"));Reject(()=>SlmpDriver.Decode([0x11],new(){Type="Bool"}));Reject(()=>SlmpDriver.Decode([1],sensor));Reject(()=>SlmpDriver.AsciiPayload("C051",sensor));Reject(()=>SlmpDriver.ResponseLength(Convert.FromHexString("500000FFFF03000400")));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){Id="p",Enabled=true,Host="127.0.0.1",Port=0}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){Sensors=[sensor,sensor]}]}));
Console.WriteLine("Frame, decoding and configuration validation checks passed.");
async Task NetworkCase(string mode,byte[] reply,string quality,object? value,bool disconnect=false){
 var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;
 var server=Task.Run(async()=>{using var client=await listener.AcceptTcpClientAsync();using var s=client.GetStream();var req=new byte[SlmpDriver.Request(sensor,mode).Length];await s.ReadExactlyAsync(req);Eq(Convert.ToHexString(req),Convert.ToHexString(SlmpDriver.Request(sensor,mode)));if(disconnect)return;foreach(byte b in reply){await s.WriteAsync(new[]{b});await Task.Delay(1);}});
 await using var driver=new SlmpDriver();var m=await driver.ReadAsync("s","r",new(){Host="127.0.0.1",Port=port,TimeoutMs=1000,FrameMode=mode},sensor,CancellationToken.None);
 Eq(m.Quality,quality);Eq(m.Value,value);Eq(m.SourceAtUtc,null);await server;listener.Stop();
}
await NetworkCase("Binary",Convert.FromHexString("D00000FFFF030004000000D204"),"Good",123.4);
await NetworkCase("AsciiOctal",System.Text.Encoding.ASCII.GetBytes("D00000FF03FF000008000004D2"),"Good",123.4);
await NetworkCase("Binary",Convert.FromHexString("D00000FFFF0300020051C0"),"BadProtocol",null);
await NetworkCase("Binary",[],"BadCommunication",null,true);
// Deadline while a peer accepts and never returns a response.
var stalled=new TcpListener(IPAddress.Loopback,0);stalled.Start();var peer=Task.Run(async()=>{using var cl=await stalled.AcceptTcpClientAsync();await Task.Delay(600);});
await using(var d=new SlmpDriver()){var m=await d.ReadAsync("s","r",new(){Host="127.0.0.1",Port=((IPEndPoint)stalled.LocalEndpoint).Port,TimeoutMs=250},sensor,CancellationToken.None);Eq(m.Quality,"BadTimeout");Eq(m.Value,null);}await peer;stalled.Stop();
Console.WriteLine("5 network checks passed: fragmented binary/ASCII, PLC error, EOF, timeout. No PLC was contacted.");

// New configuration and formatter behavior.
Reject(()=>ConfigurationValidator.Validate(null));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=null!}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[null!]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){Sensors=null!}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){Sensors=[null!]}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){ProfileId="unknown"}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){Sensors=[sensor with{Scale=double.NaN}]}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{CloudUrl="http://example.invalid"}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){ProfileId="siemens-s7-1200",Enabled=true,Model="operator-model",Host="127.0.0.1",Port=1234,Sensors=[sensor]}]}));
Reject(()=>ConfigurationValidator.Validate(new SiteConfiguration{Plcs=[new(){FrameMode="AsciiOctal",Sensors=[sensor with{Address="D1000000"}]}]}));
Reject(()=>SlmpDriver.ParseAddress("D999999999999999"));
bool strict=false;
try{JsonSerializer.Deserialize<SiteConfiguration>("{\"Version\":2,\"Secret\":\"must-not-be-accepted\"}",JsonContract.Options);}catch(JsonException){strict=true;}
Eq(strict,true);
var repeated=SensorGroups.Create("pressure-","D200","Float32",2,"bar");
Eq(repeated[0].Address,"D200");Eq(repeated[1].Address,"D202");Eq(repeated[0].Id==repeated[1].Id,false);
var bits=SensorGroups.Create("bit-","X7","Bool",2);Eq(bits[1].Address,"X10");
Reject(()=>SensorGroups.Create("bad","M0","Float32",1));
Reject(()=>SensorGroups.Create("bad","D16777215","Float32",1));
var imported=SensorCsv.Parse("Name,Address,Type,Scale,Unit,Terminal\r\n\"Temperature, room 1\",D100,Int16,0.1,degC,operator-reference\r\n");
Eq(imported.Count,1);Eq(imported[0].Name,"Temperature, room 1");Eq(imported[0].Scale,.1);Eq(imported[0].Terminal,"operator-reference");
Reject(()=>SensorCsv.Parse("Name,Address,Type,Unknown\nA,D0,Int16,x"));
Reject(()=>SensorCsv.Parse("Name,Address,Type,Scale\nA,D0,Int16,NaN"));
Reject(()=>SensorCsv.Parse("Name,Address,Type\nA,M0,Float32"));
Console.WriteLine("PASS: strict null/unknown-field/profile/range validation, type-aware groups and quoted CSV import.");

// SQLite transaction, configuration revision and durable outbox checks.
var directory=Path.Combine(Path.GetTempPath(),"arcadeot-check-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
try{
 var path=Path.Combine(directory,"test.db");var store=new MeasurementStore(path);
 var config=new SiteConfiguration{Plcs=[new(){Id="controller",Sensors=[sensor with{Terminal="T-operator",ModuleSku="module-reference"}]}]};
 var first=store.SaveConfiguration(config);var second=store.SaveConfiguration(config);
 Eq(first.Revision==second.Revision,false);Eq(store.Revisions().Count,2);
 Eq(store.GetRevision(first.Revision).Plcs[0].Sensors[0].Terminal,"T-operator");
 Eq(new MeasurementStore(path).LoadConfiguration().Revision,second.Revision);
 var measurement=new Measurement("durable-event","site","controller","sensor",first.Revision,DateTimeOffset.UtcNow,null,1234,123.4,"degC","Good",null,"D204");
 store.Append(measurement);store.Append(measurement with{EventId="later-event"});
 Eq(store.Pending().Count,2);Eq(new MeasurementStore(path).Pending()[0].Id,"durable-event");
 store.Quarantine(["durable-event"],"HTTP 409");Eq(store.Pending().Single().Id,"later-event");Eq(store.Health().Pending,2L);Eq(store.Health().Quarantined,1L);
 store.PruneAcknowledged(1);Eq(store.Health().Total,2L); // Unacknowledged/quarantined data cannot expire.
 store.Acknowledge(["later-event"]);Eq(store.Health().Pending,1L);Eq(store.RetryQuarantined(),1);Eq(store.Pending().Single().Id,"durable-event");
 var history=store.History(limit:1);Eq(history.Count,1);Eq(store.History(history[0].Sequence,1)[0].Measurement.EventId,"durable-event");
 var invalid=config with{SiteId=""};Reject(()=>store.SaveConfiguration(invalid));Eq(store.LoadConfiguration().Revision,second.Revision);
 Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
}finally{Directory.Delete(directory,true);}
Console.WriteLine("PASS: durable replay IDs, quarantine isolation/retry, ACK, cursor history and configuration persistence/rejection. No PLC was contacted.");

var cloudDirectory=Path.Combine(Path.GetTempPath(),"arcadeot-cloud-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(cloudDirectory);
try {
 var store=new MeasurementStore(Path.Combine(cloudDirectory,"test.db"));
 var measurement=new Measurement("ack-1","site","p","s","r",DateTimeOffset.UtcNow,null,1,1,"","Good",null,"0100");
 store.Append(measurement);store.Append(measurement with{EventId="ack-2"});
 using var handler=new FixtureHandler();using var http=new HttpClient(handler);
 handler.Body="{\"acceptedEventIds\":[\"ack-1\"]}";
 var result=await CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None);
 Eq(result.Accepted,1);Eq(store.Pending().Single().Id,"ack-2");Eq(handler.LastIds.SequenceEqual(new[]{"ack-1","ack-2"}),true);
 handler.Body="{\"acceptedEventIds\":[\"unsent-event\"]}";
 await RejectAsync(()=>CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None));
 Eq(store.Pending().Single().Id,"ack-2");
 handler.Body="{\"acceptedEventIds\":[\"ack-2\",\"ack-2\"]}";
 await RejectAsync(()=>CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None));
 handler.Body=new string('x',65537);
 await RejectAsync(()=>CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None));
 Eq(store.Pending().Single().Id,"ack-2");
 handler.Status=System.Net.HttpStatusCode.Conflict;
 result=await CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None);
 Eq(result.Quarantined,true);Eq(store.Health().Quarantined,1L);Eq(store.Health().Pending,1L);
 store.Append(measurement with{EventId="later-valid"});Eq(store.Pending().Single().Id,"later-valid");
 handler.Status=System.Net.HttpStatusCode.OK;handler.Body="{\"acceptedEventIds\":[\"later-valid\"]}";
 await CloudDelivery.SendAsync(store,http,new Uri("https://fixture.invalid/ingest"),"fixture-only-credential",CancellationToken.None);
 Eq(store.Health().Pending,1L);Eq(store.RetryQuarantined(),1);Eq(store.Pending().Single().Id,"ack-2");
 Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
} finally {Directory.Delete(cloudDirectory,true);}
Console.WriteLine("PASS: bounded cloud ACK parsing, partial ACK, unsent/duplicate rejection, quarantine preservation and later-batch delivery (mock HTTP transport; no hosted backend).");

var legacyJson="""
{"Version":1,"SiteId":"legacy-site","Plcs":[{"Id":"legacy-plc","Enabled":true,"Host":"127.0.0.1","Port":1234,"Sensors":[{"Id":"keep-id","Name":"Legacy sensor","Address":"D100","Type":"Int16"}]}]}
""";
var migrated=ConfigurationImport.Parse(legacyJson);Eq(migrated.Version,2);Eq(migrated.Plcs[0].Enabled,false);Eq(migrated.Plcs[0].Sensors[0].Id,"keep-id");Eq(migrated.Plcs[0].Name,"legacy-plc");
Reject(()=>ConfigurationImport.Parse(legacyJson.Replace("\"SiteId\"","\"UnknownSiteField\"")));
await NetworkCase("Binary",Convert.FromHexString("D00000FFFF030003000000FF"),"BadDecode",null);
Console.WriteLine("PASS: v1 config migration preserves IDs and disables acquisition; malformed payload maps to BadDecode.");

var unsupportedDirectory=Path.Combine(Path.GetTempPath(),"arcadeot-schema-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(unsupportedDirectory);
try {
 var path=Path.Combine(unsupportedDirectory,"legacy.db");
 using(var db=new Microsoft.Data.Sqlite.SqliteConnection("Data Source="+path)){db.Open();using var q=db.CreateCommand();q.CommandText="CREATE TABLE legacy_payload(value TEXT); INSERT INTO legacy_payload VALUES('preserve-me');";q.ExecuteNonQuery();}
 bool rejected=false;try{_ = new MeasurementStore(path);}catch(InvalidOperationException){rejected=true;}Eq(rejected,true);
 using(var db=new Microsoft.Data.Sqlite.SqliteConnection("Data Source="+path)){db.Open();using var q=db.CreateCommand();q.CommandText="SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version'";Eq(Convert.ToInt64(q.ExecuteScalar()),0L);}
 Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
}finally{Directory.Delete(unsupportedDirectory,true);}
Console.WriteLine("PASS: unversioned database rejected without adding v2 tables.");

static async Task RejectAsync(Func<Task> action) {try{await action();}catch(IOException){return;}throw new Exception("Expected async rejection");}
sealed class FixtureHandler : HttpMessageHandler
{
 public string Body="";public System.Net.HttpStatusCode Status=System.Net.HttpStatusCode.OK;public string[] LastIds=[];
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
 {
  if(request.Headers.Authorization?.Parameter!="fixture-only-credential")throw new Exception("Missing fixture auth");
  using var json=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
  LastIds=json.RootElement.GetProperty("measurements").EnumerateArray().Select(x=>x.GetProperty("EventId").GetString()!).ToArray();
  return new HttpResponseMessage(Status){Content=new StringContent(Body)};
 }
}
