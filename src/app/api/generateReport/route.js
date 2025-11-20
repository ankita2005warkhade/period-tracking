// src/app/api/generateReport/route.js
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Helper: convert hex color to pdf-lib rgb
 */
function hexToRgb(hex) {
  if (!hex) return { r: 0.85, g: 0.16, b: 0.53 }; // fallback pink
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return { r, g, b };
}

export async function POST(req) {
  try {
    const body = await req.json();
    // expected: { appName, brandColor, accentColor, cycles: [ { startDate, endDate, cycleLength, cycleHealthScore, nextPredictedDate, topMood, topSymptom, shortSummary, specialNotes? } ] }
    const {
      appName = "Period Tracking",
      brandColor = "#d63384",
      accentColor = "#ff7aa2",
      cycles = [],
      includeTimestamp = true,
    } = body;

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const brandRgb = hexToRgb(brandColor);
    const accentRgb = hexToRgb(accentColor);

    // --- Cover page ---
    {
      const page = pdfDoc.addPage([595, 842]); // A4-ish in pts
      const { width, height } = page.getSize();

      // Header rectangle
      page.drawRectangle({
        x: 0,
        y: height - 140,
        width,
        height: 140,
        color: rgb(brandRgb.r, brandRgb.g, brandRgb.b),
      });

      // App name
      page.drawText(appName, {
        x: 40,
        y: height - 80,
        size: 28,
        font: timesBold,
        color: rgb(1, 1, 1),
      });

      // Reserved logo box (right)
      const boxW = 120;
      const boxH = 80;
      page.drawRectangle({
        x: width - boxW - 40,
        y: height - 120,
        width: boxW,
        height: boxH,
        borderColor: rgb(1, 1, 1),
        borderWidth: 1,
        color: rgb(1, 1, 1, 0.02),
      });
      page.drawText("Logo (reserved)", {
        x: width - boxW - 35,
        y: height - 90,
        size: 9,
        font: timesRomanFont,
        color: rgb(1, 1, 1),
      });

      // Report title
      page.drawText("Comprehensive Cycle Report", {
        x: 40,
        y: height - 180,
        size: 18,
        font: timesBold,
        color: rgb(0.15, 0.15, 0.15),
      });

      // small meta
      const dateStr = new Date().toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      if (includeTimestamp) {
        page.drawText(`Generated: ${dateStr}`, {
          x: 40,
          y: height - 205,
          size: 10,
          font: timesRomanFont,
          color: rgb(0.45, 0.45, 0.45),
        });
      }

      // Summary block (how many cycles)
      page.drawText(`Total cycles in report: ${cycles.length}`, {
        x: 40,
        y: height - 230,
        size: 12,
        font: timesRomanFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      // A small accent bar
      page.drawRectangle({
        x: 40,
        y: height - 240,
        width: 120,
        height: 6,
        color: rgb(accentRgb.r, accentRgb.g, accentRgb.b),
      });
    }

    // --- Per-cycle pages or grouped two cycles per page if you prefer ---
    for (let i = 0; i < cycles.length; i++) {
      const c = cycles[i];

      // create new page for each cycle
      const page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();

      // Header small
      page.drawText(`${appName} — Cycle Report`, {
        x: 40,
        y: height - 40,
        size: 10,
        font: timesRomanFont,
        color: rgb(0.35, 0.35, 0.35),
      });

      // Cycle title
      const title = `Cycle ${i + 1} — ${c.startDate || "Unknown start"}`;
      page.drawText(title, {
        x: 40,
        y: height - 70,
        size: 16,
        font: timesBold,
        color: rgb(brandRgb.r, brandRgb.g, brandRgb.b),
      });

      // Basic fields (left column)
      const leftX = 40;
      const rightX = 320;
      let y = height - 110;
      const lineGap = 18;

      // Left side info
      page.drawText("Start Date:", { x: leftX, y, size: 11, font: timesBold });
      page.drawText(String(c.startDate || "-"), {
        x: leftX + 95,
        y,
        size: 11,
        font: timesRomanFont,
      });
      y -= lineGap;

      page.drawText("End Date:", { x: leftX, y, size: 11, font: timesBold });
      page.drawText(String(c.endDate || "-"), {
        x: leftX + 95,
        y,
        size: 11,
        font: timesRomanFont,
      });
      y -= lineGap;

      page.drawText("Cycle Length:", { x: leftX, y, size: 11, font: timesBold });
      page.drawText(String(c.cycleLength ?? "-"), {
        x: leftX + 95,
        y,
        size: 11,
        font: timesRomanFont,
      });
      y -= lineGap;

      page.drawText("Health Score:", { x: leftX, y, size: 11, font: timesBold });
      page.drawText(String(c.cycleHealthScore ?? "-") + "%", {
        x: leftX + 95,
        y,
        size: 11,
        font: timesRomanFont,
      });
      y -= lineGap;

      // Right column
      let ry = height - 110;
      page.drawText("Next Period:", { x: rightX, y: ry, size: 11, font: timesBold });
      page.drawText(String(c.nextPredictedDate || "-"), {
        x: rightX + 90,
        y: ry,
        size: 11,
        font: timesRomanFont,
      });
      ry -= lineGap;

      page.drawText("Top Mood:", { x: rightX, y: ry, size: 11, font: timesBold });
      page.drawText(String(c.topMood || "-"), {
        x: rightX + 90,
        y: ry,
        size: 11,
        font: timesRomanFont,
      });
      ry -= lineGap;

      page.drawText("Top Symptom:", { x: rightX, y: ry, size: 11, font: timesBold });
      page.drawText(String(c.topSymptom || "-"), {
        x: rightX + 90,
        y: ry,
        size: 11,
        font: timesRomanFont,
      });
      ry -= lineGap;

      // Divider line
      page.drawLine({
        start: { x: 40, y: ry - 6 },
        end: { x: width - 40, y: ry - 6 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      // Short summary block
      const summaryY = ry - 30;
      const summaryText = (c.shortSummary || c.summaryText || "").replace(/\r?\n/g, " ").trim();
      page.drawText("Summary:", { x: 40, y: summaryY, size: 12, font: timesBold });
      page.drawText(summaryText || "-", {
        x: 40,
        y: summaryY - 18,
        size: 10,
        font: timesRomanFont,
        color: rgb(0.12, 0.12, 0.12),
        maxWidth: width - 80,
      });

      // Special notes (only show if present and non-empty)
      if (c.specialNotes && String(c.specialNotes).trim().length > 3) {
        const notesY = summaryY - 90;
        page.drawText("Clinically relevant notes:", { x: 40, y: notesY, size: 11, font: timesBold });
        page.drawText(String(c.specialNotes), {
          x: 40,
          y: notesY - 18,
          size: 10,
          font: timesRomanFont,
          color: rgb(0.12, 0.12, 0.12),
          maxWidth: width - 80,
        });
      }

      // footer small
      page.drawText(`Cycle #${i + 1}`, {
        x: 40,
        y: 30,
        size: 9,
        font: timesRomanFont,
        color: rgb(0.55, 0.55, 0.55),
      });
      page.drawText(appName, {
        x: width - 140,
        y: 30,
        size: 9,
        font: timesRomanFont,
        color: rgb(0.55, 0.55, 0.55),
      });
    }

    // finalize
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="period_report.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
