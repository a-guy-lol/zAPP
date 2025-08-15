# Zyron Script Editor - Application Context

**⚠️ Important Note for AI**: When making changes to this application, you MUST update this context.md file to reflect the latest build state, file structure, and functionality.

## UI Development Rules

**🎨 UI Design Standards:**
- **NO EMOJIS** unless specifically requested by the user
- **UI Consistency**: All new UI elements must match the existing app's color scheme and design style
- **Style Matching**: New components should seamlessly integrate with the current dark theme and visual aesthetic
- **User Experience**: Maintain consistency in spacing, typography, and interaction patterns

## Application Overview

**Zyron** (formerly ZexonUI) is an Electron-based script editor application designed for Roblox scripting. It serves as a modern, sleek interface that connects to the Hydrogen Roblox executor to provide users with a premium script editing and execution experience.

### Core Purpose
- **Script Editing**: Provides a tabbed code editor with syntax highlighting for Lua scripts
- **Hydrogen Integration**: Connects to the Hydrogen Roblox executor for script execution
- **Script Management**: Allows users to organize, save, and manage their Lua scripts
- **Script Hub**: Features a curated collection of recommended scripts with search and filtering
- **User Experience**: Offers a modern UI with customizable settings and Discord Rich Presence

## Technical Architecture

### Platform & Framework
- **Framework**: Electron (v31.0.1)
- **Language**: JavaScript/Node.js with HTML/CSS frontend
- **Target Platform**: macOS (Universal - Intel and Apple Silicon)
- **Package Manager**: npm
- **Auto-Updater**: GitHub-based automatic updates via electron-updater

### Key Dependencies
- `electron`: Main application framework
- `electron-updater`: Automatic application updates
- `discord-rpc`: Discord Rich Presence integration
- `node-fetch`: HTTP requests
- `ws`: WebSocket communication
- `electron-builder`: Application packaging and distribution

## File Structure & Architecture

```
zAPP/
├── core/                     # Backend Electron modules (organized)
│   ├── main.js              # Main Electron entry point and window management
│   ├── preload.js           # Security bridge between main and renderer
│   ├── auto-updater.js      # Automatic update functionality
│   ├── discord-rpc.js       # Discord Rich Presence integration
│   ├── hydrogen-api.js      # Hydrogen executor integration and script execution
│   ├── zexium-api.js        # Zexium WebSocket API server
│   ├── data-manager.js      # Data persistence and file management
│   └── script-hub.js        # Script Hub functionality
├── package.json              # Application metadata and dependencies
├── zyron-icon.icns          # Application icon for macOS
├── entitlements.mac.plist   # macOS security entitlements
├── 
├── build.sh                 # Local build automation script
├── install.sh               # User installation script
├── release.sh               # Release automation script
├── changelog.json           # Version history and update notes
├── README.md                # Project documentation
│
└── src/                     # Frontend application files
    ├── main.html            # Main application UI structure
    ├── javascripts/         # Frontend JavaScript logic
    │   ├── app.js
    │   ├── api.js
    │   ├── editor.js
    │   ├── modals.js
    │   ├── saving.js
    │   ├── scripthub.js
    │   ├── settings.js
    │   ├── state.js
    │   ├── tabs.js
    │   └── ui.js
    │   └── utils.js
    ├── styles/              # Application styling
    │   ├── about.css
    │   ├── base.css
    │   ├── components.css
    │   ├── editor.css
    │   ├── layout.css
    │   ├── login.css
    │   ├── responsive.css
    │   ├── scripthub.css
    │   └── settings.css
    │
    ├── assets/              # Static resources
    │   └── images/          # UI icons and graphics
    │       ├── aboutIcon.png
    │       ├── editIcon.png
    │       ├── robloxIcon.png
    │       ├── scriptsIcon.png
    │       ├── settingsIcon.png
    │       └── zexiumIcon.png
    │
    └── scripts/             # Pre-packaged script collection
        ├── Infinite Yield/  # Community script package
        │   ├── config.json  # Script metadata
        │   ├── description.txt
        │   ├── image.png    # Script thumbnail
        │   └── script.lua   # Actual script content
        │
        ├── Sensation/       # Community script package
        └── Zexon Script/    # Community script package
```

