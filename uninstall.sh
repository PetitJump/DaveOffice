#!/usr/bin/env bash
# =====================================================================
# DaveOffice - Desinstallation macOS / Linux (utilisateur courant)
# Usage : bash uninstall.sh [--remove-code]
#   --remove-code : supprime aussi le dossier de l'application
# =====================================================================
REMOVE_CODE=0
[ "$1" = "--remove-code" ] && REMOVE_CODE=1

case "$(uname -s)" in
  Darwin) ROOT="$HOME/Library/Application Support/DaveOffice" ;;
  *)      ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/DaveOffice" ;;
esac

echo "=== Desinstallation de DaveOffice ==="

# Lanceurs
rm -f  "$HOME/.local/share/applications/daveoffice.desktop" && echo "Supprime : entree de menu"
rm -f  "$HOME/.local/bin/daveoffice"
rm -rf "$HOME/Applications/DaveOffice.app" 2>/dev/null && echo "Supprime : DaveOffice.app"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# Code
if [ "$REMOVE_CODE" = "1" ] && [ -d "$ROOT" ]; then
  rm -rf "$ROOT"
  echo "Supprime : $ROOT"
fi

echo "=== Desinstallation terminee ==="
echo "Vos documents (.docx) ne sont pas supprimes."
