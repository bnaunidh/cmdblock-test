/**
 * CMDBLOCK — Google Sheets signup logger
 * =========================================
 *
 * One-time setup:
 *   1. Create a new Google Sheet. Add a header row:
 *      A1: timestamp · B1: name · C1: email · D1: source · E1: user agent
 *   2. Extensions → Apps Script. Paste this whole file.
 *   3. Save (disk icon). Then Deploy → New deployment.
 *      · Type: Web app
 *      · Execute as: Me
 *      · Who has access: Anyone
 *   4. Copy the deployment URL (ends in /exec).
 *   5. Open redesign/scripts/cmdblock.js and paste it into the
 *      SHEETS_URL constant near the top.
 *
 * Re-deploying after edits:
 *   Deploy → Manage deployments → ✏️ → New version → Deploy.
 *
 * The site sends a no-cors POST containing JSON:
 *   { name, email, source, ts, ua }
 * One row is appended per signup. The site also tracks sent emails
 * locally so the same email is never logged twice from one browser.
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(body);

    sheet.appendRow([
      data.ts || new Date().toISOString(),
      String(data.name || '').slice(0, 64),
      String(data.email || '').slice(0, 120),
      String(data.source || '').slice(0, 64),
      String(data.ua || '').slice(0, 200),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('CMDBLOCK signup endpoint is live.');
}
