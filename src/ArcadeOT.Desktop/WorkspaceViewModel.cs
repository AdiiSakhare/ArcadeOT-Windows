using System.IO;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using ArcadeOT.Application;
using ArcadeOT.Domain;
using Microsoft.Win32;
namespace ArcadeOT.Desktop;

public sealed class AsyncCommand(Func<Task> execute, Func<bool> canExecute) : ICommand
{
    public bool CanExecute(object? parameter) => canExecute();
    public async void Execute(object? parameter) => await execute();
    public event EventHandler? CanExecuteChanged { add => CommandManager.RequerySuggested += value; remove => CommandManager.RequerySuggested -= value; }
}
public sealed class WorkspaceViewModel : INotifyPropertyChanged, IDisposable
{
    readonly HttpClient http = new() { BaseAddress = new Uri("http://127.0.0.1:17846/"), Timeout = TimeSpan.FromSeconds(65) };
    SiteConfiguration configuration = new(); PlcConfiguration? selectedPlc; bool busy;
    string status = "Connecting to the local collector…", serviceState = "Connecting…", bufferState = "—", readingState = "No observations", uploadState = "Not connected";
    string savedJson = "";
    long historyCursor = long.MaxValue;
    public event PropertyChangedEventHandler? PropertyChanged;
    public SiteConfiguration Configuration { get => configuration; private set { configuration = value; Notify(); } }
    public PlcConfiguration? SelectedPlc { get => selectedPlc; set { selectedPlc = value; SelectedSensor = null; Notify(); Notify(nameof(HasSelection)); CommandManager.InvalidateRequerySuggested(); } }
    public SensorConfiguration? SelectedSensor { get; set; }
    public ConfigurationRevision? SelectedRevision { get; set; }
    public bool HasSelection => SelectedPlc is not null;
    public bool IsReady => !busy;
    public string Status { get => status; set { status = value; Notify(); } }
    public string ServiceState { get => serviceState; set { serviceState = value; Notify(); } }
    public string BufferState { get => bufferState; set { bufferState = value; Notify(); } }
    public string ReadingState { get => readingState; set { readingState = value; Notify(); } }
    public string UploadState { get => uploadState; set { uploadState = value; Notify(); } }
    public IReadOnlyList<PlcProfile> Profiles => HardwareCatalog.Profiles;
    public string[] FrameModes { get; } = ["Binary", "AsciiOctal", "AsciiHex"];
    public static string[] Types { get; } = ["Int16", "UInt16", "Int32", "UInt32", "Float32", "Bool"];
    public ObservableCollection<LiveReading> Live { get; } = [];
    public ObservableCollection<PlcHealth> PlcHealth { get; } = [];
    public ObservableCollection<Measurement> History { get; } = [];
    public ObservableCollection<ConfigurationRevision> Revisions { get; } = [];
    public Func<bool> CommitEdits { get; set; } = () => true;
    public Func<string> ReadCredential { get; set; } = () => "";
    public Action ClearCredential { get; set; } = () => { };
    public ICommand ReloadCommand { get; }
    public ICommand SaveCommand { get; }
    public ICommand AddPlcCommand { get; }
    public ICommand ClonePlcCommand { get; }
    public ICommand RemovePlcCommand { get; }
    public ICommand AddSensorCommand { get; }
    public ICommand RemoveSensorCommand { get; }
    public ICommand BulkCommand { get; }
    public ICommand ImportCsvCommand { get; }
    public ICommand TestReadCommand { get; }
    public ICommand LoadHistoryCommand { get; }
    public ICommand OlderHistoryCommand { get; }
    public ICommand ExportReadingsCommand { get; }
    public ICommand ExportConfigCommand { get; }
    public ICommand ImportConfigCommand { get; }
    public ICommand SetCredentialCommand { get; }
    public ICommand RestoreCommand { get; }
    public ICommand RetryCommand { get; }
    public bool HasUnsavedChanges => savedJson != "" && JsonSerializer.Serialize(Configuration, JsonContract.Options) != savedJson;
    public WorkspaceViewModel()
    {
        savedJson = JsonSerializer.Serialize(Configuration, JsonContract.Options);
        ReloadCommand = Command(async () => { if (!Discard()) return; await Reload(); });
        SaveCommand = Command(Save);
        AddPlcCommand = Command(() => { var plc = new PlcConfiguration { Name = "Controller " + (Configuration.Plcs.Count + 1) }; Configuration.Plcs.Add(plc); SelectedPlc = plc; Status = "Controller added locally. Configure it and save to apply."; return Task.CompletedTask; });
        ClonePlcCommand = Command(() =>
        {
            var clone = JsonContract.Clone(SelectedPlc!); clone.Id = Guid.NewGuid().ToString("N"); clone.Name += " copy"; clone.Enabled = false;
            foreach (var sensor in clone.Sensors) sensor.Id = Guid.NewGuid().ToString("N");
            Configuration.Plcs.Add(clone); SelectedPlc = clone; return Task.CompletedTask;
        }, () => HasSelection);
        RemovePlcCommand = Command(() =>
        {
            if (Confirm("Remove this controller and its mappings from the configuration? Stored readings are retained.")) { Configuration.Plcs.Remove(SelectedPlc!); SelectedPlc = Configuration.Plcs.FirstOrDefault(); }
            return Task.CompletedTask;
        }, () => HasSelection);
        AddSensorCommand = Command(() => { var sensor = new SensorConfiguration { Name = "Sensor " + (SelectedPlc!.Sensors.Count + 1) }; SelectedPlc.Sensors.Add(sensor); SelectedSensor = sensor; Status = "New mapping is an unverified placeholder. Enter the approved PLC address."; return Task.CompletedTask; }, () => HasSelection);
        RemoveSensorCommand = Command(() => { SelectedPlc!.Sensors.Remove(SelectedSensor!); SelectedSensor = null; return Task.CompletedTask; }, () => HasSelection && SelectedSensor is not null);
        BulkCommand = Command(() =>
        {
            var dialog = new SensorGroupDialog { Owner = System.Windows.Application.Current.MainWindow };
            if (dialog.ShowDialog() == true)
            {
                var sensors = SensorGroups.Create(dialog.Prefix, dialog.StartAddress, dialog.SensorType, dialog.Count, dialog.Unit, dialog.Scale);
                var preview = JsonContract.Clone(Configuration); foreach (var sensor in sensors) preview.Plcs.Single(p => p.Id == SelectedPlc!.Id).Sensors.Add(sensor);
                ConfigurationValidator.Validate(preview); foreach (var sensor in sensors) SelectedPlc!.Sensors.Add(sensor);
                Status = $"Added {sensors.Count} mappings. Review addresses, types and scaling before enabling.";
            }
            return Task.CompletedTask;
        }, () => HasSelection);
        ImportCsvCommand = Command(ImportCsv, () => HasSelection);
        TestReadCommand = Command(async () =>
        {
            if (HasUnsavedChanges) throw new ArgumentException("Save or discard local changes before testing the saved mapping.");
            using var response = await http.PostAsync("plcs/" + Uri.EscapeDataString(SelectedPlc!.Id) + "/test", null); await Ensure(response);
            var sample = await response.Content.ReadFromJsonAsync<Measurement>(JsonContract.Options) ?? throw new IOException("Empty test response.");
            Status = $"Saved first mapping: {sample.Quality} · raw={sample.RawValue} · value={sample.Value} {sample.Unit} · {sample.Error}";
        }, () => HasSelection);
        LoadHistoryCommand = Command(async () => { historyCursor = long.MaxValue; await LoadHistory(); });
        OlderHistoryCommand = Command(LoadHistory, () => History.Count > 0);
        ExportReadingsCommand = Command(async () =>
        {
            var dialog = new SaveFileDialog { Filter = "CSV files|*.csv", FileName = "ArcadeOT-readings.csv" };
            if (dialog.ShowDialog() != true) return;
            var csv = await http.GetStringAsync("export.csv"); await File.WriteAllTextAsync(dialog.FileName, csv, Encoding.UTF8);
            Status = "Exported latest 10,000 persisted observations (or fewer if unavailable).";
        });
        ExportConfigCommand = Command(async () =>
        {
            ConfigurationValidator.Validate(Configuration);
            var dialog = new SaveFileDialog { Filter = "JSON configuration|*.json", FileName = "ArcadeOT-configuration.json" };
            if (dialog.ShowDialog() == true) { await File.WriteAllTextAsync(dialog.FileName, JsonSerializer.Serialize(Configuration, JsonContract.Options)); Status = "Configuration exported without credentials."; }
        });
        ImportConfigCommand = Command(async () =>
        {
            if (!Discard()) return;
            var dialog = new OpenFileDialog { Filter = "JSON configuration|*.json" }; if (dialog.ShowDialog() != true) return;
            if (new FileInfo(dialog.FileName).Length > 2_000_000) throw new ArgumentException("Configuration exceeds 2 MB.");
            var input = ConfigurationImport.Parse(await File.ReadAllTextAsync(dialog.FileName));
            ConfigurationValidator.Validate(input);
            Configuration = input!; SelectedPlc = Configuration.Plcs.FirstOrDefault(); Status = "Configuration imported locally. Legacy v1 PLCs are disabled during migration. Review and save to apply; no credentials imported.";
        });
        SetCredentialCommand = Command(async () =>
        {
            using var response = await http.PostAsync("cloud-credential", new StringContent(ReadCredential())); await Ensure(response); ClearCredential(); Status = "Cloud credential stored in the protected service directory.";
        });
        RestoreCommand = Command(async () =>
        {
            if (SelectedRevision is null || !Discard() || !Confirm("Restore this saved configuration as a new active revision? Collection mappings will change.")) return;
            using var response = await http.PostAsync("config/restore/" + Uri.EscapeDataString(SelectedRevision.Revision), null); await Ensure(response);
            await Reload(); Status = "Configuration restored as a new revision; history preserved.";
        }, () => SelectedRevision is not null);
        RetryCommand = Command(async () =>
        {
            if (!Confirm("Retry all quarantined batches after correcting the backend or mappings? Rejected events remain preserved if rejected again.")) return;
            using var response = await http.PostAsync("quarantine/retry", null); await Ensure(response); Status = "Quarantined events returned to the pending queue.";
        });
    }
    ICommand Command(Func<Task> action, Func<bool>? enabled = null) => new AsyncCommand(async () =>
    {
        busy = true; Notify(nameof(IsReady)); CommandManager.InvalidateRequerySuggested();
        try
        {
            if (!CommitEdits()) throw new ArgumentException("Correct invalid grid or numeric fields before continuing.");
            await action();
        }
        catch (Exception error) { Status = error.Message; }
        finally { busy = false; Notify(nameof(IsReady)); CommandManager.InvalidateRequerySuggested(); }
    }, () => !busy && (enabled?.Invoke() ?? true));
    public async Task Initialize()
    {
        try
        {
            var data = Environment.GetEnvironmentVariable("ARCADEOT_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ArcadeOT2");
            var token = (await File.ReadAllTextAsync(Path.Combine(data, "api-token.txt"))).Trim(); http.DefaultRequestHeaders.Add("X-ArcadeOT-Key", token);
            await Reload();
        }
        catch (Exception error) { ServiceState = "Offline"; Status = "Collector unavailable. Run the Windows installer, then Reload. " + error.Message; }
    }
    async Task Reload()
    {
        // Retry provisioning read after an installer has been run while UI remains open.
        if (!http.DefaultRequestHeaders.Contains("X-ArcadeOT-Key"))
        {
            var data = Environment.GetEnvironmentVariable("ARCADEOT_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ArcadeOT2");
            http.DefaultRequestHeaders.Add("X-ArcadeOT-Key", File.ReadAllText(Path.Combine(data, "api-token.txt")).Trim());
        }
        var selectedId = SelectedPlc?.Id;
        Configuration = await http.GetFromJsonAsync<SiteConfiguration>("config", JsonContract.Options) ?? throw new IOException("No service configuration.");
        savedJson = JsonSerializer.Serialize(Configuration, JsonContract.Options);
        SelectedPlc = Configuration.Plcs.FirstOrDefault(p => p.Id == selectedId) ?? Configuration.Plcs.FirstOrDefault();
        Replace(Revisions, await http.GetFromJsonAsync<List<ConfigurationRevision>>("config/history", JsonContract.Options) ?? []);
        await Refresh(); Status = "Configuration loaded. All I/O references remain unverified until commissioned.";
    }
    async Task Save()
    {
        ConfigurationValidator.Validate(Configuration);
        var profile = SelectedPlc is null ? null : Profiles.First(x => x.Id == SelectedPlc.ProfileId);
        var details = $"Site: {Configuration.SiteId}\nPLCs: {Configuration.Plcs.Count}\nEnabled: {Configuration.Plcs.Count(p => p.Enabled)}\nSensors: {Configuration.Plcs.Sum(p => p.Sensors.Count)}\n" + (profile?.Status ?? "") + "\n\nApply this configuration? Existing readings remain stored.";
        if (!Confirm(details)) return;
        using var response = await http.PostAsJsonAsync("config", Configuration, JsonContract.Options); await Ensure(response);
        await Reload(); Status = "Configuration validated and saved as a new revision. Collector is applying the mappings.";
    }
    public async Task Refresh()
    {
        try
        {
            var health = await http.GetFromJsonAsync<GatewayHealth>("health", JsonContract.Options) ?? throw new IOException("No health response.");
            var live = await http.GetFromJsonAsync<List<LiveReading>>("live", JsonContract.Options) ?? [];
            ServiceState = health.State; BufferState = $"{health.Buffer.Pending:N0} pending · {health.Buffer.Quarantined:N0} held";
            ReadingState = $"{live.Count(x => x.Quality == "Good")} good / {live.Count} observations";
            UploadState = health.Upload; Replace(Live, live); Replace(PlcHealth, health.Plcs);
        }
        catch (Exception) { ServiceState = "Offline"; ReadingState = "No current observations"; Live.Clear(); PlcHealth.Clear(); UploadState = "Service unavailable; reconnect to inspect queue"; }
    }
    public async Task TimerRefresh() { if (!busy) { busy = true; try { await Refresh(); } finally { busy = false; } } }
    async Task LoadHistory()
    {
        var rows = await http.GetFromJsonAsync<List<StoredMeasurement>>($"history?before={historyCursor}&limit=200", JsonContract.Options) ?? [];
        if (rows.Count == 0) { Status = "No older stored observations."; return; }
        historyCursor = rows.Min(x => x.Sequence); Replace(History, rows.Select(x => x.Measurement)); Status = $"Showing {rows.Count} persisted observations. Use Older page to continue.";
    }
    async Task ImportCsv()
    {
        var dialog = new OpenFileDialog { Filter = "Sensor mappings CSV|*.csv" }; if (dialog.ShowDialog() != true) return;
        if (new FileInfo(dialog.FileName).Length > 2_000_000) throw new ArgumentException("CSV exceeds 2 MB.");
        var sensors = SensorCsv.Parse(await File.ReadAllTextAsync(dialog.FileName));
        var preview = JsonContract.Clone(Configuration); foreach (var sensor in sensors) preview.Plcs.Single(p => p.Id == SelectedPlc!.Id).Sensors.Add(sensor);
        ConfigurationValidator.Validate(preview);
        var window = new ImportPreviewWindow(sensors) { Owner = System.Windows.Application.Current.MainWindow };
        if (window.ShowDialog() != true) return;
        foreach (var sensor in sensors) SelectedPlc!.Sensors.Add(sensor); Status = $"Imported {sensors.Count} mappings locally. Review physical references and save to apply.";
    }
    bool Discard() => !HasUnsavedChanges || Confirm("Discard unsaved configuration changes?");
    static bool Confirm(string text) => MessageBox.Show(text, "ArcadeOT", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;
    static async Task Ensure(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode) throw new IOException($"Collector returned {(int)response.StatusCode}: " + await response.Content.ReadAsStringAsync());
    }
    static void Replace<T>(ObservableCollection<T> target, IEnumerable<T> values) { target.Clear(); foreach (var value in values) target.Add(value); }
    void Notify([CallerMemberName] string? name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    public void Dispose() => http.Dispose();
}
