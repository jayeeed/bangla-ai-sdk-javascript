import { BanglaAI } from "../src/index.js";

const client = new BanglaAI();

async function run() {
  console.log("=== 1. Synchronous Single-Page Document OCR ===");
  try {
    const ocrResult = await client.ocr.process("./sample_nid.jpg");
    console.log("Extracted Markdown:\n", ocrResult.markdown);

    for (const page of ocrResult.pages || []) {
      for (const region of page.regions || []) {
        console.log(`[${region.label}] (${region.box_2d}): ${region.text}`);
      }
    }
  } catch (err) {
    console.log(`OCR notice: ${err.message}`);
  }

  console.log("\n=== 2. Multi-Page Asynchronous Document OCR ===");
  try {
    const job = await client.ocr.waitForJob("./sample_contract.pdf", {
      pollInterval: 2000,
    });
    console.log(`Job Status: ${job.status}`);
    console.log("Extracted Content:\n", job.result?.markdown);
  } catch (err) {
    console.log(`OCR job notice: ${err.message}`);
  }
}

run().catch(console.error);
