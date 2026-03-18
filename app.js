  const LS={temps:"releves_temps",hygiene:"releves_hygiene",inv:"releves_inventaire",notes:"releves_notes",employees:"employees_list",bakery:"bakery_name",reception:"reception_list",suppliers:"suppliers_list",products:"reception_products_list",categories:"reception_categories_list"};
const logoUrl = "./logo.png";

function todayISO(){const d=new Date();const yyyy=d.getFullYear();const mm=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${yyyy}-${mm}-${dd}`;}
function monthISO(){const d=new Date();const yyyy=d.getFullYear();const mm=String(d.getMonth()+1).padStart(2,"0");return `${yyyy}-${mm}`;}
function nowLocale(){return new Date().toLocaleString();}
function formatDateFR(dateISO){
  if(!dateISO) return "";
  const parts = dateISO.split("-");
  if(parts.length !== 3) return dateISO;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
function formatMonthFR(monthISO){
  if(!monthISO) return "";
  
  const mois = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
  ];

  const parts = monthISO.split("-");
  const annee = parts[0];
  const m = parseInt(parts[1],10)-1;

  if(m < 0 || m > 11) return monthISO;

  return `${mois[m]} ${annee}`;
}

function readLS(key){try{return JSON.parse(localStorage.getItem(key))||[]}catch{return []}}
function writeLS(key,val){localStorage.setItem(key,JSON.stringify(val));}

function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
function toCSV(rows,headers){
  const esc=(v)=>{const s=String(v==null?"":v);if(s.includes('"')||s.includes(";")||s.includes("\n"))return `"${s.replaceAll('"','""')}"`;return s;};
  let out=headers.map(h=>esc(h.label)).join(";")+"\n";
  rows.forEach(r=>{out+=headers.map(h=>esc(r[h.key])).join(";")+"\n";});
  return out;
}
function splitToLines(doc,text,maxWidth){return doc.splitTextToSize(String(text||""),maxWidth);}
function getTemperatureDisplayValue(r){
  if(r.degivrage === "oui") return "Dégivrage";
  if(r.eteint === "oui") return "Éteint";
  if(r.temperature !== "" && r.temperature != null) return `${r.temperature}°C`;
  return "-";
}

const bakeryName = { value: "Boulangerie Pâtisserie Cointe" };

const employeeSelect=document.getElementById("employeeSelect");
const newEmployeeName=document.getElementById("newEmployeeName");
const btnAddEmployee=document.getElementById("btnAddEmployee");
const btnDeleteEmployee=document.getElementById("btnDeleteEmployee");

function loadEmployees(){const saved=readLS(LS.employees);if(saved.length)return saved;const def=["Julien"];writeLS(LS.employees,def);return def;}
function renderEmployees(){
  const list=loadEmployees();employeeSelect.innerHTML="";
  list.forEach(n=>{const opt=document.createElement("option");opt.value=n;opt.textContent=n;employeeSelect.appendChild(opt);});
}
function updateSelectedEmployeeUI(){
  const emp=employeeSelect.value||"—";
  const hygEmp=document.getElementById("hygieneEmp");
  if(hygEmp) hygEmp.textContent=emp;
}
renderEmployees();
employeeSelect.addEventListener("change", () => {
  updateSelectedEmployeeUI();
  // Si on est en hygiène, on évite de garder les coches de l’employé précédent
  resetHygieneCheckboxes();
});
updateSelectedEmployeeUI();

btnAddEmployee.addEventListener("click",()=>{
  const name=(newEmployeeName.value||"").trim(); if(!name) return;
  const list=loadEmployees();
  if(list.some(n=>n.toLowerCase()===name.toLowerCase())) return alert("Employé déjà présent.");
  list.push(name); writeLS(LS.employees,list);
  newEmployeeName.value=""; renderEmployees(); employeeSelect.value=name; updateSelectedEmployeeUI();
});

btnDeleteEmployee.addEventListener("click",()=>{
  const emp=employeeSelect.value||""; if(!emp) return;
  if(!confirm(`Supprimer l'employé "${emp}" de la liste ?\n\n⚠️ L'historique existant restera inchangé.`)) return;
  let list=loadEmployees().filter(n=>n!==emp);
  if(!list.length){alert("Il doit rester au moins 1 employé.");return;}
  writeLS(LS.employees,list); renderEmployees(); updateSelectedEmployeeUI();
});

function requireEmployee(){
  const emp=employeeSelect.value||"";
  if(!emp.trim()){alert("Choisis un employé avant d’enregistrer 🙂");return null;}
  return emp;
}

/******** Tabs ********/
const tabButtons=document.querySelectorAll(".tab");
const panels=document.querySelectorAll(".panel");
function openTab(id){
  tabButtons.forEach(b=>b.classList.remove("active"));
  panels.forEach(p=>p.classList.remove("active"));
  const btn=[...tabButtons].find(b=>b.dataset.tab===id);
  if(btn) btn.classList.add("active");
  const panel=document.getElementById(id);
  if(panel) panel.classList.add("active");
  if(id==="notes") renderNotesList();
  if(id==="reception") renderReceptionList();
  if(id==="stats") refreshStats();
  if(id==="today") refreshToday();
  if(id==="inspection-mode") renderInspectionMode();
}
tabButtons.forEach(btn=>btn.addEventListener("click",()=>openTab(btn.dataset.tab)));

