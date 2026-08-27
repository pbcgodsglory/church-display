const slideshow = document.querySelector("iframe");

let currentVersion = null;

async function checkForUpdates() {
    try {
        const response = await fetch("version.txt?t=" + Date.now());
        const newVersion = (await response.text()).trim();

        if (currentVersion === null) {
            currentVersion = newVersion;
            return;
        }

        if (newVersion !== currentVersion) {
            currentVersion = newVersion;

            slideshow.src = slideshow.src;
        }

    } catch (error) {
        console.log("Could not check for display updates.");
    }
}

checkForUpdates();

setInterval(checkForUpdates, 30000);