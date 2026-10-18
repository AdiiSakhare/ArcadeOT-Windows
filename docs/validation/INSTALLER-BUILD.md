# Single Windows EXE — version 0.3.0

The workspace now produces `artifacts/ArcadeOT-windows-x64.exe`, a native Windows x64 setup program with the verified application/runtime payload embedded. It is built entirely on this Mac; no remote repository or Windows build machine was set up. The EXE is Windows software and cannot run directly on macOS.

## What the installer contains

A native setup window, administrator manifest, code-generated brand icon, application ZIP resource and extraction script resource. The ZIP contains the WPF desktop, independent collector Windows Service, self-contained .NET 10.0.13 runtime, installation/uninstall scripts, instructions, examples, notices and verification reports. Debug symbols remain a separate developer artifact.

The installer checks the embedded ZIP SHA-256, creates a new unpredictable ProgramData staging directory with an administrator/SYSTEM-only protected DACL, validates archive paths and extraction bounds, and checks every extracted file against its manifest before installation. It calls Windows' system PowerShell by its system-directory path. No separate .NET runtime is required for the native bootstrapper.

Installation preserves the ArcadeOT2 data identity, snapshots existing data with the service stopped, swaps binaries, provisions automatic startup/recovery, validates the authenticated loopback service and registers Start menu/desktop/Installed Apps entries. Reinstalling the same version serves as binary repair. Failed upgrades attempt binary rollback; protected data snapshots are retained for explicit recovery. The service remains independent of the desktop. Physical I/O and PLC parameters are configured by the operator in the application, not assumed by setup.

## Evidence executed on macOS

- Managed solution build and existing core/integration checks pass for version 0.3.0, with zero compiler warnings/errors.
- Fresh transitive NuGet audit reported no known vulnerabilities.
- Four PowerShell scripts parsed; 12 malicious ZIP fixtures were rejected by the actual extraction validator (traversal, absolute/ADS paths, case collisions, reserved Windows names, ambiguous components and symlink).
- Native C bootstrapper compiled with warnings treated as errors using LLVM-MinGW release 20260616 / LLVM 22.1.8. The compiler archive matched the SHA-256 digest published in the official GitHub release metadata.
- Independent PE inspection checks AMD64, Windows GUI subsystem, administrator manifest, ASLR/DEP/high-entropy flags, expected Windows system-DLL imports and byte-exact embedded script/ZIP resources.
- Embedded ZIP integrity, file manifests and source/build input alignment are checked. Exact final EXE size/SHA-256 are in artifacts/installer-verification.json and the companion .sha256 file.

These are compilation, static/structural and portable fixture checks. They are not proof of Windows installation/UI, service registration/ACL behavior, boot, upgrade/rollback, real HTTPS cloud deployment or physical PLC interoperability. No signing identity was supplied, so the EXE is unsigned; checksum integrity is not publisher authentication.

## Rebuild on this Mac

Use the installed .NET 10.0.402 SDK and a Python runtime supporting safe tar extraction (the bundled Python was used for compiler/PowerShell extraction).

```sh
python3 scripts/verify_build.py --dotnet /path/to/dotnet
python3 scripts/publish_windows.py --dotnet /path/to/dotnet
python3 scripts/build_installer.py
```

One-time local build dependencies are fetched from pinned official releases by scripts/fetch_installer_toolchain.py and scripts/fetch_powershell.py. Developer tooling stays under artifacts/ and is not installed globally. The configured Windows CI workflow is source only; it has not run because there is no connected repository/runner.

The native installer accepts `/quiet` for installation without its setup window and `/verify-only` for its embedded-payload check. Windows still enforces the executable's elevation manifest. These switches were compiled and inspected, not executed on Windows here.

## Plan reconciliation

The original immediate packaging recommendation was WiX MSI + Burn. After the user confirmed there is no Windows infrastructure and asked to try building without it, packaging was adapted to the native bootstrapper. This keeps the planned one-download install and independent UI/service behavior. A WiX/MSI build, signing, production hardening and exact-hardware acceptance remain distinct from this completed EXE compilation milestone.

Official build sources: [LLVM-MinGW release](https://github.com/mstorsjo/llvm-mingw/releases/tag/20260616), [Windows directory security](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createdirectoryw), [Windows CNG hashing](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcrypthashdata). These document the tools/APIs, not a successful execution of this installer.
