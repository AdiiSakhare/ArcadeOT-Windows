using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
namespace ArcadeOT.Desktop;
public partial class MainWindow : Window
{
    readonly WorkspaceViewModel model = new();
    readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromSeconds(2) };
    public MainWindow()
    {
        InitializeComponent(); DataContext = model; TypeColumn.ItemsSource = WorkspaceViewModel.Types;
        model.CommitEdits = () => SensorsGrid.CommitEdit(DataGridEditingUnit.Cell, true) && SensorsGrid.CommitEdit(DataGridEditingUnit.Row, true) && IoGrid.CommitEdit(DataGridEditingUnit.Cell, true) && IoGrid.CommitEdit(DataGridEditingUnit.Row, true) && !HasErrors(this);
        model.ReadCredential = () => CloudSecret.Password; model.ClearCredential = () => CloudSecret.Clear();
        Loaded += async (_, _) => { await model.Initialize(); timer.Start(); };
        timer.Tick += async (_, _) => await model.TimerRefresh();
        Closing += (_, args) =>
        {
            if (model.HasUnsavedChanges && MessageBox.Show("Close without saving configuration changes? The service continues collecting its last saved configuration.", "ArcadeOT", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) args.Cancel = true;
        };
        Closed += (_, _) => { timer.Stop(); model.Dispose(); };
    }
    static bool HasErrors(DependencyObject node)
    {
        if (Validation.GetHasError(node)) return true;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(node); i++) if (HasErrors(VisualTreeHelper.GetChild(node, i))) return true;
        return false;
    }
}
