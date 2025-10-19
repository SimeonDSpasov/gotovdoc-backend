#!/bin/bash
set -euo pipefail

# Install LibreOffice (headless) and common fonts on the host.
# This script is intended to run during the CodeDeploy AfterInstall phase.

log() {
  echo "[after_install] $*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

install_apt() {
  log "Detected apt-based distro. Installing LibreOffice..."
  sudo apt-get update -y
  # Install full libreoffice to ensure soffice and filters are present
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    fonts-dejavu fonts-liberation \
    fontconfig
}

install_yum_dnf() {
  # Amazon Linux / RHEL / CentOS / Fedora
  local installer="yum"
  if command_exists dnf; then
    installer="dnf"
  fi
  log "Detected ${installer}-based distro. Installing LibreOffice..."
  sudo ${installer} -y install fontconfig
  # Try headless first (preferred on servers), fall back to full package
  if sudo ${installer} -y install libreoffice-headless; then
    :
  else
    sudo ${installer} -y install libreoffice
  fi
  # Common fonts for better PDF rendering (ignore if unavailable)
  sudo ${installer} -y install dejavu-sans-fonts dejavu-serif-fonts >/dev/null 2>&1 || true
}

install_apk() {
  log "Detected Alpine (apk). Installing LibreOffice..."
  sudo apk update
  sudo apk add --no-cache libreoffice libreoffice-writer fontconfig ttf-dejavu
}

install_zypper() {
  log "Detected zypper-based distro. Installing LibreOffice..."
  sudo zypper refresh
  sudo zypper --non-interactive install libreoffice libreoffice-writer fontconfig dejavu-fonts
}

ensure_soffice() {
  if command_exists soffice; then
    log "soffice found at $(command -v soffice)"
    return 0
  fi
  # Some distros place soffice.bin in program folder. Create a friendly symlink if needed.
  if [ -x "/usr/lib/libreoffice/program/soffice" ]; then
    sudo ln -sf "/usr/lib/libreoffice/program/soffice" "/usr/bin/soffice"
    log "Created symlink /usr/bin/soffice"
    return 0
  fi
  return 1
}

main() {
  if ensure_soffice; then
    log "LibreOffice already installed. Skipping installation."
    exit 0
  fi

  if command_exists apt-get; then
    install_apt
  elif command_exists yum || command_exists dnf; then
    install_yum_dnf
  elif command_exists apk; then
    install_apk
  elif command_exists zypper; then
    install_zypper
  else
    log "Unsupported package manager. Please install LibreOffice manually."
    exit 1
  fi

  if ! ensure_soffice; then
    log "LibreOffice installation completed, but 'soffice' not found on PATH."
    exit 1
  fi

  log "LibreOffice installation complete."
}

main "$@"


