#!/bin/bash
# Release script for @itsaydrian/waymark-mcp-server
# Usage: ./scripts/release-mcp-server.sh <version>
# Example: ./scripts/release-mcp-server.sh 0.1.7

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.7"
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g., 0.1.7)"
  exit 1
fi

PACKAGE_DIR="packages/mcp-server"
PACKAGE_JSON="$PACKAGE_DIR/package.json"
CHANGELOG="$PACKAGE_DIR/CHANGELOG.md"

cd "$PACKAGE_DIR"

# Get current version
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "Current version: $CURRENT_VERSION"
echo "New version: $VERSION"

# Verify clean build from correct directory
echo ""
echo "Step 1: Clean build from packages/mcp-server/..."
rm -rf dist
npx tsc

# Verify transport files exist
if [ ! -f "dist/src/transports/stdio.js" ]; then
  echo "Error: dist/src/transports/stdio.js not found. Build failed."
  exit 1
fi
if [ ! -f "dist/src/transports/http.js" ]; then
  echo "Error: dist/src/transports/http.js not found. Build failed."
  exit 1
fi
echo "✓ Build verified - transport files present"

# Update version in package.json
echo ""
echo "Step 2: Updating package.json version..."
jq ".version = \"$VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
echo "✓ Version updated to $VERSION"

# Update changelog
echo ""
echo "Step 3: Updating CHANGELOG.md..."
TODAY=$(date +%Y-%m-%d)

# Check if version already exists in changelog
if grep -q "^## \[$VERSION\]" CHANGELOG.md; then
  echo "Warning: Version $VERSION already exists in CHANGELOG.md"
  echo "Please update manually if needed."
else
  # Add new section after the header
  sed -i.bak "7a\\
\\
## [$VERSION] - $TODAY\\
\\
### Fixed\\
\\
- (Add release notes here)\\
" CHANGELOG.md
  rm CHANGELOG.md.bak
  echo "✓ CHANGELOG.md updated with version $VERSION"
  echo "  Remember to edit the release notes before committing!"
fi

echo ""
echo "Release preparation complete!"
echo ""
echo "Next steps:"
echo "  1. Edit $CHANGELOG to add proper release notes"
echo "  2. git add $PACKAGE_JSON $CHANGELOG"
echo "  3. git commit -m \"chore(mcp-server): release v$VERSION\""
echo "  4. git tag \"@itsaydrian/waymark-mcp-server@$VERSION\""
echo "  5. git push origin \"@itsaydrian/waymark-mcp-server@$VERSION\""
echo "  6. gh release create \"@itsaydrian/waymark-mcp-server@$VERSION\" --title \"@itsaydrian/waymark-mcp-server@$VERSION\" --notes \"...\" --repo aydrian/waymark"
echo "  7. cd $PACKAGE_DIR && npm publish (requires 2FA OTP)"
echo ""
echo "Or run with --publish flag to automate steps 2-7 (after you edit the changelog):"
echo "  $0 $VERSION --publish"
