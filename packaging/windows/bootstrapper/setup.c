#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0A00
#include <windows.h>
#include <winternl.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <sddl.h>
#include <bcrypt.h>
#include <strsafe.h>
#include <stdlib.h>
#include "payload.h"

#define ID_INSTALL 1001
#define ID_CLOSE 1002
#define ID_OPEN 1003
#define ID_LOG 1004
#define MSG_STATUS (WM_APP + 1)
#define MSG_DONE (WM_APP + 2)
#define PAYLOAD_RESOURCE 101
#define SCRIPT_RESOURCE 102

static HWND main_window, status_label, progress_bar, install_button, close_button, open_button, log_button;
static HFONT body_font, title_font;
static HBRUSH background_brush;
static BOOL installing = FALSE;
static WCHAR last_log[1024] = L"";
static UINT dpi = 96;

typedef struct SetupResult {
    DWORD code;
    WCHAR message[2048];
    WCHAR log_path[1024];
} SetupResult;

static int px(int value) { return MulDiv(value, (int)dpi, 96); }
static void report(LPCWSTR text) {
    if (main_window) PostMessageW(main_window, MSG_STATUS, 0, (LPARAM)text);
}
static BOOL embedded_resource(WORD id, const BYTE **data, DWORD *length) {
    HMODULE module = GetModuleHandleW(NULL);
    HRSRC resource = FindResourceW(module, MAKEINTRESOURCEW(id), RT_RCDATA);
    if (!resource) return FALSE;
    HGLOBAL memory = LoadResource(module, resource);
    if (!memory) return FALSE;
    *length = SizeofResource(module, resource);
    *data = (const BYTE *)LockResource(memory);
    return *data != NULL && *length > 0;
}
static BOOL verify_payload(const BYTE *data, DWORD length) {
    BCRYPT_ALG_HANDLE algorithm = NULL;
    BCRYPT_HASH_HANDLE hash = NULL;
    BYTE digest[32], *object = NULL;
    DWORD object_size = 0, returned = 0;
    WCHAR hex[65];
    BOOL ok = FALSE;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, NULL, 0) < 0) goto cleanup;
    if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, (PUCHAR)&object_size, sizeof(object_size), &returned, 0) < 0) goto cleanup;
    object = (BYTE *)HeapAlloc(GetProcessHeap(), 0, object_size);
    if (!object) goto cleanup;
    if (BCryptCreateHash(algorithm, &hash, object, object_size, NULL, 0, 0) < 0) goto cleanup;
    if (BCryptHashData(hash, (PUCHAR)data, length, 0) < 0) goto cleanup;
    if (BCryptFinishHash(hash, digest, sizeof(digest), 0) < 0) goto cleanup;
    for (int i = 0; i < 32; ++i) {
        if (FAILED(StringCchPrintfW(hex + i * 2, 3, L"%02x", (unsigned)digest[i]))) goto cleanup;
    }
    ok = _wcsicmp(hex, PAYLOAD_SHA256) == 0;
