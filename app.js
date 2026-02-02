
/***********************
 *  Utils & Stockage
 ***********************/
const LS = {
  temps: "releves_temps",
  hygiene: "releves_hygiene",
  inv: "releves_inventaire",
  notes: "releves_notes",
  employees: "employees_list",
  bakery: "bakery_name",
  actions: "actions_correctives",
  validations: "validations_jour",
  patron_pin: "patron_pin_hash",
  patron_unlocked: "patron_unlocked",
  patron_lock_minutes: "patron_lock_minutes",
  patron_lock_duration: "patron_lock_duration"
};
const LS_PRODS = "catalogue_produits";

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function monthISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yyyy}-${mm}`;
}
function nowLocale(){ return new Date().toLocaleString(); }

function readLS(key){
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function writeLS(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toCSV(rows, headers){
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(";") || s.includes("\n")) return `"${s.replaceAll('"','""')}"`;
    return s;
  };
  let out = headers.map(h => esc(h.label)).join(";") + "\n";
  rows.forEach(r => out += headers.map(h => esc(r[h.key])).join(";") + "\n");
  return out;
}
function splitToLines(doc, text, maxWidth){
  return doc.splitTextToSize(String(text || ""), maxWidth);
}
function mustHaveEmployee(){
  const emp = (employeeSelect.value || "").trim();
  if (!emp){
    alert("Choisis un employé avant d’enregistrer.");
    return false;
  }
  return true;
}

/***********************
 *  Tabs
 ***********************/
const tabButtons = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(id).classList.add("active");

    if (id === "notes") renderNotesList();
    if (id === "inventaire") { produitsBase = loadCatalogue(); renderInvSelect(); renderInvForm(); setInvListTitle("Historique du produit"); }
    if (id === "stats") refreshStats();
  });
});

/***********************
 *  Bakery & Employees
 ***********************/
const bakeryName = document.getElementById("bakeryName");
bakeryName.value = "Boulangerie Pâtisserie Cointe";
bakeryName.disabled = true;
localStorage.setItem(LS.bakery, bakeryName.value);

const employeeSelect = document.getElementById("employeeSelect");
const newEmployeeName = document.getElementById("newEmployeeName");
const btnAddEmployee = document.getElementById("btnAddEmployee");
const btnDeleteEmployee = document.getElementById("btnDeleteEmployee");

function loadEmployees(){
  const saved = readLS(LS.employees);
  if (saved.length) return saved;
  const def = ["Julien"];
  writeLS(LS.employees, def);
  return def;
}
function renderEmployees(){
  const list = loadEmployees();
  employeeSelect.innerHTML = "";
  list.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    employeeSelect.appendChild(opt);
  });
}
renderEmployees();

btnAddEmployee.addEventListener("click", () => {
  const name = (newEmployeeName.value || "").trim();
  if (!name) return;
  const list = loadEmployees();
  if (list.some(n => n.toLowerCase() === name.toLowerCase())) return alert("Employé déjà présent.");
  list.push(name);
  writeLS(LS.employees, list);
  newEmployeeName.value = "";
  renderEmployees();
  employeeSelect.value = name;
  updateSelectedEmployeeUI();
});

btnDeleteEmployee.addEventListener("click", () => {
  const emp = employeeSelect.value;
  if (!emp) return;

  if (!confirm(`Supprimer l'employé "${emp}" de la liste ?\n\n⚠️ L'historique reste inchangé.`)) return;

  let list = loadEmployees().filter(n => n !== emp);
  if (!list.length){
    alert("Il doit rester au moins 1 employé.");
    return;
  }
  writeLS(LS.employees, list);
  renderEmployees();
  updateSelectedEmployeeUI();
});

function updateSelectedEmployeeUI(){
  const emp = employeeSelect.value || "—";
  const hygEmp = document.getElementById("hygieneEmp");
  const invEmp = document.getElementById("invEmp");
  const tempsEmp = document.getElementById("tempsEmp");
  if (hygEmp) hygEmp.textContent = emp;
  if (invEmp) invEmp.textContent = emp;
  if (tempsEmp) tempsEmp.textContent = emp;
}
employeeSelect.addEventListener("change", updateSelectedEmployeeUI);
updateSelectedEmployeeUI();

/***********************
 *  Notifications (dans l'app) + Actions correctives + Validations
 ***********************/
const notifsDiv = document.getElementById("notifs");

function showNotif({level="warn", title="", msg="", actions=[]}){
  if (!notifsDiv) return;
  const box = document.createElement("div");
  box.className = "notif " + (level==="bad"?"bad":(level==="ok"?"ok":""));
  box.innerHTML = `<div class="notif-title">${title}</div><small>${msg}</small>`;
  if (actions.length){
    const act = document.createElement("div");
    act.className = "notif-actions";
    actions.forEach(a => {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.secondary) b.classList.add("secondary");
      b.addEventListener("click", () => a.onClick && a.onClick(box));
      act.appendChild(b);
    });
    box.appendChild(act);
  }
  notifsDiv.appendChild(box);
  return box;
}
function clearNotifs(){
  if (notifsDiv) notifsDiv.innerHTML = "";
}

function loadCorrectives(){ return readLS(LS.actions); }
function saveCorrectives(list){ writeLS(LS.actions, list); }
function pushCorrective(entry){
  const list = loadCorrectives();
  list.push(entry);
  saveCorrectives(list);
}

function loadValidations(){ return readLS(LS.validations); }
function saveValidations(list){ writeLS(LS.validations, list); }
function pushValidation(entry){
  const list = loadValidations();
  list.push(entry);
  saveValidations(list);
}

function monthKeyFromISO(dateISO){
  return (dateISO || "").slice(0,7);
}

/***********************
 *  TEMPÉRATURES
 ***********************/
const zones = [
  { nom: "Chambre à bac", min: 0, max: 6 },
  { nom: "Chambre de pousse 1", min: 0, max: 6 },
  { nom: "Chambre de pousse 2", min: 0, max: 6 },
  { nom: "Congélateur 1", max: -18 },
  { nom: "Congélateur 2", max: -18 },
  { nom: "Surgélateur", max: -30 },
  { nom: "Chambre viennoiserie", min: 0, max: 6 },
  { nom: "Chambre froide pâtisserie", min: 0, max: 6 },
  { nom: "Vitrine magasin", min: 0, max: 4 }
];

function tempStatus(zone, temp){
  if (isNaN(temp)) return "muted";
  if (zone.max !== undefined && zone.min === undefined){
    if (temp <= zone.max) return "ok";
    if (temp <= zone.max + 2) return "warn";
    return "bad";
  }
  if (temp >= zone.min && temp <= zone.max) return "ok";
  if (temp < zone.min - 1 || temp > zone.max + 1) return "bad";
  return "warn";
}

const zonesDiv = document.getElementById("zones");
function renderZones(){
  zonesDiv.innerHTML = "";
  zones.forEach((z, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = z.nom;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.placeholder = "°C";
    input.id = `temp-${i}`;
    input.addEventListener("input", () => {
      const val = parseFloat(input.value);
      const st = tempStatus(z, val);
      card.classList.remove("ok","warn","bad");
      if (st === "ok") card.classList.add("ok");
      if (st === "warn") card.classList.add("warn");
      if (st === "bad") card.classList.add("bad");
    });

    card.appendChild(title);
    card.appendChild(input);
    zonesDiv.appendChild(card);
  });
}
renderZones();

document.getElementById("btnSaveTemps").addEventListener("click", () => {
  if (!mustHaveEmployee()) return;
  const periode = document.getElementById("periode").value;
  const rows = readLS(LS.temps);
  const employee = employeeSelect.value || "";

  zones.forEach((z, i) => {
    const v = document.getElementById(`temp-${i}`).value;
    if (v !== ""){
      rows.push({
        date: todayISO(),
        datetime: nowLocale(),
        periode,
        zone: z.nom,
        temperature: Number(v),
        employee
      });
    }
  });

  writeLS(LS.temps, rows);
  alert("Relevé températures enregistré ✔️");
});

document.getElementById("btnExportTempsCSV").addEventListener("click", () => {
  const rows = readLS(LS.temps);
  if (!rows.length) return alert("Aucune donnée à exporter !");
  const csv = toCSV(rows, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"periode", label:"Période"},
    {key:"zone", label:"Zone"},
    {key:"temperature", label:"Température (°C)"},
    {key:"employee", label:"Employé"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "temperatures.csv");
});

