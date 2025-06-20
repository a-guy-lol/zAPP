#!/bin/bash

APP_NAME="Zexon"
APP_VERSION="1.0.0"
GITHUB_USER="a-guy-lol"
GITHUB_REPO="zAPP"
INSTALL_DIR="/Applications"

BOLD='\033[1m'
DIM='\033[2m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
DARK_GRAY='\033[1;30m'
RED='\033[1;31m'
GREEN='\033[1;32m'
BLUE='\033[1;34m'
CYAN='\033[1;36m'
NC='\033[0m'

clear

echo -e "${WHITE}"
echo "                    _____                       _____ "
echo "                   ( ___ )---------------------( ___ )"
echo "                    |   |                       |   | "
echo "                    |   | __  ___      __       |   | "
echo "                    |   |  / |__  \_/ /  \ |\ | |   | "
echo "                    |   | /_ |___ / \ \__/ | \| |   | "
echo "                    |___|                       |___| "
echo "                   (_____)---------------------(_____)${NC}"
echo
echo -e "                        ${BOLD}${WHITE}ZexonUI Packager${NC}"
echo
echo -e "${DIM}                     ────────────────────────────${NC}"
echo
echo -e "${BOLD}${WHITE}About this app before we continue.${NC}"
echo -e "  ${GRAY}A clean and modern desktop app for intel/arm64.${NC}"
echo -e "  ${GRAY}This app connects to Zexon's API to provide you are services.${NC}"
echo -e "  ${GRAY}This installer will download, build, and install Zexon${NC}"
echo -e "  ${GRAY}directly to your Applications folder.${NC}"
echo
echo -e "${DIM}By continuing, you agree to download and install this software with the following features?${NC}"
echo
read -p "Continue with installation? (y/n): " agree
if [[ "$agree" != [yY] ]]; then
    echo -e "${RED}Installation cancelled${NC}"
    exit 1
fi
echo
echo -e "${DIM}                     ────────────────────────────${NC}"
echo

echo -e "${BOLD}${WHITE}▸ System Check${NC}"

if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "  ${RED}✗ macOS required${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ macOS${NC}"

if ! command -v brew &> /dev/null; then
    echo -e "  ${CYAN}? Homebrew missing${NC}"
    read -p "  Install Homebrew? (y/n): " confirm
    if [[ "$confirm" == [yY] ]]; then
        echo -e "  ${BLUE}↻ Installing Homebrew${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        if [ $? -ne 0 ]; then
            echo -e "  ${RED}✗ Homebrew failed${NC}"
            exit 1
        fi
    else
        echo -e "  ${RED}✗ Installation cancelled${NC}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✓ Homebrew${NC}"

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "  ${BLUE}↻ Installing Node.js${NC}"
    brew install node
    if ! command -v node &> /dev/null; then
        echo -e "  ${RED}✗ Node.js failed${NC}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✓ Node.js${NC}"

if ! command -v git &> /dev/null; then
    echo -e "  ${RED}✗ Git missing${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Git${NC}"

echo
echo -e "${BOLD}${WHITE}▸ Project Setup${NC}"

if [ ! -d "$GITHUB_REPO" ]; then
    echo -e "  ${BLUE}↻ Downloading${NC}"
    git clone "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✗ Download failed${NC}"
        exit 1
    fi
    cd "$GITHUB_REPO"
else
    echo -e "  ${BLUE}↻ Updating${NC}"
    cd "$GITHUB_REPO"
    git pull
fi

echo -e "  ${BLUE}↻ Installing dependencies${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "  ${RED}✗ Dependencies failed${NC}"
    exit 1
fi

echo
echo -e "${BOLD}${WHITE}▸ Building${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "  ${RED}✗ Build failed${NC}"
    exit 1
fi

echo
echo -e "${BOLD}${WHITE}▸ Installation${NC}"

DMG_PATH=$(find dist -name "*.dmg" -print -quit)

if [ -z "$DMG_PATH" ]; then
    echo -e "  ${RED}✗ No installer found${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Found installer${NC}"

echo -e "  ${CYAN}? Admin access required${NC}"
if ! sudo -v; then
    echo -e "  ${RED}✗ Admin access denied${NC}"
    exit 1
fi

if pgrep -f "${APP_NAME}" > /dev/null; then
    echo -e "  ${BLUE}↻ Closing running app${NC}"
    sudo killall "${APP_NAME}" 2>/dev/null
    sleep 2
fi

if [ -d "${INSTALL_DIR}/${APP_NAME}.app" ]; then
    echo -e "  ${BLUE}↻ Removing old version${NC}"
    sudo rm -rf "${INSTALL_DIR}/${APP_NAME}.app"
fi

echo -e "  ${BLUE}↻ Installing to Applications${NC}"
MOUNT_POINT=$(hdiutil attach -nobrowse -noautoopen "$DMG_PATH" | grep /Volumes/ | sed 's/.*\/Volumes\//\/Volumes\//')
if [ -z "$MOUNT_POINT" ]; then
    echo -e "  ${RED}✗ Failed to mount installer${NC}"
    exit 1
fi

sudo ditto -rsrc "${MOUNT_POINT}/${APP_NAME}.app" "${INSTALL_DIR}/${APP_NAME}.app"
if [ $? -ne 0 ]; then
    echo -e "  ${RED}✗ Installation failed${NC}"
    hdiutil detach "$MOUNT_POINT" -force >/dev/null
    exit 1
fi

hdiutil detach "$MOUNT_POINT" -force >/dev/null

echo
echo -e "${BOLD}${GREEN}✓ Installation Complete${NC}"
echo -e "  ${BLUE}↻ Launching Zexon${NC}"
open -a "${INSTALL_DIR}/${APP_NAME}.app"

echo
echo -e "${DIM}                     ────────────────────────────${NC}"
echo -e "                         ${BOLD}${WHITE}Ready to use!${NC}"
echo