/******** Températures V12 ********/
const zones=[
  {nom:"Vitrine magasin",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Saladette",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Tour snacking",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Chambre à bac",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Congélateur 1",type:"negatif",max:-18,icon:"🧊"},
  {nom:"Congélateur 2",type:"negatif",max:-18,icon:"🧊"},
  {nom:"Surgélateur/Congélateur",type:"negatif",max:-18,icon:"🧊"},
  {nom:"Tour viennoiserie",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Tour pâtisserie",type:"positif",min:0,max:5,icon:"❄️"},
  {nom:"Chambre froide pâtisserie",type:"positif",min:0,max:5,icon:"❄️"}
];

/******** Aujourd’hui (vue rapide) ********/
const todayBadge=document.getElementById("todayBadge");
const todayTempsMorning=document.getElementById("todayTempsMorning");
const todayTempsAfternoon=document.getElementById("todayTempsAfternoon");
const todayHygiene=document.getElementById("todayHygiene");
const todayHygieneWhen=document.getElementById("todayHygieneWhen");
const todayConformity=document.getElementById("todayConformity");
const todayMissing=document.getElementById("todayMissing");
const todayNote=document.getElementById("todayNote");

function setPill(el,kind,label){
  if(!el) return;
  el.className="pill"+(kind?` ${kind}`:"");
  el.textContent=label;
}

function tempsDoneFor(periode){
  const rows=readLS(LS.temps).filter(r=>r.date===todayISO() && r.periode===periode);
  const zonesDone=new Set(rows.map(r=>r.zone));
  return zonesDone.size>=zones.length;
}

function getLastHygieneToday(){
  const rows=readLS(LS.hygiene).filter(r=>r.date===todayISO());
  return rows.length?rows[rows.length-1]:null;
}

function getDailyNote(){
  const rows=readLS(LS.notes).filter(r=>r.date===todayISO() && r.daily===true);
  return rows.length?rows[rows.length-1]:null;
}

function refreshToday(){
  const morning=tempsDoneFor("matin");
  const afternoon=tempsDoneFor("apres-midi");
  setPill(todayTempsMorning, morning?"ok":"warn", morning?"Fait ✔":"À faire");
  setPill(todayTempsAfternoon, afternoon?"ok":"warn", afternoon?"Fait ✔":"À faire");

  const hyg=getLastHygieneToday();
  const hygDone=!!hyg;
  setPill(todayHygiene, hygDone?"ok":"warn", hygDone?"Fait ✔":"À faire");
  if(todayHygieneWhen) todayHygieneWhen.textContent=hygDone?`${hyg.datetime||""} — ${hyg.employee||""}`:"—";

  const missing=[];
  if(!morning) missing.push("Températures matin");
  if(!afternoon) missing.push("Températures après-midi");
  if(!hygDone) missing.push("Hygiène");
  if(todayMissing) todayMissing.textContent=missing.length?missing.join(" · "):"Rien";

  const ok=!missing.length;
  setPill(todayConformity, ok?"ok":"warn", ok?"Conforme ✔":"En attente");

  if(todayBadge){
    todayBadge.style.display = ok ? "none" : "inline-flex";
  }

  const dn=getDailyNote();
  if(todayNote) todayNote.value=dn?dn.texte||"":"";
}

document.getElementById("btnGotoTemps")?.addEventListener("click",()=>openTab("temperatures"));
document.getElementById("btnGotoHygiene")?.addEventListener("click",()=>openTab("hygiene"));

document.getElementById("btnSaveTodayNote")?.addEventListener("click",()=>{
  const texte=(todayNote?.value||"").trim();
  if(!texte) return alert("Écris une note avant d’enregistrer 🙂");

  const rows=readLS(LS.notes).filter(r=>!(r.date===todayISO() && r.daily===true));
  rows.push({
    date:todayISO(),
    datetime:nowLocale(),
    texte,
    daily:true
  });

  writeLS(LS.notes,rows);
  refreshToday();
  alert("Note du jour enregistrée ✔️");
});



function tempStatus(zone,temp){
  if(isNaN(temp)) return "muted";
  if(zone.type==="negatif"){
    if(temp<=zone.max) return "ok";
    if(temp<=zone.max+2) return "warn";
    return "bad";
  }
  const min=zone.min, max=zone.max;
  if(temp>=min && temp<=max) return "ok";
  if(temp>=min-2 && temp<min) return "warn";
  if(temp>max && temp<=max+2) return "warn";
  return "bad";
}

const zonesDiv=document.getElementById("zones");
function renderZones(){
  zonesDiv.innerHTML = "";

  zones.forEach((z,i) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = `${z.icon} ${z.nom}`;

    const small = document.createElement("div");
    small.className = "small";
    small.textContent = z.type === "negatif"
      ? `Température attendue : ≤ ${z.max}°C`
      : `Température attendue : entre ${z.min}°C et ${z.max}°C`;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.placeholder = "Saisir la température";
    input.id = `temp-${i}`;

    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "10px";
    row.style.gap = "12px";
    row.style.flexWrap = "wrap";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `degivrage-${i}`;

    const lbl = document.createElement("label");
    lbl.htmlFor = cb.id;
    lbl.textContent = "En dégivrage";

    const cbOff = document.createElement("input");
    cbOff.type = "checkbox";
    cbOff.id = `off-${i}`;

    const lblOff = document.createElement("label");
    lblOff.htmlFor = cbOff.id;
    lblOff.textContent = "Équipement éteint";

    function refreshCardState(){
      const val = parseFloat(input.value);

      card.classList.remove("ok","warn","bad","muted");

      if(cb.checked || cbOff.checked){
        input.disabled = true;
        input.value = "";
        card.classList.add("muted");
        return;
      }

      input.disabled = false;

      const st = tempStatus(z,val);
      if(st === "ok") card.classList.add("ok");
      if(st === "warn") card.classList.add("warn");
      if(st === "bad") card.classList.add("bad");
    }

    cb.addEventListener("change", () => {
      if(cb.checked) cbOff.checked = false;
      refreshCardState();
    });

    cbOff.addEventListener("change", () => {
      if(cbOff.checked) cb.checked = false;
      refreshCardState();
    });

    input.addEventListener("input", refreshCardState);

    row.appendChild(cb);
    row.appendChild(lbl);
    row.appendChild(cbOff);
    row.appendChild(lblOff);

    card.appendChild(title);
    card.appendChild(small);
    card.appendChild(input);
    card.appendChild(row);

    zonesDiv.appendChild(card);
  });
}
renderZones();

document.getElementById("btnSaveTemps").addEventListener("click",()=>{
  const emp=requireEmployee(); if(!emp) return;
  const periode=document.getElementById("periode").value;
  const rows=readLS(LS.temps);
  zones.forEach((z,i) => {
  const input = document.getElementById(`temp-${i}`);
  const cb = document.getElementById(`degivrage-${i}`);
  const off = document.getElementById(`off-${i}`);

  const v = input ? input.value : "";
  const degivrage = cb && cb.checked ? "oui" : "non";
  const eteint = off && off.checked ? "oui" : "non";

  if(degivrage === "oui" || eteint === "oui" || v !== ""){
    rows.push({
      date:todayISO(),
      datetime:nowLocale(),
      periode,
      zone:z.nom,
      temperature:(degivrage === "oui" || eteint === "oui") ? "" : Number(v),
      degivrage,
      eteint,
      employee:emp
    });
  }
});
  writeLS(LS.temps,rows);
refreshToday();

alert("Relevé températures enregistré ✔");

renderZones();
openTab("today");
});

document.getElementById("btnExportTempsCSV").addEventListener("click",()=>{
  const rows=readLS(LS.temps); if(!rows.length) return alert("Aucune donnée à exporter !");
 const csv=toCSV(rows,[
  {key:"date",label:"Date"},
  {key:"datetime",label:"Date/Heure"},
  {key:"periode",label:"Période"},
  {key:"zone",label:"Zone"},
  {key:"temperature",label:"Température (°C)"},
  {key:"degivrage",label:"Dégivrage"},
  {key:"eteint",label:"Équipement éteint"},
  {key:"employee",label:"Employé"}
]);
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),"temperatures.csv");
});
function loadLogoBase64(callback){
  const logoUrl = new URL("./logo.png?v=131", window.location.href).href;

  fetch(logoUrl, { cache: "no-store" })
    .then(response => {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.blob();
    })
    .then(blob => {
      const reader = new FileReader();

      reader.onloadend = function(){
        callback(reader.result || null);
      };

      reader.onerror = function(){
        console.error("Erreur lecture logo en base64");
        callback(null);
      };

      reader.readAsDataURL(blob);
    })
    .catch(err => {
      console.error("Logo non chargé :", err);
      callback(null);
    });
}
document.getElementById("btnExportTempsPDF").addEventListener("click",()=>{
  const rows = readLS(LS.temps);
  if(!rows.length) return alert("Aucune donnée à exporter !");

  loadLogoBase64(function(logoData){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if(logoData){
      doc.addImage(logoData, "PNG", 10, 8, 22, 22);
    }

    const bakery = bakeryName.value || "Boulangerie";

    doc.setFontSize(16);
    doc.text(`${bakery} – Relevés de températures`, 32, 15);

    doc.setFontSize(11);
    doc.text(`Généré le ${nowLocale()}`, 32, 22);

    let y = 35;

    function drawHeader(){
      doc.setFillColor(230, 235, 240);
      doc.rect(10, y, 190, 8, "F");

      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("Date", 12, y + 5.5);
      doc.text("Période", 35, y + 5.5);
      doc.text("Zone", 60, y + 5.5);
      doc.text("Valeur", 142, y + 5.5);
      doc.text("Employé", 168, y + 5.5);
      doc.setFont(undefined, "normal");

      y += 10;
    }

    function ensureSpace(){
      if(y > 280){
        doc.addPage();
        y = 20;
        drawHeader();
      }
    }

    drawHeader();

    rows.slice(-140).forEach(r => {
      let valeur = "-";

if(r.degivrage === "oui"){
  valeur = "Dégivrage";
}else if(r.eteint === "oui"){
  valeur = "Éteint";
}else if(r.temperature !== "" && r.temperature != null){
  valeur = `${r.temperature}°C`;
}

      doc.setFontSize(9);
      doc.text(formatDateFR(r.date), 12, y);
      doc.text(String(r.periode || ""), 35, y);
      doc.text(String(r.zone || "").substring(0, 42), 60, y);
      doc.text(String(valeur || ""), 142, y);
      doc.text(String(r.employee || "-").substring(0, 16), 168, y);

      y += 7;

      doc.setDrawColor(225, 225, 225);
      doc.line(10, y - 3, 200, y - 3);

      ensureSpace();
    });

    doc.save("temperatures.pdf");
  });
});

