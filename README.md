# RemoViewer2 Server

RemoViewer2 Server is a desktop application (Windows) that serves comic/manga archive files (ZIP) stored on your PC or NAS to the RemoViewer2 Android client app over your local network or the internet.

## Overview

- Scans a folder you specify and builds a file index with thumbnails
- Communicates with the Android client over TCP with AES-256-CBC encryption
- Supports UPnP automatic port forwarding for easy remote access
- Runs in the system tray and starts automatically on login

**This repository contains the server source only.**  
The Android client app is separate and not publicly available.

## Installation

Download the latest installer from the Releases page.  
👉 https://github.com/nextentry9/RemoViewer2Server/releases/latest

When you run the installer, Windows may show a security warning.  
This is because the program is not code-signed (no paid certificate), and does not mean it contains a virus or malware.  
Click **[More info]** on the warning screen, then click **[Run anyway]** to proceed with installation.

The full source code of this server is available in this repository.  
If you are unsure about the installer, feel free to review the code or build it yourself.  
Official installers are distributed exclusively through the Releases page of this repository.

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

RemoViewer Server License  
Copyright (c) 2026 nextentry. All rights reserved.

---

**[한국어]**

본 소프트웨어("RemoViewer 서버")의 소스 코드는 투명성과 신뢰를 위해 공개됩니다.  
누구나 코드를 열람하고, 검토하고, 개인적인 목적으로 직접 빌드하여 사용할 수 있습니다.

다만 다음 사항은 저작자의 사전 서면 허락 없이 금지됩니다.

1. 본 소스 코드 또는 그 일부의 재배포(원본·수정본 불문)
2. 본 소프트웨어 또는 그 파생물의 판매, 재판매, 상업적 이용
3. 본 소프트웨어의 빌드 결과물(설치 파일 등)을 공식 배포처가 아닌 경로로 배포하는 행위
4. 본 소프트웨어를 기반으로 한 별도 제품·서비스의 제작 및 배포

공식 설치 파일은 본 저장소의 Releases 페이지에서만 받을 수 있습니다.  
그 외 경로로 배포되는 설치 파일은 저작자가 보증하지 않습니다.

본 소프트웨어는 "있는 그대로(AS IS)" 제공되며, 명시적이든 묵시적이든 어떠한 보증도 하지 않습니다.  
본 소프트웨어의 사용으로 발생하는 어떠한 손해에 대해서도 저작자는 책임을 지지 않습니다.

문의 및 허락 요청: nextentryco@gmail.com

---

**[English]**

The source code of this software ("RemoViewer Server") is made publicly available for the purposes of transparency and trust. Anyone may view, review, and build the code for their own personal use.

However, the following are **PROHIBITED** without the prior written permission of the copyright holder:

1. Redistribution of this source code or any portion thereof (whether original or modified).
2. Selling, reselling, or any commercial use of this software or its derivatives.
3. Distributing build artifacts (e.g., installers) of this software through any channel other than the official distribution source.
4. Creating and distributing a separate product or service based on this software.

Official installers are available **ONLY** from the Releases page of this repository.  
Installers distributed through any other channel are not endorsed by the author.

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.  
THE AUTHOR SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM THE USE OF THIS SOFTWARE.

Contact / permission requests: nextentryco@gmail.com
