import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, open, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { Browser, Page } from 'playwright';
import type { Config } from '../config.js';

const execute = promisify(execFile);
/** Native Windows known-folder APIs verify AppData directories before allowing
 * a non-default DevTools profile. Give the owned browser a complete temporary
 * home rather than the personal home or a nonexistent test HOME. */
export async function createBrowserEnvironment() {
  const root = resolve(tmpdir()),
    home = await mkdtemp(join(root, 'mimicus-browser-home-'));
  if (!resolve(home).startsWith(root + sep + 'mimicus-browser-home-'))
    throw new Error('Unsafe owned browser home');
  const roaming = join(home, 'AppData', 'Roaming'),
    local = join(home, 'AppData', 'Local'),
    temporary = join(home, 'Temp');
  const close = () => rm(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  try {
    await Promise.all([
      mkdir(roaming, { recursive: true }),
      mkdir(local, { recursive: true }),
      mkdir(temporary, { recursive: true }),
    ]);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    return {
      home,
      env: {
        ...env,
        HOME: home,
        USERPROFILE: home,
        APPDATA: roaming,
        LOCALAPPDATA: local,
        TEMP: temporary,
        TMP: temporary,
        TMPDIR: temporary,
      },
      close,
    };
  } catch (e) {
    await close();
    throw e;
  }
}
/** Fixed source only. Registry data is returned as JSON, never evaluated as PowerShell. */
const windowsInspection = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MimicusAssociation {
 [DllImport("Shlwapi.dll", CharSet=CharSet.Unicode)]
 public static extern uint AssocQueryString(uint flags, uint str, string assoc, string extra, StringBuilder output, ref uint length);
 public static string Executable(){uint size=32768;var result=new StringBuilder((int)size);uint hr=AssocQueryString(0x1000,2,"https","open",result,ref size);if(hr!=0)throw new Exception("HTTPS executable association failed: "+hr);return result.ToString();}
}
'@
$choice=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction SilentlyContinue
$id=[string]$choice.ProgId
$command=$null
if($id){$key=Get-Item -LiteralPath ('Registry::HKEY_CLASSES_ROOT\'+$id+'\shell\open\command') -ErrorAction SilentlyContinue;if($key){$command=$key.GetValue('')}}
$executable=[MimicusAssociation]::Executable()
$info=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($executable)
$signatureStatus='unavailable';$signer=$null
try{$signature=Get-AuthenticodeSignature -LiteralPath $executable;$signatureStatus=[string]$signature.Status;$signer=$signature.SignerCertificate.Subject}catch{}
[pscustomobject]@{executable=$executable;progId=$id;command=$command;productName=$info.ProductName;fileVersion=$info.FileVersion;originalFilename=$info.OriginalFilename;signatureStatus=$signatureStatus;signer=$signer} | ConvertTo-Json -Compress
`;
export type BrowserBackend = {
  selection: 'windows-default' | 'explicit-override';
  executablePath: string;
  browser: string;
  engine: 'chromium';
  progId?: string;
  fileVersion?: string;
  productName?: string;
  signatureStatus?: string;
  signer?: string;
  compatibility: string;
};
type WindowsAssociation = {
  executable: string;
  progId?: string;
  command?: string;
  productName?: string;
  fileVersion?: string;
  originalFilename?: string;
  signatureStatus?: string;
  signer?: string;
};
/** Only a literal first executable token is considered. No command arguments are reused. */
export function commandExecutable(command: string) {
  const value = command.trim();
  const match = value.startsWith('"')
    ? /^"([^"\r\n]+\.exe)"(?:\s|$)/i.exec(value)
    : /^([^\s"\r\n]+\.exe)(?:\s|$)/i.exec(value);
  if (!match?.[1] || !/^(?:[a-z]:\\|\\\\)/i.test(match[1]))
    throw new Error('Default-browser command has no unambiguous literal executable');
  return match[1];
}
export function classifyBrowser(path: string, product = '') {
  const name = basename(path.replaceAll('\\', '/')).toLowerCase();
  if (name === 'firefox.exe' || /firefox/i.test(product))
    throw new Error(
      'Windows default is Firefox. Stock installed Firefox is incompatible with Playwright’s patched Firefox controller. Set MIMICUS_BROWSER_EXECUTABLE explicitly to an installed compatible Chromium browser to opt in; no fallback or download occurs.',
    );
  const known: Record<string, string> = {
    'brave.exe': 'Brave',
    'chrome.exe': 'Chrome',
    'msedge.exe': 'Edge',
    'vivaldi.exe': 'Vivaldi',
    'opera.exe': 'Opera',
    chromium: 'Chromium',
    'chromium-browser': 'Chromium',
    'google-chrome': 'Chrome',
    'google-chrome-stable': 'Chrome',
  };
  const browser = known[name];
  if (!browser)
    throw new Error(
      'Unsupported default browser executable: ' +
        name +
        '. An explicit installed Chromium executable is required; no fallback or download occurs.',
    );
  return browser;
}
export async function inspectWindowsAssociation(): Promise<WindowsAssociation> {
  if (process.platform !== 'win32')
    throw new Error(
      'Windows default-browser discovery is unavailable on ' +
        process.platform +
        '. Set MIMICUS_BROWSER_EXECUTABLE explicitly to an installed Chromium executable; no fallback or download occurs.',
    );
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  // Even -NoProfile PowerShell startup creates AppData/Roaming in USERPROFILE.
  // Confine all helper software state to a fresh owned envelope and remove it.
  const temporaryRoot = resolve(tmpdir()),
    helperHome = await mkdtemp(join(temporaryRoot, 'mimicus-association-'));
  if (!resolve(helperHome).startsWith(temporaryRoot + sep + 'mimicus-association-'))
    throw new Error('Unsafe association helper temporary envelope');
  try {
    const { stdout } = await execute(
      executable,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(windowsInspection, 'utf16le').toString('base64'),
      ],
      {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 65536,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: helperHome,
          USERPROFILE: helperHome,
          APPDATA: join(helperHome, 'AppData', 'Roaming'),
          LOCALAPPDATA: join(helperHome, 'AppData', 'Local'),
          TEMP: helperHome,
          TMP: helperHome,
          TMPDIR: helperHome,
        },
      },
    );
    return JSON.parse(stdout.trim());
  } catch (e) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String(e.code).slice(0, 30) : 'invalid response';
    throw new Error(
      'Cannot inspect the current Windows HTTPS default browser read-only (' +
        code +
        '). Check Windows PowerShell and the HTTPS association with mimicus doctor. No alternative browser was launched. The fixed helper command and CLIXML are omitted.',
    );
  } finally {
    await rm(helperHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
export async function resolveBrowserBackend(
  config: Pick<Config, 'browserExecutable'>,
  inspect = inspectWindowsAssociation,
): Promise<BrowserBackend> {
  const selection = config.browserExecutable ? 'explicit-override' : 'windows-default',
    association = config.browserExecutable ? undefined : await inspect(),
    supplied = config.browserExecutable ?? association?.executable;
  if (!supplied || !isAbsolute(supplied) || /[\r\n\0]/.test(supplied))
    throw new Error('Browser executable must be a literal absolute installed file path');
  const executablePath = await realpath(supplied);
  if (!(await stat(executablePath)).isFile())
    throw new Error('Browser executable is not a regular installed file');
  if (process.platform === 'win32') {
    if (!executablePath.toLowerCase().endsWith('.exe'))
      throw new Error('Windows browser must be an executable .exe file');
    const file = await open(executablePath, 'r');
    try {
      const bytes = Buffer.alloc(2);
      await file.read(bytes, 0, 2, 0);
      if (bytes.toString('ascii') !== 'MZ')
        throw new Error('Browser executable has no Windows executable header');
    } finally {
      await file.close();
    }
    if (association?.command) {
      const registered = await realpath(commandExecutable(association.command));
      if (registered.toLowerCase() !== executablePath.toLowerCase())
        throw new Error(
          'Windows API and registered default-browser executable disagree; refusing an ambiguous launch',
        );
    }
  }
  const browser = classifyBrowser(executablePath, association?.productName);
  return {
    selection,
    executablePath,
    browser,
    engine: 'chromium',
    progId: association?.progId,
    fileVersion: association?.fileVersion,
    productName: association?.productName,
    signatureStatus: association?.signatureStatus,
    signer: association?.signer,
    compatibility:
      'Selected installed executable; actual launch is verified per session. Playwright does not guarantee custom Brave/Vivaldi/Opera compatibility.',
  };
}

export async function verifyBrowserLaunch(browser: Browser, backend: BrowserBackend) {
  const connection = await browser.newBrowserCDPSession();
  try {
    const version = await connection.send('Browser.getVersion'),
      command = await connection.send('Browser.getBrowserCommandLine'),
      args = command.arguments,
      actual = await realpath(args[0] ?? '');
    if (actual.toLowerCase() !== backend.executablePath.toLowerCase())
      throw new Error('Launched executable differs from selected default browser');
    const profile = args
      .find((a) => a.startsWith('--user-data-dir='))
      ?.slice('--user-data-dir='.length);
    if (!profile || !basename(profile).startsWith('playwright_chromiumdev_profile-'))
      throw new Error('Browser did not launch in a Playwright-owned ephemeral profile');
    if (
      !args.some((a) => a === '--headless' || a.startsWith('--headless=')) ||
      !args.includes('--remote-debugging-pipe')
    )
      throw new Error('Browser must be headless with private pipe control');
    const processInfo = await connection.send('SystemInfo.getProcessInfo');
    let gpu: unknown;
    try {
      const info = await connection.send('SystemInfo.getInfo');
      gpu = {
        devices: info.gpu.devices.map((d) => ({
          vendor: d.vendorString,
          device: d.deviceString,
        })),
        featureStatus: info.gpu.featureStatus,
      };
    } catch {
      gpu = { available: false };
    }
    return {
      ...backend,
      launchedExecutable: actual,
      version: browser.version(),
      protocolProduct: version.product,
      processId: processInfo.processInfo.find((p) => p.type === 'browser')?.id,
      headless: true,
      control: 'private-pipe',
      profile: { isolated: true, path: profile, temporary: true },
      gpu,
      globalGpuDisabled: args.includes('--disable-gpu'),
      personalProfileAccess: false,
      bundledBrowserFallback: false,
    };
  } finally {
    await connection.detach();
  }
}
export async function renderingReadiness(page: Page) {
  return page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
    const canvas = document.createElement('canvas');
    let webgl: { available: boolean; version?: string; renderer?: string } = {
      available: false,
    };
    try {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (gl) {
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        webgl = {
          available: true,
          version: String(gl.getParameter(gl.VERSION)),
          renderer: debug
            ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
            : String(gl.getParameter(gl.RENDERER)),
        };
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {}
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect(),
        style = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0.05
      );
    };
    const substantial = (el: Element) => {
      const r = el.getBoundingClientRect();
      return visible(el) && r.width * r.height > innerWidth * innerHeight * 0.2;
    };
    const loadingOverlay = [
      ...document.querySelectorAll(
        '[aria-busy=true],[role=progressbar],[class*=preloader],[id*=preloader],.loader,#loader',
      ),
    ]
      .slice(0, 40)
      .some(substantial);
    const consentOverlay = [
      ...document.querySelectorAll('[role=dialog],[aria-modal=true],[id*=cookie],[class*=cookie]'),
    ]
      .slice(0, 40)
      .some(
        (el) =>
          substantial(el) &&
          /cookie|consent|privacy choices/i.test((el.textContent ?? '').slice(0, 1500)),
      );
    const keyGate = [...document.querySelectorAll('input[type=password]')].some(visible);
    return {
      readyState: document.readyState,
      visualState: {
        loadingOverlay,
        consentOverlay,
        keyGate,
        bodyTextCharacters: (document.body?.innerText ?? '').length,
        meaning:
          'Visible overlay/password observations are heuristics, not evidence that a hidden scene was inspected. A clear frame still needs visual judgment.',
      },
      fonts: document.fonts.status,
      images: {
        total: document.images.length,
        loaded: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length,
        incomplete: [...document.images].filter((i) => !i.complete).length,
        visible: [...document.images].filter(
          (i) =>
            visible(i) &&
            i.getBoundingClientRect().top < innerHeight &&
            i.getBoundingClientRect().bottom > 0,
        ).length,
        visibleLoaded: [...document.images].filter(
          (i) =>
            visible(i) &&
            i.getBoundingClientRect().top < innerHeight &&
            i.getBoundingClientRect().bottom > 0 &&
            i.complete &&
            i.naturalWidth > 0,
        ).length,
      },
      canvasCount: document.querySelectorAll('canvas').length,
      webgl,
      limitations:
        'Font wait is bounded; lazy media, preloaders, remote assets and site-specific WebGL rendering still require visual inspection.',
    };
  });
}
