# DaveOffice

Traitement de texte de bureau (Windows) reprenant l'interface de Word. Usage strictement personnel.

Stack : Electron · export `.docx` via html-to-docx · import via mammoth · correcteur orthographique français intégré (Chromium).

## Installation (une commande)

Dans **PowerShell** (nécessite git, node et npm) :

```powershell
if (-not (Test-Path "$env:LOCALAPPDATA\DaveOffice\app\.git")) { git clone --depth 1 https://github.com/PetitJump/DaveOffice "$env:LOCALAPPDATA\DaveOffice\app" }; powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DaveOffice\app\install.ps1"
```

Le script installe l'application dans `%LOCALAPPDATA%\DaveOffice\app`, crée les raccourcis Bureau / menu Démarrer et enregistre l'application dans Windows (registre utilisateur, aucun droit admin).

## Intégration Windows

- **Ouvrir les .docx avec DaveOffice** : clic droit sur un `.docx` → *Ouvrir avec* → *Choisir une autre application* → **DaveOffice** → cocher *Toujours*. (Ou Paramètres Windows → Applications par défaut → DaveOffice.)
- **Clic droit → Nouveau → Document DaveOffice** : disponible une fois DaveOffice défini comme application par défaut des `.docx`.
- **Mises à jour** : dans l'application, onglet **Aide → Mises à jour** (compare la version locale aux releases GitHub du dépôt, puis met à jour et redémarre).

## Lancement manuel

```powershell
cd $env:LOCALAPPDATA\DaveOffice\app
npm start
```

## Désinstallation

```powershell
& "$env:LOCALAPPDATA\DaveOffice\app\uninstall.ps1" -RemoveCode
```

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| Ctrl+S / Ctrl+Maj+S | Enregistrer / Enregistrer sous |
| Ctrl+O / Ctrl+N | Ouvrir / Nouveau |
| Ctrl+G ou Ctrl+B | Gras |
| Ctrl+I / Ctrl+U | Italique / Souligné |
| Ctrl+F / Ctrl+H | Rechercher / Remplacer |
| Ctrl+P | Imprimer |
| Ctrl+Z / Ctrl+Y | Annuler / Rétablir |
