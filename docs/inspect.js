// Quick DB inspection for production handoff. Not part of the app runtime.
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/ginger.db");
const tables = ["users","companies","enquiries","opportunities","quotes","followups","exporters","markets","products","ai_audit","notes","contacts","lead_evidence","communications","activities"];
console.log("--- counts ---");
for (const t of tables) {
  try { console.log(t + ": " + db.prepare("SELECT COUNT(*) c FROM " + t).get().c); }
  catch (e) { console.log(t + ": ERR " + e.message); }
}
console.log("\n--- users ---");
for (const u of db.prepare("SELECT id,email,name,role FROM users ORDER BY id").all()) console.log(JSON.stringify(u));
console.log("\n--- company data_label counts ---");
for (const r of db.prepare("SELECT data_label, COUNT(*) c FROM companies GROUP BY data_label ORDER BY c DESC").all()) console.log(JSON.stringify(r));
console.log("--- enquiry / opportunity / quote status ---");
for (const [t, col] of [["enquiries","status"],["opportunities","stage"],["quotes","status"]]) {
  console.log(t + ":");
  for (const r of db.prepare("SELECT " + col + " AS k, COUNT(*) c FROM " + t + " GROUP BY " + col).all()) console.log("  " + JSON.stringify(r));
}
console.log("\n--- any VERIFIED/IMPORTED/MANUAL? ---");
console.log("VERIFIED:", db.prepare("SELECT COUNT(*) c FROM companies WHERE data_label='VERIFIED'").get().c);
console.log("IMPORTED:", db.prepare("SELECT COUNT(*) c FROM companies WHERE data_label='IMPORTED'").get().c);
console.log("MANUAL:", db.prepare("SELECT COUNT(*) c FROM companies WHERE data_label='MANUAL'").get().c);
console.log("DEMO:", db.prepare("SELECT COUNT(*) c FROM companies WHERE data_label='DEMO'").get().c);