/******** Hygiène V12 (plan prêt) ********/
const hygieneDate=document.getElementById("hygieneDate");
const hygienePeriode=document.getElementById("hygienePeriode");
hygieneDate.value=todayISO();

const hygienePlan=[
  {section:"QUOTIDIEN – OBLIGATOIRE",items:[
    "Laboratoire boulangerie – Plans de travail (lavage + désinfection)",
    "Laboratoire boulangerie – Pétrin / batteur (extérieur + commandes)",
    "Laboratoire boulangerie – Diviseuse / façonneuse (zones accessibles)",
    "Laboratoire boulangerie – Balances + écrans",
    "Laboratoire boulangerie – Ustensiles (pelles, coupe-pâte, bacs…)",
    "Laboratoire pâtisserie – Plans de travail pâtisserie",
    "Laboratoire pâtisserie – Batteur pâtisserie (extérieur)",
    "Laboratoire pâtisserie – Ustensiles pâtisserie (fouets, cercles, maryses…)",
    "Viennoiserie – Tour viennoiserie (plan + intérieur)",
    "Viennoiserie – Rouleaux / outils viennoiserie",
    "Snacking – Plans de travail snacking",
    "Snacking – Saladette (intérieur + couvercles)",
    "Snacking – Tour snacking",
    "Froid – Vitrine magasin (intérieur / extérieur)",
    "Froid – Chambres froides (contrôle visuel + essuyage)",
    "Froid – Poignées chambres froides",
    "Magasin – Comptoirs / vitrines",
    "Magasin – Pinces, pelles, ustensiles de vente",
    "Magasin – Terminaux de paiement",
    "Magasin – Poignées de porte",
    "Divers – Éviers / plonge (désinfection)",
    "Divers – Poubelles (vidage + désinfection couvercle)",
    "Divers – Sols laboratoire (balayage + lavage)"
  ]},
  {section:"HEBDOMADAIRE",items:[
    "Nettoyage approfondi chambres froides",
    "Nettoyage joints de portes froides",
    "Nettoyage siphons",
    "Nettoyage arrière machines (zones accessibles)",
    "Désinfection étagères réfrigérées"
  ]},
  {section:"MENSUEL",items:[
    "Dégivrage congélateurs / surgélateur",
    "Nettoyage complet étagères chambres froides",
    "Nettoyage plinthes et angles",
    "Vérification produits de nettoyage (DLC / étiquetage)"
  ]}
];

const tachesDiv=document.getElementById("taches");

function resetHygieneCheckboxes(){
  // Décoche toutes les tâches (pour l'employé suivant)
  let i = 0;
  hygienePlan.forEach(group => {
    group.items.forEach(() => {
      const cb = document.getElementById(`tache-${i}`);
      if (cb) cb.checked = false;
      i++;
    });
  });
}
function renderTaches(){
  tachesDiv.innerHTML = "";
  let idx = 0;

  hygienePlan.forEach(group => {
    const h = document.createElement("div");
    h.className = "section-title";
    h.textContent = group.section;
    tachesDiv.appendChild(h);

    group.items.forEach(t => {
      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = t;

      const row = document.createElement("div");
      row.className = "row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `tache-${idx}`;

      const lbl = document.createElement("label");
      lbl.htmlFor = cb.id;
      lbl.textContent = "Tâche effectuée";

      row.appendChild(cb);
      row.appendChild(lbl);

      card.appendChild(title);
      card.appendChild(row);

      tachesDiv.appendChild(card);
      idx += 1;
    });
  });
}
renderTaches();

document.getElementById("btnSaveHygiene").addEventListener("click",()=>{
  const emp=requireEmployee(); if(!emp) return;
  const date=hygieneDate.value||todayISO();
  const periode=hygienePeriode.value;
  const rows=readLS(LS.hygiene);
  let idx=0; const items=[];
  hygienePlan.forEach(group=>{
    group.items.forEach(t=>{
      items.push({section:group.section,tache:t,fait:document.getElementById(`tache-${idx}`).checked?"oui":"non"});
      idx+=1;
    });
  });
  rows.push({date,datetime:nowLocale(),periode,employee:emp,items});
  writeLS(LS.hygiene,rows);
  resetHygieneCheckboxes();
  refreshToday();
  alert("Hygiène / Nettoyage enregistré ✔️");
});

document.getElementById("btnExportHygieneCSV").addEventListener("click",()=>{
  const rows=readLS(LS.hygiene); if(!rows.length) return alert("Aucune donnée à exporter !");
  const flat=[];
  rows.forEach(r=>(r.items||[]).forEach(it=>flat.push({date:r.date,datetime:r.datetime,periode:r.periode,employee:r.employee||"",section:it.section||"",tache:it.tache,fait:it.fait})));
  const csv=toCSV(flat,[
    {key:"date",label:"Date"},
    {key:"datetime",label:"Date/Heure"},
    {key:"periode",label:"Période"},
    {key:"employee",label:"Employé"},
    {key:"section",label:"Section"},
    {key:"tache",label:"Tâche"},
    {key:"fait",label:"Fait"}
  ]);
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),"hygiene.csv");
});

document.getElementById("btnExportHygienePDF").addEventListener("click",()=>{
  const rows = readLS(LS.hygiene);
  if(!rows.length) return alert("Aucune donnée à exporter !");

  loadLogoBase64(function(logoData){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if(logoData){
      doc.addImage(logoData, "PNG", 10, 8, 22, 22);
    }

    doc.setFontSize(16);
    doc.text(`${(bakeryName.value || "Boulangerie")} – Suivi hygiène`, 32, 15);

    doc.setFontSize(11);
    doc.text(`Généré le ${nowLocale()}`, 32, 22);

    let y = 35;
    rows.slice(-140).forEach(r => {
      const line = `${r.date} – ${r.employee || "-"} – ${r.task || r.tache || "-"} – ${r.status || r.statut || "Fait"}`;
      doc.text(line.substring(0,110), 10, y);
      y += 6;
      if(y > 280){
        doc.addPage();
        y = 20;
      }
    });

    doc.save("hygiene.pdf");
  });
});

/******** Notes ********/

