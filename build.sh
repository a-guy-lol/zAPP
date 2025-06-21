#!/bin/bash

readonly APPLICATION_NAME="Zexon"
readonly APPLICATION_VERSION="1.0.0"
readonly SOURCE_USER="a-guy-lol"
readonly SOURCE_REPOSITORY="zAPP"
readonly TARGET_DIRECTORY="/Applications"

readonly STYLE_RESET='\033[0m'
readonly STYLE_BOLD='\033[1m'
readonly STYLE_DIM='\033[2m'
readonly STYLE_UNDERLINE='\033[4m'

readonly COLOR_PRIMARY='\033[1;37m'
readonly COLOR_SUCCESS='\033[1;37m'
readonly COLOR_WARNING='\033[1;37m'
readonly COLOR_ERROR='\033[1;37m'
readonly COLOR_INFO='\033[1;37m'
readonly COLOR_ACCENT='\033[1;37m'
readonly COLOR_TEXT='\033[0;37m'
readonly COLOR_MUTED='\033[2;37m'

setup_environment() {
    if [[ "$(uname -m)" == "arm64" ]]; then # Apple Silicon
        export PATH="/opt/homebrew/bin:$PATH"
    else # Intel
        export PATH="/usr/local/bin:$PATH"
    fi
}

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
    ║                   Zexon Script Editor                   ║
    ║            Designed on intel/arm for Hydrogen           ║
    ║                                                         ║
    ╚═════════════════════════════════════════════════════════╝
    installer v3
EOF
    echo -e "${STYLE_RESET}"
    echo
    echo -e "${COLOR_MUTED}${STYLE_DIM}         Modern • Clean • Efficient${STYLE_RESET}"
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

setup_environment

display_banner

echo -e "${COLOR_TEXT}${STYLE_BOLD}Application Overview${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Clean and modern desktop application for Intel/ARM64 architectures${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Connects to Zexon's API services for enhanced functionality${STYLE_RESET}"
echo -e "${COLOR_MUTED}  Auto-downloads, builds, and installs to Applications folder${STYLE_RESET}"
echo
display_separator
echo

display_info ""
display_warning "You will still need to enter your password for 'sudo' commands."
echo

read -p "$(echo -e "${COLOR_ACCENT}Continue with installation? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" user_consent < /dev/tty
if [[ ! "$user_consent" =~ ^[Yy]$ ]]; then
    display_error "Installation aborted by user"
    exit 1
fi

echo
display_separator
echo

display_section_header "System Requirements Check"

if [[ "$(uname)" != "Darwin" ]]; then
    display_error "macOS required for this installation"
    exit 1
fi
display_success "macOS detected"

if ! xcode-select -p &>/dev/null; then
    display_warning "Xcode Command Line Tools are required."
    read -p "$(echo -e "${COLOR_ACCENT}  Install Xcode Command Line Tools now? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" xcode_install < /dev/tty
    if [[ "$xcode_install" =~ ^[Yy]$ ]]; then
        display_info "Starting Xcode Command Line Tools installation..."
        display_warning "A system dialog will appear. Please click 'Install' and wait for it to complete."
        xcode-select --install
        read -p "$(echo -e "${COLOR_ACCENT}After the installation is finished, press [Enter] in this terminal to continue.${STYLE_RESET}")"
        if ! xcode-select -p &>/dev/null; then
            display_error "Xcode Tools installation could not be verified. Please install them manually and re-run the script."
            exit 1
        fi
    else
        display_error "Installation cancelled - Xcode Command Line Tools are required."
        exit 1
    fi
fi
display_success "Xcode Command Line Tools detected"

