import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function safe(text) {
  if (!text) return "";
  return text.replace(/[^\x00-\x7F]/g, ""); // remove all non-ASCII
}

export async function POST(req) {
  try {
    const body = await req.json();

    const { appName = "Period Tracking", cycles = [] } = body;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Single simple cover page
    let page = pdfDoc.addPage([595, 842]);
    let y = 780;

    page.drawText(safe(`${appName} Report`), {
      x: 40,
      y,
      size: 24,
      font: bold,
    });

    y -= 40;

    cycles.forEach((c, idx) => {
      if (y < 140) {
        page = pdfDoc.addPage([595, 842]);
        y = 780;
      }

      page.drawText(safe(`Cycle ${idx + 1}`), {
        x: 40,
        y,
        size: 18,
        font: bold,
      });
      y -= 25;

      page.drawText(safe(`Start Date: ${c.startDate || "-"}`), {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText(safe(`End Date: ${c.endDate || "-"}`), {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText(
        safe(`Cycle Length: ${c.cycleLength ? c.cycleLength + " days" : "-"}`),
        {
          x: 40,
          y,
          size: 12,
          font,
        }
      );
      y -= 18;

      page.drawText(
        safe(`Next Predicted Period: ${c.nextPredictedDate || "-"}`),
        {
          x: 40,
          y,
          size: 12,
          font,
        }
      );
      y -= 18;

      page.drawText(safe(`Top Mood: ${c.topMood || "-"}`), {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText(safe(`Top Symptom: ${c.topSymptom || "-"}`), {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText(safe(`Flow Level: ${c.topFlow || "-"}`), {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText("Summary: Normal cycle.", {
        x: 40,
        y,
        size: 12,
        font,
      });
      y -= 18;

      page.drawText("Warnings: None", {
        x: 40,
        y,
        size: 12,
        font,
      });

      y -= 35;
    });

    const bytes = await pdfDoc.save();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cycle_report.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF ERROR:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