function renderNotesList(){
  const box = document.getElementById("notesListe");
  if(!box) return;

  const rows = readLS(LS.notes).slice().reverse();
  box.innerHTML = "";

  if(!rows.length){
    box.innerHTML = `
      <div class="note-history-card">
        <div class="small">Aucune note enregistrée.</div>
      </div>
    `;
    return;
  }

  rows.slice(0, 50).forEach(r => {
    const card = document.createElement("div");
    card.className = "note-history-card";

    const dateValue = r.date ? formatDateFR(r.date) : "-";
    const datetimeValue = r.datetime || "-";
    const textValue = (r.texte || "").trim() || "—";
    const isDaily = r.daily === true;

    card.innerHTML = `
      <div class="note-history-top">
        <div>
          <div class="note-history-date">${dateValue}</div>
          ${isDaily ? `<div class="note-history-badge">📌 Note du jour</div>` : ``}
        </div>
        <div class="note-history-datetime">${datetimeValue}</div>
      </div>

      <div class="note-history-text">${textValue}</div>
    `;

    box.appendChild(card);
  });
}

/******** Stats ********/
const statsMonth=document.getElementById("statsMonth"); statsMonth.value=monthISO();
document.getElementById("btnRefreshStats").addEventListener("click",refreshStats);
let chartStatsTemps, chartStatsHyg;

function refreshStats(){
  const m=statsMonth.value||monthISO();
  const temps=readLS(LS.temps).filter(r=>(r.date||"").startsWith(m));
  const hyg=readLS(LS.hygiene).filter(r=>(r.date||"").startsWith(m));
  const notes=readLS(LS.notes).filter(r=>(r.date||"").startsWith(m));

  const elTempsCount = document.getElementById("statsTempsCount");
  const elHygCount = document.getElementById("statsHygCount");
  const elNotesCount = document.getElementById("statsNotesCount");

  if(elTempsCount) elTempsCount.textContent = temps.length;
  if(elHygCount) elHygCount.textContent = hyg.length;
  if(elNotesCount) elNotesCount.textContent = notes.length;

  let ok=0,warn=0,bad=0;
  temps.forEach(r=>{
    if(r.degivrage === "oui") return;
    const z=zones.find(x=>x.nom===r.zone);
    const st=tempStatus(z||{type:"positif",min:0,max:5},Number(r.temperature));
    if(st==="ok") ok++; else if(st==="warn") warn++; else if(st==="bad") bad++;
  });
  document.getElementById("statsTemps").textContent=`Entrées: ${temps.length} | OK: ${ok} | Limite: ${warn} | Alerte: ${bad}`;
  const ctxT=document.getElementById("chartStatsTemps").getContext("2d");
  if(chartStatsTemps) chartStatsTemps.destroy();
  chartStatsTemps = new Chart(ctxT,{
  type:"bar",
  data:{
    labels:["OK","Limite","Alerte"],
    datasets:[{
      label:"Températures",
      data:[ok,warn,bad],
      borderRadius:8
    }]
  },
  options:{
    responsive:true,
    plugins:{
      legend:{display:false}
    },
    scales:{
      y:{beginAtZero:true}
    }
  }
});

  let totalItems=0, doneItems=0;
  hyg.forEach(r=>(r.items||[]).forEach(it=>{totalItems++; if((it.fait||"")==="oui") doneItems++;}));
  const pct=totalItems?Math.round((doneItems/totalItems)*100):0;
  document.getElementById("statsHyg").textContent=`Relevés: ${hyg.length} | Tâches faites: ${doneItems}/${totalItems} (${pct}%)`;
  const ctxH=document.getElementById("chartStatsHyg").getContext("2d");
  if(chartStatsHyg) chartStatsHyg.destroy();
  chartStatsHyg = new Chart(ctxH,{
  type:"bar",
  data:{
    labels:["Fait","Non fait"],
    datasets:[{
      label:"Hygiène",
      data:[doneItems,Math.max(totalItems-doneItems,0)],
      borderRadius:8
    }]
  },
  options:{
    responsive:true,
    plugins:{
      legend:{display:false}
    },
    scales:{
      y:{beginAtZero:true}
    }
  }
});

  document.getElementById("statsNotes").textContent =
  notes.length
    ? `${notes.length} note(s) enregistrée(s) pour ${formatMonthFR(m)}.`
    : `Aucune note enregistrée pour ${formatMonthFR(m)}.`;
}
refreshStats();

/******** Inspection ********/
const inspMonth=document.getElementById("inspMonth");
if(inspMonth) inspMonth.value=monthISO();

document.getElementById("btnGenerateInspection").addEventListener("click",()=>{
  const m=inspMonth.value||monthISO();
  const includeNotes=document.getElementById("inspIncludeNotes").checked;

  const temps=readLS(LS.temps).filter(r=>(r.date||"").startsWith(m));
  const hyg=readLS(LS.hygiene).filter(r=>(r.date||"").startsWith(m));
  const notes=readLS(LS.notes).filter(r=>(r.date||"").startsWith(m));

  loadLogoBase64(function(logoData){

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF();
    const bakery=bakeryName.value||"Boulangerie";

    if(logoData){
      doc.addImage(logoData, "PNG", 10, 8, 22, 22);
    }

    doc.setFontSize(18);
    doc.text(`${bakery}`,32,14);

    doc.setFontSize(14);
    doc.text(`Rapport inspection sanitaire – ${formatMonthFR(m)}`,32,24);

    doc.setFontSize(11);
    doc.text(`Généré le ${nowLocale()}`,32,32);

  let y=42;

  function section(title){
    doc.setFontSize(13);
    doc.text(title,10,y);
    y+=6;
    doc.setDrawColor(0);
    doc.line(10,y,200,y);
    y+=8;
  }

  function ensureSpace(lines=1){
    if(y+lines*6>280){
      doc.addPage();
      y=20;
    }
  }

  section("1) Températures (relevés)");
  doc.setFontSize(10);
  doc.text(`Nombre d'entrées: ${temps.length}`,10,y);
  y+=6;

  let badList=[];
  temps.forEach(r=>{
    const z=zones.find(x=>x.nom===r.zone);
    const st=tempStatus(z||{type:"positif",min:0,max:5},Number(r.temperature));
    if(r.degivrage!=="oui" && st==="bad") badList.push(r);
  });

  doc.text(`Anomalies (alerte rouge): ${badList.length}`,10,y);
  y+=8;

  if(badList.length){
    badList.slice(-25).forEach(r=>{
      ensureSpace(1);
      const valeur = getTemperatureDisplayValue(r);
      doc.text(`- ${formatDateFR(r.date)} ${r.periode} – ${r.zone}: ${valeur} (Employé: ${r.employee||"-"})`,12,y);
      y+=5;
    });
    y+=4;
  }

  section("2) Hygiène / Nettoyage");
  const totalItems=hyg.reduce((acc,r)=>acc+(r.items||[]).length,0);
  const doneItems=hyg.reduce((acc,r)=>acc+(r.items||[]).filter(it=>it.fait==="oui").length,0);
  const pct=totalItems?Math.round((doneItems/totalItems)*100):0;

  doc.setFontSize(10);
  doc.text(`Relevés: ${hyg.length} | Tâches faites: ${doneItems}/${totalItems} (${pct}%)`,10,y);
  y+=8;

  if(hyg.length){
    const last=hyg[hyg.length-1];
    doc.text(`Dernier relevé: ${last.date} ${last.periode} (Employé: ${last.employee||"-"})`,10,y);
    y+=6;

    let currentSection="";
    (last.items||[]).forEach(it=>{
      if((it.section||"")!==currentSection){
        currentSection=it.section||"";
        y+=2;
        ensureSpace(2);
        doc.setFontSize(11);
        doc.text(currentSection,12,y);
        y+=6;
        doc.setFontSize(10);
      }
      ensureSpace(1);
      doc.text(`- ${it.tache}: ${it.fait}`,12,y);
      y+=5;
    });
    y+=4;
  }

  if(includeNotes){
    section("3) Notes / Observations");
    doc.setFontSize(10);
    doc.text(`Notes: ${notes.length}`,10,y);
    y+=8;

    notes.slice(-15).forEach(r=>{
      ensureSpace(2);
      doc.text(`${r.date} – ${r.datetime}`,10,y);
      y+=5;
      const lines=splitToLines(doc,r.texte,180);
      doc.text(lines,12,y);
      y+=lines.length*5+4;
    });
  }

  doc.save(`inspection_${bakery.split(" ").join("_")}_${m}.pdf`);
  });
});

