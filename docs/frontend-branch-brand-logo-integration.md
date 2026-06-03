# Branch brand and logo integration

## Backend status

Backend support is ready.

Repository: `kg_academy_back`

Relevant backend commits:

- `1b5d294` - added branch brand/logo fields
- `e942034` - added API tests for branch brand/logo

Available fields on branch API:

```ts
type Branch = {
  id: string;
  name: string;
  brandName?: string;
  logoUrl?: string | null;
  organizationName?: string;
  address?: string;
};
```

Endpoints:

```text
GET /api/v1/branches/
GET /api/v1/branches/{id}/
PATCH /api/v1/branches/{id}/
```

`PATCH` supports:

- JSON update for `brandName` / `brand_name`;
- `multipart/form-data` upload for `logo`.

Nested branch serializers also expose:

- `brandName`
- `logoUrl`

## Brand text

Use this priority:

```ts
const branchBrandName = selectedBranch?.brandName || selectedBranch?.name || fallbackName;
```

Recommended fallback names:

- receipts: existing `"Аутизм победим KG"`;
- certificates/docs: existing `"Academy KG"`;
- payslip: current default title, if any.

Do not hardcode a branch-specific name in print/PDF components.

## Logo

Use this priority:

```ts
const branchLogoUrl = selectedBranch?.logoUrl || null;
```

If `logoUrl` is missing, render the current text-only header.

## Important PDF/print note

Do not directly place remote `logoUrl` into generated PDF HTML without testing.

For browser-generated PDF/print, external images can fail because of CORS or canvas tainting.

Recommended safe approach:

1. Fetch `logoUrl`.
2. Convert the response blob to base64 data URL.
3. Pass base64 logo into the PDF/print generator.
4. Use the base64 string in `<img src="...">`.

Suggested helper:

```ts
async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
```

If production media is public and does not require cookies, `credentials: "include"` can be removed after testing.

## Frontend files to check

Brand text has already been partially connected in frontend commit `40b3cab`.

Still check all print/PDF entry points:

- `src/components/ui/PaymentReceipt.tsx`
- `src/pages/home/components/PaymentSidebar.tsx`
- `src/pages/home/components/AppointmentDetailsCard.tsx`
- `src/utility/pdfGenerator.ts`
- `src/utility/specialistPayslipPdf.ts`
- `src/pages/salary-reports/` components that call payslip PDF generation

## Receipt integration

For receipt data, pass:

```ts
orgName: selectedBranch?.brandName || selectedBranch?.name,
branchName: selectedBranch?.name,
logoDataUrl: convertedLogoDataUrl, // only after implementing safe conversion
```

If logo support is added to `PaymentReceipt`, keep it optional:

```ts
logoDataUrl?: string | null;
```

Receipt must still print correctly without a logo.

## Payslip integration

For specialist payslip PDF, pass:

```ts
clinicName: selectedBranch?.brandName || selectedBranch?.name,
logoDataUrl: convertedLogoDataUrl,
```

Keep both optional. Existing payslip generation must work if branch data is unavailable.

## Certificate / conclusion integration

For certificate or conclusion PDF data, pass:

```ts
clinicName: selectedBranch?.brandName || selectedBranch?.name,
logoDataUrl: convertedLogoDataUrl,
```

Fallback must preserve existing output when branch is not selected.

## Manual QA

Use a branch with:

- `brandName` set;
- `logo` uploaded.

Check:

1. Branch selector still persists after refresh.
2. Receipt uses branch brand name.
3. Receipt still works when logo is missing.
4. Receipt works with uploaded logo.
5. Specialist payslip uses branch brand name.
6. Specialist payslip works with uploaded logo.
7. Certificate/conclusion uses branch brand name.
8. PDF/print output is not blocked by CORS.
9. Console has no new image/CORS errors.
10. `npm run build` passes.

## Out of scope

Do not change backend for this integration.

Do not change payroll calculations.

Do not change receipt monetary calculations.

Do not make logo required.
