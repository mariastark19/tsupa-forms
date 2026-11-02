let map;
let marker;
let reverseGeocodeTimer;
let reverseGeocodeController;
let lastReverseGeocodeAt = 0;
let locationSelectionVersion = 0;
let atticaGeocoder;
let mapSearchInput;
const userEditedAddressFields = new Set();
const ATTICA_VIEWBOX = "22.8,38.35,24.2,37.55";
const SEARCH_RADIUS_LAT = 0.015;
const SEARCH_RADIUS_LNG = 0.015;
const popularLocations = [
    { label: "Syntagma", location: "Σύνταγμα", lat: 37.9755, lng: 23.7348 },
    { label: "Monastiraki", location: "Μοναστηράκι", lat: 37.9762, lng: 23.7257 },
    { label: "Omonia", location: "Ομόνοια", lat: 37.9842, lng: 23.7281 },
    { label: "Exarchia", location: "Εξάρχεια", lat: 37.9861, lng: 23.7378 },
    { label: "Metaxourgeio", location: "Μεταξουργείο", lat: 37.9856, lng: 23.7214 },
    { label: "Gazi", location: "Γκάζι", lat: 37.9782, lng: 23.7114 },

    { label: "Kypseli", location: "Κυψέλη", lat: 38.0010, lng: 23.7408 },

    { label: "Kolonos", location: "Κολωνός", lat: 37.9923, lng: 23.7138 },
    { label: "Sepolia", location: "Σεπόλια", lat: 38.0047, lng: 23.7130 },

    { label: "Patisia", location: "Πατήσια", lat: 38.0025, lng: 23.7308 },

    { label: "Ampelokipoi", location: "Αμπελόκηποι", lat: 37.9985, lng: 23.7620 },

    { label: "Victoria", location: "Πλατεία Βικτωρίας", lat: 37.9938, lng: 23.7305 },
    { label: "Attiki", location: "Πλατεία Αττικής", lat: 37.9991, lng: 23.7228 },

    { label: "Amerikis", location: "Πλατεία Αμερικής", lat: 38.0027, lng: 23.7382 },

    { label: "Petralona", location: "Πετράλωνα", lat: 37.9687, lng: 23.7088 },

    { label: "Kerameikos", location: "Κεραμεικός", lat: 37.9794, lng: 23.7165 },

    { label: "Kolonaki", location: "Κολωνάκι", lat: 37.9792, lng: 23.7432 },

];

document.querySelectorAll("#location, #address, #number, #tax_code").forEach((field) => {
    field.addEventListener("input", () => userEditedAddressFields.add(field));
});

function setReportFieldsEnabled(enabled) {
    document.querySelectorAll("[data-requires-map-pin]").forEach((field) => {
        field.disabled = !enabled;
    });
    document.getElementById("reportFields").hidden = !enabled;
}

function updateSearchArea(latlng, label = "selected pin") {
    if (!atticaGeocoder) {
        return;
    }

    const west = Math.max(22.8, latlng.lng - SEARCH_RADIUS_LNG);
    const east = Math.min(24.2, latlng.lng + SEARCH_RADIUS_LNG);
    const north = Math.min(38.35, latlng.lat + SEARCH_RADIUS_LAT);
    const south = Math.max(37.55, latlng.lat - SEARCH_RADIUS_LAT);
    atticaGeocoder.options.geocodingQueryParams.viewbox =
        `${west},${north},${east},${south}`;
    atticaGeocoder.options.geocodingQueryParams.bounded = 1;

    if (mapSearchInput) {
        mapSearchInput.placeholder = `Search near ${label}...`;
    }
}

function resetSearchArea() {
    if (!atticaGeocoder) {
        return;
    }

    atticaGeocoder.options.geocodingQueryParams.viewbox = ATTICA_VIEWBOX;
    atticaGeocoder.options.geocodingQueryParams.bounded = 1;
    if (mapSearchInput) {
        mapSearchInput.placeholder = "Search Athens or enter an address...";
    }
}

function getLocationLabel(address) {
    return address?.suburb ||
        address?.neighbourhood ||
        address?.neighborhood ||
        address?.quarter ||
        address?.city_district ||
        address?.city ||
        address?.town ||
        address?.village ||
        "selected pin";
}

function setIncidentLocation(latlng, address = null) {
    document.getElementById("latitude").value = latlng.lat;
    document.getElementById("longitude").value = latlng.lng;
    setReportFieldsEnabled(true);
    document.querySelectorAll(".quick-location").forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
    });
    const mapSection = document.querySelector(".map-section");
    const status = document.getElementById("mapStatus");
    mapSection.classList.remove("location-required");
    mapSection.classList.add("has-location");
    updateSearchArea(latlng, getLocationLabel(address));

    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng).addTo(map);
    }

    locationSelectionVersion += 1;
    if (reverseGeocodeTimer) {
        clearTimeout(reverseGeocodeTimer);
    }
    if (reverseGeocodeController) {
        reverseGeocodeController.abort();
        reverseGeocodeController = null;
    }

    if (address) {
        fillAddressFields(address);
        status.classList.remove("is-error");
        status.textContent = "Location selected. You can edit the details below.";
    } else {
        lookupAddress(latlng, locationSelectionVersion);
    }
}

