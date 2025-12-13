#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting Master Release Pipeline ===${NC}"

# Get the script's directory (absolute path)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}Root Directory: $ROOT_DIR${NC}"

# 1. Pipeline for Projects (Home, Games, Tools)
echo -e "\n${GREEN}>>> Step 1: Projects Pipeline (Test & Deploy)${NC}"
# Use node to run the mjs script
node "$ROOT_DIR/projects/Home/scripts/deploy-all.mjs"

# 2. Deploy LangHuaSchool
echo -e "\n${GREEN}>>> Step 2: Deploying LangHuaSchool${NC}"
cd "$ROOT_DIR/LangHuaSchool"
npm run deploy

# 3. Git Operations
echo -e "\n${GREEN}>>> Step 3: Git Sync${NC}"
cd "$ROOT_DIR"

if [ -n "$(git status --porcelain)" ]; then
  echo "Changes detected, committing..."
  git add .
  git commit -m "chore(release): auto-deploy $(date '+%Y-%m-%d %H:%M:%S')"
  
  echo "Pushing to remote..."
  git push origin main
  echo -e "${GREEN}Git sync successful.${NC}"
else
  echo "No changes to commit."
  # Still try to push in case local commits haven't been pushed
  git push origin main
fi

echo -e "\n${GREEN}=== Release Completed Successfully ===${NC}"
