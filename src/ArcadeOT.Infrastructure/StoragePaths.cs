namespace ArcadeOT.Infrastructure;
public static class StoragePaths
{
    // Separate data and service identity keep the archived v1 installation recoverable.
    public static string DataDirectory => Environment.GetEnvironmentVariable("ARCADEOT_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ArcadeOT2");
    public static string ApiToken => Path.Combine(DataDirectory, "api-token.txt");
    public static string CloudToken => Path.Combine(DataDirectory, "cloud-token.txt");
}