/******** Réception marchandises ********/
const recDate=document.getElementById("recDate");
const recSupplier=document.getElementById("recSupplier");
const recProduct=document.getElementById("recProduct");
const recQty=document.getElementById("recQty");
const recLot=document.getElementById("recLot");
const recDlc=document.getElementById("recDlc");
const recTemp=document.getElementById("recTemp");
const recComment=document.getElementById("recComment");
const receptionList=document.getElementById("receptionList");
const newSupplierName=document.getElementById("newSupplierName");
const btnAddSupplier=document.getElementById("btnAddSupplier");
const newProductName=document.getElementById("newProductName");
const btnAddProductReception=document.getElementById("btnAddProductReception");
const btnToggleReceptionSettings=document.getElementById("btnToggleReceptionSettings");
const receptionSettings=document.getElementById("receptionSettings");
const supplierDelete=document.getElementById("supplierDelete");
const productDelete=document.getElementById("productDelete");

const btnDeleteSupplier=document.getElementById("btnDeleteSupplier");
const btnDeleteProductReception=document.getElementById("btnDeleteProductReception");
const recCategory=document.getElementById("recCategory");

const newCategoryName=document.getElementById("newCategoryName");
const btnAddCategory=document.getElementById("btnAddCategory");
const categoryDelete=document.getElementById("categoryDelete");
const btnDeleteCategory=document.getElementById("btnDeleteCategory");

const newProductCategory=document.getElementById("newProductCategory");


btnToggleReceptionSettings?.addEventListener("click",()=>{
  if(!receptionSettings) return;

  const isHidden = receptionSettings.style.display === "none";

  receptionSettings.style.display = isHidden ? "block" : "none";
  btnToggleReceptionSettings.textContent = isHidden
    ? "⚙️ Masquer fournisseurs / produits"
    : "⚙️ Gérer fournisseurs / produits";
});



function normalizeReceptionProducts(list){
  return list.map(p=>{
    if(typeof p === "string"){
      return { nom:p, cat:"Autre" };
    }
    return {
      nom:p.nom,
      cat:p.cat || "Autre"
    };
  });
}

function loadReceptionProducts(){
  const saved=readLS(LS.products);
  if(saved.length){
    const norm=normalizeReceptionProducts(saved);
    writeLS(LS.products,norm);
    return norm;
  }


  const def=[
    {nom:"Crème liquide",cat:"Pâtisserie"},
    {nom:"Beurre",cat:"Pâtisserie"},
    {nom:"Jambon",cat:"Snacking"},
    {nom:"Fromage",cat:"Snacking"},
    {nom:"Farine",cat:"Boulangerie"}
  ];  

  writeLS(LS.products,def);
  return def;
}

  function renderReceptionProducts(){
  const list=loadReceptionProducts();
  const selectedCat=(recCategory?.value||"").trim();

  if(recProduct){
    recProduct.innerHTML="";
    const filtered=selectedCat ? list.filter(p=>p.cat===selectedCat) : list;

    filtered.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.nom;
      opt.textContent=p.nom;
      recProduct.appendChild(opt);
    });
  }

  if(productDelete){
    productDelete.innerHTML="";
    list.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.nom;
      opt.textContent=`${p.nom} (${p.cat})`;
      productDelete.appendChild(opt);
    });
  }
}

btnDeleteProductReception?.addEventListener("click",()=>{
  const name=productDelete?.value||"";
  if(!name) return;

  if(!confirm("Supprimer ce produit ?")) return;

  let list=loadReceptionProducts();
  list=list.filter(p=>p.nom!==name);

  writeLS(LS.products,list);

  renderReceptionProducts();
});

recCategory?.addEventListener("change", renderReceptionProducts);


btnAddProductReception?.addEventListener("click",()=>{
  const name=(newProductName?.value||"").trim();
  const cat=(newProductCategory?.value||"").trim();

  if(!name) return alert("Écris un nom de produit 🙂");
  if(!cat) return alert("Choisis une catégorie 🙂");

  const list=loadReceptionProducts();
  if(list.some(p=>p.nom.toLowerCase()===name.toLowerCase())){
    return alert("Ce produit existe déjà.");
  }

  list.push({nom:name,cat});
  writeLS(LS.products,list);

  if(newProductName) newProductName.value="";
  renderReceptionProducts();

  if(recCategory) recCategory.value=cat;
  renderReceptionProducts();
  if(recProduct) recProduct.value=name;

  alert("Produit ajouté ✔️");
});

function loadSuppliers(){
  const saved=readLS(LS.suppliers);
  if(saved.length) return saved;

  const def=["Labo 80","Moulin Bourgeois"];
  writeLS(LS.suppliers,def);
  return def;
}

function renderSuppliers(){
  if(!recSupplier) return;

  const list=loadSuppliers();

  recSupplier.innerHTML="";
  supplierDelete.innerHTML="";

  list.forEach(name=>{
    const opt=document.createElement("option");
    opt.value=name;
    opt.textContent=name;

    recSupplier.appendChild(opt.cloneNode(true));
    supplierDelete.appendChild(opt);
  });
}
btnDeleteSupplier?.addEventListener("click",()=>{
  const name=supplierDelete.value;

  if(!confirm("Supprimer ce fournisseur ?")) return;

  let list=loadSuppliers();
  list=list.filter(n=>n!==name);

  writeLS(LS.suppliers,list);

  renderSuppliers();
});


btnAddSupplier?.addEventListener("click",()=>{
  const name=(newSupplierName?.value||"").trim();
  if(!name) return alert("Écris un nom de fournisseur 🙂");

  const list=loadSuppliers();
  if(list.some(n=>n.toLowerCase()===name.toLowerCase())){
    return alert("Ce fournisseur existe déjà.");
  }

  list.push(name);
  writeLS(LS.suppliers,list);

  if(newSupplierName) newSupplierName.value="";
  renderSuppliers();
  recSupplier.value=name;

  alert("Fournisseur ajouté ✔️");
});

if(recDate) recDate.value=todayISO();