document.getElementById("btnExportTempsPDF").addEventListener("click", () => {
  const rows = readLS(LS.temps);
  if (!rows.length) return alert("Aucune donnée à exporter !");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Relevés de températures`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);

  let y = 30;
  rows.slice(-140).forEach(r => {
    const line = `${r.date} ${r.periode} – ${r.zone}: ${r.temperature}°C – ${r.employee || "-"}`;
    doc.text(line.substring(0, 110), 10, y);
    y += 6;
    if (y > 280){ doc.addPage(); y = 20; }
  });

  doc.save("temperatures.pdf");
});

let chart;
document.getElementById("btnChart").addEventListener("click", () => {
  const rows = readLS(LS.temps);
  if (!rows.length) return alert("Aucune donnée pour le graphique !");
  const periode = document.getElementById("periode").value;

  const labels = zones.map(z => z.nom);
  const data = zones.map(z => {
    const arr = rows.filter(r => r.zone === z.nom && r.periode === periode);
    if (!arr.length) return null;
    return Number(arr[arr.length - 1].temperature);
  });

  const bg = zones.map((z, idx) => {
    const v = data[idx];
    if (v === null) return "#bdc3c7";
    const st = tempStatus(z, v);
    if (st === "ok") return "#2ecc71";
    if (st === "warn") return "#f39c12";
    return "#e74c3c";
  });

  const ctx = document.getElementById("chartTemps").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, { type:"bar", data:{ labels, datasets:[{ label:`Températures (${periode})`, data, backgroundColor:bg }] }, options:{ scales:{ y:{ beginAtZero:true } } } });
});

/***********************
 *  HYGIÈNE / NETTOYAGE
 ***********************/
const hygieneDate = document.getElementById("hygieneDate");
const hygienePeriode = document.getElementById("hygienePeriode");
hygieneDate.value = todayISO();

const tachesBase = [
  "Plans de travail (lavage + désinfection)",
  "Pétrin / batteur (extérieur + commandes)",
  "Diviseuse / façonneuse (zones accessibles)",
  "Balances + boutons/écran",
  "Poignées / interrupteurs (portes, frigos, labo)",
  "Plonge / évier (désinfection)",
  "Poubelles (vidage + désinfection couvercle)",
  "Sol labo (balayage + lavage)",
  "Trancheuse (nettoyage + désinfection)",
  "Zone snacking (plan + ustensiles)",
  "Vitrine magasin (intérieur/extérieur + poignées)",
  "Frigos snacking (essuyage + contrôle)"
];

const tachesDiv = document.getElementById("taches");
function renderTaches(){
  tachesDiv.innerHTML = "";
  tachesBase.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = t;

    const row = document.createElement("div");
    row.className = "row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `tache-${i}`;
    const lbl = document.createElement("label");
    lbl.htmlFor = cb.id;
    lbl.textContent = "Fait";

    row.appendChild(cb);
    row.appendChild(lbl);
    card.appendChild(title);
    card.appendChild(row);
    tachesDiv.appendChild(card);
  });
}
renderTaches();

document.getElementById("btnSaveHygiene").addEventListener("click", () => {
  if (!mustHaveEmployee()) return;
  const date = hygieneDate.value || todayISO();
  const periode = hygienePeriode.value;
  const rows = readLS(LS.hygiene);
  const employee = employeeSelect.value || "";

  const items = tachesBase.map((t, i) => ({
    tache: t,
    fait: document.getElementById(`tache-${i}`).checked ? "oui" : "non"
  }));

  rows.push({ date, datetime: nowLocale(), periode, employee, items });
  writeLS(LS.hygiene, rows);
  alert("Hygiène / Nettoyage enregistré ✔️");
});

document.getElementById("btnExportHygieneCSV").addEventListener("click", () => {
  const rows = readLS(LS.hygiene);
  if (!rows.length) return alert("Aucune donnée à exporter !");
  const flat = [];
  rows.forEach(r => (r.items||[]).forEach(it => flat.push({
    date: r.date, datetime: r.datetime, periode: r.periode, employee: r.employee || "",
    tache: it.tache, fait: it.fait
  })));
  const csv = toCSV(flat, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"periode", label:"Période"},
    {key:"employee", label:"Employé"},
    {key:"tache", label:"Tâche"},
    {key:"fait", label:"Fait"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "hygiene.csv");
});

document.getElementById("btnExportHygienePDF").addEventListener("click", () => {
  const rows = readLS(LS.hygiene);
  if (!rows.length) return alert("Aucune donnée à exporter !");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Hygiène / Nettoyage`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);

  let y = 30;
  rows.slice(-10).forEach(r => {
    doc.setFontSize(12);
    doc.text(`${r.date} ${r.periode} – ${r.employee || "-"}`, 10, y); y += 6;
    doc.setFontSize(10);
    (r.items||[]).forEach(it => {
      doc.text(`- ${it.tache}: ${it.fait}`, 12, y);
      y += 5;
      if (y > 280){ doc.addPage(); y = 20; }
    });
    y += 4;
  });

  doc.save("hygiene.pdf");
});

/***********************
 *  INVENTAIRE / PÉREMPTION
 ***********************/
const invDate = document.getElementById("invDate");
const emplacementsInv = [
  "Chambre à bac","Chambre de pousse 1","Chambre de pousse 2",
  "Congélateur 1","Congélateur 2","Surgélateur",
  "Chambre viennoiserie","Chambre froide pâtisserie","Vitrine magasin",
  "Réserve","Magasin","Autre"
];

invDate.value = todayISO();
const invProduit = document.getElementById("invProduit");
const invForm = document.getElementById("invForm");
const invListe = document.getElementById("invListe");
const invListeTitle = document.getElementById("invListeTitle");
const invCatFilter = document.getElementById("invCatFilter");
const btnInvHistoryAll = document.getElementById("btnInvHistoryAll");
const btnExportInvAllCSV = document.getElementById("btnExportInvAllCSV");
const btnExportInvAllPDF = document.getElementById("btnExportInvAllPDF");
const invHistoryFilters = document.getElementById("invHistoryFilters");
const invFrom = document.getElementById("invFrom");
const invTo = document.getElementById("invTo");
const invSearch = document.getElementById("invSearch");
const invCatFilterAll = document.getElementById("invCatFilterAll");
const btnApplyInvFilters = document.getElementById("btnApplyInvFilters");
const btnClearInvFilters = document.getElementById("btnClearInvFilters");
let invViewMode = "product";

const invStockCard = document.getElementById("invStockCard");
const invStockInfo = document.getElementById("invStockInfo");
const invSortByExp = document.getElementById("invSortByExp");
function setInvListTitle(txt){ if (invListeTitle) invListeTitle.textContent = txt; }

const produitsDefault = [
  { nom: "Farine T65", unite: "kg", cat: "boulangerie", min: 10 },
  { nom: "Farine T55", unite: "kg", cat: "boulangerie", min: 10 },
  { nom: "Levure", unite: "g", cat: "boulangerie", min: 500 },
  { nom: "Beurre", unite: "kg", cat: "patisserie", min: 5 },
  { nom: "Lait", unite: "L", cat: "patisserie" },
  { nom: "Crème", unite: "L", cat: "patisserie" },
  { nom: "Œufs / ovoproduits", unite: "pièces", cat: "patisserie" },
  { nom: "Chocolat", unite: "kg", cat: "patisserie" },
  { nom: "Jambon", unite: "kg", cat: "snacking" },
  { nom: "Fromages", unite: "kg", cat: "snacking" },
  { nom: "Salade", unite: "pièces", cat: "snacking" },
  { nom: "Tomates", unite: "kg", cat: "snacking" },
  { nom: "Sauces", unite: "kg/L", cat: "snacking" }
];

function normalizeCatalogue(list){
  return list.map(p => ({
    nom: p.nom,
    unite: p.unite,
    cat: p.cat || "autre",
    min: (p.min === undefined || p.min === null || p.min === "") ? "" : Number(p.min)
  }));
}
function loadCatalogue(){
  const saved = readLS(LS_PRODS);
  if (saved.length){
    const norm = normalizeCatalogue(saved);
    writeLS(LS_PRODS, norm);
    return norm;
  }
  writeLS(LS_PRODS, produitsDefault);
  return produitsDefault;
}
function saveCatalogue(list){ writeLS(LS_PRODS, normalizeCatalogue(list)); }
let produitsBase = loadCatalogue();

function invStatus(expISO){
  if (!expISO) return "muted";
  const today = new Date(todayISO());
  const exp = new Date(expISO);
  const diff = Math.round((exp - today) / (1000*60*60*24));
  if (diff < 0) return "bad";
  if (diff <= 3) return "warn";
  return "ok";
}


function computeStockForProduct(productName){
  const rows = readLS(LS.inv).filter(r => r.produit === productName);
  let stock = 0;
  rows.forEach(r => {
    const q = Number(r.quantite);
    if (isNaN(q)) return;
    const mvt = r.mouvement || "entree";
    stock += (mvt === "sortie") ? -q : q;
  });
  return stock;
}

function stockStatus(stock, min){
  if (min === "" || min === undefined || min === null || isNaN(Number(min))) return "muted";
  const m = Number(min);
  if (stock < m) return "bad";
  if (stock < m * 1.2) return "warn";
  return "ok";
}

function updateStockUI(){
  if (!invStockInfo || !invStockCard) return;
  const p = produitsBase.find(x => x.nom === invProduit.value);
  if (!p){ invStockInfo.textContent = "—"; invStockCard.classList.remove("ok","warn","bad"); return; }
  const stock = computeStockForProduct(p.nom);
  const st = stockStatus(stock, p.min);
  invStockCard.classList.remove("ok","warn","bad");
  if (st === "ok") invStockCard.classList.add("ok");
  if (st === "warn") invStockCard.classList.add("warn");
  if (st === "bad") invStockCard.classList.add("bad");

  const minTxt = (p.min === "" || p.min === undefined) ? "—" : p.min;
  invStockInfo.innerHTML = `Stock actuel : <b>${stock.toFixed(2)}</b> ${p.unite} · Stock mini : <b>${minTxt}</b>`;
}


