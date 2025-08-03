#!/bin/bash

# Simple release script for Zyron
# Usage: ./release.sh [version] (e.g., ./release.sh 1.0.1)

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.1"
    exit 1
fi

VERSION="$1"
TAG="v$VERSION"

echo "🚀 Creating release $TAG"

# Check for uncommitted changes and stash them
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "💾 Stashing uncommitted changes"
    git stash push -m "Auto-stash before release $TAG"
    STASHED=true
else
    STASHED=false
fi

# Pull latest changes first with rebase to handle divergent branches
echo "🔄 Pulling latest changes from remote"
git pull --rebase origin main

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo "🔄 Restoring your changes"
    git stash pop
fi

# Update package.json version
echo "📝 Updating package.json version to $VERSION"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Update build.sh version
echo "📝 Updating build.sh version to $VERSION"
sed -i '' "s/readonly APPLICATION_VERSION=\".*\"/readonly APPLICATION_VERSION=\"$VERSION\"/" build.sh
sed -i '' "s/readonly APPLICATION_VERSION=\".*\"/readonly APPLICATION_VERSION=\"$VERSION\"/" install.sh

# Update changelog.json version  
echo "📝 Updating changelog.json version to $VERSION"
sed -i '' "s/\"latestVersion\": \".*\"/\"latestVersion\": \"$VERSION\"/" changelog.json

# Commit all changes (app changes + version updates)
echo "📦 Committing all changes for release"
git add .
git commit -m "Release $TAG"

# Create and push tag
echo "🏷️  Creating and pushing tag $TAG"
git tag "$TAG"
git push origin main
git push origin "$TAG"

echo "✅ Release $TAG created successfully!"
echo "🤖 GitHub Actions will now build and publish the release automatically"
echo "📥 Users can install with: curl -sL \"https://raw.githubusercontent.com/a-guy-lol/zAPP/main/install.sh\" | bash"