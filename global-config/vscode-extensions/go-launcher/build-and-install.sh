#!/usr/bin/env bash
# Build the Go Launcher extension into a .vsix and install it into VS Code.
# Run after editing extension.js / package.json. Bump the version in package.json first
# so VS Code treats it as an update.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
VER="$(grep -o '"version": "[^"]*"' "$SRC/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')"
BUILD="$(mktemp -d)"; mkdir -p "$BUILD/extension"
cp "$SRC/package.json" "$SRC/extension.js" "$BUILD/extension/"
cat > "$BUILD/[Content_Types].xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>
XML
cat > "$BUILD/extension.vsixmanifest" <<XML
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="go-launcher" Version="$VER" Publisher="jackkief"/><DisplayName>Go Launcher</DisplayName><Description>Watches ~/.claude/go-queue and opens a Claude Code terminal per /go request.</Description></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>
XML
VSIX="$HOME/.claude/go-launcher-$VER.vsix"; rm -f "$VSIX"
( cd "$BUILD" && zip -r -X "$VSIX" "[Content_Types].xml" extension.vsixmanifest extension/ >/dev/null )
rm -rf "$BUILD"
CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
"$CODE" --install-extension "$VSIX" --force
echo "Installed go-launcher $VER. Reload VS Code (Developer: Reload Window) to activate."
