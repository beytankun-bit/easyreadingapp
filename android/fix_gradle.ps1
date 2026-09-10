# EASYREADING – HARD RESET GRADLE + FLUTTER (WINDOWS)
# Run from project root: powershell -ExecutionPolicy Bypass -File android/fix_gradle.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== EASYREADING | FULL CLEAN START ===" -ForegroundColor Cyan

# 1) Kill Gradle daemons
Write-Host "Stopping Gradle daemons..." -ForegroundColor Yellow
cd android
.\gradlew.bat --stop
cd ..

# 2) Delete local project build artifacts
Write-Host "Deleting project build folders..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\android\.gradle -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\android\app\build -ErrorAction SilentlyContinue

# 3) Delete GLOBAL Gradle cache (THIS IS THE KEY PART)
$gradleCache = "$env:USERPROFILE\.gradle\caches"
if (Test-Path $gradleCache) {
    Write-Host "Deleting GLOBAL Gradle cache: $gradleCache" -ForegroundColor Yellow
    try {
        Remove-Item -Recurse -Force $gradleCache -ErrorAction Stop
    } catch {
        Write-Host "Warning: Could not fully delete Gradle cache (some files may be locked or have long paths): $_" -ForegroundColor Yellow
        Write-Host "Continuing anyway..." -ForegroundColor Yellow
    }
}

# 4) Flutter clean & deps
Write-Host "Running flutter clean..." -ForegroundColor Yellow
flutter clean

Write-Host "Running flutter pub get..." -ForegroundColor Yellow
flutter pub get

# 5) Android clean
Write-Host "Running gradlew clean..." -ForegroundColor Yellow
cd android
.\gradlew.bat clean
cd ..

# 6) Build APK (single known output path)
Write-Host "Building RELEASE APK..." -ForegroundColor Yellow
flutter build apk --release --no-tree-shake-icons

# 7) Final check
$apkPath = "build\app\outputs\flutter-apk\app-release.apk"
if (Test-Path $apkPath) {
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "APK READY:" -ForegroundColor Green
    Write-Host $apkPath -ForegroundColor Green
} else {
    Write-Host "=== FAILED ===" -ForegroundColor Red
    Write-Host "APK NOT FOUND at expected location." -ForegroundColor Red
    exit 1
}

Write-Host "=== EASYREADING | DONE ===" -ForegroundColor Cyan

