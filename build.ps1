param(
    [switch]$Clean,
    [switch]$NoRun,
    [ValidateSet("Debug","Release","RelWithDebInfo")]
    [string]$Config = "Release",
    [string]$BuildDir = "build"
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

Write-Host "=== MP3IMGUI build script ===" -ForegroundColor Cyan
Write-Host "Config : $Config"
Write-Host "Build  : $BuildDir"
Write-Host "Root   : $root"

# --- tool checks -------------------------------------------------------------
foreach ($tool in @("cmake")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' not found on PATH."
    }
}
$cmakeVer = (cmake --version | Select-Object -First 1)
Write-Host "CMake  : $cmakeVer"

# --- clean (always, so changes are never stale) ------------------------------
if (Test-Path $BuildDir) {
    Write-Host "Cleaning $BuildDir..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BuildDir
}

# --- configure ---------------------------------------------------------------
$needsConfig = -not (Test-Path (Join-Path $BuildDir "CMakeCache.txt"))
if ($needsConfig) {
    Write-Host "`nConfiguring..." -ForegroundColor Cyan
    cmake -S . -B $BuildDir -DCMAKE_BUILD_TYPE=$Config
    if ($LASTEXITCODE -ne 0) { throw "CMake configure failed." }
} else {
    Write-Host "`nAlready configured (use -Clean to reconfigure)."
}

# --- build -------------------------------------------------------------------
$cores = [Environment]::ProcessorCount
Write-Host "`nBuilding with $cores cores..." -ForegroundColor Cyan
cmake --build $BuildDir --config $Config --parallel $cores
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

$exe = Join-Path $BuildDir "MP3IMGUI"
if (-not (Test-Path $exe)) {
    # multi-config generators put it under <config>/
    $exe2 = Join-Path (Join-Path $BuildDir $Config) "MP3IMGUI"
    if (Test-Path $exe2) { $exe = $exe2 }
}
if (-not (Test-Path $exe)) {
    throw "Build succeeded but executable not found."
}
Write-Host "`nBuild successful!" -ForegroundColor Green
Write-Host "Executable: $exe" -ForegroundColor Gray

# --- run ---------------------------------------------------------------------
if (-not $NoRun) {
    Write-Host "`nLaunching MP3IMGUI..." -ForegroundColor Cyan
    $env:GDK_BACKEND = "x11"
    & $exe
    $rc = $LASTEXITCODE
    Write-Host "`nMP3IMGUI exited with code $rc" -ForegroundColor Gray
    exit $rc
} else {
    Write-Host "`nSkipping run (-NoRun)."
}
