# =====================================================================
# DaveOffice - Desinstallation (utilisateur courant)
# Usage : & "$env:LOCALAPPDATA\DaveOffice\app\uninstall.ps1" [-RemoveCode]
#   -RemoveCode : supprime aussi le dossier %LOCALAPPDATA%\DaveOffice
# =====================================================================
param([switch]$RemoveCode)
$ErrorActionPreference = 'Continue'

Write-Host '=== Desinstallation de DaveOffice ===' -ForegroundColor Cyan

# Raccourcis
foreach ($lnk in @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\DaveOffice.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'DaveOffice.lnk')
)) {
    if (Test-Path $lnk) { Remove-Item -Force $lnk; Write-Host "Supprime : $lnk" }
}

# Registre
$keys = @(
    'HKCU:\Software\Classes\DaveOffice.Document',
    'HKCU:\Software\Classes\.docx\DaveOffice.Document',
    'HKCU:\Software\DaveOffice'
)
foreach ($k in $keys) {
    if (Test-Path $k) { Remove-Item -Recurse -Force $k; Write-Host "Supprime : $k" }
}
try { Remove-ItemProperty 'HKCU:\Software\Classes\.docx\OpenWithProgids' -Name 'DaveOffice.Document' -ErrorAction Stop } catch {}
$docxDefault = (Get-ItemProperty 'HKCU:\Software\Classes\.docx' -ErrorAction SilentlyContinue).'(default)'
if ($docxDefault -eq 'DaveOffice.Document') { reg delete 'HKCU\Software\Classes\.docx' /ve /f | Out-Null }
try { Remove-ItemProperty 'HKCU:\Software\RegisteredApplications' -Name 'DaveOffice' -ErrorAction Stop } catch {}

# Code
if ($RemoveCode) {
    $Root = Join-Path $env:LOCALAPPDATA 'DaveOffice'
    if (Test-Path $Root) { Remove-Item -Recurse -Force $Root; Write-Host "Supprime : $Root" }
}

$sig = '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'
Add-Type -MemberDefinition $sig -Namespace Win32 -Name ShellNotify2
[Win32.ShellNotify2]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host '=== Desinstallation terminee ===' -ForegroundColor Green
