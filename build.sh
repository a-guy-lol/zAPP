#!/bin/bash

# =============================================================================
# ZEXON DESKTOP INSTALLER
# =============================================================================
readonly APPLICATION_NAME="Zexon"
readonly APPLICATION_VERSION="1.0.0"
readonly SOURCE_USER="a-guy-lol"
readonly SOURCE_REPOSITORY="zAPP"
readonly TARGET_DIRECTORY="/Applications"

# =============================================================================
# TERMINAL STYLING
# =============================================================================
readonly STYLE_RESET='\e[0m'
readonly STYLE_BOLD='\e[1m'
readonly STYLE_DIM='\e[2m'
readonly STYLE_UNDERLINE='\e[4m'

readonly COLOR_PRIMARY='\e[38;5;39m'    # Bright blue
readonly COLOR_SUCCESS='\e[38;5;46m'    # Bright green
readonly COLOR_WARNING='\e[38;5;226m'   # Bright yellow
readonly COLOR_ERROR='\e[38;5;196m'     # Bright red
readonly COLOR_INFO='\e[38;5;147m'      # Light purple
readonly COLOR_ACCENT='\e[38;5;51m'     # Cyan
readonly COLOR_TEXT='\e[97m'            # Bright white
readonly COLOR_MUTED='\e[90m'           # Dark gray

# =============================================================================
# INTERFACE ELEMENTS
# =============================================================================
display_banner() {
    clear
    echo -e "${COLOR_PRIMARY}${STYLE_BOLD}"
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║                                                          ║"
    echo "    ║    ███████╗███████╗██╗  ██╗ ██████╗ ███╗   ██╗           ║"
    echo "    ║    ╚══███╔╝██╔════╝╚██╗██╔╝██╔═══██╗████╗  ██║           ║"
    echo "    ║      ███╔╝ █████╗   ╚███╔╝ ██║   ██║██╔██╗ ██║           ║"
    echo "    ║     ███╔╝  ██╔══╝   ██╔██╗ ██║   ██║██║╚██╗██║           ║"
    echo "    ║    ███████╗███████╗██╔╝ ██╗╚██████╔╝██║ ╚████║           ║"
    echo "    ║    ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝           ║"
    echo "    ║                                                          ║"
    echo "    ║                    Desktop Application Installer         ║"
    echo "    ║                                                          ║"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo -e "${STYLE_RESET}"
    echo
    echo -e "${COLOR_MUTED}${STYLE_DIM}                 Modern • Clean • Efficient${STYLE_RESET}"
    echo
}

display_section_header() {
    echo -e "${COLOR_ACCENT}${STYLE_BOLD}┌─ $1 ${STYLE_RESET}"
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

# =============================================================================
# MAIN INSTALLATION PROCESS
# =============================================================================

display_banner

echo -e "${COLOR_TEXT}${STYLE_BOLD}Application Overview${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Clean and modern desktop application for Intel/ARM64 architectures${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Connects to Zexon's API services for enhanced functionality${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Auto-downloads, builds, and installs to Applications folder${STYLE_RESET}"
echo
display_separator
echo

read -p "$(echo -e "${COLOR_ACCENT}Continue with installation? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" user_consent
if [[ ! "$user_consent" =~ ^[Yy]$ ]]; then
    display_error "Installation aborted by user"
    exit 1
fi

echo
display_separator
echo

display_section_header "System Requirements Check"

# macOS verification
if [[ "$(uname)" != "Darwin" ]]; then
    display_error "macOS required for this installation"
    exit 1
fi
display_success "macOS detected"

# Homebrew verification
if ! command -v brew &> /dev/null; then
    display_warning "Homebrew package manager not found"
    read -p "$(echo -e "${COLOR_ACCENT}  Install Homebrew automatically? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" homebrew_install
    if [[ "$homebrew_install" =~ ^[Yy]$ ]]; then
        display_info "Installing Homebrew package manager"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        if [ $? -ne 0 ]; then
            display_error "Homebrew installation failed"
            exit 1
        fi
    else
        display_error "Installation cancelled - Homebrew required"
        exit 1
    fi
fi
display_success "Homebrew package manager"

# Node.js verification
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    display_info "Installing Node.js runtime environment"
    brew install node
    if ! command -v node &> /dev/null; then
        display_error "Node.js installation failed"
        exit 1
    fi
fi
display_success "Node.js runtime environment"

# Git verification
if ! command -v git &> /dev/null; then
    display_error "Git version control system not found"
    exit 1
fi
display_success "Git version control system"

echo
display_section_header "Project Configuration"

# Repository management
if [ ! -d "$SOURCE_REPOSITORY" ]; then
    display_info "Downloading source code from repository"
    git clone "https://github.com/${SOURCE_USER}/${SOURCE_REPOSITORY}.git"
    if [ $? -ne 0 ]; then
        display_error "Repository download failed"
        exit 1
    fi
    cd "$SOURCE_REPOSITORY"
else
    display_info "Updating existing source code"
    cd "$SOURCE_REPOSITORY"
    git pull
fi

display_info "Installing project dependencies"
npm install
if [ $? -ne 0 ]; then
    display_error "Dependency installation failed"
    exit 1
fi

echo
display_section_header "Application Build Process"
npm run build
if [ $? -ne 0 ]; then
    display_error "Application build failed"
    exit 1
fi

echo
display_section_header "System Installation"

# Existing installation check
if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_warning "Existing installation detected"
    read -p "$(echo -e "${COLOR_ACCENT}  Update existing installation? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" update_choice
    if [[ ! "$update_choice" =~ ^[Yy]$ ]]; then
        display_error "Installation cancelled - existing version preserved"
        cd ..
        rm -rf "$SOURCE_REPOSITORY"
        exit 0
    fi
fi

# Locate installer package
INSTALLER_PACKAGE=$(find dist -name "*.dmg" -print -quit)

if [ -z "$INSTALLER_PACKAGE" ]; then
    display_error "Installation package not found in build output"
    exit 1
fi
display_success "Installation package located"

# Administrative privileges
display_warning "Administrative privileges required for system installation"
if ! sudo -v; then
    display_error "Administrative access denied"
    exit 1
fi

# Close running application
if pgrep -f "${APPLICATION_NAME}" > /dev/null; then
    display_info "Terminating running application instances"
    sudo killall "${APPLICATION_NAME}" 2>/dev/null
    sleep 2
fi

# Remove existing installation
if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_info "Removing previous installation"
    sudo rm -rf "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app"
fi

# Install new version
display_info "Installing application to system directory"
VOLUME_MOUNT=$(hdiutil attach -nobrowse -noautoopen "$INSTALLER_PACKAGE" | grep /Volumes/ | sed 's/.*\/Volumes\//\/Volumes\//')
if [ -z "$VOLUME_MOUNT" ]; then
    display_error "Failed to mount installation package"
    exit 1
fi

sudo ditto -rsrc "${VOLUME_MOUNT}/${APPLICATION_NAME}.app" "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app"
if [ $? -ne 0 ]; then
    display_error "Application installation failed"
    hdiutil detach "$VOLUME_MOUNT" -force >/dev/null
    exit 1
fi

hdiutil detach "$VOLUME_MOUNT" -force >/dev/null

echo
echo -e "${COLOR_SUCCESS}${STYLE_BOLD}✓ Installation Successfully Completed${STYLE_RESET}"
display_info "Launching ${APPLICATION_NAME} application"
open -a "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app"

echo
display_separator
echo -e "${COLOR_PRIMARY}${STYLE_BOLD}                        Ready for Use!${STYLE_RESET}"
echo
