# =====================================================================
# DaveOffice - Installation Windows (utilisateur courant, sans admin)
#
# Installation en une commande (PowerShell) :
#   if (-not (Test-Path "$env:LOCALAPPDATA\DaveOffice\app\.git")) { git clone --depth 1 https://github.com/PetitJump/DaveOffice "$env:LOCALAPPDATA\DaveOffice\app" }; powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DaveOffice\app\install.ps1"
# =====================================================================
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/PetitJump/DaveOffice.git'
$Root    = Join-Path $env:LOCALAPPDATA 'DaveOffice'
$AppDir  = Join-Path $Root 'app'

Write-Host ''
Write-Host '=== Installation de DaveOffice ===' -ForegroundColor Cyan

# --- 1. Prerequis ---
foreach ($tool in @('git', 'node', 'npm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' est introuvable dans le PATH. Installez-le puis relancez ce script."
    }
}

# --- 2. Code source ---
if (Test-Path (Join-Path $AppDir '.git')) {
    Write-Host "Code deja present, mise a jour ($AppDir)..."
    # Copie deployee : on ecrase les modifs locales (ex. package-lock.json
    # reecrit par npm install) au lieu d'un pull qui refuserait
    git -C $AppDir fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'git fetch a echoue.' }
    git -C $AppDir reset --hard origin/main
    if ($LASTEXITCODE -ne 0) { throw 'git reset a echoue.' }
} else {
    Write-Host "Telechargement du code vers $AppDir..."
    New-Item -ItemType Directory -Force $Root | Out-Null
    git clone --depth 1 $RepoUrl $AppDir
    if ($LASTEXITCODE -ne 0) { throw 'git clone a echoue (acces au depot ?).' }
}

# --- 3. Dependances ---
Write-Host 'Installation des dependances npm (quelques minutes la premiere fois)...'
Push-Location $AppDir
npm install --no-audit --no-fund
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) { throw 'npm install a echoue.' }

$Electron = Join-Path $AppDir 'node_modules\electron\dist\electron.exe'
$Icon     = Join-Path $AppDir 'assets\icon.ico'
$Template = Join-Path $AppDir 'assets\template.docx'

# Le postinstall d'Electron (telechargement du binaire) est parfois saute :
# on le relance explicitement si dist\electron.exe manque.
if (-not (Test-Path $Electron)) {
    Write-Host 'Binaire Electron manquant, telechargement...'
    Push-Location (Join-Path $AppDir 'node_modules\electron')
    node install.js
    Pop-Location
}
if (-not (Test-Path $Electron)) { throw "electron.exe introuvable ($Electron)." }

# --- 4. Raccourcis (menu Demarrer + Bureau) ---
Write-Host 'Creation des raccourcis...'
$ws = New-Object -ComObject WScript.Shell
$shortcuts = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\DaveOffice.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'DaveOffice.lnk')
)
foreach ($lnkPath in $shortcuts) {
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath       = $Electron
    $lnk.Arguments        = '"' + $AppDir + '"'
    $lnk.WorkingDirectory = $AppDir
    $lnk.IconLocation     = $Icon
    $lnk.Description      = 'DaveOffice - Traitement de texte'
    $lnk.Save()
}

# --- 5. Registre (HKCU, aucun droit admin requis) ---
Write-Host 'Enregistrement dans le registre Windows...'
$classes = 'HKCU:\Software\Classes'
$openCmd = '"' + $Electron + '" "' + $AppDir + '" "%1"'

# ProgID DaveOffice.Document
New-Item -Force "$classes\DaveOffice.Document" | Out-Null
Set-ItemProperty "$classes\DaveOffice.Document" -Name '(Default)' -Value 'Document DaveOffice'
New-Item -Force "$classes\DaveOffice.Document\DefaultIcon" | Out-Null
Set-ItemProperty "$classes\DaveOffice.Document\DefaultIcon" -Name '(Default)' -Value $Icon
New-Item -Force "$classes\DaveOffice.Document\shell\open\command" | Out-Null
Set-ItemProperty "$classes\DaveOffice.Document\shell\open\command" -Name '(Default)' -Value $openCmd

# .docx : proposer DaveOffice dans "Ouvrir avec"
New-Item -Force "$classes\.docx\OpenWithProgids" | Out-Null
New-ItemProperty -Force -Path "$classes\.docx\OpenWithProgids" -Name 'DaveOffice.Document' -Value '' -PropertyType String | Out-Null

# Nom de type affiche (menu Nouveau, Explorateur) : HKCU prime sur HKLM,
# le libelle devient "Document DaveOffice" au lieu de celui de Word
Set-ItemProperty "$classes\.docx" -Name '(Default)' -Value 'DaveOffice.Document'

# Clic droit > Nouveau > Document DaveOffice (actif quand DaveOffice est
# l'application par defaut des .docx ; utilise le modele vierge du depot)
New-Item -Force "$classes\.docx\DaveOffice.Document\ShellNew" | Out-Null
Set-ItemProperty "$classes\.docx\DaveOffice.Document\ShellNew" -Name 'FileName' -Value $Template

# Application declaree aupres de Windows (Parametres > Applications par defaut)
New-Item -Force 'HKCU:\Software\DaveOffice\Capabilities\FileAssociations' | Out-Null
Set-ItemProperty 'HKCU:\Software\DaveOffice\Capabilities' -Name 'ApplicationName' -Value 'DaveOffice'
Set-ItemProperty 'HKCU:\Software\DaveOffice\Capabilities' -Name 'ApplicationDescription' -Value 'Traitement de texte personnel'
Set-ItemProperty 'HKCU:\Software\DaveOffice\Capabilities\FileAssociations' -Name '.docx' -Value 'DaveOffice.Document'
if (-not (Test-Path 'HKCU:\Software\RegisteredApplications')) { New-Item -Force 'HKCU:\Software\RegisteredApplications' | Out-Null }
Set-ItemProperty 'HKCU:\Software\RegisteredApplications' -Name 'DaveOffice' -Value 'Software\DaveOffice\Capabilities'

# Rafraichir l'explorateur (icones / associations / menu Nouveau)
$sig = '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'
Add-Type -MemberDefinition $sig -Namespace Win32 -Name ShellNotify
[Win32.ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host ''
Write-Host '=== Installation terminee ===' -ForegroundColor Green
Write-Host ''
Write-Host 'Lancement   : raccourci "DaveOffice" (Bureau ou menu Demarrer)'
Write-Host 'Mises a jour: onglet Aide > bouton "Mises a jour" dans l''application'
Write-Host ''
Write-Host 'Pour ouvrir les .docx avec DaveOffice par defaut :' -ForegroundColor Yellow
Write-Host '  Clic droit sur un fichier .docx > Ouvrir avec > Choisir une autre application'
Write-Host '  > DaveOffice > cocher "Toujours utiliser cette application"'
Write-Host '  (ou Parametres Windows > Applications > Applications par defaut > DaveOffice)'
Write-Host ''
Write-Host 'Le menu "Clic droit > Nouveau > Document DaveOffice" apparait une fois'
Write-Host 'DaveOffice defini comme application par defaut des .docx.'
