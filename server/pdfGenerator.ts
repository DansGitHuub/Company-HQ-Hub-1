import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

export async function uploadPdfToStorage(pdfBuffer: Buffer, objectPath: string): Promise<void> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const fullPath = `${privateDir}/${objectPath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(pdfBuffer, { contentType: "application/pdf" });
}

const FORM_TITLES: Record<string, string> = {
  w4: "Form W-4 - Employee's Withholding Certificate",
  i9: "Form I-9 - Employment Eligibility Verification",
  ohio_it4: "Form IT-4 - Ohio Employee's Withholding Exemption Certificate",
  direct_deposit: "Direct Deposit Authorization",
  handbook_acknowledgment: "Employee Handbook Acknowledgment",
  emergency_contact: "Emergency Contact Information",
  background_check_auth: "Background Check Authorization",
  workers_comp_first_report: "Workers' Compensation - First Report of Injury",
  osha_incident: "OSHA Form 301 - Injury and Illness Incident Report",
  nda: "Non-Disclosure Agreement",
  employment_application: "Employment Application",
};

export async function generateFormPdf(
  formType: string,
  submissionData: Record<string, any>,
  employeeName: string,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const labelSize = 9;
  const titleSize = 14;
  const margin = 50;

  let page = pdfDoc.addPage([612, 792]);
  let y = 742;

  const addNewPageIfNeeded = () => {
    if (y < 80) {
      page = pdfDoc.addPage([612, 792]);
      y = 742;
    }
  };

  page.drawText("Chapin Landscapes", {
    x: margin,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.118, 0.227, 0.184),
  });
  y -= 25;

  const title = FORM_TITLES[formType] || formType;
  page.drawText(title, {
    x: margin,
    y,
    size: titleSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page.drawText(`Employee: ${employeeName}`, {
    x: margin,
    y,
    size: fontSize,
    font,
  });
  y -= 14;

  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: margin,
    y,
    size: fontSize,
    font,
  });
  y -= 20;

  page.drawLine({
    start: { x: margin, y },
    end: { x: 562, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  const drawField = (label: string, value: any) => {
    addNewPageIfNeeded();
    if (value === undefined || value === null || value === "") return;

    const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") :
                         typeof value === "object" ? JSON.stringify(value, null, 2) :
                         String(value);

    page.drawText(label + ":", {
      x: margin,
      y,
      size: labelSize,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 14;

    const lines = displayValue.split("\n");
    for (const line of lines) {
      addNewPageIfNeeded();
      const trimmed = line.substring(0, 80);
      page.drawText(trimmed, {
        x: margin + 10,
        y,
        size: fontSize,
        font,
      });
      y -= 14;
    }
    y -= 6;
  };

  const flattenAndDraw = (data: Record<string, any>, prefix = "") => {
    for (const [key, value] of Object.entries(data)) {
      if (key === "signatureDataUrl" || key === "companySignatureDataUrl" || key === "supervisorSignatureDataUrl") {
        continue;
      }
      const label = prefix ? `${prefix} - ${formatLabel(key)}` : formatLabel(key);

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === "object" && value[i] !== null) {
            addNewPageIfNeeded();
            page.drawText(`${label} #${i + 1}`, {
              x: margin,
              y,
              size: labelSize,
              font: boldFont,
              color: rgb(0.2, 0.2, 0.6),
            });
            y -= 16;
            flattenAndDraw(value[i], `${label} #${i + 1}`);
          } else {
            drawField(`${label} #${i + 1}`, value[i]);
          }
        }
      } else if (typeof value === "object" && value !== null) {
        addNewPageIfNeeded();
        page.drawText(label, {
          x: margin,
          y,
          size: labelSize + 1,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.6),
        });
        y -= 16;
        flattenAndDraw(value, label);
      } else {
        drawField(label, value);
      }
    }
  };

  flattenAndDraw(submissionData);

  const signatureKeys = ["signatureDataUrl", "companySignatureDataUrl", "supervisorSignatureDataUrl"];
  for (const key of signatureKeys) {
    if (submissionData[key] && typeof submissionData[key] === "string" && submissionData[key].startsWith("data:image")) {
      try {
        addNewPageIfNeeded();
        y -= 10;
        const sigLabel = key === "companySignatureDataUrl" ? "Company Representative Signature" :
                         key === "supervisorSignatureDataUrl" ? "Supervisor Signature" : "Employee Signature";

        page.drawText(sigLabel + ":", {
          x: margin,
          y,
          size: labelSize,
          font: boldFont,
        });
        y -= 5;

        const base64Data = submissionData[key].split(",")[1];
        const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const sigDims = sigImage.scale(0.5);
        const drawWidth = Math.min(sigDims.width, 200);
        const drawHeight = (drawWidth / sigDims.width) * sigDims.height;

        if (y - drawHeight < 50) {
          page = pdfDoc.addPage([612, 792]);
          y = 742;
        }

        page.drawImage(sigImage, {
          x: margin,
          y: y - drawHeight,
          width: drawWidth,
          height: drawHeight,
        });
        y -= drawHeight + 20;
      } catch {
        drawField(key.replace("DataUrl", ""), "[Signature attached]");
      }
    }
  }

  addNewPageIfNeeded();
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 562, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;
  page.drawText(`Generated by CompanyHQ on ${new Date().toLocaleString()}`, {
    x: margin,
    y,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\s/, "")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
