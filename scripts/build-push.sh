#!/bin/sh
# Build and push Fynfo Docker image to Docker Hub.
# Usage:
#   ./scripts/build-push.sh              # builds and pushes :latest
#   ./scripts/build-push.sh v1.2.0       # builds and pushes :v1.2.0 + :latest

set -e

IMAGE="cljiahao/fynfo"
TAG="${1:-latest}"

echo "Building ${IMAGE}:${TAG} ..."

# Build multi-platform (arm64 for Pi, amd64 if you ever move to x86)
# Requires: docker buildx create --use (one-time setup)
docker buildx build \
  --platform linux/arm64,linux/amd64 \
  --target prod \
  --tag "${IMAGE}:${TAG}" \
  --tag "${IMAGE}:latest" \
  --push \
  .

echo ""
echo "Pushed:"
echo "  ${IMAGE}:${TAG}"
echo "  ${IMAGE}:latest"
echo ""
echo "Watchtower on your Pi will pick this up automatically."