function renderReceptionList(){
  if(!receptionList) return;

  const rows = readLS(LS.reception).slice().reverse();
  receptionList.innerHTML = "";

  if(!rows.length){
    receptionList.innerHTML = `
      <div class="reception-history-card">
        <div class="small">Aucune réception enregistrée pour le moment.</div>
      </div>
    `;
    return;
  }

  rows.slice(0, 50).forEach(r => {
    const card = document.createElement("div");
    card.className = "reception-history-card";

    const tempNum = parseFloat(r.temperature);
    let tempClass = "rh-temp-muted";
    let tempLabel = "-";

    if(r.temperature !== "" && !isNaN(tempNum)){
      tempLabel = `${tempNum}°C`;

      if(tempNum <= 4){
        tempClass = "rh-temp-ok";
      }else if(tempNum <= 8){
        tempClass = "rh-temp-warn";
      }else{
        tempClass = "rh-temp-bad";
      }
    }

    const dlcValue = r.dlc ? formatDateFR(r.dlc) : "-";
    const dateValue = r.date ? formatDateFR(r.date) : "-";
    const commentValue = (r.comment || "").trim() ? r.comment : "Aucun commentaire";

    card.innerHTML = `
      <div class="reception-history-top">
        <div>
          <div class="reception-history-title">${r.product || "-"}</div>
          <div class="small">${r.category || "Sans catégorie"}</div>
        </div>
        <div class="reception-history-date">${dateValue} · ${r.datetime || "-"}</div>
      </div>

      <div class="reception-history-grid">
        <div>
          <span class="rh-label">Fournisseur</span>
          <span class="rh-value">${r.supplier || "-"}</span>
        </div>

        <div>
          <span class="rh-label">Quantité</span>
          <span class="rh-value">${r.quantity || "-"}</span>
        </div>

        <div>
          <span class="rh-label">Lot</span>
          <span class="rh-value">${r.lot || "-"}</span>
        </div>

        <div>
          <span class="rh-label">DLC / DLUO</span>
          <span class="rh-value">${dlcValue}</span>
        </div>

        <div>
          <span class="rh-label">Température</span>
          <span class="rh-value ${tempClass}">${tempLabel}</span>
        </div>

        <div>
          <span class="rh-label">Employé</span>
          <span class="rh-value">${r.employee || "-"}</span>
        </div>
      </div>

      <div class="reception-history-comment">
        <span class="rh-label">Commentaire</span>
        <div class="rh-comment-text">${commentValue}</div>
      </div>
    `;

    receptionList.appendChild(card);
  });
}

function loadCategories(){
  const saved=readLS(LS.categories);
  if(saved.length) return saved;

  const def=["Boulangerie","Pâtisserie","Snacking"];
  writeLS(LS.categories,def);
  return def;
}

function renderCategories(){
  const list=loadCategories();

  if(recCategory){
    recCategory.innerHTML="";
    list.forEach(name=>{
      const opt=document.createElement("option");
      opt.value=name;
      opt.textContent=name;
      recCategory.appendChild(opt);
    });
  }

  if(categoryDelete){
    categoryDelete.innerHTML="";
    list.forEach(name=>{
      const opt=document.createElement("option");
      opt.value=name;
      opt.textContent=name;
      categoryDelete.appendChild(opt);
    });
  }

  if(newProductCategory){
    newProductCategory.innerHTML="";
    list.forEach(name=>{
      const opt=document.createElement("option");
      opt.value=name;
      opt.textContent=name;
      newProductCategory.appendChild(opt);
    });
  }
}

btnAddCategory?.addEventListener("click",()=>{
  const name=(newCategoryName?.value||"").trim();
  if(!name) return alert("Écris un nom de catégorie 🙂");

  const list=loadCategories();
  if(list.some(n=>n.toLowerCase()===name.toLowerCase())){
    return alert("Cette catégorie existe déjà.");
  }

  list.push(name);
  writeLS(LS.categories,list);

  if(newCategoryName) newCategoryName.value="";
  renderCategories();
  renderReceptionProducts();

  if(recCategory) recCategory.value=name;
  if(newProductCategory) newProductCategory.value=name;

  alert("Catégorie ajoutée ✔️");
});

btnDeleteCategory?.addEventListener("click",()=>{
  const name=categoryDelete?.value||"";
  if(!name) return;

  if(!confirm(`Supprimer la catégorie "${name}" ?\n\nLes produits liés seront également supprimés.`)) return;

  const cats=loadCategories().filter(c=>c!==name);
  writeLS(LS.categories,cats);

  const products=loadReceptionProducts().filter(p=>p.cat!==name);
  writeLS(LS.products,products);

  renderCategories();
  renderReceptionProducts();

  alert("Catégorie supprimée ✔️");
});

document.getElementById("btnSaveReception")?.addEventListener("click",()=>{
  const emp=requireEmployee();
  if(!emp) return;

  const supplier=(recSupplier?.value||"").trim();
  const product=(recProduct?.value||"").trim();
  const category=(recCategory?.value||"").trim();

  if(!supplier || !product){
    return alert("Fournisseur et produit sont obligatoires 🙂");
  }

  const row={
    date:recDate?.value||todayISO(),
    datetime:nowLocale(),
    supplier,
    product,
    category,
    quantity:(recQty?.value||"").trim(),
    lot:(recLot?.value||"").trim(),
    dlc:recDlc?.value||"",
    temperature:recTemp?.value||"",
    comment:(recComment?.value||"").trim(),
    employee:emp
  };

  const rows=readLS(LS.reception);
  rows.push(row);
  writeLS(LS.reception,rows);

    if(recProduct) recProduct.selectedIndex = 0;
  if(recQty) recQty.value = "";
  if(recLot) recLot.value = "";
  if(recDlc) recDlc.value = "";
  if(recTemp) recTemp.value = "";
  if(recComment) recComment.value = "";
  if(recDate) recDate.value = todayISO();

  renderReceptionList();
  alert("Réception enregistrée ✔️");
});

/******** Notifications rappels températures ********/
const NOTIF_STORAGE_KEY = "haccp_notif_sent";

function readNotifState(){
  try{
    return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY)) || {};
  }catch{
    return {};
  }
}

function writeNotifState(data){
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(data));
}

function getTodayNotifKey(type){
  return `${todayISO()}_${type}`;
}

function isAfterHour(targetHour){
  const now = new Date();
  const h = now.getHours();
  return h >= targetHour;
}

function sendLocalNotification(title, body){
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") return;

  try{
    new Notification(title, {
      body,
      icon: "./logo.png?v=" + window.APP_VERSION
    });
  }catch(err){
    console.error("Erreur notification locale :", err);
  }
}

function checkTemperatureReminders(){
  const notifState = readNotifState();

  const morningDone = tempsDoneFor("matin");
  const afternoonDone = tempsDoneFor("apres-midi");

  const morningKey = getTodayNotifKey("matin");
  const afternoonKey = getTodayNotifKey("apresmidi");

  if(isAfterHour(10) && !morningDone && !notifState[morningKey]){
    sendLocalNotification("Rappel HACCP", "Températures matin non saisies");
    notifState[morningKey] = true;
  }

  if(isAfterHour(17) && !afternoonDone && !notifState[afternoonKey]){
    sendLocalNotification("Rappel HACCP", "Températures après-midi non saisies");
    notifState[afternoonKey] = true;
  }

  writeNotifState(notifState);
}

function requestNotificationPermission(){
  if(!("Notification" in window)){
    alert("Les notifications ne sont pas supportées sur cet appareil.");
    updateNotifStatusUI();
    return;
  }

  Notification.requestPermission().then(permission => {
    updateNotifStatusUI();

    if(permission === "granted"){
      alert("Notifications activées ✔️");
      checkTemperatureReminders();
    }else if(permission === "denied"){
      alert("Notifications refusées.");
    }
  });
}

document.getElementById("btnEnableNotif")?.addEventListener("click", requestNotificationPermission);

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible"){
    checkTemperatureReminders();
  }
});

window.addEventListener("load", () => {
  updateNotifStatusUI();
  setTimeout(checkTemperatureReminders, 1500);
});
function updateNotifStatusUI(){
  const el = document.getElementById("notifStatus");
  if(!el){
    console.log("notifStatus introuvable");
    return;
  }

  try{
    if(!("Notification" in window)){
      el.className = "notif-status bad";
      el.textContent = "🔕 Notifications non supportées";
      return;
    }

    if(Notification.permission === "granted"){
      el.className = "notif-status ok";
      el.textContent = "🔔 Notifications activées";
      return;
    }

    if(Notification.permission === "denied"){
      el.className = "notif-status bad";
      el.textContent = "⛔ Notifications bloquées";
      return;
    }

    el.className = "notif-status warn";
    el.textContent = "⚠️ Notifications non activées";
  }catch(err){
    console.error("Erreur notifications :", err);
  }
}



