$api = 'https://npjnvnrnvxqhldpcclot.supabase.co'
$apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wam52bnJudnhxaGxkcGNjbG90Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3NjM0ODQwODQsImV4cCI6MjA3OTA2MDA4NH0.Q-1zQt3Be15l-o8PSCOAGkHB79P7lCgJMyWbmbx1VFc'
$headers = @{
    apikey        = $apikey
    Authorization = "Bearer $apikey"
    'Content-Type' = 'application/json'
}

# 1. Получить всех активных сотрудников
$empUrl = $api + '/rest/v1/Employees?select=id,full_name,salary_rules,role_id&status=eq.active'
$empResp = Invoke-WebRequest -UseBasicParsing -Uri $empUrl -Headers $headers
$employees = $empResp.Content | ConvertFrom-Json

# 2. Получить роли
$rolesUrl = $api + '/rest/v1/roles?select=id,name'
$rolesResp = Invoke-WebRequest -UseBasicParsing -Uri $rolesUrl -Headers $headers
$roles = $rolesResp.Content | ConvertFrom-Json
$roleMap = @{}
foreach ($role in $roles) { $roleMap[$role.id] = $role.name }

Write-Host '=== РЕГИСТРАТОРЫ (salary_rules) ==='
foreach ($emp in $employees) {
    $roleName = $roleMap[$emp.role_id]
    if ($roleName -eq 'registrator' -or $roleName -eq 'receptionist') {
        Write-Host "--- $($emp.full_name) ($roleName) ---"
        $emp.salary_rules | ConvertTo-Json -Depth 5
        Write-Host ''
    }
}

# 3. Приёмы за март 2026 (оплаченные)
Write-Host '=== ПРИЁМЫ МАРТ 2026 (оплаченные) ==='
$apptUrl = $api + '/rest/v1/AppointmentsAggregated?select=id,is_night,status&appointment_at=gte.2026-03-01T00:00:00&appointment_at=lt.2026-04-01T00:00:00&status=in.(Оплачено,Частично оплачено,Со скидкой,Бесплатно,Завершено)'
$apptResp = Invoke-WebRequest -UseBasicParsing -Uri $apptUrl -Headers $headers
$appts = $apptResp.Content | ConvertFrom-Json

$day = ($appts | Where-Object { $_.is_night -eq $false }).Count
$night = ($appts | Where-Object { $_.is_night -eq $true }).Count
Write-Host "Всего оплаченных: $($appts.Count)"
Write-Host "Дневных: $day"
Write-Host "Ночных: $night"

# 4. WorkShifts регистраторов за март 2026
Write-Host ''
Write-Host '=== СМЕНЫ РЕГИСТРАТОРОВ МАРТ 2026 ==='
$regIds = ($employees | Where-Object { $roleMap[$_.role_id] -eq 'registrator' -or $roleMap[$_.role_id] -eq 'receptionist' }).id
foreach ($regId in $regIds) {
    $emp = $employees | Where-Object { $_.id -eq $regId }
    $shiftsUrl = $api + "/rest/v1/WorkShifts?select=clock_in,clock_out,is_night_shift&employee_id=eq.$regId&clock_in=gte.2026-03-01T00:00:00&clock_in=lt.2026-04-01T00:00:00"
    $shiftsResp = Invoke-WebRequest -UseBasicParsing -Uri $shiftsUrl -Headers $headers
    $shifts = $shiftsResp.Content | ConvertFrom-Json
    Write-Host "$($emp.full_name): $($shifts.Count) смен"
}
