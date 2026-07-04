#!/usr/bin/env bash
# =====================================================================
# DaveOffice - Installation macOS / Linux (utilisateur courant)
#
# Installation en une commande :
#   curl -fsSL https://raw.githubusercontent.com/PetitJump/DaveOffice/main/install.sh | bash
# =====================================================================
set -e

REPO_URL="https://github.com/PetitJump/DaveOffice.git"

case "$(uname -s)" in
  Darwin) ROOT="$HOME/Library/Application Support/DaveOffice" ;;
  *)      ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/DaveOffice" ;;
esac
APP_DIR="$ROOT/app"

echo ""
echo "=== Installation de DaveOffice ==="

# --- 1. Prerequis ---
for tool in git node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Erreur : '$tool' est introuvable. Installez-le puis relancez ce script." >&2
    exit 1
  fi
done

# --- 2. Code source ---
if [ -d "$APP_DIR/.git" ]; then
  echo "Code deja present, mise a jour ($APP_DIR)..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
else
  echo "Telechargement du code vers $APP_DIR..."
  mkdir -p "$ROOT"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

# --- 3. Dependances ---
echo "Installation des dependances npm (quelques minutes la premiere fois)..."
( cd "$APP_DIR" && npm install --no-audit --no-fund )

# Binaire Electron selon la plateforme
case "$(uname -s)" in
  Darwin) ELECTRON="$APP_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ;;
  *)      ELECTRON="$APP_DIR/node_modules/electron/dist/electron" ;;
esac
ICON="$APP_DIR/assets/icon.png"

if [ ! -e "$ELECTRON" ]; then
  echo "Binaire Electron manquant, telechargement..."
  ( cd "$APP_DIR/node_modules/electron" && node install.js )
fi

# --- 4. Lanceur ---
if [ "$(uname -s)" = "Darwin" ]; then
  # macOS : bundle .app minimal dans ~/Applications
  APP_BUNDLE="$HOME/Applications/DaveOffice.app"
  echo "Creation du lanceur ($APP_BUNDLE)..."
  mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"
  cat > "$APP_BUNDLE/Contents/MacOS/DaveOffice" <<LAUNCHER
#!/bin/bash
exec "$ELECTRON" "$APP_DIR" "\$@"
LAUNCHER
  chmod +x "$APP_BUNDLE/Contents/MacOS/DaveOffice"
  cp "$APP_DIR/assets/icon.png" "$APP_BUNDLE/Contents/Resources/icon.png" 2>/dev/null || true
  cat > "$APP_BUNDLE/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>DaveOffice</string>
  <key>CFBundleDisplayName</key><string>DaveOffice</string>
  <key>CFBundleExecutable</key><string>DaveOffice</string>
  <key>CFBundleIdentifier</key><string>com.petitjump.daveoffice</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict>
</plist>
PLIST
  echo ""
  echo "=== Installation terminee ==="
  echo "Lancement : DaveOffice dans ~/Applications (ou via Launchpad)"
else
  # Linux : entree de menu .desktop
  APPS_DIR="$HOME/.local/share/applications"
  BIN_DIR="$HOME/.local/bin"
  echo "Creation du lanceur (.desktop)..."
  mkdir -p "$APPS_DIR" "$BIN_DIR"
  cat > "$BIN_DIR/daveoffice" <<LAUNCHER
#!/bin/bash
exec "$ELECTRON" "$APP_DIR" "\$@"
LAUNCHER
  chmod +x "$BIN_DIR/daveoffice"
  cat > "$APPS_DIR/daveoffice.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=DaveOffice
Comment=Traitement de texte
Exec="$ELECTRON" "$APP_DIR" %f
Icon=$ICON
Terminal=false
Categories=Office;WordProcessor;
MimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document;
DESKTOP
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
  echo ""
  echo "=== Installation terminee ==="
  echo "Lancement : DaveOffice dans le menu Applications, ou 'daveoffice' au terminal"
fi

echo "Mises a jour : onglet Aide > bouton \"Mises a jour\" dans l'application"
echo ""
echo "Pour ouvrir un .docx avec DaveOffice : clic droit sur le fichier >"
echo "Ouvrir avec > DaveOffice."
