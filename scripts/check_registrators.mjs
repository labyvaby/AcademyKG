const api = 'https://npjnvnrnvxqhldpcclot.supabase.co';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wam52bnJudnhxaGxkcGNjbG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODQwODQsImV4cCI6MjA3OTA2MDA4NH0.Q-1zQt3Be15l-o8PSCOAGkHB79P7lCgJMyWbmbx1VFc';
const headers = { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json' };

async function fetchJSON(url) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} - ${await r.text()}`);
    return r.json();
}

async function main() {
    // 1. Роли
    const roles = await fetchJSON(`${api}/rest/v1/roles?select=id,name`);
    const roleMap = {};
    roles.forEach(r => roleMap[r.id] = r.name);

    // 2. Активные сотрудники
    const employees = await fetchJSON(`${api}/rest/v1/Employees?select=id,full_name,salary_rules,role_id&status=eq.active`);

    const registrators = employees.filter(e => {
        const rn = roleMap[e.role_id];
        return rn === 'registrator' || rn === 'receptionist';
    });

    console.log('=== РЕГИСТРАТОРЫ (salary_rules) ===');
    registrators.forEach(emp => {
        console.log(`\n--- ${emp.full_name} (${roleMap[emp.role_id]}) ---`);
        console.log(JSON.stringify(emp.salary_rules, null, 2));
    });

    // 3. Приёмы за март 2026 (оплаченные)
    const paidStatuses = ['Оплачено', 'Частично оплачено', 'Со скидкой', 'Бесплатно', 'Завершено'];
    const statusFilter = paidStatuses.map(s => encodeURIComponent(s)).join(',');
    const appts = await fetchJSON(
        `${api}/rest/v1/AppointmentsAggregated?select=id,is_night,status,appointment_at` +
        `&appointment_at=gte.2026-03-01T00:00:00` +
        `&appointment_at=lt.2026-04-01T00:00:00` +
        `&status=in.(${statusFilter})`
    );

    const dayAppts = appts.filter(a => !a.is_night).length;
    const nightAppts = appts.filter(a => a.is_night).length;
    console.log('\n=== ПРИЁМЫ МАРТ 2026 (оплаченные) ===');
    console.log(`Всего: ${appts.length}`);
    console.log(`Дневных: ${dayAppts}`);
    console.log(`Ночных: ${nightAppts}`);

    // 4. Смены регистраторов за март 2026
    console.log('\n=== СМЕНЫ РЕГИСТРАТОРОВ МАРТ 2026 ===');
    for (const emp of registrators) {
        const shifts = await fetchJSON(
            `${api}/rest/v1/WorkShifts?select=clock_in,clock_out,is_night_shift` +
            `&employee_id=eq.${emp.id}` +
            `&clock_in=gte.2026-03-01T00:00:00` +
            `&clock_in=lt.2026-04-01T00:00:00`
        );
        let dayHours = 0, nightHours = 0;
        for (const s of shifts) {
            if (!s.clock_in || !s.clock_out) continue;
            const start = new Date(s.clock_in);
            const end = new Date(s.clock_out);
            const totalH = (end - start) / 3600000;
            if (totalH > 0) {
                // Простой подсчёт
                nightHours += s.is_night_shift ? totalH : 0;
                dayHours += !s.is_night_shift ? totalH : 0;
            }
        }
        console.log(`${emp.full_name}: ${shifts.length} смен, ~${dayHours.toFixed(1)}ч дневных, ~${nightHours.toFixed(1)}ч ночных`);
        if (shifts.length > 0) {
            console.log('  Смены:', shifts.map(s => `${s.clock_in?.slice(0, 10)} -> ${s.clock_out?.slice(0, 16)}`).join(', '));
        }
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
