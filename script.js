let map;
let marker;
let reverseGeocodeTimer;
let reverseGeocodeController;
let lastReverseGeocodeAt = 0;
let locationSelectionVersion = 0;

function setIncidentLocation(latlng, address = null) {
    document.getElementById("latitude").value = latlng.lat;
    document.getElementById("longitude").value = latlng.lng;

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
        document.getElementById("mapStatus").textContent =
            "Location details filled from the selected search result. You can edit them below.";
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

    document.getElementById("location").value = location;
    document.getElementById("address").value =
        address.road || address.pedestrian || address.footway || "";
    document.getElementById("number").value = address.house_number || "";
    document.getElementById("tax_code").value = address.postcode || "";
}

function lookupAddress(latlng, selectionVersion) {
    const status = document.getElementById("mapStatus");
    status.textContent = "Looking up address details...";

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
                status.textContent = "No address details found for this point. You can enter them manually.";
                return;
            }

            fillAddressFields(result.address);
            status.textContent =
                "Address details filled from the map. You can edit them below.";
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error("Could not look up address details:", error);
            if (selectionVersion === locationSelectionVersion) {
                status.textContent =
                    "Could not look up address details. You can enter them manually.";
            }
        } finally {
            if (reverseGeocodeController === controller) {
                reverseGeocodeController = null;
            }
        }
    }, waitForRateLimit);
}

function clearIncidentLocation() {
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    document.getElementById("mapStatus").textContent = "";
}

function getLocation() {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            setIncidentLocation(location);
            map.setView(location, 16);
        },
        (error) => {
            console.error("Could not retrieve location:", error);
            alert("Unable to retrieve location. You can select a point on the map instead.");
        }
    );
}

function initializeMap() {
    map = L.map("map").setView([37.9838, 23.7275], 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const atticaGeocoder = L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
            countrycodes: "gr",
            // Nominatim viewbox order is west, north, east, south; this roughly bounds Attica.
            viewbox: "22.8,38.35,24.2,37.55",
            bounded: 1
        }
    });

    L.Control.geocoder({
        geocoder: atticaGeocoder,
        defaultMarkGeocode: false,
        placeholder: "Search for a place in Attica..."
    }).on("markgeocode", (event) => {
        const location = event.geocode.center;
        setIncidentLocation(location, event.geocode.properties?.address);
        map.setView(location, 16);
    }).addTo(map);

    // Keep manual map selection available alongside text search.
    map.on("click", (event) => {
        setIncidentLocation(event.latlng);
    });

}

window.addEventListener("load", initializeMap);

async function updateMapFromFields() {

    const location = document.getElementById("location").value.trim();
    const address = document.getElementById("address").value.trim();
    const number = document.getElementById("number").value.trim();
    const postcode = document.getElementById("tax_code").value.trim();

    if (!location && !address) {
        return;
    }

    const query =
        `${address} ${number}, ${location}, ${postcode}, Greece`;

    try {

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
            return;
        }

        const results = await response.json();

        if (!results.length) {
            return;
        }

        const latlng = {
            lat: parseFloat(results[0].lat),
            lng: parseFloat(results[0].lon)
        };

        setIncidentLocation(latlng);

        map.setView(latlng, 18);

    } catch (error) {
        console.error("Could not update map:", error);
    }
}

window.addEventListener("load", initializeMap);

window.addEventListener("load", () => {

    document.getElementById("location")
        .addEventListener("change", updateMapFromFields);

    document.getElementById("address")
        .addEventListener("change", updateMapFromFields);

    document.getElementById("number")
        .addEventListener("change", updateMapFromFields);

    document.getElementById("tax_code")
        .addEventListener("change", updateMapFromFields);

});