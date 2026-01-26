#!/usr/bin/env bash

# Beginner-friendly environment setup for the Family Tree App.
# This script creates a local .env file from .env.example and validates inputs.

set -e

echo "Family Tree App - Environment Setup"
echo "-----------------------------------"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_tool() {
  local tool="$1"
  if ! command_exists "$tool"; then
    echo "Missing required tool: $tool"
    echo "Please install $tool and try again."
    exit 1
  fi
}

require_tool node
require_tool npm
require_tool wrangler

if [ ! -f ".env.example" ]; then
  echo "Missing .env.example file. Run setup from the project root."
  exit 1
fi

if [ -f ".env" ]; then
  echo "A .env file already exists."
  read -r -p "Do you want to overwrite it? (y/N): " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    echo "Aborting without changes."
    exit 0
  fi
fi

is_url() {
  local value="$1"
  if [[ "$value" =~ ^https?:// ]]; then
    return 0
  fi
  return 1
}

prompt_value() {
  local label="$1"
  local example="$2"
  local value
  while true; do
    read -r -p "$label (example: $example): " value
    if [ -n "$value" ]; then
      echo "$value"
      return 0
    fi
    echo "Value cannot be empty."
  done
}

echo ""
echo "Enter your URLs (include https://)."
VITE_API_URL=$(prompt_value "VITE_API_URL" "https://your-worker.example.com")
while ! is_url "$VITE_API_URL"; do
  echo "Please enter a valid URL starting with http:// or https://"
  VITE_API_URL=$(prompt_value "VITE_API_URL" "https://your-worker.example.com")
done

VITE_R2_PUBLIC_URL=$(prompt_value "VITE_R2_PUBLIC_URL" "https://your-bucket.r2.dev")
while ! is_url "$VITE_R2_PUBLIC_URL"; do
  echo "Please enter a valid URL starting with http:// or https://"
  VITE_R2_PUBLIC_URL=$(prompt_value "VITE_R2_PUBLIC_URL" "https://your-bucket.r2.dev")
done

R2_PUBLIC_URL=$(prompt_value "R2_PUBLIC_URL" "https://your-bucket.r2.dev")
while ! is_url "$R2_PUBLIC_URL"; do
  echo "Please enter a valid URL starting with http:// or https://"
  R2_PUBLIC_URL=$(prompt_value "R2_PUBLIC_URL" "https://your-bucket.r2.dev")
done

echo ""
echo "JWT_SECRET should be long and random."
if command_exists openssl; then
  echo "Tip: generate one with: openssl rand -base64 32"
fi
JWT_SECRET=$(prompt_value "JWT_SECRET" "a-strong-random-string")

cat <<EOF > .env
VITE_API_URL=$VITE_API_URL
VITE_R2_PUBLIC_URL=$VITE_R2_PUBLIC_URL
JWT_SECRET=$JWT_SECRET
R2_PUBLIC_URL=$R2_PUBLIC_URL
EOF

echo ""
echo ".env created successfully."
echo "Remember: never commit .env to git."