function renderInvSelect(){
  const filter = invCatFilter ? invCatFilter.value : "all";
  produitsBase = loadCatalogue();
  const list = (filter === "all") ? produitsBase : produitsBase.filter(p => p.cat === filter);

  invProduit.innerHTML = "";
  if (!list.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aucun produit dans cette catégorie";
    invProduit.appendChild(opt);
    return;
  }
  list.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nom;
    opt.textContent = `${p.nom} (${p.unite})`;
    invProduit.appendChild(opt);
  });
  if (!list.some(p => p.nom === invProduit.value)) invProduit.value = list[0].nom;
}

function renderInvForm(){
  const p = produitsBase.find(x => x.nom === invProduit.value);
  if (!p){ invForm.innerHTML = ""; invListe.innerHTML = ""; return; }

  invForm.innerHTML = `
    <div class="card" id="inv-card">
      <div class="card-title">${p.nom} (${p.unite})</div>

      <div class="row row-split">
        <div>
          <div class="small">Mouvement</div>
          <select id="inv-mvt">
            <option value="entree">Entrée (réception)</option>
            <option value="sortie">Sortie (utilisation)</option>
          </select>
        </div>
        <div>
          <div class="small">Quantité</div>
          <input type="number" step="0.1" id="inv-q" placeholder="Ex : 5">
        </div>
      </div>

      <div class="row row-split">
        <div>
          <div class="small">DLC / DLUO</div>
          <input type="date" id="inv-exp">
        </div>
        <div>
          <div class="small">Emplacement</div>
          <select id="inv-loc"></select>
        </div>
      </div>

      <div class="row row-split">
        <div>
          <div class="small">N° de lot</div>
          <input type="text" id="inv-lot" placeholder="Optionnel">
        </div>
        <div>
          <div class="small">Fournisseur</div>
          <input type="text" id="inv-four" placeholder="Optionnel">
        </div>
      </div>

      <div class="small">Couleur DLC : 🟢 OK · 🟠 ≤ 3 jours · 🔴 périmé</div>
    </div>
  `;

  const locSel = document.getElementById("inv-loc");
  locSel.innerHTML = "";
  emplacementsInv.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l; opt.textContent = l;
    locSel.appendChild(opt);
  });

  const expInput = document.getElementById("inv-exp");
  expInput.addEventListener("change", () => {
    const st = invStatus(expInput.value);
    const card = document.getElementById("inv-card");
    card.classList.remove("ok","warn","bad");
    if (st === "ok") card.classList.add("ok");
    if (st === "warn") card.classList.add("warn");
    if (st === "bad") card.classList.add("bad");
  });

  renderInvListe();
  updateStockUI();
}


function getCatByProduct(productName){
  const p = produitsBase.find(x => x.nom === productName);
  return (p && p.cat) ? p.cat : "autre";
}

function renderInvListe(){
  invViewMode = "product";
  if (invHistoryFilters) invHistoryFilters.style.display = "none";
  const p = produitsBase.find(x => x.nom === invProduit.value);
  if (!p){ invListe.innerHTML = ""; return; }
  setInvListTitle(`Historique du produit : ${p.nom}`);

  let rows = readLS(LS.inv).filter(r => r.produit === p.nom).slice();
  // Tri : DLC la plus proche (contrôle) ou ordre d'enregistrement
  const sortByExp = invSortByExp ? invSortByExp.checked : true;
  if (sortByExp){
    rows.sort((a,b) => {
      const da = a.peremption || "9999-12-31";
      const db = b.peremption || "9999-12-31";
      if (da < db) return -1;
      if (da > db) return 1;
      return 0;
    });
  } else {
    rows = rows.reverse();
  }

  invListe.innerHTML = "";
  if (!rows.length){ invListe.innerHTML = `<div class="small">Aucune entrée pour ce produit.</div>`; return; }

  rows.slice(0, 25).forEach(r => {
    const st = invStatus(r.peremption);
    const card = document.createElement("div");
    card.className = "card";
    if (st === "ok") card.classList.add("ok");
    if (st === "warn") card.classList.add("warn");
    if (st === "bad") card.classList.add("bad");
    card.innerHTML = `
      <div class="card-title">${r.date} (${r.datetime})</div>
      <div class="small">Employé : <b>${r.employee || "-"}</b></div>
      <div class="small">Mouvement : <b>${(r.mouvement==="sortie"?"Sortie":"Entrée")}</b></div>
      <div class="small">Quantité : <b>${(r.mouvement==="sortie"?"-":"+")}${r.quantite || "-"}</b> ${p.unite}</div>
      <div class="small">Emplacement : <b>${r.emplacement || "-"}</b></div>
      <div class="small">Employé : <b>${r.employee || "-"}</b></div>
      <div class="small">DLC/DLUO : <b>${r.peremption || "-"}</b></div>
      <div class="small">Emplacement : <b>${r.emplacement || "-"}</b></div>
      <div class="small">Lot : <b>${r.lot || "-"}</b> · Fournisseur : <b>${r.fournisseur || "-"}</b></div>
    `;
    invListe.appendChild(card);
  });
}

function isRiskStatus(status){ return status === "warn" || status === "bad"; }
function computeRiskList(){
  const rows = readLS(LS.inv);
  const lastByProduct = new Map();
  rows.forEach(r => lastByProduct.set(r.produit, r));
  const risks = [];
  lastByProduct.forEach(r => {
    const st = invStatus(r.peremption);
    if (isRiskStatus(st)) risks.push({ ...r, _status: st });
  });
  risks.sort((a,b) => (a._status === b._status ? 0 : (a._status === "bad" ? -1 : 1)));
  return risks;
}
function renderRiskList(){
  invViewMode = "risk";
  if (invHistoryFilters) invHistoryFilters.style.display = "none";
  const risks = computeRiskList();
  setInvListTitle("⚠️ Produits à risque (dernières entrées)");
  invListe.innerHTML = "";
  if (!risks.length){ invListe.innerHTML = `<div class="small">✅ Aucun produit à risque (DLC OK).</div>`; return; }
  risks.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    if (r._status === "warn") card.classList.add("warn");
    if (r._status === "bad") card.classList.add("bad");
    card.innerHTML = `
      <div class="card-title">${r.produit}</div>
      <div class="small">Employé : <b>${r.employee || "-"}</b></div>
      <div class="small">DLC/DLUO : <b>${r.peremption || "-"}</b></div>
      <div class="small">Emplacement : <b>${r.emplacement || "-"}</b></div>
      <div class="small">Lot : <b>${r.lot || "-"}</b> · Fournisseur : <b>${r.fournisseur || "-"}</b></div>
      <div class="small">Dernière entrée : ${r.date} (${r.datetime})</div>
    `;
    invListe.appendChild(card);
  });
}


function getAllMovementsFiltered(){
  const rows = readLS(LS.inv).slice(); // chronological
  const from = invFrom && invFrom.value ? invFrom.value : "";
  const to = invTo && invTo.value ? invTo.value : "";
  const q = invSearch ? (invSearch.value||"").trim().toLowerCase() : "";
  const cat = invCatFilterAll ? invCatFilterAll.value : "all";

  return rows.filter(r => {
    if (from && (r.date||"") < from) return false;
    if (to && (r.date||"") > to) return false;
    if (q && !(r.produit||"").toLowerCase().includes(q)) return false;
    if (cat !== "all" && getCatByProduct(r.produit) !== cat) return false;
    return true;
  });
}

function renderAllHistory(){
  invViewMode = "all";
  if (invHistoryFilters) invHistoryFilters.style.display = "block";
  setInvListTitle("📜 Historique complet (tous produits)");
  const rows = getAllMovementsFiltered().slice().reverse(); // newest first
  invListe.innerHTML = "";
  if (!rows.length){
    invListe.innerHTML = `<div class="small">Aucun mouvement pour ces filtres.</div>`;
    return;
  }

  // Stock actuel par produit (calcul sur tous mouvements)
  const all = readLS(LS.inv);
  const stockBy = new Map();
  all.forEach(r => {
    const q = Number(r.quantite);
    if (isNaN(q)) return;
    const mvt = r.mouvement || "entree";
    const sign = (mvt === "sortie") ? -1 : 1;
    stockBy.set(r.produit, (stockBy.get(r.produit)||0) + sign*q);
  });

  rows.slice(0, 160).forEach(r => {
    const p = produitsBase.find(x => x.nom === r.produit) || { unite: r.unite || "", min: "" };
    const expSt = invStatus(r.peremption);
    const cur = Number(stockBy.get(r.produit) || 0);
    const stSt = stockStatus(cur, p.min);
    const risk = (expSt==="warn"||expSt==="bad"||stSt==="warn"||stSt==="bad");

    const card = document.createElement("div");
    card.className = "card";
    if (risk){
      if (expSt==="bad"||stSt==="bad") card.classList.add("bad"); else card.classList.add("warn");
    } else card.classList.add("ok");

    const mvtLabel = (r.mouvement==="sortie") ? "Sortie" : "Entrée";
    const qtyTxt = `${(r.mouvement==="sortie"?"-":"+")}${r.quantite}`;
    card.innerHTML = `
      <div class="card-title">${r.date} (${r.datetime}) – ${r.produit}</div>
      <div class="small"><b>${mvtLabel}</b> : <b>${qtyTxt}</b> ${p.unite || ""} · Employé : <b>${r.employee || "-"}</b></div>
      <div class="small">Emplacement : <b>${r.emplacement || "-"}</b></div>
      <div class="small">DLC/DLUO : <b>${r.peremption || "-"}</b> · Lot : <b>${r.lot || "-"}</b> · Fournisseur : <b>${r.fournisseur || "-"}</b></div>
      <div class="small">Stock actuel produit : <b>${cur.toFixed ? cur.toFixed(2) : cur}</b> ${p.unite || ""}${(p.min!==""&&p.min!==undefined&&p.min!==null)?` (min ${p.min})`:``}</div>
    `;
    invListe.appendChild(card);
  });
}