cleanup:
    if (hash) BCryptDestroyHash(hash);
    if (object) HeapFree(GetProcessHeap(), 0, object);
    if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
    return ok;
}
static BOOL write_new_file(LPCWSTR path, const BYTE *data, DWORD length) {
    HANDLE file = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, NULL);
    if (file == INVALID_HANDLE_VALUE) return FALSE;
    DWORD offset = 0;
    BOOL ok = TRUE;
    while (offset < length) {
        DWORD written = 0, chunk = length - offset;
        if (chunk > 4 * 1024 * 1024) chunk = 4 * 1024 * 1024;
        if (!WriteFile(file, data + offset, chunk, &written, NULL) || written == 0) { ok = FALSE; break; }
        offset += written;
    }
    if (!FlushFileBuffers(file)) ok = FALSE;
    CloseHandle(file);
    return ok;
}
static BOOL target_supported(void) {
    SYSTEM_INFO info;
    GetNativeSystemInfo(&info);
    if (info.wProcessorArchitecture != PROCESSOR_ARCHITECTURE_AMD64) return FALSE;
    typedef LONG (WINAPI *VersionFunction)(PRTL_OSVERSIONINFOW);
    VersionFunction version = (VersionFunction)(void *)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
    RTL_OSVERSIONINFOW os = {0};
    os.dwOSVersionInfoSize = sizeof(os);
    return version && version(&os) == 0 && os.dwMajorVersion >= 10 && os.dwBuildNumber >= 22000;
}
static SetupResult *install_payload(void) {
    SetupResult *result = (SetupResult *)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, sizeof(SetupResult));
    if (!result) return NULL;
    result->code = 1;
    StringCchCopyW(result->message, 2048, L"Setup could not start. No installation was completed.");
    const BYTE *payload = NULL, *script = NULL;
    DWORD payload_length = 0, script_length = 0;
    PWSTR program_data = NULL;
    PSECURITY_DESCRIPTOR security = NULL;
    HANDLE process_handle = NULL;
    WCHAR directory[1024], archive[1100], script_path[1100], powershell[1024], command[4096], suffix[80];
    BYTE nonce[16];
    report(L"Verifying the bundled application…");
    if (!embedded_resource(PAYLOAD_RESOURCE, &payload, &payload_length) || !verify_payload(payload, payload_length)) {
        StringCchCopyW(result->message, 2048, L"The bundled application failed its SHA-256 check. Obtain an intact installer."); goto cleanup;
    }
    if (!embedded_resource(SCRIPT_RESOURCE, &script, &script_length)) goto cleanup;
    if (FAILED(SHGetKnownFolderPath(&FOLDERID_ProgramData, 0, NULL, &program_data))) goto cleanup;
    ULARGE_INTEGER free_bytes;
    if (!GetDiskFreeSpaceExW(program_data, &free_bytes, NULL, NULL) || free_bytes.QuadPart < REQUIRED_STAGE_BYTES) {
        StringCchCopyW(result->message, 2048, L"Not enough free space on the ProgramData drive for protected extraction. Free at least 1.5 GiB and retry."); goto cleanup;
    }
    if (BCryptGenRandom(NULL, nonce, sizeof(nonce), BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0) goto cleanup;
    if (FAILED(StringCchPrintfW(suffix, 80, L"ArcadeOT-Setup-%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x",
        nonce[0],nonce[1],nonce[2],nonce[3],nonce[4],nonce[5],nonce[6],nonce[7],nonce[8],nonce[9],nonce[10],nonce[11],nonce[12],nonce[13],nonce[14],nonce[15]))) goto cleanup;
    if (FAILED(StringCchPrintfW(directory, 1024, L"%s\\%s", program_data, suffix))) goto cleanup;
    // New, unpredictable directory with a protected DACL: Administrators and SYSTEM only.
    // Never reuse a pre-existing path, user temp directory or service-writable folder.
    if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(L"D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)", SDDL_REVISION_1, &security, NULL)) goto cleanup;
    SECURITY_ATTRIBUTES attributes = { sizeof(attributes), security, FALSE };
    if (!CreateDirectoryW(directory, &attributes)) goto cleanup;
    if (FAILED(StringCchPrintfW(archive, 1100, L"%s\\payload.zip", directory)) ||
        FAILED(StringCchPrintfW(script_path, 1100, L"%s\\bootstrap.ps1", directory)) ||
        FAILED(StringCchPrintfW(result->log_path, 1024, L"%s\\setup.log", directory))) goto cleanup;
    report(L"Preparing the protected installation workspace…");
    if (!write_new_file(archive, payload, payload_length) || !write_new_file(script_path, script, script_length)) {
        StringCchCopyW(result->message, 2048, L"Could not write the protected setup files. Check free disk space and administrator access."); goto cleanup;
    }
    UINT system_length = GetSystemDirectoryW(powershell, 1024);
    if (system_length == 0 || system_length >= 1024 || FAILED(StringCchCatW(powershell, 1024, L"\\WindowsPowerShell\\v1.0\\powershell.exe"))) goto cleanup;
    if (FAILED(StringCchPrintfW(command, 4096, L"\"%s\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"%s\" -SetupRoot \"%s\" -ExpectedHash \"%s\"", powershell, script_path, directory, PAYLOAD_SHA256))) goto cleanup;
    report(L"Installing the desktop and independent collector service…");
    STARTUPINFOW startup = {0}; PROCESS_INFORMATION process = {0};
    startup.cb = sizeof(startup); startup.dwFlags = STARTF_USESHOWWINDOW; startup.wShowWindow = SW_HIDE;
    if (!CreateProcessW(powershell, command, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, directory, &startup, &process)) {
        StringCchCopyW(result->message, 2048, L"Windows PowerShell could not start. Setup has not completed."); goto cleanup;
    }
    CloseHandle(process.hThread); process_handle = process.hProcess;
    if (WaitForSingleObject(process_handle, INFINITE) != WAIT_OBJECT_0 || !GetExitCodeProcess(process_handle, &result->code)) { result->code = 1; goto cleanup; }
    if (result->code == 0) StringCchCopyW(result->message, 2048, L"ArcadeOT is installed. The collector starts with Windows. Open the workspace to configure your PLCs and sensors.");
    else StringCchCopyW(result->message, 2048, L"Installation did not complete. Use Open setup log for details. Configuration/history backups are retained; do not enable PLC reads until setup succeeds.");
