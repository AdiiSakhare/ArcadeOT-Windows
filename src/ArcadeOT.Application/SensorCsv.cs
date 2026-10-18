using System.Globalization;
using Microsoft.VisualBasic.FileIO;
using ArcadeOT.Domain;
namespace ArcadeOT.Application;
public static class SensorCsv
{
    public static IReadOnlyList<SensorConfiguration> Parse(string csv)
    {
        if (csv.Length > 2_000_000) throw new ArgumentException("Sensor CSV exceeds 2 MB.");
        using var parser = new TextFieldParser(new StringReader(csv)) { TextFieldType = FieldType.Delimited, HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false };
        parser.SetDelimiters(",");
        var headers = parser.ReadFields() ?? throw new ArgumentException("CSV needs a header row.");
        string[] known = ["Id", "Name", "Group", "Address", "Type", "Scale", "Offset", "Unit", "SwapWords", "Min", "Max", "ModuleSku", "Slot", "Channel", "Terminal", "Common", "Signal", "SensorModel", "ManualReference"];
        if (headers.Distinct(StringComparer.Ordinal).Count() != headers.Length || headers.Any(h => !known.Contains(h)) || !new[] { "Name", "Address", "Type" }.All(headers.Contains)) throw new ArgumentException("CSV needs unique recognized headers including Name, Address and Type.");
        var sensors = new List<SensorConfiguration>();
        while (!parser.EndOfData)
        {
            var fields = parser.ReadFields()!;
            if (fields.Length != headers.Length || sensors.Count >= 10000) throw new ArgumentException("CSV row width or row count is invalid.");
            var values = headers.Zip(fields).ToDictionary(x => x.First, x => x.Second, StringComparer.Ordinal);
            string Get(string name, string fallback = "") => values.GetValueOrDefault(name, fallback);
            double Number(string name, double fallback) => Get(name) == "" ? fallback : double.Parse(Get(name), NumberStyles.Float, CultureInfo.InvariantCulture);
            var sensor = new SensorConfiguration { Id = Get("Id", Guid.NewGuid().ToString("N")), Name = Get("Name"), Group = Get("Group"), Address = Get("Address"), Type = Get("Type"), Scale = Number("Scale", 1), Offset = Number("Offset", 0), Unit = Get("Unit"), SwapWords = Get("SwapWords") != "" && bool.Parse(Get("SwapWords")), Min = Get("Min") == "" ? null : Number("Min", 0), Max = Get("Max") == "" ? null : Number("Max", 0), ModuleSku = Get("ModuleSku"), Slot = Get("Slot"), Channel = Get("Channel"), Terminal = Get("Terminal"), Common = Get("Common"), Signal = Get("Signal"), SensorModel = Get("SensorModel"), ManualReference = Get("ManualReference") };
            sensors.Add(sensor);
        }
        ConfigurationValidator.Validate(new SiteConfiguration { Plcs = [new PlcConfiguration { Sensors = [.. sensors] }] });
        return sensors;
    }
}
