# build.sh v2
#!/bin/bash

APP_NAME="Zexon"
APP_VERSION="1.0.0"
GITHUB_USER="a-guy-lol"
GITHUB_REPO="zAPP"
INSTALL_DIR="/Applications"

RED='\033[0;31m'
GREEN='\033[0;32m'
PINK='\033[0;35m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${PINK}"
cat << "EOF"
 _____                       _____ 
( ___ )---------------------( ___ )
 |   |                       |   | 
 |   | __  ___      __       |   | 
 |   |  / |__  \_/ /  \ |\ | |   | 
 |   | /_ |___ / \ \__/ | \| |   | 
 |___|                       |___| 
(_____)---------------------(_____)
EOF
echo -e "              Installer & Builder${NC}"
echo

echo -e "${YELLOW}Starting system checks...${NC}"

if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}Platform issue detected. This script is for macOS only. Cannot install.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ macOS detected.${NC}"

if ! command -v brew &> /dev/null; then
    read -p "Homebrew is not installed, which is required. Install it now? (Y/N): " confirm
    if [[ "$confirm" == [yY] || "$confirm" == [yY][eE][sS] ]]; then
        echo -e "${PINK}Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        if [ $? -ne 0 ]; then
            echo -e "${RED}Homebrew installation failed.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Installation cancelled. Homebrew is required to proceed.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Homebrew detected.${NC}"

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing with Homebrew...${NC}"
    brew install node
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js installation failed.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Node.js and npm detected.${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}Git is not installed. Please install it with 'brew install git'.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git detected.${NC}"
echo

echo -e "${YELLOW}Setting up project files...${NC}"
if [ ! -d "$GITHUB_REPO" ]; then
    echo -e "${PINK}Downloading project...${NC}"
    git clone "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Download failed. Check the GitHub username and repo name.${NC}"
        exit 1
    fi
    cd "$GITHUB_REPO"
else
    echo -e "${PINK}Project folder found. Updating...${NC}"
    cd "$GITHUB_REPO"
    git pull
fi

echo -e "${PINK}Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Dependency installation failed.${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}Building the application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Application build failed.${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}Installing Zexon...${NC}"
# Use find to locate the correct DMG file, regardless of architecture
DMG_PATH=$(find dist -name "*.dmg" -print -quit)

if [ -z "$DMG_PATH" ]; then
    echo -e "${RED}Built app file (.dmg) not found in 'dist' folder.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Found installer: ${DMG_PATH}${NC}"

echo -e "${PINK}Administrator access is required to install.${NC}"
if ! sudo -v; then
    echo -e "${RED}Failed to get administrator privileges.${NC}"
    exit 1
fi

if pgrep -f "${APP_NAME}" > /dev/null; then
    echo -e "${YELLOW}Closing the running app...${NC}"
    sudo killall "${APP_NAME}" 2>/dev/null
    sleep 2
fi

if [ -d "${INSTALL_DIR}/${APP_NAME}.app" ]; then
    echo -e "${YELLOW}Removing old version...${NC}"
    sudo rm -rf "${INSTALL_DIR}/${APP_NAME}.app"
fi

echo -e "${PINK}Copying app to Applications folder...${NC}"
MOUNT_POINT=$(hdiutil attach -nobrowse -noautoopen "$DMG_PATH" | grep /Volumes/ | sed 's/.*\/Volumes\//\/Volumes\//')
if [ -z "$MOUNT_POINT" ]; then
    echo -e "${RED}Failed to open the installer file.${NC}"
    exit 1
fi

sudo ditto -rsrc "${MOUNT_POINT}/${APP_NAME}.app" "${INSTALL_DIR}/${APP_NAME}.app"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to copy app to Applications.${NC}"
    hdiutil detach "$MOUNT_POINT" -force >/dev/null
    exit 1
fi

hdiutil detach "$MOUNT_POINT" -force >/dev/null
echo

echo -e "${GREEN}✓ Zexon was installed successfully!${NC}"
echo -e "${PINK}Launching Zexon...${NC}"
open -a "${INSTALL_DIR}/${APP_NAME}.app"

echo -e "${GREEN}Installation complete!${NC}"

