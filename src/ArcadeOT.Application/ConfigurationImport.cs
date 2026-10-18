using System.Text.Json;
using System.Text.Json.Nodes;
using ArcadeOT.Domain;
namespace ArcadeOT.Application;
public static class ConfigurationImport
{
    public static SiteConfiguration Parse(string json)
    {
        if (json.Length > 2_000_000) throw new ArgumentException("Configuration exceeds 2 MB.");
        var node = JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { MaxDepth = 32 }) as JsonObject ?? throw new ArgumentException("Configuration must be an object.");
        if (node["Version"]?.GetValue<int>() == 1)
        {
            Allow(node, ["Version", "Revision", "SiteId", "Plcs", "CloudUrl", "RetentionDays", "MaxBufferMb"]);
            if (node["Plcs"] is not JsonArray plcs) throw new ArgumentException("Legacy configuration requires a PLC list.");
            foreach (var item in plcs)
            {
                var plc = item as JsonObject ?? throw new ArgumentException("Legacy PLC entries must be objects.");
                Allow(plc, ["Id", "Model", "Firmware", "Host", "Port", "FrameMode", "Enabled", "PollMs", "TimeoutMs", "Sensors"]);
                if (plc["Sensors"] is not JsonArray sensors) throw new ArgumentException("Legacy PLC needs a sensor list.");
                foreach (var sensorNode in sensors)
                {
                    var sensor = sensorNode as JsonObject ?? throw new ArgumentException("Legacy sensor entries must be objects.");
                    Allow(sensor, ["Id", "Name", "Address", "Type", "SwapWords", "Scale", "Offset", "Unit", "Min", "Max"]);
                }
                plc["Name"] = plc["Id"]?.GetValue<string>() ?? "Imported controller";
                plc["ProfileId"] = "mitsubishi-fx5u";
                plc["Interface"] = "Built-in Ethernet";
                // Import is an edit preview. Prevent unintended network reads on apply.
                plc["Enabled"] = false;
            }
            node["Version"] = 2;
        }
        var configuration = node.Deserialize<SiteConfiguration>(JsonContract.Options);
        ConfigurationValidator.Validate(configuration);
        return configuration!;
    }
    static void Allow(JsonObject value, string[] allowed)
    {
        if (value.Any(pair => !allowed.Contains(pair.Key, StringComparer.Ordinal))) throw new ArgumentException("Legacy configuration contains unknown fields; reconcile them before importing.");
    }
}