document.getElementById("btnRiskInv").addEventListener("click", () => renderRiskList());
btnApplyInvFilters && btnApplyInvFilters.addEventListener("click", () => renderAllHistory());
btnClearInvFilters && btnClearInvFilters.addEventListener("click", () => { if(invFrom) invFrom.value=""; if(invTo) invTo.value=""; if(invSearch) invSearch.value=""; if(invCatFilterAll) invCatFilterAll.value="all"; renderAllHistory(); });

btnInvHistoryAll && btnInvHistoryAll.addEventListener("click", () => renderAllHistory());


document.getElementById("btnExportRiskCSV").addEventListener("click", () => {
  const risks = computeRiskList();
  if (!risks.length) return alert("Aucun produit à risque à exporter !");
  const csv = toCSV(risks, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"produit", label:"Produit"},
    {key:"unite", label:"Unité"},
    {key:"mouvement", label:"Mouvement"},
    {key:"quantite", label:"Quantité"},
    {key:"peremption", label:"DLC/DLUO"},
    {key:"emplacement", label:"Emplacement"},
    {key:"lot", label:"N° Lot"},
    {key:"fournisseur", label:"Fournisseur"},
    {key:"employee", label:"Employé"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "inventaire_risque.csv");
});

document.getElementById("btnExportRiskPDF").addEventListener("click", () => {
  const risks = computeRiskList();
  if (!risks.length) return alert("Aucun produit à risque à exporter !");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Produits à risque`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);

  let y = 30;
  risks.forEach(r => {
    const line = `${r.produit} | ${(r.mouvement==="sortie"?"Sortie":"Entrée")}: ${(r.mouvement==="sortie"?"-":"+")}${r.quantite || "-"} ${r.unite||""} | DLC: ${r.peremption || "-"} | Loc: ${r.emplacement || "-"} | Lot: ${r.lot || "-"} | ${r.fournisseur || "-"} | Emp: ${r.employee || "-"}`;
    doc.text(line.substring(0, 110), 10, y);
    y += 6;
    if (y > 280){ doc.addPage(); y = 20; }
  });
  doc.save("inventaire_risque.pdf");
});

document.getElementById("btnAddInv").addEventListener("click", () => {
  if (!mustHaveEmployee()) return;
  const p = produitsBase.find(x => x.nom === invProduit.value);
  if (!p) return alert("Choisis un produit valide.");
  const mvt = document.getElementById("inv-mvt").value;
  const qRaw = document.getElementById("inv-q").value;
  const q = (qRaw === "" ? "" : Number(qRaw));
  if (q === "" || isNaN(q) || q <= 0) return alert("Quantité invalide.");
  const entry = {
    date: invDate.value || todayISO(),
    datetime: nowLocale(),
    produit: p.nom,
    unite: p.unite,
    mouvement: mvt,
    quantite: q,
    peremption: document.getElementById("inv-exp").value || "",
    emplacement: document.getElementById("inv-loc").value || "",
    lot: document.getElementById("inv-lot").value || "",
    fournisseur: document.getElementById("inv-four").value || "",
    employee: employeeSelect.value || ""
  };
  const rows = readLS(LS.inv); rows.push(entry); writeLS(LS.inv, rows);

  document.getElementById("inv-q").value = "";
  document.getElementById("inv-mvt").value = "entree";
  document.getElementById("inv-exp").value = "";
  document.getElementById("inv-lot").value = "";
  document.getElementById("inv-four").value = "";
  const card = document.getElementById("inv-card"); if (card) card.classList.remove("ok","warn","bad");

  if (invViewMode === "all") {
    renderAllHistory();
  } else if (invViewMode === "risk") {
    renderRiskList();
  } else {
    renderInvListe();
  }
  updateStockUI();
  alert("Entrée produit ajoutée ✔️");
});

document.getElementById("btnExportInvCSV").addEventListener("click", () => {
  const rows = readLS(LS.inv);
  if (!rows.length) return alert("Aucune donnée à exporter !");
  const csv = toCSV(rows, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"produit", label:"Produit"},
    {key:"unite", label:"Unité"},
    {key:"mouvement", label:"Mouvement"},
    {key:"quantite", label:"Quantité"},
    {key:"peremption", label:"DLC/DLUO"},
    {key:"emplacement", label:"Emplacement"},
    {key:"lot", label:"N° Lot"},
    {key:"fournisseur", label:"Fournisseur"},
    {key:"employee", label:"Employé"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "inventaire.csv");
});

document.getElementById("btnExportInvPDF").addEventListener("click", () => {
  const p = produitsBase.find(x => x.nom === invProduit.value);
  if (!p) return alert("Choisis un produit valide.");
  const rows = readLS(LS.inv).filter(r => r.produit === p.nom);
  if (!rows.length) return alert("Aucune entrée pour ce produit !");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Inventaire: ${p.nom}`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);
  let y = 30;
  rows.slice(-80).forEach(r => {
    const line = `${r.date} ${r.datetime} | Emp: ${r.employee || "-"} | ${(r.mouvement==="sortie"?"Sortie":"Entrée")}: ${(r.mouvement==="sortie"?"-":"+")}${r.quantite || "-"} ${p.unite} | Loc: ${r.emplacement || "-"} | DLC: ${r.peremption || "-"}`;
    doc.text(line.substring(0, 110), 10, y);
    y += 6;
    if (y > 280){ doc.addPage(); y = 20; }
  });
  doc.save(`inventaire_${p.nom.split(" ").join("_")}.pdf`);
});

function refreshCatalogueAndUI(){ produitsBase = loadCatalogue(); renderInvSelect(); renderInvForm(); updateStockUI(); }

document.getElementById("btnAddProduct").addEventListener("click", () => {
  const name = document.getElementById("newProdName").value.trim();
  const unit = document.getElementById("newProdUnit").value.trim();
  const cat = document.getElementById("newProdCat").value;
  const minRaw = document.getElementById("newProdMin").value;
  const min = (minRaw === "" ? "" : Number(minRaw));
  if (!name || !unit) return alert("Nom et unité sont obligatoires 🙂");
  produitsBase = loadCatalogue();
  if (produitsBase.some(p => p.nom.toLowerCase() === name.toLowerCase())) return alert("Ce produit existe déjà.");
  produitsBase.push({ nom:name, unite:unit, cat, min });
  saveCatalogue(produitsBase);

  document.getElementById("newProdName").value = "";
  document.getElementById("newProdUnit").value = "";
  document.getElementById("newProdMin").value = "";
  invCatFilter.value = cat;
  refreshCatalogueAndUI();
  invProduit.value = name;
  renderInvForm();
  alert("Produit ajouté au catalogue ✔️");
});

document.getElementById("btnResetProducts").addEventListener("click", () => {
  if (!confirm("Revenir au catalogue par défaut ?")) return;
  saveCatalogue(produitsDefault);
  invCatFilter.value = "all";
  refreshCatalogueAndUI();
  alert("Catalogue réinitialisé ✔️");
});

document.getElementById("btnDeleteProduct").addEventListener("click", () => {
  const name = invProduit.value;
  if (!name) return;
  if (!confirm(`Supprimer "${name}" du catalogue ?\n\n⚠️ L'historique reste.`)) return;
  produitsBase = loadCatalogue().filter(p => p.nom !== name);
  saveCatalogue(produitsBase);
  refreshCatalogueAndUI();
  alert("Produit supprimé ✔️");
});

invCatFilter.addEventListener("change", () => { renderInvSelect(); renderInvForm(); setInvListTitle("Historique du produit"); });
invProduit.addEventListener("change", () => { renderInvForm(); setInvListTitle("Historique du produit"); });
if (invSortByExp){ invSortByExp.addEventListener("change", () => renderInvListe()); }

renderInvSelect(); renderInvForm();