function fillAddressFields(address) {
    const location =
        address.suburb ||
        address.neighbourhood ||
        address.neighborhood ||
        address.quarter ||
        address.city_district ||
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        "";

    const fields = {
        location: document.getElementById("location"),
        address: document.getElementById("address"),
        number: document.getElementById("number"),
        tax_code: document.getElementById("tax_code")
    };
    const values = {
        location,
        address: address.road || address.pedestrian || address.footway || "",
        number: address.house_number || "",
        tax_code: address.postcode || ""
    };

    Object.entries(fields).forEach(([name, field]) => {
        if (!userEditedAddressFields.has(field)) {
            field.value = values[name];
        }
    });
}

function lookupAddress(latlng, selectionVersion) {
    const status = document.getElementById("mapStatus");
    status.classList.remove("is-error");
    status.textContent = "Location selected. Finding nearby address…";

    const waitForRateLimit = Math.max(0, 1100 - (Date.now() - lastReverseGeocodeAt));
    reverseGeocodeTimer = setTimeout(async () => {
        const controller = new AbortController();
        reverseGeocodeController = controller;
        lastReverseGeocodeAt = Date.now();

        const query = new URLSearchParams({
            format: "jsonv2",
            addressdetails: "1",
            zoom: "18",
            lat: String(latlng.lat),
            lon: String(latlng.lng)
        });

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?${query}`,
                { signal: controller.signal }
            );
            if (!response.ok) {
                throw new Error(`Address lookup returned HTTP ${response.status}`);
            }

            const result = await response.json();
            if (selectionVersion !== locationSelectionVersion) {
                return;
            }

            if (!result.address) {
                status.textContent = "Location selected. Enter any address details you know.";
                return;
            }

            fillAddressFields(result.address);
            updateSearchArea(latlng, getLocationLabel(result.address));
            status.textContent = "Location selected. You can edit the details below.";
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error("Could not look up address details:", error);
            if (selectionVersion === locationSelectionVersion) {
                status.textContent = "Location selected. Enter any address details you know.";
            }
        } finally {
            if (reverseGeocodeController === controller) {
                reverseGeocodeController = null;
            }
        }
    }, waitForRateLimit);
}

function clearIncidentLocation() {
    locationSelectionVersion += 1;
    if (reverseGeocodeTimer) {
        clearTimeout(reverseGeocodeTimer);
        reverseGeocodeTimer = null;
    }
    if (reverseGeocodeController) {
        reverseGeocodeController.abort();
        reverseGeocodeController = null;
    }
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    userEditedAddressFields.clear();
    setReportFieldsEnabled(false);
    document.getElementById("latitude").value = "";
    document.getElementById("longitude").value = "";
    document.querySelector(".map-section").classList.remove("has-location", "location-required");
    resetSearchArea();
    const status = document.getElementById("mapStatus");
    status.classList.remove("is-error");
    status.textContent = "";
}

function initializeMap() {
    map = L.map("map").setView([37.9838, 23.7275], 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    atticaGeocoder = L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
            countrycodes: "gr",
            viewbox: ATTICA_VIEWBOX,
            bounded: 1
        }
    });

    const geocoderControl = L.Control.geocoder({
        geocoder: atticaGeocoder,
        defaultMarkGeocode: false,
        placeholder: "Search Athens or enter an address..."
    }).on("markgeocode", (event) => {
        const location = event.geocode.center;
        setIncidentLocation(location, event.geocode.properties?.address);
        map.setView(location, 16);
    }).addTo(map);
    mapSearchInput = geocoderControl.getContainer()
        .querySelector(".leaflet-control-geocoder-form input");

    // Keep manual map selection available alongside text search.
    map.on("click", (event) => {
        setIncidentLocation(event.latlng);
    });

    const quickLocations = document.getElementById("quickLocations");
    popularLocations.forEach((place) => {
        const button = document.createElement("button");
        button.className = "quick-location";
        button.type = "button";
        button.textContent = place.label;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
            const latlng = { lat: place.lat, lng: place.lng };
            setIncidentLocation(latlng, { suburb: place.location });
            button.classList.add("is-selected");
            button.setAttribute("aria-pressed", "true");
            document.getElementById("mapStatus").textContent =
                "Approximate area selected. Click the map to refine the pin.";
            map.setView(latlng, 16);
        });
        quickLocations.append(button);
    });
}

window.addEventListener("load", initializeMap);