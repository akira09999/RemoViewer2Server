# RemoViewer2 Server

RemoViewer2 Server is a desktop application (Windows) that serves comic/manga archive files (ZIP, CBZ, PDF, etc.) stored on your PC or NAS to the RemoViewer2 Android client app over your local network or the internet.

## Overview

- Scans a folder you specify and builds a file index with thumbnails
- Communicates with the Android client over TCP with AES-256-CBC encryption
- Supports UPnP automatic port forwarding for easy remote access
- Runs in the system tray and starts automatically on login

**This repository contains the server source only.**  
The Android client app is separate and not publicly available.

## Installation

Download the latest installer from the [Releases](../../releases/latest) page.

> The installer is provided so users can verify what they are installing. You do not need to build from source to use RemoViewer2 Server.

## Building from Source

1. Install [Node.js](https://nodejs.org/) (v18 or later)
2. Clone this repository
3. Install dependencies:
   ```
   npm install
   ```
4. Create the encryption key file (required — not included in the repo):
   ```
   src/main/secret.js
   ```
   Contents:
   ```js
   const AES_KEY = Buffer.from('your-32-byte-key-here', 'utf8')
   module.exports = { AES_KEY }
   ```
   > The key must match the key used in the Android client app, or the connection will fail.

5. Run in development mode:
   ```
   npm run dev
   ```
6. Build the installer:
   ```
   npm run build
   ```

## License

<!-- License to be determined -->