// Exports historique complet (applique les filtres si en mode Historique complet)
btnExportInvAllCSV && btnExportInvAllCSV.addEventListener("click", () => {
  const rows = getAllMovementsFiltered();
  if (!rows.length) return alert("Aucune donnée à exporter (filtres actuels).");
  const csv = toCSV(rows, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"produit", label:"Produit"},
    {key:"unite", label:"Unité"},
    {key:"mouvement", label:"Mouvement"},
    {key:"quantite", label:"Quantité"},
    {key:"peremption", label:"DLC/DLUO"},
    {key:"emplacement", label:"Emplacement"},
    {key:"lot", label:"N° Lot"},
    {key:"fournisseur", label:"Fournisseur"},
    {key:"employee", label:"Employé"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "inventaire_complet.csv");
});

btnExportInvAllPDF && btnExportInvAllPDF.addEventListener("click", () => {
  const rows = getAllMovementsFiltered();
  if (!rows.length) return alert("Aucune donnée à exporter (filtres actuels).");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Inventaire (historique complet)`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);
  let y = 30;
  rows.slice(-220).forEach(r => {
    const p = produitsBase.find(x => x.nom === r.produit) || { unite: r.unite || "" };
    const mvtLabel = (r.mouvement==="sortie") ? "Sortie" : "Entrée";
    const line = `${r.date} ${r.datetime} | ${r.produit} | ${mvtLabel}: ${(r.mouvement==="sortie"?"-":"+")}${r.quantite} ${p.unite||""} | Emp: ${r.employee||"-"} | Loc: ${r.emplacement||"-"} | DLC: ${r.peremption||"-"}`;
    doc.text(line.substring(0, 110), 10, y);
    y += 6;
    if (y > 280){ doc.addPage(); y = 20; }
  });
  doc.save("inventaire_complet.pdf");
});


/***********************
 *  NOTES
 ***********************/
const notesDate = document.getElementById("notesDate");
notesDate.value = todayISO();
const notesTexte = document.getElementById("notesTexte");
const notesListe = document.getElementById("notesListe");

function renderNotesList(){
  const rows = readLS(LS.notes).slice().reverse();
  notesListe.innerHTML = "";
  if (!rows.length){ notesListe.innerHTML = `<div class="small">Aucune note enregistrée.</div>`; return; }
  rows.slice(0, 30).forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="card-title">${r.date} (${r.datetime})</div><div class="small"></div>`;
    card.querySelector(".small").textContent = r.texte;
    notesListe.appendChild(card);
  });
}

document.getElementById("btnSaveNotes").addEventListener("click", () => {
  const date = notesDate.value || todayISO();
  const texte = notesTexte.value.trim();
  if (!texte) return alert("Écris une note avant d’enregistrer 🙂");
  const rows = readLS(LS.notes);
  rows.push({ date, datetime: nowLocale(), texte });
  writeLS(LS.notes, rows);
  notesTexte.value = "";
  renderNotesList();
  alert("Note enregistrée ✔️");
});

document.getElementById("btnExportNotesCSV").addEventListener("click", () => {
  const rows = readLS(LS.notes);
  if (!rows.length) return alert("Aucune note à exporter !");
  const csv = toCSV(rows, [
    {key:"date", label:"Date"},
    {key:"datetime", label:"Date/Heure"},
    {key:"texte", label:"Note"}
  ]);
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "notes.csv");
});

document.getElementById("btnExportNotesPDF").addEventListener("click", () => {
  const rows = readLS(LS.notes);
  if (!rows.length) return alert("Aucune note à exporter !");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${(bakeryName.value||"Boulangerie")} – Notes / Observations`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 20);
  let y = 30;
  rows.slice(-40).forEach(r => {
    doc.setFontSize(11);
    doc.text(`${r.date} (${r.datetime})`, 10, y); y += 6;
    const lines = splitToLines(doc, r.texte, 180);
    doc.setFontSize(10);
    doc.text(lines, 12, y);
    y += lines.length*5 + 4;
    if (y > 280){ doc.addPage(); y = 20; }
  });
  doc.save("notes.pdf");
});

renderNotesList();

/***********************
 *  STATS mensuelles
 ***********************/
const statsMonth = document.getElementById("statsMonth");
statsMonth.value = monthISO();
document.getElementById("btnRefreshStats").addEventListener("click", refreshStats);

let chartStatsTemps, chartStatsHyg, chartStatsInv;

function refreshStats(){
  const m = statsMonth.value || monthISO();
  const temps = readLS(LS.temps).filter(r => (r.date||"").startsWith(m));
  const hyg = readLS(LS.hygiene).filter(r => (r.date||"").startsWith(m));
  const inv = readLS(LS.inv).filter(r => (r.date||"").startsWith(m));
  const notes = readLS(LS.notes).filter(r => (r.date||"").startsWith(m));

  let ok=0,warn=0,bad=0;
  temps.forEach(r => {
    const z = zones.find(x => x.nom === r.zone);
    const st = tempStatus(z || {}, Number(r.temperature));
    if (st==="ok") ok++; else if (st==="warn") warn++; else if (st==="bad") bad++;
  });
  document.getElementById("statsTemps").textContent = `Entrées: ${temps.length} | OK: ${ok} | Limite: ${warn} | Alerte: ${bad}`;
  const ctxT = document.getElementById("chartStatsTemps").getContext("2d");
  if (chartStatsTemps) chartStatsTemps.destroy();
  chartStatsTemps = new Chart(ctxT, { type:"bar", data:{ labels:["OK","Limite","Alerte"], datasets:[{ label:"Températures", data:[ok,warn,bad] }] }, options:{ scales:{ y:{ beginAtZero:true } } } });

  let totalItems = 0, doneItems = 0;
  hyg.forEach(r => {
    (r.items||[]).forEach(it => { totalItems++; if ((it.fait||"") === "oui") doneItems++; });
  });
  const pct = totalItems ? Math.round((doneItems/totalItems)*100) : 0;
  document.getElementById("statsHyg").textContent = `Relevés: ${hyg.length} | Tâches faites: ${doneItems}/${totalItems} (${pct}%)`;
  const ctxH = document.getElementById("chartStatsHyg").getContext("2d");
  if (chartStatsHyg) chartStatsHyg.destroy();
  chartStatsHyg = new Chart(ctxH, { type:"bar", data:{ labels:["Fait","Non fait"], datasets:[{ label:"Hygiène", data:[doneItems, Math.max(totalItems-doneItems,0)] }] }, options:{ scales:{ y:{ beginAtZero:true } } } });

  let invRisk = 0;
  inv.forEach(r => { const st = invStatus(r.peremption); if (st==="warn" || st==="bad") invRisk++; });
  document.getElementById("statsInv").textContent = `Entrées: ${inv.length} | Entrées à risque: ${invRisk}`;
  const ctxI = document.getElementById("chartStatsInv").getContext("2d");
  if (chartStatsInv) chartStatsInv.destroy();
  chartStatsInv = new Chart(ctxI, { type:"bar", data:{ labels:["OK","Risque"], datasets:[{ label:"Inventaire", data:[inv.length-invRisk, invRisk] }] }, options:{ scales:{ y:{ beginAtZero:true } } } });

  document.getElementById("statsNotes").textContent = `Notes: ${notes.length}`;
}
refreshStats();

/***********************
 *  Inspection sanitaire PDF
 ***********************/
const inspMonth = document.getElementById("inspMonth");
inspMonth.value = monthISO();

document.getElementById("btnGenerateInspection").addEventListener("click", () => {
  const m = inspMonth.value || monthISO();
  const includeNotes = document.getElementById("inspIncludeNotes").checked;

  const temps = readLS(LS.temps).filter(r => (r.date||"").startsWith(m));
  const hyg = readLS(LS.hygiene).filter(r => (r.date||"").startsWith(m));
  const inv = readLS(LS.inv).filter(r => (r.date||"").startsWith(m));
  const notes = readLS(LS.notes).filter(r => (r.date||"").startsWith(m));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const bakery = bakeryName.value || "Boulangerie";

  doc.setFontSize(18);
  doc.text(`${bakery}`, 10, 14);
  doc.setFontSize(14);
  doc.text(`Rapport inspection sanitaire – ${m}`, 10, 24);
  doc.setFontSize(11);
  doc.text(`Généré le ${nowLocale()}`, 10, 32);

  let y = 42;
  function section(title){
    doc.setFontSize(13);
    doc.text(title, 10, y);
    y += 6;
    doc.setDrawColor(0);
    doc.line(10, y, 200, y);
    y += 8;
  }
  function ensureSpace(lines=1){
    if (y + lines*6 > 280){ doc.addPage(); y = 20; }
  }

  section("1) Températures (relevés)");
  doc.setFontSize(10);
  doc.text(`Nombre d'entrées: ${temps.length}`, 10, y); y += 6;

  let badList = [];
  temps.forEach(r => {
    const z = zones.find(x => x.nom === r.zone);
    const st = tempStatus(z || {}, Number(r.temperature));
    if (st === "bad") badList.push(r);
  });
  doc.text(`Anomalies (alerte rouge): ${badList.length}`, 10, y); y += 8;

  if (badList.length){
    badList.slice(-25).forEach(r => {
      ensureSpace(1);
      doc.text(`- ${r.date} ${r.periode} – ${r.zone}: ${r.temperature}°C (Employé: ${r.employee||"-"})`, 12, y);
      y += 5;
    });
    y += 4;
  }

  section("2) Hygiène / Nettoyage");
  const totalItems = hyg.reduce((acc,r)=> acc + (r.items||[]).length, 0);
  const doneItems = hyg.reduce((acc,r)=> acc + (r.items||[]).filter(it => it.fait==="oui").length, 0);
  const pct = totalItems ? Math.round((doneItems/totalItems)*100) : 0;
  doc.setFontSize(10);
  doc.text(`Relevés: ${hyg.length} | Tâches faites: ${doneItems}/${totalItems} (${pct}%)`, 10, y); y += 8;

  if (hyg.length){
    const last = hyg[hyg.length-1];
    doc.text(`Dernier relevé: ${last.date} ${last.periode} (Employé: ${last.employee||"-"})`, 10, y); y += 6;
    (last.items||[]).forEach(it => {
      ensureSpace(1);
      doc.text(`- ${it.tache}: ${it.fait}`, 12, y); y += 5;
    });
    y += 4;
  }

  section("3) Inventaire / Péremption");
  const invRisk = inv.filter(r => { const st = invStatus(r.peremption); return st==="warn"||st==="bad"; });
  doc.setFontSize(10);
  doc.text(`Entrées: ${inv.length} | Entrées à risque: ${invRisk.length}`, 10, y); y += 8;

  if (invRisk.length){
    invRisk.slice(-30).forEach(r => {
      ensureSpace(1);
      doc.text(`- ${r.date} – ${r.produit}: ${(r.mouvement==="sortie"?"Sortie":"Entrée")} ${(r.mouvement==="sortie"?"-":"+")}${r.quantite||"-"} ${r.unite||""} | Loc ${r.emplacement||"-"} | DLC ${r.peremption || "-"} | Lot ${r.lot||"-"} | ${r.fournisseur||"-"} | Emp: ${r.employee||"-"}`, 12, y);
      y += 5;
    });
    y += 4;
  } else {
    doc.text("Aucun produit à risque sur la période.", 10, y); y += 8;
  }

  if (includeNotes){
    section("4) Notes / Observations");
    doc.setFontSize(10);
    doc.text(`Notes: ${notes.length}`, 10, y); y += 8;
    notes.slice(-15).forEach(r => {
      ensureSpace(2);
      doc.text(`${r.date} – ${r.datetime}`, 10, y); y += 5;
      const lines = splitToLines(doc, r.texte, 180);
      doc.text(lines, 12, y);
      y += lines.length*5 + 4;
    });
  }

  ensureSpace(2);
  doc.setFontSize(9);
  doc.text("Document généré par l'application (données locales).", 10, 290);

  
  // 5) Validations de journée
  section("5) Validations de journée");
  const vals = loadValidations().filter(v => v.month === m);
  doc.setFontSize(10);
  doc.text(`Validations: ${vals.length}`, 10, y); y += 8;
  if (vals.length){
    vals.slice(-31).forEach(v => {
      ensureSpace(1);
      doc.text(`- ${v.date} – ${v.employee||"-"} | Temp: ${v.tempsCount} (alertes ${v.tempsBad}) | Inv: risques ${v.invRiskCount}`, 12, y);
      y += 5;
    });
    y += 4;
  } else {
    doc.text("Aucune validation enregistrée sur la période.", 10, y); y += 8;
  }

  // 6) Actions correctives
  section("6) Actions correctives");
  const acts = loadCorrectives().filter(a => a.month === m);
  doc.setFontSize(10);
  doc.text(`Actions: ${acts.length}`, 10, y); y += 8;
  if (acts.length){
    acts.slice(-40).forEach(a => {
      ensureSpace(2);
      doc.text(`- ${a.date} – ${a.cat}${a.target?(" · "+a.target):""} (Emp: ${a.employee||"-"})`, 12, y); y += 5;
      const l1 = splitToLines(doc, "Anomalie: " + a.issue, 180);
      doc.text(l1, 14, y); y += l1.length*5;
      const l2 = splitToLines(doc, "Action: " + a.action, 180);
      doc.text(l2, 14, y); y += l2.length*5 + 2;
    });
  } else {
    doc.text("Aucune action corrective enregistrée sur la période.", 10, y); y += 8;
  }

doc.save(`inspection_${bakery.split(" ").join("_")}_${m}.pdf`);
});


