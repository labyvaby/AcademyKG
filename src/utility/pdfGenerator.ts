import html2pdf from "html2pdf.js";

export type ConclusionPDFData = {
  patientFio: string;
  patientDob: string;
  appointmentDate: string;
  height: string;
  weight: string;
  temperature: string;
  complaints: string;
  doctorComplaints?: string;
  diagnosis: string;
  anamnesis: string;
  objective: string;
  recommendations: string;
  doctorFio: string;
};

export type CertificatePDFData = {
  patientFio: string;
  patientDob: string;
  conclusion: string;
  doctorFio: string;
  issueDate: string;
};

export const generateConclusionPDF = async (data: ConclusionPDFData): Promise<Blob> => {
  const {
    patientFio,
    patientDob,
    appointmentDate,
    height,
    weight,
    temperature,
    complaints,
    doctorComplaints,
    diagnosis,
    anamnesis,
    objective,
    recommendations,
    doctorFio,
  } = data;

  // Выводим рекомендации как есть, без изменения текста
  const recommendationsHtml = typeof recommendations === "string" && recommendations.trim()
    ? recommendations
        .split("\n")
        .filter((r) => r.trim())
        .map((r) => `<div>${r}</div>`)
        .join("")
    : "—";

  const container = document.createElement("div");

  // Очищаем значения от прочерков для корректного отображения единиц измерения
  const heightDisplay = height && height !== "—" ? height : "";
  const weightDisplay = weight && weight !== "—" ? weight : "";
  const tempDisplay = temperature && temperature !== "—" ? temperature : "";

  container.innerHTML = `
    <div
      style="
        width: 190mm;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.1;
        color: #000;
        padding: 50mm 15mm 20mm 10mm;
      "
    >
      <div style="margin-bottom: 1.5mm;"><b>ФИО клиента:</b> ${patientFio}</div>
      <div style="margin-bottom: 1.5mm;"><b>Дата рождения:</b> ${patientDob}</div>
      <div style="margin-bottom: 5mm;"><b>Дата и время приема:</b> ${appointmentDate}</div>

      <div style="margin-bottom: 5mm; display: flex;">
        <div style="width: 45mm;"><b>Рост:</b> ${heightDisplay ? `${heightDisplay} см` : ""}</div>
        <div style="width: 45mm;"><b>Вес:</b> ${weightDisplay ? `${weightDisplay} кг` : ""}</div>
        <div><b>Температура:</b> ${tempDisplay ? `${tempDisplay} C°` : ""}</div>
      </div>

      <div style="margin-bottom: 2mm;"><b>Жалобы:</b> ${doctorComplaints || complaints || "—"}</div>

      <div style="margin-top: 4mm; margin-bottom: 2mm;"><b>Диагноз:</b> ${diagnosis || "—"}</div>

      <div style="margin-top: 4mm; margin-bottom: 2mm;"><b>Анамнез:</b> ${anamnesis || "—"}</div>

      <div style="margin-top: 4mm; margin-bottom: 2mm;"><b>Объективно:</b> ${objective || "—"}</div>

      <div style="margin-top: 4mm; margin-bottom: 2mm;">
        <b>Рекомендации:</b>
        <div style="margin-top: 1.5mm;">${recommendationsHtml}</div>
      </div>

      <div style="margin-top: 8mm; display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;"><b>Специалист:</b> ${doctorFio}</div>
        <div style="width: 70mm;">
          <div style="display: flex; justify-content: space-between;">
            <b>Подпись:</b>
            <span></span>
          </div>
          <div style="text-align: right; margin-top: 5mm; font-size: 10pt;">место для печати</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const pdfBlob = await html2pdf()
      .set({
        margin: [0, 0, 0, 0], // Отступы уже заданы в контейнере padding-ом
        filename: `conclusion_${patientFio.replace(/\s+/g, '_')}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .output("blob");

    return pdfBlob as Blob;
  } finally {
    document.body.removeChild(container);
  }
};

export const generateCertificatePDF = async (data: CertificatePDFData): Promise<Blob> => {
  const {
    patientFio,
    patientDob,
    conclusion,
    doctorFio,
    issueDate,
  } = data;

  const container = document.createElement("div");

  container.innerHTML = `
    <div
      style="
        width: 190mm;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        font-size: 14pt;
        line-height: 1.5;
        color: #000;
        padding: 40mm 15mm 20mm 15mm;
        position: relative;
        overflow: hidden;
      "
    >
      <!-- Watermark -->
      <div 
        style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120pt;
          font-weight: bold;
          color: rgba(0, 0, 0, 0.05);
          white-space: nowrap;
          z-index: -1;
          pointer-events: none;
        "
      >
        СПРАВКА
      </div>

      <div style="text-align: center; margin-bottom: 2mm;">
        <h1 style="margin: 0; font-size: 24pt; font-weight: bold; text-transform: uppercase;">Медицинская справка</h1>
        <p style="margin: 0; font-size: 12pt;">(профессионально-консультативное заключение специалиста)</p>
      </div>

      <div style="margin-top: 15mm; margin-bottom: 8mm;">
        <div style="margin-bottom: 3mm;">
          Ф.И.О. <span style="display: inline-block; border-bottom: 1px solid #000; min-width: 100mm;">${patientFio}</span>
        </div>
        <div>
          Дата рождения: <span style="display: inline-block; border-bottom: 1px solid #000; min-width: 50mm;">${patientDob}</span>
        </div>
      </div>

      <div style="margin-bottom: 10mm; font-size: 13pt;">
        В том, что ребенок был на амбулаторном лечении<br/>
        в «Academy KG»
      </div>

      <div style="margin-bottom: 5mm;">
        <b>Заключение:</b>
      </div>
      
      <div style="min-height: 20mm; line-height: 1.8; margin-bottom: 5mm;">
        <div style="border-bottom: 1px solid #000; min-height: 8mm;">${conclusion || ""}</div>
      </div>

      <div style="margin-top: 10mm; display: flex; flex-direction: column; gap: 2mm;">
        <div><b>Дата выдачи:</b> ${issueDate}</div>
        <div><b>Специалист:</b> ${doctorFio}</div>
      </div>

      <div style="margin-top: 15mm; display: flex; justify-content: flex-end; align-items: flex-start;">
        <div style="width: 50mm; text-align: center;">
          <div style="border-bottom: 1px solid #000; height: 10mm;"></div>
          <div style="font-size: 9pt; color: #666; margin-top: 1mm;">(подпись)</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const pdfBlob = await html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename: `certificate_${patientFio.replace(/\s+/g, '_')}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .output("blob");

    return pdfBlob as Blob;
  } finally {
    document.body.removeChild(container);
  }
};
