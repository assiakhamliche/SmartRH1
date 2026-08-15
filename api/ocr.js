// ============================================================
// /api/ocr  —  Extraction OCR des CIN marocaines via Gemini
// La clé API reste côté serveur (variable d'environnement GEMINI_API_KEY).
// Reçoit { pdf: "<base64>" }, renvoie { rows: [ { civilite, nomSalarie, cin,
// dateNaissance, adresse, ville, lieuNaissance } ] } prêt pour le générateur.
// ============================================================

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];

const PROMPT = `Ce PDF contient des CARTES D'IDENTITÉ NATIONALES (CIN) MAROCAINES.

STRUCTURE (généralement 2 pages par CIN) :
- RECTO : Nom, Prénom, N° CIN, Date de naissance, Lieu de naissance (مكان الازدياد)
- VERSO : Adresse complète (العنوان / Adresse)

Extrais CHAQUE CIN présente. Renvoie un tableau JSON.
IMPORTANT :
- Lieu_Naissance est le lieu de naissance (recto), Adresse est le domicile (verso) : ce sont deux informations différentes.
- Civilite = "Monsieur" ou "Madame" selon le prénom.
- Si une information est absente, laisse une chaîne vide.`;

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      Nom: { type: "STRING" },
      Prenom: { type: "STRING" },
      Numero_CIN: { type: "STRING" },
      Date_Naissance: { type: "STRING" },
      Lieu_Naissance: { type: "STRING" },
      Adresse: { type: "STRING" },
      Ville: { type: "STRING" },
      Civilite: { type: "STRING" }
    }
  }
};

const VILLES_MA = ["Casablanca","Rabat","Marrakech","Fès","Tanger","Agadir","Meknès","Oujda","El Jadida","Kénitra","Mohammédia","Tétouan","Salé","Béni Mellal","Laâyoune","Safi","Nador","Khouribga","Ifrane","Settat","Khémisset","Berkane","Errachidia","Guelmim","Dakhla","Tiznit","Taroudant","Essaouira","Larache","Ksar El Kebir","Chefchaouen","Ouarzazate","Sidi Kacem","Sidi Slimane","Youssoufia","Taza","Azrou","Taourirt","Midelt","Zagora","Tinghir","Figuig","Tan-Tan","Sefrou","Benslimane","Berrechid","Tata"];

const PRENOMS_F = ['fatima','aicha','khadija','zainab','latifa','amina','hafsa','salma','meryem','yasmine','imane','sanaa','karima','samira','nadia','rachida','zineb','houda','wafaa','laila','malika','jamila','naima','fatiha','fatna','zohra','halima','souad','ismahane'];
const PRENOMS_M = ['mohamed','ahmed','hassan','ali','omar','youssef','hamza','karim','amine','said','rachid','abdelaziz','mustapha','mustafa','khalid','tarik','mehdi','fahd','salah','jamal','bilal','hicham','abdellah','brahim','ismail'];

function determineCivilite(prenom) {
  const p = (prenom || "").toLowerCase();
  if (PRENOMS_F.some(x => p.includes(x))) return "Mme";
  if (PRENOMS_M.some(x => p.includes(x))) return "Mr";
  return "";
}
function normCivilite(c, prenom) {
  const cv = (c || "").toLowerCase().trim();
  if (cv.startsWith("monsieur") || cv === "mr" || cv === "m.") return "Mr";
  if (cv.startsWith("madame") || cv === "mme") return "Mme";
  if (cv.startsWith("mademoiselle") || cv === "mlle") return "Mlle";
  return determineCivilite(prenom);
}
function extractVille(adresse) {
  const a = (adresse || "").toUpperCase();
  for (const v of VILLES_MA) if (a.includes(v.toUpperCase())) return v;
  return "";
}
function toISO(s) {
  if (!s) return "";
  s = ("" + s).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  return s;
}

async function readJson(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function callGemini(model, apiKey, pdfBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
      { text: PROMPT }
    ]}],
    generationConfig: { response_mime_type: "application/json", response_schema: RESPONSE_SCHEMA }
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error(`Gemini ${model}: ${r.status} ${t.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  return text.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée" }); return; }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "Clé GEMINI_API_KEY absente (à définir dans les variables d'environnement Vercel)." }); return; }

  let pdfBase64;
  try {
    const body = await readJson(req);
    pdfBase64 = body.pdf;
    if (!pdfBase64) throw new Error("Champ 'pdf' manquant.");
  } catch (e) {
    res.status(400).json({ error: "Requête invalide : " + e.message }); return;
  }

  let raw = "", lastErr = null;
  for (const model of MODELS) {
    try { raw = await callGemini(model, apiKey, pdfBase64); if (raw) break; }
    catch (e) { lastErr = e; }
  }
  if (!raw) { res.status(502).json({ error: "Extraction impossible. " + (lastErr ? lastErr.message : "") }); return; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = [parsed];
  } catch (e) { res.status(502).json({ error: "Réponse OCR illisible." }); return; }

  const seen = new Set();
  const rows = [];
  for (const cin of parsed) {
    const nom = (cin.Nom || "").trim().toUpperCase();
    const prenom = (cin.Prenom || "").trim();
    const cinNum = (cin.Numero_CIN || "").trim().toUpperCase().replace(/\s+/g, "");
    const key = cinNum || (nom + "|" + prenom + "|" + (cin.Date_Naissance || ""));
    if (seen.has(key)) continue;
    seen.add(key);
    const adresse = (cin.Adresse || "").trim();
    rows.push({
      civilite: normCivilite(cin.Civilite, prenom),
      nomSalarie: (prenom + " " + nom).trim(),
      cin: cinNum,
      dateNaissance: toISO(cin.Date_Naissance),
      adresse: adresse,
      ville: (cin.Ville || "").trim() || extractVille(adresse),
      lieuNaissance: (cin.Lieu_Naissance || "").trim(),
      nationalite: "Marocaine"
    });
  }

  res.status(200).json({ rows });
}
