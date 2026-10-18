using System.Buffers.Binary;
using System.Globalization;
using System.Net.Sockets;
using System.Text;
namespace ArcadeOT.Core;
// Read-only, direct CPU, binary 3E. No write/remote-control methods exist.
public sealed class PlcProtocolException(string message) : IOException(message);
public sealed class Slmp : IPlcDriver {
 TcpClient? client; NetworkStream? stream;
 public static (string Area,int Number) ParseAddress(string address) {
  if(string.IsNullOrWhiteSpace(address)||address.Length<2) throw new ArgumentException("Address required.");
  var a=address[..1].ToUpperInvariant();
  if(a is not ("D" or "M" or "X" or "Y"))throw new ArgumentException("Supported areas: D, M, X, Y.");
  var digits=address[1..];
  // FX X/Y labels are octal. Convert once to the numeric binary device number.
  if(digits.Any(c=>c<'0'||c>(a is "X" or "Y"?'7':'9')))throw new ArgumentException("D/M are decimal; X/Y are octal (digits 0–7).");
  int n=Convert.ToInt32(digits,a is "X" or "Y"?8:10);
  if(n<0||n>0xFFFFFF)throw new ArgumentException("Address out of 24-bit range.");
  return(a,n);
 }
 public static int Width(string type)=>type switch {"Bool" or "Int16" or "UInt16"=>1,"Int32" or "UInt32" or "Float32"=>2,_=>throw new ArgumentException("Types: Bool, Int16, UInt16, Int32, UInt32, Float32.")};
 public static byte[] Request(Sensor s,string mode="Binary") {
  var(a,n)=ParseAddress(s.Address);int width=Width(s.Type);
  if((a!="D")!=(s.Type=="Bool"))throw new ArgumentException("Area/type mismatch.");
  byte code=a switch {"D"=>0xA8,"M"=>0x90,"X"=>0x9C,"Y"=>0x9D,_=>throw new ArgumentException()};
  byte[] b=[0x50,0,0,0xFF,0xFF,0x03,0,0x0C,0,0x10,0,0x01,0x04,0,0,0,0,0,code,(byte)width,0];
  b[13]=(byte)(s.Type=="Bool"?1:0);
  b[15]=(byte)n;b[16]=(byte)(n>>8);b[17]=(byte)(n>>16);
  if(mode=="Binary")return b;
  string number=(a is "X" or "Y")?(mode=="AsciiOctal"?Convert.ToString(n,8).PadLeft(6,'0'):n.ToString("X6")):n.ToString("D6");
  string data="00100401"+(s.Type=="Bool"?"0001":"0000")+a+"*"+number+width.ToString("X4");
  return Encoding.ASCII.GetBytes("500000FF03FF00"+data.Length.ToString("X4")+data);
 }
 public static object Decode(byte[] bytes,Sensor s) {
  if(s.Type=="Bool") {
   if(bytes.Length!=1||(bytes[0]!=0&&bytes[0]!=0x10))throw new IOException("Invalid bit payload.");
   return bytes[0]==0x10;
  }
  if(bytes.Length!=Width(s.Type)*2)throw new IOException("Unexpected data length.");
  var b=bytes.ToArray();
  if(s.SwapWords && b.Length==4) b=[b[2],b[3],b[0],b[1]];
  return s.Type switch {
   "Int16"=>(object)BinaryPrimitives.ReadInt16LittleEndian(b),
   "UInt16"=>BinaryPrimitives.ReadUInt16LittleEndian(b),
   "Int32"=>BinaryPrimitives.ReadInt32LittleEndian(b),
   "UInt32"=>BinaryPrimitives.ReadUInt32LittleEndian(b),
   "Float32"=>BitConverter.Int32BitsToSingle(BinaryPrimitives.ReadInt32LittleEndian(b)),
   _=>throw new ArgumentException("Unsupported type")
  };
 }
 public static int ResponseLength(byte[] h) {
  if(h.Length!=9||h[0]!=0xD0||h[1]!=0||h[2]!=0||h[3]!=0xFF||h[4]!=0xFF||h[5]!=3||h[6]!=0)throw new IOException("Invalid SLMP 3E response header/route. Check binary mode and direct CPU routing.");
  int n=BinaryPrimitives.ReadUInt16LittleEndian(h.AsSpan(7));
  if(n<2||n>4096)throw new IOException("Invalid SLMP response length.");return n;
 }
 public static byte[] AsciiPayload(string body,Sensor s) {
  if(body.Length<4||!int.TryParse(body[..4],NumberStyles.HexNumber,CultureInfo.InvariantCulture,out var end))throw new IOException("Malformed ASCII end code");
  if(end!=0)throw new PlcProtocolException($"PLC SLMP end code 0x{end:X4}");
  string data=body[4..];
  if(s.Type=="Bool")return data switch {"0"=>[0],"1"=>[0x10],_=>throw new IOException("Malformed ASCII bit")};
  if(data.Length!=Width(s.Type)*4)throw new IOException("Unexpected ASCII payload length");
  byte[] bytes=new byte[Width(s.Type)*2];
  for(int i=0;i<Width(s.Type);i++){
   if(!ushort.TryParse(data.AsSpan(i*4,4),NumberStyles.HexNumber,CultureInfo.InvariantCulture,out var word))throw new IOException("Invalid ASCII word");
   BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(i*2),word);
  }
  return bytes;
 }
 public async Task<Measurement> ReadAsync(string site,string revision,Plc p,Sensor s,CancellationToken ct) {
  using var deadline=CancellationTokenSource.CreateLinkedTokenSource(ct);deadline.CancelAfter(p.TimeoutMs);
  try {
   if(client is null) {
    client=new TcpClient{NoDelay=true};await client.ConnectAsync(p.Host,p.Port,deadline.Token);stream=client.GetStream();
   }
   await stream!.WriteAsync(Request(s,p.FrameMode),deadline.Token);
   byte[] payload;
   if(p.FrameMode=="Binary") {
    var h=new byte[9];await stream.ReadExactlyAsync(h,deadline.Token);
    var body=new byte[ResponseLength(h)];await stream.ReadExactlyAsync(body,deadline.Token);
    int end=BinaryPrimitives.ReadUInt16LittleEndian(body);
    if(end!=0)throw new PlcProtocolException($"PLC SLMP end code 0x{end:X4}");
    payload=body[2..];
   }else{
    var h=new byte[18];await stream.ReadExactlyAsync(h,deadline.Token);
    string header=Encoding.ASCII.GetString(h);
    if(!header.StartsWith("D00000FF03FF00",StringComparison.OrdinalIgnoreCase)||!int.TryParse(header[14..],NumberStyles.HexNumber,CultureInfo.InvariantCulture,out var length)||length<4||length>8192)throw new IOException("Invalid ASCII SLMP response header");
    var body=new byte[length];await stream.ReadExactlyAsync(body,deadline.Token);
    payload=AsciiPayload(Encoding.ASCII.GetString(body),s);
   }
   var raw=Decode(payload,s);
   object? value=raw;string quality="Good";string? error=null;
   if(raw is not bool) {
    double numeric=Convert.ToDouble(raw,CultureInfo.InvariantCulture);
    double v=numeric*s.Scale+s.Offset;
    if(!double.IsFinite(numeric)||!double.IsFinite(v)){quality="BadDecode";value=null;raw="NonFinite";error="Nonfinite numeric data";}
    else {value=v;if((s.Min.HasValue&&v<s.Min)||(s.Max.HasValue&&v>s.Max)){quality="UncertainRange";error="Outside configured engineering range";}}
   }
   return new(Guid.NewGuid().ToString("N"),site,p.Id,s.Id,revision,DateTimeOffset.UtcNow,null,raw,value,s.Unit,quality,error,Convert.ToHexString(payload));
  }catch(OperationCanceledException)when(ct.IsCancellationRequested){Close();throw;}
  catch(Exception e)when(e is IOException or SocketException or OperationCanceledException or ArgumentException) {
   Close();string q=e is OperationCanceledException?"BadTimeout":e is PlcProtocolException?"BadProtocol":"BadCommunication";
   return new(Guid.NewGuid().ToString("N"),site,p.Id,s.Id,revision,DateTimeOffset.UtcNow,null,null,null,s.Unit,q,e.Message,"");
  }
 }
 void Close(){stream?.Dispose();client?.Dispose();stream=null;client=null;}
 public ValueTask DisposeAsync(){Close();return ValueTask.CompletedTask;}
}
