$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Product Finder.lnk"
$TargetFile = Join-Path (Get-Location) "run_app.bat"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetFile
$Shortcut.WorkingDirectory = (Get-Location).Path
$Shortcut.Description = "Launch Product Finder App"
$Shortcut.IconLocation = "shell32.dll,3"
$Shortcut.Save()

Write-Host "Shortcut created at $ShortcutPath"
