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

아래 Releases 페이지에서 최신 서버 설치 파일을 받습니다.  
👉 https://github.com/akira09999/RemoViewer2Server/releases/latest

설치 파일을 실행하면 Windows 보안 경고가 나타날 수 있습니다.  
이는 이 프로그램에 코드 서명(유료 인증서)이 없기 때문이며,  
바이러스나 악성 프로그램이라는 의미가 아닙니다.  
경고 화면에서 **[추가 정보]** 를 누른 뒤 **[실행]** 을 누르면 설치가 진행됩니다.

이 서버의 소스 코드는 전부 이 저장소에 공개되어 있습니다.  
설치 파일이 미덥지 않다면 코드를 직접 확인하시거나, 직접 빌드해 사용하셔도 됩니다.  
공식 설치 파일은 오직 이 저장소의 Releases 페이지에서만 배포됩니다.

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