/***********************
 *  Modal Action corrective
 ***********************/
const modalCorrective = document.getElementById("modalCorrective");
const corrCat = document.getElementById("corrCat");
const corrDate = document.getElementById("corrDate");
const corrTarget = document.getElementById("corrTarget");
const corrIssue = document.getElementById("corrIssue");
const corrAction = document.getElementById("corrAction");
const corrEmp = document.getElementById("corrEmp");

function openCorrective(pref={}){
  if (!modalCorrective) return;
  corrDate.value = pref.date || todayISO();
  corrCat.value = pref.cat || "autre";
  corrTarget.value = pref.target || "";
  corrIssue.value = pref.issue || "";
  corrAction.value = pref.action || "";
  corrEmp.textContent = employeeSelect.value || "—";
  modalCorrective.style.display = "flex";
}
function closeCorrective(){
  if (!modalCorrective) return;
  modalCorrective.style.display = "none";
}

document.getElementById("btnCloseCorrective")?.addEventListener("click", closeCorrective);
modalCorrective?.addEventListener("click", (e) => { if (e.target === modalCorrective) closeCorrective(); });

document.getElementById("btnSaveCorrective")?.addEventListener("click", () => {
  if (!mustHaveEmployee()) return;
  const issue = (corrIssue.value || "").trim();
  const action = (corrAction.value || "").trim();
  const target = (corrTarget.value || "").trim();
  if (!issue || !action) return alert("Merci de renseigner l'anomalie et l'action corrective.");
  pushCorrective({
    id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    date: corrDate.value || todayISO(),
    month: monthKeyFromISO(corrDate.value || todayISO()),
    cat: corrCat.value,
    target,
    issue,
    action,
    employee: employeeSelect.value || "",
    createdAt: nowLocale()
  });
  closeCorrective();
  refreshSuivi();
  alert("Action corrective enregistrée ✔️");
});

// Quick buttons
document.getElementById("btnAddCorrectiveTemp")?.addEventListener("click", () => {
  openCorrective({cat:"temperature", target:""});
});
document.getElementById("btnAddCorrectiveInv")?.addEventListener("click", () => {
  const p = document.getElementById("invProduit")?.value || "";
  openCorrective({cat:"inventaire", target:p});
});

/***********************
 *  Validation de journée
 ***********************/
document.getElementById("btnValidateDay")?.addEventListener("click", () => {
  if (!mustHaveEmployee()) return;
  const date = todayISO();
  const temps = readLS(LS.temps).filter(r => r.date === date);
  const hyg = readLS(LS.hygiene).filter(r => r.date === date);
  const inv = readLS(LS.inv).filter(r => r.date === date);
  // anomalies températures (bad)
  let badTemps = 0;
  temps.forEach(r => {
    const z = (typeof zones !== "undefined") ? zones.find(x => x.nom === r.zone) : null;
    const st = (typeof tempStatus === "function") ? tempStatus(z || {}, Number(r.temperature)) : "muted";
    if (st === "bad") badTemps++;
  });
  // inventaire risques: DLC warn/bad on today's movements OR stock risk (best effort)
  let invRisk = 0;
  inv.forEach(r => {
    const st = (typeof invStatus === "function") ? invStatus(r.peremption) : "muted";
    if (st === "warn" || st === "bad") invRisk++;
  });

  // hygiene completion snapshot (last record today)
  let hygPct = null;
  if (hyg.length){
    const last = hyg[hyg.length-1];
    const total = (last.items||[]).length;
    const done = (last.items||[]).filter(it => it.fait==="oui").length;
    hygPct = total ? Math.round((done/total)*100) : 0;
  }

  pushValidation({
    id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    date,
    month: monthKeyFromISO(date),
    employee: employeeSelect.value || "",
    tempsCount: temps.length,
    tempsBad: badTemps,
    invCount: inv.length,
    invRiskCount: invRisk,
    hygieneRecords: hyg.length,
    hygienePct: hygPct,
    createdAt: nowLocale()
  });

  refreshSuivi();
  alert("Journée validée ✔️");
});

/***********************
 *  Suivi tab
 ***********************/
const suiviMonth = document.getElementById("suiviMonth");
const btnRefreshSuivi = document.getElementById("btnRefreshSuivi");
const validationsList = document.getElementById("validationsList");
const actionsList = document.getElementById("actionsList");

if (suiviMonth) suiviMonth.value = monthISO();
btnRefreshSuivi?.addEventListener("click", refreshSuivi);