## Core Functionality

### 1. User Authentication & Data Management
- **Local Storage**: Username stored in localStorage
- **Data Directory**: `~/Documents/zyronData/zyron_app_data.json`
- **State Persistence**: Saves user tabs, settings, and script content
- **Data Clearing**: Option to clear all user data and reset application

### 2. Script Editor
- **Multi-Tab Interface**: Up to 30 concurrent script tabs
- **ACE Editor Integration**: Syntax highlighting with Twilight theme
- **Auto-Save**: Configurable 30-second auto-save functionality
- **Search**: Real-time script search across open tabs
- **Context Menus**: Right-click functionality for tab management

### 3. Hydrogen Integration
- **Connection Management**: Automatic detection and connection to Hydrogen
- **Script Execution**: Direct script execution through Hydrogen
- **Status Monitoring**: Real-time connection status indicators
- **Auto-Execution**: Option to execute scripts automatically on Roblox game join

### 4. Zexium API Integration
- **WebSocket Communication**: Real-time communication with Zexium client
- **Custom Scripts**: Execute custom scripts through Zexium protocol
- **Status Indicators**: Visual feedback for connection status

### 5. Script Hub
- **Curated Collection**: Pre-selected community scripts
- **Filtering System**: Filter by All/Free/Paid categories
- **Search Functionality**: Search scripts by name and description
- **Script Cards**: Visual preview with metadata and thumbnails
- **Easy Installation**: One-click script loading into editor

### 6. Settings & Customization
- **Performance Mode**: Disable animations for better performance
- **Auto-Save Toggle**: Enable/disable automatic script saving
- **Discord RPC**: Rich Presence integration showing current activity
- **Notifications**: System notification preferences
- **User Management**: Username modification and data management

### 7. Discord Rich Presence
- **Activity Display**: Shows current script being edited
- **Connection Status**: Displays Roblox connection state
- **Custom Branding**: Zyron-branded presence with custom icons
- **Real-time Updates**: Updates presence based on user activity

## Application States & Views

### Login View
- Initial user authentication
- Username collection and storage
- Transition to main application

### Main Application View
- **Editor Pane**: Primary script editing interface
- **Scripts Pane**: Script hub with browseable collection
- **Settings Pane**: Application configuration options
- **About Pane**: Application information and changelog

## Data Storage & Persistence

### Local Storage (Browser)
- `zyronUsername`: User's display name
- `zyronPerfMode`: Performance mode setting
- `zyronNotifications`: Notification preferences
- `zyronZexiumAPI`: Zexium API enable status

### File System Storage
- **Data Directory**: `~/Documents/zyronData/`
- **Data File**: `zyron_app_data.json` (contains tab states and scripts)
- **Hydrogen Directory**: `~/Hydrogen/autoexecute/` (for Zexium API integration)

## Build & Distribution

### Development
- **Start Command**: `npm start` (launches Electron in development mode)
- **Build Command**: `npm run build` (creates distribution package)

### Distribution
- **Platform**: macOS Universal (Intel + Apple Silicon)
- **Format**: DMG installer
- **Auto-Updates**: GitHub Releases-based automatic updates
- **Installation**: curl-based one-command installation script

### Version Management
- **Current Version**: 1.3.0
- **Versioning**: Semantic versioning (major.minor.patch)
- **Changelog**: JSON-based version history tracking

## Security & Permissions

### macOS Entitlements
- JIT compilation allowed
- Unsigned executable memory allowed
- Library validation disabled
- No sandboxing (required for Hydrogen integration)

### Content Security Policy
- Script sources limited to self and unsafe-inline
- External CDN access for libraries (cdnjs.cloudflare.com)

## Network Communication

### Hydrogen Connection
- **Protocol**: HTTP requests to localhost
- **Port Detection**: Automatic port discovery
- **Health Checks**: Periodic connection status verification

