# DaveOffice

Traitement de texte de bureau (Windows) reprenant l'interface de Word. Usage strictement personnel.

Stack : Electron · export `.docx` via html-to-docx · import via mammoth · correcteur orthographique français intégré (Chromium).

## Installation (une commande, une seule fois)

Dans **PowerShell** (nécessite git, node et npm) :

```powershell
if (-not (Test-Path "$env:LOCALAPPDATA\DaveOffice\app\.git")) { git clone --depth 1 https://github.com/PetitJump/DaveOffice "$env:LOCALAPPDATA\DaveOffice\app" }; powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DaveOffice\app\install.ps1"
```

Le script installe l'application dans `%LOCALAPPDATA%\DaveOffice\app`, crée les raccourcis Bureau / menu Démarrer, enregistre l'application dans Windows (registre utilisateur) et ajoute une **exclusion Windows Defender** sur le dossier — sans elle, chaque lancement à froid prend jusqu'à une minute de scan antivirus. Cette dernière étape ouvre une fenêtre UAC (Oui pour accepter) ; tout le reste se fait sans droit admin.

Ensuite, **toutes les mises à jour se font dans l'application** : onglet Aide → bouton Mises à jour (récupère la dernière version, réapplique l'installation et redémarre).

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
