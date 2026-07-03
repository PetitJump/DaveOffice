; Personnalisation NSIS DaveOffice
; Ajoute l'entree "Clic droit > Nouveau > Document DaveOffice" (modele vierge)
; L'association .docx elle-meme est geree par fileAssociations d'electron-builder
; (ProgID "DaveOffice.docx").

!macro customInstall
  WriteRegStr HKCU "Software\Classes\.docx\DaveOffice.docx\ShellNew" "FileName" "$INSTDIR\resources\assets\template.docx"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\.docx\DaveOffice.docx\ShellNew"
!macroend