function testNotification(){
  if(!("Notification" in window)){
    alert("Les notifications ne sont pas supportées sur cet appareil.");
    return;
  }

  if(Notification.permission !== "granted"){
    alert("Les notifications ne sont pas activées.");
    updateNotifStatusUI();
    return;
  }

  try{
    new Notification("Test HACCP", {
      body: "Les notifications fonctionnent correctement ✔️",
      icon: "./logo.png?v=" + window.APP_VERSION
    });
  }catch(err){
    console.error("Erreur testNotification :", err);
    alert("Le test notification a échoué.");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnEnableNotif")?.addEventListener("click", requestNotificationPermission);
  document.getElementById("btnTestNotif")?.addEventListener("click", testNotification);
  

  updateNotifStatusUI();
  renderCategories();
  renderSuppliers();
  renderReceptionProducts();
  renderReceptionList();
  renderInspectionMode();
  
  openTab("today");
});

window.addEventListener("pageshow", () => {
  refreshToday();
});

function getTodayTemperatureRows(){
  return readLS(LS.temps).filter(r => r.date === todayISO());
}

function getInspectionModeData(){
  const morning = tempsDoneFor("matin");
  const afternoon = tempsDoneFor("apres-midi");
  const hygDone = !!getLastHygieneToday();

  const tempsRows = readLS(LS.temps).filter(r => r.date === todayISO());
  const latestByZone = {};

  tempsRows.forEach(r => {
    const key = `${r.periode}__${r.zone}`;
    latestByZone[key] = r;
  });

  const tempsList = Object.values(latestByZone);

  const hygRows = readLS(LS.hygiene).filter(r => r.date === todayISO());
  const lastHyg = hygRows.length ? hygRows[hygRows.length - 1] : null;

  const recRows = readLS(LS.reception).slice().reverse().slice(0, 5);
  const noteRows = readLS(LS.notes).filter(r => r.date === todayISO()).slice().reverse();

  let globalClass = "warn";
  let globalText = "À vérifier";

  if(morning && afternoon && hygDone){
    globalClass = "ok";
    globalText = "Conforme ✔";
  }else{
    const missing = [];
    if(!morning) missing.push("Temp matin");
    if(!afternoon) missing.push("Temp après-midi");
    if(!hygDone) missing.push("Hygiène");

    if(missing.length === 3){
      globalClass = "bad";
      globalText = "Aucun relevé";
    }else{
      globalClass = "warn";
      globalText = "Manquant : " + missing.join(", ");
    }
  }

function exportInspectionModePDF(){
  const data = getInspectionModeData();

  loadLogoBase64(function(logoData){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if(logoData){
      doc.addImage(logoData, "PNG", 10, 8, 22, 22);
    }

    doc.setFontSize(18);
    doc.text(data.establishment, 36, 16);

    doc.setFontSize(13);
    doc.text("Mode inspection HACCP", 36, 24);

    doc.setFontSize(10);
    doc.text(`Date : ${formatDateFR(data.date)}`, 36, 30);
    doc.text(`Employé : ${data.employee}`, 36, 35);
    doc.text(`Statut global : ${data.globalText}`, 36, 40);

    let y = 52;

    function ensureSpace(lines = 1){
      if(y + lines * 6 > 282){
        doc.addPage();
        y = 20;
      }
    }

    function section(title){
      ensureSpace(3);
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.text(title, 10, y);
      y += 4;
      doc.setDrawColor(180,180,180);
      doc.line(10, y, 200, y);
      y += 7;
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
    }

    function writeLabelValue(label, value){
      ensureSpace(2);
      doc.setFont(undefined, "bold");
      doc.text(`${label} :`, 12, y);
      doc.setFont(undefined, "normal");
      const lines = splitToLines(doc, value || "-", 150);
      doc.text(lines, 45, y);
      y += Math.max(lines.length * 5, 6);
    }

    section("1) Informations générales");
    writeLabelValue("Établissement", data.establishment);
    writeLabelValue("Date", formatDateFR(data.date));
    writeLabelValue("Employé sélectionné", data.employee);
    writeLabelValue("Statut global", data.globalText);

    section("2) Températures du jour");
    if(!data.tempsList.length){
      doc.text("Aucun relevé température enregistré aujourd’hui.", 12, y);
      y += 6;
    }else{
      data.tempsList.forEach(r => {
        ensureSpace(3);
        const valeur = getTemperatureDisplayValue(r);
        const line = `${r.zone || "-"} | ${r.periode || "-"} | ${valeur} | ${r.datetime || "-"} | ${r.employee || "-"}`;
        const lines = splitToLines(doc, line, 185);
        doc.text(lines, 12, y);
        y += lines.length * 5 + 2;
      });
    }

    section("3) Hygiène du jour");
    if(!data.lastHyg){
      doc.text("Aucun relevé hygiène enregistré aujourd’hui.", 12, y);
      y += 6;
    }else{
      const totalItems = (data.lastHyg.items || []).length;
      const doneItems = (data.lastHyg.items || []).filter(it => it.fait === "oui").length;
      const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

      writeLabelValue("Période", data.lastHyg.periode || "-");
      writeLabelValue("Heure", data.lastHyg.datetime || "-");
      writeLabelValue("Employé", data.lastHyg.employee || "-");
      writeLabelValue("Tâches faites", `${doneItems}/${totalItems} (${pct}%)`);
    }

    section("4) Dernières réceptions");
    if(!data.recRows.length){
      doc.text("Aucune réception enregistrée.", 12, y);
      y += 6;
    }else{
      data.recRows.forEach(r => {
        ensureSpace(4);
        const line1 = `${r.product || "-"} | ${r.supplier || "-"} | ${r.category || "-"}`;
        const line2 = `Date : ${r.date ? formatDateFR(r.date) : "-"} | Qté : ${r.quantity || "-"} | Lot : ${r.lot || "-"} | DLC : ${r.dlc ? formatDateFR(r.dlc) : "-"}`;
        const lines1 = splitToLines(doc, line1, 185);
        const lines2 = splitToLines(doc, line2, 185);
        doc.text(lines1, 12, y);
        y += lines1.length * 5;
        doc.text(lines2, 12, y);
        y += lines2.length * 5 + 2;
      });
    }

    section("5) Notes du jour");
    if(!data.noteRows.length){
      doc.text("Aucune note enregistrée aujourd’hui.", 12, y);
      y += 6;
    }else{
      data.noteRows.forEach(r => {
        ensureSpace(4);
        doc.setFont(undefined, "bold");
        doc.text(`${r.daily === true ? "Note du jour" : "Observation"} - ${r.datetime || "-"}`, 12, y);
        doc.setFont(undefined, "normal");
        y += 5;
        const lines = splitToLines(doc, r.texte || "-", 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 3;
      });
    }

    const safeName = (data.establishment || "boulangerie").replace(/\s+/g, "_");
    doc.save(`inspection_${safeName}_${data.date}.pdf`);
  });
}



function getInspectionTemperatureStatusClass(r){
  if(r.eteint === "oui") return "warn";
if(r.degivrage === "oui") return "warn";
if(st === "bad") return "bad";

  const z = zones.find(x => x.nom === r.zone);
  const st = tempStatus(z || {type:"positif",min:0,max:5}, Number(r.temperature));

  if(st === "ok") return "ok";
  if(st === "warn") return "warn";
  return "bad";
}

function renderInspectionMode(){
  const est = document.getElementById("inspEstablishment");
  const dateEl = document.getElementById("inspDate");
  const empEl = document.getElementById("inspEmployee");
  const globalEl = document.getElementById("inspGlobalStatus");

  const tempsBox = document.getElementById("inspectionTempsList");
  const hygBox = document.getElementById("inspectionHygieneBox");
  const recBox = document.getElementById("inspectionReceptionList");
  const notesBox = document.getElementById("inspectionNotesBox");

  if(!tempsBox || !hygBox || !recBox || !notesBox) return;

  if(est) est.textContent = bakeryName.value || "Boulangerie Pâtisserie Cointe";
  if(dateEl) dateEl.textContent = formatDateFR(todayISO());
  if(empEl) empEl.textContent = employeeSelect?.value || "—";

  /* Températures du jour */
  const tempsRows = getTodayTemperatureRows();
  const latestByZone = {};

  tempsRows.forEach(r => {
    const key = `${r.periode}__${r.zone}`;
    latestByZone[key] = r;
  });

  const tempsList = Object.values(latestByZone);

  if(!tempsList.length){
    tempsBox.innerHTML = `<div class="inspection-empty">Aucun relevé température enregistré aujourd’hui.</div>`;
  }else{

  const tempsSummary = `
    <div class="inspection-hygiene-stats">
      <div class="inspection-mini-stat">
        <div class="inspection-mini-stat-title">Relevés</div>
        <div class="inspection-mini-stat-value">${tempsList.length}</div>
      </div>
    </div>
  `;

  tempsBox.innerHTML = `
    ${tempsSummary}

    <div class="inspection-list">
      ${tempsList.map(r => `
        <div class="inspection-item">
          <div class="inspection-item-top">
            <div>
              <div class="inspection-item-title">${r.zone || "-"}</div>
              <div class="inspection-item-sub">${r.periode || "-"} · ${r.datetime || "-"}</div>
            </div>
            <div class="inspection-item-value ${getInspectionTemperatureStatusClass(r)}">
              ${getTemperatureDisplayValue(r)}
            </div>
          </div>
          <div class="inspection-item-sub">Employé : ${r.employee || "-"}</div>
        </div>
      `).join("")}
    </div>
  `;
}

  /* Hygiène du jour */
  const hygRows = readLS(LS.hygiene).filter(r => r.date === todayISO());
  const lastHyg = hygRows.length ? hygRows[hygRows.length - 1] : null;

  if(!lastHyg){
    hygBox.innerHTML = `<div class="inspection-empty">Aucun relevé hygiène enregistré aujourd’hui.</div>`;
  }else{
    const totalItems = (lastHyg.items || []).length;
    const doneItems = (lastHyg.items || []).filter(it => it.fait === "oui").length;
    const notDone = Math.max(totalItems - doneItems, 0);
    const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

    hygBox.innerHTML = `
      <div class="inspection-hygiene-stats">
        <div class="inspection-mini-stat">
          <div class="inspection-mini-stat-title">Tâches faites</div>
          <div class="inspection-mini-stat-value">${doneItems}</div>
        </div>
        <div class="inspection-mini-stat">
          <div class="inspection-mini-stat-title">Taux de réalisation</div>
          <div class="inspection-mini-stat-value">${pct}%</div>
        </div>
      </div>

      <div class="inspection-item">
        <div class="inspection-item-top">
          <div>
            <div class="inspection-item-title">Dernier relevé hygiène</div>
            <div class="inspection-item-sub">${lastHyg.periode || "-"} · ${lastHyg.datetime || "-"}</div>
          </div>
          <div class="inspection-item-value ${notDone === 0 ? "ok" : "warn"}">
            ${doneItems}/${totalItems}
          </div>
        </div>
        <div class="inspection-item-sub">Employé : ${lastHyg.employee || "-"}</div>
      </div>
    `;
  }

  /* Réceptions récentes */
  const recRows = readLS(LS.reception)
    .slice()
    .reverse()
    .slice(0, 5);

  if(!recRows.length){
    recBox.innerHTML = `<div class="inspection-empty">Aucune réception enregistrée.</div>`;
  }else{
    recBox.innerHTML = `<div class="inspection-list">
      ${recRows.map(r => `
        <div class="inspection-item">
          <div class="inspection-item-top">
            <div>
              <div class="inspection-item-title">${r.product || "-"}</div>
              <div class="inspection-item-sub">${r.supplier || "-"} · ${r.category || "-"}</div>
            </div>
            <div class="inspection-item-value">${r.date ? formatDateFR(r.date) : "-"}</div>
          </div>
          <div class="inspection-item-sub">
            Quantité : ${r.quantity || "-"} · Lot : ${r.lot || "-"} · DLC : ${r.dlc ? formatDateFR(r.dlc) : "-"}
          </div>
        </div>
      `).join("")}
    </div>`;
  }

  /* Notes du jour */
  const noteRows = readLS(LS.notes).filter(r => r.date === todayISO());

  if(!noteRows.length){
    notesBox.innerHTML = `<div class="inspection-empty">Aucune note enregistrée aujourd’hui.</div>`;
  }else{
    notesBox.innerHTML = `<div class="inspection-list">
      ${noteRows.slice().reverse().map(r => `
        <div class="inspection-item">
          <div class="inspection-item-top">
            <div class="inspection-item-title">${r.daily === true ? "Note du jour" : "Observation"}</div>
            <div class="inspection-item-sub">${r.datetime || "-"}</div>
          </div>
          <div class="inspection-item-sub">${(r.texte || "").trim() || "-"}</div>
        </div>
      `).join("")}
    </div>`;
  }

  /* Statut global */
  const morning = tempsDoneFor("matin");
  const afternoon = tempsDoneFor("apres-midi");
  const hygDone = !!getLastHygieneToday();

  let globalClass = "warn";
let globalText = "À vérifier";

if(morning && afternoon && hygDone){
  globalClass = "ok";
  globalText = "Conforme ✔";
}else{
  const missing = [];

  if(!morning) missing.push("Temp matin");
  if(!afternoon) missing.push("Temp après-midi");
  if(!hygDone) missing.push("Hygiène");

  if(missing.length === 3){
    globalClass = "bad";
    globalText = "Aucun relevé";
  }else{
    globalClass = "warn";
    globalText = "Manquant : " + missing.join(", ");
  }
}

  if(globalEl){
    globalEl.className = `inspection-status-pill ${globalClass}`;
    globalEl.textContent = globalText;
  }
}

window.addEventListener("load", () => {
  console.log("listeners inspection chargés");

  const btnPdf = document.getElementById("btnInspectionPDF");
  const btnPrint = document.getElementById("btnInspectionPrint");
  const btnRefresh = document.getElementById("btnInspectionRefresh");

  console.log("btnInspectionPDF =", btnPdf);
  console.log("btnInspectionPrint =", btnPrint);
  console.log("btnInspectionRefresh =", btnRefresh);

  btnPdf?.addEventListener("click", () => {
    alert("clic PDF OK");
    renderInspectionMode();
    exportInspectionModePDF();
  });

  btnPrint?.addEventListener("click", () => {
    alert("clic PRINT OK");
    renderInspectionMode();
    window.print();
  });

  btnRefresh?.addEventListener("click", () => {
    alert("clic REFRESH OK");
    renderInspectionMode();
  });
});

console.log("APP JS chargé");
}