if ! command -v brew &> /dev/null; then
    display_warning "Homebrew package manager not found."
    read -p "$(echo -e "${COLOR_ACCENT}  Install Homebrew automatically? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" homebrew_install < /dev/tty
    if [[ "$homebrew_install" =~ ^[Yy]$ ]]; then
        display_info "Installing Homebrew package manager..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/tty
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

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    display_info "Installing Node.js runtime environment..."
    brew install node > /dev/null 2>&1
    if ! command -v node &> /dev/null; then
        display_error "Node.js installation failed"
        exit 1
    fi
fi
display_success "Node.js runtime environment"

if ! command -v git &> /dev/null; then
    display_info "Installing Git version control system..."
    brew install git > /dev/null 2>&1
    if ! command -v git &> /dev/null; then
        display_error "Git installation failed"
        exit 1
    fi
fi
display_success "Git version control system"

echo
display_section_header "Project Configuration"

if [ ! -d "$SOURCE_REPOSITORY" ]; then
    display_info "Downloading source code from repository..."
    git clone "https://github.com/${SOURCE_USER}/${SOURCE_REPOSITORY}.git" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        display_error "Repository download failed"
        exit 1
    fi
    cd "$SOURCE_REPOSITORY"
else
    display_info "Updating existing source code..."
    cd "$SOURCE_REPOSITORY"
    git pull > /dev/null 2>&1
fi

display_info "Installing project dependencies..."
npm install > /dev/null 2>&1
if [ $? -ne 0 ]; then
    display_error "Dependency installation failed"
    exit 1
fi

echo
display_section_header "Application Build Process"
display_info "Building the application..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    display_error "Application build failed"
    exit 1
fi
display_success "Application built successfully"

echo
display_section_header "System Installation"

if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_warning "Existing build detected"
    read -p "$(echo -e "${COLOR_ACCENT}  Reinstall/Update latest build? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" update_choice < /dev/tty
    if [[ ! "$update_choice" =~ ^[Yy]$ ]]; then
        display_error "Installation cancelled - existing version preserved"
        cd ..
        rm -rf "$SOURCE_REPOSITORY"
        exit 0
    fi
fi

INSTALLER_PACKAGE=$(find dist -name "*.dmg" -print -quit)

if [ -z "$INSTALLER_PACKAGE" ]; then
    display_error "Installation package not found in build output"
    exit 1
fi
display_success "Installation package located"

display_warning "Administrative privileges required for system installation"
if ! sudo -v; then
    display_error "Administrative access denied (sudo password required)"
    exit 1
fi

if pgrep -f "${APPLICATION_NAME}" > /dev/null; then
    display_info "Terminating running application instances..."
    sudo killall "${APPLICATION_NAME}" 2>/dev/null
    sleep 2
fi

if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_info "Removing previous installation..."
    sudo rm -rf "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" > /dev/null 2>&1
fi

display_info "Installing application to system directory..."
VOLUME_MOUNT=$(hdiutil attach -nobrowse -noautoopen "$INSTALLER_PACKAGE" 2>/dev/null | grep /Volumes/ | sed 's/.*\/Volumes\//\/Volumes\//')
if [ -z "$VOLUME_MOUNT" ]; then
    display_error "Failed to mount installation package"
    exit 1
fi

sudo ditto -rsrc "${VOLUME_MOUNT}/${APPLICATION_NAME}.app" "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    display_error "Application installation failed"
    hdiutil detach "$VOLUME_MOUNT" -force >/dev/null 2>&1
    exit 1
fi

hdiutil detach "$VOLUME_MOUNT" -force >/dev/null 2>&1
display_success "Application installed successfully"

display_info "Cleaning up temporary files..."
cd ..
rm -rf "$SOURCE_REPOSITORY" > /dev/null 2>&1
display_success "Cleanup complete"

echo
echo -e "${COLOR_SUCCESS}${STYLE_BOLD}✓ Installation Successfully Completed${STYLE_RESET}"
display_info "Launching ${APPLICATION_NAME} application"
open -a "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app"

echo
display_separator
echo -e "${COLOR_PRIMARY}${STYLE_BOLD}    Ready for Use!${STYLE_RESET}"
