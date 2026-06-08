/**
 * sheets-reporter.ts
 *
 * Playwright reporter that writes test results to a Google Sheet.
 *
 * Each test run appends a block of rows:
 *   Date | Run ID | Spec | Test name | Status | Duration (s) | Error
 *
 * Setup:
 *  1. Create a Google Cloud service account and download the JSON key
 *  2. Share the target Google Sheet with the service account email (Editor)
 *  3. Set env vars:
 *       SHEET_ID      — the spreadsheet ID from the URL
 *       SHEET_TAB     — sheet tab name (default "E2E Results")
 *       GOOGLE_SA_KEY — full JSON key as a single-line string
 *
 * The reporter also saves results locally to playwright-report/results.json
 * as a fallback when Sheets credentials are not configured.
 */

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

interface Row {
  date: string;
  runId: string;
  spec: string;
  testName: string;
  status: string;
  durationSec: string;
  error: string;
}

class SheetsReporter implements Reporter {
  private rows: Row[] = [];
  private runId: string = new Date().toISOString().replace(/[:.]/g, "-");
  private runDate: string = new Date().toLocaleString("en-US", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  onTestEnd(test: TestCase, result: TestResult) {
    const spec = path.basename(test.location.file);
    const error = result.errors?.[0]?.message?.split("\n")[0] ?? "";
    this.rows.push({
      date: this.runDate,
      runId: this.runId,
      spec,
      testName: test.title,
      status: result.status.toUpperCase(),
      durationSec: (result.duration / 1000).toFixed(1),
      error: error.slice(0, 300),
    });
  }

  async onEnd(result: FullResult) {
    const passed  = this.rows.filter((r) => r.status === "PASSED").length;
    const failed  = this.rows.filter((r) => r.status === "FAILED").length;
    const skipped = this.rows.filter((r) => r.status === "SKIPPED").length;

    console.log(`\n[sheets-reporter] Run complete — ${passed} passed, ${failed} failed, ${skipped} skipped`);

    // Always save locally
    const outDir = "playwright-report";
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "results.json"),
      JSON.stringify({ runId: this.runId, date: this.runDate, summary: { passed, failed, skipped }, rows: this.rows }, null, 2)
    );

    // Write to Google Sheets if configured
    const sheetId   = process.env.SHEET_ID ?? "";
    const sheetTab  = process.env.SHEET_TAB ?? "E2E Results";
    const saKeyJson = process.env.GOOGLE_SA_KEY ?? "";

    if (!sheetId || !saKeyJson) {
      console.log("[sheets-reporter] SHEET_ID / GOOGLE_SA_KEY not set — results saved locally only");
      return;
    }

    try {
      const { google } = require("googleapis");
      const key = JSON.parse(saKeyJson);
      const auth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });

      // Ensure header row exists (first call on a fresh sheet)
      await this.ensureHeader(sheets, sheetId, sheetTab);

      // Append result rows
      const values = this.rows.map((r) => [
        r.date, r.runId, r.spec, r.testName, r.status, r.durationSec, r.error,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetTab}!A1`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });

      console.log(`[sheets-reporter] ${this.rows.length} rows written to Google Sheets (${sheetId})`);
    } catch (err: any) {
      console.error(`[sheets-reporter] Failed to write to Sheets: ${err?.message}`);
    }
  }

  private async ensureHeader(sheets: any, sheetId: string, tab: string) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tab}!A1:G1`,
      });
      if (res.data.values?.length) return; // header already exists
    } catch {}

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tab}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["Date", "Run ID", "Spec", "Test Name", "Status", "Duration (s)", "Error"]],
      },
    });
  }
}

export default SheetsReporter;
