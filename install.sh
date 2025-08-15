#!/bin/bash

readonly APPLICATION_NAME="Zyron"
readonly APPLICATION_VERSION="1.3.1"
readonly SOURCE_USER="a-guy-lol"
readonly SOURCE_REPOSITORY="zAPP"
readonly TARGET_DIRECTORY="/Applications"

readonly STYLE_RESET='\033[0m'
readonly STYLE_BOLD='\033[1m'
readonly STYLE_DIM='\033[2m'

readonly COLOR_PRIMARY='\033[1;37m'
readonly COLOR_SUCCESS='\033[1;32m'
readonly COLOR_WARNING='\033[1;33m'
readonly COLOR_ERROR='\033[1;31m'
readonly COLOR_INFO='\033[1;36m'
readonly COLOR_MUTED='\033[2;37m'

display_banner() {
    echo -e "${COLOR_PRIMARY}${STYLE_BOLD}"
    cat << "EOF"
    ╔═════════════════════════════════════════════════════════╗
    ║                                                         ║
    ║   ███████╗  ███████╗ ██╗  ██╗   ██████╗    ███╗   ██╗   ║
    ║   ╚══███╔╝  ██╔════╝ ╚██╗██╔╝  ██╔═══██╗   ████╗  ██║   ║
    ║     ███╔╝   █████╗    ╚███╔╝   ██║   ██║   ██╔██╗ ██║   ║
    ║    ███╔╝    ██╔══╝    ██╔██╗   ██║   ██║   ██║╚██╗██║   ║
    ║   ███████╗  ███████╗ ██╔╝ ██╗  ╚██████╔╝   ██║ ╚████║   ║
    ║   ╚══════╝  ╚══════╝ ╚═╝  ╚═╝   ╚═════╝    ╚═╝  ╚═══╝   ║
    ║                                                         ║
    ║                   Zyron Script Editor                   ║
    ║            Quick Install for Intel & Apple Silicon      ║
    ║                                                         ║
    ╚═════════════════════════════════════════════════════════╝
    installer v4 - Production Ready
EOF
    echo -e "${STYLE_RESET}"
    echo
    echo -e "${COLOR_MUTED}${STYLE_DIM}         Modern • Clean • No Dependencies Required${STYLE_RESET}"
    echo
}

display_success() {
    echo -e "${COLOR_SUCCESS}  ✓ $1${STYLE_RESET}"
}

display_error() {
    echo -e "${COLOR_ERROR}  ✗ $1${STYLE_RESET}"
}

display_info() {
    echo -e "${COLOR_INFO}  → $1${STYLE_RESET}"
}

display_warning() {
    echo -e "${COLOR_WARNING}  ⚠ $1${STYLE_RESET}"
}

display_separator() {
    echo -e "${COLOR_MUTED}${STYLE_DIM}  ────────────────────────────────────────────────────────${STYLE_RESET}"
}

get_architecture() {
    if [[ "$(uname -m)" == "arm64" ]]; then
        echo "arm64"
    else
        echo "x64"
    fi
}

get_latest_release_info() {
    local api_url="https://api.github.com/repos/${SOURCE_USER}/${SOURCE_REPOSITORY}/releases/latest"
    curl -s "$api_url"
}

download_with_progress() {
    local url="$1"
    local output="$2"
    
    display_info "Downloading $(basename "$output")..."
    if command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar "$url" -o "$output"
    else
        display_error "curl is required but not installed"
        exit 1
    fi
}

cleanup_on_exit() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup_on_exit EXIT

display_banner

echo -e "${COLOR_INFO}${STYLE_BOLD}Simple Installation Process${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Downloads pre-built app directly from GitHub releases${STYLE_RESET}"
echo -e "${COLOR_MUTED}  No Xcode, Homebrew, or Node.js installation required${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Automatic architecture detection (Intel/Apple Silicon)${STYLE_RESET}"
echo
display_separator
echo

# Basic system check
if [[ "$(uname)" != "Darwin" ]]; then
    display_error "This installer is for macOS only"
    exit 1
fi
display_success "macOS detected"

ARCH=$(get_architecture)
display_success "Architecture: $ARCH"

# Get user consent
read -p "$(echo -e "${COLOR_WARNING}Continue with installation? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" user_consent < /dev/tty
if [[ ! "$user_consent" =~ ^[Yy]$ ]]; then
    display_error "Installation cancelled"
    exit 1
fi
echo

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Get latest release info
display_info "Checking for latest release..."
RELEASE_INFO=$(get_latest_release_info)

if [ -z "$RELEASE_INFO" ]; then
    display_error "Failed to fetch release information"
    display_info "Please check your internet connection and try again"
    exit 1
fi