function refreshSuivi(){
  const m = suiviMonth ? (suiviMonth.value || monthISO()) : monthISO();

  // Validations
  if (validationsList){
    const vals = loadValidations().filter(v => v.month === m).slice().reverse();
    validationsList.innerHTML = "";
    if (!vals.length){
      validationsList.innerHTML = `<div class="small">Aucune validation ce mois-ci.</div>`;
    } else {
      vals.slice(0, 60).forEach(v => {
        const card = document.createElement("div");
        card.className = "card";
        const lvl = (v.tempsBad > 0 || v.invRiskCount > 0) ? "warn" : "ok";
        card.classList.add(lvl);
        card.innerHTML = `
          <div class="card-title">${v.date} – ${v.employee || "-"}</div>
          <div class="small">Températures: ${v.tempsCount} (alertes: ${v.tempsBad})</div>
          <div class="small">Inventaire: ${v.invCount} (risques: ${v.invRiskCount})</div>
          <div class="small">Hygiène: ${v.hygieneRecords} ${v.hygienePct===null?"":`(dernier: ${v.hygienePct}%)`}</div>
        `;
        validationsList.appendChild(card);
      });
    }
  }

  // Correctives
  if (actionsList){
    const acts = loadCorrectives().filter(a => a.month === m).slice().reverse();
    actionsList.innerHTML = "";
    if (!acts.length){
      actionsList.innerHTML = `<div class="small">Aucune action corrective ce mois-ci.</div>`;
    } else {
      acts.slice(0, 80).forEach(a => {
        const card = document.createElement("div");
        card.className = "card warn";
        card.innerHTML = `
          <div class="card-title">${a.date} – ${a.cat} ${a.target?("· "+a.target):""}</div>
          <div class="small">Employé : <b>${a.employee || "-"}</b></div>
          <div class="small">Anomalie : ${a.issue}</div>
          <div class="small">Action : ${a.action}</div>
        `;
        actionsList.appendChild(card);
      });
    }
  }
}
refreshSuivi();

/***********************
 *  Alertes du jour + Notifications (1,4)
 ***********************/
const tempAlertsList = document.getElementById("tempAlertsList");

function renderTempAlertsToday(){
  if (!tempAlertsList) return;
  const date = todayISO();
  const temps = readLS(LS.temps).filter(r => r.date === date);
  tempAlertsList.innerHTML = "";
  if (!temps.length){
    tempAlertsList.innerHTML = `<div class="small">Aucun relevé aujourd'hui.</div>`;
    return;
  }
  const bads = [];
  temps.forEach(r => {
    const z = (typeof zones !== "undefined") ? zones.find(x => x.nom === r.zone) : null;
    const st = (typeof tempStatus === "function") ? tempStatus(z || {}, Number(r.temperature)) : "muted";
    if (st === "bad" || st === "warn"){
      bads.push({ ...r, _st: st });
    }
  });
  if (!bads.length){
    tempAlertsList.innerHTML = `<div class="small">✅ Pas d'alerte température aujourd'hui (selon les seuils).</div>`;
    return;
  }
  bads.slice(-40).reverse().forEach(r => {
    const card = document.createElement("div");
    card.className = "card " + (r._st === "bad" ? "bad" : "warn");
    card.innerHTML = `
      <div class="card-title">${r.zone} – ${r.temperature}°C <span class="badge ${r._st}">${r._st==="bad"?"ALERTE":"LIMITE"}</span></div>
      <div class="small">${r.date} · ${r.periode} · Employé: <b>${r.employee || "-"}</b></div>
    `;
    const btn = document.createElement("button");
    btn.textContent = "🔧 Action corrective";
    btn.className = "secondary";
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => openCorrective({
      cat: "temperature",
      date: r.date,
      target: r.zone,
      issue: `Température ${r.temperature}°C (${r.periode})`,
      action: ""
    }));
    const wrap = document.createElement("div");
    wrap.className = "actions";
    wrap.appendChild(btn);
    card.appendChild(wrap);
    tempAlertsList.appendChild(card);
  });
}
renderTempAlertsToday();

function computeDailyMissingTemps(){
  const date = todayISO();
  const temps = readLS(LS.temps).filter(r => r.date === date);
  const hasMatin = temps.some(r => r.periode === "matin");
  const hasAprem = temps.some(r => r.periode === "apres-midi");
  const missing = [];
  if (!hasMatin) missing.push("Matin");
  if (!hasAprem) missing.push("Après-midi");
  return missing;
}

function computeInventoryRiskCount(){
  // Use existing risk list if available, otherwise fallback to DLC risks
  try{
    if (typeof computeRiskList === "function"){
      return computeRiskList().length;
    }
  }catch(e){}
  const rows = readLS(LS.inv);
  let c = 0;
  rows.forEach(r => {
    const st = (typeof invStatus === "function") ? invStatus(r.peremption) : "muted";
    if (st === "warn" || st === "bad") c++;
  });
  return c;
}

function refreshNotifs(){
  clearNotifs();
  const missing = computeDailyMissingTemps();
  if (missing.length){
    showNotif({
      level: "warn",
      title: "Relevé températures manquant",
      msg: `Il manque le relevé : ${missing.join(" + ")} (objectif : 2 fois / jour).`,
      actions: [
        {label:"Aller aux Températures", onClick: () => document.querySelector('.tab[data-tab="temperatures"]')?.click()},
        {label:"Fermer", secondary:true, onClick: (el) => el && el.remove()}
      ]
    });
  }

  // Temp anomalies today
  const date = todayISO();
  const temps = readLS(LS.temps).filter(r => r.date === date);
  let tBad = 0;
  temps.forEach(r => {
    const z = (typeof zones !== "undefined") ? zones.find(x => x.nom === r.zone) : null;
    const st = (typeof tempStatus === "function") ? tempStatus(z || {}, Number(r.temperature)) : "muted";
    if (st === "bad") tBad++;
  });
  if (tBad){
    showNotif({
      level: "bad",
      title: "Alerte températures",
      msg: `${tBad} relevé(s) en alerte rouge aujourd'hui. Pense à ajouter une action corrective si nécessaire.`,
      actions: [
        {label:"Voir alertes du jour", onClick: () => document.querySelector('.tab[data-tab="temperatures"]')?.click()},
        {label:"Ajouter action", secondary:true, onClick: () => openCorrective({cat:"temperature", date: todayISO()})}
      ]
    });
  }

  const invRisk = computeInventoryRiskCount();
  if (invRisk){
    showNotif({
      level: "warn",
      title: "Inventaire à risque",
      msg: `${invRisk} élément(s) à risque (DLC proche/périmé ou stock faible).`,
      actions: [
        {label:"Aller à l'Inventaire", onClick: () => document.querySelector('.tab[data-tab="inventaire"]')?.click()},
        {label:"Ajouter action", secondary:true, onClick: () => openCorrective({cat:"inventaire", date: todayISO()})}
      ]
    });
  }
}

refreshNotifs();
setInterval(refreshNotifs, 5 * 60 * 1000); // toutes les 5 min quand l'app est ouverte

/***********************
 *  MENU PATRON (PIN)
 ***********************/
function patronHash(pin){
  // hash léger (anti-curieux), usage local
  let h = 2166136261;
  const s = String(pin || "");
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(h >>> 0);
}
function getPatronPinHash(){
  return localStorage.getItem(LS.patron_pin) || patronHash("1234");
}
function setPatronPin(pin){
  localStorage.setItem(LS.patron_pin, patronHash(pin));
}
function isPatronUnlocked(){
  return localStorage.getItem(LS.patron_unlocked) === "1";
}
function setPatronUnlocked(v){
  localStorage.setItem(LS.patron_unlocked, v ? "1" : "0");
  refreshPatronUI();

/***********************
 *  AUTO-LOCK PATRON (5 minutes)
 ***********************/
let patronAutoLockTimer = null;
let patronLastActivity = Date.now();

function resetPatronAutoLock(){
  patronLastActivity = Date.now();
  if (patronAutoLockTimer) clearTimeout(patronAutoLockTimer);
  // 5 minutes
  patronAutoLockTimer = setTimeout(() => {
    if (isPatronUnlocked && isPatronUnlocked()){
      setPatronUnlocked(false);
      alert(`Menu Patron reverrouillé automatiquement (${getPatronLockMinutes()} min).`);
      // retour sur onglet Patron
      document.querySelector('.tab[data-tab="patron"]')?.click();
    }
  }, (Number(localStorage.getItem(LS.patron_lock_duration) || 5)) * 60 * 1000);
}

function getPatronLockMinutes(){
  const v = localStorage.getItem(LS.patron_lock_minutes);
  const n = parseInt(v || "5", 10);
  return (n === 2 || n === 5 || n === 10) ? n : 5;
}
function setPatronLockMinutes(n){
  localStorage.setItem(LS.patron_lock_minutes, String(n));
}


function startPatronAutoLock(){
  if (isPatronUnlocked && isPatronUnlocked()){
    resetPatronAutoLock();
  } else {
    if (patronAutoLockTimer) clearTimeout(patronAutoLockTimer);
    patronAutoLockTimer = null;
  }
}

// Reset timer on user activity while unlocked
["click","touchstart","keydown","mousemove","scroll"].forEach(evt => {
  document.addEventListener(evt, () => {
    if (isPatronUnlocked && isPatronUnlocked() && document.querySelector(".panel.active")?.id === "patron") resetPatronAutoLock();
  }, {passive:true});
});

}