### Zexium API
- **Protocol**: WebSocket communication
- **Server**: Local WebSocket server
- **Port**: Dynamic port assignment

### GitHub Integration
- **Updates**: Automatic update checking via GitHub API
- **Repository**: a-guy-lol/zAPP
- **Releases**: GitHub Releases for distribution

## UI/UX Features

### Visual Elements
- **Click Effects**: Animated particle effects on user interaction
- **Smooth Transitions**: CSS-based animations and transitions
- **Status Indicators**: Color-coded connection status dots
- **Icon-Based Navigation**: Visual navigation with descriptive labels

### Performance Optimizations
- **Performance Mode**: Disables animations for slower devices
- **Debounced Operations**: Optimized search and save operations
- **Lazy Loading**: Efficient script and content loading

## Current Version (1.3.1) Features
- **HOTFIX**: Automatic data migration from v1.2 to v1.3 format
- Script filtering by type (Free/Paid/All) with proper data structure
- Zexium API integration for custom script execution with migrated settings
- Execute-on-join functionality with script key management (now works after migration)
- Enhanced connection status with clickable indicators
- Improved transparency consistency
- Live connection status updates
- Backend restructured into modular core architecture
- **NEW**: Development mode data isolation - no writes to Documents/localStorage in dev mode
- **FIXED**: Auto-updater configuration with proper GitHub publish settings
- **ENHANCED**: Better error handling for auto-updater download failures

## Development Notes

### Code Organization
- **core/main.js**: Main Electron entry point, window management, and module initialization
- **core/auto-updater.js**: GitHub-based automatic update system with improved error handling
- **core/discord-rpc.js**: Discord Rich Presence integration and activity tracking
- **core/hydrogen-api.js**: Hydrogen executor communication and script execution
- **core/zexium-api.js**: WebSocket server for Zexium API integration
- **core/data-manager.js**: File system operations and data persistence (development mode aware)
- **core/script-hub.js**: Script collection management and execution
- **core/preload.js**: Secure IPC bridge between main and renderer processes
- **src/javascripts/app.js**: Main application initialization and flow control
- **src/javascripts/storage.js**: Safe localStorage wrapper that respects development mode
- **src/javascripts/modals.js**: Modal dialogs including update modal with error handling
- **src/javascripts/settings.js**: Settings management and toggles
- **src/javascripts/state.js**: Application state and variable definitions
- **src/javascripts/tabs.js**: Tab management system
- **src/javascripts/saving.js**: Auto-save and state persistence
- **src/javascripts/editor.js**: Code editor functionality
- **src/javascripts/api.js**: API communication and connection management
- **src/javascripts/scripthub.js**: Script hub functionality
- **src/javascripts/ui.js**: User interface interactions
- **src/javascripts/utils.js**: Utility functions

### Development Mode Features
- **Data Isolation**: In development mode (`!app.isPackaged`), the app uses a local `dev-data` directory instead of `~/Documents/zyronData`
- **localStorage Protection**: Uses `safeStorage` wrapper that prevents localStorage writes in development mode
- **Auto-updater Disabled**: Update checks are skipped in development mode

### Auto-updater System
- **Configuration**: Uses GitHub releases from `a-guy-lol/zAPP` repository
- **Download Control**: Auto-download disabled, user controls when to download
- **Error Handling**: Comprehensive error reporting and recovery options
- **Progress Tracking**: Real-time download progress with visual feedback
- **Installation**: Quit-and-install pattern for seamless updates

### Key Classes & Functions
- Tab management system with unique ID tracking
- Auto-save mechanism with timeout-based saves
- Connection monitoring with interval-based health checks
- Modal system for user interactions and confirmations

---

**Last Updated**: August 15, 2025 (v1.3.1) - Auto-updater fixes and development mode data isolation
**AI Update Reminder**: When modifying this application, ensure this context file reflects all changes to maintain accurate documentation.

**CRITICAL NOTE**: This version includes automatic data migration from v1.2 format to v1.3+ format. Always test data migration thoroughly when making changes to data structure.
