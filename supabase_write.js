const SUPABASE_URL = "https://qcxoupygmymoyhzeducm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gymnrgX3xFeqpV5ctnj2NQ_6awAp65w";
const form = document.getElementById("incidentForm");
const submitButton = document.getElementById("submitButton");
const status = document.getElementById("status");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    status.textContent = "Saving...";

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.latitude = payload.latitude || null;
    payload.longitude = payload.longitude || null;
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
        submitButton.disabled = false;
    }
});
