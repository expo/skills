#!/bin/bash
set -euo pipefail

repo_directory="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_directory"

# Parse arguments
target_branch=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --branch)
      target_branch="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: update.sh [--branch <name>]"
      echo ""
      echo "Updates the local clone of expo/skills to the latest version."
      echo ""
      echo "Options:"
      echo "  --branch <name>  Switch to the specified branch (e.g., main, stable)"
      echo "  --help, -h       Show this help message"
      echo ""
      echo "Branches:"
      echo "  main    Development branch with the latest changes"
      echo "  stable  Release branch with stable versions"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run with --help for usage information."
      exit 1
      ;;
  esac
done

current_branch=$(git rev-parse --abbrev-ref HEAD)

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Cannot update: You have uncommitted local changes that would be overwritten."
  echo ""
  echo "Modified files:"
  git status --porcelain | sed 's/^/  /'
  echo ""
  echo "To proceed, choose one of these options:"
  echo ""
  echo "1. Stash your changes temporarily:"
  echo "   git stash"
  echo "   # Then run the update again"
  echo "   # Afterward, restore with: git stash pop"
  echo ""
  echo "2. Discard your changes (cannot be undone):"
  echo "   git checkout -- ."
  echo ""
  echo "3. Commit your changes first:"
  echo "   git add -A && git commit -m \"Save local changes\""
  echo ""
  echo "Once resolved, run the update again."
  exit 1
fi

# Fetch latest from origin
echo "Fetching latest changes from origin..."
git fetch origin

# Track whether we need to reinstall
switched_branch=false

# Switch branch if requested
if [[ -n "$target_branch" ]]; then
  # Check if the remote branch exists
  if ! git rev-parse --verify "origin/$target_branch" >/dev/null 2>&1; then
    echo "Error: Branch \"$target_branch\" does not exist on the remote repository."
    echo ""
    echo "Available branches:"
    echo "  main    Development branch with the latest changes"
    echo "  stable  Release branch with stable versions"
    exit 1
  fi

  if [[ "$current_branch" != "$target_branch" ]]; then
    echo "Switching from \"$current_branch\" to \"$target_branch\"..."

    # Check if local branch exists
    if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
      git checkout "$target_branch"
    else
      # Create local branch tracking remote
      git checkout -b "$target_branch" "origin/$target_branch"
    fi
    current_branch="$target_branch"
    switched_branch=true
  fi
fi

# Pull latest changes
echo "Pulling latest changes on \"$current_branch\"..."
head_before=$(git rev-parse HEAD)
if ! git pull --ff-only 2>&1; then
  echo ""
  echo "Cannot fast-forward: Your local branch has diverged from the remote."
  echo ""
  echo "This happens when you have local commits that are not on the remote."
  echo ""
  echo "To proceed, choose one of these options:"
  echo ""
  echo "1. Rebase your commits on top of the remote:"
  echo "   git rebase origin/$current_branch"
  echo ""
  echo "2. Discard your local commits (cannot be undone):"
  echo "   git reset --hard origin/$current_branch"
  echo ""
  echo "Once resolved, run the update again."
  exit 1
fi
head_after=$(git rev-parse HEAD)

# Run install script only if there were changes
if [[ "$head_before" != "$head_after" ]] || [[ "$switched_branch" == true ]]; then
  echo ""
  echo "Installing skills..."
  ./install
  echo ""
  echo "Update complete!"
fi