# Parse release info to find the correct DMG
TAG_NAME=$(echo "$RELEASE_INFO" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')
display_success "Latest version: $TAG_NAME"

# Find the appropriate installer URL based on architecture
# Prefer DMG over ZIP for better Gatekeeper compatibility
if [[ "$ARCH" == "arm64" ]]; then
    INSTALLER_PATTERN="[Aa]rm64.*\.dmg|[Uu]niversal.*\.dmg"
    FALLBACK_PATTERN="[Aa]rm64.*\.zip"
else
    INSTALLER_PATTERN="[Ii]ntel.*\.dmg|[Xx]64.*\.dmg|[Uu]niversal.*\.dmg"
    FALLBACK_PATTERN="[Ii]ntel.*\.zip|[Xx]64.*\.zip"
fi

# Try DMG first
INSTALLER_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.dmg"' | grep -iE "$INSTALLER_PATTERN" | head -1 | sed 's/"browser_download_url": "\(.*\)"/\1/')

# If no DMG found, try ZIP
if [ -z "$INSTALLER_URL" ]; then
    display_info "No DMG found, trying ZIP files..."
    INSTALLER_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.zip"' | grep -iE "$FALLBACK_PATTERN" | head -1 | sed 's/"browser_download_url": "\(.*\)"/\1/')
fi

# If still nothing, try universal build
if [ -z "$INSTALLER_URL" ]; then
    display_warning "Architecture-specific build not found, trying universal build..."
    INSTALLER_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.dmg"' | head -1 | sed 's/"browser_download_url": "\(.*\)"/\1/')
    
    # If no universal DMG, try any ZIP
    if [ -z "$INSTALLER_URL" ]; then
        INSTALLER_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.zip"' | head -1 | sed 's/"browser_download_url": "\(.*\)"/\1/')
    fi
fi

if [ -z "$INSTALLER_URL" ]; then
    display_error "No compatible installer found for your system"
    exit 1
fi

INSTALLER_FILENAME=$(basename "$INSTALLER_URL")
INSTALLER_EXT="${INSTALLER_FILENAME##*.}"
display_success "Found installer: $INSTALLER_FILENAME"

# Check if app already exists
if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_warning "Existing installation found"
    read -p "$(echo -e "${COLOR_WARNING}  Replace with latest version? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" update_choice < /dev/tty
    if [[ ! "$update_choice" =~ ^[Yy]$ ]]; then
        display_info "Installation cancelled - existing version preserved"
        exit 0
    fi
    
    # Close running app if exists
    if pgrep -f "${APPLICATION_NAME}" > /dev/null; then
        display_info "Closing running application..."
        killall "${APPLICATION_NAME}" 2>/dev/null || true
        sleep 2
    fi
fi

# Download the installer
download_with_progress "$INSTALLER_URL" "$INSTALLER_FILENAME"

if [ ! -f "$INSTALLER_FILENAME" ]; then
    display_error "Download failed"
    exit 1
fi
display_success "Download completed"

# Handle different installer types
if [[ "$INSTALLER_EXT" == "dmg" ]]; then
    # Mount the DMG
    display_info "Mounting installer..."
    VOLUME_MOUNT=$(hdiutil attach -nobrowse -noautoopen "$INSTALLER_FILENAME" 2>/dev/null | grep '/Volumes/' | sed 's|.*/Volumes/|/Volumes/|')

    if [ -z "$VOLUME_MOUNT" ]; then
        display_error "Failed to mount installer"
        exit 1
    fi

    # Find the app in the mounted volume
    APP_PATH=$(find "$VOLUME_MOUNT" -name "*.app" -type d | head -1)

    if [ -z "$APP_PATH" ]; then
        display_error "Application not found in installer"
        hdiutil detach "$VOLUME_MOUNT" -force >/dev/null 2>&1
        exit 1
    fi
    
    # Copy the app
    display_info "Installing application..."
    if cp -R "$APP_PATH" "${TARGET_DIRECTORY}/" 2>/dev/null; then
        display_success "Application installed successfully"
    else
        # Fallback to sudo if needed
        display_warning "Administrator privileges required for installation"
        if sudo cp -R "$APP_PATH" "${TARGET_DIRECTORY}/"; then
            display_success "Application installed successfully"
        else
            display_error "Installation failed"
            hdiutil detach "$VOLUME_MOUNT" -force >/dev/null 2>&1
            exit 1
        fi
    fi

    # Unmount the DMG
    hdiutil detach "$VOLUME_MOUNT" -force >/dev/null 2>&1

elif [[ "$INSTALLER_EXT" == "zip" ]]; then
    # Extract the ZIP file
    display_info "Extracting installer..."
    unzip -q "$INSTALLER_FILENAME"
    
    # Find the app in the extracted files
    APP_PATH=$(find . -name "*.app" -type d | head -1)
    
    if [ -z "$APP_PATH" ]; then
        display_error "Application not found in installer"
        exit 1
    fi
    
    # Copy the app
    display_info "Installing application..."
    if cp -R "$APP_PATH" "${TARGET_DIRECTORY}/" 2>/dev/null; then
        display_success "Application installed successfully"
    else
        # Fallback to sudo if needed
        display_warning "Administrator privileges required for installation"
        if sudo cp -R "$APP_PATH" "${TARGET_DIRECTORY}/"; then
            display_success "Application installed successfully"
        else
            display_error "Installation failed"
            exit 1
        fi
    fi
else
    display_error "Unsupported installer format: $INSTALLER_EXT"
    exit 1
fi

# Remove quarantine attribute to avoid "unidentified developer" warnings
display_info "Configuring application permissions..."
if xattr -r -d com.apple.quarantine "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" 2>/dev/null; then
    display_success "Application permissions configured"
else
    display_warning "Could not remove quarantine flag - you may see a security warning on first launch"
fi

echo
echo -e "${COLOR_SUCCESS}${STYLE_BOLD}✓ Installation Successfully Completed${STYLE_RESET}"
display_info "Launching ${APPLICATION_NAME}..."

# Launch the app
if open -a "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" 2>/dev/null; then
    display_success "Application launched"
else
    display_warning "Could not auto-launch - you can find ${APPLICATION_NAME} in your Applications folder"
fi

echo
display_separator
echo -e "${COLOR_PRIMARY}${STYLE_BOLD}    Ready for Use!${STYLE_RESET}"
echo -e "${COLOR_MUTED}  The application has been installed to /Applications/${APPLICATION_NAME}.app${STYLE_RESET}"
echo
