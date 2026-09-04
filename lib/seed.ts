// DEMO seed — all rows data_label=DEMO, evidence explicitly demo/unverified.
// Never presented as real discovered buyers. Real data enters via API/CSV/manual/provider.
//
// Production: this seed must NOT be auto-run. It is a developer convenience only.
// Guard: refuse to wipe data when NODE_ENV=production. Devs run `npm run seed` explicitly.
import { getDb, nowISO, todayISO } from "./db";
import bcrypt from "bcryptjs";

export async function seed() {
  const nodeEnv = String(process.env.NODE_ENV ?? "");
  if (nodeEnv === "production") {
    console.warn("[seed] refusing to run in production. Demo data is not deployed.");
    return;
  }
  const db = getDb();
  // wipe (dev/demo only)
  const tables = ["quote_items","quotes","opportunities","enquiries","followups","communications","activities","lead_evidence","notes","contacts","companies","exporters","markets","products","users"];
  for (const t of tables) db.exec(`DELETE FROM ${t};`);

  // Only create the legacy dev accounts in dev mode. In production, accounts come from env.
  if (nodeEnv !== "production") {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
    db.prepare("INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run("admin@gingeros.local","Admin","admin",hash,nowISO());
    db.prepare("INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run("sales@gingeros.local","Sales Owner","sales",hash,nowISO());
  }

  db.prepare("INSERT INTO products(id,name,hs,description) VALUES(?,?,?,?)").run("dry-ginger","Dry Ginger","0910.12","Whole / slices / powder. Sun-dried rhizomes.");

  const markets: [string,string,string][] = [
    ["AE","UAE","UAE"],["SA","Saudi Arabia","Middle East"],["QA","Qatar","Middle East"],
    ["OM","Oman","Middle East"],["KW","Kuwait","Middle East"],["BH","Bahrain","Middle East"],
    ["JO","Jordan","Middle East"],["GB","United Kingdom","Europe"],["DE","Germany","Europe"],
    ["FR","France","Europe"],["NL","Netherlands","Europe"],["IT","Italy","Europe"],
    ["ES","Spain","Europe"],["BE","Belgium","Europe"],["ZA","South Africa","South Africa"],
  ];
  for (const [code,name,region] of markets)
    db.prepare("INSERT INTO markets(code,name,region,notes,sources,updated_at) VALUES(?,?,?,?,?,?)").run(code,name,region,`DEMO notes for ${name} — verify before selling.`,"DEMO seed",todayISO());

  type B = { name:string; country:string; city:string; type:string; industry:string; products:string; fit:string; status:string; outreach:string; score:number; grade:string; signals:string[]; owner:string };
  const buyers: B[] = [
    { name:"DEMO — Gulf Spice Trading LLC", country:"UAE", city:"Dubai", type:"Importer", industry:"Spices", products:"Spices, dried herbs, ginger powder", fit:"High", status:"Interested", outreach:"Responded", score:88, grade:"A", signals:["Imports spices","Distributes dried food ingredients","Sources internationally"], owner:"Sales Owner" },
    { name:"DEMO — Emirates Food Ingredients", country:"UAE", city:"Sharjah", type:"Food ingredient company", industry:"Food ingredients", products:"Dehydrated vegetables, spice blends", fit:"High", status:"Enquiry", outreach:"Responded", score:84, grade:"A", signals:["Handles ginger products","Works with food manufacturers"], owner:"Sales Owner" },
    { name:"DEMO — Dubai Dry Foods Dist.", country:"UAE", city:"Dubai", type:"Distributor", industry:"Distribution", products:"Dry foods, pulses, spices", fit:"Medium", status:"Contacted", outreach:"Follow-up 1", score:66, grade:"B", signals:["Distributes dried food ingredients"], owner:"Sales Owner" },
    { name:"DEMO — Horeca Supply UAE", country:"UAE", city:"Abu Dhabi", type:"Hotel supplier", industry:"Foodservice", products:"Horeca dry goods, spices", fit:"Medium", status:"Qualified", outreach:"Not contacted", score:58, grade:"B", signals:["Operates in foodservice channels"], owner:"Unassigned" },
    { name:"DEMO — Al Noor Trading", country:"UAE", city:"Ajman", type:"Trading company", industry:"General trading", products:"Assorted foodstuff", fit:"Low", status:"Discovered", outreach:"Not contacted", score:38, grade:"C", signals:[], owner:"Unassigned" },
    { name:"DEMO — Saudi Spice Co.", country:"Saudi Arabia", city:"Jeddah", type:"Spice company", industry:"Spices", products:"Whole spices, ground spices", fit:"High", status:"Quotation Sent", outreach:"Interested", score:81, grade:"A", signals:["Imports spices","Handles ginger products"], owner:"Sales Owner" },
    { name:"DEMO — Qatar Foodstuff WLL", country:"Qatar", city:"Doha", type:"Wholesaler", industry:"Wholesale", products:"Dry goods, spices", fit:"Medium", status:"Contacted", outreach:"Contacted", score:62, grade:"B", signals:["Sources products internationally"], owner:"Sales Owner" },
    { name:"DEMO — Oman Agro Foods", country:"Oman", city:"Muscat", type:"Distributor", industry:"Distribution", products:"Agro commodities", fit:"Medium", status:"Researching", outreach:"Not contacted", score:55, grade:"B", signals:["Distributes dried food ingredients"], owner:"Unassigned" },
    { name:"DEMO — Kuwait Ingredient House", country:"Kuwait", city:"Kuwait City", type:"Food ingredient company", industry:"Ingredients", products:"Bakery & seasoning ingredients", fit:"Low", status:"Discovered", outreach:"Not contacted", score:44, grade:"C", signals:[], owner:"Unassigned" },
    { name:"DEMO — London Spice Importers Ltd", country:"United Kingdom", city:"London", type:"Importer", industry:"Spices", products:"Ethnic spices, ginger", fit:"High", status:"Negotiation", outreach:"Interested", score:90, grade:"A", signals:["Imports spices","Works with Indian suppliers","Handles ginger products"], owner:"Sales Owner" },
    { name:"DEMO — Hamburg Gewuerz GmbH", country:"Germany", city:"Hamburg", type:"Spice company", industry:"Spices", products:"Dried spices, milling", fit:"High", status:"Responded", outreach:"Responded", score:79, grade:"A", signals:["Imports spices","Sources internationally"], owner:"Sales Owner" },
    { name:"DEMO — Rotterdam Ingredients BV", country:"Netherlands", city:"Rotterdam", type:"Food ingredient company", industry:"Ingredients", products:"Dried ingredients, blends", fit:"Medium", status:"Qualified", outreach:"Not contacted", score:64, grade:"B", signals:["Distributes dried food ingredients"], owner:"Unassigned" },
    { name:"DEMO — Paris Epices SAS", country:"France", city:"Paris", type:"Distributor", industry:"Distribution", products:"Fine foods, spices", fit:"Medium", status:"Discovered", outreach:"Not contacted", score:57, grade:"B", signals:["Sources products internationally"], owner:"Unassigned" },
    { name:"DEMO — Milano Spezie SRL", country:"Italy", city:"Milan", type:"Food manufacturer", industry:"Food mfg", products:"Sauces, seasonings", fit:"Low", status:"Discovered", outreach:"Not contacted", score:41, grade:"C", signals:[], owner:"Unassigned" },
    { name:"DEMO — Barcelona Alimentos SL", country:"Spain", city:"Barcelona", type:"Beverage manufacturer", industry:"Beverages", products:"Herbal teas, botanicals", fit:"Medium", status:"Researching", outreach:"Not contacted", score:60, grade:"B", signals:["Handles ginger products"], owner:"Unassigned" },
    { name:"DEMO — Cape Spice Distributors", country:"South Africa", city:"Cape Town", type:"Distributor", industry:"Distribution", products:"Spices, dry goods", fit:"High", status:"Enquiry", outreach:"Responded", score:82, grade:"A", signals:["Imports spices","Distributes dried food ingredients"], owner:"Sales Owner" },
    { name:"DEMO — Joburg Food Ingredients", country:"South Africa", city:"Johannesburg", type:"Food ingredient company", industry:"Ingredients", products:"Seasonings, dried veg", fit:"Medium", status:"Contacted", outreach:"Follow-up 2", score:68, grade:"B", signals:["Sources products internationally"], owner:"Sales Owner" },
    { name:"DEMO — Durban Wholesale Foods", country:"South Africa", city:"Durban", type:"Wholesaler", industry:"Wholesale", products:"Bulk dry foods", fit:"Low", status:"Discovered", outreach:"Not contacted", score:36, grade:"C", signals:[], owner:"Unassigned" },
  ];

  const cids: number[] = [];
  for (const b of buyers) {
    const r = db.prepare(`INSERT INTO companies(name,country,city,website,company_type,industry,products,ginger_fit,import_relevance,size,source,source_url,date_discovered,evidence,last_verified,buyer_status,qual_score,grade,priority,outreach_status,last_activity,owner,notes,data_label)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      b.name,b.country,b.city,"Unknown",b.type,b.industry,b.products,b.fit,b.fit==="High"?"Likely importer":"Unknown","Unknown",
      "DEMO seed","","2026-09-01", b.signals.length?`DEMO — ${b.signals.join("; ")}`:"Evidence not available","",
      b.status,b.score,b.grade,b.grade==="A"?"High":b.grade==="B"?"Medium":"Low",b.outreach,"2026-09-04",b.owner,"DEMO record — verify before outreach","DEMO"
    );
    const id = Number(r.lastInsertRowid); cids.push(id);
    db.prepare("INSERT INTO lead_evidence(company_id,source,url,snippet,discovered_at) VALUES(?,?,?,?,?)").run(id,"DEMO seed","","DEMO — do not treat as verified trade data","2026-09-01");
    db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(id,"system","Buyer discovered","DEMO discovery — needs verification","System","2026-09-01T10:00:00Z");
    db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(id,"system",`Qualified ${b.grade}`,`Score ${b.score}/100 — DEMO breakdown`,"System","2026-09-01T11:00:00Z");
    if (b.outreach !== "Not contacted") {
      db.prepare("INSERT INTO communications(company_id,channel,direction,subject,body,status,created_at) VALUES(?,?,?,?,?,?,?)").run(id,"Email","outbound","Dry ginger from India — specs & pricing","DEMO draft — no real send","logged","2026-09-02T09:00:00Z");
      db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(id,"email","Email sent","DEMO — draft logged, no integration","Sales Owner","2026-09-02T09:00:00Z");
    }
    // contacts — clearly demo, Unknown where appropriate
    if (b.grade === "A") {
      db.prepare("INSERT INTO contacts(company_id,name,role,dept,email,phone,linkedin,confidence,is_dm,notes) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,"DEMO Procurement Lead","Procurement Manager","Procurement","Unknown","Unknown","","Unverified",1,"DEMO — find real contact before outreach");
    } else if (b.grade === "B") {
      db.prepare("INSERT INTO contacts(company_id,name,role,dept,email,phone,linkedin,confidence,is_dm,notes) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,"DEMO Commercial Contact","Commercial","Sales","Unknown","Unknown","","Unverified",0,"DEMO");
    }
    // follow-ups for active
    if (["Contacted","Interested","Responded","Enquiry","Quotation Sent","Negotiation"].includes(b.status)) {
      db.prepare("INSERT INTO followups(company_id,title,due_date,done,owner,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(id,`Follow up — ${b.name.slice(0,28)}`,"2026-09-05",0,b.owner,"DEMO follow-up",nowISO());
    }
  }

  // Enquiries / opportunities / quotes on hot buyers
  const byName = (n: string) => {
    const r = db.prepare("SELECT id FROM companies WHERE name=?").get(n) as {id:number}|undefined;
    return r?.id ?? cids[0];
  };
  const e1 = byName("DEMO — Emirates Food Ingredients");
  const e2 = byName("DEMO — Cape Spice Distributors");
  const e3 = byName("DEMO — London Spice Importers Ltd");
  const e4 = byName("DEMO — Saudi Spice Co.");
  db.prepare("INSERT INTO enquiries(company_id,country,product,qty,packaging,destination,specs,certs,target_price,delivery,payment_terms,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e1,"UAE","Dry Ginger","2 MT","25kg PP bags","Jebel Ali","Whole, moisture <12%","Unknown","CIF Jebel Ali target","30 days","30% advance","Qualified","DEMO enquiry",nowISO());
  db.prepare("INSERT INTO enquiries(company_id,country,product,qty,packaging,destination,specs,target_price,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(e2,"South Africa","Dry Ginger","5 MT","25kg bags","Durban","Slices, SO2-free","CIF Durban","Quotation Required","DEMO",nowISO());
  db.prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,last_activity,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e3,"Dry Ginger","10 MT","2400","USD",24000,"Negotiation",70,"2026-10-01","2026-09-04","Send revised CIF Felixstowe quote","DEMO opportunity",nowISO());
  db.prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,last_activity,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e4,"Dry Ginger","3 MT","2300","USD",6900,"Quotation Sent",50,"2026-09-20","2026-09-03","Confirm packaging + payment terms","DEMO",nowISO());
  db.prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,last_activity,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e1,"Dry Ginger","2 MT","2350","USD",4700,"Enquiry",30,"2026-09-25","2026-09-04","Request destination port confirmation","DEMO",nowISO());
  const qid = Number(db.prepare("INSERT INTO quotes(company_id,product,qty,unit_price,currency,packaging,incoterm,destination,validity,payment_terms,lead_time,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e4,"Dry Ginger","3 MT","2300","USD","25kg PP bags","CIF","Jeddah","15 days","30% advance, balance CAD","20 days","Sent","DEMO quote — configurable terms",nowISO()).lastInsertRowid);
  db.prepare("INSERT INTO quote_items(quote_id,description,qty,unit_price) VALUES(?,?,?,?)").run(qid,"Dry Ginger Whole — FAQ","3 MT","2300 USD/MT");

  const exps = [
    ["DEMO — Kochi Spice Exports","Kochi, Kerala","Unknown","Spices","Dry ginger whole/powder","UAE, Germany","Unknown","DEMO seed","Evidence not available"],
    ["DEMO — Idukki Dry Ginger Co","Idukki, Kerala","Unknown","Ginger, spices","Unbleached whole","Middle East","Unknown","DEMO seed","Evidence not available"],
    ["DEMO — Karnataka Agro Trade","Bengaluru","Unknown","Agro commodities","Slices","Europe","Unknown","DEMO seed","Evidence not available"],
    ["DEMO — Mumbai Spice House","Mumbai","Unknown","Spices","Powder, whole","South Africa, UAE","Unknown","DEMO seed","Evidence not available"],
    ["DEMO — Erode Ginger Works","Erode, TN","Unknown","Turmeric, ginger","Whole FAQ","Qatar, Oman","Unknown","DEMO seed","Evidence not available"],
    ["DEMO — Delhi Spice Traders","Delhi","Unknown","Trading","Assorted","Europe","Unknown","DEMO seed","Evidence not available"],
  ];
  for (const e of exps) db.prepare("INSERT INTO exporters(name,location,website,products,ginger_offering,export_markets,certs,source,evidence,notes,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(...e,"DEMO — verify before relying","DEMO");
  console.log("Seeded DEMO data.");
}

if (process.argv[1]?.endsWith("seed.ts")) seed();
