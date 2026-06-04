# Specialist payslip: fixed appointment earnings

## Status

Backend fix is complete:

- commit: `f0695d7`
- message: `fix: include fixed appointment earnings in payslip slots`
- repository: `kg_academy_back`

Frontend code changes are not required.

## What changed on backend

Endpoint:

```text
GET /api/v1/reports/specialist-payslip/
```

The response shape stayed the same. Only numeric values changed for fixed-per-appointment specialists.

Before:

- `days[].slots[].earned` only included dynamic service-rule earnings.
- Specialists with only fixed appointment rate had `earned = 0` in daily slots.
- Their monthly `summary.grossEarnings` could be correct, but daily details looked empty.

After:

- `days[].slots[].earned` now includes:
  - dynamic service earnings;
  - fixed appointment earnings.
- Fixed appointment earnings are counted once per appointment for the specialist.
- Partial payments are respected through the same `payment_factor`.

## Formula

```text
slot.earned = dynamic_service_earning + fixed_appointment_earning
```

Where:

```text
dynamic_service_earning = service_row_price * payment_factor * percent
fixed_appointment_earning = fixed_per_appointment * payment_factor
```

If one appointment has multiple service rows for the same specialist, fixed appointment earning is added only once.

If one slot has multiple different appointments, fixed appointment earning is added once for each appointment.

## API fields

Changed values:

- `days[].slots[].earned`
- `days[].totals.sumEarned`

Unchanged structure and field names:

- `summary.*`
- `days[].slots[].sum`
- `days[].slots[].time`
- `days[].slots[].patientName`
- `days[].slots[].lessonType`
- `days[].totals.count`
- `days[].totals.sumTotal`
- `appointments[].earnedAmount`

## Frontend impact

No frontend implementation change is needed.

If the UI already displays `slot.earned`, it will automatically show correct non-zero earnings for fixed-per-appointment specialists after backend deploy.

Do not add frontend-side recalculation for this. Backend is the source of truth for payslip calculations.

## Manual QA

Check after backend deploy:

1. Open salary report.
2. Select a branch with a fixed-per-appointment specialist.
3. Open that specialist's payslip.
4. Check a day/slot with paid appointments.
5. Confirm:
   - `earned` is not zero;
   - partial payment reduces `earned`;
   - two services in one appointment do not double fixed earning;
   - monthly summary still matches total earnings.

## Notes

`periodHalf` behavior was not changed:

- `periodHalf=first` returns days 1-15.
- `periodHalf=second` returns days 16-end of month.
- no `periodHalf` returns the full month.
