# Gera a locução do vídeo com a voz neural pt-BR do Windows (OneCore)
# e salva o tempo de cada palavra em audio/voz/tempos.json (para as legendas).
# Uso: powershell -File audio\tts.ps1 [-Voz Daniel|Maria] [-Velocidade 1.3] [-Tom 1.05]
param(
  [string]$Voz = 'Daniel',
  [double]$Velocidade = 1.3,
  [double]$Tom = 1.05
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, [Type]$tipo) {
  $task = $asTaskGeneric.MakeGenericMethod($tipo).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$synth.Voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
  Where-Object { $_.Language -eq 'pt-BR' -and $_.DisplayName -like "*$Voz*" } |
  Select-Object -First 1
$synth.Options.IncludeWordBoundaryMetadata = $true
$synth.Options.SpeakingRate = $Velocidade
$synth.Options.AudioPitch = $Tom

# Falas do roteiro (roteiro_e_guia_de_anima_o.md), divididas em frases.
# Ficam em falas.json (UTF-8): o PowerShell 5.1 lê .ps1 sem BOM como ANSI e estragaria os acentos.
$json = Get-Content (Join-Path $PSScriptRoot 'falas.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$falas = [ordered]@{}
$json.PSObject.Properties | ForEach-Object { $falas[$_.Name] = $_.Value }

$pasta = Join-Path $PSScriptRoot 'voz'
New-Item -ItemType Directory -Force $pasta | Out-Null
$tempos = [ordered]@{}

foreach ($id in $falas.Keys) {
  $texto = $falas[$id]
  $stream = Await ($synth.SynthesizeTextToStreamAsync($texto)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $tamanho = [uint32]$stream.Size
  Await ($reader.LoadAsync($tamanho)) ([uint32]) | Out-Null
  $bytes = New-Object byte[] $tamanho
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes((Join-Path $pasta "$id.wav"), $bytes)

  $palavras = @()
  foreach ($trilha in $stream.TimedMetadataTracks) {
    foreach ($cue in $trilha.Cues) {
      # A posição no texto original evita depender do texto do cue (acentos).
      $palavras += [ordered]@{
        pos    = [int]$cue.StartPositionInInput
        inicio = [math]::Round($cue.StartTime.TotalSeconds, 3)
      }
    }
  }
  $tempos[$id] = [ordered]@{ texto = $texto; palavras = $palavras }
  Write-Output ('{0}: {1} palavras' -f $id, $palavras.Count)
}

$tempos | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $pasta 'tempos.json')
