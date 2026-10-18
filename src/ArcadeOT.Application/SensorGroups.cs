using ArcadeOT.Domain;
namespace ArcadeOT.Application;
public static class SensorGroups
{
    public static IReadOnlyList<SensorConfiguration> Create(string prefix, string address, string type, int count, string unit = "", double scale = 1)
    {
        if (string.IsNullOrWhiteSpace(prefix) || count is < 1 or > 500) throw new ArgumentException("Enter a prefix and count from 1 to 500.");
        var (area, start) = DeviceAddress.Parse(address); int width = DeviceAddress.Width(type);
        if ((area != "D") != (type == "Bool")) throw new ArgumentException("Address/type mismatch.");
        if (start + count * width - 1 > 0xFFFFFF) throw new ArgumentException("Generated group overflows address range.");
        return Enumerable.Range(0, count).Select(i => new SensorConfiguration
        {
            Id = Guid.NewGuid().ToString("N"), Name = prefix + (i + 1), Group = prefix.TrimEnd('-', ' '),
            Address = area + (area is "X" or "Y" ? Convert.ToString(start + i * width, 8) : (start + i * width).ToString(System.Globalization.CultureInfo.InvariantCulture)),
            Type = type, Unit = unit, Scale = scale
        }).ToArray();
    }
}
