using System.ComponentModel;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ArcadeOT.Core;
namespace ArcadeOT.Desktop;
static class Program {
 [STAThread]static void Main(){ApplicationConfiguration.Initialize();Application.Run(new MainForm());}
}
sealed class MainForm:Form {
 readonly HttpClient http=new(){BaseAddress=new Uri("http://127.0.0.1:17845/"),Timeout=TimeSpan.FromSeconds(8)};
 readonly ComboBox plcs=new(){Width=220,DropDownStyle=ComboBoxStyle.DropDownList};
 readonly TextBox host=new(){Width=150},port=new(){Width=65},poll=new(){Width=65};
 readonly TextBox model=new(){Width=150},firmware=new(){Width=90},timeout=new(){Width=65},cloud=new(){Width=320};
 readonly ComboBox mode=new(){Width=120,DropDownStyle=ComboBoxStyle.DropDownList,DataSource=new[]{"Binary","AsciiOctal","AsciiHex"}};
 readonly TextBox cloudToken=new(){Width=150,UseSystemPasswordChar=true};
 readonly CheckBox enabled=new(){Text="Enable reads",AutoSize=true};
 readonly DataGridView sensors=new(){Dock=DockStyle.Fill,AutoGenerateColumns=false,AllowUserToAddRows=true,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill};
 readonly DataGridView live=new(){Dock=DockStyle.Fill,ReadOnly=true,AutoGenerateColumns=true,AllowUserToAddRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.DisplayedCells};
 readonly TextBox advanced=new(){Multiline=true,ScrollBars=ScrollBars.Both,Dock=DockStyle.Fill,Font=new Font("Consolas",10)};
 readonly TextBox status=new(){Multiline=true,ReadOnly=true,Dock=DockStyle.Bottom,Height=105,ScrollBars=ScrollBars.Vertical};
 GatewayConfig config=new();Plc? current;bool refreshing;
 readonly System.Windows.Forms.Timer timer=new(){Interval=2000};
 public MainForm(){
  Text="ArcadeOT • FX5U live collector";Width=1400;Height=850;MinimumSize=new Size(1050,600);StartPosition=FormStartPosition.CenterScreen;
  var tabs=new TabControl{Dock=DockStyle.Fill};var setup=new TabPage("PLCs & sensors");var dashboard=new TabPage("Live dashboard");var json=new TabPage("Advanced configuration");tabs.TabPages.AddRange([setup,dashboard,json]);
  var top=new FlowLayoutPanel{Dock=DockStyle.Top,Height=120,Padding=new Padding(8),AutoScroll=true};
  top.Controls.Add(plcs);top.Controls.Add(Button("Add PLC",AddPlc));top.Controls.Add(Label("IP / host"));top.Controls.Add(host);top.Controls.Add(Label("SLMP TCP port"));top.Controls.Add(port);top.Controls.Add(Label("Poll ms"));top.Controls.Add(poll);top.Controls.Add(Label("Model"));top.Controls.Add(model);top.Controls.Add(Label("Firmware"));top.Controls.Add(firmware);top.Controls.Add(Label("Frame mode"));top.Controls.Add(mode);top.Controls.Add(Label("Timeout ms"));top.Controls.Add(timeout);top.Controls.Add(Label("Cloud HTTPS URL"));top.Controls.Add(cloud);top.Controls.Add(Label("Cloud token"));top.Controls.Add(cloudToken);top.Controls.Add(Button("Set cloud token",async()=>{try{using var resp=await http.PostAsync("cloud-credential",new StringContent(cloudToken.Text));resp.EnsureSuccessStatusCode();cloudToken.Clear();status.Text="Cloud credential saved securely.";}catch(Exception e){ShowError(e);}}));top.Controls.Add(enabled);top.Controls.Add(Button("Save & apply",async()=>await Save()));
  var actions=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=48,Padding=new Padding(8)};
  actions.Controls.Add(Button("Add repeated sensors",Bulk));actions.Controls.Add(Button("Reload",async()=>await Reload()));actions.Controls.Add(Button("Export latest 100,000 CSV",async()=>await Export()));
  foreach(var name in new[]{"Id","Name","Address","Type","Scale","Offset","Unit","SwapWords","Min","Max"}){
   DataGridViewColumn col=name=="SwapWords"?new DataGridViewCheckBoxColumn():name=="Type"?new DataGridViewComboBoxColumn{DataSource=new[]{"Int16","UInt16","Int32","UInt32","Float32","Bool"}}:new DataGridViewTextBoxColumn();
   col.Name=name;col.DataPropertyName=name;col.HeaderText=name;sensors.Columns.Add(col);
  }
  sensors.DataError+=(_,e)=>{e.ThrowException=false;status.Text="Invalid cell value: "+e.Exception?.Message;};
  setup.Controls.Add(sensors);setup.Controls.Add(top);setup.Controls.Add(actions);dashboard.Controls.Add(live);json.Controls.Add(advanced);
  var applyJson=Button("Validate & apply JSON",async()=>{try{var parsed=JsonSerializer.Deserialize<GatewayConfig>(advanced.Text,Format.Json)!;parsed.Validate();await Post(parsed);await Reload();}catch(Exception e){ShowError(e);}});applyJson.Dock=DockStyle.Bottom;applyJson.Height=40;json.Controls.Add(applyJson);
  var note=new Label{Dock=DockStyle.Top,Height=42,Padding=new Padding(10),Text="SLMP 3E / TCP • D and M decimal, X and Y octal • readings only • actual model memory limits must be checked • service keeps running when this window closes"};
  Controls.Add(tabs);Controls.Add(note);Controls.Add(status);
  plcs.SelectedIndexChanged+=(_,_)=>{CaptureFields();SelectPlc();};
  Shown+=async(_,_)=>{try{http.DefaultRequestHeaders.Add("X-ArcadeOT-Key",File.ReadAllText(Path.Combine(Format.DataDir,"api-token.txt")).Trim());await Reload();timer.Start();}catch(Exception e){ShowError(e);}};
  timer.Tick+=async(_,_)=>await RefreshLive();
  FormClosed+=(_,_)=>{timer.Stop();timer.Dispose();http.Dispose();};
 }
 static Label Label(string text)=>new(){Text=text,AutoSize=true,Padding=new Padding(2,7,2,0)};
 static Button Button(string text,Action click){var b=new Button{Text=text,AutoSize=true,Height=30};b.Click+=(_,_)=>click();return b;}
 void CaptureFields(){if(current==null)return;sensors.EndEdit();if(sensors.DataSource is {} ds && sensors.BindingContext?[ds] is CurrencyManager cm)cm.EndCurrentEdit();current.Host=host.Text.Trim();current.Port=int.TryParse(port.Text,out var n)?n:0;current.PollMs=int.TryParse(poll.Text,out var ms)?ms:0;current.Enabled=enabled.Checked;current.Model=model.Text;current.Firmware=firmware.Text;current.FrameMode=mode.Text;current.TimeoutMs=int.TryParse(timeout.Text,out var tm)?tm:3000;config.CloudUrl=cloud.Text.Trim();}
 void SelectPlc(){current=plcs.SelectedIndex>=0?config.Plcs[plcs.SelectedIndex]:null;if(current==null){sensors.DataSource=null;return;}model.Text=current.Model;firmware.Text=current.Firmware;mode.SelectedItem=current.FrameMode;timeout.Text=current.TimeoutMs.ToString();cloud.Text=config.CloudUrl;host.Text=current.Host;port.Text=current.Port.ToString();poll.Text=current.PollMs.ToString();enabled.Checked=current.Enabled;sensors.DataSource=new BindingList<Sensor>(current.Sensors);}
 async Task Reload(){try{config=await http.GetFromJsonAsync<GatewayConfig>("config",Format.Json)??new();current=null;plcs.Items.Clear();foreach(var p in config.Plcs)plcs.Items.Add(p.Id);if(plcs.Items.Count>0)plcs.SelectedIndex=0;advanced.Text=JsonSerializer.Serialize(config,Format.Json);await RefreshLive();}catch(Exception e){ShowError(e);}}
 void AddPlc(){CaptureFields();var id=Prompt("New PLC","Unique PLC ID","fx5u-"+(config.Plcs.Count+1));if(id==null)return;config.Plcs.Add(new(){Id=id});current=null;plcs.Items.Add(id);plcs.SelectedIndex=plcs.Items.Count-1;}
 void Bulk(){try{if(current==null)throw new ArgumentException("Add a PLC first.");CaptureFields();var prefix=Prompt("Repeated sensors","Sensor ID prefix","temperature-");if(prefix==null)return;var start=Prompt("Repeated sensors","Start address (D decimal, X/Y octal)","D100");if(start==null)return;var countText=Prompt("Repeated sensors","Count (1–500)","8");if(countText==null)return;var type=Prompt("Repeated sensors","Type: Int16 / UInt16 / Int32 / UInt32 / Float32 / Bool","Int16");if(type==null)return;int count=int.Parse(countText);if(count<1||count>500)throw new ArgumentException("Count must be 1–500");var(a,n)=Slmp.ParseAddress(start);int width=Slmp.Width(type);for(int i=0;i<count;i++){int number=n+i*width;string digits=a is "X" or "Y"?Convert.ToString(number,8):number.ToString();current.Sensors.Add(new(){Id=prefix+(i+1),Name=prefix+(i+1),Address=a+digits,Type=type});}SelectPlc();}catch(Exception e){ShowError(e);}}
 async Task Post(GatewayConfig c){using var response=await http.PostAsJsonAsync("config",c,Format.Json);if(!response.IsSuccessStatusCode)throw new IOException(await response.Content.ReadAsStringAsync());}
 async Task Save(){try{CaptureFields();config.Validate();await Post(config);advanced.Text=JsonSerializer.Serialize(config,Format.Json);status.Text="Configuration saved. Live readings will update in the dashboard.";}catch(Exception e){ShowError(e);}}
 async Task RefreshLive(){if(refreshing)return;refreshing=true;try{var rows=await http.GetFromJsonAsync<List<LiveRow>>("live",Format.Json)??[];var now=DateTimeOffset.UtcNow;live.DataSource=rows.Select(x=>DateTimeOffset.TryParse(x.ObservedUtc,out var t)&&config.Plcs.FirstOrDefault(p=>p.Id==x.Plc) is {} p&&now-t>TimeSpan.FromMilliseconds(Math.Max(p.PollMs*3,p.TimeoutMs+5000))?x with{Quality="Stale",Detail="No recent observation; last recorded quality: "+x.Quality}:x).ToList();status.Text=await http.GetStringAsync("health");}catch(Exception e){status.Text="Service unavailable — displayed values are not current. "+e.Message;live.DataSource=null;}finally{refreshing=false;}}
 async Task Export(){try{using var dialog=new SaveFileDialog{Filter="CSV|*.csv",FileName="ArcadeOT-readings.csv"};if(dialog.ShowDialog()!=DialogResult.OK)return;await File.WriteAllTextAsync(dialog.FileName,await http.GetStringAsync("export.csv"),Encoding.UTF8);status.Text="CSV exported: "+dialog.FileName;}catch(Exception e){ShowError(e);}}
 void ShowError(Exception e){status.Text=e.Message;MessageBox.Show(this,e.Message,"ArcadeOT",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
 static string? Prompt(string title,string label,string value){using var f=new Form{Text=title,Width=480,Height=170,StartPosition=FormStartPosition.CenterParent};var t=new TextBox{Text=value,Left=15,Top=45,Width=430};var b=new Button{Text="OK",DialogResult=DialogResult.OK,Left=350,Top=80};f.Controls.AddRange([new Label{Text=label,Left=15,Top=15,Width=440},t,b]);f.AcceptButton=b;return f.ShowDialog()==DialogResult.OK?t.Text.Trim():null;}
}
