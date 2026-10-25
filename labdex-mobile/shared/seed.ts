// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
import type { Container, Department, LabTest, Specimen, TestInput } from './types'
import { blankSpecimen, legacyToSpecimen, type LegacySampleFields } from './migrate'

export const seedContainers: Container[] = [
  { id: 'c-bc', name: 'Blood culture set', capColor: '#3C4A5C', additive: 'Aerobic + anaerobic broth', size: '8–10 mL / bottle', kind: 'bottle', drawOrder: 1 },
  { id: 'c-lblue', name: 'Light blue top', capColor: '#7FB6E0', additive: 'Sodium citrate 3.2%', size: '2.7 mL', kind: 'tube', drawOrder: 2 },
  { id: 'c-red', name: 'Red top', capColor: '#C8352E', additive: 'Plain / clot activator', size: '6 mL', kind: 'tube', drawOrder: 3 },
  { id: 'c-gold', name: 'Gold top (SST)', capColor: '#D9A928', additive: 'Clot activator + gel', size: '5 mL', kind: 'tube', drawOrder: 4 },
  { id: 'c-green', name: 'Green top', capColor: '#3E8E5A', additive: 'Lithium heparin', size: '4 mL', kind: 'tube', drawOrder: 5 },
  { id: 'c-lav', name: 'Lavender top', capColor: '#9B7BC8', additive: 'K2-EDTA', size: '4 mL', kind: 'tube', drawOrder: 6 },
  { id: 'c-pink', name: 'Pink top', capColor: '#E58FB0', additive: 'K2-EDTA (blood bank)', size: '6 mL', kind: 'tube', drawOrder: 6 },
  { id: 'c-grey', name: 'Grey top', capColor: '#8A9099', additive: 'Sodium fluoride / K oxalate', size: '2 mL', kind: 'tube', drawOrder: 7 },
  { id: 'c-urine', name: 'Sterile urine container', capColor: '#E3C33A', additive: 'None', size: '30 mL', kind: 'cup', drawOrder: 99 },
  { id: 'c-swab', name: 'Swab in Amies medium', capColor: '#2F5DA8', additive: 'Amies transport gel', size: '—', kind: 'swab', drawOrder: 99 },
  { id: 'c-24h', name: '24-hour urine container', capColor: '#E07B2A', additive: 'None (or as stated)', size: '3 L', kind: 'bottle', drawOrder: 99 },
  { id: 'c-formalin', name: 'Formalin container', capColor: '#C9C2A8', additive: '10% neutral buffered formalin', size: '60 mL', kind: 'jar', drawOrder: 99 },
  { id: 'c-lbc', name: 'Liquid-based cytology vial', capColor: '#F1F1EE', additive: 'PreservCyt / SurePath fixative', size: '20 mL', kind: 'vial', drawOrder: 99 },
  { id: 'c-slide', name: 'Glass slide + spray fixative', capColor: '#8FA3B8', additive: '95% alcohol spray fixative', size: '2 slides', kind: 'slide', drawOrder: 99 }
]

export const seedDepartments: Department[] = [
  { id: 'd-haem', name: 'Haematology', color: '#C0392B' },
  { id: 'd-chem', name: 'Clinical Chemistry', color: '#D08A10' },
  { id: 'd-micro', name: 'Microbiology', color: '#0F8A7E' },
  { id: 'd-immuno', name: 'Immunology & Serology', color: '#6D4AB0' },
  { id: 'd-bb', name: 'Blood Transfusion', color: '#C2457A' },
  { id: 'd-mol', name: 'Molecular', color: '#3A5BC7' },
  { id: 'd-histo', name: 'Histopathology & Cytology', color: '#8C5A3C' }
]

/** Seeds with one sample use the compact v1 fields; multi-sample seeds list `specimens`. */
type Seed = Pick<TestInput, 'code' | 'name' | 'departmentId' | 'tatRoutine' | 'description'> &
  Partial<Omit<TestInput, 'specimens'>> &
  LegacySampleFields & { specimens?: (Partial<Specimen> & Pick<Specimen, 'sampleType' | 'containerId' | 'volume'>)[] }

