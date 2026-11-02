const SUPABASE_URL = "https://qcxoupygmymoyhzeducm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gymnrgX3xFeqpV5ctnj2NQ_6awAp65w";
const form = document.getElementById("incidentForm");
const submitButton = document.getElementById("submitButton");
const status = document.getElementById("status");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const latitude = payload.latitude.trim();
    const longitude = payload.longitude.trim();
    if (
        latitude === "" ||
        longitude === "" ||
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        Number(latitude) < -90 ||
        Number(latitude) > 90 ||
        Number(longitude) < -180 ||
        Number(longitude) > 180
    ) {
        status.textContent = "Please select a location on the map before submitting.";
        const mapSection = document.querySelector(".map-section");
        mapSection.classList.add("location-required");
        const mapStatus = document.getElementById("mapStatus");
        mapStatus.classList.add("is-error");
        mapStatus.textContent = "Select a location on the map to continue.";
        document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("map").focus({ preventScroll: true });
        return;
    }

    if (!payload.incident_summary || payload.incident_summary.trim() === "") {
        status.textContent = "Please describe what happened before submitting.";
        return;
    }
    submitButton.disabled = true;
    console.log(payload);
    if (payload.incident_date === "") {payload.incident_date = null;}

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/incidents`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const details = await response.text();
            throw new Error(`Supabase returned ${response.status}: ${details}`);
        }

        status.textContent = "";
        const popup = document.getElementById("successMessage");
        popup.classList.add("show");
        setTimeout(() => {
            popup.classList.remove("show");
        }, 3000);
        form.reset();
        clearIncidentLocation();
    } catch (error) {
        console.error("Could not save incident:", error);
        status.textContent = error instanceof Error
            ? `Could not save incident: ${error.message}`
            : "Could not save incident. Check the browser console for details.";
    } finally {
        submitButton.disabled =
            document.getElementById("latitude").value === "" ||
            document.getElementById("longitude").value === "";
    }
});
