Param()

$ErrorActionPreference = 'Stop'

# Supabase REST endpoint and anon key (taken from .env.local)
$api = 'https://npjnvnrnvxqhldpcclot.supabase.co'
$apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wam52bnJudnhxaGxkcGNjbG90Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3NjM0ODQwODQsImV4cCI6MjA3OTA2MDA4NH0.Q-1zQt3Be15l-o8PSCOAGkHB79P7lCgJMyWbmbx1VFc'

$headers = @{
  apikey        = $apikey
  Authorization = "Bearer $apikey"
  'Content-Type' = 'application/json'
  Prefer        = 'return=representation'
}

# Random name to avoid collisions
$name = 'Cline_CRUD_Test_{0}' -f ([guid]::NewGuid().ToString('N').Substring(0,8))
Write-Host ("Name={0}" -f $name)

function Show-Status([string]$label, $resp) {
  try {
    $code = [int]$resp.StatusCode
  } catch {
    $code = -1
  }
  Write-Host ("{0}: {1}" -f $label, $code)
}

# 1) SELECT from view (EmployeesView)
$r1 = Invoke-WebRequest -UseBasicParsing -Uri "$api/rest/v1/EmployeesView?select=id,full_name&limit=1" -Headers $headers -Method GET
Show-Status 'VIEW(EmployeesView)' $r1

# 2) INSERT into base table (employees)
$body = @{ full_name = $name; phone = '+996555123456'; role = $null } | ConvertTo-Json -Compress
$r2 = Invoke-WebRequest -UseBasicParsing -Uri "$api/rest/v1/employees" -Headers $headers -Method POST -Body $body
Show-Status 'POST(employees)' $r2

# 3) SELECT inserted row by name
$r3 = Invoke-WebRequest -UseBasicParsing -Uri "$api/rest/v1/employees?select=id,full_name,phone,role&full_name=eq.$name" -Headers $headers -Method GET
Show-Status 'GET(employees by name)' $r3

# 4) UPDATE row by name
$body2 = @{ phone = '+996700000000' } | ConvertTo-Json -Compress
$r4 = Invoke-WebRequest -UseBasicParsing -Uri "$api/rest/v1/employees?full_name=eq.$name" -Headers $headers -Method PATCH -Body $body2
Show-Status 'PATCH(employees by name)' $r4

# 5) DELETE row by name
$r5 = Invoke-WebRequest -UseBasicParsing -Uri "$api/rest/v1/employees?full_name=eq.$name" -Headers $headers -Method DELETE
Show-Status 'DELETE(employees by name)' $r5

# Optional: print small body summaries for debug (won't crash if empty)
if ($r2.Content) { Write-Host ('POST body: ' + $r2.Content.Substring(0, [Math]::Min(200, $r2.Content.Length))) }
if ($r3.Content) { Write-Host ('GET body: '  + $r3.Content.Substring(0, [Math]::Min(200, $r3.Content.Length))) }
if ($r4.Content) { Write-Host ('PATCH body:' + $r4.Content.Substring(0, [Math]::Min(200, $r4.Content.Length))) }
