(function () {
  let promptEvent = null;
  const q = (id) => document.getElementById(id);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isLocalFile = location.protocol === 'file:';
  const standalone = () =>
    matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function windowsPathFromLocation() {
    let filePath = decodeURIComponent(location.pathname || '');
    if (/^\/[A-Za-z]:/.test(filePath)) filePath = filePath.slice(1);
    return filePath.replace(/\//g, '\\');
  }

  function downloadWindowsInstaller() {
    const indexPath = windowsPathFromLocation();
    const appDir = indexPath.replace(/\\[^\\]+$/, '');

    if (!/^[A-Za-z]:\\/.test(indexPath)) {
      alert('The automatic installer is available on Windows only.');
      return;
    }

    const bat = [
      '@echo off',
      'setlocal',
      'title Install Warehouse Receiving Sheet',
      `set "APP_INDEX=${indexPath}"`,
      `set "APP_DIR=${appDir}"`,
      'echo Installing Warehouse Receiving Sheet...',
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'Stop\'; $desktop=[Environment]::GetFolderPath(\'Desktop\'); $link=Join-Path $desktop \'Warehouse Receiving Sheet.lnk\'; $edge=@($env:ProgramFiles+\'\\Microsoft\\Edge\\Application\\msedge.exe\', ${env:ProgramFiles(x86)}+\'\\Microsoft\\Edge\\Application\\msedge.exe\') | Where-Object { Test-Path $_ } | Select-Object -First 1; $chrome=@($env:ProgramFiles+\'\\Google\\Chrome\\Application\\chrome.exe\', ${env:ProgramFiles(x86)}+\'\\Google\\Chrome\\Application\\chrome.exe\', $env:LOCALAPPDATA+\'\\Google\\Chrome\\Application\\chrome.exe\') | Where-Object { Test-Path $_ } | Select-Object -First 1; $browser=if($edge){$edge}elseif($chrome){$chrome}else{$null}; $ws=New-Object -ComObject WScript.Shell; $shortcut=$ws.CreateShortcut($link); if($browser){$shortcut.TargetPath=$browser; $uri=([System.Uri]::new($env:APP_INDEX)).AbsoluteUri; $shortcut.Arguments=\'--app="\'+$uri+\'"\'; $shortcut.WorkingDirectory=$env:APP_DIR; $shortcut.IconLocation=$browser+\',0\'}else{$shortcut.TargetPath=$env:APP_INDEX; $shortcut.WorkingDirectory=$env:APP_DIR}; $shortcut.Description=\'Warehouse Receiving Sheet\'; $shortcut.Save(); Start-Process $link"',
      'if errorlevel 1 (',
      '  echo.',
      '  echo Installation failed. Keep this app folder extracted, then try INSTALL_APP.bat inside the folder.',
      '  pause',
      '  exit /b 1',
      ')',
      'echo.',
      'echo Installed successfully. A shortcut is now on your Desktop.',
      'timeout /t 3 >nul',
      'endlocal'
    ].join('\r\n');

    const blob = new Blob([bat], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'INSTALL_WAREHOUSE_RECEIVING_APP.bat';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    const modal = q('installModal');
    const copy = q('installCopy');
    const steps = q('installSteps');
    if (copy) copy.textContent = 'Installer downloaded for Windows:';
    if (steps) {
      steps.innerHTML =
        '<li>Open Downloads.</li><li>Double-click <b>INSTALL_WAREHOUSE_RECEIVING_APP.bat</b>.</li><li>A Warehouse Receiving Sheet shortcut will appear on Desktop and open automatically.</li><li>Keep the extracted <b>wrs-final-static</b> folder; do not delete or move it after installation.</li>';
    }
    if (modal) modal.classList.add('show');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event;
  });

  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    const button = q('installAppBtn');
    if (button) button.style.display = 'none';
  });

  window.addEventListener('DOMContentLoaded', () => {
    const button = q('installAppBtn');
    const modal = q('installModal');
    const close = q('installClose');
    const copy = q('installCopy');
    const steps = q('installSteps');

    if (standalone() && button) button.style.display = 'none';

    if (isLocalFile && button) {
      const label = button.querySelector('.install-label');
      if (label) label.textContent = 'Install App';
      button.title = 'Install Warehouse Receiving Sheet on this Windows laptop';
    }

    if (button) {
      button.addEventListener('click', async () => {
        if (isLocalFile) {
          downloadWindowsInstaller();
          return;
        }

        if (promptEvent) {
          promptEvent.prompt();
          await promptEvent.userChoice.catch(() => null);
          promptEvent = null;
          return;
        }

        if (copy) copy.textContent = ios ? 'On iPhone, use Safari:' : 'Use Chrome or Microsoft Edge:';
        if (steps) {
          steps.innerHTML = ios
            ? '<li>Tap Share.</li><li>Tap Add to Home Screen.</li><li>Tap Add.</li>'
            : '<li>Open this link in Chrome or Edge.</li><li>Tap Download App again when the install prompt is ready.</li><li>Tap Install.</li>';
        }
        if (modal) modal.classList.add('show');
      });
    }

    if (close) close.addEventListener('click', () => modal && modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('show');
    });

    if (!isLocalFile && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(console.warn);
    }
  });
})();
