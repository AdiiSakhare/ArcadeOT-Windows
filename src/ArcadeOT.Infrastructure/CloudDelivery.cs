using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
namespace ArcadeOT.Infrastructure;
public sealed record DeliveryResult(int Sent, int Accepted, bool Quarantined);
public static class CloudDelivery
{
    public static async Task<DeliveryResult> SendAsync(MeasurementStore store, HttpClient http, Uri endpoint, string token, CancellationToken ct)
    {
        if (endpoint.Scheme != "https" || endpoint.UserInfo != "") throw new ArgumentException("HTTPS without embedded credentials is required.");
        var pending = store.Pending();
        if (pending.Count == 0) return new(0, 0, false);
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent("{\"schemaVersion\":1,\"measurements\":[" + string.Join(",", pending.Select(x => x.Payload)) + "]}", Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity)
        {
            store.Quarantine(pending.Select(x => x.Id), "HTTP " + (int)response.StatusCode);
            return new(pending.Count, 0, true);
        }
        response.EnsureSuccessStatusCode();
        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var bounded = new MemoryStream(); var bytes = new byte[4096]; int read;
        while ((read = await stream.ReadAsync(bytes, ct)) > 0)
        {
            if (bounded.Length + read > 65536) throw new IOException("Acknowledgment exceeds 64 KiB.");
            bounded.Write(bytes, 0, read);
        }
        using var json = JsonDocument.Parse(bounded.ToArray(), new JsonDocumentOptions { MaxDepth = 8 });
        if (!json.RootElement.TryGetProperty("acceptedEventIds", out var array) || array.ValueKind != JsonValueKind.Array || array.GetArrayLength() > 100)
            throw new IOException("Invalid acknowledgment list.");
        var accepted = new HashSet<string>(StringComparer.Ordinal);
        foreach (var value in array.EnumerateArray())
        {
            if (value.ValueKind != JsonValueKind.String || value.GetString() is not { } id || !accepted.Add(id)) throw new IOException("Invalid or repeated acknowledgment ID.");
        }
        var sent = pending.Select(x => x.Id).ToHashSet(StringComparer.Ordinal);
        if (!accepted.IsSubsetOf(sent)) throw new IOException("Acknowledgment includes unsent IDs.");
        store.Acknowledge(accepted);
        return new(pending.Count, accepted.Count, false);
    }
}
