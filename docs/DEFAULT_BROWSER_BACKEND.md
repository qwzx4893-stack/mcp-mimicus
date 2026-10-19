# Installed default browser backend

Mimicus resolves the **current Windows HTTPS default** before opening each new reference session. It launches that installed Chromium browser headlessly. It never downloads a browser, guesses another installed browser, connects to the personal browser, or changes Windows defaults.

## Resolution and identity

`src/browser/backend.ts` invokes a fixed, hidden, non-interactive Windows PowerShell script. The script calls the Windows `AssocQueryStringW` API with `ASSOCF_IS_PROTOCOL` and `ASSOCSTR_EXECUTABLE` for `https`, and reads the current user's HTTPS `UserChoice` ProgID and merged `HKEY_CLASSES_ROOT` command registration. Per-user Windows association selection therefore takes precedence; the old StartMenuInternet default is not used.

Only a literal, absolute executable path is considered. Registry arguments are never executed or forwarded. The API path and the registered command's executable must agree after canonicalization. Files must exist and be regular Windows `.exe` files with an executable header. Windows product/file-version metadata and Authenticode signature status/publisher are reported. An ambiguous registration fails explicitly.

The association helper itself also receives a fresh owned temporary HOME/USERPROFILE/AppData/TEMP envelope, which is removed in `finally`, including failures. This matters because even a plain Windows PowerShell `-NoProfile` startup was observed to create empty `AppData/Roaming` directories in an isolated HOME. The negative persistence test retains a strict empty-directory assertion after both SDK process lifetimes; it does not ignore an AppData tree or exempt arbitrary software/site files. Optional Authenticode module failure is reported as unavailable and cannot prevent default-browser resolution; helper errors omit encoded commands and CLIXML.

After launch, CDP reports the actual executable command line, browser process ID and Chromium protocol/version. Mimicus checks that the launched executable matches the resolved file, control uses a private pipe, headless mode is enabled, and the user-data directory is Playwright-owned and ephemeral. The diagnostics distinguish `windows-default` from `explicit-override`. A Chromium protocol product such as `Chrome/155...` does not imply that Chrome was selected: Brave exposes the same Chromium protocol. The actual executable and Windows product metadata identify Brave.

## Isolation and cleanup

Each bounded reference session owns one headless browser process, a fresh temporary profile, an isolated context and a guarded loopback proxy. This implementation favors clear ownership and independent failures over sharing a browser process. Cookies and storage are isolated between sessions. It never reads a personal profile or attaches to an existing debugging endpoint. All page traffic retains the existing origin, public-IP/DNS pinning, robots, GET/HEAD, redirect, cumulative byte/request, download and WebSocket controls.

The browser process also receives a separately owned temporary HOME with existing `AppData/Local`, `AppData/Roaming` and TEMP directories. Windows native known-folder lookup must succeed for Edge's non-default-profile safety check. A nonexistent isolated HOME caused installed Edge to reject DevTools despite the correct temporary `--user-data-dir`; the initialized envelope fixes that environment failure without disabling the check, using the personal home or changing a browser policy. Both the browser profile and this envelope are removed on close.

Success, explicit close, cancellation, timeout, browser disconnection and application shutdown release the owned context/process/profile/proxy and temporary analysis. Browser crashes trigger session cleanup. Teardown uses owned Playwright handles; it never kills processes by browser name. Temporary browser profile/cache bytes exist during a session and are deleted on close; there is no persistent website catalog or saved screenshot archive.

## Browser support and explicit alternatives

The current Windows default is re-resolved for every new session; an already open session keeps its original binary. The release was tested against **Brave Browser file version 155.1.97.59, Chromium 155.0.8059.85, Windows**. Installed **Edge file version 155.0.4283.62** is additionally exercised as an explicit override, which is the CI configuration. Final suite outcomes for both are recorded in [quality verification](QUALITY_AND_SECURITY_TEST_RESULTS.md). Actual command-line identity, parallel isolated profiles/cookies, process exit, profile deletion, screenshots, touch, drag, mobile resizing, temporal sampling, cancellation, crash and timeout cleanup are covered.

Chrome and Edge are recognized, as are installed Brave, Vivaldi and Opera binaries. Chrome/Edge channels are not guessed: the exact registered executable is used so an unusual per-user installation or channel remains the selected default. Chrome, Vivaldi and Opera have not been tested locally. Playwright explicitly warns that custom executables are not guaranteed compatible; resolution alone is not a rendering acceptance test.

Stock installed Firefox is not compatible with Playwright's patched Firefox controller. It fails with a specific message. Unsupported platforms also fail default resolution explicitly. On those systems, or to opt into an alternative installed Chromium browser, set `MIMICUS_BROWSER_EXECUTABLE` to an absolute compatible executable path. This explicit override is always reported. There is no bundled Chromium fallback and no automatic browser installation. Tests on other platforms must supply that explicit installed executable; they must not silently use Playwright's cache.

## Fidelity and diagnostics

The real Brave test exposed **NVIDIA GeForce RTX 4060 Laptop GPU**, WebGL 2 through ANGLE/D3D11, GPU compositing, canvas, rasterization and WebGL enabled. Mimicus does not pass `--disable-gpu`. GPU status is a capability observation, not proof that every Three.js scene renders correctly. Diagnostics report GPU devices/features and the page's WebGL renderer, fonts, image loading, canvas count and readiness state. Captures refresh bounded readiness measurements. A site preloader, rejected CDN origin, lazy media or inaccessible resource may still require explicit waiting, scrolling, resource-origin approval and visual inspection.

`mimicus doctor` performs read-only resolution and local model integrity checks. Its source list is explicitly configuration, not claimed live connectivity. `mimicus self-test` actually launches the selected installed browser against an owned local visual fixture, verifies JPEG capture, safe menu interaction, mobile resize and cleanup, and prints the actual browser/GPU identity. Neither command creates a website index or retrieves gallery content.

Progressive page exploration accepts `offset`, `limit` and `visibleOnly`, returns current semantic regions with selectors, viewport/document positions and `hasMore`/`nextOffset`, and explicitly reports the bounded 1,200-node scan. Lazy DOM content appears after the agent explicitly scrolls or waits. Safe touch uses a real touch tap with the same non-destructive control review as click. Drag uses bounded, hit-tested, non-form visual endpoints and always releases the pointer. These controls do not grant arbitrary script execution or form submission.

## Primary references

- [Windows AssocQueryStringW](https://learn.microsoft.com/en-us/windows/win32/api/shlwapi/nf-shlwapi-assocquerystringw)
- [Windows ASSOCSTR values](https://learn.microsoft.com/en-us/windows/win32/api/shlwapi/ne-shlwapi-assocstr)
- [Windows Default Programs](https://learn.microsoft.com/en-us/windows/win32/shell/default-programs), including its warning that parts of that older documentation do not describe Windows 10 defaults; the live HTTPS association API is used here.
- [Playwright BrowserType.launch](https://playwright.dev/docs/api/class-browsertype#browser-type-launch), custom executable compatibility warning, sandbox and headless launch options.
- [Playwright browsers](https://playwright.dev/docs/browsers), supported branded channels and the requirement for a patched Firefox build.
