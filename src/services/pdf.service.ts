// src/services/pdf.service.ts
import puppeteer from "puppeteer-core";
import os from "os";
import fs from "fs";

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

export class PdfService {
  static readonly commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--disable-extensions",
    "--disable-gpu",
  ];

  private static findChromeExecutable(): string | null {
    if (process.env.CHROME_EXECUTABLE_PATH) {
      return process.env.CHROME_EXECUTABLE_PATH;
    }

    const platform = os.platform();
    const candidates: string[] =
      platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : platform === "win32"
        ? [
            // common windows locations
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            // linux common locations
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
          ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  private static async getLaunchOptions(): Promise<LaunchOptions> {
    const isProduction = process.env.NODE_ENV === "production";
    const executablePath = this.findChromeExecutable();

    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium executable not found. Install Chromium on the VPS or set CHROME_EXECUTABLE_PATH. " +
          "If you prefer Puppeteer bundled Chromium, install 'puppeteer' (npm i puppeteer)."
      );
    }

    const opts: LaunchOptions = {
      executablePath,
      headless: true,
      args: this.commonArgs,
    };

    if (isProduction) {
      opts.headless = true;
      opts.args = [...(opts.args ?? []), "--no-zygote"];
    }

    return opts;
  }

  static async generatePdfFromHtml(
    html: string,
    options?: {
      format?: "A4" | "Letter";
      margin?: { top?: string; bottom?: string; left?: string; right?: string };
      headerTemplate?: string;
      footerTemplate?: string;
      displayHeaderFooter?: boolean;
    }
  ): Promise<Buffer> {
    const launchOptions = await this.getLaunchOptions();
    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: options?.format ?? "A4",
        printBackground: true,
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate,
        footerTemplate: options?.footerTemplate,
        margin: options?.margin,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
export default PdfService;
