# DaveOffice

Traitement de texte de bureau (Windows, macOS, Linux) reprenant l'interface de Word. Usage personnel.

Stack : Electron · export `.docx` via html-to-docx · import via mammoth · correcteur orthographique français intégré (Chromium).

## Installation Windows (une commande, une seule fois)

**Prérequis** : git, node et npm. S'il vous manque l'un des trois, lancez d'abord cette commande dans PowerShell, puis **fermez et rouvrez PowerShell** :

```powershell
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements }; if (-not (Get-Command node -ErrorAction SilentlyContinue)) { winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements }
```

(npm est inclus avec Node.js.)

Ensuite, dans **PowerShell exécuté en tant qu'administrateur** (clic droit sur PowerShell → « Exécuter en tant qu'administrateur ») :

```powershell
if (-not (Test-Path "$env:LOCALAPPDATA\DaveOffice\app\.git")) { git clone --depth 1 https://github.com/PetitJump/DaveOffice "$env:LOCALAPPDATA\DaveOffice\app" }; powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DaveOffice\app\install.ps1"
```

Le script installe l'application dans `%LOCALAPPDATA%\DaveOffice\app`, crée les raccourcis Bureau / menu Démarrer, enregistre l'application dans Windows (registre utilisateur) et ajoute une **exclusion Windows Defender** sur le dossier — sans elle, chaque lancement à froid prend jusqu'à une minute de scan antivirus (d'où le PowerShell administrateur).

Ensuite, **toutes les mises à jour se font dans l'application** : onglet Aide → bouton Mises à jour (récupère la dernière version, réapplique l'installation et redémarre).

## Installation macOS

**Prérequis** : git, node et npm. Si [Homebrew](https://brew.sh) n'est pas installé, installez-le, puis installez les outils (`node` inclut `npm`) :

```bash
# Installe Homebrew s'il manque
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install git node
```

Puis, dans le **Terminal** :

```bash
curl -fsSL https://raw.githubusercontent.com/PetitJump/DaveOffice/main/install.sh | bash
```

Le script installe l'application dans `~/Library/Application Support/DaveOffice` et crée `DaveOffice.app` dans `~/Applications` (visible dans le Launchpad).

Au premier lancement, macOS peut afficher « application non vérifiée » : clic droit sur DaveOffice → **Ouvrir** → **Ouvrir**.

## Installation Linux

**Prérequis** : git, node et npm. Selon la distribution :

```bash
sudo apt install git nodejs npm        # Debian / Ubuntu
sudo dnf install git nodejs npm        # Fedora
sudo pacman -S git nodejs npm          # Arch
```

> Sur Debian/Ubuntu, le paquet `nodejs` d'apt peut être ancien. Si l'installation échoue, installez une version à jour via [NodeSource](https://github.com/nodesource/distributions) :
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs
> ```

Puis :

```bash
curl -fsSL https://raw.githubusercontent.com/PetitJump/DaveOffice/main/install.sh | bash
```

Le script installe l'application dans `~/.local/share/DaveOffice`, ajoute une entrée **DaveOffice** au menu Applications et la commande `daveoffice` au terminal. (Assurez-vous que `~/.local/bin` est dans votre `PATH`.)

Sur macOS comme sur Linux, les **mises à jour se font dans l'application** : onglet Aide → bouton Mises à jour.

## Intégration Windows

- **Ouvrir les .docx avec DaveOffice** : dans l'application, onglet **Aide → Par défaut .docx** — ouvre directement la fenêtre Windows où il suffit de choisir DaveOffice et cocher *Toujours*. (Windows interdit à une application de se définir par défaut sans confirmation de l'utilisateur ; ce bouton est le raccourci le plus direct.)
- **Clic droit → Nouveau → Document DaveOffice** : disponible une fois DaveOffice défini comme application par défaut des `.docx`.
- **Mises à jour** : dans l'application, onglet **Aide → Mises à jour** (compare la version locale aux releases GitHub du dépôt, puis met à jour et redémarre).

## Lancement manuel

```bash
# Windows
cd $env:LOCALAPPDATA\DaveOffice\app ; npm start
# macOS
cd ~/Library/Application\ Support/DaveOffice/app && npm start
# Linux
cd ~/.local/share/DaveOffice/app && npm start
```

## Désinstallation

Dans l'application : onglet **Aide → Désinstaller** (supprime l'application, les raccourcis et — sous Windows — le registre et l'exclusion antivirus ; vos documents sont conservés).

Ou en ligne de commande :

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DaveOffice\app\uninstall.ps1" -RemoveCode
```

```bash
# macOS
bash ~/Library/Application\ Support/DaveOffice/app/uninstall.sh --remove-code
# Linux
bash ~/.local/share/DaveOffice/app/uninstall.sh --remove-code
```

## Raccourcis clavier

Sous macOS, remplacez Ctrl par ⌘.

| Raccourci | Action |
|---|---|
| Ctrl+S / Ctrl+Maj+S | Enregistrer / Enregistrer sous |
| Ctrl+O / Ctrl+N | Ouvrir / Nouveau |
| Ctrl+G ou Ctrl+B | Gras |
| Ctrl+I / Ctrl+U | Italique / Souligné |
| Ctrl+F / Ctrl+H | Rechercher / Remplacer |
| Ctrl+P | Imprimer |
| Ctrl+Z / Ctrl+Y | Annuler / Rétablir |
