window.FARES_DATA = {
  "version": 1,
  "currency": "GBP",
  "asOf": "",
  "note": "Route list only — no live prices. BA and easyJet have no free public fare API. Open the airline buttons for today’s price. Optional: paste a Duffel / Amadeus / Kiwi key in Settings.",
  "airports": {
    "LHR": { "name": "London Heathrow", "city": "London" },
    "LGW": { "name": "London Gatwick", "city": "London" },
    "STN": { "name": "London Stansted", "city": "London" },
    "LCY": { "name": "London City", "city": "London" },
    "NCE": { "name": "Nice Côte d'Azur", "city": "Nice" },
    "MRS": { "name": "Marseille Provence", "city": "Marseille" },
    "TLN": { "name": "Toulon–Hyères", "city": "Hyères" }
  },
  "drives": {
    "NCE": { "min": 90, "max": 105, "label": "1h30–1h45", "summerNote": "Coastal road can be longer in summer." },
    "MRS": { "min": 90, "max": 105, "label": "1h30–1h45" },
    "TLN": { "min": 60, "max": 75, "label": "1h–1h15", "closest": true }
  },
  "routes": [
    { "id": "lgw-nce", "from": "LGW", "to": "NCE", "airline": "easyJet", "direct": true, "durationMin": 115, "stops": 0 },
    { "id": "lhr-nce", "from": "LHR", "to": "NCE", "airline": "British Airways", "direct": true, "durationMin": 125, "stops": 0 },
    { "id": "stn-nce", "from": "STN", "to": "NCE", "airline": "Ryanair", "direct": true, "durationMin": 120, "stops": 0 },
    { "id": "lcy-nce", "from": "LCY", "to": "NCE", "airline": "British Airways", "direct": true, "durationMin": 125, "stops": 0 },
    { "id": "lgw-mrs", "from": "LGW", "to": "MRS", "airline": "easyJet", "direct": true, "durationMin": 120, "stops": 0 },
    { "id": "stn-mrs", "from": "STN", "to": "MRS", "airline": "Ryanair", "direct": true, "durationMin": 125, "stops": 0 },
    { "id": "lhr-mrs", "from": "LHR", "to": "MRS", "airline": "Air France", "direct": false, "durationMin": 260, "stops": 1, "via": "CDG" },
    { "id": "lcy-mrs", "from": "LCY", "to": "MRS", "airline": "Air France", "direct": false, "durationMin": 310, "stops": 1, "via": "CDG" },
    { "id": "lgw-tln", "from": "LGW", "to": "TLN", "airline": "easyJet", "direct": true, "durationMin": 130, "stops": 0, "seasonal": true },
    { "id": "lhr-tln", "from": "LHR", "to": "TLN", "airline": "Air France", "direct": false, "durationMin": 300, "stops": 1, "via": "MRS" },
    { "id": "stn-tln", "from": "STN", "to": "TLN", "airline": "Ryanair + transfer", "direct": false, "durationMin": 360, "stops": 1, "via": "MRS" },
    { "id": "lcy-tln", "from": "LCY", "to": "TLN", "airline": "Air France", "direct": false, "durationMin": 390, "stops": 1, "via": "CDG" }
  ]
};
