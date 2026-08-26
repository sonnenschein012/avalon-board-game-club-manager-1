[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $projectRoot '.demo-runtime'
$installPath = Join-Path $runtimeRoot 'java-21'
$downloadUri = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'

function Get-JavaVersionInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$JavaExecutable
    )

    if (-not (Test-Path -LiteralPath $JavaExecutable -PathType Leaf)) {
        return $null
    }

    try {
        $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $JavaExecutable
        $startInfo.Arguments = '-version'
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true

        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo = $startInfo
        [void]$process.Start()
        $standardOutput = $process.StandardOutput.ReadToEnd()
        $standardError = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        if ($process.ExitCode -ne 0) {
            return $null
        }

        $versionOutput = "$standardOutput`n$standardError"
        if ($versionOutput -notmatch 'version\s+"(?:1\.)?(?<Major>\d+)') {
            return $null
        }

        return [pscustomobject]@{
            Major = [int]$Matches.Major
            Text = $versionOutput.Trim()
        }
    }
    catch {
        return $null
    }
}

$installedJava = Join-Path $installPath 'bin\java.exe'
$installedVersion = Get-JavaVersionInfo -JavaExecutable $installedJava

if ($null -ne $installedVersion -and $installedVersion.Major -ge 21) {
    Write-Host "Java $($installedVersion.Major) is already installed at $installPath"
    exit 0
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

$operationId = [Guid]::NewGuid().ToString('N')
$temporaryRoot = Join-Path $runtimeRoot ".java-21-install-$operationId"
$archivePath = Join-Path $temporaryRoot 'temurin-java-21.zip'
$extractPath = Join-Path $temporaryRoot 'extracted'
$backupPath = $null

try {
    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

    Write-Host 'Downloading Eclipse Temurin Java 21 x64 JRE from Adoptium...'
    Invoke-WebRequest -Uri $downloadUri -OutFile $archivePath -UseBasicParsing

    Write-Host 'Extracting and validating the downloaded Java runtime...'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath

    $candidateJava = Get-ChildItem -LiteralPath $extractPath -Filter 'java.exe' -File -Recurse |
        Where-Object { $_.Directory.Name -eq 'bin' } |
        Select-Object -First 1

    if ($null -eq $candidateJava) {
        throw 'The downloaded archive does not contain bin\java.exe.'
    }

    $candidateHome = Split-Path -Parent (Split-Path -Parent $candidateJava.FullName)
    $candidateVersion = Get-JavaVersionInfo -JavaExecutable $candidateJava.FullName

    if ($null -eq $candidateVersion -or $candidateVersion.Major -lt 21) {
        throw 'The downloaded runtime did not pass the Java 21+ version check.'
    }

    if (Test-Path -LiteralPath $installPath) {
        $backupName = "java-21.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$($operationId.Substring(0, 8))"
        $backupPath = Join-Path $runtimeRoot $backupName
        Write-Warning "The existing Java runtime is invalid. It will be preserved at $backupPath"
        Move-Item -LiteralPath $installPath -Destination $backupPath
    }

    try {
        Move-Item -LiteralPath $candidateHome -Destination $installPath

        $finalJava = Join-Path $installPath 'bin\java.exe'
        $finalVersion = Get-JavaVersionInfo -JavaExecutable $finalJava
        if ($null -eq $finalVersion -or $finalVersion.Major -lt 21) {
            throw 'The installed runtime failed the final Java 21+ version check.'
        }
    }
    catch {
        if (Test-Path -LiteralPath $installPath) {
            $failedPath = Join-Path $runtimeRoot "java-21.failed-$operationId"
            Move-Item -LiteralPath $installPath -Destination $failedPath
            Write-Warning "The failed installation was preserved at $failedPath"
        }

        if ($null -ne $backupPath -and (Test-Path -LiteralPath $backupPath)) {
            Move-Item -LiteralPath $backupPath -Destination $installPath
            Write-Warning 'The previous Java runtime was restored.'
        }

        throw
    }

    Write-Host "Java $($finalVersion.Major) installed successfully at $installPath"
    if ($null -ne $backupPath) {
        Write-Host "Previous runtime backup: $backupPath"
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        $resolvedRuntimeRoot = [System.IO.Path]::GetFullPath($runtimeRoot).TrimEnd('\')
        $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
        if (-not $resolvedTemporaryRoot.StartsWith("$resolvedRuntimeRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to clean an unexpected temporary path: $resolvedTemporaryRoot"
        }

        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
    }
}
