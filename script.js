const slideshow = document.querySelector("iframe");

setInterval(function () {
    slideshow.src = slideshow.src;
}, 3600000);