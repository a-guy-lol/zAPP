#!/bin/bash

# ==============================================================================
# Application and Script Configuration
# ==============================================================================
readonly APPLICATION_NAME="Zexon"
readonly APPLICATION_VERSION="1.0.0"
readonly SOURCE_USER="a-guy-lol"
readonly SOURCE_REPOSITORY="zAPP"
readonly TARGET_DIRECTORY="/Applications"

# ==============================================================================
# Style and Color Definitions
# ==============================================================================
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

# ==============================================================================
# UI Display Functions
# ==============================================================================

# Displays the main ASCII art banner for the application.
display_banner() {
    echo -e "${COLOR_PRIMARY}${STYLE_BOLD}"
    cat << "EOF"
    ╔═════════════════════════════════════════════════════════╗
    ║                                                         ║
    ║   ███████╗  ███████╗ ██╗  ██╗  ██████╗    ███╗   ██╗   ║
    ║   ╚══███╔╝  ██╔════╝ ╚██╗██╔╝ ██╔═══██╗   ████╗  ██║   ║
    ║     ███╔╝   █████╗     ╚███╔╝  ██║   ██║   ██╔██╗ ██║   ║
    ║    ███╔╝    ██╔══╝     ██╔██╗  ██║   ██║   ██║╚██╗██║   ║
    ║   ███████╗  ███████╗ ██╔╝ ██╗  ╚██████╔╝ ██║ ╚████║   ║
    ║   ╚══════╝  ╚══════╝ ╚═╝  ╚═╝   ╚═════╝  ╚═╝  ╚═══╝   ║
    ║                                                         ║
    ║             Zexon Script Editor                         ║
    ║       Designed on intel/arm for Hydrogen                ║
    ║                                                         ║
    ╚═════════════════════════════════════════════════════════╝
EOF
    echo -e "${STYLE_RESET}"
    echo
    echo -e "${COLOR_MUTED}${STYLE_DIM}         Modern • Clean • Efficient${STYLE_RESET}"
    echo
}

# Displays a formatted section header.
# $1: Header text
display_section_header() {
    echo -e "${COLOR_ACCENT}${STYLE_BOLD}┌─ $1 ${STYLE_RESET}"
}

# Displays a success message.
# $1: Message text
display_success() {
    echo -e "${COLOR_SUCCESS}  ✓ $1${STYLE_RESET}"
}

# Displays an error message.
# $1: Message text
display_error() {
    echo -e "${COLOR_ERROR}  ✗ $1${STYLE_RESET}"
}

# Displays an informational message.
# $1: Message text
display_info() {
    echo -e "${COLOR_INFO}  → $1${STYLE_RESET}"
}

# Displays a warning message.
# $1: Message text
display_warning() {
    echo -e "${COLOR_WARNING}  ⚠ $1${STYLE_RESET}"
}

# Displays a visual separator.
display_separator() {
    echo -e "${COLOR_MUTED}${STYLE_DIM}  ────────────────────────────────────────────────────────${STYLE_RESET}"
}


# ==============================================================================
# Main Script Logic
# =================================================E=============================

# --- Initial Display and User Consent ---
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

# --- Dependency and System Checks ---
display_section_header "System Requirements Check"

# Check for macOS
if [[ "$(uname)" != "Darwin" ]]; then
    display_error "macOS required for this installation"
    exit 1
fi
display_success "macOS detected"

# Check for Xcode Command Line Tools, as Homebrew needs them
if ! xcode-select -p &>/dev/null; then
    display_warning "Xcode Command Line Tools are required."
    read -p "$(echo -e "${COLOR_ACCENT}  Install Xcode Command Line Tools now? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" xcode_install < /dev/tty
    if [[ "$xcode_install" =~ ^[Yy]$ ]]; then
        display_info "Starting Xcode Command Line Tools installation..."
        display_warning "A system dialog will appear. Please click 'Install' and wait for it to complete."
        xcode-select --install
        # Pause the script until the user confirms Xcode tools are installed, as it's a GUI process
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

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    display_warning "Homebrew package manager not found"
    read -p "$(echo -e "${COLOR_ACCENT}  Install Homebrew automatically? ${COLOR_MUTED}[y/N]${STYLE_RESET} ")" homebrew_install < /dev/tty
    if [[ "$homebrew_install" =~ ^[Yy]$ ]]; then
        display_info "Installing Homebrew package manager..."
        # Run the installer interactively, allowing the user to see prompts and enter their password
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        if [ $? -ne 0 ]; then
            display_error "Homebrew installation failed"
            exit 1
        fi
        display_info "Configuring shell to use Homebrew..."
        # Add Homebrew to the current script's PATH based on architecture
        if [[ "$(uname -m)" == "arm64" ]]; then # Apple Silicon
            eval "$(/opt/homebrew/bin/brew shellenv)"
        else # Intel
            eval "$(/usr/local/bin/brew shellenv)"
        fi
        # Verify that the brew command is now available
        if ! command -v brew &> /dev/null; then
            display_error "Failed to configure Homebrew in the shell. Please re-run the script or configure your shell manually."
            exit 1
        fi
    else
        display_error "Installation cancelled - Homebrew required"
        exit 1
    fi
fi
display_success "Homebrew package manager"

# Check for Node.js and npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    display_info "Installing Node.js runtime environment..."
    brew install node > /dev/null 2>&1
    if ! command -v node &> /dev/null; then
        display_error "Node.js installation failed"
        exit 1
    fi
fi
display_success "Node.js runtime environment"

# Check for Git
if ! command -v git &> /dev/null; then
    display_warning "Git version control system not found."
    display_info "Attempting to install Git using Homebrew..."
    brew install git > /dev/null 2>&1
    if ! command -v git &> /dev/null; then
        display_error "Git installation failed"
        exit 1
    fi
fi
display_success "Git version control system"

# --- Project Download and Setup ---
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

# --- Application Build ---
echo
display_section_header "Application Build Process"
display_info "Building the application..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    display_error "Application build failed"
    exit 1
fi
display_success "Application built successfully"

# --- System Installation ---
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

# Find the built .dmg package
INSTALLER_PACKAGE=$(find dist -name "*.dmg" -print -quit)

if [ -z "$INSTALLER_PACKAGE" ]; then
    display_error "Installation package not found in build output"
    exit 1
fi
display_success "Installation package located"

# Get sudo credentials upfront
display_warning "Administrative privileges required for system installation"
if ! sudo -v; then
    display_error "Administrative access denied (sudo password required)"
    exit 1
fi

# Quit the app if it's running
if pgrep -f "${APPLICATION_NAME}" > /dev/null; then
    display_info "Terminating running application instances..."
    sudo killall "${APPLICATION_NAME}" 2>/dev/null
    sleep 2
fi

# Remove previous version if it exists
if [ -d "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" ]; then
    display_info "Removing previous installation..."
    sudo rm -rf "${TARGET_DIRECTORY}/${APPLICATION_NAME}.app" > /dev/null 2>&1
fi

# Mount DMG and install the application
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

# --- Cleanup ---
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

