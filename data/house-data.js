window.HOUSE_DATA = {
  "version": 1,
  "house": {
    "name": "The Family House",
    "place": "La Croix-Valmer",
    "region": "Var, Gulf of Saint-Tropez",
    "lat": 43.2072,
    "lon": 6.5694
  },
  "users": [
    {
      "id": "u-admin",
      "name": "House Admin",
      "role": "admin",
      "pinSalt": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      "pinHash": "457a2ff654a76ac5a19ce5a4e04e5c54ad717e94712db4dc28d54c03d13c452b",
      "createdAt": "2025-01-10T10:00:00.000Z",
      "createdBy": "u-admin"
    },
    {
      "id": "u-claire",
      "name": "Claire",
      "role": "family",
      "pinSalt": "1f2e3d4c5b6a79887766554433221100",
      "pinHash": "3d0cc5cda3ac602611135108dbaea619fd9968142f30407f8d51e8602b77b6ce",
      "createdAt": "2025-01-10T10:05:00.000Z",
      "createdBy": "u-admin"
    },
    {
      "id": "u-guest",
      "name": "Guest",
      "role": "guest",
      "pinSalt": "0123456789abcdef0123456789abcdef",
      "pinHash": "947ed0332373c6a3ab818240e639ba4cc59b16b3a03ef26c4cfafae419217f27",
      "createdAt": "2025-03-01T09:00:00.000Z",
      "createdBy": "u-admin"
    }
  ],
  "bookings": [
    {
      "id": "b-may",
      "arrival": "2026-05-23",
      "departure": "2026-05-30",
      "guestCount": 4,
      "guests": "House Admin, Anne, and the twins",
      "notes": "Spring half-term. Pool just opened.",
      "status": "booked",
      "createdBy": "u-admin",
      "createdAt": "2026-02-12T11:00:00.000Z"
    },
    {
      "id": "b-jul",
      "arrival": "2026-07-04",
      "departure": "2026-07-18",
      "guestCount": 6,
      "guests": "Claire, Tom, kids, and Granny",
      "notes": "Long summer stay. Beach days at Gigaro.",
      "status": "booked",
      "createdBy": "u-claire",
      "createdAt": "2026-01-20T18:30:00.000Z"
    },
    {
      "id": "b-now",
      "arrival": "2026-08-08",
      "departure": "2026-08-16",
      "guestCount": 2,
      "guests": "Sophie and Mark (friends of Claire)",
      "notes": "First time at the house. Spare keys in the kitchen drawer.",
      "status": "booked",
      "createdBy": "u-claire",
      "createdAt": "2026-06-02T09:15:00.000Z"
    },
    {
      "id": "b-aug2",
      "arrival": "2026-08-22",
      "departure": "2026-08-29",
      "guestCount": 5,
      "guests": "Claire and family",
      "notes": "Late August. Book restaurant for Friday if possible.",
      "status": "booked",
      "createdBy": "u-claire",
      "createdAt": "2026-03-14T16:00:00.000Z"
    },
    {
      "id": "b-sep",
      "arrival": "2026-09-05",
      "departure": "2026-09-12",
      "guestCount": 3,
      "guests": "House Admin and friends",
      "notes": "Quieter week after the summer rush.",
      "status": "booked",
      "createdBy": "u-admin",
      "createdAt": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": "b-block",
      "arrival": "2026-09-15",
      "departure": "2026-09-17",
      "guestCount": 0,
      "guests": "",
      "notes": "Pool pump replacement — house closed.",
      "status": "blocked",
      "createdBy": "u-admin",
      "createdAt": "2026-07-28T08:00:00.000Z"
    },
    {
      "id": "b-oct",
      "arrival": "2026-10-17",
      "departure": "2026-10-24",
      "guestCount": 4,
      "guests": "Claire and the children",
      "notes": "Autumn half-term.",
      "status": "booked",
      "createdBy": "u-claire",
      "createdAt": "2026-05-09T12:00:00.000Z"
    }
  ],
  "documents": [
    {
      "id": "d-access",
      "title": "Arrival — access and keys",
      "category": "Arrival",
      "body": "SAMPLE ONLY — change these notes in the GitHub data file when you use the house for real.\n\nGate: small remote in the key box by the olive tree.\nFront door: Yale lock. Spare set in the kitchen drawer marked 'spares'.\nParking: two spaces under the pines, nose-in. Do not block the neighbour's turning circle.\nWifi name and password: see the Wi-Fi card in Manuals.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:00:00.000Z"
    },
    {
      "id": "d-alarm",
      "title": "Arrival — alarm",
      "category": "Arrival",
      "body": "SAMPLE — do not use these as real codes.\n\nPanel is inside the front door, left wall.\nUnset: enter your family code, then OFF.\nSet when leaving: CLOSE, then ON. Wait for the double beep.\nIf it sounds, press OFF and call the property manager.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:05:00.000Z"
    },
    {
      "id": "d-checkin",
      "title": "Arrival — check-in list",
      "category": "Arrival",
      "body": "1. Open shutters on the garden side.\n2. Fridge on, check milk and water.\n3. Pool cover: only adults, hook on the far wall.\n4. Read the pool rules on the terrace notice.\n5. Nearest beach is Gigaro — 5 minutes by car, or a shaded walk.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:10:00.000Z"
    },
    {
      "id": "d-clean",
      "title": "Departure — cleaning",
      "category": "Departure",
      "body": "Strip beds and leave linen in the laundry basket.\nRun the dishwasher and empty it.\nWipe kitchen surfaces.\nTake rubbish and recycling to the bins on Chemin des Moulins (see Bins note).\nLeave used towels in the bathroom hamper.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:15:00.000Z"
    },
    {
      "id": "d-lock",
      "title": "Departure — lock-up",
      "category": "Departure",
      "body": "Close all windows and shutters.\nBBQ gas OFF.\nOutdoor cushions in the pool cupboard.\nLights off.\nAlarm ON.\nGate closed. Return remotes to the key box.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:20:00.000Z"
    },
    {
      "id": "d-bins",
      "title": "Departure — bins",
      "category": "Departure",
      "body": "Yellow lid: recycling. Grey: household. Glass: bottle bank by the Mairie.\nCollection is usually Tuesday morning. Put bins out Monday evening if you leave on a Tuesday.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:25:00.000Z"
    },
    {
      "id": "d-ac",
      "title": "Manual — air conditioning",
      "category": "Manuals",
      "body": "Wall remotes in each bedroom. Start at 24°C. Do not run AC with shutters and windows open.\nOutdoor unit is behind the kitchen. If it ices or drips heavily, turn off and report a maintenance issue.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:30:00.000Z"
    },
    {
      "id": "d-pool",
      "title": "Manual — pool",
      "category": "Manuals",
      "body": "Hours: 8:00–20:00. No glass. Children with an adult only.\nRobot lives in the plant room. Pump schedule is on the timer — do not change it.\nCover: wind on the reel clockwise. Never walk on the cover.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:35:00.000Z"
    },
    {
      "id": "d-wifi",
      "title": "Manual — Wi-Fi and TV",
      "category": "Manuals",
      "body": "Network: FamilyHouse-WiFi (sample).\nPassword: on the card in the kitchen drawer.\nOrange Livebox is in the cupboard under the stairs. Red light? Restart it, wait two minutes.\nTV: HDMI 1 is the Fire Stick. HDMI 2 is French TNT.",
      "createdBy": "u-admin",
      "createdAt": "2026-03-01T10:40:00.000Z"
    }
  ],
  "restaurants": [
    {
      "id": "r-camille",
      "name": "Chez Camille",
      "town": "La Croix-Valmer",
      "address": "Plage de Gigaro, 83420 La Croix-Valmer",
      "phone": "+33 4 94 79 59 26",
      "website": "https://www.chezcamille.fr",
      "cuisine": "Seafood",
      "rating": 5,
      "notes": "Feet in the sand at Gigaro. Book ahead in summer.",
      "createdBy": "u-claire",
      "createdAt": "2026-07-08T19:00:00.000Z"
    },
    {
      "id": "r-escale",
      "name": "L'Escale",
      "town": "La Croix-Valmer",
      "address": "Port de La Croix-Valmer",
      "phone": "+33 4 94 79 67 11",
      "website": "",
      "cuisine": "Provençal",
      "rating": 4,
      "notes": "Simple, good for a quiet supper in the village.",
      "createdBy": "u-admin",
      "createdAt": "2026-05-24T20:00:00.000Z"
    },
    {
      "id": "r-club55",
      "name": "Club 55",
      "town": "Ramatuelle",
      "address": "Plage de Pampelonne, 83350 Ramatuelle",
      "phone": "+33 4 94 55 55 55",
      "website": "https://www.leclub55.fr",
      "cuisine": "Beach",
      "rating": 4,
      "notes": "Famous and busy. Treat, not a weekly habit.",
      "createdBy": "u-claire",
      "createdAt": "2026-07-12T14:00:00.000Z"
    },
    {
      "id": "r-gassin",
      "name": "Le Micocoulier",
      "town": "Gassin",
      "address": "Place de la Mairie, 83580 Gassin",
      "phone": "+33 4 94 56 14 01",
      "website": "",
      "cuisine": "French",
      "rating": 5,
      "notes": "Village square, sunset over the gulf.",
      "createdBy": "u-admin",
      "createdAt": "2026-05-26T19:30:00.000Z"
    },
    {
      "id": "r-pizza",
      "name": "Villa Mezza",
      "town": "Cavalaire-sur-Mer",
      "address": "Avenue des Alliés, 83240 Cavalaire-sur-Mer",
      "phone": "+33 4 94 64 22 90",
      "website": "",
      "cuisine": "Pizza",
      "rating": 4,
      "notes": "Easy with children. Takeaway possible.",
      "createdBy": "u-claire",
      "createdAt": "2026-07-10T18:00:00.000Z"
    }
  ],
  "reviews": [
    {
      "id": "rv-1",
      "restaurantId": "r-camille",
      "rating": 5,
      "text": "Grilled fish and rosé, children happy in the shallows. Go early.",
      "createdBy": "u-claire",
      "createdAt": "2026-07-08T21:00:00.000Z"
    }
  ],
  "contacts": [
    {
      "id": "c-pool",
      "name": "Luc Moreau",
      "business": "Azur Piscines",
      "category": "pool",
      "phone": "+33 6 12 34 56 01",
      "email": "luc@azurpiscines.example",
      "notes": "Weekly chemistry and robot. Knows our timer.",
      "lastUsed": "2026-08-05",
      "createdBy": "u-admin"
    },
    {
      "id": "c-clean",
      "name": "Marie Blanc",
      "business": "Maison Claire",
      "category": "cleaner",
      "phone": "+33 6 12 34 56 02",
      "email": "marie@maisonclaire.example",
      "notes": "Changeover cleans. Prefers morning slots.",
      "lastUsed": "2026-08-08",
      "createdBy": "u-admin"
    },
    {
      "id": "c-elec",
      "name": "Paul Rossi",
      "business": "Électricité du Golfe",
      "category": "electrician",
      "phone": "+33 6 12 34 56 03",
      "email": "paul@elecgolfe.example",
      "notes": "Fuse board and outdoor lights.",
      "lastUsed": "2026-06-18",
      "createdBy": "u-admin"
    },
    {
      "id": "c-plumb",
      "name": "Henri Vidal",
      "business": "Plomberie Vidal",
      "category": "plumber",
      "phone": "+33 6 12 34 56 04",
      "email": "henri@vidal.example",
      "notes": "Stopcock and pool plant room.",
      "lastUsed": "2026-04-02",
      "createdBy": "u-admin"
    },
    {
      "id": "c-garden",
      "name": "Nadia Costa",
      "business": "Jardins des Maures",
      "category": "gardener",
      "phone": "+33 6 12 34 56 05",
      "email": "nadia@jardinsmaures.example",
      "notes": "Monthly visit. Watering in heatwaves.",
      "lastUsed": "2026-08-01",
      "createdBy": "u-admin"
    },
    {
      "id": "c-build",
      "name": "Antoine Perez",
      "business": "Perez Bâtiment",
      "category": "builder",
      "phone": "+33 6 12 34 56 06",
      "email": "antoine@perezb.example",
      "notes": "Shutters, terrace repairs.",
      "lastUsed": "2026-03-20",
      "createdBy": "u-admin"
    },
    {
      "id": "c-pm",
      "name": "Élise Fournier",
      "business": "Golfe Property",
      "category": "manager",
      "phone": "+33 6 12 34 56 07",
      "email": "elise@golfeproperty.example",
      "notes": "First call if you cannot reach family.",
      "lastUsed": "2026-08-08",
      "createdBy": "u-admin"
    },
    {
      "id": "c-112",
      "name": "Emergency (EU)",
      "business": "112",
      "category": "emergency",
      "phone": "112",
      "email": "",
      "notes": "Works from any phone. English possible.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-15",
      "name": "SAMU ambulance",
      "business": "15",
      "category": "emergency",
      "phone": "15",
      "email": "",
      "notes": "Medical emergency.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-18",
      "name": "Pompiers / fire",
      "business": "18",
      "category": "emergency",
      "phone": "18",
      "email": "",
      "notes": "Fire, accidents, rescue.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-17",
      "name": "Police / gendarmerie",
      "business": "17",
      "category": "emergency",
      "phone": "17",
      "email": "",
      "notes": "Police emergency.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-hosp",
      "name": "Centre Hospitalier de Saint-Tropez",
      "business": "Hospital (Gassin)",
      "category": "hospital",
      "phone": "+33 4 94 55 85 00",
      "email": "",
      "notes": "Closest hospital. 200 Chemin de l'Enclos, 83580 Gassin.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-enedis",
      "name": "Enedis",
      "business": "Electricity network",
      "category": "utility",
      "phone": "09 72 67 50 83",
      "email": "",
      "notes": "Power cut reporting.",
      "lastUsed": "",
      "createdBy": "u-admin"
    },
    {
      "id": "c-grdf",
      "name": "GRDF",
      "business": "Gas network",
      "category": "utility",
      "phone": "0 800 47 33 33",
      "email": "",
      "notes": "Smell of gas: leave the house, then call.",
      "lastUsed": "",
      "createdBy": "u-admin"
    }
  ],
  "maintenance": [
    {
      "id": "m-shutter",
      "title": "Bedroom 2 shutter stuck",
      "description": "Right-hand shutter will not fold back. Guests cannot darken the room properly.",
      "category": "Furniture",
      "priority": "important",
      "status": "assigned",
      "reporter": "u-claire",
      "date": "2026-07-16",
      "assignedContractorId": "c-build",
      "estimatedCompletion": "2026-09-16",
      "completionNotes": "",
      "photos": [],
      "videos": [],
      "invoices": [],
      "createdBy": "u-claire",
      "createdAt": "2026-07-16T09:20:00.000Z"
    },
    {
      "id": "m-filter",
      "title": "Pool filter noisy",
      "description": "Loud rattle from the plant room after 10 minutes. Water still clear.",
      "category": "Pool",
      "priority": "urgent",
      "status": "progress",
      "reporter": "u-admin",
      "date": "2026-08-05",
      "assignedContractorId": "c-pool",
      "estimatedCompletion": "2026-09-16",
      "completionNotes": "",
      "photos": [],
      "videos": [],
      "invoices": [],
      "createdBy": "u-admin",
      "createdAt": "2026-08-05T07:40:00.000Z"
    },
    {
      "id": "m-wifi",
      "title": "Wi-Fi drops in the annex",
      "description": "Signal dies in the little bedroom off the terrace around 7pm.",
      "category": "Electrical",
      "priority": "minor",
      "status": "reviewed",
      "reporter": "u-guest",
      "date": "2026-08-10",
      "assignedContractorId": "",
      "estimatedCompletion": "",
      "completionNotes": "",
      "photos": [],
      "videos": [],
      "invoices": [],
      "createdBy": "u-guest",
      "createdAt": "2026-08-10T19:10:00.000Z"
    },
    {
      "id": "m-light",
      "title": "Terrace spot light out",
      "description": "Far left garden spot is dead. Path is dark at night.",
      "category": "Electrical",
      "priority": "minor",
      "status": "completed",
      "reporter": "u-claire",
      "date": "2026-05-24",
      "assignedContractorId": "c-elec",
      "estimatedCompletion": "2026-06-18",
      "completionNotes": "Replaced fitting and bulb. Invoice filed.",
      "photos": [],
      "videos": [],
      "invoices": [],
      "createdBy": "u-claire",
      "createdAt": "2026-05-24T21:00:00.000Z"
    }
  ],
  "comments": [
    {
      "id": "cm-1",
      "parentType": "maintenance",
      "parentId": "m-filter",
      "text": "Luc is ordering a new pump. House blocked 15–17 Sept for the swap.",
      "createdBy": "u-admin",
      "createdAt": "2026-08-06T11:00:00.000Z"
    },
    {
      "id": "cm-2",
      "parentType": "idea",
      "parentId": "i-ev",
      "text": "Need to check Enedis supply before we buy a charger.",
      "createdBy": "u-admin",
      "createdAt": "2026-06-01T09:00:00.000Z"
    }
  ],
  "recurring": [
    {
      "id": "rc-pool",
      "title": "Weekly pool check",
      "frequency": "weekly",
      "assignedContactId": "c-pool",
      "lastCompleted": "2026-08-05",
      "nextDue": "2026-08-12",
      "notes": "Chlorine, pH, robot, skimmer baskets."
    },
    {
      "id": "rc-garden",
      "title": "Monthly garden visit",
      "frequency": "monthly",
      "assignedContactId": "c-garden",
      "lastCompleted": "2026-08-01",
      "nextDue": "2026-09-01",
      "notes": "Lawn, olives, watering."
    },
    {
      "id": "rc-clean",
      "title": "Quarterly deep clean",
      "frequency": "quarterly",
      "assignedContactId": "c-clean",
      "lastCompleted": "2026-06-01",
      "nextDue": "2026-09-01",
      "notes": "Ovens, windows, cupboards."
    },
    {
      "id": "rc-ac",
      "title": "Annual AC service",
      "frequency": "annual",
      "assignedContactId": "c-elec",
      "lastCompleted": "2025-10-10",
      "nextDue": "2026-10-10",
      "notes": "Filters and outdoor unit."
    },
    {
      "id": "rc-elec",
      "title": "Annual electrical inspection",
      "frequency": "annual",
      "assignedContactId": "c-elec",
      "lastCompleted": "2025-11-02",
      "nextDue": "2026-11-02",
      "notes": "Board, RCDs, outdoor circuits."
    }
  ],
  "expenses": [
    {
      "id": "e-1",
      "category": "maintenance",
      "amount": 186,
      "currency": "EUR",
      "date": "2026-06-18",
      "supplier": "Électricité du Golfe",
      "notes": "Terrace light fitting",
      "issueId": "m-light",
      "createdBy": "u-admin"
    },
    {
      "id": "e-2",
      "category": "cleaning",
      "amount": 140,
      "currency": "EUR",
      "date": "2026-08-08",
      "supplier": "Maison Claire",
      "notes": "Changeover clean",
      "issueId": "",
      "createdBy": "u-admin"
    },
    {
      "id": "e-3",
      "category": "utilities",
      "amount": 92,
      "currency": "EUR",
      "date": "2026-07-31",
      "supplier": "EDF",
      "notes": "July electricity",
      "issueId": "",
      "createdBy": "u-admin"
    },
    {
      "id": "e-4",
      "category": "improvements",
      "amount": 420,
      "currency": "EUR",
      "date": "2026-04-12",
      "supplier": "Jardin des Maures",
      "notes": "New olive and drip line",
      "issueId": "",
      "createdBy": "u-admin"
    }
  ],
  "inventory": [
    {
      "id": "inv-1",
      "name": "Kitchen range (smeg)",
      "category": "appliances",
      "purchaseDate": "2022-04-01",
      "warrantyUntil": "2027-04-01",
      "location": "Kitchen",
      "manualDocId": "",
      "notes": "Gas hob, electric oven."
    },
    {
      "id": "inv-2",
      "name": "Pool robot",
      "category": "pool",
      "purchaseDate": "2024-05-15",
      "warrantyUntil": "2026-05-15",
      "location": "Plant room",
      "manualDocId": "d-pool",
      "notes": "Charge after each use."
    },
    {
      "id": "inv-3",
      "name": "Garden dining table",
      "category": "furniture",
      "purchaseDate": "2021-06-01",
      "warrantyUntil": "",
      "location": "Terrace",
      "manualDocId": "",
      "notes": "Teak. Covers in the pool cupboard."
    },
    {
      "id": "inv-4",
      "name": "Fire TV stick",
      "category": "electronics",
      "purchaseDate": "2025-03-10",
      "warrantyUntil": "2026-03-10",
      "location": "Living room TV",
      "manualDocId": "d-wifi",
      "notes": "Family Amazon account."
    },
    {
      "id": "inv-5",
      "name": "Basic tool kit",
      "category": "tools",
      "purchaseDate": "2020-08-01",
      "warrantyUntil": "",
      "location": "Under-stairs cupboard",
      "manualDocId": "",
      "notes": "Hammer, bits, tape, spare bulbs."
    }
  ],
  "checklistItems": [
    { "id": "ck-bins", "label": "Bins out / emptied", "sort": 1, "active": true },
    { "id": "ck-dish", "label": "Dishwasher run and emptied", "sort": 2, "active": true },
    { "id": "ck-ac", "label": "Air conditioning off", "sort": 3, "active": true },
    { "id": "ck-win", "label": "Windows closed", "sort": 4, "active": true },
    { "id": "ck-doors", "label": "Doors locked", "sort": 5, "active": true },
    { "id": "ck-bbq", "label": "BBQ gas off and cool", "sort": 6, "active": true },
    { "id": "ck-out", "label": "Outdoor furniture / cushions put away", "sort": 7, "active": true },
    { "id": "ck-alarm", "label": "Alarm set", "sort": 8, "active": true },
    { "id": "ck-lights", "label": "Lights off", "sort": 9, "active": true }
  ],
  "checklistRecords": [
    {
      "id": "cr-jul",
      "bookingId": "b-jul",
      "completedItemIds": ["ck-bins", "ck-dish", "ck-ac", "ck-win", "ck-doors", "ck-bbq", "ck-out", "ck-alarm", "ck-lights"],
      "completedBy": "u-claire",
      "completedAt": "2026-07-18T09:40:00.000Z"
    }
  ],
  "mapSpots": [
    { "id": "ms-water", "label": "Water shut-off", "x": 18, "y": 72, "kind": "water", "note": "Blue valve in the plant room, left of the pump. Turn clockwise." },
    { "id": "ms-board", "label": "Electrical panel", "x": 22, "y": 38, "kind": "power", "note": "Grey board in the under-stairs cupboard. Main switch at the top." },
    { "id": "ms-fuse", "label": "Fuse box / RCDs", "x": 28, "y": 38, "kind": "power", "note": "Same cupboard, lower row. Labels in French and English." },
    { "id": "ms-gas", "label": "Gas shut-off", "x": 40, "y": 78, "kind": "gas", "note": "BBQ bottle: tap on top. Kitchen gas: yellow tap beside the range." },
    { "id": "ms-pool", "label": "Pool equipment", "x": 78, "y": 70, "kind": "pool", "note": "Plant room behind the kitchen. Timer on the wall. Do not change the clock." },
    { "id": "ms-alarm", "label": "Alarm panel", "x": 36, "y": 30, "kind": "security", "note": "Inside the front door, left wall." },
    { "id": "ms-keys", "label": "Spare keys", "x": 48, "y": 42, "kind": "keys", "note": "Kitchen drawer marked spares. Gate remotes in the olive-tree box." },
    { "id": "ms-park", "label": "Parking", "x": 14, "y": 18, "kind": "parking", "note": "Two spaces under the pines. Do not block the neighbour." },
    { "id": "ms-lights", "label": "Outdoor lighting", "x": 62, "y": 58, "kind": "lights", "note": "Switch by the terrace door. Timer in the plant room." }
  ],
  "systems": {
    "waterShutoff": "Plant room, blue valve left of the pump. Clockwise to close.",
    "electricalPanel": "Under-stairs cupboard. Main switch at the top of the grey board.",
    "fuseBox": "Same cupboard, lower RCD row. Labels in French and English.",
    "gasShutoff": "Kitchen: yellow tap by the range. BBQ: tap on the bottle.",
    "poolControls": "Plant room behind the kitchen. Timer on the wall — leave it.",
    "alarm": "Panel inside the front door. See Arrival — alarm in Documents."
  },
  "ideas": [
    {
      "id": "i-ev",
      "title": "EV charger in the carport",
      "description": "A simple wall charger for summer arrivals.",
      "status": "considered",
      "votes": ["u-claire", "u-admin"],
      "createdBy": "u-claire",
      "createdAt": "2026-05-28T16:00:00.000Z"
    },
    {
      "id": "i-table",
      "title": "New outdoor dining table",
      "description": "Current teak seats six tightly. A table for eight would help.",
      "status": "approved",
      "votes": ["u-claire"],
      "createdBy": "u-claire",
      "createdAt": "2026-07-11T11:00:00.000Z"
    },
    {
      "id": "i-lights",
      "title": "Softer pergola lighting",
      "description": "Warm bulbs instead of the bright spots.",
      "status": "suggested",
      "votes": ["u-guest"],
      "createdBy": "u-guest",
      "createdAt": "2026-08-10T20:00:00.000Z"
    },
    {
      "id": "i-sofa",
      "title": "Washable sofa covers",
      "description": "Done — covers arrived in June.",
      "status": "completed",
      "votes": ["u-admin", "u-claire"],
      "createdBy": "u-admin",
      "createdAt": "2026-04-02T10:00:00.000Z"
    },
    {
      "id": "i-boules",
      "title": "Boules court",
      "description": "Would eat the lower lawn. Kept as a no.",
      "status": "rejected",
      "votes": [],
      "createdBy": "u-claire",
      "createdAt": "2026-03-18T15:00:00.000Z"
    }
  ],
  "announcements": [
    {
      "id": "a-1",
      "title": "Pool open",
      "body": "The pool is open for the season. Cover on after 20:00. Children with an adult.",
      "createdBy": "u-admin",
      "createdAt": "2026-05-15T08:00:00.000Z"
    },
    {
      "id": "a-2",
      "title": "House closed 15–17 September",
      "body": "Pool pump replacement. Please do not book those nights. Thank you.",
      "createdBy": "u-admin",
      "createdAt": "2026-07-28T08:10:00.000Z"
    },
    {
      "id": "a-3",
      "title": "Bins: Tuesday collection",
      "body": "If you leave on a Tuesday, put bins out Monday evening on Chemin des Moulins.",
      "createdBy": "u-admin",
      "createdAt": "2026-06-10T09:00:00.000Z"
    }
  ],
  "activity": [
    {
      "id": "act-1",
      "action": "seeded",
      "entity": "house",
      "entityId": "house",
      "userId": "u-admin",
      "at": "2026-03-01T10:00:00.000Z",
      "detail": "Sample house data added for La Croix-Valmer"
    }
  ],
  "settings": {
    "updatedAt": "2026-08-11T10:00:00.000Z"
  }
};

