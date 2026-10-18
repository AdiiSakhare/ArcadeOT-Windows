using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using ArcadeOT.Domain;
namespace ArcadeOT.Desktop;
public sealed class SensorGroupDialog : Window
{
    readonly TextBox prefix = new() { Text = "temperature-" }, address = new() { Text = "D100" }, count = new() { Text = "8" }, unit = new(), scale = new() { Text = "1" };
    readonly ComboBox type = new() { ItemsSource = WorkspaceViewModel.Types, SelectedIndex = 0 };
    public string Prefix => prefix.Text.Trim();
    public string StartAddress => address.Text.Trim();
    public string SensorType => (string)type.SelectedItem;
    public int Count => int.Parse(count.Text, CultureInfo.InvariantCulture);
    public double Scale => double.Parse(scale.Text, CultureInfo.InvariantCulture);
    public string Unit => unit.Text.Trim();
    public SensorGroupDialog()
    {
        Title = "Add a repeated sensor group"; Width = 450; SizeToContent = SizeToContent.Height; ResizeMode = ResizeMode.NoResize; WindowStartupLocation = WindowStartupLocation.CenterOwner;
        var panel = new StackPanel { Margin = new Thickness(24) }; Content = panel;
        panel.Children.Add(new TextBlock { Text = "Repeat mappings, retain unique IDs", FontSize = 19, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 8) });
        Field("Name prefix", prefix); Field("Start address (approved PLC map)", address); Field("Data type", type); Field("Count (1–500)", count); Field("Engineering unit", unit); Field("Scale", scale);
        panel.Children.Add(new TextBlock { Text = "32-bit values use two D registers. Review generated mappings before enabling collection.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 18, 0, 18) });
        var add = new Button { Content = "Create mappings", IsDefault = true }; panel.Children.Add(add);
        add.Click += (_, _) =>
        {
            try { _ = ArcadeOT.Application.SensorGroups.Create(Prefix, StartAddress, SensorType, Count, Unit, Scale); if (!double.IsFinite(Scale)) throw new ArgumentException("Scale must be finite."); DialogResult = true; }
            catch (Exception error) { MessageBox.Show(this, error.Message, "Check group settings"); }
        };
        void Field(string label, Control field) { panel.Children.Add(new TextBlock { Text = label, Margin = new Thickness(0, 12, 0, 6) }); panel.Children.Add(field); }
    }
}
public sealed class ImportPreviewWindow : Window
{
    public ImportPreviewWindow(IReadOnlyList<SensorConfiguration> sensors)
    {
        Title = "Review CSV mappings"; Width = 900; Height = 540; WindowStartupLocation = WindowStartupLocation.CenterOwner;
        var panel = new DockPanel { Margin = new Thickness(20) }; Content = panel;
        var title = new TextBlock { Text = $"{sensors.Count} mappings ready to add · review before import", FontSize = 18, Margin = new Thickness(0, 0, 0, 18) }; DockPanel.SetDock(title, Dock.Top); panel.Children.Add(title);
        var add = new Button { Content = "Add these mappings", Margin = new Thickness(0, 16, 0, 0) }; add.Click += (_, _) => DialogResult = true; DockPanel.SetDock(add, Dock.Bottom); panel.Children.Add(add);
        var grid = new DataGrid { ItemsSource = sensors, IsReadOnly = true, AutoGenerateColumns = true }; panel.Children.Add(grid);
    }
}