const seeds: Seed[] = [
  {
    code: 'HAEM-FBC', name: 'Full Blood Count', synonyms: ['CBC', 'FBC', 'Haemogram'], departmentId: 'd-haem',
    sampleType: 'Whole blood', volume: 3, volumeUnit: 'mL', minVolume: 1, paedVolume: 0.5, containerId: 'c-lav',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 24, unit: 'h' }, { temp: 'FRIDGE', value: 72, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'h' }, tatUrgent: { value: 30, unit: 'min' }, daysPerformed: '24/7',
    description: 'Quantifies red cells, white cells and platelets, with haemoglobin and red cell indices.',
    suggestions: ['Invert gently 8–10 times immediately after collection', 'Do not refrigerate if a blood film is required', 'Fill to the line — under-filled tubes alter MCV and HCT'],
    rejectionCriteria: ['Clotted', 'Under-filled', 'Unlabelled', 'Older than 24 h at room temp']
  },
  {
    code: 'HAEM-MP', name: 'Malaria Parasite', synonyms: ['MP', 'Blood film for malaria', 'Thick and thin film'], departmentId: 'd-haem',
    sampleType: 'Whole blood', volume: 2, volumeUnit: 'mL', minVolume: 0.5, containerId: 'c-lav',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 4, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'h' }, tatUrgent: { value: 1, unit: 'h' }, daysPerformed: '24/7',
    description: 'Microscopic detection and speciation of Plasmodium on thick and thin Giemsa-stained films, with parasite density.',
    patientPrep: 'Collect before antimalarial treatment where possible. Note travel history on the request.',
    suggestions: ['Deliver to the lab within 1 hour — parasite morphology degrades in EDTA', 'Repeat at 12–24 h intervals if the first film is negative and suspicion remains'],
    rejectionCriteria: ['Clotted', 'Older than 4 h']
  },
  {
    code: 'COAG-PT', name: 'Prothrombin Time / INR', synonyms: ['PT', 'INR', 'Pro-time'], departmentId: 'd-haem',
    sampleType: 'Citrated plasma', volume: 2.7, volumeUnit: 'mL', containerId: 'c-lblue',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 24, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'h' }, tatUrgent: { value: 45, unit: 'min' }, daysPerformed: '24/7',
    description: 'Assesses the extrinsic coagulation pathway; INR is used to monitor warfarin therapy.',
    patientPrep: 'Record anticoagulant name, dose and time of last dose.',
    suggestions: ['Tube must be filled to the line — the 9:1 blood-to-citrate ratio is critical', 'If using a butterfly, draw a discard tube first', 'Do not refrigerate whole blood'],
    rejectionCriteria: ['Under- or over-filled', 'Clotted', 'Haemolysed', 'Collected from a heparinised line']
  },
  {
    code: 'CHEM-FBG', name: 'Fasting Blood Glucose', synonyms: ['FBS', 'FBG', 'Fasting sugar'], departmentId: 'd-chem',
    sampleType: 'Fluoride plasma', volume: 2, volumeUnit: 'mL', minVolume: 0.5, containerId: 'c-grey',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 24, unit: 'h' }, { temp: 'FRIDGE', value: 3, unit: 'd' }],
    tatRoutine: { value: 1, unit: 'h' }, tatUrgent: { value: 20, unit: 'min' }, daysPerformed: '24/7',
    description: 'Plasma glucose after an overnight fast; used in the diagnosis and monitoring of diabetes.',
    patientPrep: 'Fast for 8–12 hours. Water is allowed.',
    suggestions: ['Confirm fasting status with the patient and record it on the request', 'Fluoride stops glycolysis — do not substitute a gold top'],
    rejectionCriteria: ['Wrong container', 'Unlabelled']
  },
  {
    code: 'CHEM-HBA1C', name: 'Glycated Haemoglobin', synonyms: ['HbA1c', 'A1c'], departmentId: 'd-chem',
    sampleType: 'Whole blood', volume: 2, volumeUnit: 'mL', minVolume: 0.5, containerId: 'c-lav',
    storageTemp: 'FRIDGE', stability: [{ temp: 'ROOM', value: 3, unit: 'd' }, { temp: 'FRIDGE', value: 7, unit: 'd' }],
    tatRoutine: { value: 1, unit: 'd' }, daysPerformed: 'Mon–Fri',
    description: 'Reflects average blood glucose over the previous 8–12 weeks.',
    suggestions: ['No fasting required', 'Interpret with caution in haemoglobinopathies or recent transfusion'],
    rejectionCriteria: ['Clotted']
  },
  {
    code: 'CHEM-UE', name: 'Urea & Electrolytes', synonyms: ['U&E', 'Renal profile', 'E/U/Cr'], departmentId: 'd-chem',
    sampleType: 'Serum', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-gold',
    storageTemp: 'FRIDGE', stability: [{ temp: 'ROOM', value: 8, unit: 'h' }, { temp: 'FRIDGE', value: 2, unit: 'd' }],
    tatRoutine: { value: 2, unit: 'h' }, tatUrgent: { value: 1, unit: 'h' }, daysPerformed: '24/7',
    description: 'Sodium, potassium, chloride, bicarbonate, urea and creatinine with eGFR.',
    suggestions: ['Centrifuge within 2 hours — delayed separation falsely raises potassium', 'Avoid prolonged tourniquet time and fist clenching'],
    rejectionCriteria: ['Haemolysed', 'Unseparated > 4 h']
  },
  {
    code: 'CHEM-LFT', name: 'Liver Function Tests', synonyms: ['LFT', 'Hepatic panel'], departmentId: 'd-chem',
    sampleType: 'Serum', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-gold',
    storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 3, unit: 'd' }], protectFromLight: true,
    tatRoutine: { value: 4, unit: 'h' }, tatUrgent: { value: 1, unit: 'h' }, daysPerformed: '24/7',
    description: 'Bilirubin, ALT, AST, ALP, GGT, total protein and albumin.',
    suggestions: ['Protect from light — bilirubin degrades under light', 'Neonatal bilirubin: wrap the tube in foil'],
    rejectionCriteria: ['Grossly haemolysed', 'Lipaemic']
  },
  {
    code: 'CHEM-TROP', name: 'High-Sensitivity Troponin I', synonyms: ['hs-TnI', 'Troponin'], departmentId: 'd-chem',
    sampleType: 'Heparin plasma', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-green',
    storageTemp: 'FRIDGE', stability: [{ temp: 'ROOM', value: 4, unit: 'h' }, { temp: 'FRIDGE', value: 24, unit: 'h' }],
    tatRoutine: { value: 1, unit: 'h' }, tatUrgent: { value: 45, unit: 'min' }, daysPerformed: '24/7',
    description: 'Marker of myocardial injury; used in rule-in/rule-out pathways for acute coronary syndrome.',
    suggestions: ['Record exact collection time — serial samples are interpreted by time interval', 'Send repeat sample at 1–3 h as per local chest-pain pathway'],
    rejectionCriteria: ['Haemolysed', 'Collection time missing']
  },
  {
    code: 'IMM-TSH', name: 'Thyroid Stimulating Hormone', synonyms: ['TSH', 'Thyrotropin'], departmentId: 'd-immuno',
    sampleType: 'Serum', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-gold',
    storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 7, unit: 'd' }, { temp: 'FROZEN', value: 1, unit: 'wk' }],
    tatRoutine: { value: 1, unit: 'd' }, daysPerformed: 'Mon–Sat',
    description: 'First-line test of thyroid function.',
    suggestions: ['Biotin supplements can interfere — stop 48 h before collection if possible'],
    rejectionCriteria: ['Grossly haemolysed']
  },
  {
    code: 'MOL-HIVVL', name: 'HIV-1 Viral Load', synonyms: ['HIV VL', 'HIV RNA PCR'], departmentId: 'd-mol',
    sampleType: 'EDTA plasma', volume: 6, volumeUnit: 'mL', minVolume: 3, containerId: 'c-lav',
    storageTemp: 'FROZEN', stability: [{ temp: 'ROOM', value: 24, unit: 'h' }, { temp: 'FRIDGE', value: 5, unit: 'd' }, { temp: 'FROZEN', value: 6, unit: 'wk' }],
    tatRoutine: { value: 5, unit: 'd' }, daysPerformed: 'Tue, Thu',
    description: 'Quantifies HIV-1 RNA to monitor response to antiretroviral therapy.',
    transportNotes: 'Separate plasma within 24 h. Ship frozen on dry ice if sent out.',
    suggestions: ['Collect two lavender tubes to ensure enough plasma', 'Avoid repeated freeze–thaw cycles'],
    rejectionCriteria: ['Whole blood older than 24 h', 'Clotted', 'Insufficient volume']
  },
  {
    code: 'BB-GXM', name: 'Group & Crossmatch', synonyms: ['GXM', 'Type and cross', 'Crossmatch'], departmentId: 'd-bb',
    sampleType: 'Whole blood', volume: 6, volumeUnit: 'mL', minVolume: 4, containerId: 'c-pink',
    storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 72, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'h' }, tatUrgent: { value: 45, unit: 'min' }, daysPerformed: '24/7',
    description: 'ABO/RhD grouping, antibody screen and compatibility testing for transfusion.',
    suggestions: ['Label at the bedside by the person who collected the sample', 'Labels must be hand-written: full name, DOB, hospital number, date, signature', 'State the number of units and the date required'],
    rejectionCriteria: ['Any labelling discrepancy — zero tolerance', 'Pre-printed addressograph labels', 'Older than 72 h']
  },
  {
    code: 'MICRO-BC', name: 'Blood Culture', synonyms: ['BC', 'Blood C/S'], departmentId: 'd-micro',
    sampleType: 'Whole blood', volume: 10, volumeUnit: 'mL', minVolume: 5, paedVolume: 1, containerId: 'c-bc',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 4, unit: 'h' }],
    tatRoutine: { value: 5, unit: 'd' }, daysPerformed: '24/7',
    description: 'Detects bacteraemia and fungaemia; positive bottles are Gram-stained and identified with sensitivities.',
    patientPrep: 'Collect before antibiotics where possible.',
    suggestions: ['Draw blood cultures FIRST in the order of draw', 'Disinfect skin with 2% chlorhexidine in 70% alcohol and allow to dry', 'Inoculate aerobic bottle first when using a butterfly', 'Do NOT refrigerate'],
    rejectionCriteria: ['Refrigerated', 'Bottle barcode covered by label']
  },
  {
    code: 'MICRO-UCS', name: 'Urine Culture & Sensitivity', synonyms: ['MSU', 'Urine C/S', 'Urine M/C/S'], departmentId: 'd-micro',
    sampleType: 'Midstream urine', volume: 10, volumeUnit: 'mL', minVolume: 1, containerId: 'c-urine',
    storageTemp: 'FRIDGE', stability: [{ temp: 'ROOM', value: 2, unit: 'h' }, { temp: 'FRIDGE', value: 24, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'd' }, daysPerformed: 'Daily',
    description: 'Microscopy, culture and antibiotic sensitivity for suspected urinary tract infection.',
    patientPrep: 'Clean-catch midstream; first morning sample preferred.',
    suggestions: ['Refrigerate if not delivered within 2 hours', 'Note any antibiotics already started'],
    rejectionCriteria: ['Leaking container', 'Unrefrigerated > 2 h', 'Sample from catheter bag']
  },
  {
    code: 'MICRO-HVS', name: 'High Vaginal Swab', synonyms: ['HVS'], departmentId: 'd-micro',
    sampleType: 'Swab', volume: 1, volumeUnit: 'swab', containerId: 'c-swab',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 48, unit: 'h' }],
    tatRoutine: { value: 2, unit: 'd' }, daysPerformed: 'Mon–Sat',
    description: 'Culture for candida, bacterial vaginosis and Group B streptococcus.',
    suggestions: ['Break the swab shaft into transport medium immediately', 'For chlamydia/gonorrhoea use the dedicated NAAT swab instead'],
    rejectionCriteria: ['Dry swab', 'No transport medium']
  },
  {
    code: 'IMM-HBSAG', name: 'Hepatitis B Surface Antigen', synonyms: ['HBsAg', 'Hep B'], departmentId: 'd-immuno',
    sampleType: 'Serum', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-gold',
    storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 5, unit: 'd' }, { temp: 'FROZEN', value: 4, unit: 'wk' }],
    tatRoutine: { value: 1, unit: 'd' }, tatUrgent: { value: 2, unit: 'h' }, daysPerformed: 'Daily', status: 'DRAFT',
    description: 'Screening for current hepatitis B infection.',
    suggestions: ['Reactive results are confirmed by neutralisation before reporting'],
    rejectionCriteria: ['Grossly haemolysed']
  },
  {
    code: 'HISTO-BX', name: 'Histopathology — Tissue Biopsy', synonyms: ['Histology', 'Biopsy', 'Tissue exam', 'H&E'], departmentId: 'd-histo',
    sampleType: 'Tissue', volume: 1, volumeUnit: 'piece', containerId: 'c-formalin',
    storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 2, unit: 'wk' }],
    tatRoutine: { value: 5, unit: 'd' }, daysPerformed: 'Mon–Fri',
    description: 'Microscopic examination of fixed tissue (H&E) for diagnosis, with special stains or immunohistochemistry as needed.',
    transportNotes: 'Transport at room temperature. Never freeze tissue in formalin.',
    suggestions: [
      'Place tissue in formalin immediately — fixative volume should be 10–20× the tissue volume',
      'Label the container itself, not the lid',
      'Give the anatomical site, clinical history and any previous histology number on the request',
      'For frozen section, lymphoma or cytogenetics, send fresh (no formalin) and phone the lab first'
    ],
    rejectionCriteria: ['Unlabelled container', 'Tissue dried out or without fixative', 'Request form missing clinical details']
  },
  {
    code: 'CYTO-PAP', name: 'PAP Smear — Cervical Cytology', synonyms: ['Pap test', 'Pap smear', 'Cervical smear', 'LBC', 'ThinPrep'], departmentId: 'd-histo',
    specimens: [
      { role: 'ALTERNATIVE', sampleType: 'Cervical cells (liquid-based)', volume: 1, volumeUnit: 'vial', containerId: 'c-lbc', storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 6, unit: 'wk' }], notes: 'Preferred. Rinse the brush/broom in the vial immediately and cap tightly.' },
      { role: 'ALTERNATIVE', sampleType: 'Cervical smear (conventional)', volume: 2, volumeUnit: 'slide', containerId: 'c-slide', storageTemp: 'ROOM', stability: [{ temp: 'ROOM', value: 1, unit: 'wk' }], notes: 'Spread thinly and spray-fix within 10 seconds to avoid air-drying.' }
    ],
    tatRoutine: { value: 7, unit: 'd' }, daysPerformed: 'Mon–Fri',
    description: 'Screening of cervical cells for dysplasia and malignancy. Liquid-based samples can also be tested for high-risk HPV.',
    patientPrep: 'Avoid collection during menstruation. No intercourse, douching or vaginal creams for 48 hours before.',
    suggestions: ['Write the slide label in pencil on the frosted end', 'Record LMP, contraception and any previous abnormal result'],
    rejectionCriteria: ['Unlabelled vial or slide', 'Broken slide', 'Air-dried smear', 'Expired LBC vial']
  },
  {
    code: 'CHEM-CRCL', name: 'Creatinine Clearance', synonyms: ['CrCl', '24h urine creatinine'], departmentId: 'd-chem',
    specimens: [
      { role: 'REQUIRED', sampleType: '24 h urine', volume: 1, volumeUnit: 'mL', containerId: 'c-24h', storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 3, unit: 'd' }], notes: 'Discard first morning void, then collect every void for 24 hours including the next first morning void.' },
      { role: 'REQUIRED', sampleType: 'Serum', volume: 4, volumeUnit: 'mL', minVolume: 1, containerId: 'c-gold', storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 2, unit: 'd' }], notes: 'Draw during the 24-hour urine collection.' }
    ],
    tatRoutine: { value: 1, unit: 'd' }, daysPerformed: 'Mon–Fri',
    description: 'Estimates glomerular filtration rate from 24-hour urine creatinine and serum creatinine.',
    patientPrep: 'Record height and weight. Keep the urine container refrigerated during collection.',
    suggestions: ['Write start and finish times on the container', 'Both samples must reach the lab together'],
    rejectionCriteria: ['Incomplete collection', 'Collection times missing', 'Serum sample missing']
  }
]

export function buildSeedTests(): LabTest[] {
  const now = new Date().toISOString()
  return seeds.map((s, i) => {
    const id = `t-seed-${i + 1}`
    const specimens: Specimen[] = s.specimens
      ? s.specimens.map((p, j) => ({ ...blankSpecimen(`${id}-s${j + 1}`), ...p }))
      : [legacyToSpecimen(`${id}-s1`, s)]
    return {
      code: s.code,
      name: s.name,
      synonyms: s.synonyms ?? [],
      departmentId: s.departmentId,
      specimens,
      transportNotes: s.transportNotes ?? '',
      tatRoutine: s.tatRoutine,
      tatUrgent: s.tatUrgent ?? null,
      daysPerformed: s.daysPerformed ?? '',
      description: s.description,
      patientPrep: s.patientPrep ?? '',
      suggestions: s.suggestions ?? [],
      rejectionCriteria: s.rejectionCriteria ?? [],
      status: s.status ?? 'PUBLISHED',
      id,
      version: 1,
      createdAt: now,
      updatedAt: now
    }
  })
}