cleanup:
    if (process_handle) CloseHandle(process_handle);
    if (security) LocalFree(security);
    if (program_data) CoTaskMemFree(program_data);
    return result;
}
static DWORD WINAPI install_worker(LPVOID ignored) {
    (void)ignored;
    SetupResult *result = install_payload();
    PostMessageW(main_window, MSG_DONE, 0, (LPARAM)result);
    return 0;
}
static void open_workspace(void) {
    PWSTR programs = NULL;
    if (SUCCEEDED(SHGetKnownFolderPath(&FOLDERID_ProgramFiles, 0, NULL, &programs))) {
        WCHAR exe[1024];
        if (SUCCEEDED(StringCchPrintfW(exe, 1024, L"%s\\ArcadeOT2\\ui\\ArcadeOT.Desktop.exe", programs)))
            ShellExecuteW(main_window, L"open", exe, NULL, NULL, SW_SHOWNORMAL);
        CoTaskMemFree(programs);
    }
}
static HWND control(LPCWSTR type, LPCWSTR text, DWORD style, int x, int y, int width, int height, int id) {
    HWND result = CreateWindowExW(0, type, text, WS_CHILD | WS_VISIBLE | style, px(x), px(y), px(width), px(height), main_window, (HMENU)(INT_PTR)id, GetModuleHandleW(NULL), NULL);
    SendMessageW(result, WM_SETFONT, (WPARAM)body_font, TRUE);
    return result;
}
static LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
    case WM_CREATE:
        main_window = window;
        body_font = CreateFontW(-px(14), 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
        title_font = CreateFontW(-px(29), 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
        HWND title = control(L"STATIC", L"ArcadeOT", SS_LEFT, 30, 26, 600, 46, 0);
        SendMessageW(title, WM_SETFONT, (WPARAM)title_font, TRUE);
        control(L"STATIC", L"Industrial workspace  |  Windows x64", SS_LEFT, 32, 79, 600, 28, 0);
        control(L"STATIC", L"One installation. Continuous collection.\n\nConfigure your controller, network, sensors and I/O references in the desktop. The Windows Service owns acquisition and keeps running when the desktop closes.", SS_LEFT, 32, 124, 594, 112, 0);
        status_label = control(L"STATIC", L"Ready to install. Hardware commissioning is performed after setup.", SS_LEFT, 32, 248, 594, 60, ID_INSTALL + 10);
        progress_bar = control(PROGRESS_CLASSW, L"", PBS_MARQUEE, 32, 308, 594, 12, 0);
        ShowWindow(progress_bar, SW_HIDE);
        install_button = control(L"BUTTON", L"Install / update", BS_DEFPUSHBUTTON | WS_TABSTOP, 32, 344, 158, 38, ID_INSTALL);
        open_button = control(L"BUTTON", L"Open workspace", BS_PUSHBUTTON | WS_TABSTOP, 32, 344, 158, 38, ID_OPEN);
        ShowWindow(open_button, SW_HIDE);
        log_button = control(L"BUTTON", L"Open setup log", BS_PUSHBUTTON | WS_TABSTOP, 204, 344, 156, 38, ID_LOG);
        ShowWindow(log_button, SW_HIDE);
        close_button = control(L"BUTTON", L"Close", BS_PUSHBUTTON | WS_TABSTOP, 518, 344, 108, 38, ID_CLOSE);
        return 0;
    case WM_CTLCOLORSTATIC:
        SetTextColor((HDC)wparam, RGB(26, 46, 63)); SetBkColor((HDC)wparam, RGB(247, 250, 252)); return (LRESULT)background_brush;
    case WM_COMMAND:
        if (LOWORD(wparam) == ID_INSTALL && !installing) {
            installing = TRUE; EnableWindow(install_button, FALSE); EnableWindow(close_button, FALSE);
            ShowWindow(progress_bar, SW_SHOW); SendMessageW(progress_bar, PBM_SETMARQUEE, TRUE, 30);
            HANDLE worker = CreateThread(NULL, 0, install_worker, NULL, 0, NULL);
            if (worker) CloseHandle(worker);
            else { installing = FALSE; EnableWindow(install_button, TRUE); EnableWindow(close_button, TRUE); SetWindowTextW(status_label, L"Could not start setup. Close and retry."); }
        } else if (LOWORD(wparam) == ID_CLOSE && !installing) DestroyWindow(window);
        else if (LOWORD(wparam) == ID_OPEN && !installing) open_workspace();
        else if (LOWORD(wparam) == ID_LOG && last_log[0]) {
            WCHAR notepad[1024], arguments[1100];
            UINT length = GetSystemDirectoryW(notepad, 1024);
            if (length > 0 && length < 1024 && SUCCEEDED(StringCchCatW(notepad, 1024, L"\\notepad.exe")) && SUCCEEDED(StringCchPrintfW(arguments, 1100, L"\"%s\"", last_log)))
                ShellExecuteW(window, L"open", notepad, arguments, NULL, SW_SHOWNORMAL);
        }
        return 0;
    case MSG_STATUS:
        SetWindowTextW(status_label, (LPCWSTR)lparam); return 0;
    case MSG_DONE: {
        installing = FALSE; EnableWindow(close_button, TRUE); SendMessageW(progress_bar, PBM_SETMARQUEE, FALSE, 0); ShowWindow(progress_bar, SW_HIDE);
        SetupResult *result = (SetupResult *)lparam;
        SetWindowTextW(status_label, result ? result->message : L"Setup could not allocate resources. Close and retry.");
        if (result) {
            if (result->code == 0) { ShowWindow(install_button, SW_HIDE); ShowWindow(open_button, SW_SHOW); }
            if (result->log_path[0] && GetFileAttributesW(result->log_path) != INVALID_FILE_ATTRIBUTES) { StringCchCopyW(last_log, 1024, result->log_path); ShowWindow(log_button, SW_SHOW); }
            HeapFree(GetProcessHeap(), 0, result);
        }
        return 0;
    }
    case WM_CLOSE:
        if (!installing) DestroyWindow(window);
        else MessageBoxW(window, L"Installation is running. Wait for it to finish before closing setup.", L"ArcadeOT setup", MB_OK | MB_ICONINFORMATION);
        return 0;
    case WM_DESTROY:
        if (body_font) DeleteObject(body_font); if (title_font) DeleteObject(title_font); PostQuitMessage(0); return 0;
    default: return DefWindowProcW(window, message, wparam, lparam);
    }
}
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR command_line, int show) {
    (void)previous; (void)command_line;
    SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);
    int argc = 0; LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    BOOL quiet = FALSE, verify_only = FALSE;
    for (int i = 1; argv && i < argc; ++i) {
        if (_wcsicmp(argv[i], L"/quiet") == 0) quiet = TRUE;
        else if (_wcsicmp(argv[i], L"/verify-only") == 0) verify_only = TRUE;
        else { LocalFree(argv); return 87; }
    }
    if (argv) LocalFree(argv);
    if (verify_only) {
        const BYTE *data = NULL; DWORD length = 0;
        return embedded_resource(PAYLOAD_RESOURCE, &data, &length) && verify_payload(data, length) ? 0 : 13;
    }
    if (!target_supported()) {
        if (!quiet) MessageBoxW(NULL, L"This build targets Windows 11 on Intel/AMD x64. It cannot run on macOS, Windows x86 or ARM64.", L"ArcadeOT setup", MB_OK | MB_ICONERROR);
        return 1633;
    }
    if (!IsUserAnAdmin()) {
        if (!quiet) MessageBoxW(NULL, L"Administrator elevation is required to install the Windows Service.", L"ArcadeOT setup", MB_OK | MB_ICONERROR);
        return 740;
    }
    if (quiet) {
        SetupResult *result = install_payload(); DWORD code = result ? result->code : 8;
        if (result) HeapFree(GetProcessHeap(), 0, result);
        return (int)code;
    }
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); dpi = GetDpiForSystem();
    INITCOMMONCONTROLSEX controls = { sizeof(controls), ICC_PROGRESS_CLASS }; InitCommonControlsEx(&controls);
    background_brush = CreateSolidBrush(RGB(247, 250, 252));
    WNDCLASSEXW klass = {0}; klass.cbSize = sizeof(klass); klass.lpfnWndProc = window_proc; klass.hInstance = instance;
    klass.hCursor = LoadCursorW(NULL, IDC_ARROW); klass.hbrBackground = background_brush; klass.lpszClassName = L"ArcadeOTSetup";
    klass.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(1)); klass.hIconSm = klass.hIcon;
    if (!RegisterClassExW(&klass)) return 1;
    RECT rectangle = {0, 0, px(660), px(410)};
    DWORD style = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX;
    AdjustWindowRectExForDpi(&rectangle, style, FALSE, 0, dpi);
    HWND window = CreateWindowExW(0, klass.lpszClassName, L"ArcadeOT setup", style, CW_USEDEFAULT, CW_USEDEFAULT, rectangle.right - rectangle.left, rectangle.bottom - rectangle.top, NULL, NULL, instance, NULL);
    if (!window) return 1;
    ShowWindow(window, show); UpdateWindow(window);
    MSG message;
    while (GetMessageW(&message, NULL, 0, 0) > 0) { if (!IsDialogMessageW(window, &message)) { TranslateMessage(&message); DispatchMessageW(&message); } }
    DeleteObject(background_brush);
    return (int)message.wParam;
}