const patronLocked = document.getElementById("patronLocked");
const patronContent = document.getElementById("patronContent");
const btnPatronUnlock = document.getElementById("btnPatronUnlock");
const btnPatronLock = document.getElementById("btnPatronLock");
const patronPinModal = document.getElementById("patronPinModal");
const patronPinInput = document.getElementById("patronPinInput");
const btnPatronPinOk = document.getElementById("btnPatronPinOk");
const btnPatronPinCancel = document.getElementById("btnPatronPinCancel");
const patronPinError = document.getElementById("patronPinError");

const btnOpenEmployees = document.getElementById("btnOpenEmployees");
const btnOpenInspection = document.getElementById("btnOpenInspection");
const btnOpenStats = document.getElementById("btnOpenStats");
const btnOpenSuivi = document.getElementById("btnOpenSuivi");

const patronNewPin = document.getElementById("patronNewPin");
const patronNewPin2 = document.getElementById("patronNewPin2");
const btnPatronChangePin = document.getElementById("btnPatronChangePin");

function refreshPatronUI(){
  const unlocked = isPatronUnlocked();
  if (patronLocked) patronLocked.style.display = unlocked ? "none" : "block";
  if (patronContent) patronContent.style.display = unlocked ? "block" : "none";
  document.querySelectorAll(".patron-only").forEach(b => {
    b.classList.toggle("show", unlocked);
  });
}
refreshPatronUI();

function openPatronPinModal(){
  if (!patronPinModal) return;
  if (patronPinInput) patronPinInput.value = "";
  if (patronPinError) patronPinError.style.display = "none";
  patronPinModal.style.display = "flex";
  patronPinModal.style.pointerEvents = "";
  setTimeout(()=>patronPinInput && patronPinInput.focus(), 50);
}
function closePatronPinModal(){
  if (!patronPinModal) return;
  patronPinModal.style.display = "none";
  if (patronPinInput) patronPinInput.value = "";
  if (patronPinError) patronPinError.style.display = "none";
}

btnPatronUnlock && btnPatronUnlock.addEventListener("click", openPatronPinModal);
btnPatronPinCancel && btnPatronPinCancel.addEventListener("click", closePatronPinModal);
patronPinModal && patronPinModal.addEventListener("click", (e) => { if (e.target === patronPinModal) closePatronPinModal(); });

btnPatronPinOk && btnPatronPinOk.addEventListener("click", () => {
  const pin = (patronPinInput?.value || "").trim();
  if (!/^[0-9]{4,8}$/.test(pin)){
    if (patronPinError){ patronPinError.textContent = "PIN invalide (4 à 8 chiffres)."; patronPinError.style.display = "block"; }
    return;
  }
  if (patronHash(pin) !== getPatronPinHash()){
    if (patronPinError){ patronPinError.textContent = "PIN incorrect."; patronPinError.style.display = "block"; }
    return;
  }
  setPatronUnlocked(true);
  resetPatronAutoLock();
  closePatronPinModal();
  alert("Menu Patron déverrouillé ✅");
});

btnPatronLock && btnPatronLock.addEventListener("click", () => {
  setPatronUnlocked(false);
  startPatronAutoLock();
  alert("Menu Patron reverrouillé.");
});

btnPatronChangePin && btnPatronChangePin.addEventListener("click", () => {
  if (!isPatronUnlocked()) return alert("Déverrouille d'abord le menu Patron.");
  const p1 = (patronNewPin?.value || "").trim();
  const p2 = (patronNewPin2?.value || "").trim();
  if (!/^[0-9]{4,8}$/.test(p1)) return alert("PIN invalide (4 à 8 chiffres).");
  if (p1 !== p2) return alert("Les deux PIN ne correspondent pas.");
  setPatronPin(p1);
  patronNewPin.value = "";
  patronNewPin2.value = "";
  alert("PIN Patron mis à jour ✅");
});

btnOpenEmployees && btnOpenEmployees.addEventListener("click", () => {
  if (!isPatronUnlocked()) return alert("Menu Patron verrouillé.");
  document.querySelector('.tab[data-tab="employees"]')?.click();
});
btnOpenInspection && btnOpenInspection.addEventListener("click", () => {
  if (!isPatronUnlocked()) return alert("Menu Patron verrouillé.");
  document.querySelector('.tab[data-tab="inspection"]')?.click();
});

btnOpenStats && btnOpenStats.addEventListener("click", () => {
  if (!isPatronUnlocked()) return alert("Menu Patron verrouillé.");
  document.querySelector('.tab[data-tab="stats"]')?.click();
});

btnOpenSuivi && btnOpenSuivi.addEventListener("click", () => {
  if (!isPatronUnlocked()) return alert("Menu Patron verrouillé.");
  document.querySelector('.tab[data-tab="suivi"]')?.click();
});

// 🔒 Sécurité supplémentaire : empêche l'accès direct aux onglets Patron-only
document.querySelectorAll('.tab.patron-only').forEach(tab => {
  tab.addEventListener('click', (e) => {
    if (!isPatronUnlocked || !isPatronUnlocked()) {
      e.preventDefault();
      alert("Accès réservé au menu Patron 🔒");
      document.querySelector('.tab[data-tab="patron"]')?.click();
    }
  });
});

/***********************
 *  VERROUILLAGE STRICT PATRON
 ***********************/
function hardLockPatron(){
  if (!isPatronUnlocked || !isPatronUnlocked()){
    // hide tabs
    document.querySelectorAll('.tab[data-tab="inspection"]').forEach(t => t.style.display = "none");
    document.querySelectorAll('.tab[data-tab="employees"]').forEach(t => t.style.display = "none");
    // redirect if section visible
    const active = document.querySelector('.panel.active');
    if (active && (active.id === "inspection" || active.id === "employees")){
      document.querySelector('.tab[data-tab="patron"]')?.click();
    }
  } else {
    document.querySelectorAll('.tab[data-tab="inspection"]').forEach(t => t.style.display = "");
  }
}

// run on load and every tab change
setTimeout(hardLockPatron, 100);
document.addEventListener("click", (e) => {
  if (e.target && e.target.classList.contains("tab")){
    setTimeout(hardLockPatron, 50);
  }
});

/***********************
 *  Garde-fou onglets Patron-only
 ***********************/
document.querySelectorAll('.tab.patron-only').forEach(t => {
  t.addEventListener('click', (e) => {
    if (!isPatronUnlocked || !isPatronUnlocked()){
      e.preventDefault();
      alert("Accès réservé au menu Patron 🔒");
      document.querySelector('.tab[data-tab="patron"]')?.click();
    }
  });
});

const patronLockMinutes = document.getElementById("patronLockMinutes");
if (patronLockMinutes){
  patronLockMinutes.value = String(getPatronLockMinutes());
  patronLockMinutes.addEventListener("change", () => {
    const n = parseInt(patronLockMinutes.value || "5", 10);
    setPatronLockMinutes(n);
    if (isPatronUnlocked && isPatronUnlocked() && document.querySelector(".panel.active")?.id === "patron") resetPatronAutoLock();
    alert("Durée de verrouillage mise à jour ✅");
  });
}



/***********************
 *  VERROUILLAGE IMMÉDIAT EN SORTANT DU MENU PATRON
 *  - Si tu quittes l'onglet Patron pour un onglet "normal", on reverrouille tout de suite.
 *  - Si tu vas vers un onglet patron-only (Inspection/Stats/Suivi), on garde le déverrouillage.
 ***********************/
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || !t.classList || !t.classList.contains("tab")) return;
  const goingTo = t.getAttribute("data-tab");
  if (!isPatronUnlocked || !isPatronUnlocked()) return;

  const leavingPatron = (document.querySelector(".panel.active")?.id === "patron") && goingTo !== "patron";
  if (!leavingPatron) return;

  const isTargetPatronOnly = t.classList.contains("patron-only");
  if (!isTargetPatronOnly){
    // lock immediately
    setPatronUnlocked(false);
  } else {
    // keep unlocked but keep timer running (in case of inactivity)
    startPatronAutoLock();
  }
});

/***********************
 *  VERROUILLAGE IMMÉDIAT DÈS QU'ON QUITTE L'ONGLET PATRON
 *  -> Le mode Patron sert uniquement à entrer dans les zones sensibles.
 *  -> Dès qu'on va sur un autre onglet, on reverrouille.
 ***********************/
function lockPatronSoon(){
  setTimeout(() => {
    if (isPatronUnlocked && isPatronUnlocked()){
      setPatronUnlocked(false);
    }
  }, 80);
}

// Si l'utilisateur clique un onglet alors qu'il est sur Patron, on lock après le changement d'onglet.
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || !t.classList || !t.classList.contains("tab")) return;
  const goingTo = t.getAttribute("data-tab");
  const activePanel = document.querySelector(".panel.active")?.id;
  if (activePanel === "patron" && goingTo !== "patron" && isPatronUnlocked && isPatronUnlocked()){
    lockPatronSoon();
  }
});