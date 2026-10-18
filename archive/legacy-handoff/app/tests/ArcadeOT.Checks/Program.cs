using System.Net;
using System.Net.Sockets;
using ArcadeOT.Core;
static void Eq(object? actual,object? expected){if(!Equals(actual,expected))throw new Exception($"Expected {expected}; got {actual}");}
static void Reject(Action a){try{a();}catch(ArgumentException){return;}catch(IOException){return;}throw new Exception("Expected rejection");}
var sensor=new Sensor{Id="t1",Address="D100",Type="Int16",Scale=.1};
Eq(Convert.ToHexString(Slmp.Request(sensor)),"500000FFFF03000C00100001040000640000A80100");
Eq(System.Text.Encoding.ASCII.GetString(Slmp.Request(sensor,"AsciiOctal")),"500000FF03FF000018001004010000D*0001000001");
Eq(Slmp.Decode(Convert.FromHexString("D204"),sensor),(short)1234);
Eq(Slmp.Decode(Convert.FromHexString("FFFF"),sensor),(short)-1);
Eq(Slmp.Decode(Convert.FromHexString("FFFF"),sensor with {Type="UInt16"}),(ushort)65535);
Eq(Slmp.Decode(Convert.FromHexString("0000803F"),sensor with{Type="Float32"}),1f);
Eq(Slmp.Decode(Convert.FromHexString("803F0000"),sensor with{Type="Float32",SwapWords=true}),1f);
Eq(Slmp.Decode([0x10],new(){Type="Bool"}),true);
Eq(Slmp.ParseAddress("X10").Number,8);
Eq(Slmp.Request(new(){Address="X10",Type="Bool"})[15],(byte)8);
Eq(Slmp.Decode(Slmp.AsciiPayload("000004D2",sensor),sensor),(short)1234);
Reject(()=>Slmp.ParseAddress("X18"));Reject(()=>Slmp.Decode([0x11],new(){Type="Bool"}));Reject(()=>Slmp.Decode([1],sensor));Reject(()=>Slmp.AsciiPayload("C051",sensor));Reject(()=>Slmp.ResponseLength(Convert.FromHexString("500000FFFF03000400")));
Reject(()=>new GatewayConfig{Plcs=[new(){Id="p",Enabled=true,Host="127.0.0.1",Port=0}]}.Validate());
Reject(()=>new GatewayConfig{Plcs=[new(){Sensors=[sensor,sensor]}]}.Validate());
Console.WriteLine("Frame, decoding and configuration validation checks passed.");
async Task NetworkCase(string mode,byte[] reply,string quality,object? value,bool disconnect=false){
 var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;
 var server=Task.Run(async()=>{using var client=await listener.AcceptTcpClientAsync();using var s=client.GetStream();var req=new byte[Slmp.Request(sensor,mode).Length];await s.ReadExactlyAsync(req);Eq(Convert.ToHexString(req),Convert.ToHexString(Slmp.Request(sensor,mode)));if(disconnect)return;foreach(byte b in reply){await s.WriteAsync(new[]{b});await Task.Delay(1);}});
 await using var driver=new Slmp();var m=await driver.ReadAsync("s","r",new(){Host="127.0.0.1",Port=port,TimeoutMs=1000,FrameMode=mode},sensor,CancellationToken.None);
 Eq(m.Quality,quality);Eq(m.Value,value);Eq(m.SourceAtUtc,null);await server;listener.Stop();
}
await NetworkCase("Binary",Convert.FromHexString("D00000FFFF030004000000D204"),"Good",123.4);
await NetworkCase("AsciiOctal",System.Text.Encoding.ASCII.GetBytes("D00000FF03FF000008000004D2"),"Good",123.4);
await NetworkCase("Binary",Convert.FromHexString("D00000FFFF0300020051C0"),"BadProtocol",null);
await NetworkCase("Binary",[],"BadCommunication",null,true);
// Deadline while a peer accepts and never returns a response.
var stalled=new TcpListener(IPAddress.Loopback,0);stalled.Start();var peer=Task.Run(async()=>{using var cl=await stalled.AcceptTcpClientAsync();await Task.Delay(600);});
await using(var d=new Slmp()){var m=await d.ReadAsync("s","r",new(){Host="127.0.0.1",Port=((IPEndPoint)stalled.LocalEndpoint).Port,TimeoutMs=250},sensor,CancellationToken.None);Eq(m.Quality,"BadTimeout");Eq(m.Value,null);}await peer;stalled.Stop();
Console.WriteLine("5 network checks passed: fragmented binary/ASCII, PLC error, EOF, timeout. No PLC was contacted.");
