function setBackgroundImage() {
    var header = document.querySelector(".masthead");
    var baseName = header.getAttribute("data-bg");
    var width = window.innerWidth;
    var size;
  
    if (width <= 319) {
      size = "small";
    } else if (width >= 320 && width <= 767) {
      size = "medium";
    } else {
      size = "large";
    }
  
    var formats = [
      { ext: "avif", mimeType: "image/avif" },
      { ext: "webp", mimeType: "image/webp" },
      { ext: "jpg", mimeType: "image/jpeg" }
    ];
  
    var foundSupportedFormat = false;
    for (var i = 0; i < formats.length; i++) {
      var format = formats[i];
      if (document.createElement("img").canPlayType(format.mimeType)) {
        header.style.backgroundImage = `url('https://tierheilpraxis-jessican.de/img/${baseName}-${size}.${format.ext}')`;
        header.style.backgroundSize = "100%";
        header.style.backgroundRepeat = "no-repeat";
        foundSupportedFormat = true;
        break;
      }
    }
  
    if (!foundSupportedFormat) {
      header.style.backgroundImage = `url('https://tierheilpraxis-jessican.de/img/${baseName}-large.jpg')`;
      header.style.backgroundSize = "100%";
      header.style.backgroundRepeat = "no-repeat";
    }
  }
  
  window.addEventListener("load", setBackgroundImage);
  window.addEventListener("resize", setBackgroundImage);
  